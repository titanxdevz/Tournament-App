import bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { z } from 'zod';
import { registerSchema, loginSchema, adminLoginSchema } from '../schemas/auth';

type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;
type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export class AuthService {
  // Helper to generate a unique 8-character referral code
  private static generateReferralCode(name: string): string {
    const cleanName = name.replace(/\s+/g, '').toUpperCase().slice(0, 4);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${cleanName}${rand}`;
  }

  // Register standard player
  static async registerUser(input: RegisterInput) {
    const { email, password, name, referralCode } = input;

    // Check if email already registered
    const existing = await prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new Error('Email address is already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const generatedCode = this.generateReferralCode(name);

    // Verify referral code of sponsor
    let referredByUser = null;
    if (referralCode) {
      referredByUser = await prisma.user.findUnique({
        where: { referralCode },
      });
    }

    // Transaction to create User, Wallet, and handle Referral Bonus
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          referralCode: generatedCode,
          referredById: referredByUser ? referredByUser.id : null,
        },
      });

      // Initialize user wallet with 0 balances
      // Bonus: ₹5 if registered with a referral code
      const signupBonus = referredByUser ? 5.00 : 0.00;
      const wallet = await tx.wallet.create({
        data: {
          userId: user.id,
          bonusBalance: signupBonus,
        },
      });

      if (signupBonus > 0) {
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            amount: signupBonus,
            type: 'BONUS',
            status: 'COMPLETED',
            metadata: { note: 'Signup referral bonus' },
          },
        });
      }

      // Sponsor gets a pending or immediate bonus? Let's credit ₹10 to sponsor's bonus wallet
      if (referredByUser) {
        const sponsorWallet = await tx.wallet.findUnique({
          where: { userId: referredByUser.id },
        });
        if (sponsorWallet) {
          await tx.wallet.update({
            where: { userId: referredByUser.id },
            data: {
              bonusBalance: Number(sponsorWallet.bonusBalance) + 10.00,
            },
          });
          await tx.transaction.create({
            data: {
              walletId: sponsorWallet.id,
              amount: 10.00,
              type: 'REFERRAL_BONUS',
              status: 'COMPLETED',
              metadata: { refereeId: user.id },
            },
          });
          // Also record notification for the sponsor
          await tx.notification.create({
            data: {
              userId: referredByUser.id,
              title: '🎁 Referral Bonus Received!',
              message: `Your friend ${name} signed up! ₹10 bonus credited.`,
              type: 'WALLET',
            },
          });
        }
      }

      return user;
    });

    return result;
  }

  // Login standard player
  static async loginUser(input: LoginInput) {
    const { email, password } = input;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { wallet: true },
    });

    if (!user || user.deletedAt) {
      throw new Error('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new Error('Account suspended or banned');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    return user;
  }

  // Admin login service
  static async loginAdmin(input: AdminLoginInput) {
    const { email, password } = input;

    const admin = await prisma.adminUser.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!admin || !admin.status) {
      throw new Error('Invalid credentials or admin account inactive');
    }

    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) {
      throw new Error('Invalid credentials or admin account inactive');
    }

    return admin;
  }

  // Seed default admin and roles if none exist (for bootstrap & verification)
  static async seedAdminBootstrap() {
    // 1. Find or create SUPER_ADMIN role
    let superAdminRole = await prisma.role.findUnique({
      where: { name: 'SUPER_ADMIN' },
    });

    if (!superAdminRole) {
      superAdminRole = await prisma.role.create({
        data: {
          name: 'SUPER_ADMIN',
          permissions: [
            'READ_USERS',
            'WRITE_USERS',
            'READ_TOURNAMENTS',
            'WRITE_TOURNAMENTS',
            'READ_DEPOSITS',
            'WRITE_DEPOSITS',
            'READ_WITHDRAWALS',
            'WRITE_WITHDRAWALS',
            'PUBLISH_RESULTS',
          ],
        },
      });
    }

    // 2. Ensure default admin user exists
    const adminUser = await prisma.adminUser.findUnique({
      where: { email: 'admin@92lr.com' },
    });

    if (!adminUser) {
      const hashedDefaultPassword = await bcrypt.hash('admin123', 10);
      await prisma.adminUser.create({
        data: {
          email: 'admin@92lr.com',
          password: hashedDefaultPassword,
          name: 'System Administrator',
          roleId: superAdminRole.id,
          status: true,
        },
      });
      console.log('✅ Default super admin created successfully.');
    } else {
      console.log('ℹ️ Default admin already exists in the database.');
    }
  }
}

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { AuthService } from '../services/authService';
import { registerSchema, loginSchema, adminLoginSchema } from '../schemas/auth';
import prisma from '../config/db';

const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /api/auth/register
  fastify.post('/register', async (request, reply) => {
    const data = registerSchema.parse(request.body);
    const user = await AuthService.registerUser(data);
    
    // Generate JWT tokens
    const accessToken = fastify.jwt.sign({ id: user.id, type: 'user' }, { expiresIn: '15m' });
    const refreshToken = fastify.jwt.sign({ id: user.id, type: 'user' }, { expiresIn: '7d' });

    // Set HttpOnly refresh token cookie
    reply.setCookie('refreshToken', refreshToken, {
      path: '/api/auth',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return reply.code(201).send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        referralCode: user.referralCode,
      },
      accessToken,
    });
  });

  // POST /api/auth/login
  fastify.post('/login', async (request, reply) => {
    const data = loginSchema.parse(request.body);
    const user = await AuthService.loginUser(data);

    // Generate JWT tokens
    const accessToken = fastify.jwt.sign({ id: user.id, type: 'user' }, { expiresIn: '15m' });
    const refreshToken = fastify.jwt.sign({ id: user.id, type: 'user' }, { expiresIn: '7d' });

    // Set HttpOnly refresh token cookie
    reply.setCookie('refreshToken', refreshToken, {
      path: '/api/auth',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return reply.code(200).send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        referralCode: user.referralCode,
      },
      accessToken,
    });
  });

  // POST /api/auth/admin/login
  fastify.post('/admin/login', async (request, reply) => {
    const data = adminLoginSchema.parse(request.body);
    const admin = await AuthService.loginAdmin(data);

    // Generate JWT tokens
    const accessToken = fastify.jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role.name, type: 'admin' },
      { expiresIn: '1h' }
    );
    const refreshToken = fastify.jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role.name, type: 'admin' },
      { expiresIn: '7d' }
    );

    // Set HttpOnly refresh token cookie
    reply.setCookie('refreshToken', refreshToken, {
      path: '/api/auth',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return reply.code(200).send({
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role.name,
      },
      accessToken,
    });
  });

  // POST /api/auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const token = request.cookies.refreshToken;
    if (!token) {
      return reply.code(401).send({ error: 'Refresh token cookie missing' });
    }

    try {
      const decoded = fastify.jwt.verify<{ id: string; type: 'user' | 'admin' }>(token);
      
      let accessToken = '';
      if (decoded.type === 'admin') {
        const admin = await prisma.adminUser.findUnique({
          where: { id: decoded.id },
          include: { role: true },
        });
        if (!admin || !admin.status) throw new Error();
        accessToken = fastify.jwt.sign(
          { id: admin.id, email: admin.email, role: admin.role.name, type: 'admin' },
          { expiresIn: '1h' }
        );
      } else {
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
        });
        if (!user || user.status !== 'ACTIVE') throw new Error();
        accessToken = fastify.jwt.sign(
          { id: user.id, type: 'user' },
          { expiresIn: '15m' }
        );
      }

      return reply.send({ accessToken });
    } catch (err) {
      return reply.code(401).send({ error: 'Invalid or expired refresh token' });
    }
  });

  // GET /api/auth/me (Protected User Profile)
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const payload = request.user;
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        referralCode: true,
        createdAt: true,
        wallet: true,
      },
    });

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return reply.send({ user });
  });

  // POST /api/auth/logout
  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('refreshToken', { path: '/api/auth' });
    return reply.send({ success: true });
  });

  // GET /api/auth/admin/users (Admin: List all users and their balances)
  fastify.get(
    '/admin/users',
    { preHandler: [fastify.authenticateAdmin, fastify.hasPermission('READ_USERS')] },
    async (request, reply) => {
      try {
        const users = await prisma.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            referralCode: true,
            status: true,
            createdAt: true,
            wallet: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        return reply.send({ success: true, users });
      } catch (err: any) {
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // PATCH /api/auth/admin/users/:id/status (Admin: Ban/Unban user)
  fastify.patch<{ Params: { id: string }; Body: { status: 'ACTIVE' | 'BANNED' | 'SUSPENDED' } }>(
    '/admin/users/:id/status',
    {
      preHandler: [fastify.authenticateAdmin, fastify.hasPermission('WRITE_USERS')],
    },
    async (request, reply) => {
      const userId = request.params.id;
      const { status } = request.body;

      try {
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { status },
        });

        return reply.send({ success: true, user: updatedUser });
      } catch (err: any) {
        return reply.code(400).send({ error: err.message });
      }
    }
  );

  // POST /api/auth/admin/users/:id/adjust (Admin: Add/Remove Coins)
  fastify.post<{ Params: { id: string }; Body: { amount: number; type: 'winningBalance' | 'depositBalance' | 'bonusBalance' | 'refundBalance'; action: 'ADD' | 'REMOVE' } }>(
    '/admin/users/:id/adjust',
    {
      preHandler: [fastify.authenticateAdmin, fastify.hasPermission('WRITE_USERS')],
    },
    async (request, reply) => {
      const userId = request.params.id;
      const { amount, type, action } = request.body;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const wallet = await tx.wallet.findUnique({
            where: { userId },
          });

          if (!wallet) {
            throw new Error('User wallet not found');
          }

          const currentVal = Number(wallet[type]);
          const adjustment = Number(amount);
          const newVal = action === 'ADD' ? currentVal + adjustment : Math.max(0, currentVal - adjustment);

          const updatedWallet = await tx.wallet.update({
            where: { userId },
            data: {
              [type]: newVal,
            },
          });

          let txType: any = 'DEPOSIT';
          if (type === 'winningBalance') txType = 'WINNINGS';
          if (type === 'bonusBalance') txType = 'BONUS';
          if (type === 'refundBalance') txType = 'REFUND';

          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              amount: adjustment,
              type: txType,
              status: 'COMPLETED',
              metadata: { adminAdjust: true, action },
            },
          });

          return updatedWallet;
        });

        return reply.send({ success: true, wallet: result });
      } catch (err: any) {
        return reply.code(400).send({ error: err.message });
      }
    }
  );

  // PATCH /api/auth/admin/users/:id/password (Admin: Reset User Password)
  fastify.patch<{ Params: { id: string }; Body: { password: string } }>(
    '/admin/users/:id/password',
    {
      preHandler: [fastify.authenticateAdmin, fastify.hasPermission('WRITE_USERS')],
    },
    async (request, reply) => {
      const userId = request.params.id;
      const { password } = request.body;

      if (!password || password.length < 6) {
        return reply.code(400).send({ error: 'Password must be at least 6 characters long' });
      }

      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.user.update({
          where: { id: userId },
          data: { password: hashedPassword },
        });

        return reply.send({ success: true, message: 'Password updated successfully.' });
      } catch (err: any) {
        return reply.code(400).send({ error: err.message });
      }
    }
  );

  // DELETE /api/auth/admin/users/:id (Admin: Delete User Account and Cascade References)
  fastify.delete<{ Params: { id: string } }>(
    '/admin/users/:id',
    {
      preHandler: [fastify.authenticateAdmin, fastify.hasPermission('WRITE_USERS')],
    },
    async (request, reply) => {
      const userId = request.params.id;

      try {
        await prisma.$transaction(async (tx) => {
          // Deleting references that have onDelete: Restrict
          await tx.tournamentRegistration.deleteMany({ where: { userId } });
          await tx.tournamentResult.deleteMany({ where: { userId } });
          await tx.paymentRequest.deleteMany({ where: { userId } });
          await tx.withdrawalRequest.deleteMany({ where: { userId } });
          await tx.supportMessage.deleteMany({ where: { senderId: userId } });
          await tx.supportTicket.deleteMany({ where: { userId } });
          
          // Now we can safely delete the user
          await tx.user.delete({ where: { id: userId } });
        });

        return reply.send({ success: true, message: 'User account and all linked records deleted successfully.' });
      } catch (err: any) {
        return reply.code(400).send({ error: err.message });
      }
    }
  );
};

export default authRoutes;

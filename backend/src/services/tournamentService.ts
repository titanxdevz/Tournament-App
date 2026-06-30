import prisma from '../config/db';
import { createTournamentSchema, joinTournamentSchema } from '../schemas/tournament';
import { z } from 'zod';
import { notificationsQueue } from '../queues/queues';

type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
type JoinTournamentInput = z.infer<typeof joinTournamentSchema>;

export class TournamentService {
  // Create a new tournament (Admin only)
  static async createTournament(input: CreateTournamentInput) {
    const tournament = await prisma.tournament.create({
      data: {
        title: input.title,
        description: input.description,
        gameType: input.gameType,
        entryFee: input.entryFee,
        prizePool: input.prizePool,
        prizeDistribution: input.prizeDistribution,
        maxSlots: input.maxSlots,
        startTime: new Date(input.startTime),
        rules: input.rules,
        imageUrl: input.imageUrl,
        status: 'UPCOMING',
      },
    });

    // Create a matching MatchRoom for this tournament
    await prisma.matchRoom.create({
      data: {
        tournamentId: tournament.id,
        status: 'WAITING',
      },
    });

    return tournament;
  }

  // Join a tournament (User)
  static async joinTournament(userId: string, tournamentId: string, input: JoinTournamentInput) {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch tournament and verify slots
      const tournament = await tx.tournament.findUnique({
        where: { id: tournamentId },
      });

      if (!tournament) {
        throw new Error('Tournament not found');
      }

      if (tournament.status !== 'UPCOMING') {
        throw new Error('Registration is closed for this tournament');
      }

      if (tournament.filledSlots >= tournament.maxSlots) {
        throw new Error('Tournament is fully booked');
      }

      // Check duplicate registration
      const existingRegistration = await tx.tournamentRegistration.findUnique({
        where: {
          tournamentId_userId: { tournamentId, userId },
        },
      });

      if (existingRegistration) {
        throw new Error('You are already registered for this tournament');
      }

      // 2. Wallet Deductions
      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const fee = Number(tournament.entryFee);
      const refundBal = Number(wallet.refundBalance);
      const depositBal = Number(wallet.depositBalance);
      const winningBal = Number(wallet.winningBalance);
      const bonusBal = Number(wallet.bonusBalance);

      const totalBalance = refundBal + depositBal + winningBal + bonusBal;
      if (totalBalance < fee) {
        throw new Error('Insufficient wallet balance to join this tournament');
      }

      // Deducting balance sequentially: refund -> deposit -> winning -> bonus
      let remainingFee = fee;
      let newRefund = refundBal;
      let newDeposit = depositBal;
      let newWinning = winningBal;
      let newBonus = bonusBal;

      if (newRefund >= remainingFee) {
        newRefund -= remainingFee;
        remainingFee = 0;
      } else {
        remainingFee -= newRefund;
        newRefund = 0;
      }

      if (remainingFee > 0) {
        if (newDeposit >= remainingFee) {
          newDeposit -= remainingFee;
          remainingFee = 0;
        } else {
          remainingFee -= newDeposit;
          newDeposit = 0;
        }
      }

      if (remainingFee > 0) {
        if (newWinning >= remainingFee) {
          newWinning -= remainingFee;
          remainingFee = 0;
        } else {
          remainingFee -= newWinning;
          newWinning = 0;
        }
      }

      if (remainingFee > 0) {
        if (newBonus >= remainingFee) {
          newBonus -= remainingFee;
          remainingFee = 0;
        } else {
          // Fallback check
          throw new Error('Insufficient balance after processing allocations');
        }
      }

      // Update balances in database
      await tx.wallet.update({
        where: { userId },
        data: {
          refundBalance: newRefund,
          depositBalance: newDeposit,
          winningBalance: newWinning,
          bonusBalance: newBonus,
        },
      });

      // 3. Register and increment slot count
      const currentSlot = tournament.filledSlots + 1;
      const registration = await tx.tournamentRegistration.create({
        data: {
          tournamentId,
          userId,
          inGameName: input.inGameName,
          inGameId: input.inGameId,
          slotNumber: currentSlot,
          status: 'REGISTERED',
        },
      });

      await tx.tournament.update({
        where: { id: tournamentId },
        data: {
          filledSlots: currentSlot,
          status: currentSlot === tournament.maxSlots ? 'LIVE' : 'UPCOMING', // Simple transition
        },
      });

      // Create transaction log
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          amount: fee,
          type: 'JOIN_FEE',
          status: 'COMPLETED',
          referenceId: registration.id,
        },
      });

      // 4. Queue Notification job
      await notificationsQueue.add('registration-notification', {
        userId,
        title: '🎮 Registration Successful!',
        message: `You have joined the "${tournament.title}" tournament. Your slot is #${currentSlot}.`,
        type: 'TOURNAMENT',
      });

      return { registration, currentSlot };
    });
  }

  // Cancel registration and issue full refund (User/Admin action)
  static async cancelAndRefundRegistration(registrationId: string) {
    return await prisma.$transaction(async (tx) => {
      const reg = await tx.tournamentRegistration.findUnique({
        where: { id: registrationId },
        include: { tournament: true },
      });

      if (!reg || reg.status !== 'REGISTERED') {
        throw new Error('Registration not found or already cancelled');
      }

      // Update registration status
      await tx.tournamentRegistration.update({
        where: { id: registrationId },
        data: { status: 'REFUNDED' },
      });

      // Decrement filled slots
      await tx.tournament.update({
        where: { id: reg.tournamentId },
        data: {
          filledSlots: { decrement: 1 },
          status: 'UPCOMING', // Revert from live if max slots drops
        },
      });

      // Fetch user's wallet to issue refund
      const wallet = await tx.wallet.findUnique({
        where: { userId: reg.userId },
      });

      if (!wallet) {
        throw new Error('User wallet not found');
      }

      const fee = Number(reg.tournament.entryFee);
      // Refund goes into refundBalance
      await tx.wallet.update({
        where: { userId: reg.userId },
        data: {
          refundBalance: Number(wallet.refundBalance) + fee,
        },
      });

      // Create refund transaction entry
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          amount: fee,
          type: 'REFUND',
          status: 'COMPLETED',
          referenceId: reg.tournamentId,
        },
      });

      // Schedule notification
      await notificationsQueue.add('refund-notification', {
        userId: reg.userId,
        title: '💸 Tournament Refund Issued',
        message: `Refund of ₹${fee} has been credited to your refund balance for "${reg.tournament.title}".`,
        type: 'WALLET',
      });

      return { success: true };
    });
  }

  // Update tournament status (Start, Cancel, Stop matches)
  static async updateTournamentStatus(tournamentId: string, status: 'UPCOMING' | 'LIVE' | 'CANCELLED' | 'COMPLETED') {
    return await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.findUnique({
        where: { id: tournamentId },
      });

      if (!tournament) {
        throw new Error('Tournament not found');
      }

      // If status is CANCELLED, refund all registered users
      if (status === 'CANCELLED') {
        const registrations = await tx.tournamentRegistration.findMany({
          where: { tournamentId, status: 'REGISTERED' },
        });

        const entryFee = Number(tournament.entryFee);

        for (const reg of registrations) {
          // Update registration status to CANCELLED/REFUNDED
          await tx.tournamentRegistration.update({
            where: { id: reg.id },
            data: { status: 'CANCELLED' },
          });

          // Credit back user's refundBalance
          const wallet = await tx.wallet.findUnique({
            where: { userId: reg.userId },
          });

          if (wallet) {
            await tx.wallet.update({
              where: { userId: reg.userId },
              data: {
                refundBalance: Number(wallet.refundBalance) + entryFee,
              },
            });

            // Log refund transaction
            await tx.transaction.create({
              data: {
                walletId: wallet.id,
                amount: entryFee,
                type: 'REFUND',
                status: 'COMPLETED',
                referenceId: tournamentId,
              },
            });

            // Schedule notification
            await notificationsQueue.add('cancelled-refund-notification', {
              userId: reg.userId,
              title: '❌ Tournament Cancelled & Refunded',
              message: `The tournament "${tournament.title}" has been cancelled by admins. Your entry fee of ₹${entryFee} has been refunded to your wallet.`,
              type: 'WALLET',
            });
          }
        }

        // Reset filled slots to 0 upon cancellation
        return await tx.tournament.update({
          where: { id: tournamentId },
          data: { status, filledSlots: 0 },
        });
      }

      // If not cancelled, just update status
      return await tx.tournament.update({
        where: { id: tournamentId },
        data: { status },
      });
    });
  }

  // Delete a tournament (cascade deletion of rooms and registrations with refunds)
  static async deleteTournament(tournamentId: string) {
    return await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.findUnique({
        where: { id: tournamentId },
      });

      if (!tournament) {
        throw new Error('Tournament not found');
      }

      // Refund joined players first
      const registrations = await tx.tournamentRegistration.findMany({
        where: { tournamentId, status: 'REGISTERED' },
      });

      const entryFee = Number(tournament.entryFee);
      for (const reg of registrations) {
        const wallet = await tx.wallet.findUnique({
          where: { userId: reg.userId },
        });

        if (wallet) {
          await tx.wallet.update({
            where: { userId: reg.userId },
            data: {
              refundBalance: Number(wallet.refundBalance) + entryFee,
            },
          });

          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              amount: entryFee,
              type: 'REFUND',
              status: 'COMPLETED',
              referenceId: tournamentId,
            },
          });
        }
      }

      // Delete child references
      await tx.matchRoom.deleteMany({
        where: { tournamentId },
      });

      await tx.tournamentRegistration.deleteMany({
        where: { tournamentId },
      });

      // Delete parent record
      return await tx.tournament.delete({
        where: { id: tournamentId },
      });
    });
  }
}

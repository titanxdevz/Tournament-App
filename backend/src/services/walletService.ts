import prisma from '../config/db';
import { initiateDepositSchema, reviewDepositSchema, requestWithdrawalSchema, reviewWithdrawalSchema } from '../schemas/wallet';
import { z } from 'zod';
import { notificationsQueue } from '../queues/queues';

type InitiateDepositInput = z.infer<typeof initiateDepositSchema>;
type ReviewDepositInput = z.infer<typeof reviewDepositSchema>;
type RequestWithdrawalInput = z.infer<typeof requestWithdrawalSchema>;
type ReviewWithdrawalInput = z.infer<typeof reviewWithdrawalSchema>;

export class WalletService {
  // Initiate a manual deposit request (User upload screen)
  static async initiateDeposit(userId: string, input: InitiateDepositInput, screenshotUrl: string) {
    // Prevent double UTR check
    const existing = await prisma.paymentRequest.findUnique({
      where: { utr: input.utr },
    });

    if (existing) {
      throw new Error('This transaction reference (UTR) has already been submitted');
    }

    return await prisma.paymentRequest.create({
      data: {
        userId,
        amount: input.amount,
        upiId: input.upiId,
        utr: input.utr,
        screenshotUrl,
        status: 'PENDING',
      },
    });
  }

  // Review & approve/reject manual deposit request (Admin)
  static async reviewDeposit(adminId: string, requestId: string, input: ReviewDepositInput) {
    return await prisma.$transaction(async (tx) => {
      const request = await tx.paymentRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        throw new Error('Deposit request not found');
      }

      if (request.status !== 'PENDING') {
        throw new Error('Deposit request has already been reviewed');
      }

      // Update deposit request
      const updatedRequest = await tx.paymentRequest.update({
        where: { id: requestId },
        data: {
          status: input.status,
          rejectionReason: input.rejectionReason || null,
          approvedById: adminId,
        },
      });

      // If approved, update wallet deposit balance
      if (input.status === 'APPROVED') {
        const wallet = await tx.wallet.findUnique({
          where: { userId: request.userId },
        });

        if (!wallet) {
          throw new Error('Wallet not found for user');
        }

        const newDepositBalance = Number(wallet.depositBalance) + Number(request.amount);

        await tx.wallet.update({
          where: { userId: request.userId },
          data: {
            depositBalance: newDepositBalance,
          },
        });

        // Record transaction log
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            amount: request.amount,
            type: 'DEPOSIT',
            status: 'COMPLETED',
            referenceId: request.id,
          },
        });

        // Trigger Notification
        await notificationsQueue.add('deposit-approved-notification', {
          userId: request.userId,
          title: '💰 Deposit Approved',
          message: `Your deposit of ₹${request.amount} has been successfully added to your wallet.`,
          type: 'WALLET',
        });
      } else {
        // Trigger Rejection Notification
        await notificationsQueue.add('deposit-rejected-notification', {
          userId: request.userId,
          title: '❌ Deposit Rejected',
          message: `Your deposit of ₹${request.amount} was rejected. Reason: ${input.rejectionReason || 'Invalid details'}`,
          type: 'WALLET',
        });
      }

      // Record admin Audit Log
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: input.status === 'APPROVED' ? 'DEPOSIT_APPROVE' : 'DEPOSIT_REJECT',
          entityType: 'PaymentRequest',
          entityId: requestId,
          newValue: { status: input.status, reason: input.rejectionReason || '' },
        },
      });

      return updatedRequest;
    });
  }

  // Request a withdrawal (User)
  static async requestWithdrawal(userId: string, input: RequestWithdrawalInput) {
    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const withdrawAmount = input.amount;
      const winningBal = Number(wallet.winningBalance);

      if (winningBal < withdrawAmount) {
        throw new Error('Insufficient winning balance. Withdrawals can only be paid from winnings.');
      }

      // Debit winnings immediately and place into lockedBalance to prevent double withdrawals
      await tx.wallet.update({
        where: { userId },
        data: {
          winningBalance: winningBal - withdrawAmount,
          lockedBalance: Number(wallet.lockedBalance) + withdrawAmount,
        },
      });

      // Create withdrawal request entry
      const withdrawalRequest = await tx.withdrawalRequest.create({
        data: {
          userId,
          amount: withdrawAmount,
          upiId: input.upiId,
          status: 'PENDING',
        },
      });

      // Create pending transaction log
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          amount: withdrawAmount,
          type: 'WITHDRAWAL',
          status: 'PENDING',
          referenceId: withdrawalRequest.id,
        },
      });

      return withdrawalRequest;
    });
  }

  // Review withdrawal request (Admin)
  static async reviewWithdrawal(adminId: string, requestId: string, input: ReviewWithdrawalInput) {
    return await prisma.$transaction(async (tx) => {
      const request = await tx.withdrawalRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        throw new Error('Withdrawal request not found');
      }

      if (request.status !== 'PENDING') {
        throw new Error('Withdrawal request has already been reviewed');
      }

      // Update withdrawal record status
      const updatedRequest = await tx.withdrawalRequest.update({
        where: { id: requestId },
        data: {
          status: input.status,
          rejectionReason: input.rejectionReason || null,
          approvedById: adminId,
        },
      });

      const wallet = await tx.wallet.findUnique({
        where: { userId: request.userId },
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const withdrawAmount = Number(request.amount);

      if (input.status === 'APPROVED') {
        // Debit the lockedBalance permanently
        await tx.wallet.update({
          where: { userId: request.userId },
          data: {
            lockedBalance: Number(wallet.lockedBalance) - withdrawAmount,
          },
        });

        // Update transaction status to COMPLETED
        const txn = await tx.transaction.findFirst({
          where: { referenceId: request.id },
        });

        if (txn) {
          await tx.transaction.update({
            where: { id: txn.id },
            data: { status: 'COMPLETED' },
          });
        }

        // Notification
        await notificationsQueue.add('withdraw-approved-notification', {
          userId: request.userId,
          title: '💸 Withdrawal Successful',
          message: `Your withdrawal of ₹${withdrawAmount} has been sent to UPI: ${request.upiId}.`,
          type: 'WALLET',
        });
      } else {
        // Refund back to winningBalance from lockedBalance
        await tx.wallet.update({
          where: { userId: request.userId },
          data: {
            winningBalance: Number(wallet.winningBalance) + withdrawAmount,
            lockedBalance: Number(wallet.lockedBalance) - withdrawAmount,
          },
        });

        // Update transaction status to REJECTED/FAILED
        const txn = await tx.transaction.findFirst({
          where: { referenceId: request.id },
        });

        if (txn) {
          await tx.transaction.update({
            where: { id: txn.id },
            data: { status: 'REJECTED' },
          });
        }

        // Notification
        await notificationsQueue.add('withdraw-rejected-notification', {
          userId: request.userId,
          title: '❌ Withdrawal Rejected',
          message: `Your withdrawal of ₹${withdrawAmount} was rejected. Reason: ${input.rejectionReason || 'Invalid details'}. Funds returned to your winning balance.`,
          type: 'WALLET',
        });
      }

      // Record Audit
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: input.status === 'APPROVED' ? 'WITHDRAW_APPROVE' : 'WITHDRAW_REJECT',
          entityType: 'WithdrawalRequest',
          entityId: requestId,
          newValue: { status: input.status, reason: input.rejectionReason || '' },
        },
      });

      return updatedRequest;
    });
  }
}

import { z } from 'zod';

export const initiateDepositSchema = z.object({
  amount: z.preprocess((val) => Number(val), z.number().min(15, 'Minimum deposit amount is ₹15')),
  upiId: z.string().min(3, 'UPI ID is required'),
  utr: z.string().length(12, 'UTR must be exactly 12 digits').regex(/^\d+$/, 'UTR must contain only digits'),
});

export const requestWithdrawalSchema = z.object({
  amount: z.number().min(50, 'Minimum withdrawal amount is ₹50'),
  upiId: z.string().min(3, 'Target UPI ID is required'),
});

export const reviewDepositSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
});

export const reviewWithdrawalSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
});

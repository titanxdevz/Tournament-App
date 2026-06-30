import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import QRCode from 'qrcode';
import prisma from '../config/db';
import { WalletService } from '../services/walletService';
import { CloudinaryService } from '../services/cloudinaryService';
import {
  initiateDepositSchema,
  requestWithdrawalSchema,
  reviewDepositSchema,
  reviewWithdrawalSchema,
} from '../schemas/wallet';
import { env } from '../config/env';

const walletRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /api/wallet (User - retrieve balances and transaction logs)
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const payload = request.user;

    const wallet = await prisma.wallet.findUnique({
      where: { userId: payload.id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!wallet) {
      return reply.code(404).send({ error: 'Wallet not found' });
    }

    return reply.send({ wallet });
  });

  // POST /api/wallet/generate-qr (User - generate UPI QR code for deposit)
  fastify.post('/generate-qr', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { amount } = request.body as { amount: number };

    if (!amount || amount < 15) {
      return reply.code(400).send({ error: 'Minimum amount is ₹15' });
    }

    const merchantUpi = env.MERCHANT_UPI || '92lr@slc';
    const merchantName = encodeURIComponent('92LR');
    const transactionNote = encodeURIComponent('Deposit to 92LR Wallet');
    const upiLink = `upi://pay?pa=${merchantUpi}&pn=${merchantName}&am=${amount}&cu=INR&tn=${transactionNote}`;

    const qrDataUrl = await QRCode.toDataURL(upiLink, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    return reply.send({
      success: true,
      qrDataUrl,
      upiLink,
      upiId: merchantUpi,
      amount,
    });
  });

  // POST /api/wallet/deposit (User - manual deposit with screenshot upload)
  fastify.post('/deposit', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const payload = request.user;

    // Check if multipart request
    if (!request.isMultipart()) {
      return reply.code(400).send({ error: 'Request must be multipart/form-data' });
    }

    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'Screenshot file is required' });
    }

    // Extract text fields
    const amountVal = (data.fields.amount as any)?.value;
    const upiIdVal = (data.fields.upiId as any)?.value;
    const utrVal = (data.fields.utr as any)?.value;

    // Validate using Zod
    const validatedData = initiateDepositSchema.parse({
      amount: amountVal,
      upiId: upiIdVal,
      utr: utrVal,
    });

    // Validate screenshot mime type
    if (!data.mimetype.startsWith('image/')) {
      return reply.code(400).send({ error: 'File must be an image screenshot (JPEG/PNG)' });
    }

    // Upload screenshot to Cloudinary
    const uploadResult = await CloudinaryService.uploadStream(data.file, 'deposits');
    const screenshotUrl = uploadResult.secure_url;

    const paymentRequest = await WalletService.initiateDeposit(
      payload.id,
      validatedData,
      screenshotUrl
    );

    return reply.code(201).send({
      success: true,
      message: 'Deposit request submitted successfully. Pending administrator verification.',
      paymentRequest,
    });
  });

  // POST /api/wallet/withdraw (User - request withdrawal)
  fastify.post('/withdraw', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const payload = request.user;
    const body = requestWithdrawalSchema.parse(request.body);

    const withdrawalRequest = await WalletService.requestWithdrawal(payload.id, body);

    // Update wallet websocket
    const updatedWallet = await prisma.wallet.findUnique({
      where: { userId: payload.id },
    });
    if (updatedWallet) {
      await fastify.emitToUser(payload.id, 'wallet:updated', updatedWallet);
    }

    return reply.code(201).send({
      success: true,
      message: 'Withdrawal requested successfully. Funds locked for review.',
      withdrawalRequest,
    });
  });

  // ADMIN ENDPOINTS (Protected by RBAC roles)

  // GET /api/wallet/admin/deposits (Admin - list deposit review requests)
  fastify.get(
    '/admin/deposits',
    { preHandler: [fastify.authenticateAdmin, fastify.hasPermission('READ_DEPOSITS')] },
    async (request, reply) => {
      const deposits = await prisma.paymentRequest.findMany({
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return reply.send({ deposits });
    }
  );

  // GET /api/wallet/admin/withdrawals (Admin - list withdrawals review requests)
  fastify.get(
    '/admin/withdrawals',
    { preHandler: [fastify.authenticateAdmin, fastify.hasPermission('READ_WITHDRAWALS')] },
    async (request, reply) => {
      const withdrawals = await prisma.withdrawalRequest.findMany({
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return reply.send({ withdrawals });
    }
  );

  // POST /api/wallet/admin/deposits/:id/verify (Admin - approve/reject deposit)
  fastify.post(
    '/admin/deposits/:id/verify',
    { preHandler: [fastify.authenticateAdmin, fastify.hasPermission('WRITE_DEPOSITS')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = reviewDepositSchema.parse(request.body);
      const adminPayload = request.user;

      const updatedRequest = await WalletService.reviewDeposit(adminPayload.id, id, body);

      // Realtime websocket sync
      const updatedWallet = await prisma.wallet.findUnique({
        where: { userId: updatedRequest.userId },
      });
      if (updatedWallet) {
        await fastify.emitToUser(updatedRequest.userId, 'wallet:updated', updatedWallet);
      }

      // Send socket payment notification
      await fastify.emitToUser(updatedRequest.userId, 'payment:status', {
        requestId: updatedRequest.id,
        status: updatedRequest.status,
        message: body.status === 'APPROVED' ? 'Deposit Approved!' : `Rejected: ${body.rejectionReason}`,
      });

      return reply.send({ success: true, request: updatedRequest });
    }
  );

  // POST /api/wallet/admin/withdrawals/:id/verify (Admin - approve/reject withdrawal)
  fastify.post(
    '/admin/withdrawals/:id/verify',
    { preHandler: [fastify.authenticateAdmin, fastify.hasPermission('WRITE_WITHDRAWALS')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = reviewWithdrawalSchema.parse(request.body);
      const adminPayload = request.user;

      const updatedRequest = await WalletService.reviewWithdrawal(adminPayload.id, id, body);

      // Realtime websocket sync
      const updatedWallet = await prisma.wallet.findUnique({
        where: { userId: updatedRequest.userId },
      });
      if (updatedWallet) {
        await fastify.emitToUser(updatedRequest.userId, 'wallet:updated', updatedWallet);
      }

      // Send socket payment status
      await fastify.emitToUser(updatedRequest.userId, 'payment:status', {
        requestId: updatedRequest.id,
        status: updatedRequest.status,
        message: body.status === 'APPROVED' ? 'Withdrawal Approved & Sent!' : `Rejected: ${body.rejectionReason}`,
      });

      return reply.send({ success: true, request: updatedRequest });
    }
  );
};

export default walletRoutes;

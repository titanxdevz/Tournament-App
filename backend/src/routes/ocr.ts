import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ocrQueue } from '../queues/queues';
import { OcrService } from '../services/ocrService';
import { CloudinaryService } from '../services/cloudinaryService';
import prisma from '../config/db';
import { z } from 'zod';

const approveDraftSchema = z.object({
  players: z.array(
    z.object({
      name: z.string(),
      uid: z.string().optional().nullable(),
      rank: z.number().int(),
      kills: z.number().int(),
      matchedUserId: z.string().uuid().optional().nullable(),
      registrationId: z.string().uuid().optional().nullable()
    })
  )
});

const ocrRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  
  // POST /api/ocr/upload (Protected - upload standings screenshots)
  fastify.post('/upload', {
    preHandler: [fastify.authenticateAdmin]
  }, async (request, reply) => {
    if (!request.isMultipart()) {
      return reply.code(400).send({ error: 'Request must be multipart/form-data' });
    }

    const parts = request.files();
    let tournamentId = '';
    const screenshotsList: Array<{ url: string; hash: string; resolution: string; blur: number; brightness: number }> = [];

    try {
      for await (const part of parts) {
        if (part.fieldname === 'tournamentId') {
          tournamentId = (part as any).value;
          continue;
        }

        if (part.fieldname === 'file') {
          // Accumulate file buffer
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          const rawBuffer = Buffer.concat(chunks);

          // Validation size & formats
          if (!part.mimetype.startsWith('image/')) {
            return reply.code(400).send({ error: 'Only image files are allowed' });
          }

          // Compute duplicate detection hash
          const hash = OcrService.computeHash(rawBuffer);
          const isDuplicate = await OcrService.checkDuplicateHash(hash);
          if (isDuplicate) {
            return reply.code(400).send({ error: 'Duplicate screenshot detected. This image was already processed.' });
          }

          // Quality checks & Sharp compression
          const { resolution, blur, brightness } = await OcrService.analyzeQuality(rawBuffer);
          
          if (blur < 1.0) {
            return reply.code(400).send({ error: 'Screenshot image is too blurry. Please upload a clear image.' });
          }

          const { data: optimizedBuffer } = await OcrService.compressAndOptimize(rawBuffer);

          // Upload to Cloudinary
          const uploadResult = await CloudinaryService.uploadStream(optimizedBuffer, 'standings');
          
          screenshotsList.push({
            url: uploadResult.secure_url,
            hash,
            resolution,
            blur,
            brightness
          });

          // Cache hash to prevent reprocessing
          await OcrService.cacheHash(hash, tournamentId || 'unknown');
        }
      }

      if (!tournamentId) {
        return reply.code(400).send({ error: 'Missing tournamentId field' });
      }

      if (screenshotsList.length === 0) {
        return reply.code(400).send({ error: 'At least one screenshot file is required' });
      }

      // Check if tournament exists
      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId }
      });

      if (!tournament) {
        return reply.code(404).send({ error: 'Tournament not found' });
      }

      // Create new draft results entry in DB
      const draft = await prisma.ocrDraftResult.create({
        data: {
          tournamentId,
          status: 'PENDING',
          screenshots: screenshotsList,
          parsedPlayers: []
        }
      });

      // Enqueue BullMQ background job
      const job = await ocrQueue.add(`ocr:${draft.id}`, {
        draftId: draft.id
      });

      return reply.code(201).send({
        success: true,
        message: 'Standings screenshots uploaded successfully. Processing started.',
        draftId: draft.id,
        jobId: job.id
      });

    } catch (err: any) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Failed to upload and initiate OCR processing' });
    }
  });

  // GET /api/ocr/draft/:tournamentId (Fetch latest draft result)
  fastify.get('/draft/:tournamentId', {
    preHandler: [fastify.authenticateAdmin]
  }, async (request, reply) => {
    const { tournamentId } = request.params as { tournamentId: string };

    const draft = await prisma.ocrDraftResult.findFirst({
      where: { tournamentId },
      orderBy: { createdAt: 'desc' }
    });

    if (!draft) {
      return reply.code(404).send({ error: 'No draft result found for this tournament' });
    }

    return reply.send({ success: true, draft });
  });

  // PUT /api/ocr/draft/:id (Update draft modifications from admin edits)
  fastify.put('/draft/:id', {
    preHandler: [fastify.authenticateAdmin]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { parsedPlayers: any[] };

    const draft = await prisma.ocrDraftResult.findUnique({
      where: { id }
    });

    if (!draft) {
      return reply.code(404).send({ error: 'Draft result not found' });
    }

    if (draft.status === 'APPROVED') {
      return reply.code(400).send({ error: 'Draft result is already approved and finalized' });
    }

    const updated = await prisma.ocrDraftResult.update({
      where: { id },
      data: {
        parsedPlayers: body.parsedPlayers
      }
    });

    return reply.send({ success: true, draft: updated });
  });

  // POST /api/ocr/draft/:id/approve (Verify results and trigger transaction payouts)
  fastify.post('/draft/:id/approve', {
    preHandler: [fastify.authenticateAdmin, fastify.hasPermission('WRITE_TOURNAMENTS')]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const adminUser = request.user as any;

    const draft = await prisma.ocrDraftResult.findUnique({
      where: { id },
      include: { tournament: true }
    });

    if (!draft) {
      return reply.code(404).send({ error: 'Draft result not found' });
    }

    if (draft.status === 'APPROVED') {
      return reply.code(400).send({ error: 'This result is already approved and paid out' });
    }

    // Validate request body schema
    const parseResult = approveDraftSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Invalid results schema', details: parseResult.error.format() });
    }

    const { players } = parseResult.data;

    // Validate that placements are consecutive and unique
    const ranks = players.map(p => p.rank).sort((a, b) => a - b);
    for (let i = 0; i < ranks.length; i++) {
      if (ranks[i] !== i + 1) {
        return reply.code(400).send({ error: 'Tournament placements must be consecutive and start at Rank 1' });
      }
    }

    // Inside a single ACID Prisma transaction, distribute funds, save results, update stats
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Ensure tournament is not already completed
        const t = await tx.tournament.findUnique({
          where: { id: draft.tournamentId },
          select: { status: true, title: true, prizeDistribution: true }
        });

        if (!t) {
          throw new Error('Tournament not found');
        }

        if (t.status === 'COMPLETED') {
          throw new Error('This tournament results have already been finalized');
        }

        // Parse prize distribution keys
        const prizeMap = t.prizeDistribution as Record<string, number>;

        // 2. Loop through players and record results, wallets, and notifications
        for (const player of players) {
          if (!player.matchedUserId) {
            throw new Error(`Player ${player.name} must be resolved to a registered user before approval`);
          }

          // Calculate winnings based on rank
          const winnings = prizeMap[player.rank.toString()] || 0;

          // Create TournamentResult row
          await tx.tournamentResult.create({
            data: {
              tournamentId: draft.tournamentId,
              userId: player.matchedUserId,
              rank: player.rank,
              kills: player.kills,
              winnings: winnings,
              verified: true
            }
          });

          // Fetch player wallet
          const wallet = await tx.wallet.findUnique({
            where: { userId: player.matchedUserId }
          });

          if (!wallet) {
            throw new Error(`Wallet not found for matched user ${player.matchedUserId}`);
          }

          // Update winning balances if winnings > 0
          if (winnings > 0) {
            await tx.wallet.update({
              where: { id: wallet.id },
              data: {
                winningBalance: {
                  increment: winnings
                }
              }
            });

            // Create Transaction record
            await tx.transaction.create({
              data: {
                walletId: wallet.id,
                amount: winnings,
                type: 'WINNINGS',
                status: 'COMPLETED',
                referenceId: draft.tournamentId,
                metadata: { rank: player.rank, kills: player.kills, label: 'OCR Verified Winnings' }
              }
            });
          }

          // Create Notification entry
          await tx.notification.create({
            data: {
              userId: player.matchedUserId,
              title: `🏆 Results Verified: ${t.title}`,
              message: `Your results are verified. Placement: Rank ${player.rank} with ${player.kills} kills. Credited ₹${winnings} to your winnings.`,
              type: 'TOURNAMENT_RESULTS'
            }
          });
        }

        // 3. Mark tournament status as COMPLETED
        await tx.tournament.update({
          where: { id: draft.tournamentId },
          data: { status: 'COMPLETED' }
        });

        // 4. Update OcrDraftResult status to APPROVED
        await tx.ocrDraftResult.update({
          where: { id },
          data: {
            status: 'APPROVED',
            verifiedBy: adminUser.id
          }
        });

        // 5. Create Audit log record
        await tx.auditLog.create({
          data: {
            actorId: adminUser.id,
            actorType: 'ADMIN',
            action: 'APPROVE_OCR_RESULTS',
            entityType: 'Tournament',
            entityId: draft.tournamentId,
            newValue: { draftId: id, verifiedPlayers: players.length }
          }
        });
      });

      // Broadcast update globally to reload homepage list
      fastify.io.emit('tournament:updated', {
        id: draft.tournamentId,
        status: 'COMPLETED'
      });

      return reply.send({ success: true, message: 'OCR Draft Results approved and payouts processed successfully' });

    } catch (err: any) {
      fastify.log.error(err);
      return reply.code(400).send({ error: `Verification failed: ${err.message || 'Transaction rolled back'}` });
    }
  });
};

export default ocrRoutes;

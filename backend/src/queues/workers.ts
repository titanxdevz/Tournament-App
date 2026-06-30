import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import prisma from '../config/db';
import axios from 'axios';
import { OcrService } from '../services/ocrService';

// 1. Notifications Worker
export const notificationsWorker = new Worker(
  'notifications-queue',
  async (job: Job) => {
    const { userId, title, message, type } = job.data;
    console.log(`Processing notification job: ${job.id} for user ${userId}`);

    // Create Notification database entry
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type: type || 'SYSTEM',
      },
    });

    // In a real application, integration with Firebase Admin FCM would go here
    console.log(`[FCM MOCK] Push sent: "${title}" -> ${message}`);
  },
  { connection: createRedisConnection() as any }
);

// 2. Match Rooms Worker
export const matchRoomsWorker = new Worker(
  'match-rooms-queue',
  async (job: Job) => {
    const { tournamentId, action } = job.data;
    console.log(`Processing match room job ${job.id} for tournament ${tournamentId}`);

    if (action === 'ROOM_LIFETIME_CHECK') {
      const room = await prisma.matchRoom.findUnique({
        where: { tournamentId },
      });

      // If room still has no credentials set and tournament status is LIVE/UPCOMING, trigger cleanup or warning
      if (room && !room.roomId && room.status === 'WAITING') {
        console.log(`Room credentials for tournament ${tournamentId} are overdue. Releasing registrations...`);
        // Additional cleanup logic or auto-refunds could be placed here
      }
    }
  },
  { connection: createRedisConnection() as any }
);

// 3. Prizes Distribution Worker
export const prizesWorker = new Worker(
  'prizes-queue',
  async (job: Job) => {
    const { tournamentId, results } = job.data as {
      tournamentId: string;
      results: Array<{ userId: string; rank: number; kills: number; winnings: number }>;
    };

    console.log(`Processing prize distribution for tournament ${tournamentId}`);

    // Transactionally update database
    await prisma.$transaction(async (tx) => {
      // 1. Ensure tournament is set to COMPLETED and verify it hasn't already been processed
      const tournament = await tx.tournament.findUnique({
        where: { id: tournamentId },
        select: { status: true },
      });

      if (!tournament) {
        throw new Error(`Tournament ${tournamentId} not found`);
      }

      if (tournament.status === 'COMPLETED') {
        console.log(`Tournament ${tournamentId} prizes already distributed.`);
        return;
      }

      // Update status
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: 'COMPLETED' },
      });

      // 2. Process payouts for each placement
      for (const res of results) {
        // Create results log
        await tx.tournamentResult.create({
          data: {
            tournamentId,
            userId: res.userId,
            rank: res.rank,
            kills: res.kills,
            winnings: res.winnings,
            verified: true,
          },
        });

        // Credit Wallet winningBalance
        const wallet = await tx.wallet.findUnique({
          where: { userId: res.userId },
        });

        if (!wallet) {
          throw new Error(`Wallet not found for user ${res.userId}`);
        }

        const newWinningBalance = Number(wallet.winningBalance) + res.winnings;

        const updatedWallet = await tx.wallet.update({
          where: { userId: res.userId },
          data: {
            winningBalance: newWinningBalance,
          },
        });

        // Create transaction entry
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            amount: res.winnings,
            type: 'WINNINGS',
            status: 'COMPLETED',
            referenceId: tournamentId,
            metadata: { rank: res.rank, kills: res.kills },
          },
        });

        // Create notification log
        await tx.notification.create({
          data: {
            userId: res.userId,
            title: '🏆 Tournament Prize Credited!',
            message: `Congratulations! You placed Rank ${res.rank} with ${res.kills} kills. ₹${res.winnings} has been credited to your winnings wallet.`,
            type: 'WALLET',
          },
        });
      }
    });

    console.log(`✅ Tournament ${tournamentId} prizes successfully distributed.`);
  },
  { connection: createRedisConnection() as any }
);

// 4. OCR Processing Worker
export let ioInstance: any = null;
export const setIoInstance = (io: any) => {
  ioInstance = io;
};

export const ocrWorker = new Worker(
  'ocr-queue',
  async (job: Job) => {
    const { draftId } = job.data as { draftId: string };
    console.log(`Processing OCR job ${job.id} for Draft Result ${draftId}`);

    try {
      // 1. Fetch Draft Result
      const draft = await prisma.ocrDraftResult.findUnique({
        where: { id: draftId },
        include: { tournament: true }
      });

      if (!draft) {
        throw new Error(`Draft Result ${draftId} not found`);
      }

      // Update status to PROCESSING
      await prisma.ocrDraftResult.update({
        where: { id: draftId },
        data: { status: 'PROCESSING' }
      });

      ioInstance?.emit(`ocr:progress:${draft.tournamentId}`, {
        status: 'PROCESSING',
        progress: 10,
        message: 'Downloading and optimizing screenshots...'
      });

      const screenshots = draft.screenshots as Array<{ url: string; hash: string }>;
      const parsedResultsList: any[][] = [];
      const updatedScreenshots: any[] = [];

      let count = 0;
      for (const ss of screenshots) {
        count++;
        // Emit progress
        ioInstance?.emit(`ocr:progress:${draft.tournamentId}`, {
          status: 'PROCESSING',
          progress: 10 + Math.round((count / screenshots.length) * 50),
          message: `Processing screenshot ${count} of ${screenshots.length}...`
        });

        // Download image buffer
        const response = await axios.get(ss.url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        // Quality check
        const { resolution, blur, brightness } = await OcrService.analyzeQuality(buffer);

        // Run OCR
        const { rawText, boundingBoxes } = await OcrService.extractText(buffer);

        // Parse standings
        const normalizedText = OcrService.normalizeText(rawText);
        const parsedStandings = OcrService.parseStandings(normalizedText);

        // Fuzzy match registered users
        const matchedPlayers = await OcrService.fuzzyMatchToRegistrations(draft.tournamentId, parsedStandings);

        parsedResultsList.push(matchedPlayers);
        
        updatedScreenshots.push({
          url: ss.url,
          hash: ss.hash,
          resolution,
          blur: Math.round(blur * 100) / 100,
          brightness: Math.round(brightness * 100) / 100,
          rawText,
          boundingBoxes
        });
      }

      // Consolidate multi-screenshot players
      ioInstance?.emit(`ocr:progress:${draft.tournamentId}`, {
        status: 'PROCESSING',
        progress: 80,
        message: 'Consolidating duplicate results and matching players...'
      });

      const consolidatedList = OcrService.consolidateResults(parsedResultsList);

      // Save back to DB
      const finalDraft = await prisma.ocrDraftResult.update({
        where: { id: draftId },
        data: {
          status: 'SUCCESS',
          screenshots: updatedScreenshots,
          parsedPlayers: consolidatedList
        }
      });

      ioInstance?.emit(`ocr:progress:${draft.tournamentId}`, {
        status: 'SUCCESS',
        progress: 100,
        message: 'OCR Processing finished successfully!',
        draft: finalDraft
      });

      console.log(`✅ OCR job ${job.id} finished successfully for Draft ${draftId}`);
    } catch (err: any) {
      console.error(`❌ OCR job ${job.id} failed:`, err);
      
      await prisma.ocrDraftResult.update({
        where: { id: draftId },
        data: { status: 'FAILED' }
      });

      ioInstance?.emit(`ocr:progress:${job.data.tournamentId}`, {
        status: 'FAILED',
        progress: 100,
        message: `OCR Processing failed: ${err.message}`
      });

      throw err;
    }
  },
  {
    connection: createRedisConnection() as any,
    limiter: {
      max: 5,
      duration: 1000
    }
  }
);

// Graceful shutdown handling
export const shutdownWorkers = async () => {
  await notificationsWorker.close();
  await matchRoomsWorker.close();
  await prizesWorker.close();
  await ocrWorker.close();
};

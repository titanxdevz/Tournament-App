import { z } from 'zod';

export const createTournamentSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  gameType: z.string().min(2, 'Game type must be specified'),
  entryFee: z.number().nonnegative('Entry fee cannot be negative'),
  prizePool: z.number().positive('Prize pool must be positive'),
  prizeDistribution: z.record(z.string(), z.number()), // e.g. { "1": 500, "2": 250 }
  maxSlots: z.number().int().positive('Max slots must be a positive integer'),
  startTime: z.string().datetime('Start time must be a valid ISO timestamp'),
  rules: z.string().min(5, 'Rules are required'),
  imageUrl: z.string().url().optional(),
});

export const joinTournamentSchema = z.object({
  inGameName: z.string().min(2, 'In-game name must be at least 2 characters'),
  inGameId: z.string().min(2, 'In-game ID must be specified'),
});

export const releaseRoomSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required'),
  roomPassword: z.string().min(1, 'Room password is required'),
  releaseTime: z.string().datetime().optional(),
});

export const publishResultsSchema = z.object({
  results: z.array(
    z.object({
      userId: z.string().uuid('Invalid user ID'),
      rank: z.number().int().positive('Rank must be positive'),
      kills: z.number().int().nonnegative('Kills cannot be negative'),
      winnings: z.number().nonnegative('Winnings cannot be negative'),
    })
  ),
});

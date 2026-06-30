import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import prisma from '../config/db';
import { TournamentService } from '../services/tournamentService';
import {
  createTournamentSchema,
  joinTournamentSchema,
  releaseRoomSchema,
  publishResultsSchema,
} from '../schemas/tournament';
import { prizesQueue } from '../queues/queues';

const tournamentRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /api/tournaments (User/Public)
  fastify.get('/', async (request, reply) => {
    const { status, limit, cursor } = request.query as {
      status?: string;
      limit?: string;
      cursor?: string;
    };

    const take = parseInt(limit || '10', 10);
    const queryStatus = status as any;

    const tournaments = await prisma.tournament.findMany({
      where: {
        ...(status ? { status: queryStatus } : {}),
      },
      include: {
        room: true,
      },
      take: take + 1, // Get one extra to compute next cursor
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { startTime: 'asc' },
    });

    let nextCursor: string | undefined = undefined;
    if (tournaments.length > take) {
      const nextItem = tournaments.pop();
      nextCursor = nextItem?.id;
    }

    return reply.send({ tournaments, nextCursor });
  });

  // GET /api/tournaments/:id (User/Public)
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        room: true,
      },
    });

    if (!tournament) {
      return reply.code(404).send({ error: 'Tournament not found' });
    }

    return reply.send({ tournament });
  });

  // POST /api/tournaments/:id/join (Protected User)
  fastify.post('/:id/join', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: tournamentId } = request.params as { id: string };
    const payload = request.user;
    const body = joinTournamentSchema.parse(request.body);

    const { registration, currentSlot } = await TournamentService.joinTournament(
      payload.id,
      tournamentId,
      body
    );

    // Notify websocket room
    fastify.io.to(`tournament:${tournamentId}`).emit('tournament:updated', {
      id: tournamentId,
      filledSlots: currentSlot,
    });
    // Also broadcast globally
    fastify.io.emit('tournament:updated', {
      id: tournamentId,
      filledSlots: currentSlot,
    });

    // Notify user directly of wallet deduction
    const updatedWallet = await prisma.wallet.findUnique({
      where: { userId: payload.id },
    });
    if (updatedWallet) {
      await fastify.emitToUser(payload.id, 'wallet:updated', updatedWallet);
    }

    return reply.code(200).send({ success: true, registration });
  });

  // ADMIN ENDPOINTS

  // POST /api/tournaments (Admin - create tournament)
  fastify.post(
    '/',
    { preHandler: [fastify.authenticateAdmin, fastify.hasPermission('WRITE_TOURNAMENTS')] },
    async (request, reply) => {
      const body = createTournamentSchema.parse(request.body);
      const tournament = await TournamentService.createTournament(body);

      // Broadcast creation event in real-time
      fastify.io.emit('tournament:created', tournament);

      return reply.code(201).send({ tournament });
    }
  );

  // POST /api/tournaments/:id/room (Admin - release match room credentials)
  fastify.post(
    '/:id/room',
    { preHandler: [fastify.authenticateAdmin, fastify.hasPermission('WRITE_TOURNAMENTS')] },
    async (request, reply) => {
      const { id: tournamentId } = request.params as { id: string };
      const body = releaseRoomSchema.parse(request.body);

      const room = await prisma.matchRoom.update({
        where: { tournamentId },
        data: {
          roomId: body.roomId,
          roomPassword: body.roomPassword,
          releaseTime: body.releaseTime ? new Date(body.releaseTime) : new Date(),
          status: 'RELEASED',
        },
      });

      // Broadcast room released event to the specific tournament room
      fastify.io.to(`tournament:${tournamentId}`).emit('room:released', {
        tournamentId,
        roomId: room.roomId,
        roomPassword: room.roomPassword,
        releaseTime: room.releaseTime,
      });
      // Also broadcast globally
      fastify.io.emit('room:released', {
        tournamentId,
        roomId: room.roomId,
        roomPassword: room.roomPassword,
        releaseTime: room.releaseTime,
      });

      return reply.send({ success: true, room });
    }
  );

  // POST /api/tournaments/:id/results (Admin - publish placements & trigger payments)
  fastify.post(
    '/:id/results',
    { preHandler: [fastify.authenticateAdmin, fastify.hasPermission('PUBLISH_RESULTS')] },
    async (request, reply) => {
      const { id: tournamentId } = request.params as { id: string };
      const body = publishResultsSchema.parse(request.body);

      // Verify tournament is in LIVE status or similar
      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
      });

      if (!tournament) {
        return reply.code(404).send({ error: 'Tournament not found' });
      }

      if (tournament.status === 'COMPLETED') {
        return reply.code(400).send({ error: 'Tournament results have already been published' });
      }

      // Add prize distribution job to BullMQ queue for safe transaction processing
      const job = await prizesQueue.add(`payout:${tournamentId}`, {
        tournamentId,
        results: body.results,
      });

      // Broadcast result processing over socket
      fastify.io.to(`tournament:${tournamentId}`).emit('tournament:updated', {
        id: tournamentId,
        status: 'COMPLETED',
      });
      // Also broadcast globally
      fastify.io.emit('tournament:updated', {
        id: tournamentId,
        status: 'COMPLETED',
      });

      return reply.send({
        success: true,
        message: 'Results submitted successfully. Prizes are being processed in the background.',
        jobId: job.id,
      });
    }
  );

  // Update tournament status (Start/Cancel/Complete matches) (Admin)
  fastify.patch<{ Params: { id: string }; Body: { status: 'UPCOMING' | 'LIVE' | 'CANCELLED' | 'COMPLETED' } }>(
    '/:id/status',
    {
      preHandler: [fastify.authenticateAdmin, fastify.hasPermission('WRITE_TOURNAMENTS')],
    },
    async (request, reply) => {
      const tournamentId = request.params.id;
      const { status } = request.body;

      try {
        const updated = await TournamentService.updateTournamentStatus(tournamentId, status);

        // Broadcast status update event to connected websockets
        fastify.io.to(`tournament:${tournamentId}`).emit('tournament:updated', {
          id: tournamentId,
          status,
        });
        // Also broadcast globally
        fastify.io.emit('tournament:updated', {
          id: tournamentId,
          status,
        });

        return reply.send({
          success: true,
          tournament: updated,
        });
      } catch (err: any) {
        return reply.code(400).send({ error: err.message });
      }
    }
  );

  // DELETE /api/tournaments/:id (Admin: Delete tournament)
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [fastify.authenticateAdmin, fastify.hasPermission('WRITE_TOURNAMENTS')],
    },
    async (request, reply) => {
      const tournamentId = request.params.id;

      try {
        await TournamentService.deleteTournament(tournamentId);

        // Broadcast deletion event to connected websockets
        fastify.io.emit('tournament:deleted', { id: tournamentId });

        return reply.send({
          success: true,
          message: 'Tournament deleted successfully.',
        });
      } catch (err: any) {
        return reply.code(400).send({ error: err.message });
      }
    }
  );
};

export default tournamentRoutes;

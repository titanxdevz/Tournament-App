import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import redis from '../config/redis';
import { setIoInstance } from '../queues/workers';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
    emitToUser: (userId: string, event: string, payload: any) => Promise<void>;
  }
}

declare module 'socket.io' {
  interface Socket {
    log: any;
  }
}

interface SocketUser {
  id: string;
  type: 'user' | 'admin';
}

const socketPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const io = new Server(fastify.server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Share server instance with queues workers
  setIoInstance(io);

  // Socket authentication middleware using standard JWT check
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers['authorization']?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as SocketUser;
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const user = socket.data.user as SocketUser;
    
    // Save socket session to Redis
    await redis.hset('online_users', user.id, Date.now().toString());
    await redis.set(`socket:user:${user.id}`, socket.id, 'EX', 86400); // 24h expiration

    socket.log = fastify.log.child({ socketId: socket.id, userId: user.id });
    socket.log.info(`🔌 Socket client connected: ${user.id}`);

    // Standard Room subscriptions
    socket.on('subscribe:tournament', (data: { tournamentId: string }) => {
      socket.join(`tournament:${data.tournamentId}`);
      socket.log.info(`Subscribed to tournament:${data.tournamentId}`);
    });

    socket.on('unsubscribe:tournament', (data: { tournamentId: string }) => {
      socket.leave(`tournament:${data.tournamentId}`);
      socket.log.info(`Unsubscribed from tournament:${data.tournamentId}`);
    });

    socket.on('disconnect', async () => {
      await redis.hdel('online_users', user.id);
      await redis.del(`socket:user:${user.id}`);
      socket.log.info(`🔌 Socket client disconnected`);
    });
  });

  // Helper method to emit direct messages to user sockets
  const emitToUser = async (userId: string, event: string, payload: any) => {
    const socketId = await redis.get(`socket:user:${userId}`);
    if (socketId) {
      io.to(socketId).emit(event, payload);
    }
  };

  fastify.decorate('io', io);
  fastify.decorate('emitToUser', emitToUser);

  // Close server hook
  fastify.addHook('onClose', (instance, done) => {
    io.close();
    done();
  });
};

export default fp(socketPlugin);

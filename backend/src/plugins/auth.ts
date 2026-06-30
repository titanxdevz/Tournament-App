import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import { env } from '../config/env';
import prisma from '../config/db';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    hasPermission: (permission: string) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string;
      phone?: string;
      email?: string;
      role?: string;
      type: 'user' | 'admin';
    };
  }
}

const authPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Register cookie parser
  await fastify.register(fastifyCookie, {
    secret: env.JWT_SECRET,
  });

  // Register JWT
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: 'refreshToken',
      signed: false,
    },
  });

  // Decorator to verify standard user access token
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = await request.jwtVerify() as any;
      if (payload.type !== 'user') {
        reply.code(403).send({ error: 'Forbidden: User authentication required' });
        return;
      }
      // Check if user is active
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { status: true },
      });
      if (!user || user.status !== 'ACTIVE') {
        reply.code(401).send({ error: 'Unauthorized: User is banned or suspended' });
        return;
      }
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized: Invalid token' });
    }
  });

  // Decorator to verify admin access token
  fastify.decorate('authenticateAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = await request.jwtVerify() as any;
      if (payload.type !== 'admin') {
        reply.code(403).send({ error: 'Forbidden: Admin authentication required' });
        return;
      }
      const admin = await prisma.adminUser.findUnique({
        where: { id: payload.id },
        select: { status: true },
      });
      if (!admin || !admin.status) {
        reply.code(401).send({ error: 'Unauthorized: Admin account inactive' });
        return;
      }
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized: Invalid token' });
    }
  });

  // Decorator factory to check specific permissions for Admin RBAC
  fastify.decorate('hasPermission', (permission: string) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = request.user;
        if (!payload || payload.type !== 'admin') {
          reply.code(403).send({ error: 'Forbidden: Admin access only' });
          return;
        }

        const admin = await prisma.adminUser.findUnique({
          where: { id: payload.id },
          include: { role: true },
        });

        if (!admin || !admin.status || !admin.role.permissions.includes(permission)) {
          reply.code(403).send({ error: `Forbidden: Missing required permission [${permission}]` });
          return;
        }
      } catch (err) {
        reply.code(403).send({ error: 'Forbidden: Permission validation failed' });
      }
    };
  });
};

export default fp(authPlugin);

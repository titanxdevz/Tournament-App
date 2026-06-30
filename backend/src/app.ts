import fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import path from 'path';

// Plugins
import errorHandlerPlugin from './plugins/errorHandler';
import authPlugin from './plugins/auth';
import socketPlugin from './plugins/socket';

// Routes
import authRoutes from './routes/auth';
import tournamentRoutes from './routes/tournament';
import walletRoutes from './routes/wallet';
import uploadRoutes from './routes/upload';
import ocrRoutes from './routes/ocr';
import { env } from './config/env';

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = fastify({
    logger: {
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  });

  // 1. Error Handler (Register first)
  await app.register(errorHandlerPlugin);

  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) {
        cb(null, true);
        return;
      }
      // Allow localhost connections and mobile emulator gateways
      if (/localhost:/.test(origin) || origin.startsWith('http://10.0.2.2')) {
        cb(null, true);
        return;
      }
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  });

  // 3. File upload handler
  await app.register(fastifyMultipart, {
    limits: {
      fieldNameSize: 100, // Max field name size in bytes
      fieldSize: 1000000, // Max field value size in bytes (1MB)
      fileSize: 10000000, // Max file size in bytes (10MB)
      files: 5,           // Max number of file fields (allow 5 for standings)
    },
  });

  // 4. Serve Static Uploads
  const uploadDir = path.resolve(env.UPLOAD_DIR);
  if (!require('fs').existsSync(uploadDir)) {
    require('fs').mkdirSync(uploadDir, { recursive: true });
  }

  await app.register(fastifyStatic, {
    root: uploadDir,
    prefix: '/uploads/',
  });

  // 5. OpenAPI Swagger Setup
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: '92LR Tournament API',
        description: 'Enterprise REST & Real-time Socket API for 92LR Tournament Platform',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${env.PORT}`,
          description: 'Local Development Server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // 6. Custom Authentication & Socket Gateway Plugins
  await app.register(authPlugin);
  await app.register(socketPlugin);

  // 7. Route Mounts
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(tournamentRoutes, { prefix: '/api/tournaments' });
  await app.register(walletRoutes, { prefix: '/api/wallet' });
  await app.register(uploadRoutes, { prefix: '/api/upload' });
  await app.register(ocrRoutes, { prefix: '/api/ocr' });

  return app;
};

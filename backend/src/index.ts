import { buildApp } from './app';
import { env } from './config/env';
import { AuthService } from './services/authService';
import prisma from './config/db';
import redis from './config/redis';
import { shutdownWorkers } from './queues/workers';

const start = async () => {
  try {
    const app = await buildApp();

    // Verify DB Connection
    await prisma.$connect();
    app.log.info('✅ PostgreSQL Database connected successfully.');

    // Seed default RBAC roles and super admin
    await AuthService.seedAdminBootstrap();

    // Start listening
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`🚀 Server running on http://localhost:${env.PORT}`);
    app.log.info(`📖 API documentation available at http://localhost:${env.PORT}/docs`);

    // Graceful Shutdown Handler
    const shutdown = async (signal: string) => {
      app.log.info(`Received ${signal}. Shutting down gracefully...`);
      
      // Stop listening to requests
      await app.close();
      
      // Close workers
      await shutdownWorkers();
      
      // Close DB Connections
      await prisma.$disconnect();
      await redis.quit();

      app.log.info('👋 Shutdown complete.');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error('❌ Error during application startup:', err);
    process.exit(1);
  }
};

start();

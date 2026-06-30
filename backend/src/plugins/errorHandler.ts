import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';

const errorHandlerPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.setErrorHandler((error, request, reply) => {
    // Log error using Pino
    request.log.error(error);

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        details: error.format(),
      });
      return;
    }

    // Handle Prisma specific unique constraint issues
    if (error.name === 'PrismaClientKnownRequestError') {
      const code = (error as any).code;
      if (code === 'P2002') {
        const target = (error as any).meta?.target || [];
        reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: `Record already exists with unique value: ${target.join(', ')}`,
        });
        return;
      }
    }

    // Fallback general internal error
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      statusCode,
      error: error.name || 'Internal Server Error',
      message: error.message || 'An unexpected error occurred',
    });
  });
};

export default fp(errorHandlerPlugin);

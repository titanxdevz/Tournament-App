import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { CloudinaryService } from '../services/cloudinaryService';
import prisma from '../config/db';

const uploadRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // POST /api/upload (Protected - upload image and return Cloudinary secure URL)
  fastify.post('/', {
    preHandler: [
      async (request, reply) => {
        try {
          const payload = await request.jwtVerify() as any;
          if (payload.type === 'admin') {
            const admin = await prisma.adminUser.findUnique({
              where: { id: payload.id },
              select: { status: true },
            });
            if (!admin || !admin.status) {
              return reply.code(401).send({ error: 'Unauthorized: Admin account inactive' });
            }
          } else if (payload.type === 'user') {
            const user = await prisma.user.findUnique({
              where: { id: payload.id },
              select: { status: true },
            });
            if (!user || user.status !== 'ACTIVE') {
              return reply.code(401).send({ error: 'Unauthorized: User is banned or suspended' });
            }
          } else {
            return reply.code(403).send({ error: 'Forbidden: Invalid token type' });
          }
        } catch (err) {
          return reply.code(401).send({ error: 'Unauthorized: Invalid token' });
        }
      }
    ]
  }, async (request, reply) => {
    if (!request.isMultipart()) {
      return reply.code(400).send({ error: 'Request must be multipart/form-data' });
    }

    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'File is required' });
    }

    if (!data.mimetype.startsWith('image/')) {
      return reply.code(400).send({ error: 'File must be an image (JPEG/PNG/WebP)' });
    }

    try {
      const folder = (data.fields.folder as any)?.value || 'general';
      const uploadResult = await CloudinaryService.uploadStream(data.file, folder);
      return reply.code(201).send({
        success: true,
        url: uploadResult.secure_url,
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal Server Error uploading file to Cloudinary' });
    }
  });
};

export default uploadRoutes;

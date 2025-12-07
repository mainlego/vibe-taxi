import { FastifyPluginAsync } from 'fastify'
import multipart from '@fastify/multipart'
import { prisma } from '@vibe-taxi/database'
import { uploadFile, deleteFile } from '../services/s3.js'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  // Register multipart
  await fastify.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
  })

  // Upload avatar
  fastify.post('/avatar', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    try {
      const data = await request.file()

      if (!data) {
        return reply.status(400).send({ error: 'No file provided' })
      }

      if (!ALLOWED_TYPES.includes(data.mimetype)) {
        return reply.status(400).send({
          error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF'
        })
      }

      // Read file buffer
      const buffer = await data.toBuffer()

      if (buffer.length > MAX_FILE_SIZE) {
        return reply.status(400).send({ error: 'File too large. Max 5MB' })
      }

      // Get current user to delete old avatar if exists
      const user = await prisma.user.findUnique({
        where: { id: request.user.userId },
        select: { avatar: true },
      })

      // Upload new avatar to S3
      const avatarUrl = await uploadFile(buffer, data.mimetype, 'avatars')

      // Delete old avatar from S3 if it was uploaded (not a telegram photo)
      if (user?.avatar && user.avatar.includes('s3.regru.cloud')) {
        await deleteFile(user.avatar)
      }

      // Update user avatar in database
      await prisma.user.update({
        where: { id: request.user.userId },
        data: { avatar: avatarUrl },
      })

      return { url: avatarUrl }
    } catch (err: any) {
      console.error('Avatar upload error:', err)
      return reply.status(500).send({ error: 'Failed to upload avatar' })
    }
  })

  // Upload document (for drivers)
  fastify.post('/document', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    try {
      const data = await request.file()

      if (!data) {
        return reply.status(400).send({ error: 'No file provided' })
      }

      const allowedDocTypes = [...ALLOWED_TYPES, 'application/pdf']
      if (!allowedDocTypes.includes(data.mimetype)) {
        return reply.status(400).send({
          error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF, PDF'
        })
      }

      const buffer = await data.toBuffer()

      if (buffer.length > MAX_FILE_SIZE) {
        return reply.status(400).send({ error: 'File too large. Max 5MB' })
      }

      // Upload document to S3
      const docUrl = await uploadFile(buffer, data.mimetype, 'documents')

      return { url: docUrl }
    } catch (err: any) {
      console.error('Document upload error:', err)
      return reply.status(500).send({ error: 'Failed to upload document' })
    }
  })
}

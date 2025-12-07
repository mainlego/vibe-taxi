import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'

// Reg.ru S3 configuration
const s3Client = new S3Client({
  region: 'ru-central1',
  endpoint: process.env.S3_ENDPOINT || 'https://s3.regru.cloud',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true,
})

const BUCKET_NAME = process.env.S3_BUCKET || 'vibego'

export async function uploadFile(
  buffer: Buffer,
  mimeType: string,
  folder: string = 'avatars'
): Promise<string> {
  const extension = mimeType.split('/')[1] || 'jpg'
  const filename = `${folder}/${randomUUID()}.${extension}`

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: filename,
    Body: buffer,
    ContentType: mimeType,
    // Note: ACL removed - configure bucket policy for public read access instead
  })

  await s3Client.send(command)

  // Return public URL
  const publicUrl = `${process.env.S3_PUBLIC_URL || 'https://s3.regru.cloud'}/${BUCKET_NAME}/${filename}`
  return publicUrl
}

export async function deleteFile(fileUrl: string): Promise<void> {
  try {
    // Extract key from URL
    const url = new URL(fileUrl)
    const key = url.pathname.replace(`/${BUCKET_NAME}/`, '')

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    await s3Client.send(command)
  } catch (err) {
    console.error('Failed to delete file from S3:', err)
  }
}

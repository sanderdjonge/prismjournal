import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { dirname } from 'path'
import logger from '@/lib/logger'

let _s3Client: S3Client | null = null

function getS3Client(): S3Client | null {
  if (!process.env.S3_BUCKET) return null

  if (!_s3Client) {
    _s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'auto',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      },
    })
  }

  return _s3Client
}

export async function uploadBackupToS3(localPath: string, key: string): Promise<boolean> {
  const client = getS3Client()
  if (!client) return false

  try {
    const { readFile } = await import('fs/promises')
    const body = await readFile(localPath)

    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: 'application/octet-stream',
        Metadata: {
          'backup-timestamp': new Date().toISOString(),
        },
      }),
    )

    logger.info({ key, bucket: process.env.S3_BUCKET }, '[backup-s3] Upload complete')
    return true
  } catch (error) {
    logger.error({ err: error, key, localPath }, '[backup-s3] Upload failed')
    return false
  }
}

export interface S3BackupEntry {
  key: string
  size: number
  lastModified: Date
}

export async function listS3Backups(prefix: string = 'backups/'): Promise<S3BackupEntry[]> {
  const client = getS3Client()
  if (!client) return []

  try {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: process.env.S3_BUCKET,
        Prefix: prefix,
      }),
    )

    return (response.Contents || []).map(obj => ({
      key: obj.Key || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
    }))
  } catch (error) {
    logger.error({ err: error, prefix }, '[backup-s3] List failed')
    return []
  }
}

export async function restoreFromS3(key: string, localPath: string): Promise<boolean> {
  const client = getS3Client()
  if (!client) return false

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
      }),
    )

    if (!response.Body) {
      logger.error({ key }, '[backup-s3] Empty response body')
      return false
    }

    const { mkdir } = await import('fs/promises')
    await mkdir(dirname(localPath), { recursive: true })

    const body = response.Body
    const bytes = await body.transformToByteArray()
    const { writeFile } = await import('fs/promises')
    await writeFile(localPath, Buffer.from(bytes))

    logger.info({ key, localPath }, '[backup-s3] Restore complete')
    return true
  } catch (error) {
    logger.error({ err: error, key, localPath }, '[backup-s3] Restore failed')
    return false
  }
}

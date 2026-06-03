import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

/* ------------------------------------------------------------------ *
 * Object storage (Zerops object-storage → MinIO/S3-compatible)
 *
 * The bucket is created with the `public-objects-read` policy, so any
 * uploaded object is anonymously GET-able at the path-style URL
 * `${endpoint}/${bucket}/${key}` — exactly what an <img src> needs.
 *
 * MinIO requires forcePathStyle + a region (value ignored, presence
 * required). All wiring comes from S3_* env vars set in zerops.yaml from
 * the `storage` service's cross-service references.
 * ------------------------------------------------------------------ */

const ENDPOINT = () => (process.env.S3_ENDPOINT || '').replace(/\/+$/, '')
const BUCKET = () => process.env.S3_BUCKET || ''

let client: S3Client | null = null

function getClient(): S3Client {
  if (client) return client
  client = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: ENDPOINT(),
    forcePathStyle: true, // REQUIRED for the MinIO backend
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
  })
  return client
}

export function storageConfigured(): boolean {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  )
}

// Map of accepted image content-types → file extension.
export const ACCEPTED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024 // 8 MB

export type UploadResult = { url: string; key: string }

export async function uploadImage(opts: {
  body: Buffer | Uint8Array
  contentType: string
  prefix?: string
}): Promise<UploadResult> {
  const ext = ACCEPTED_IMAGE_TYPES[opts.contentType] ?? 'bin'
  const prefix = (opts.prefix || 'journal').replace(/[^a-z0-9/_-]/gi, '')
  const key = `${prefix}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`

  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET(),
      Key: key,
      Body: opts.body,
      ContentType: opts.contentType,
      // Content-addressed enough to cache hard — the key never collides.
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  return { url: `${ENDPOINT()}/${BUCKET()}/${key}`, key }
}

import { createFileRoute } from '@tanstack/react-router'
import { auth } from '../../lib/auth'
import { ensureDb } from '../../lib/migrate'
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  storageConfigured,
  uploadImage,
} from '../../lib/storage'

// Admin-only image upload → object storage. Used by the journal editor (cover
// image + inline body images). Returns the public URL of the stored object.
export const Route = createFileRoute('/api/upload')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        await ensureDb()
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session?.user) {
          return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
        }
        if (!storageConfigured()) {
          return Response.json(
            { ok: false, error: 'Image storage is not configured.' },
            { status: 503 },
          )
        }

        let form: FormData
        try {
          form = await request.formData()
        } catch {
          return Response.json(
            { ok: false, error: 'Expected multipart form data.' },
            { status: 400 },
          )
        }

        const file = form.get('file')
        if (!(file instanceof File)) {
          return Response.json({ ok: false, error: 'No file provided.' }, { status: 400 })
        }
        if (!ACCEPTED_IMAGE_TYPES[file.type]) {
          return Response.json(
            { ok: false, error: 'Unsupported image type (use JPEG, PNG, WebP, GIF, AVIF or SVG).' },
            { status: 415 },
          )
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          return Response.json(
            { ok: false, error: 'Image is too large (max 8 MB).' },
            { status: 413 },
          )
        }

        // 'cover' or 'body' → key prefix; sanitized again in the lib.
        const slot = String(form.get('slot') || 'body') === 'cover' ? 'cover' : 'body'

        try {
          const buf = Buffer.from(await file.arrayBuffer())
          const { url } = await uploadImage({
            body: buf,
            contentType: file.type,
            prefix: `journal/${slot}`,
          })
          return Response.json({ ok: true, url })
        } catch (err) {
          console.error('[upload] failed', err)
          return Response.json({ ok: false, error: 'Upload failed. Try again.' }, { status: 500 })
        }
      },
    },
  },
})

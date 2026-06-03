// Client-side helper: POST a file to the admin upload route and get back the
// public object-storage URL. Same-origin fetch sends the auth cookie.
export async function uploadImageFile(file: File, slot: 'cover' | 'body'): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('slot', slot)
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  const data = await res.json().catch(() => ({}) as any)
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'Upload failed.')
  }
  return data.url as string
}

export const ACCEPT_IMAGE = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml'

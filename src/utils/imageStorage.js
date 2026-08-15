import { supabase } from '../supabaseClient'

const WORKER_URL = import.meta.env.VITE_IMAGES_WORKER_URL

async function authHeader() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function uploadImage(file, bucket = 'images') {
  const form = new FormData()
  form.append('file', file)
  form.append('bucket', bucket)

  const res = await fetch(`${WORKER_URL}/upload`, {
    method: 'POST',
    headers: await authHeader(),
    body: form,
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}))
    throw new Error(error || 'Upload failed')
  }
  const { url } = await res.json()
  return url
}

export async function deleteImages(urls, bucket = 'images') {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean)
  if (list.length === 0) return

  await fetch(`${WORKER_URL}/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ bucket, urls: list }),
  })
}

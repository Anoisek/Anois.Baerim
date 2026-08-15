const TOKEN_KEY = 'baerim_auth_token'
const WORKER_URL = import.meta.env.VITE_IMAGES_WORKER_URL

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
}

export async function login(username, password) {
  const res = await fetch(`${WORKER_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Login failed')
  localStorage.setItem(TOKEN_KEY, data.token)
  return { isAdmin: data.isAdmin, isEditor: data.isEditor }
}

// Resolves the current session's role flags, or null if not logged in / token invalid.
export async function me() {
  const token = getToken()
  if (!token) return null
  const res = await fetch(`${WORKER_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    logout()
    return null
  }
  const data = await res.json()
  return { isAdmin: data.isAdmin, isEditor: data.isEditor }
}

export async function changePassword(currentPassword, newPassword) {
  const res = await fetch(`${WORKER_URL}/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Failed to change password')
}

import { getToken, notifyUnauthorized } from './authStore'

const API_BASE_URL = 'http://localhost:3000'

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')

  const token = getToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    notifyUnauthorized()
  }

  return res
}

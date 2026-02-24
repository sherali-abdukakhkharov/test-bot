const TOKEN_KEY = 'admin_token'
const ROLE_KEY = 'admin_role'

export function setToken(token: string, role: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(ROLE_KEY, role)
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getRole(): string | null {
  return localStorage.getItem(ROLE_KEY)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ROLE_KEY)
}

export function isTokenValid(): boolean {
  const token = getToken()
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp: number }
    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export function getAdminId(): number | null {
  const token = getToken()
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { sub: number }
    return payload.sub
  } catch {
    return null
  }
}

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { apiFetch } from '../lib/api'
import { setToken as setStoredToken, setUnauthorizedHandler } from '../lib/authStore'

type User = {
  id: string
  email: string
}

type AuthContextValue = {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)

  function logout() {
    setUser(null)
    setToken(null)
    setStoredToken(null)
  }

  // Lets api.ts trigger a logout on a 401 without needing hooks itself.
  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [])

  async function login(email: string, password: string) {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    const body = await res.json()
    if (!res.ok) {
      throw new Error(body.error ?? 'Login failed')
    }

    setUser(body.user)
    setToken(body.token)
    setStoredToken(body.token)
  }

  const value = useMemo(
    () => ({ user, token, login, logout }),
    [user, token],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

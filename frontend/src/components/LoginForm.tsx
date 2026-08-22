import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'

export function LoginForm() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-card-fg shadow-xl"
    >
      <p className="mb-5 font-display text-2xl tracking-wide">Log in</p>

      <label className="mb-4 block text-sm">
        <span className="mb-1.5 block font-medium text-muted-fg">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-surface-fg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)]"
        />
      </label>

      <label className="mb-5 block text-sm">
        <span className="mb-1.5 block font-medium text-muted-fg">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-surface-fg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)]"
        />
      </label>

      {error && (
        <p className="mb-4 text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand py-2.5 text-sm font-bold uppercase tracking-wide text-brand-fg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  )
}

import { Bike } from 'lucide-react'
import { HealthCheck } from './components/HealthCheck'
import { LoginForm } from './components/LoginForm'
import { TrainingCalendar } from './components/TrainingCalendar'
import { useAuth } from './context/AuthContext'

function Wordmark() {
  return (
    <div className="flex items-center gap-2 text-brand">
      <Bike size={26} aria-hidden="true" />
      <span className="font-display text-2xl tracking-wide">
        Rov is Cycling
      </span>
    </div>
  )
}

function App() {
  const { user, logout } = useAuth()

  return (
    <main className="flex min-h-screen flex-col items-center bg-surface text-surface-fg">
      {user ? (
        <div className="flex w-full flex-col items-center gap-6">
          <header className="flex w-full max-w-5xl items-center justify-between border-b border-border px-4 py-4">
            <Wordmark />
            <div className="flex items-center gap-3">
              <p className="hidden text-sm text-muted-fg sm:block">{user.email}</p>
              <button
                onClick={logout}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                Log out
              </button>
            </div>
          </header>
          <TrainingCalendar />
        </div>
      ) : (
        <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-4">
          <Wordmark />
          <LoginForm />
          <HealthCheck />
        </div>
      )}
    </main>
  )
}

export default App

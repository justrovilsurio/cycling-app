import { HealthCheck } from './components/HealthCheck'
import { LoginForm } from './components/LoginForm'
import { useAuth } from './context/AuthContext'

function App() {
  const { user, logout } = useAuth()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50">
      {user ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-gray-700">Logged in as {user.email}</p>
          <button
            onClick={logout}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm"
          >
            Log out
          </button>
        </div>
      ) : (
        <>
          <LoginForm />
          <HealthCheck />
        </>
      )}
    </main>
  )
}

export default App

import { useEffect, useState } from 'react'

type Status = 'loading' | 'success' | 'error'

export function HealthCheck() {
  const [status, setStatus] = useState<Status>('loading')
  const [data, setData] = useState<unknown>(null)

  useEffect(() => {
    fetch('http://localhost:3000/health')
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        return res.json()
      })
      .then((body) => {
        setData(body)
        setStatus('success')
      })
      .catch(() => {
        setStatus('error')
      })
  }, [])

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 font-mono text-sm text-card-fg">
      <p className="mb-2 font-semibold text-muted-fg">Backend health check</p>
      {status === 'loading' && <p className="text-muted-fg">Checking…</p>}
      {status === 'success' && (
        <p className="text-recovery-fg">{JSON.stringify(data)}</p>
      )}
      {status === 'error' && (
        <p className="text-danger">
          Could not reach http://localhost:3000/health — is the backend running?
        </p>
      )}
    </div>
  )
}

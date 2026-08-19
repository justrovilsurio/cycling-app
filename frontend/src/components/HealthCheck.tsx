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
    <div className="rounded-lg border border-gray-200 p-4 font-mono text-sm">
      <p className="mb-2 font-semibold text-gray-700">Backend health check</p>
      {status === 'loading' && <p className="text-gray-500">Checking…</p>}
      {status === 'success' && (
        <p className="text-green-600">{JSON.stringify(data)}</p>
      )}
      {status === 'error' && (
        <p className="text-red-600">
          Could not reach http://localhost:3000/health — is the backend running?
        </p>
      )}
    </div>
  )
}

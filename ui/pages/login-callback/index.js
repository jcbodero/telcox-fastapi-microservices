import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../lib/AuthContext'
import { exchangeCodeForTokens } from '../../lib/keycloakAuth'

export default function AuthCallback() {
  const router = useRouter()
  const { setAuthenticatedTokens } = useAuth()
  const [message, setMessage] = useState('Validando sesion...')

  useEffect(() => {
    if (!router.isReady) return

    const finishLogin = async () => {
      try {
        const { code, state, error, error_description: errorDescription } = router.query
        if (error) throw new Error(errorDescription || error)
        if (!code || !state) throw new Error('Missing OAuth callback parameters')

        const tokens = await exchangeCodeForTokens({ code, state })
        setAuthenticatedTokens(tokens)
        router.replace('/')
      } catch (error) {
        setMessage(error.message)
      }
    }

    finishLogin()
  }, [router, setAuthenticatedTokens])

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <h1 className="text-xl font-semibold">Autenticacion TelcoX</h1>
        <p className="mt-3 text-sm text-slate-600">{message}</p>
      </section>
    </main>
  )
}

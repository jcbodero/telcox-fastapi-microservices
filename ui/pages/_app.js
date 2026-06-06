import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import '../styles/globals.css'
import { AuthProvider } from '../lib/AuthContext'
import LoadingOverlay from '../components/LoadingOverlay'

export default function MyApp({ Component, pageProps }) {
  const router = useRouter()
  const [isRouteLoading, setIsRouteLoading] = useState(false)

  useEffect(() => {
    const startLoading = () => setIsRouteLoading(true)
    const stopLoading = () => setIsRouteLoading(false)

    router.events.on('routeChangeStart', startLoading)
    router.events.on('routeChangeComplete', stopLoading)
    router.events.on('routeChangeError', stopLoading)

    return () => {
      router.events.off('routeChangeStart', startLoading)
      router.events.off('routeChangeComplete', stopLoading)
      router.events.off('routeChangeError', stopLoading)
    }
  }, [router.events])

  return (
    <AuthProvider>
      <LoadingOverlay show={isRouteLoading} label="Cargando" />
      <Component {...pageProps} />
    </AuthProvider>
  )
}

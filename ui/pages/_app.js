import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import '../styles/globals.css'
import { AuthProvider, useAuth } from '../lib/AuthContext'
import LoadingOverlay from '../components/LoadingOverlay'
import { identifyUser, initMixpanel, trackPageView } from '../lib/mixpanelClient'

function AnalyticsBridge() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const trackedInitialPageRef = useRef(false)

  useEffect(() => {
    initMixpanel()
  }, [])

  useEffect(() => {
    if (!router.isReady || trackedInitialPageRef.current) return
    trackedInitialPageRef.current = true
    trackPageView(router.asPath)
  }, [router.isReady, router.asPath])

  useEffect(() => {
    const handleRouteChange = (url) => trackPageView(url)
    router.events.on('routeChangeComplete', handleRouteChange)
    return () => router.events.off('routeChangeComplete', handleRouteChange)
  }, [router.events])

  useEffect(() => {
    if (isAuthenticated && user) identifyUser(user)
  }, [isAuthenticated, user])

  return null
}

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
      <AnalyticsBridge />
      <LoadingOverlay show={isRouteLoading} label="Cargando" />
      <Component {...pageProps} />
    </AuthProvider>
  )
}

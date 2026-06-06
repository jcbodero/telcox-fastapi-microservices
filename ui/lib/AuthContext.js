import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  clearStoredAuth,
  getStoredTokens,
  loginWithKeycloak,
  logoutFromKeycloak,
  mapTokenToUser,
  refreshTokens,
} from './keycloakAuth'

const AuthContext = createContext(null)

const isExpired = (tokens, skewSeconds = 30) => {
  if (!tokens?.expires_at) return true
  return tokens.expires_at - skewSeconds <= Math.floor(Date.now() / 1000)
}

export function AuthProvider({ children }) {
  const [tokens, setTokens] = useState(null)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedTokens = getStoredTokens()
    if (storedTokens) {
      setTokens(storedTokens)
      setUser(mapTokenToUser(storedTokens))
    }
    setIsLoading(false)
  }, [])

  const getAccessToken = async () => {
    if (!tokens) return null
    if (!isExpired(tokens)) return tokens.access_token
    if (!tokens.refresh_token) {
      clearStoredAuth()
      setTokens(null)
      setUser(null)
      return null
    }
    const refreshed = await refreshTokens(tokens.refresh_token)
    setTokens(refreshed)
    setUser(mapTokenToUser(refreshed))
    return refreshed.access_token
  }

  const value = useMemo(
    () => ({
      user,
      tokens,
      isLoading,
      isAuthenticated: Boolean(user && tokens),
      login: loginWithKeycloak,
      logout: logoutFromKeycloak,
      getAccessToken,
      setAuthenticatedTokens: (nextTokens) => {
        setTokens(nextTokens)
        setUser(mapTokenToUser(nextTokens))
      },
    }),
    [user, tokens, isLoading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

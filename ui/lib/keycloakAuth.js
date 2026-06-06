const config = {
  baseUrl: process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'https://reto1.telcox.site/auth',
  realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'telcox',
  clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'telcox-web',
}

const storageKeys = {
  verifier: 'telcox_pkce_verifier',
  state: 'telcox_auth_state',
  tokens: 'telcox_auth_tokens',
}

const getRealmUrl = () => `${config.baseUrl}/realms/${config.realm}`
const getTokenUrl = () => `${getRealmUrl()}/protocol/openid-connect/token`
const getAuthUrl = () => `${getRealmUrl()}/protocol/openid-connect/auth`
const getLogoutUrl = () => `${getRealmUrl()}/protocol/openid-connect/logout`

const base64UrlEncode = (buffer) => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const randomString = (length = 64) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  return Array.from(values, (value) => chars[value % chars.length]).join('')
}

export const getRedirectUri = () => `${window.location.origin}/auth/callback`

export const createCodeChallenge = async (verifier) => {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(digest)
}

export const decodeJwtPayload = (token) => {
  const [, payload] = token.split('.')
  if (!payload) return {}
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
  return JSON.parse(atob(padded))
}

export const saveTokens = (tokens) => {
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = Number(tokens.expires_in || 0)
  const refreshExpiresIn = Number(tokens.refresh_expires_in || 0)
  const nextTokens = {
    ...tokens,
    expires_at: now + expiresIn,
    refresh_expires_at: now + refreshExpiresIn,
  }
  localStorage.setItem(storageKeys.tokens, JSON.stringify(nextTokens))
  return nextTokens
}

export const getStoredTokens = () => {
  const raw = localStorage.getItem(storageKeys.tokens)
  return raw ? JSON.parse(raw) : null
}

export const clearStoredAuth = () => {
  localStorage.removeItem(storageKeys.tokens)
  localStorage.removeItem(storageKeys.verifier)
  localStorage.removeItem(storageKeys.state)
}

export const loginWithKeycloak = async () => {
  const verifier = randomString()
  const state = randomString(32)
  const challenge = await createCodeChallenge(verifier)

  localStorage.setItem(storageKeys.verifier, verifier)
  localStorage.setItem(storageKeys.state, state)

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: 'openid profile email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  window.location.assign(`${getAuthUrl()}?${params.toString()}`)
}

export const exchangeCodeForTokens = async ({ code, state }) => {
  const expectedState = localStorage.getItem(storageKeys.state)
  const verifier = localStorage.getItem(storageKeys.verifier)

  if (!expectedState || expectedState !== state) {
    throw new Error('Invalid OAuth state')
  }
  if (!verifier) {
    throw new Error('Missing PKCE verifier')
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier,
  })

  const response = await fetch(getTokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${await response.text()}`)
  }

  localStorage.removeItem(storageKeys.verifier)
  localStorage.removeItem(storageKeys.state)
  return saveTokens(await response.json())
}

export const refreshTokens = async (refreshToken) => {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    refresh_token: refreshToken,
  })

  const response = await fetch(getTokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    clearStoredAuth()
    throw new Error(`Token refresh failed: ${response.status}`)
  }

  return saveTokens(await response.json())
}

export const logoutFromKeycloak = () => {
  const redirectUri = window.location.origin
  clearStoredAuth()
  const params = new URLSearchParams({
    client_id: config.clientId,
    post_logout_redirect_uri: redirectUri,
  })
  window.location.assign(`${getLogoutUrl()}?${params.toString()}`)
}

export const mapTokenToUser = (tokens) => {
  if (!tokens?.id_token) return null
  const payload = decodeJwtPayload(tokens.id_token)
  return {
    id: payload.sub,
    full_name: payload.name || payload.preferred_username || 'Usuario TelcoX',
    email: payload.email || '',
    username: payload.preferred_username || '',
    roles: payload.realm_access?.roles || [],
  }
}

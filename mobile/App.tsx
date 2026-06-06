import React, { useEffect, useMemo, useState } from 'react'
import { SafeAreaView, StatusBar, StyleSheet, Text, TextInput, Pressable, View, ScrollView, ActivityIndicator } from 'react-native'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'

type AuthTokens = {
  access_token: string
  refresh_token?: string
  id_token?: string
  expires_at?: number
}

type User = {
  id?: string
  full_name: string
  email: string
  username: string
}

type OnboardingResult = {
  id: string
  status: string
  document_check?: string
  face_match?: string
}

const config = {
  keycloakBaseUrl: 'https://reto1.telcox.site/auth',
  keycloakRealm: 'telcox',
  keycloakClientId: 'telcox-web',
  apiBaseUrl: '',
}

const storageKeys = {
  verifier: 'telcox_mobile_pkce_verifier',
  state: 'telcox_mobile_auth_state',
  tokens: 'telcox_mobile_auth_tokens',
}

const theme = {
  bg: '#07111f',
  panel: '#0f1b2d',
  panelSoft: '#13233a',
  text: '#f5f7fb',
  muted: '#9fb0c9',
  primary: '#21c7a8',
  primarySoft: '#173e39',
  border: '#20344e',
}

const safeStorage = {
  get(key: string) {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
    } catch {}
  },
  remove(key: string) {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key)
    } catch {}
  },
}

const getRedirectUri = () => (typeof window !== 'undefined' ? `${window.location.origin}/login-callback` : '')
const getRealmUrl = () => `${config.keycloakBaseUrl}/realms/${config.keycloakRealm}`
const getAuthUrl = () => `${getRealmUrl()}/protocol/openid-connect/auth`
const getTokenUrl = () => `${getRealmUrl()}/protocol/openid-connect/token`

const base64UrlEncode = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const randomString = (length = 64) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const values = new Uint32Array(length)
  window.crypto.getRandomValues(values)
  return Array.from(values, (value) => chars[value % chars.length]).join('')
}

const createCodeChallenge = async (verifier: string) => {
  const data = new TextEncoder().encode(verifier)
  const digest = await window.crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(digest)
}

const decodeJwtPayload = (token: string) => {
  const [, payload] = token.split('.')
  if (!payload) return {}
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
  return JSON.parse(window.atob(padded))
}

const saveTokens = (tokens: AuthTokens) => {
  const nextTokens = {
    ...tokens,
    expires_at: Math.floor(Date.now() / 1000) + Number((tokens as any).expires_in || 0),
  }
  safeStorage.set(storageKeys.tokens, JSON.stringify(nextTokens))
  return nextTokens
}

const getStoredTokens = () => {
  const raw = safeStorage.get(storageKeys.tokens)
  return raw ? (JSON.parse(raw) as AuthTokens) : null
}

const clearStoredAuth = () => {
  safeStorage.remove(storageKeys.tokens)
  safeStorage.remove(storageKeys.verifier)
  safeStorage.remove(storageKeys.state)
}

const mapTokenToUser = (tokens: AuthTokens): User | null => {
  if (!tokens?.id_token) return null
  const payload = decodeJwtPayload(tokens.id_token)
  return {
    id: payload.sub,
    full_name: payload.name || payload.preferred_username || 'Usuario TelcoX',
    email: payload.email || '',
    username: payload.preferred_username || '',
  }
}

const isExpired = (tokens: AuthTokens, skewSeconds = 30) => {
  if (!tokens?.expires_at) return true
  return tokens.expires_at - skewSeconds <= Math.floor(Date.now() / 1000)
}

async function exchangeCodeForTokens(code: string, state: string) {
  const expectedState = safeStorage.get(storageKeys.state)
  const verifier = safeStorage.get(storageKeys.verifier)
  if (!expectedState || expectedState !== state) throw new Error('Invalid OAuth state')
  if (!verifier) throw new Error('Missing PKCE verifier')

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.keycloakClientId,
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
    throw new Error(`Token exchange failed: ${response.status}`)
  }

  safeStorage.remove(storageKeys.verifier)
  safeStorage.remove(storageKeys.state)
  return saveTokens(await response.json())
}

async function loginWithKeycloak() {
  const verifier = randomString()
  const state = randomString(32)
  const challenge = await createCodeChallenge(verifier)
  safeStorage.set(storageKeys.verifier, verifier)
  safeStorage.set(storageKeys.state, state)

  const params = new URLSearchParams({
    client_id: config.keycloakClientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: 'openid profile email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  window.location.assign(`${getAuthUrl()}?${params.toString()}`)
}

async function postJson(path: string, payload: unknown, token: string) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json()
}

function Pill({ label, active }: { label: string; active?: boolean }) {
  return (
    <View style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </View>
  )
}

function LoginScreen({ loading, error, onLogin }: { loading: boolean; error: string; onLogin: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.hero}>
        <Text style={styles.brand}>TelcoX</Text>
        <Text style={styles.title}>Acceso seguro al sistema</Text>
        <Text style={styles.subtitle}>
          Inicia sesion con Keycloak y entra al onboarding antes de ver el panel principal.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Inicio de sesion</Text>
        <Text style={styles.helper}>
          Esta pantalla usa el mismo flujo OIDC PKCE que la web.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.button} onPress={onLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#04110f" /> : <Text style={styles.buttonText}>Ingresar con Keycloak</Text>}
        </Pressable>
      </View>
    </ScrollView>
  )
}

function OnboardingScreen({
  user,
  token,
  onLogout,
}: {
  user: User | null
  token: string
  onLogout: () => void
}) {
  const [documentId, setDocumentId] = useState(user?.username?.replace(/\D/g, '') || '')
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState('')
  const [documentType, setDocumentType] = useState('national_id')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<OnboardingResult | null>(null)
  const [methods, setMethods] = useState({
    password: true,
    passkey: true,
    fingerprint: true,
    face_auth: true,
    device_biometric: true,
  })

  const demoProfiles = useMemo(
    () => [
      { fullName: 'Ana Torres', email: 'ana.torres@telcox.com', phone: '+593987654321' },
      { fullName: 'Mario Perez', email: 'mario.perez@telcox.com', phone: '+593981112233' },
      { fullName: 'Carla Mendez', email: 'carla.mendez@telcox.com', phone: '+593976543210' },
      { fullName: 'Luis Andrade', email: 'luis.andrade@telcox.com', phone: '+593992224466' },
    ],
    [],
  )

  const fillRandomDemoData = () => {
    const profile = demoProfiles[Math.floor(Math.random() * demoProfiles.length)]
    const randomBody = String(Math.floor(100000000 + Math.random() * 900000000))
    const evenLastDigit = String(Math.floor(Math.random() * 5) * 2)
    setDocumentId(`${randomBody}${evenLastDigit}`)
    setFullName(profile.fullName)
    setEmail(profile.email)
    setPhone(profile.phone)
    setDocumentType('national_id')
  }

  const verifyIdentity = async () => {
    setLoading(true)
    setMessage('Verificando identidad...')
    try {
      const selectedMethods = Object.keys(methods).filter((key) => methods[key as keyof typeof methods])
      const payload = {
        document_id: documentId || '0912345678',
        full_name: fullName || 'Usuario TelcoX',
        email: email || 'user@telcox.com',
        phone: phone || '+593987654321',
        document_type: documentType,
        document_front_image: 'mock_front',
        document_back_image: 'mock_back',
        selfie_image: 'mock_selfie',
        consent_accepted: true,
        requested_auth_methods: selectedMethods,
      }
      const response = await postJson('/onboarding-service/onboarding-cases/verify', payload, token)
      setResult(response)
      setMessage(response.status === 'completed' ? 'Identidad verificada' : `Verificacion pendiente: ${response.status}`)
    } catch (err: any) {
      setMessage(err.message || 'Error verificando identidad')
    } finally {
      setLoading(false)
    }
  }

  const enrollMethods = async () => {
    if (!result) return
    setLoading(true)
    try {
      const selectedMethods = Object.keys(methods).filter((key) => methods[key as keyof typeof methods])
      await postJson(`/onboarding-service/onboarding-cases/${result.id}/auth-methods`, { auth_methods: selectedMethods }, token)
      setMessage('Metodos de acceso habilitados')
    } catch (err: any) {
      setMessage(err.message || 'Error habilitando acceso')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.hero}>
        <Text style={styles.brand}>Onboarding</Text>
        <Text style={styles.title}>Verificacion de identidad</Text>
        <Text style={styles.subtitle}>
          Completa documento, selfie y habilitacion de metodos de acceso.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Datos del usuario</Text>
        <TextInput value={documentId} onChangeText={setDocumentId} placeholder="Documento" placeholderTextColor={theme.muted} style={styles.input} />
        <TextInput value={fullName} onChangeText={setFullName} placeholder="Nombre completo" placeholderTextColor={theme.muted} style={styles.input} />
        <TextInput value={email} onChangeText={setEmail} placeholder="Correo" placeholderTextColor={theme.muted} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
        <TextInput value={phone} onChangeText={setPhone} placeholder="Telefono" placeholderTextColor={theme.muted} style={styles.input} />
        <View style={styles.row}>
          <Pressable style={styles.secondaryButton} onPress={fillRandomDemoData}>
            <Text style={styles.secondaryButtonText}>Llenar aleatorio</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Verificacion</Text>
        <Text style={styles.helper}>La app envia los datos al mismo servicio de onboarding que usa la web.</Text>
        <View style={styles.summaryRow}>
          <Pill label="Documento" active />
          <Pill label="Selfie" active />
          <Pill label="Biometria" active />
        </View>
        {message ? <Text style={styles.helper}>{message}</Text> : null}
        <Pressable style={styles.button} onPress={verifyIdentity} disabled={loading}>
          {loading ? <ActivityIndicator color="#04110f" /> : <Text style={styles.buttonText}>Verificar identidad</Text>}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Metodos de acceso</Text>
        {[
          { key: 'password', label: 'Contrasena tradicional' },
          { key: 'passkey', label: 'Passkey WebAuthn' },
          { key: 'fingerprint', label: 'Huella dactilar' },
          { key: 'face_auth', label: 'Reconocimiento facial' },
          { key: 'device_biometric', label: 'Biometria del dispositivo' },
        ].map((method) => (
          <Pressable
            key={method.key}
            style={styles.toggleRow}
            onPress={() => setMethods((prev) => ({ ...prev, [method.key]: !prev[method.key as keyof typeof prev] }))}
          >
            <View style={[styles.toggle, methods[method.key as keyof typeof methods] && styles.toggleOn]} />
            <Text style={styles.toggleLabel}>{method.label}</Text>
          </Pressable>
        ))}
        <Pressable style={styles.button} onPress={enrollMethods} disabled={!result || loading}>
          <Text style={styles.buttonText}>Habilitar acceso</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onLogout}>
          <Text style={styles.secondaryButtonText}>Cerrar sesion</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [tokens, setTokens] = useState<AuthTokens | null>(null)

  const isAuthenticated = Boolean(user && tokens)

  useEffect(() => {
    const init = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const state = params.get('state')
        if (code && state) {
          const nextTokens = await exchangeCodeForTokens(code, state)
          setTokens(nextTokens)
          setUser(mapTokenToUser(nextTokens))
          window.history.replaceState({}, document.title, '/')
          setLoading(false)
          return
        }

        const stored = getStoredTokens()
        if (stored) {
          if (!isExpired(stored)) {
            setTokens(stored)
            setUser(mapTokenToUser(stored))
            setLoading(false)
            return
          }
          if (stored.refresh_token) {
            const body = new URLSearchParams({
              grant_type: 'refresh_token',
              client_id: config.keycloakClientId,
              refresh_token: stored.refresh_token,
            })
            const response = await fetch(getTokenUrl(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body,
            })
            if (response.ok) {
              const refreshed = saveTokens(await response.json())
              setTokens(refreshed)
              setUser(mapTokenToUser(refreshed))
              setLoading(false)
              return
            }
          }
        }
      } catch (err: any) {
        setError(err.message || 'No se pudo iniciar la sesion')
        clearStoredAuth()
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [])

  const onLogin = async () => {
    setError('')
    await loginWithKeycloak()
  }

  const onLogout = () => {
    clearStoredAuth()
    setTokens(null)
    setUser(null)
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ExpoStatusBar style="light" />
        <View style={styles.centered}>
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.helper}>Validando sesion...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ExpoStatusBar style="light" />
      <StatusBar barStyle="light-content" />
      {!isAuthenticated ? (
        <LoginScreen loading={false} error={error} onLogin={onLogin} />
      ) : (
        <OnboardingScreen user={user} token={tokens!.access_token} onLogout={onLogout} />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  hero: {
    gap: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  brand: {
    color: theme.primary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  title: {
    color: theme.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    color: theme.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
  },
  input: {
    backgroundColor: theme.panelSoft,
    color: theme.text,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  button: {
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#04110f',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: theme.panelSoft,
    borderColor: theme.border,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '700',
  },
  helper: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  error: {
    color: '#ff9f9f',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  pill: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.panelSoft,
  },
  pillActive: {
    backgroundColor: theme.primarySoft,
    borderColor: '#2d7d71',
  },
  pillText: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  pillTextActive: {
    color: theme.text,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  toggle: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.panelSoft,
  },
  toggleOn: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  toggleLabel: {
    color: theme.text,
    fontSize: 14,
  },
})

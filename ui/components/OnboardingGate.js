import { useEffect, useRef, useState } from 'react'
import { postJsonDirect } from '../lib/serviceApi'

const STEPS = [
  { id: 1, label: 'Datos' },
  { id: 2, label: 'Documento' },
  { id: 3, label: 'Selfie' },
  { id: 4, label: 'Verificacion' },
  { id: 5, label: 'Acceso' },
]

const DEMO_PROFILES = [
  { fullName: 'Ana Torres', email: 'ana.torres@telcox.com', phone: '+593987654321' },
  { fullName: 'Mario Perez', email: 'mario.perez@telcox.com', phone: '+593981112233' },
  { fullName: 'Carla Mendez', email: 'carla.mendez@telcox.com', phone: '+593976543210' },
  { fullName: 'Luis Andrade', email: 'luis.andrade@telcox.com', phone: '+593992224466' },
]

function Stepper({ current }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-0">
      {STEPS.map((step, index) => {
        const done = current > step.id
        const active = current === step.id
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                done ? 'bg-emerald-500 text-white' : active ? 'bg-cyan-600 text-white ring-4 ring-cyan-200' : 'bg-slate-100 text-slate-400'
              }`}>
                {done ? 'OK' : step.id}
              </div>
              <span className={`text-[10px] font-semibold ${active ? 'text-cyan-600' : done ? 'text-emerald-600' : 'text-slate-400'}`}>
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`mx-1 mb-4 h-0.5 w-10 transition-all duration-300 ${done ? 'bg-emerald-400' : 'bg-slate-100'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function OnboardingGate({ user, getAccessToken, onComplete }) {
  const [step, setStep] = useState(1)
  const [documentId, setDocumentId] = useState(user?.username?.replace(/\D/g, '') || '')
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState('')
  const [docType, setDocType] = useState('national_id')
  const [docFront, setDocFront] = useState(null)
  const [docBack, setDocBack] = useState(null)
  const [uploading, setUploading] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [selfie, setSelfie] = useState(null)
  const [camError, setCamError] = useState(false)
  const [progress, setProgress] = useState('')
  const [verifyResult, setVerifyResult] = useState(null)
  const [methods, setMethods] = useState({
    password: true,
    passkey: true,
    fingerprint: true,
    face_auth: true,
    device_biometric: true,
  })
  const [enrolling, setEnrolling] = useState(false)

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream])

  const fillRandomDemoData = () => {
    const profile = DEMO_PROFILES[Math.floor(Math.random() * DEMO_PROFILES.length)]
    const randomBody = String(Math.floor(100000000 + Math.random() * 900000000))
    const evenLastDigit = String(Math.floor(Math.random() * 5) * 2)
    setDocumentId(`${randomBody}${evenLastDigit}`)
    setFullName(profile.fullName)
    setEmail(profile.email)
    setPhone(profile.phone)
    setDocType('national_id')
  }

  const simulateUpload = (side) => {
    setUploading(side)
    setTimeout(() => {
      if (side === 'front') setDocFront('doc_front_captured.img')
      else setDocBack('doc_back_captured.img')
      setUploading(null)
    }, 800)
  }

  const startCamera = async () => {
    setCamError(false)
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 300 } })
      setStream(nextStream)
      if (videoRef.current) videoRef.current.srcObject = nextStream
    } catch {
      setCamError(true)
    }
  }

  const captureSelfie = () => {
    if (stream && videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0)
      setSelfie(canvas.toDataURL('image/png'))
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
      return
    }
    setSelfie('mock_selfie_placeholder')
  }

  const runVerification = async () => {
    setStep(4)
    setVerifyResult(null)
    const stages = [
      'Analizando calidad del documento...',
      'Extrayendo datos mediante OCR...',
      'Iniciando reconocimiento facial...',
      'Comparando rostro con documento...',
      'Ejecutando prueba de vida...',
      'Consultando registros gubernamentales...',
    ]
    for (const stage of stages) {
      setProgress(stage)
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    try {
      const token = await getAccessToken()
      const selectedMethods = Object.keys(methods).filter((key) => methods[key])
      const payload = {
        document_id: documentId || '0912345678',
        full_name: fullName || 'Usuario TelcoX',
        email: email || 'user@telcox.com',
        phone: phone || '+593987654321',
        document_type: docType,
        document_front_image: docFront || 'mock_front',
        document_back_image: docBack || 'mock_back',
        selfie_image: selfie || 'mock_selfie',
        consent_accepted: true,
        requested_auth_methods: selectedMethods,
      }
      const result = await postJsonDirect('onboarding', '/onboarding-service/onboarding-cases/verify', payload, token)
      setVerifyResult(result)
      if (result.status !== 'completed') {
        setProgress(`Verificacion pendiente: ${result.status}`)
        return
      }
      setStep(5)
    } catch (error) {
      setProgress(`Error: ${error.message}`)
    }
  }

  const enrollMethods = async () => {
    if (!verifyResult) return
    setEnrolling(true)
    try {
      const token = await getAccessToken()
      const selectedMethods = Object.keys(methods).filter((key) => methods[key])
      await postJsonDirect(
        'onboarding',
        `/onboarding-service/onboarding-cases/${verifyResult.id}/auth-methods`,
        { auth_methods: selectedMethods },
        token,
      )
      onComplete()
    } catch (error) {
      setEnrolling(false)
      alert(`Error habilitando metodos: ${error.message}`)
    }
  }

  const resetVerification = () => {
    setVerifyResult(null)
    setProgress('')
    setStep(1)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(14,158,239,0.15),transparent_30%),linear-gradient(to_bottom,#f0f7ff,#e8f4ff)] p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <span className="mb-3 inline-block rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-cyan-700">
            Verificacion de identidad
          </span>
          <h1 className="text-3xl font-bold text-slate-900">Bienvenido, {user?.full_name?.split(' ')[0] || 'Usuario'}</h1>
          <p className="mt-1 text-sm text-slate-500">Completa tu verificacion para acceder al portal TelcoX.</p>
        </div>

        <div className="rounded-[32px] border border-white/80 bg-white/95 p-8 shadow-2xl shadow-cyan-900/10">
          <Stepper current={step} />

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Datos personales</h2>
                  <p className="text-xs text-slate-500">Ingresa tus datos tal como aparecen en tu documento oficial.</p>
                </div>
                <button
                  type="button"
                  onClick={fillRandomDemoData}
                  className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-bold text-cyan-700 transition hover:bg-cyan-100"
                >
                  Llenar datos aleatorios
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Documento</span>
                  <input value={documentId} onChange={(event) => setDocumentId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nombre completo</span>
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Correo</span>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Telefono</span>
                  <input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tipo de documento</span>
                  <select value={docType} onChange={(event) => setDocType(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none">
                    <option value="national_id">Cedula nacional / DNI</option>
                    <option value="passport">Pasaporte</option>
                    <option value="driver_license">Licencia de conducir</option>
                  </select>
                </label>
              </div>
              <button onClick={() => setStep(2)} disabled={!documentId || !fullName} className="w-full rounded-2xl bg-cyan-600 py-3 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:bg-slate-200 disabled:text-slate-400">
                Continuar
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-slate-900">Fotos del documento</h2>
              <p className="text-xs text-slate-500">Captura ambas caras del documento. Los datos deben ser legibles.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { key: 'front', label: 'Parte frontal', ready: docFront },
                  { key: 'back', label: 'Parte posterior', ready: docBack },
                ].map((item) => (
                  <div key={item.key} className={`rounded-2xl border-2 border-dashed p-5 text-center transition ${item.ready ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                    <span className="mb-2 block text-2xl font-bold text-slate-500">ID</span>
                    <span className="mb-3 block text-xs font-bold uppercase tracking-wider text-slate-500">{item.label}</span>
                    {item.ready ? (
                      <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Capturada</span>
                    ) : (
                      <button onClick={() => simulateUpload(item.key)} disabled={uploading === item.key} className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700 disabled:bg-slate-300">
                        {uploading === item.key ? 'Subiendo...' : 'Capturar'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Atras</button>
                <button onClick={() => setStep(3)} disabled={!docFront || !docBack} className="flex-1 rounded-2xl bg-cyan-600 py-3 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:bg-slate-200 disabled:text-slate-400">Continuar</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-slate-900">Reconocimiento facial</h2>
              <p className="text-xs text-slate-500">Activa la camara y toma una selfie centrada y bien iluminada.</p>
              <div className="flex flex-col items-center gap-4">
                <div className="relative flex h-52 w-52 items-center justify-center overflow-hidden rounded-full border-4 border-cyan-500 bg-slate-900 shadow-lg">
                  {selfie && selfie !== 'mock_selfie_placeholder' ? (
                    <img src={selfie} alt="Selfie" className="h-full w-full object-cover" />
                  ) : stream ? (
                    <video ref={videoRef} autoPlay playsInline className="h-full w-full scale-x-[-1] object-cover" />
                  ) : (
                    <span className="text-sm font-bold uppercase tracking-wider text-white">Selfie</span>
                  )}
                  {stream && !selfie && <div className="pointer-events-none absolute inset-4 rounded-full border border-dashed border-white/50" />}
                </div>
                <div className="flex gap-2">
                  {!stream && !selfie && <button onClick={startCamera} className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-cyan-500">Activar camara</button>}
                  {stream && <button onClick={captureSelfie} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800">Capturar rostro</button>}
                  {selfie && <button onClick={() => { setSelfie(null); startCamera() }} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Reintentar</button>}
                </div>
                {camError && (
                  <div className="w-full rounded-xl border border-amber-100 bg-amber-50 p-3 text-center">
                    <p className="text-xs font-semibold text-amber-700">Camara no disponible. Se usara verificacion simulada.</p>
                    <button onClick={captureSelfie} className="mt-2 rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-amber-400">Continuar con simulacion</button>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Atras</button>
                <button onClick={runVerification} disabled={!selfie && !camError} className="flex-1 rounded-2xl bg-cyan-600 py-3 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:bg-slate-200 disabled:text-slate-400">Verificar identidad</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center gap-6 py-10">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-cyan-50 text-xl font-bold text-cyan-700">
                KYC
                <span className="absolute inset-0 animate-ping rounded-full border-4 border-cyan-300 opacity-30" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-bold text-slate-900">Analizando credenciales...</h2>
                <p className="mt-2 text-sm font-semibold text-cyan-600">{progress}</p>
                {verifyResult && verifyResult.status !== 'completed' && (
                  <button onClick={resetVerification} className="mt-5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                    Reintentar verificacion
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">OK</span>
                <div>
                  <p className="text-sm font-bold text-emerald-800">Identidad verificada</p>
                  <p className="text-xs text-emerald-600">Documento y reconocimiento facial aprobados.</p>
                </div>
              </div>
              <h2 className="text-lg font-bold text-slate-900">Configurar acceso biometrico</h2>
              <p className="text-xs text-slate-500">Elige como quieres ingresar al sistema en el futuro.</p>
              <div className="space-y-2">
                {[
                  { key: 'password', label: 'Contrasena tradicional', desc: 'Ingreso con usuario y contrasena segura.' },
                  { key: 'fingerprint', label: 'Huella dactilar', desc: 'Sensor biometrico del dispositivo movil o PC.' },
                  { key: 'face_auth', label: 'Reconocimiento facial', desc: 'Face ID o escaneo 3D con camara frontal.' },
                  { key: 'passkey', label: 'Passkey WebAuthn', desc: 'Clave criptografica local sin contrasena.' },
                  { key: 'device_biometric', label: 'Biometria del dispositivo', desc: 'Cualquier biometrico habilitado en el dispositivo.' },
                ].map((method) => (
                  <label key={method.key} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 transition hover:bg-slate-100/50">
                    <input type="checkbox" checked={methods[method.key]} onChange={() => setMethods((prev) => ({ ...prev, [method.key]: !prev[method.key] }))} className="mt-0.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500" />
                    <div>
                      <span className="block text-sm font-bold text-slate-800">{method.label}</span>
                      <span className="block text-xs text-slate-500">{method.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
              <button onClick={enrollMethods} disabled={enrolling || Object.values(methods).every((value) => !value)} className="w-full rounded-2xl bg-cyan-600 py-3 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:bg-slate-200 disabled:text-slate-400">
                {enrolling ? 'Habilitando acceso...' : 'Ingresar al portal'}
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] font-medium text-slate-400">
          TelcoX - Verificacion segura con KYC - Datos encriptados y protegidos.
        </p>
      </div>
    </div>
  )
}

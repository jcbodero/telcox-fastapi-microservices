import { useState, useEffect, useRef } from 'react'
import { postJsonDirect, buildUrl } from '../lib/serviceApi'

export default function OnboardingSection({ appendLog, getAccessToken }) {
  const [step, setStep] = useState(1) // 1: Documentos, 2: Reconocimiento Facial, 3: Verificación, 4: Métodos de Acceso, 5: Completado
  const [documentId, setDocumentId] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [documentType, setDocumentType] = useState('national_id')
  
  // Document status
  const [docFront, setDocFront] = useState(null)
  const [docBack, setDocBack] = useState(null)
  const [uploadingDoc, setUploadingDoc] = useState(null) // 'front' or 'back' or null

  // Camera & Selfie
  const [cameraStream, setCameraStream] = useState(null)
  const [cameraError, setCameraError] = useState(false)
  const [selfieCaptured, setSelfieCaptured] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  // Verification Results
  const [verificationResult, setVerificationResult] = useState(null)
  const [verifyingProgress, setVerifyingProgress] = useState('')

  // Selected Auth Methods
  const [authMethods, setAuthMethods] = useState({
    password: true,
    passkey: true,
    fingerprint: true,
    face_auth: true,
    device_biometric: true
  })

  const [onboardingCases, setOnboardingCases] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const loadOnboardingCases = async () => {
    try {
      const url = buildUrl('onboarding', '/onboarding-service/onboarding-cases')
      const token = await getAccessToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(url, { headers })
      if (res.ok) {
        const data = await res.json()
        setOnboardingCases(data)
      }
    } catch (err) {
      console.error('Failed to load onboarding cases:', err)
    }
  }

  useEffect(() => {
    loadOnboardingCases()
  }, [])

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [cameraStream])

  // Step 1: Upload Documents Simulation
  const simulateUpload = (type) => {
    setUploadingDoc(type)
    setTimeout(() => {
      if (type === 'front') setDocFront('document_front_uploaded.png')
      if (type === 'back') setDocBack('document_back_uploaded.png')
      setUploadingDoc(null)
      appendLog(`Documento ${type === 'front' ? 'frontal' : 'posterior'} subido correctamente.`)
    }, 1500)
  }

  // Step 2: Request Camera Access
  const startCamera = async () => {
    setCameraError(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 300 } })
      setCameraStream(stream)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error('Camera access failed:', err)
      setCameraError(true)
      appendLog('Acceso a cámara denegado o no disponible. Usando simulador facial.')
    }
  }

  const captureSelfie = () => {
    if (cameraStream && videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/png')
      setSelfieCaptured(dataUrl)
      // Stop camera
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
      appendLog('Selfie capturada con éxito.')
    } else {
      // Mock selfie if camera is not working
      setSelfieCaptured('mock_selfie_base64_avatar')
      appendLog('Selfie simulada capturada con éxito.')
    }
  }

  // Step 3: Run Verification
  const runIdentityVerification = async () => {
    setStep(3)
    const steps = [
      'Analizando calidad de los documentos...',
      'Extrayendo datos vía OCR...',
      'Iniciando reconocimiento facial 3D...',
      'Comparando rostro con fotografía del documento...',
      'Realizando prueba de vida (Liveness Detection)...',
      'Consultando buró de antecedentes y bases de datos gubernamentales...'
    ]

    for (let i = 0; i < steps.length; i++) {
      setVerifyingProgress(steps[i])
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    try {
      const token = await getAccessToken()
      const requestedMethods = Object.keys(authMethods).filter(k => authMethods[k])

      const payload = {
        document_id: documentId || '0912345678',
        full_name: fullName || 'Usuario Registrado',
        email: email || 'usuario.nuevo@example.com',
        phone: phone || '+593987654321',
        document_type: documentType,
        document_front_image: docFront || 'mock_front_uri',
        document_back_image: docBack || 'mock_back_uri',
        selfie_image: selfieCaptured || 'mock_selfie_uri',
        consent_accepted: true,
        requested_auth_methods: requestedMethods
      }

      const res = await postJsonDirect('onboarding', '/onboarding-service/onboarding-cases/verify', payload, token)
      setVerificationResult(res)
      appendLog(`Verificación de identidad completada. Estado: ${res.status}.`)
      
      // Advance to next step (enroll methods)
      setStep(4)
      await loadOnboardingCases()
    } catch (err) {
      appendLog(`Error en verificación de identidad: ${err.message}`)
      setStep(1) // Return to start on error
    }
  }

  // Step 4: Enroll Authentication Methods
  const enrollMethods = async () => {
    if (!verificationResult) return
    setIsLoading(true)
    try {
      const token = await getAccessToken()
      const requestedMethods = Object.keys(authMethods).filter(k => authMethods[k])
      
      const url = `/onboarding-service/onboarding-cases/${verificationResult.id}/auth-methods`
      const payload = { auth_methods: requestedMethods }
      const res = await postJsonDirect('onboarding', url, payload, token)
      
      appendLog(`Métodos biométricos habilitados: ${res.enabled_auth_methods.join(', ')}`)
      setStep(5)
      await loadOnboardingCases()
    } catch (err) {
      appendLog(`Error al habilitar biometría: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const resetFlow = () => {
    setStep(1)
    setDocumentId('')
    setFullName('')
    setEmail('')
    setPhone('')
    setDocFront(null)
    setDocBack(null)
    setSelfieCaptured(null)
    setVerificationResult(null)
  }

  return (
    <div className="space-y-6">
      {/* Onboarding Wizard Card */}
      <div className="rounded-[32px] border border-cyan-200/50 bg-white/95 p-8 shadow-xl shadow-cyan-900/5 transition duration-300">
        
        {/* Wizard Header & Progress Bar */}
        <div className="border-b border-slate-100 pb-6 mb-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-600">Onboarding Seguro TelcoX</span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">Verificación de Identidad Digital</h2>
            </div>
            <div className="text-sm font-semibold text-slate-400">
              Paso {step} de 5
            </div>
          </div>
          
          {/* Progress Indicator */}
          <div className="mt-4 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div 
              className="h-full bg-cyan-600 transition-all duration-500 ease-out" 
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* STEP 1: Datos Personales y Documento */}
        {step === 1 && (
          <div className="space-y-6 animate-fadeIn">
            <h3 className="text-lg font-semibold text-slate-900">1. Datos Personales y Documento de Identidad</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Ingrese su información básica y suba una foto clara de su documento de identidad (Cédula, DNI o Pasaporte) para iniciar la validación nacional.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Número de Documento</label>
                <input
                  type="text"
                  placeholder="Ej. 0912345678 (Aprobado directo si termina en par)"
                  value={documentId}
                  onChange={(e) => setDocumentId(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Nombre Completo</label>
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="Ej. juan.perez@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Celular</label>
                <input
                  type="tel"
                  placeholder="Ej. +593987654321"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Tipo de Documento</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="national_id">Cédula Nacional / DNI</option>
                  <option value="passport">Pasaporte</option>
                  <option value="driver_license">Licencia de Conducir</option>
                </select>
              </div>
            </div>

            {/* Document upload simulation */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center hover:bg-slate-100/50 transition">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">📸 Parte Frontal del Documento</span>
                {docFront ? (
                  <div className="space-y-2">
                    <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">✓ Cargado</span>
                    <p className="text-xs text-slate-500 font-mono">{docFront}</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => simulateUpload('front')}
                    disabled={uploadingDoc === 'front'}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
                  >
                    {uploadingDoc === 'front' ? 'Subiendo...' : 'Capturar / Subir Foto'}
                  </button>
                )}
              </div>

              <div className="relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center hover:bg-slate-100/50 transition">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">📸 Parte Posterior del Documento</span>
                {docBack ? (
                  <div className="space-y-2">
                    <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">✓ Cargado</span>
                    <p className="text-xs text-slate-500 font-mono">{docBack}</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => simulateUpload('back')}
                    disabled={uploadingDoc === 'back'}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
                  >
                    {uploadingDoc === 'back' ? 'Subiendo...' : 'Capturar / Subir Foto'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!documentId || !fullName || !docFront || !docBack}
                className="rounded-2xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white hover:bg-cyan-500 disabled:bg-slate-200 disabled:text-slate-400 transition"
              >
                Siguiente: Reconocimiento Facial
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Reconocimiento Facial / Captura */}
        {step === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <h3 className="text-lg font-semibold text-slate-900">2. Reconocimiento Facial y Prueba de Vida</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Active la cámara del dispositivo para tomarse una selfie. El sistema realizará una prueba de vida (Liveness) y comparará su rostro con el documento subido.
            </p>

            <div className="flex flex-col items-center justify-center space-y-4">
              {/* Webcam viewport */}
              <div className="relative h-64 w-64 rounded-full border-4 border-cyan-500 bg-slate-900 overflow-hidden shadow-inner flex items-center justify-center">
                {selfieCaptured ? (
                  <img src={selfieCaptured} alt="Selfie" className="h-full w-full object-cover" />
                ) : cameraStream ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="h-full w-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="text-center p-4">
                    <span className="text-4xl">🤳</span>
                    <p className="text-xs text-slate-400 mt-2">Cámara apagada</p>
                  </div>
                )}

                {/* Oval overlay helper */}
                {!selfieCaptured && cameraStream && (
                  <div className="absolute inset-4 rounded-full border border-dashed border-white/60 pointer-events-none" />
                )}
              </div>

              {/* Controls */}
              <div className="flex gap-3">
                {!cameraStream && !selfieCaptured && (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500 transition"
                  >
                    Activar Cámara del Dispositivo
                  </button>
                )}
                
                {cameraStream && (
                  <button
                    type="button"
                    onClick={captureSelfie}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                  >
                    Capturar Rostro
                  </button>
                )}

                {selfieCaptured && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelfieCaptured(null)
                      startCamera()
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Volver a Capturar
                  </button>
                )}
              </div>

              {cameraError && (
                <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-center">
                  <p className="text-xs text-rose-700 font-semibold">
                    No se pudo acceder a la cámara. Simulando validación en segundo plano.
                  </p>
                </div>
              )}
            </div>

            {/* Hidden canvas for video capturing */}
            <canvas ref={canvasRef} className="hidden" />

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Atrás
              </button>
              
              <button
                type="button"
                onClick={runIdentityVerification}
                disabled={!selfieCaptured && !cameraError}
                className="rounded-2xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white hover:bg-cyan-500 disabled:bg-slate-200 disabled:text-slate-400 transition"
              >
                Iniciar Validación de Identidad
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Verificación / Cargando */}
        {step === 3 && (
          <div className="py-12 flex flex-col items-center justify-center space-y-6 animate-pulse">
            {/* Spinning/scanning icon */}
            <div className="relative flex items-center justify-center h-20 w-20 rounded-full bg-cyan-50 text-cyan-600 text-3xl">
              🔍
              <span className="absolute animate-ping inline-flex h-full w-full rounded-full bg-cyan-400 opacity-20" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-slate-900">Verificando Credenciales...</h3>
              <p className="text-sm text-cyan-600 font-semibold animate-pulse">{verifyingProgress}</p>
            </div>
          </div>
        )}

        {/* STEP 4: Métodos de Acceso Biométricos */}
        {step === 4 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 flex items-center gap-3">
              <span className="text-2xl">🎉</span>
              <div>
                <p className="text-sm text-emerald-800 font-bold">¡Identidad Validada Correctamente!</p>
                <p className="text-xs text-emerald-600 font-medium">Documento coincidente y prueba de vida facial aprobada.</p>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-slate-900 mt-4">3. Habilitar Métodos de Acceso</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Seleccione cómo desea ingresar a la plataforma en el futuro. Puede activar autenticación biométrica nativa para mayor comodidad.
            </p>

            <div className="grid gap-3">
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100/50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={authMethods.password}
                  onChange={() => handleCheckboxChange('password')}
                  className="mt-1 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <div>
                  <span className="block text-sm font-bold text-slate-800">Contraseña Tradicional</span>
                  <span className="block text-xs text-slate-500 font-medium">Ingresar usando contraseña alfanumérica segura.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100/50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={authMethods.fingerprint}
                  onChange={() => handleCheckboxChange('fingerprint')}
                  className="mt-1 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <div>
                  <span className="block text-sm font-bold text-slate-800">👆 Huella Dactilar</span>
                  <span className="block text-xs text-slate-500 font-medium">Permite iniciar sesión tocando el sensor biométrico del dispositivo móvil/PC.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100/50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={authMethods.face_auth}
                  onChange={() => handleCheckboxChange('face_auth')}
                  className="mt-1 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <div>
                  <span className="block text-sm font-bold text-slate-800">👤 Reconocimiento Facial (Face ID / Biométrica)</span>
                  <span className="block text-xs text-slate-500 font-medium">Utilice la cámara frontal para iniciar sesión rápidamente mediante escaneo 3D.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100/50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={authMethods.passkey}
                  onChange={() => handleCheckboxChange('passkey')}
                  className="mt-1 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <div>
                  <span className="block text-sm font-bold text-slate-800">🔑 Clave de Acceso (Passkeys / WebAuthn)</span>
                  <span className="block text-xs text-slate-500 font-medium">Iniciar sesión de forma segura y sin contraseña usando criptografía local.</span>
                </div>
              </label>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={enrollMethods}
                disabled={isLoading}
                className="rounded-2xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white hover:bg-cyan-500 transition disabled:bg-slate-300"
              >
                {isLoading ? 'Habilitando Métodos...' : 'Habilitar y Activar Acceso'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Completado */}
        {step === 5 && (
          <div className="py-8 text-center space-y-6 animate-fadeIn">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 text-emerald-800 text-3xl">
              ✓
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-900">¡Onboarding Completado con Éxito!</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                Su cuenta ha sido creada y configurada. Ahora puede acceder mediante sus contraseñas, huella dactilar, o autenticación biométrica facial.
              </p>
            </div>

            <button
              type="button"
              onClick={resetFlow}
              className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              Registrar Nuevo Cliente
            </button>
          </div>
        )}

      </div>

      {/* Historial Cases Table */}
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Historial de Onboardings</h2>
            <p className="mt-1 text-sm text-slate-500 font-medium">
              Lista general de casos aprobados o en revisión mediante la API.
            </p>
          </div>
          <button
            onClick={loadOnboardingCases}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Actualizar lista
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-4">Caso ID</th>
                <th className="px-4 py-4">Nombre / Identificación</th>
                <th className="px-4 py-4">Riesgo</th>
                <th className="px-4 py-4">Estado Onboarding</th>
                <th className="px-4 py-4">Métodos de Acceso Habilitados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {onboardingCases.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                    No hay casos registrados.
                  </td>
                </tr>
              ) : (
                onboardingCases.map((c) => {
                  const methods = c.enabled_auth_methods || []
                  return (
                    <tr key={c.id} className="bg-white hover:bg-slate-50 transition">
                      <td className="px-4 py-4 font-mono text-slate-950 text-xs font-bold">{c.id}</td>
                      <td className="px-4 py-4">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-900">{c.full_name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">DNI: {c.document_id}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          c.risk_level === 'low' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {c.risk_level || 'high'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {methods.map(m => (
                            <span key={m} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                              {m === 'password' && '🔑 Contraseña'}
                              {m === 'passkey' && '🔐 Passkey'}
                              {m === 'fingerprint' && '👆 Huella'}
                              {m === 'face_auth' && '👤 Rostro'}
                              {m === 'device_biometric' && '📱 Biométrico'}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

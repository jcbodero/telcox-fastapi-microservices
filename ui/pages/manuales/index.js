const manuals = [
  {
    title: 'Arquitectura Aplicada',
    description: 'Documento HTML con Mermaid integrado, visor Draw.io y opcion de descarga a PDF.',
    href: '/manuales/ARCHITECTURE_ONPREM_AWS.html',
    type: 'HTML',
  },
  {
    title: 'Diagramas Draw.io',
    description: 'Archivo editable con las paginas On-Premise, AWS Objetivo, CI/CD DevOps y Datos MS.',
    href: '/manuales/TELCOX_ARCHITECTURE.drawio',
    type: 'DRAWIO',
  },
  {
    title: 'Arquitectura En Markdown',
    description: 'Fuente documental base usada para generar la vista HTML y la documentacion navegable.',
    href: '/manuales/ARCHITECTURE_ONPREM_AWS.md',
    type: 'MD',
  },
  {
    title: 'Indice Completo De Manuales',
    description: 'Listado de todos los archivos servidos desde la carpeta de manuales.',
    href: '/manuales/index.html',
    type: 'HTML',
  },
]

export default function Manuales() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,158,239,0.18),transparent_28%),linear-gradient(to_bottom,#f8fbff_0%,#eef2ff_100%)] px-6 py-10 text-slate-900">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-[32px] border border-cyan-200/70 bg-white/95 p-8 shadow-xl shadow-cyan-500/10">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-600">TelcoX Documentation Center</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">Manuales de arquitectura y despliegue</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
            Esta seccion sirve la documentacion tecnica generada desde el repositorio. El acceso en despliegue se protege con usuario y contrasena mediante Basic Auth en el Ingress, sin Keycloak.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {manuals.map((manual) => (
            <a
              key={manual.href}
              href={manual.href}
              className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-cyan-200/70"
            >
              <div className="mb-4 inline-flex rounded-2xl bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                {manual.type}
              </div>
              <h2 className="text-xl font-semibold text-slate-950">{manual.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{manual.description}</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}

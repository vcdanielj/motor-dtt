import type { ReactNode } from 'react'
import Card from '@/ui/components/Card'

// ---------------------------------------------------------------------------
// Manual de uso — static, presentational screen (no store reads).
// Ports the standalone HTML manual's 12 sections + visual devices into the
// app's Tailwind theme. Long by nature (a real content page); kept as local
// sub-components within this single file per the sprint brief.
// ---------------------------------------------------------------------------

type Tone = 'navy' | 'red' | 'green' | 'amber' | 'gold' | 'cyan' | 'slate'

const CHIP_TONE: Record<Tone, string> = {
  navy: 'bg-navy/10 text-navy',
  red: 'bg-red/10 text-red',
  green: 'bg-green/10 text-green',
  amber: 'bg-amber/15 text-amber',
  gold: 'bg-gold/25 text-ink',
  cyan: 'bg-cyan/10 text-cyan',
  slate: 'bg-line text-slate',
}

function Chip({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide ${CHIP_TONE[tone]}`}
    >
      {children}
    </span>
  )
}

function SectionHead({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-line pb-3">
      <span className="font-mono text-xs font-bold text-red">{n}</span>
      <div>
        <h2 className="text-base font-bold text-navy">{title}</h2>
        {sub ? <p className="mt-0.5 text-xs italic text-slate">{sub}</p> : null}
      </div>
    </div>
  )
}

function Prose({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex max-w-none flex-col gap-3 text-[13px] leading-relaxed text-ink">{children}</div>
}

const CALLOUT_TONE: Record<Tone, string> = {
  navy: 'border-navy/25 bg-navy/5 text-navy',
  red: 'border-red/25 bg-red/10 text-red',
  green: 'border-green/25 bg-green/10 text-green',
  amber: 'border-amber/30 bg-amber/10 text-amber',
  gold: 'border-gold/40 bg-gold/10 text-ink',
  cyan: 'border-cyan/25 bg-cyan/10 text-cyan',
  slate: 'border-line bg-line/40 text-slate',
}

function Callout({ tone, icon, title, children }: { tone: Tone; icon: string; title: string; children: ReactNode }) {
  return (
    <div className={`mt-4 flex max-w-none gap-3 rounded-lg border px-4 py-3 ${CALLOUT_TONE[tone]}`}>
      <span aria-hidden="true" className="mt-0.5 shrink-0 font-mono text-sm font-bold">
        {icon}
      </span>
      <div>
        <h4 className="text-[13px] font-bold text-ink">{title}</h4>
        <p className="mt-1 text-xs leading-relaxed text-slate">{children}</p>
      </div>
    </div>
  )
}

function Step({ n, title, soon, children }: { n: number; title: string; soon?: boolean; children: ReactNode }) {
  return (
    <li className="relative border-l-2 border-line pb-8 pl-8 last:border-transparent last:pb-0">
      <span className="absolute -left-[17px] top-0 flex h-8 w-8 items-center justify-center rounded-full bg-navy font-mono text-xs font-bold text-panel ring-4 ring-bg">
        {n}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        {soon ? <Chip tone="slate">próximamente</Chip> : null}
      </div>
      <p className="mt-1.5 max-w-none text-xs leading-relaxed text-slate">{children}</p>
    </li>
  )
}

type Accent = 'navy' | 'gold' | 'cyan' | 'red' | 'amber'

const ACCENT_BORDER: Record<Accent, string> = {
  navy: 'border-l-navy',
  gold: 'border-l-gold',
  cyan: 'border-l-cyan',
  red: 'border-l-red',
  amber: 'border-l-amber',
}
const ACCENT_TEXT: Record<Accent, string> = {
  navy: 'text-navy',
  gold: 'text-gold',
  cyan: 'text-cyan',
  red: 'text-red',
  amber: 'text-amber',
}

function CascadeNode({
  accent,
  method,
  chips,
  dashed,
  indent,
  children,
}: {
  accent: Accent
  method: string
  chips?: ReactNode
  dashed?: boolean
  indent?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={`rounded-lg border border-line bg-panel p-4 shadow-sm ${
        dashed ? 'border-dashed' : ''
      } border-l-4 ${ACCENT_BORDER[accent]} ${indent ? 'ml-6 sm:ml-10' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`font-mono text-sm font-bold ${ACCENT_TEXT[accent]}`}>{method}</span>
        {chips}
      </div>
      <p className="mt-1.5 max-w-none text-xs leading-relaxed text-slate">{children}</p>
    </div>
  )
}

function CascadeArrow({ indent, children }: { indent?: boolean; children: ReactNode }) {
  return (
    <div className={`my-2 font-mono text-[11px] text-slate-2 ${indent ? 'ml-6 sm:ml-10' : ''}`}>↓ {children}</div>
  )
}

function ScreenCard({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <Card className="flex gap-3">
      <span aria-hidden="true" className="font-mono text-lg text-red">
        {icon}
      </span>
      <div>
        <h3 className="text-sm font-bold text-navy">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate">{children}</p>
      </div>
    </Card>
  )
}

function RequirementCard({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <Card className="flex gap-3">
      <span aria-hidden="true" className="font-mono text-lg text-navy">
        {icon}
      </span>
      <div>
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate">{children}</p>
      </div>
    </Card>
  )
}

function MacroPill({ label, count }: { label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 font-mono text-xs text-ink">
      {label}
      <span className="rounded-full bg-navy/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-navy">{count}</span>
    </span>
  )
}

function GlossItem({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line py-3 sm:flex-row sm:gap-4">
      <dt className="w-full shrink-0 font-mono text-xs font-bold text-navy sm:w-56">{term}</dt>
      <dd className="text-xs leading-relaxed text-slate">{children}</dd>
    </div>
  )
}

function FaqItem({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group border-b border-line py-3 first:pt-0 last:border-transparent">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-semibold text-ink">
        {q}
        <span className="shrink-0 font-mono text-sm text-slate transition-transform duration-150 group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="mt-2 max-w-none text-xs leading-relaxed text-slate">{children}</p>
    </details>
  )
}

export default function Manual() {
  return (
    <div className="max-w-[1240px]">
      {/* ---------------- Header band ---------------- */}
      <div className="rounded-lg bg-gradient-to-br from-navy to-navy-deep px-6 py-10 text-panel sm:px-10">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-panel/60">
          <span className="rounded bg-red px-2 py-0.5 font-bold text-panel">DTT</span>
          <span>Motor&nbsp;DTT · Manual de uso</span>
        </div>
        <h1 className="mt-3 max-w-4xl text-2xl font-bold leading-snug sm:text-3xl">
          Estandariza el sell-out del canal DTT sin que un solo dato salga de tu computadora.
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-panel/80">
          El Motor DTT toma los reportes crudos de los distribuidores —donde el <em>segmento de tienda</em> y el{' '}
          <em>estado</em> llegan como texto libre— y los resuelve a un catálogo estándar mediante una cascada
          automática, con trazabilidad por registro y una cola para lo que necesita criterio humano.
        </p>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] text-panel/70">
          <span>● 100% en el navegador · sin servidor</span>
          <span>● Chrome / Edge de escritorio</span>
          <span>● ~740.000 registros por corrida</span>
          <span>● Los datos nunca se suben a la nube</span>
        </div>
      </div>

      <div className="mt-8 lg:grid lg:grid-cols-4 lg:gap-8 items-start">
        {/* Sticky side outline navigation */}
        <aside className="no-print hidden lg:block lg:col-span-1 sticky top-6 self-start max-h-[calc(100vh-4rem)] overflow-y-auto border-r border-line/30 pr-4">
          <div className="text-xs font-bold uppercase tracking-wider text-navy mb-4">Manual de Uso</div>
          <ul className="flex flex-col gap-2.5 text-xs font-semibold text-slate">
            <li><a href="#que-es" className="block py-1 hover:text-red transition-colors">01 · Qué es y para qué sirve</a></li>
            <li><a href="#antes" className="block py-1 hover:text-red transition-colors">02 · Antes de empezar</a></li>
            <li><a href="#flujo" className="block py-1 hover:text-red transition-colors">03 · El flujo en 5 pasos</a></li>
            <li><a href="#pantallas" className="block py-1 hover:text-red transition-colors">04 · Las seis pantallas</a></li>
            <li><a href="#segmento" className="block py-1 hover:text-red transition-colors">05 · Cómo resuelve el segmento</a></li>
            <li><a href="#estado" className="block py-1 hover:text-red transition-colors">06 · Cómo resuelve el estado</a></li>
            <li><a href="#scdc" className="block py-1 hover:text-red transition-colors">07 · Entender el SCDC</a></li>
            <li><a href="#catalogo" className="block py-1 hover:text-red transition-colors">08 · El catálogo estándar</a></li>
            <li><a href="#banderas" className="block py-1 hover:text-red transition-colors">09 · Banderas de registro</a></li>
            <li><a href="#privacidad" className="block py-1 hover:text-red transition-colors">10 · Privacidad de los datos</a></li>
            <li><a href="#faq" className="block py-1 hover:text-red transition-colors">11 · Preguntas frecuentes</a></li>
            <li><a href="#glosario" className="block py-1 hover:text-red transition-colors">12 · Glosario</a></li>
          </ul>
        </aside>

        {/* Content sections */}
        <div className="lg:col-span-3 flex flex-col gap-12">
          {/* ============= 01 · Qué es ============= */}
          <section id="que-es">
            <SectionHead n="01" title="Qué es y para qué sirve" sub="Una herramienta para el analista de Trade Marketing, no un sistema de TI." />
            <Prose>
            <p>
              Cada semestre, los <strong>63 distribuidores</strong> del canal DTT reportan cerca de{' '}
              <strong>740.000 transacciones</strong>, cada uno con su propio formato. Las dos variables cualitativas
              críticas —<strong>Segmento de Tienda</strong> (el tipo de cliente: abasto, panadería, farmacia…) y{' '}
              <strong>Estado</strong>— llegan como texto libre: cientos de variantes para lo que deberían ser 14
              segmentos oficiales, registros sin segmento y estados marcados «NO IDENTIFICADO».
            </p>
            <p>
              Eso hace imposible calcular distribución numérica, sell-out por formato de tienda o cobertura
              geográfica. El Motor DTT arregla exactamente eso:{' '}
              <strong>ingiere los reportes crudos, normaliza el texto y resuelve el segmento y el estado de cada registro</strong>{' '}
              contra un catálogo oficial, dejando una base estandarizada y un reporte de calidad por distribuidor.
            </p>
            <p>
              El principio de diseño rector: <strong>el segmento es una propiedad del cliente, no de la transacción.</strong>{' '}
              Una vez que un cliente (por su RIF) queda clasificado, todas sus transacciones heredan ese segmento, sin
              importar lo que teclee el distribuidor.
            </p>
          </Prose>
          <Callout tone="cyan" icon="i" title="No reemplaza tu criterio: lo enfoca">
            El motor resuelve automáticamente todo lo que puede con certeza y te entrega el resto priorizado por
            impacto (toneladas), para que tu tiempo manual vaya donde mueve la aguja.
          </Callout>
        </section>

        {/* ============= 02 · Antes de empezar ============= */}
        <section id="antes">
          <SectionHead n="02" title="Antes de empezar" sub="Requisitos mínimos y qué necesitas tener a la mano." />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <RequirementCard icon="▤" title="Navegador">
              Chrome o Edge de escritorio (últimas 2 versiones). En Firefox o Safari verás un aviso: funcionan, pero
              la exportación y el rendimiento son óptimos en Chrome/Edge.
            </RequirementCard>
            <RequirementCard icon="⌸" title="Equipo">
              8&nbsp;GB de RAM o más. El procesamiento de 740.000 filas ocurre íntegramente en tu máquina, en segundo
              plano, sin congelar la pantalla.
            </RequirementCard>
            <RequirementCard icon="▦" title="El archivo">
              El reporte consolidado <code className="font-mono text-[11px]">Sell_out</code> en{' '}
              <code className="font-mono text-[11px]">.csv</code> o <code className="font-mono text-[11px]">.xlsx</code>,
              con las columnas habituales (RIF, Canal/Tipo de Cliente, Estado, Ciudad, TON…).
            </RequirementCard>
          </div>
          <Prose>
            <p>
              No hay que instalar nada, ni crear cuenta, ni configurar un servidor. Abres la dirección web, y el motor
              ya está listo. Puedes incluso instalarlo como aplicación (icono en el escritorio) desde el botón de
              instalación del navegador: seguirá corriendo 100% local.
            </p>
          </Prose>
        </section>

        {/* ============= 03 · Flujo en 5 pasos ============= */}
        <section id="flujo">
          <SectionHead n="03" title="El flujo en 5 pasos" sub="De archivo crudo a base estandarizada." />
          <ol className="mt-6 flex flex-col">
            <Step n={1} title="Cargar el archivo">
              En la pantalla <strong>Corrida</strong>, arrastra tu <code className="font-mono">Sell_out.csv</code> (o{' '}
              <code className="font-mono">.xlsx</code>) a la zona de carga, o haz clic para seleccionarlo. El motor
              detecta solo qué columna es el RIF, el segmento, el estado y la ciudad.
            </Step>
            <Step n={2} title="Procesar">
              El motor recorre el archivo en un solo paso, en segundo plano, mostrando el conteo vivo de filas y
              distribuidores. En un histórico completo esto toma segundos, no minutos.
            </Step>
            <Step n={3} title="Revisar los resultados">
              Al terminar, el <strong>Dashboard</strong>, <strong>Distribuidores</strong> y <strong>Cola</strong> se
              llenan con los datos reales de tu corrida: % de clasificación, estado válido y calidad por
              distribuidor.
            </Step>
            <Step n={4} title="Resolver la cola">
              La <strong>Cola de revisión</strong> lista lo que quedó sin resolver en <strong>ambos campos</strong>
              —segmento y estado—, ordenado por toneladas y filtrable por dominio. Asignas el valor correcto a cada
              pendiente y la clasificación <strong>se guarda localmente (IndexedDB)</strong>: el motor la aplica
              automáticamente en la próxima corrida —las variantes de segmento van al diccionario aprendido, las de
              estado al diccionario de estados, y los conflictos de RIF al maestro manual.
            </Step>
            <Step n={5} title="Exportar la base estandarizada">
              Descargas un XLSX (listo para abrir en Excel) con todas las columnas originales intactas más las columnas estandarizadas (segmento
              N3, macro-canal, estado, método, banderas y trazabilidad) listo para Power BI, desde el botón{' '}
              <strong>«Descargar base estandarizada»</strong> en <strong>Corrida</strong>.
            </Step>
          </ol>
          <Callout tone="green" icon="⛁" title="Tu aprendizaje persiste">
            Las clasificaciones que resuelves en la Cola se guardan en este navegador (IndexedDB) y se conservan de
            una corrida a la siguiente. Es almacenamiento local: no se sincroniza ni se sube a ningún lado.
          </Callout>
          <Callout tone="cyan" icon="↺" title="Reproducible por diseño">
            La misma corrida, con la misma configuración, produce siempre el mismo resultado. La base estandarizada
            es una vista derivada: siempre se puede regenerar desde los crudos.
          </Callout>
          <Callout tone="amber" icon="📥" title="Plantillas por Distribuidor (Formato Heinz)">
            Si hay clientes nuevos sin clasificar, puedes descargar un archivo ZIP que contiene plantillas individuales por distribuidor con formato oficial Heinz. Éstas incluyen una pestaña de «Manual de Segmentos» y validación con menús desplegables (dropdown) para que el distribuidor clasifique con un clic. Luego, importas la planilla resuelta en la pantalla de Configuración.
          </Callout>
        </section>

        {/* ============= 04 · Las seis pantallas ============= */}
        <section id="pantallas">
          <SectionHead n="04" title="Las seis pantallas" sub="Todo se navega desde la barra lateral izquierda." />

          <div className="mt-5 overflow-hidden rounded-lg border border-line shadow-sm">
            <div className="flex items-center gap-1.5 bg-bg px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-line" />
              <span className="h-2.5 w-2.5 rounded-full bg-line" />
              <span className="h-2.5 w-2.5 rounded-full bg-line" />
              <span className="ml-2 font-mono text-[11px] text-slate-2">Motor DTT · aplicación web</span>
            </div>
            <div className="flex flex-col sm:flex-row">
              <div className="flex shrink-0 flex-row overflow-x-auto bg-navy font-sans text-[11px] text-panel/80 sm:w-40 sm:flex-col sm:overflow-visible">
                <span className="hidden px-3 pb-2 pt-3 font-mono text-xs text-panel sm:block">Motor DTT</span>
                <span className="whitespace-nowrap bg-red px-3 py-2 text-panel">Dashboard</span>
                <span className="whitespace-nowrap px-3 py-2">Corrida</span>
                <span className="whitespace-nowrap px-3 py-2">Distribuidores</span>
                <span className="whitespace-nowrap px-3 py-2">Cola</span>
                <span className="whitespace-nowrap px-3 py-2">Maestro</span>
                <span className="whitespace-nowrap px-3 py-2">Config</span>
              </div>
              <div className="flex-1 bg-bg p-4">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="rounded-md border border-line bg-panel p-2.5">
                    <div className="text-[10px] uppercase tracking-wide text-slate">Registros</div>
                    <div className="font-mono text-sm font-bold text-navy">740.009</div>
                  </div>
                  <div className="rounded-md border border-line bg-panel p-2.5">
                    <div className="text-[10px] uppercase tracking-wide text-slate">Clasificación</div>
                    <div className="font-mono text-sm font-bold text-navy">93,8%</div>
                  </div>
                  <div className="rounded-md border border-line bg-panel p-2.5">
                    <div className="text-[10px] uppercase tracking-wide text-slate">Cobertura N3</div>
                    <div className="font-mono text-sm font-bold text-navy">89,1%</div>
                  </div>
                  <div className="rounded-md border border-line bg-panel p-2.5">
                    <div className="text-[10px] uppercase tracking-wide text-slate">Estado válido</div>
                    <div className="font-mono text-sm font-bold text-green">94,1%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] italic text-slate-2">
            Dashboard tras una corrida real del histórico Oct-25 / Mar-26.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ScreenCard icon="◑" title="Dashboard">
              El resumen de la última corrida: registros procesados, % de clasificación, cobertura y estado válido,
              más una tira de calidad por distribuidor (crudo → post-motor).
            </ScreenCard>
            <ScreenCard icon="▶" title="Corrida">
              El punto de entrada. Cargas el archivo y ves el pipeline de 6 etapas —Ingesta, Normalización, Cascada
              Segmento, Cascada Estado, Maestro, Dedup— con progreso real.
            </ScreenCard>
            <ScreenCard icon="▥" title="Distribuidores">
              Tabla ordenable con el <strong>SCDC</strong> (calidad) de cada distribuidor: qué tan limpio envió el
              dato (crudo) frente a lo recuperado por el motor (post), registros y toneladas.
            </ScreenCard>
            <ScreenCard icon="⚑" title="Cola de revisión">
              Los pendientes que necesitan criterio humano, en dos dominios: variantes nuevas de segmento y de
              estado con sugerencia difusa, clientes de alto volumen sin clasificar y conflictos de RIF, todos
              priorizados por toneladas. El tope se aplica por dominio, así los estados nunca quedan desplazados
              por una cola larga de segmentos.
            </ScreenCard>
            <ScreenCard icon="◉" title="Maestro de clientes">
              La tabla de clientes por RIF con su segmento, macro-canal, método de clasificación, confianza, regla canónica aplicada y <strong>desglose multi-sucursal / multi-estado</strong>. Buscable por RIF o nombre.
            </ScreenCard>
            <ScreenCard icon="⇄" title="Homologación de Códigos (Alias)">
              Mapea códigos internos de clientes de distribuidores que no colocan RIF a su RIF canónico, razón social y estado (ej. Campesino <em>BAR-00236</em> → <em>J-402116012</em>). Cruza por distribuidor + código, y si el código es distintivo y único en la base también aplica aunque el nombre del distribuidor varíe. La homologación aplica tanto en la corrida como en la base estandarizada exportada. Permite registro interactivo, búsqueda, e importación/exportación CSV.
            </ScreenCard>
            <ScreenCard icon="⚙" title="Configuración">
              Catálogos (14 segmentos oficiales, 24 estados, diccionario de segmentos, diccionario de
              variantes de estado, matriz ciudad→estado y base de homologaciones) y umbrales del motor, ahora editables. Puedes exportar e
              importar (CSV) los diccionarios, homologaciones y el maestro aprendidos, con opción de «Restablecer aprendizaje».
            </ScreenCard>
          </div>
        </section>

        {/* ============= 05 · Cómo resuelve el segmento ============= */}
        <section id="segmento">
          <SectionHead
            n="05"
            title="Cómo resuelve el segmento"
            sub="Una cascada: cada registro baja por los métodos en orden y se detiene en el primero que acierta."
          />
          <Prose>
            <p>
              El motor no «adivina». Aplica métodos de mayor a menor certeza, y registra <em>con qué método</em>{' '}
              quedó clasificado cada fila, para que siempre sepas de dónde viene el resultado.
            </p>
          </Prose>

          <div className="mt-5 flex max-w-[720px] flex-col">
            <CascadeNode
              accent="gold"
              method="1 · MAESTRO"
              chips={
                <>
                  <Chip tone="gold">por RIF</Chip>
                  <Chip tone="navy">confianza N3</Chip>
                </>
              }
            >
              ¿Este cliente ya está clasificado en el maestro? Se usa su segmento (por RIF, regla D3), sin importar lo
              que teclee el distribuidor esta vez, y recupera las filas que llegan con el segmento vacío.
            </CascadeNode>
            <CascadeArrow>si no está en el maestro</CascadeArrow>
            <CascadeNode
              accent="navy"
              method="2 · EXACTO"
              chips={
                <>
                  <Chip tone="navy">diccionario</Chip>
                  <Chip tone="navy">confianza N3</Chip>
                </>
              }
            >
              Se normaliza el texto crudo (mayúsculas, sin acentos, separadores unificados) y se busca en el
              diccionario de ~200 equivalencias. «BODEGAS», «Bodega», «09 Abasto-Bod» → <strong>BODEGA</strong>.
            </CascadeNode>
            <CascadeArrow>si no hay coincidencia exacta</CascadeArrow>
            <CascadeNode
              accent="cyan"
              method="3 · FUZZY ≥ 92"
              chips={
                <>
                  <Chip tone="cyan">similitud</Chip>
                  <Chip tone="navy">confianza N3</Chip>
                </>
              }
            >
              Coincidencia aproximada (token-sort) contra las variantes conocidas. Si la similitud es{' '}
              <strong>92 o más</strong>, se clasifica. «MINIMARKTS» → <strong>SMI - Mini Market</strong>.
            </CascadeNode>
            <CascadeArrow indent>similitud entre 80 y 91</CascadeArrow>
            <CascadeNode
              accent="amber"
              method="→ SUGERENCIA A COLA"
              chips={<Chip tone="amber">variante nueva</Chip>}
              dashed
              indent
            >
              No se clasifica automáticamente, pero se envía a la Cola con la sugerencia y su puntaje, para que tú
              confirmes o corrijas.
            </CascadeNode>
            <CascadeArrow>si nada supera el umbral</CascadeArrow>
            <CascadeNode accent="red" method="4 · SIN_CLASIFICAR" chips={<Chip tone="red">a revisión</Chip>}>
              Se marca honestamente como sin clasificar —nunca se inventa un segmento— y, si mueve volumen, aparece
              en la Cola priorizado por toneladas.
            </CascadeNode>
          </div>

          <Callout tone="amber" icon="!" title="Categorías combinadas">
            Cuando un distribuidor reporta un valor combinado (p. ej. «ABASTOS / BODEGAS»), el motor aplica la
            decisión de diseño del catálogo (por defecto, Abastos) en lugar de adivinar. «OTROS» y «EMPLEADOS»
            se clasifican en el segmento oficial «Otros» (la exclusión de empleados de la medición se hace
            a lo interno con la columna valor_original_segmento); solo lo verdaderamente irreconocible va a revisión.
          </Callout>
        </section>

        {/* ============= 06 · Cómo resuelve el estado ============= */}
        <section id="estado">
          <SectionHead n="06" title="Cómo resuelve el estado" sub="La misma idea de cascada, aplicada a la geografía." />
          <Prose>
            <p>
              El estado tiene exactamente la misma maquinaria que el segmento: catálogo oficial, diccionario de
              variantes que se puede enseñar, cola de revisión, recuperación por RIF y los mismos umbrales fuzzy.
            </p>
            <p>
              Antes de buscar coincidencia, el motor <strong>limpia el texto</strong>: quita prefijos administrativos
              («EDO», «EDO.ZULIA» sin espacio, «ESTADO DE», «DTTO»), códigos numéricos al inicio («13 ZULIA»),
              sufijos de ruido («MIRANDA ESTADO», «ZULIA / VENEZUELA») y paréntesis. Además trata como vacío una
              cuarentena de valores sin información: «NO IDENTIFICADO», «N/A», «SIN DEFINIR», «POR DEFINIR»,
              «NULL», «-», «0» y una treintena más.
            </p>
          </Prose>

          <div className="mt-5 flex max-w-[720px] flex-col">
            <CascadeNode accent="navy" method="1 · CATÁLOGO (EXACTO)" chips={<Chip tone="navy">exacto</Chip>}>
              Si el estado crudo, ya limpio, coincide con uno de los 24 estados oficiales de Venezuela, se acepta.
            </CascadeNode>
            <CascadeArrow>si no coincide de forma exacta</CascadeArrow>
            <CascadeNode
              accent="cyan"
              method="2 · DICCIONARIO DE VARIANTES"
              chips={
                <>
                  <Chip tone="cyan">semilla</Chip>
                  <Chip tone="green">aprendible</Chip>
                </>
              }
            >
              Traducciones conocidas de texto crudo a estado oficial: abreviaturas («DTTO CAPITAL», «NVA ESPARTA»),
              renombres oficiales («LA GUAIRA» → VARGAS, porque el catálogo Heinz manda) y errores de escritura
              habituales. Va antes del RIF porque un estado escrito y mapeable es mejor evidencia que el estado
              habitual del cliente. Cada resolución en la Cola añade una entrada aquí, para siempre.
            </CascadeNode>
            <CascadeArrow>si la variante no está en el diccionario</CascadeArrow>
            <CascadeNode
              accent="gold"
              method="3 · POR RIF (HISTÓRICO)"
              chips={
                <>
                  <Chip tone="gold">histórico</Chip>
                  <Chip tone="green">activo</Chip>
                </>
              }
            >
              Se recupera el estado a través del historial del cliente (RIF), tomando su estado más recurrente en
              otras transacciones. Gana sobre la ciudad cuando ambos discrepan (regla R4).
            </CascadeNode>
            <CascadeArrow>si el RIF no tiene historial geográfico</CascadeArrow>
            <CascadeNode
              accent="cyan"
              method="4 · POR CIUDAD"
              chips={<><Chip tone="cyan">~180 ciudades</Chip><Chip tone="green">aprendible</Chip></>}
            >
              Se deduce el estado a partir de la ciudad del cliente. La matriz solo incluye nombres que identifican
              un único estado: los ambiguos («San Carlos», «Libertador», «La Candelaria») se dejan fuera a propósito,
              porque adivinar mal es peor que dejar el registro sin estado. Cada distribuidor inventa sus propios
              nombres de ruta —«El Paraíso / Las Fuentes», «Catia / Manicomio»—; esos llegan a la Cola como
              «Ciudad sin mapear» y, una vez decididos, quedan en el mapa para siempre.
            </CascadeNode>
            <CascadeArrow>si la ciudad no resuelve</CascadeArrow>
            <CascadeNode accent="amber" method="5 · COINCIDENCIA DIFUSA" chips={<Chip tone="amber">umbral configurable</Chip>}>
              Búsqueda difusa (Levenshtein tokenizado) del estado crudo contra los 24 oficiales y contra las claves
              del diccionario. Usa el mismo umbral que el segmento: por encima se asigna, y entre el piso y el
              umbral <strong>no se asigna</strong> — se manda a la Cola con la sugerencia.
            </CascadeNode>
            <CascadeArrow>si nada resuelve</CascadeArrow>
            <CascadeNode accent="red" method="6 · SIN_ESTADO" chips={<Chip tone="red">a revisión</Chip>}>
              Queda marcado sin estado, nunca imputado, y el valor crudo entra a la Cola de revisión agrupado por
              volumen para que una sola decisión arregle miles de filas.
            </CascadeNode>
          </div>
        </section>

        {/* ============= 07 · Entender el SCDC ============= */}
        <section id="scdc">
          <SectionHead n="07" title="Entender el SCDC" sub="El indicador de calidad por distribuidor — y por qué se mide sobre el crudo." />
          <Prose>
            <p>
              El <strong>SCDC</strong> (Score de Calidad del Dato Crudo) mide <em>qué tan limpio envió el dato el
              distribuidor</em>. Por eso se calcula <strong>sobre lo que ellos enviaron</strong>, no sobre lo que el
              motor logró rescatar: si midiéramos el post-motor, un distribuidor descuidado se vería igual de bien
              que uno prolijo, y perderíamos la señal para exigir mejoras.
            </p>
          </Prose>

          <div className="mt-4 grid max-w-[720px] grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className="border-l-4 border-l-red">
              <div className="text-xs font-bold uppercase tracking-wide text-red">SCDC crudo</div>
              <div className="mt-1 font-mono text-3xl font-bold text-red">31%</div>
              <p className="mt-2 text-xs leading-relaxed text-slate">
                Lo que el distribuidor envió directamente utilizable (coincidencia exacta con el catálogo). Es su
                nota de calidad.
              </p>
            </Card>
            <Card className="border-l-4 border-l-green">
              <div className="text-xs font-bold uppercase tracking-wide text-green">SCDC post-motor</div>
              <div className="mt-1 font-mono text-3xl font-bold text-green">74%</div>
              <p className="mt-2 text-xs leading-relaxed text-slate">
                Lo que quedó resuelto tras aplicar diccionario, fuzzy y maestro. Es lo que ganas para el análisis.
              </p>
            </Card>
          </div>

          <Prose>
            <p>
              La distancia entre ambos números es, literalmente, el valor que agrega el motor. En el histórico real
              se ven distribuidores en 98–99% (envían el dato impecable) junto a otros en 0% (nunca llenan el
              segmento) — y esa foto es la que permite priorizar la conversación con cada uno.
            </p>
          </Prose>

          <Card className="mt-4 max-w-[720px] overflow-x-auto p-0">
            <table className="w-full min-w-[480px] border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border-b-2 border-navy px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-slate">
                    Distribuidor (ejemplo real)
                  </th>
                  <th className="border-b-2 border-navy px-3 py-2 text-right text-[10.5px] font-bold uppercase tracking-wide text-slate">
                    Registros
                  </th>
                  <th className="border-b-2 border-navy px-3 py-2 text-right text-[10.5px] font-bold uppercase tracking-wide text-slate">
                    SCDC crudo
                  </th>
                  <th className="border-b-2 border-navy px-3 py-2 text-right text-[10.5px] font-bold uppercase tracking-wide text-slate">
                    SCDC post
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <td className="px-3 py-2 font-semibold text-ink">CEC LARA</td>
                  <td className="px-3 py-2 text-right font-mono text-slate">35.410</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-ink">99,3%</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-ink">99,3%</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="px-3 py-2 font-semibold text-ink">ALIMENTOS GLOBAL</td>
                  <td className="px-3 py-2 text-right font-mono text-slate">22.275</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-ink">98,2%</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-ink">98,2%</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="px-3 py-2 font-semibold text-ink">DISTRIBUCIONES FRANCIS</td>
                  <td className="px-3 py-2 text-right font-mono text-slate">4.519</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-red">15,6%</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-red">15,6%</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-semibold text-ink">EXCELSIOR DISTRIBUCIONES RK</td>
                  <td className="px-3 py-2 text-right font-mono text-slate">52.003</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-red">0%</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-red">0%</td>
                </tr>
              </tbody>
            </table>
          </Card>
          <p className="mt-2 max-w-[68ch] text-[11px] italic text-slate-2">
            Cuando el maestro por RIF entre en operación, el «post» superará al «crudo» al recuperar clientes que hoy
            llegan con el segmento vacío.
          </p>
        </section>

        {/* ============= 08 · El catálogo estándar ============= */}
        <section id="catalogo">
          <SectionHead n="08" title="El catálogo estándar" sub="La fuente de verdad: los 14 segmentos oficiales del CEC." />
          <Prose>
            <p>
              Toda la clasificación se apoya en un catálogo oficial embebido en la herramienta. Son{' '}
              <strong>exactamente 14 segmentos (Nivel&nbsp;3)</strong> —los que solicita el CEC, con{' '}
              <strong>Otros</strong> como segmento per se—,
              más <strong>24 estados</strong>, una matriz de <strong>~280 equivalencias</strong> de variantes de
              segmento y un <strong>diccionario de variantes de estado</strong> (abreviaturas, renombres oficiales y
              errores de escritura) respaldado por una matriz de <strong>~150 ciudades</strong>, todo encontrado en
              la data real.
            </p>
          </Prose>
          <div className="mt-4 flex max-w-[720px] flex-wrap gap-2">
            <MacroPill label="Trade Tradicional" count={6} />
            <MacroPill label="SMI" count={2} />
            <MacroPill label="Bodegones" count={1} />
            <MacroPill label="Farmacias" count={1} />
            <MacroPill label="Horeca" count={1} />
            <MacroPill label="Mayoristas" count={1} />
            <MacroPill label="Tiendas de Conveniencia" count={1} />
            <MacroPill label="Otros" count={1} />
          </div>
          <Prose>
            <p>
              Cada segmento tiene un código (DTT-01 a DTT-14) para facilitar la integración con ERPs. En{' '}
              <strong>Configuración</strong> puedes ver los conteos cargados y su procedencia. El catálogo se puede
              actualizar sin tocar la herramienta: es un cambio de datos, no de programa.
            </p>
          </Prose>
        </section>

        {/* ============= 09 · Banderas de registro ============= */}
        <section id="flags">
          <SectionHead n="09" title="Banderas de registro" sub="Cada fila de salida lleva una bandera que resume su estado." />
          <Card className="mt-4 max-w-[720px] overflow-x-auto p-0">
            <table className="w-full min-w-[420px] border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border-b-2 border-navy px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-slate">
                    Bandera
                  </th>
                  <th className="border-b-2 border-navy px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-slate">
                    Qué significa
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <td className="px-3 py-2">
                    <Chip tone="green">OK</Chip>
                  </td>
                  <td className="px-3 py-2 text-slate">Segmento y estado resueltos correctamente.</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="px-3 py-2">
                    <Chip tone="red">SIN_CLASIFICAR</Chip>
                  </td>
                  <td className="px-3 py-2 text-slate">
                    No se pudo resolver el segmento. Candidato a la Cola si mueve volumen.
                  </td>
                </tr>
                <tr className="border-b border-line">
                  <td className="px-3 py-2">
                    <Chip tone="amber">SIN_ESTADO</Chip>
                  </td>
                  <td className="px-3 py-2 text-slate">El segmento se resolvió, pero no el estado.</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Chip tone="cyan">DUPLICADO</Chip>
                      <Chip tone="slate">próximamente</Chip>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate">Fila idéntica detectada y excluida (se conserva en anexo).</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">
                    <Chip tone="gold">CONFLICTO_MAYOR</Chip>
                  </td>
                  <td className="px-3 py-2 text-slate">
                    Un RIF aparece en macro-canales contradictorios; se detecta y va a la Cola.
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
          <Callout tone="green" icon="✓" title="Honestidad ante todo">
            Lo irresoluble se queda en la base marcado, con su valor original y su procedencia. El motor nunca
            imputa, nunca inventa y nunca descarta silenciosamente un registro.
          </Callout>
        </section>

        {/* ============= 10 · Privacidad ============= */}
        <section id="privacidad">
          <SectionHead n="10" title="Privacidad de los datos" sub="El diseño garantiza que la data de ventas no salga de tu equipo." />
          <Callout tone="green" icon="⛨" title="Local-first, sin excepciones">
            Todo el procesamiento ocurre en tu navegador. La herramienta no tiene servidor propio ni base de datos en
            la nube: el archivo que cargas nunca se transmite a ningún lado. Incluso está bloqueado a nivel del
            navegador (política de seguridad de contenido) para que ningún dato de ventas pueda enviarse a un host
            externo.
          </Callout>
          <Prose>
            <p>
              Las tipografías y todo el código se sirven desde el propio sitio; no hay llamadas a terceros. Puedes
              usar la herramienta sin conexión una vez cargada. La única «salida» de datos es el archivo
              estandarizado que tú mismo decides descargar a tu disco.
            </p>
          </Prose>
        </section>

        {/* ============= 11 · FAQ ============= */}
        <section id="faq">
          <SectionHead n="11" title="Preguntas frecuentes" sub="Lo que suele surgir en las primeras corridas." />
          <div className="mt-4 max-w-[68ch]">
            <FaqItem q="Aparece un aviso ámbar sobre el navegador. ¿Puedo seguir?">
              Sí. En Firefox o Safari la herramienta funciona, pero la exportación de archivos y el máximo rendimiento
              están garantizados en Chrome o Edge de escritorio. Para una corrida completa, usa uno de esos dos.
            </FaqItem>
            <FaqItem q="Cargué el archivo y dice «formato no soportado».">
              El motor acepta <code className="font-mono">.csv</code>, <code className="font-mono">.xlsx</code> y{' '}
              <code className="font-mono">.xls</code>. Si tu archivo es de otro tipo (por ejemplo{' '}
              <code className="font-mono">.txt</code> o un PDF), conviértelo primero. Si el CSV está vacío o sin
              encabezados, también lo rechazará con un mensaje claro.
            </FaqItem>
            <FaqItem q="El motor no reconoció mis columnas.">
              Detecta automáticamente RIF, segmento (Canal/Tipo de Cliente), estado y ciudad por el nombre del
              encabezado. Si tu archivo usa nombres muy distintos a los habituales, avísale al equipo para añadir esos
              alias al detector.
            </FaqItem>
            <FaqItem q="¿Por qué la clasificación no llega al 100%?">
              Una parte de los registros llega con el segmento en blanco (cerca del 11%): esos se recuperan por el
              maestro de clientes vía RIF, que entra en una fase posterior. Del texto que sí viene, el motor clasifica
              alrededor del 94%. El resto —«OTROS», nombres de personas, basura de Excel— es genuinamente irresoluble
              automáticamente y va a la Cola.
            </FaqItem>
            <FaqItem q="¿Se pierden mis datos si cierro la pestaña?">
              La corrida vive en memoria mientras la pestaña está abierta. El catálogo y (a futuro) el maestro y el
              diccionario aprendido se guardan localmente en tu navegador. La base estandarizada la conservas
              descargándola.
            </FaqItem>
            <FaqItem q="¿Modifica el motor mis cifras de cajas, bolívares o toneladas?">
              No. Todas las columnas originales se conservan intactas. El motor solo <em>agrega</em> columnas de
              clasificación y trazabilidad; nunca altera montos, cantidades ni fechas.
            </FaqItem>
          </div>
        </section>

        {/* ============= 12 · Glosario ============= */}
        <section id="glosario">
          <SectionHead n="12" title="Glosario" sub="Los términos que verás en la herramienta." />
          <dl className="mt-4 max-w-[68ch]">
            <GlossItem term="Segmento N3">
              El tipo de tienda estándar (Nivel 3): Abastos, Panaderias y Pastelerias, SMI - Mini Market, etc. Hay 14.
            </GlossItem>
            <GlossItem term="Macro-canal N1">
              La agrupación superior de los segmentos (Nivel 1): Trade Tradicional, SMI, Mayoristas… Hay 8.
            </GlossItem>
            <GlossItem term="Cascada">
              La secuencia de métodos de resolución, aplicados en orden de certeza hasta que uno acierta.
            </GlossItem>
            <GlossItem term="Diccionario">
              La tabla de equivalencias que mapea cada variante cruda encontrada al nombre estándar.
            </GlossItem>
            <GlossItem term="Fuzzy">
              Coincidencia aproximada por similitud de texto, para atrapar erratas y variantes no listadas.
            </GlossItem>
            <GlossItem term="Maestro de clientes">
              La tabla que asocia cada RIF con su segmento canónico, construida y enriquecida corrida a corrida.
            </GlossItem>
            <GlossItem term="SCDC">
              Score de Calidad del Dato Crudo: qué tan utilizable envió el dato el distribuidor.
            </GlossItem>
            <GlossItem term="Cola de revisión">
              La lista priorizada de pendientes que requieren decisión humana, tanto de segmento como de estado.
            </GlossItem>
            <GlossItem term="Diccionario de variantes de estado">
              Las traducciones de texto crudo a estado oficial que el motor ya conoce o que le has enseñado — por
              ejemplo «DTTO CAPITAL» → DISTRITO CAPITAL o «LA GUAIRA» → VARGAS.
            </GlossItem>
            <GlossItem term="Confianza N3 / MACRO">
              Si el registro quedó clasificado al segmento fino (N3) o solo al macro-canal (N1).
            </GlossItem>
          </dl>
        </section>
      </div>
      </div>

      <footer className="mt-12 flex flex-col gap-1 border-t border-line pt-4 text-[11px] text-slate-2">
        <span>Manual de uso · Motor de Estandarización DTT · Canal DTT Heinz Venezuela</span>
        <span className="font-mono">v1 · local-first · sin backend</span>
      </footer>
    </div>
  )
}

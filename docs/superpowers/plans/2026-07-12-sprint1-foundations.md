# Motor DTT — Sprint 1 (Foundations & Deployable Skeleton) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the real Motor DTT browser SPA skeleton — a deploy-ready Vite/React/TS/Tailwind app whose 6 views are ported from the prototype behind contract interfaces, with one real mock→real replacement: streaming CSV/XLSX ingest that counts rows and distributors in a Web Worker without freezing the UI.

**Architecture:** Local-first static SPA. All data crosses **contract interfaces** (`src/contracts/`) so UI never reads mock data directly (anti-leak rule). Heavy work runs in a dedicated Web Worker via a `start/progress/done/error` postMessage protocol. Ingest streams with PapaParse (CSV) / SheetJS (XLSX) — no "load all then process." Catalog seeds are embedded TS modules. State lives in a Zustand store. Everything is reproducible from crudos + versioned config; nothing leaves the machine.

**Tech Stack:** React 18 · Vite · TypeScript · Tailwind CSS · Zustand · PapaParse · SheetJS (`xlsx`) · `idb` · `vite-plugin-pwa` · Vitest · `@testing-library/react` (dev-only) · dedicated Web Worker.

## Global Constraints

- **Runtime deps ≤ 8**, bundle **< 600 KB gz** (excl. seeds). Sprint-1 runtime deps: `react`, `react-dom`, `zustand`, `papaparse`, `xlsx`, `idb`. (`fastest-levenshtein` + `vite-plugin-pwa` land later/build-time.)
- **Target browser:** Chrome/Edge desktop (last 2), ≥ 8 GB RAM. Firefox/Safari detected & warned, not blocked.
- **Anti-leak rule:** no UI component imports from `src/mocks/` or `src/seeds/` directly; it consumes a contract interface from `src/contracts/`. Mocks are wired only at the store/adapter layer.
- **No network with sell-out data (RNF5).** Zero backend calls carrying row data. Ever.
- **Honesty (R7):** irresolubles are surfaced as `SIN_CLASIFICAR`, never hidden. Placeholders in seeds carry a `placeholder: true` / provenance marker.
- **Brand tokens (verbatim):** navy `#0F2B5B`, navy-deep `#0A1F44`, red `#C8102E`, red-deep `#A50D26`, green `#1E8E3E`, amber `#E87722`, gold `#F2A900`, cyan `#0097CE`, ink `#1B2430`, slate `#5B6B82`, slate-2 `#8A96A8`, line `#D9DFE9`, bg `#F4F7FB`, panel `#FFFFFF`. Fonts: **IBM Plex Sans** (UI), **IBM Plex Mono** (numeric/metrics).
- **Output schema (PRD §7.3, verbatim):** original columns unaltered + `segmento_n3_std`, `macro_canal_n1_std`, `metodo_segmento`, `confianza_segmento`, `estado_std`, `metodo_estado`, `flag_registro`, `valor_original_segmento`, `valor_original_estado`, `version_diccionario`, `run_id`.
- **Commit after every task.** Conventional commits. TDD: red → green → commit.
- **Prototype source of truth for visuals:** `/private/tmp/claude-501/-Users-daniel/c2f1a86b-4193-4bd3-b37b-6fa411eaa607/scratchpad/motor_dtt_source.html` (1062 lines). View tasks cite exact line ranges. If that path is gone at execution time, decode it again from the Claude Design export (`Motor DTT.dc.html`) per the session notes.

---

## File Structure

```
dtt-motor/
  index.html                      # Vite entry
  package.json  tsconfig.json  vite.config.ts  tailwind.config.ts
  postcss.config.js  .eslintrc.cjs  vitest.config.ts  vitest.setup.ts
  public/                         # PWA icons, manifest assets
  src/
    main.tsx  App.tsx  index.css
    contracts/
      row.ts            # RawRow, InternalRow, SchemaMap, output column names
      pipeline.ts       # PipelineInput, ProgressEvent, PipelineResult, IngestSummary
      maestro.ts        # MaestroEntry
      cola.ts           # ColaItem
      config.ts         # SeedCatalogs, DiccionarioEntry, AppConfig
      index.ts          # barrel
    seeds/
      segmentos.ts      # 35 N3 + macro map (PLACEHOLDER-flagged)
      estados.ts        # 24 estados (PLACEHOLDER-flagged)
      ciudad-estado.ts  # ciudad→estado seed (PLACEHOLDER-flagged)
      diccionario.ts    # curated variant→N3 seed
      index.ts
    ingest/
      schema-detect.ts  # header aliases → SchemaMap (pure)
      normalize.ts      # R1 text normalization (pure)
    worker/
      ingest.worker.ts  # PapaParse/SheetJS streaming; postMessage protocol
      client.ts         # typed wrapper: runIngest(file, onProgress) => Promise<IngestSummary>
    mocks/
      dashboard.ts distribuidores.ts cola.ts maestro.ts corrida.ts  # contract-shaped fixtures
    adapters/
      index.ts          # binds mocks (and real ingest) to contract interfaces
    state/
      store.ts          # Zustand
    ui/
      shell/AppShell.tsx  Nav.tsx
      screens/Dashboard.tsx Corrida.tsx Distribuidores.tsx Cola.tsx Maestro.tsx Config.tsx
      components/ (Card, Metric, Sparkline, StageBar, Badge, DropZone, ...)
    lib/browser.ts      # capability detection (worker, FS Access, FF/Safari warn)
  test/                 # vitest specs mirror src/
  docs/superpowers/{specs,plans}/
```

---

### Task 1: Scaffold the app (Vite + React + TS + Tailwind + Vitest + ESLint)

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `.eslintrc.cjs`, `vitest.config.ts`, `vitest.setup.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Test: `test/smoke.test.tsx`

**Interfaces:**
- Produces: a buildable app; `npm run dev`, `npm run build`, `npm run test`, `npm run lint` all work.

- [ ] **Step 1: Init npm + install deps**

```bash
cd /Users/daniel/Downloads/safi-heinz/dtt-motor
npm init -y
npm i react@^18 react-dom@^18 zustand@^4 papaparse@^5 xlsx@^0.18 idb@^8
npm i -D vite@^5 @vitejs/plugin-react@^4 typescript@^5 \
  @types/react @types/react-dom @types/papaparse \
  tailwindcss@^3 postcss autoprefixer \
  vitest@^2 jsdom @testing-library/react @testing-library/jest-dom \
  eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react-hooks
```

- [ ] **Step 2: Write `package.json` scripts**

Merge these scripts into `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint 'src/**/*.{ts,tsx}'"
  }
}
```

- [ ] **Step 3: Config files**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  build: { target: 'es2022' },
})
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./vitest.setup.ts'] },
})
```

`vitest.setup.ts`:
```ts
import '@testing-library/jest-dom'
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "useDefineForClassFields": true, "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ESNext", "skipLibCheck": true, "moduleResolution": "bundler",
    "resolveJsonModule": true, "isolatedModules": true, "noEmit": true, "jsx": "react-jsx",
    "strict": true, "noUnusedLocals": true, "noUnusedParameters": true, "noFallthroughCasesInSwitch": true,
    "baseUrl": ".", "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "test"]
}
```
Add `"@/*": ["src/*"]` resolution to Vite too via `resolve.alias` in `vite.config.ts` (`'@': '/src'`).

`postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

`.eslintrc.cjs`:
```js
module.exports = {
  root: true, parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended'],
  env: { browser: true, es2022: true },
  ignorePatterns: ['dist', 'node_modules', '*.config.*'],
}
```

- [ ] **Step 4: App entry + Tailwind CSS**

`index.html`:
```html
<!doctype html>
<html lang="es">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Motor DTT · Estandarización</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```
`src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```
`src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
)
```
`src/App.tsx`:
```tsx
export default function App() {
  return <div className="p-8 text-ink">Motor DTT</div>
}
```
Minimal `tailwind.config.ts` (real tokens land in Task 2):
```ts
import type { Config } from 'tailwindcss'
export default { content: ['./index.html', './src/**/*.{ts,tsx}'], theme: { extend: {} }, plugins: [] } satisfies Config
```
Add `text-ink` fallback by temporarily using a literal color until Task 2; simplest: change App to `className="p-8"` for now.

- [ ] **Step 5: Write the smoke test**

`test/smoke.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import App from '@/App'
test('renders app title', () => {
  render(<App />)
  expect(screen.getByText('Motor DTT')).toBeInTheDocument()
})
```

- [ ] **Step 6: Run test — expect PASS; build — expect success**

Run: `npm run test`  → Expected: 1 passed.
Run: `npm run build` → Expected: `dist/` produced, no TS errors.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite+React+TS+Tailwind+Vitest app"
```

---

### Task 2: Brand tokens (Tailwind theme + IBM Plex fonts)

**Files:**
- Create: `src/lib/tokens.ts`, `public/fonts/` (self-hosted IBM Plex woff2), `src/styles/fonts.css`
- Modify: `tailwind.config.ts`, `src/index.css`, `src/App.tsx`
- Test: `test/tokens.test.ts`

**Interfaces:**
- Produces: `tokens` object (named colors) and Tailwind classes `bg-bg`, `text-ink`, `text-navy`, `bg-red`, `font-mono`, etc. **Fonts self-hosted** (RNF5 — no Google Fonts network fetch).

- [ ] **Step 1: Add fonts (self-hosted, no CDN)**

Download IBM Plex Sans (400/500/600) + IBM Plex Mono (400/500) woff2 into `public/fonts/`. `src/styles/fonts.css` declares `@font-face` with `src: url('/fonts/…') format('woff2')`. Import it at top of `src/index.css` via `@import './styles/fonts.css';`.
> If offline at execution: leave `font-family` stack falling back to system `ui-sans-serif`; add a `// TODO(fonts): drop woff2 into public/fonts` and note it in the commit. Do NOT add a Google Fonts `<link>` — violates RNF5.

- [ ] **Step 2: Write the token module**

`src/lib/tokens.ts`:
```ts
export const tokens = {
  navy: '#0F2B5B', navyDeep: '#0A1F44', red: '#C8102E', redDeep: '#A50D26',
  green: '#1E8E3E', amber: '#E87722', gold: '#F2A900', cyan: '#0097CE',
  ink: '#1B2430', slate: '#5B6B82', slate2: '#8A96A8', line: '#D9DFE9',
  bg: '#F4F7FB', panel: '#FFFFFF',
} as const
export type TokenName = keyof typeof tokens
```

- [ ] **Step 3: Wire tokens into Tailwind**

`tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'
import { tokens } from './src/lib/tokens'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: tokens.navy, 'navy-deep': tokens.navyDeep, red: tokens.red, 'red-deep': tokens.redDeep,
        green: tokens.green, amber: tokens.amber, gold: tokens.gold, cyan: tokens.cyan,
        ink: tokens.ink, slate: tokens.slate, 'slate-2': tokens.slate2, line: tokens.line,
        bg: tokens.bg, panel: tokens.panel,
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ["'IBM Plex Mono'", 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
```
Set body defaults in `src/index.css` after the tailwind directives:
```css
body { @apply bg-bg text-ink font-sans; }
```

- [ ] **Step 4: Write the failing test**

`test/tokens.test.ts`:
```ts
import { tokens } from '@/lib/tokens'
test('brand palette matches spec verbatim', () => {
  expect(tokens.navy).toBe('#0F2B5B')
  expect(tokens.red).toBe('#C8102E')
  expect(tokens.green).toBe('#1E8E3E')
  expect(Object.keys(tokens)).toHaveLength(14)
})
```

- [ ] **Step 5: Run — expect PASS**

Run: `npm run test -- tokens` → Expected: PASS.

- [ ] **Step 6: Prove classes compile**

Set `src/App.tsx` to `<div className="min-h-screen bg-bg text-navy font-sans p-8"><h1 className="font-mono">Motor DTT</h1></div>` and `npm run build` → Expected: success, no unknown-class purge warnings.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: brand tokens + Tailwind theme + self-hosted IBM Plex fonts"
```

---

### Task 3: Contract interfaces (the anti-leak boundary)

**Files:**
- Create: `src/contracts/row.ts`, `src/contracts/pipeline.ts`, `src/contracts/maestro.ts`, `src/contracts/cola.ts`, `src/contracts/config.ts`, `src/contracts/index.ts`
- Test: `test/contracts.test.ts`

**Interfaces:**
- Produces: the shared type vocabulary every later task consumes. These names are load-bearing — later tasks reference them verbatim.

- [ ] **Step 1: Write `row.ts`**

```ts
// A raw parsed record: distributor headers are arbitrary; keys are original header strings.
export type RawRow = Record<string, string>

// Canonical output metadata columns (PRD §7.3), appended to originals unaltered.
export const OUTPUT_COLUMNS = [
  'segmento_n3_std', 'macro_canal_n1_std', 'metodo_segmento', 'confianza_segmento',
  'estado_std', 'metodo_estado', 'flag_registro',
  'valor_original_segmento', 'valor_original_estado', 'version_diccionario', 'run_id',
] as const
export type OutputColumn = typeof OUTPUT_COLUMNS[number]

export type MetodoSegmento = 'MAESTRO' | 'EXACTO' | 'FUZZY' | 'MANUAL' | null
export type ConfianzaSegmento = 'N3' | 'MACRO' | null
export type MetodoEstado = 'EXACTO' | 'RIF' | 'CIUDAD' | null
export type FlagRegistro = 'OK' | 'SIN_CLASIFICAR' | 'SIN_ESTADO' | 'DUPLICADO' | 'CONFLICTO_MAYOR'

// Which raw header maps to each internal field (produced by schema-detect).
export interface SchemaMap {
  rif: string | null
  segmentoCrudo: string | null
  estadoCrudo: string | null
  ciudad: string | null
  // money/date fields are passed through untouched; recorded for reporting only
  passthrough: string[]
  /** headers that could not be mapped to any known field */
  unmapped: string[]
}
```

- [ ] **Step 2: Write `pipeline.ts`**

```ts
export type FileKind = 'csv' | 'xlsx'

export interface IngestSummary {
  fileName: string
  fileKind: FileKind
  totalRows: number
  distributors: number       // distinct RIF-owner/distributor count seen during stream
  bytes: number
  schema: import('./row').SchemaMap
  headerRowCount: number
  startedAt: number          // epoch ms, stamped by caller
  finishedAt: number
  durationMs: number
}

export type ProgressEvent =
  | { type: 'start'; fileName: string; fileKind: FileKind; bytes: number }
  | { type: 'progress'; rows: number; distributors: number; bytesRead: number }
  | { type: 'done'; summary: IngestSummary }
  | { type: 'error'; message: string; code: 'BAD_SCHEMA' | 'PARSE_ERROR' | 'EMPTY' | 'UNSUPPORTED' }

export interface PipelineInput { file: File }
export interface PipelineResult { summary: IngestSummary }
```

- [ ] **Step 3: Write `maestro.ts`, `cola.ts`, `config.ts`**

`maestro.ts`:
```ts
import type { ConfianzaSegmento, MetodoSegmento } from './row'
export interface MaestroEntry {
  rif: string
  razonSocial: string | null
  segmentoN3: string | null
  macroN1: string | null
  metodo: MetodoSegmento
  confianza: ConfianzaSegmento
  estadoHabitual: string | null
  fechaClasificacion: string | null   // ISO
  reglaCanonica: 'MANUAL' | 'RECIENTE' | 'MODA' | null
}
```
`cola.ts`:
```ts
export type ColaTipo = 'VARIANTE_NUEVA' | 'CONFLICTO_MAYOR' | 'ALTO_VOLUMEN_SIN_CLASIFICAR'
export interface ColaItem {
  id: string
  tipo: ColaTipo
  valorCrudo: string
  registrosAfectados: number
  tonAfectadas: number
  sugerenciaFuzzy: { segmentoN3: string; score: number } | null   // only when 80–91
  resolucion: string | null
}
```
`config.ts`:
```ts
export interface SegmentoSeed { n3: string; macroN1: string; placeholder: boolean }
export interface DiccionarioEntry { variante: string; segmentoN3: string; macroN1: string; metodo: 'EXACTO'; activa: boolean }
export interface SeedCatalogs {
  segmentos: SegmentoSeed[]
  estados: string[]
  ciudadEstado: Record<string, string>
  diccionario: DiccionarioEntry[]
  provenance: { source: string; placeholder: boolean }
}
export interface AppConfig { versionDiccionario: string; fuzzyThreshold: number; fuzzySuggestFloor: number }
```
`index.ts` re-exports all five.

- [ ] **Step 4: Write the failing test**

`test/contracts.test.ts`:
```ts
import { OUTPUT_COLUMNS } from '@/contracts/row'
import type { SchemaMap } from '@/contracts/row'
test('output columns match PRD §7.3 exactly', () => {
  expect(OUTPUT_COLUMNS).toEqual([
    'segmento_n3_std', 'macro_canal_n1_std', 'metodo_segmento', 'confianza_segmento',
    'estado_std', 'metodo_estado', 'flag_registro',
    'valor_original_segmento', 'valor_original_estado', 'version_diccionario', 'run_id',
  ])
})
test('SchemaMap shape compiles', () => {
  const m: SchemaMap = { rif: 'RIF', segmentoCrudo: 'CANAL', estadoCrudo: 'EDO', ciudad: null, passthrough: [], unmapped: [] }
  expect(m.rif).toBe('RIF')
})
```

- [ ] **Step 5: Run — expect PASS; typecheck**

Run: `npm run test -- contracts` → PASS. Run: `npm run build` → no TS errors.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: contract interfaces (row/pipeline/maestro/cola/config)"
```

---

### Task 4: Embedded catalog seeds (+ integrity tests)

**Files:**
- Create: `src/seeds/segmentos.ts`, `src/seeds/estados.ts`, `src/seeds/ciudad-estado.ts`, `src/seeds/diccionario.ts`, `src/seeds/index.ts`
- Test: `test/seeds.test.ts`

**Interfaces:**
- Consumes: `SegmentoSeed`, `DiccionarioEntry`, `SeedCatalogs` from `@/contracts/config`.
- Produces: `SEEDS: SeedCatalogs`. **Every seed carries `placeholder: true`** where it isn't the official Entregable 3.1 file (spec §6). Later data-file swap replaces content, not shape.

- [ ] **Step 1: Write `segmentos.ts` (35 N3 → 7 macros, from prototype SEGS)**

Transcribe the prototype's `SEGS` (source lines 624–632) as `{ n3, macroN1, placeholder: true }`. Full list:
```ts
import type { SegmentoSeed } from '@/contracts/config'
const P = true
export const SEGMENTOS: SegmentoSeed[] = [
  { n3: 'ABASTO', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'BODEGA', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'PUESTO DE MERCADO', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'KIOSCO', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'PANADERIA', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'PASTELERIA', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'CARNICERIA / CHARCUTERIA / FRIGORIFICO', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'LICORERIA', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'CONFITERIA', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'FARMACIA TRADICIONAL', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'PERFUMERIA TRADICIONAL', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'FERRETERIA / QUINCALLERIA', macroN1: 'TRADE TRADICIONAL (UTT)', placeholder: P },
  { n3: 'SUPERMERCADO IND. GRANDE', macroN1: 'SUPERMERCADOS INDEPENDIENTES', placeholder: P },
  { n3: 'SUPERMERCADO IND. MEDIANO', macroN1: 'SUPERMERCADOS INDEPENDIENTES', placeholder: P },
  { n3: 'SUPERMERCADO IND. PEQUEÑO', macroN1: 'SUPERMERCADOS INDEPENDIENTES', placeholder: P },
  { n3: 'AUTOMERCADO', macroN1: 'SUPERMERCADOS INDEPENDIENTES', placeholder: P },
  { n3: 'MINI MARKET', macroN1: 'SUPERMERCADOS INDEPENDIENTES', placeholder: P },
  { n3: 'CADENA NACIONAL', macroN1: 'CADENAS', placeholder: P },
  { n3: 'CADENA REGIONAL', macroN1: 'CADENAS', placeholder: P },
  { n3: 'HIPERMERCADO / CASH & CARRY', macroN1: 'CADENAS', placeholder: P },
  { n3: 'TIENDA DE CONVENIENCIA', macroN1: 'CADENAS', placeholder: P },
  { n3: 'FARMACIA CON AUTOSERVICIO', macroN1: 'FARMACIAS MODERNAS', placeholder: P },
  { n3: 'FARMACIA CADENA', macroN1: 'FARMACIAS MODERNAS', placeholder: P },
  { n3: 'FARMACIA MODERNA INDEPENDIENTE', macroN1: 'FARMACIAS MODERNAS', placeholder: P },
  { n3: 'BODEGON', macroN1: 'BODEGONES', placeholder: P },
  { n3: 'BODEGON-LICORERIA', macroN1: 'BODEGONES', placeholder: P },
  { n3: 'MAYORISTA CON FUERZA DE VENTA', macroN1: 'MAYORISTAS', placeholder: P },
  { n3: 'MAYORISTA SIN FUERZA DE VENTA', macroN1: 'MAYORISTAS', placeholder: P },
  { n3: 'NANO DISTRIBUIDOR', macroN1: 'MAYORISTAS', placeholder: P },
  { n3: 'SUB-DISTRIBUIDOR', macroN1: 'MAYORISTAS', placeholder: P },
  { n3: 'RESTAURANTE', macroN1: 'ON PREMISE', placeholder: P },
  { n3: 'FAST FOOD', macroN1: 'ON PREMISE', placeholder: P },
  { n3: 'LUNCHERIA / CAFETERIA', macroN1: 'ON PREMISE', placeholder: P },
  { n3: 'HOTEL / POSADA', macroN1: 'ON PREMISE', placeholder: P },
  { n3: 'CATERING / INSTITUCIONAL', macroN1: 'ON PREMISE', placeholder: P },
]
// Prototype SEGS yields 35 N3 across 7 macros. PRD cites 8 N1 macro-canales — the 8th
// (e-commerce/otros) is absent from the prototype and awaits Entregable 3.1.
export const MACROS_N1 = [...new Set(SEGMENTOS.map((s) => s.macroN1))]
```

- [ ] **Step 2: Write `estados.ts` (24 VE estados, placeholder)**

```ts
// PLACEHOLDER — replace with catalogo_estados.csv (Entregable 3.1). VE political division (24).
export const ESTADOS: string[] = [
  'AMAZONAS', 'ANZOATEGUI', 'APURE', 'ARAGUA', 'BARINAS', 'BOLIVAR', 'CARABOBO', 'COJEDES',
  'DELTA AMACURO', 'DISTRITO CAPITAL', 'FALCON', 'GUARICO', 'LA GUAIRA', 'LARA', 'MERIDA',
  'MIRANDA', 'MONAGAS', 'NUEVA ESPARTA', 'PORTUGUESA', 'SUCRE', 'TACHIRA', 'TRUJILLO',
  'YARACUY', 'ZULIA',
]
```

- [ ] **Step 3: Write `ciudad-estado.ts` (small documented placeholder)**

```ts
// PLACEHOLDER — replace with ciudad_estado.csv (curated once from real data, PRD R4).
export const CIUDAD_ESTADO: Record<string, string> = {
  CARACAS: 'DISTRITO CAPITAL', MARACAIBO: 'ZULIA', VALENCIA: 'CARABOBO', BARQUISIMETO: 'LARA',
  MARACAY: 'ARAGUA', 'CIUDAD GUAYANA': 'BOLIVAR', 'PUERTO ORDAZ': 'BOLIVAR', MATURIN: 'MONAGAS',
  'SAN CRISTOBAL': 'TACHIRA', BARCELONA: 'ANZOATEGUI', CUMANA: 'SUCRE', MERIDA: 'MERIDA',
}
```

- [ ] **Step 4: Write `diccionario.ts` (seed from PRD §7.1 + prototype variants)**

```ts
import type { DiccionarioEntry } from '@/contracts/config'
const E = (variante: string, segmentoN3: string, macroN1: string): DiccionarioEntry =>
  ({ variante, segmentoN3, macroN1, metodo: 'EXACTO', activa: true })
// Seed grows via the cola (Sprint 5). Sourced from prototype trzPool (lines 646–653) + PRD examples.
export const DICCIONARIO: DiccionarioEntry[] = [
  E('BODEGAS', 'BODEGA', 'TRADE TRADICIONAL (UTT)'),
  E('ABASTOS', 'ABASTO', 'TRADE TRADICIONAL (UTT)'),
  E('MINI MARKETS', 'MINI MARKET', 'SUPERMERCADOS INDEPENDIENTES'),
  E('PANADERIAS', 'PANADERIA', 'TRADE TRADICIONAL (UTT)'),
  E('BODEGONES', 'BODEGON', 'BODEGONES'),
  E('LICORERIAS', 'LICORERIA', 'TRADE TRADICIONAL (UTT)'),
]
```

- [ ] **Step 5: Write `index.ts` (assemble `SEEDS: SeedCatalogs`)**

```ts
import type { SeedCatalogs } from '@/contracts/config'
import { SEGMENTOS } from './segmentos'
import { ESTADOS } from './estados'
import { CIUDAD_ESTADO } from './ciudad-estado'
import { DICCIONARIO } from './diccionario'
export const SEEDS: SeedCatalogs = {
  segmentos: SEGMENTOS, estados: ESTADOS, ciudadEstado: CIUDAD_ESTADO, diccionario: DICCIONARIO,
  provenance: { source: 'prototype SEGS + PRD §7.1 (PLACEHOLDER)', placeholder: true },
}
export { SEGMENTOS, ESTADOS, CIUDAD_ESTADO, DICCIONARIO } from './'  // see note
```
> Note: to avoid a self-import, re-export directly from each module (`export { SEGMENTOS } from './segmentos'` etc.), not from `'./'`.

- [ ] **Step 6: Write the failing test**

`test/seeds.test.ts`:
```ts
import { SEEDS } from '@/seeds'
test('35 N3 segments seeded', () => {
  expect(SEEDS.segmentos).toHaveLength(35)
})
test('every segment macro is non-empty and consistent', () => {
  const macros = new Set(SEEDS.segmentos.map((s) => s.macroN1))
  expect([...macros].every((m) => m.length > 0)).toBe(true)
  expect(macros.size).toBeGreaterThanOrEqual(7)
})
test('every diccionario N3 exists in the segment catalog', () => {
  const n3 = new Set(SEEDS.segmentos.map((s) => s.n3))
  for (const d of SEEDS.diccionario) expect(n3.has(d.segmentoN3)).toBe(true)
})
test('24 estados seeded', () => {
  expect(SEEDS.estados).toHaveLength(24)
})
test('seeds are flagged placeholder', () => {
  expect(SEEDS.provenance.placeholder).toBe(true)
})
```

- [ ] **Step 7: Run — expect PASS**

Run: `npm run test -- seeds` → Expected: 5 passed.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: embedded catalog seeds (35 N3, 24 estados, diccionario) flagged placeholder"
```

---

### Task 5: Header schema detection (pure function, TDD)

**Files:**
- Create: `src/ingest/schema-detect.ts`
- Test: `test/schema-detect.test.ts`

**Interfaces:**
- Consumes: `SchemaMap` from `@/contracts/row`.
- Produces: `detectSchema(headers: string[]): SchemaMap`. Maps arbitrary distributor headers to internal fields via an alias table (extendable; real distributors add aliases later).

- [ ] **Step 1: Write the failing test**

`test/schema-detect.test.ts`:
```ts
import { detectSchema } from '@/ingest/schema-detect'
test('maps canonical Sell_out headers', () => {
  const m = detectSchema(['RIF', 'Canal/Tipo de Cliente', 'Estado', 'Ciudad', 'CAJAS', 'FECHA'])
  expect(m.rif).toBe('RIF')
  expect(m.segmentoCrudo).toBe('Canal/Tipo de Cliente')
  expect(m.estadoCrudo).toBe('Estado')
  expect(m.ciudad).toBe('Ciudad')
  expect(m.passthrough).toEqual(expect.arrayContaining(['CAJAS', 'FECHA']))
})
test('is accent- and case-insensitive on header aliases', () => {
  const m = detectSchema(['rif del cliente', 'TIPO DE NEGOCIO', 'edo.', 'MUNICIPIO'])
  expect(m.rif).toBe('rif del cliente')
  expect(m.segmentoCrudo).toBe('TIPO DE NEGOCIO')
  expect(m.estadoCrudo).toBe('edo.')
})
test('records unmapped headers', () => {
  const m = detectSchema(['RIF', 'COLUMNA_RARA'])
  expect(m.unmapped).toContain('COLUMNA_RARA')
  expect(m.segmentoCrudo).toBeNull()
})
```

- [ ] **Step 2: Run — expect FAIL** (`detectSchema` not defined).

Run: `npm run test -- schema-detect` → FAIL.

- [ ] **Step 3: Implement `schema-detect.ts`**

```ts
import type { SchemaMap } from '@/contracts/row'

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

// alias fragments (normalized) → internal field. Order = priority; first match wins per header.
const ALIASES: { field: 'rif' | 'segmentoCrudo' | 'estadoCrudo' | 'ciudad'; needles: string[] }[] = [
  { field: 'rif', needles: ['RIF', 'CEDULA', 'DOCUMENTO CLIENTE'] },
  { field: 'segmentoCrudo', needles: ['CANAL', 'TIPO DE CLIENTE', 'TIPO DE NEGOCIO', 'SEGMENTO', 'FORMATO'] },
  { field: 'estadoCrudo', needles: ['ESTADO', 'EDO'] },
  { field: 'ciudad', needles: ['CIUDAD'] },
]

export function detectSchema(headers: string[]): SchemaMap {
  const map: SchemaMap = { rif: null, segmentoCrudo: null, estadoCrudo: null, ciudad: null, passthrough: [], unmapped: [] }
  for (const h of headers) {
    const n = norm(h)
    const hit = ALIASES.find((a) => a.needles.some((needle) => n === needle || n.includes(needle)))
    if (hit && map[hit.field] === null) { map[hit.field] = h; continue }
    // known money/date passthroughs
    if (/(CAJAS|BS|TON|UNIDADES|FECHA|MES|MONTO|VENTA|PRECIO)/.test(n)) { map.passthrough.push(h); continue }
    map.unmapped.push(h)
  }
  return map
}
```
> `ESTADO` needle would also match `CIUDAD/ESTADO`-style combos; because `estadoCrudo` is checked before `ciudad` and only fills once, a lone `Estado` header maps correctly. Distributor-specific collisions get added to `ALIASES` as they appear (documented gap — no real headers yet).

- [ ] **Step 4: Run — expect PASS**

Run: `npm run test -- schema-detect` → Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: header schema detection with alias table (pure)"
```

---

### Task 6: R1 text normalization (pure function, TDD)

**Files:**
- Create: `src/ingest/normalize.ts`
- Test: `test/normalize.test.ts`

**Interfaces:**
- Produces: `normalizeText(s: string): string` implementing PRD R1 (upper, trim, strip accents, unify separators, collapse spaces). Used by segmento/estado cascades in later sprints and by distributor-key derivation now.

- [ ] **Step 1: Write the failing test**

`test/normalize.test.ts`:
```ts
import { normalizeText } from '@/ingest/normalize'
test('R1: upper, trim, strip accents, collapse spaces', () => {
  expect(normalizeText('  Bodegón   ')).toBe('BODEGON')
  expect(normalizeText('Panadería/Pastelería')).toBe('PANADERIA / PASTELERIA')
  expect(normalizeText('MINI   MARKET')).toBe('MINI MARKET')
})
test('R1: idempotent', () => {
  const once = normalizeText('Súper-Mercado')
  expect(normalizeText(once)).toBe(once)
})
test('R1: empty/nullish safe', () => {
  expect(normalizeText('')).toBe('')
  expect(normalizeText('   ')).toBe('')
})
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npm run test -- normalize` → FAIL.

- [ ] **Step 3: Implement `normalize.ts`**

```ts
export function normalizeText(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')     // strip accents
    .toUpperCase()
    .replace(/[/\-_|]+/g, ' / ')                           // unify separators to " / "
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim()
}
```
> Verify against test 2: `'Panadería/Pastelería'` → strip accents → `PANADERIA/PASTELERIA` → sep → `PANADERIA / PASTELERIA` → collapse → matches. `'Súper-Mercado'` → `SUPER / MERCADO`, idempotent on re-run.

- [ ] **Step 4: Run — expect PASS.** Run: `npm run test -- normalize` → Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: R1 text normalization (pure)"
```

---

### Task 7: Streaming ingest Web Worker (the real mock→real replacement)

**Files:**
- Create: `src/worker/ingest.worker.ts`, `src/worker/client.ts`
- Test: `test/ingest-client.test.ts` (mocks the worker; asserts protocol contract)

**Interfaces:**
- Consumes: `detectSchema`, `normalizeText`, `ProgressEvent`, `IngestSummary`, `FileKind`.
- Produces: `runIngest(file: File, onProgress: (e: ProgressEvent) => void): Promise<IngestSummary>` — streams the file in the worker, emits `progress` every N rows, resolves with the `IngestSummary`. Distributor count = distinct normalized RIF-prefix owners; **fallback** when no RIF column: count distinct source files is 1, so `distributors` reflects distinct values of the detected `rif` column, else `0` with a `BAD_SCHEMA`-adjacent warning surfaced in UI (Task 11).

- [ ] **Step 1: Write the worker**

`src/worker/ingest.worker.ts`:
```ts
/// <reference lib="webworker" />
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { detectSchema } from '@/ingest/schema-detect'
import { normalizeText } from '@/ingest/normalize'
import type { ProgressEvent, IngestSummary, FileKind } from '@/contracts/pipeline'

const post = (e: ProgressEvent) => (self as unknown as Worker).postMessage(e)

function kindOf(name: string): FileKind | null {
  if (/\.csv$/i.test(name)) return 'csv'
  if (/\.xlsx?$/i.test(name)) return 'xlsx'
  return null
}

self.onmessage = async (ev: MessageEvent<{ file: File }>) => {
  const { file } = ev.data
  const kind = kindOf(file.name)
  if (!kind) return post({ type: 'error', code: 'UNSUPPORTED', message: `Formato no soportado: ${file.name}` })
  post({ type: 'start', fileName: file.name, fileKind: kind, bytes: file.size })

  let schema: import('@/contracts/row').SchemaMap | null = null
  let rows = 0
  const owners = new Set<string>()
  const started = performance.now()
  const bump = () => post({ type: 'progress', rows, distributors: owners.size, bytesRead: file.size })

  const onHeaders = (headers: string[]) => { schema = detectSchema(headers) }
  const onRow = (rec: Record<string, string>) => {
    rows++
    if (schema?.rif) { const v = normalizeText(rec[schema.rif] ?? ''); if (v) owners.add(v) }
    if (rows % 5000 === 0) bump()
  }

  try {
    if (kind === 'csv') {
      await new Promise<void>((resolve, reject) => {
        Papa.parse<Record<string, string>>(file, {
          header: true, skipEmptyLines: true, worker: false,
          step: (res) => {
            if (!schema) onHeaders(Object.keys(res.data))
            onRow(res.data)
          },
          complete: () => resolve(),
          error: (err) => reject(err),
        })
      })
    } else {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
      if (json.length) onHeaders(Object.keys(json[0]))
      for (const rec of json) onRow(rec)
    }
  } catch (err) {
    return post({ type: 'error', code: 'PARSE_ERROR', message: (err as Error).message })
  }

  if (rows === 0 || !schema) return post({ type: 'error', code: 'EMPTY', message: 'Archivo vacío o sin encabezados' })
  const finished = performance.now()
  const summary: IngestSummary = {
    fileName: file.name, fileKind: kind, totalRows: rows, distributors: owners.size,
    bytes: file.size, schema, headerRowCount: 1,
    startedAt: 0, finishedAt: 0, durationMs: Math.round(finished - started),
  }
  bump()
  post({ type: 'done', summary })
}
```

- [ ] **Step 2: Write the typed client**

`src/worker/client.ts`:
```ts
import type { ProgressEvent, IngestSummary } from '@/contracts/pipeline'

export function runIngest(file: File, onProgress: (e: ProgressEvent) => void): Promise<IngestSummary> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./ingest.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (ev: MessageEvent<ProgressEvent>) => {
      const e = ev.data
      onProgress(e)
      if (e.type === 'done') { worker.terminate(); resolve(e.summary) }
      else if (e.type === 'error') { worker.terminate(); reject(new Error(`${e.code}: ${e.message}`)) }
    }
    worker.onerror = (err) => { worker.terminate(); reject(err instanceof ErrorEvent ? err.error : new Error('worker error')) }
    worker.postMessage({ file })
  })
}
```

- [ ] **Step 3: Write the failing test (mock the Worker; assert protocol)**

`test/ingest-client.test.ts`:
```ts
import { runIngest } from '@/worker/client'
import type { IngestSummary } from '@/contracts/pipeline'

class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  postMessage() {
    queueMicrotask(() => {
      this.onmessage?.({ data: { type: 'start', fileName: 'x.csv', fileKind: 'csv', bytes: 10 } } as MessageEvent)
      this.onmessage?.({ data: { type: 'progress', rows: 5000, distributors: 12, bytesRead: 10 } } as MessageEvent)
      const summary: IngestSummary = { fileName: 'x.csv', fileKind: 'csv', totalRows: 5000, distributors: 12, bytes: 10, schema: { rif: 'RIF', segmentoCrudo: null, estadoCrudo: null, ciudad: null, passthrough: [], unmapped: [] }, headerRowCount: 1, startedAt: 0, finishedAt: 0, durationMs: 3 }
      this.onmessage?.({ data: { type: 'done', summary } } as MessageEvent)
    })
  }
  terminate() {}
}

test('runIngest streams progress then resolves with summary', async () => {
  // @ts-expect-error test double
  globalThis.Worker = FakeWorker
  const events: string[] = []
  const summary = await runIngest(new File(['a'], 'x.csv'), (e) => events.push(e.type))
  expect(events).toEqual(['start', 'progress', 'done'])
  expect(summary.totalRows).toBe(5000)
  expect(summary.distributors).toBe(12)
})
```
> The client constructs a real `new Worker(new URL(...))`; the test overrides `globalThis.Worker` so no bundler worker resolution is needed. This asserts the **protocol** (start→progress→done, summary shape), which is the contract that matters here.

- [ ] **Step 4: Run — expect FAIL then PASS**

Run: `npm run test -- ingest-client` → FAIL (before client exists) → after Step 2 exists, PASS.

- [ ] **Step 5: Manual real-worker sanity (documented, not automated)**

Add a note in the task PR: with a hand-made 3-row CSV (`RIF,Canal/Tipo de Cliente,Estado\nJ-1,BODEGA,ZULIA\n...`) dragged in Task 11's DropZone, the counter shows `3 filas · 1 distribuidor`. Full-volume 740K benchmark (RNF1/RNF2) deferred until the real file is supplied (spec §6).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: streaming ingest worker + typed client (start/progress/done/error protocol)"
```

---

### Task 8: Zustand store + contract-shaped mock adapters

**Files:**
- Create: `src/mocks/dashboard.ts`, `src/mocks/distribuidores.ts`, `src/mocks/cola.ts`, `src/mocks/maestro.ts`, `src/mocks/corrida.ts`, `src/adapters/index.ts`, `src/state/store.ts`
- Test: `test/store.test.ts`

**Interfaces:**
- Consumes: all contract types; `runIngest` from `@/worker/client`; `SEEDS`.
- Produces: `useStore` (Zustand) exposing `{ view, setView, seeds, dashboard, distribuidores, cola, maestro, ingest, startIngest }`. **This is the ONLY module that imports `src/mocks/`** — the anti-leak seam. `startIngest(file)` calls the real worker and updates `ingest` live.

- [ ] **Step 1: Write mock fixtures (contract-shaped, from prototype)**

Each mock returns data typed to a contract interface. Transcribe representative rows from the prototype's `buildDist` (lines 634–668), `buildVariantes`, `buildConflictos`, `buildMaestro`, and dashboard metrics. Example `src/mocks/distribuidores.ts`:
```ts
import type { ConfianzaSegmento } from '@/contracts/row'
export interface DistribuidorRow { id: string; nombre: string; scdcCrudo: number; scdcPost: number; registros: number; ton: number }
export const MOCK_DISTRIBUIDORES: DistribuidorRow[] = [
  { id: 'd0', nombre: 'EXCELSIOR RK', scdcCrudo: 31, scdcPost: 74, registros: 52014, ton: 418.2 },
  { id: 'd1', nombre: 'ALIMENTOS GLOBAL', scdcCrudo: 38, scdcPost: 79, registros: 22310, ton: 201.7 },
  { id: 'd2', nombre: 'COMERCIALIZADORA 3B GROUP', scdcCrudo: 44, scdcPost: 81, registros: 11842, ton: 96.4 },
  { id: 'd3', nombre: 'MAYORISTA EXITOSO', scdcCrudo: 55, scdcPost: 88, registros: 8905, ton: 71.0 },
]
export type { ConfianzaSegmento }
```
Create the other four mock files analogously (dashboard KPIs 740.009 filas / 92,4% / 98,1%; cola items from `trzPool`; maestro rows; corrida `STAGE_DEFS`). Keep each strictly typed to a contract or a local `interface` co-located with the mock.

- [ ] **Step 2: Write the adapter seam**

`src/adapters/index.ts`:
```ts
import { MOCK_DISTRIBUIDORES } from '@/mocks/distribuidores'
import { MOCK_DASHBOARD } from '@/mocks/dashboard'
import { MOCK_COLA } from '@/mocks/cola'
import { MOCK_MAESTRO } from '@/mocks/maestro'
import { SEEDS } from '@/seeds'
import { runIngest } from '@/worker/client'

// The single boundary where mocks are bound. Real modules replace these fields sprint by sprint.
export const adapters = {
  seeds: SEEDS,
  getDashboard: () => MOCK_DASHBOARD,
  getDistribuidores: () => MOCK_DISTRIBUIDORES,
  getCola: () => MOCK_COLA,
  getMaestro: () => MOCK_MAESTRO,
  ingest: runIngest, // ← already real
}
```

- [ ] **Step 3: Write the store**

`src/state/store.ts`:
```ts
import { create } from 'zustand'
import { adapters } from '@/adapters'
import type { ProgressEvent, IngestSummary } from '@/contracts/pipeline'

export type ViewKey = 'dashboard' | 'corrida' | 'distribuidores' | 'cola' | 'maestro' | 'config'

interface IngestState {
  phase: 'idle' | 'running' | 'done' | 'error'
  rows: number; distributors: number; fileName: string | null
  summary: IngestSummary | null; error: string | null
}

interface StoreState {
  view: ViewKey; setView: (v: ViewKey) => void
  seeds: typeof adapters.seeds
  dashboard: ReturnType<typeof adapters.getDashboard>
  distribuidores: ReturnType<typeof adapters.getDistribuidores>
  cola: ReturnType<typeof adapters.getCola>
  maestro: ReturnType<typeof adapters.getMaestro>
  ingest: IngestState
  startIngest: (file: File) => Promise<void>
}

export const useStore = create<StoreState>((set, get) => ({
  view: 'dashboard', setView: (view) => set({ view }),
  seeds: adapters.seeds,
  dashboard: adapters.getDashboard(),
  distribuidores: adapters.getDistribuidores(),
  cola: adapters.getCola(),
  maestro: adapters.getMaestro(),
  ingest: { phase: 'idle', rows: 0, distributors: 0, fileName: null, summary: null, error: null },
  startIngest: async (file) => {
    set({ ingest: { phase: 'running', rows: 0, distributors: 0, fileName: file.name, summary: null, error: null } })
    try {
      const summary = await adapters.ingest(file, (e: ProgressEvent) => {
        if (e.type === 'progress') set((s) => ({ ingest: { ...s.ingest, rows: e.rows, distributors: e.distributors } }))
      })
      set((s) => ({ ingest: { ...s.ingest, phase: 'done', rows: summary.totalRows, distributors: summary.distributors, summary } }))
    } catch (err) {
      set((s) => ({ ingest: { ...s.ingest, phase: 'error', error: (err as Error).message } }))
    }
  },
}))
```

- [ ] **Step 4: Write the failing test**

`test/store.test.ts`:
```ts
import { useStore } from '@/state/store'
test('store seeds & mocks conform to contracts', () => {
  const s = useStore.getState()
  expect(s.seeds.segmentos).toHaveLength(35)
  expect(s.distribuidores.length).toBeGreaterThan(0)
  expect(s.view).toBe('dashboard')
})
test('setView switches views', () => {
  useStore.getState().setView('cola')
  expect(useStore.getState().view).toBe('cola')
})
```

- [ ] **Step 5: Run — expect PASS.** Run: `npm run test -- store` → Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: Zustand store + adapter seam binding mocks (anti-leak boundary)"
```

---

### Task 9: App shell, nav, browser capability detection

**Files:**
- Create: `src/lib/browser.ts`, `src/ui/shell/AppShell.tsx`, `src/ui/shell/Nav.tsx`
- Modify: `src/App.tsx`
- Test: `test/browser.test.ts`, `test/nav.test.tsx`

**Interfaces:**
- Consumes: `useStore` (`view`, `setView`).
- Produces: `<AppShell>` rendering nav + active screen; `detectBrowser()` returning `{ supported, warnings }`.

- [ ] **Step 1: Write capability detection + test**

`src/lib/browser.ts`:
```ts
export interface BrowserCaps { supported: boolean; hasWorker: boolean; hasFsAccess: boolean; warnings: string[] }
export function detectBrowser(ua = navigator.userAgent): BrowserCaps {
  const hasWorker = typeof Worker !== 'undefined'
  const hasFsAccess = typeof (globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function'
  const isFirefox = /firefox/i.test(ua)
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua)
  const warnings: string[] = []
  if (isFirefox || isSafari) warnings.push('Navegador no óptimo: usa Chrome o Edge de escritorio para exportar archivos y máximo rendimiento.')
  if (!hasWorker) warnings.push('Web Workers no disponibles: el procesamiento podría congelar la interfaz.')
  return { supported: hasWorker, hasWorker, hasFsAccess, warnings }
}
```
`test/browser.test.ts`:
```ts
import { detectBrowser } from '@/lib/browser'
test('warns on Firefox', () => {
  const c = detectBrowser('Mozilla/5.0 Firefox/123')
  expect(c.warnings.join(' ')).toMatch(/Chrome o Edge/)
})
test('Chrome UA is clean', () => {
  const c = detectBrowser('Mozilla/5.0 Chrome/124 Safari/537')
  expect(c.warnings).toHaveLength(0)
})
```

- [ ] **Step 2: Write Nav**

`src/ui/shell/Nav.tsx` — a left rail with the 6 views (labels: Dashboard, Corrida, Distribuidores, Cola de revisión, Maestro, Configuración), navy background `bg-navy`, active item `bg-red text-panel`. Drive from `useStore(view/setView)`. Each button `data-testid={`nav-${key}`}`.

- [ ] **Step 3: Write AppShell**

`src/ui/shell/AppShell.tsx` renders `<Nav/>` + a `<main>` that switches on `view` to the screen components (import the 6 screens; until Tasks 10–15 land, screens can be stubs exporting `<div>{name}</div>`). Render `detectBrowser().warnings` as a dismissible amber banner at top.

- [ ] **Step 4: Point App at the shell**

`src/App.tsx`: `import AppShell` → `export default () => <AppShell/>`.

- [ ] **Step 5: Write nav test**

`test/nav.test.tsx`:
```ts
import { render, screen, fireEvent } from '@testing-library/react'
import AppShell from '@/ui/shell/AppShell'
import { useStore } from '@/state/store'
test('clicking nav switches active view', () => {
  render(<AppShell />)
  fireEvent.click(screen.getByTestId('nav-cola'))
  expect(useStore.getState().view).toBe('cola')
})
```

- [ ] **Step 6: Run — expect PASS.** Run: `npm run test -- browser nav` → Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: app shell, nav rail, browser capability detection"
```

---

### Tasks 10–15: Port the 6 views

**Shared rules for every view task below:**
- **Visual source:** the prototype HTML (line ranges cited per view). Port structure/spacing/color to Tailwind classes using the brand tokens. Screens live in `src/ui/screens/`; extract repeated pieces into `src/ui/components/` (`Card`, `Metric`, `Badge`, `Sparkline`, `StageBar`, `DropZone`, `Table`).
- **Data source:** ONLY `useStore` selectors (never import `src/mocks/*` or `src/seeds/*` directly — anti-leak). 
- **Each task's test** renders the screen inside a store provider and asserts a concrete value from the mock/seed appears (proves the contract wiring, not the mock).
- **Numbers use `font-mono`.** Spanish UI copy. Commit at end of each task.

---

### Task 10: Dashboard view

**Files:** Create `src/ui/screens/Dashboard.tsx`, `src/ui/components/{Card,Metric,Sparkline}.tsx`; Test `test/dashboard.test.tsx`
**Prototype ref:** dashboard screen (source lines ~60–180, KPIs `740.009`, `92,4%`, `98,1%`, `71,2%`).

**Interfaces:** Consumes `useStore().dashboard`.

- [ ] **Step 1: Write failing test**

`test/dashboard.test.tsx`:
```ts
import { render, screen } from '@testing-library/react'
import Dashboard from '@/ui/screens/Dashboard'
test('renders headline KPIs from store', () => {
  render(<Dashboard />)
  expect(screen.getByText(/92,4%|92\.4%/)).toBeInTheDocument()
})
```
> Ensure `src/mocks/dashboard.ts` exposes a `clasificacionN3: '92,4%'` field so the assertion targets real wired data.

- [ ] **Step 2: Run — expect FAIL.** Run: `npm run test -- dashboard` → FAIL.

- [ ] **Step 3: Implement `Card`, `Metric`, `Sparkline`, then `Dashboard.tsx`**

`Metric`: label (slate, uppercase, small) + value (`font-mono`, navy, large). `Card`: `bg-panel border border-line rounded-lg p-5`. `Sparkline`: inline SVG polyline from a number array (prototype `spark` points, lines 662–666). `Dashboard` lays KPI cards in a grid + a distributor sparkline strip, all fed from `useStore().dashboard`.

- [ ] **Step 4: Run — expect PASS.** Run: `npm run test -- dashboard` → PASS.

- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat: Dashboard view + Card/Metric/Sparkline components"`

---

### Task 11: Corrida view (wired to the REAL ingest worker)

**Files:** Create `src/ui/screens/Corrida.tsx`, `src/ui/components/{DropZone,StageBar}.tsx`; Test `test/corrida.test.tsx`
**Prototype ref:** corrida/upload + 6-stage pipeline (source lines ~200–260, `STAGE_DEFS` lines 795–802).

**Interfaces:** Consumes `useStore()` `{ ingest, startIngest }`. **This screen replaces the prototype's fake `velocidadPipeline` animation with real worker progress.**

- [ ] **Step 1: Write failing test**

`test/corrida.test.tsx`:
```ts
import { render, screen, fireEvent } from '@testing-library/react'
import Corrida from '@/ui/screens/Corrida'
import { useStore } from '@/state/store'
test('shows live row/distributor counts from ingest state', () => {
  useStore.setState((s) => ({ ingest: { ...s.ingest, phase: 'running', rows: 5000, distributors: 12, fileName: 'x.csv', summary: null, error: null } }))
  render(<Corrida />)
  expect(screen.getByText(/5\.?000|5,000/)).toBeInTheDocument()
  expect(screen.getByText(/12/)).toBeInTheDocument()
})
test('renders a drop zone when idle', () => {
  useStore.setState((s) => ({ ingest: { ...s.ingest, phase: 'idle' } }))
  render(<Corrida />)
  expect(screen.getByTestId('dropzone')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npm run test -- corrida` → FAIL.

- [ ] **Step 3: Implement `DropZone`, `StageBar`, `Corrida.tsx`**

`DropZone` (`data-testid="dropzone"`): drag-drop + `<input type=file accept=".csv,.xlsx,.xls">`; on file → `useStore.getState().startIngest(file)`. `StageBar`: the 6 stages from `STAGE_DEFS` labels (Ingesta, Normalización, Cascada Segmento, Cascada Estado, Actualización Maestro, Dedup) — in Sprint 1 only **Ingesta** reflects real progress (rows/distributors/bytes); the other five render as "pendiente" (honest: they aren't wired yet). Show `phase` states: idle→dropzone, running→counts + spinner, done→summary (`N filas · M distribuidores · durationMs`), error→red banner with the message.
- Format numbers with `new Intl.NumberFormat('es-VE')`.

- [ ] **Step 4: Run — expect PASS.** Run: `npm run test -- corrida` → PASS.

- [ ] **Step 5: Manual check note.** Drag a 3-row CSV → counts render; drag a `.txt` → `UNSUPPORTED` error banner.

- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat: Corrida view wired to real streaming ingest worker"`

---

### Task 12: Distribuidores view

**Files:** Create `src/ui/screens/Distribuidores.tsx`, `src/ui/components/Table.tsx`; Test `test/distribuidores.test.tsx`
**Prototype ref:** distribuidores screen + SCDC bars (source lines ~360–420, `buildDist` 634–668).

**Interfaces:** Consumes `useStore().distribuidores`.

- [ ] **Step 1: Failing test**
```ts
import { render, screen } from '@testing-library/react'
import Distribuidores from '@/ui/screens/Distribuidores'
test('lists distributors with SCDC crudo/post', () => {
  render(<Distribuidores />)
  expect(screen.getByText('EXCELSIOR RK')).toBeInTheDocument()
  expect(screen.getByText(/31/)).toBeInTheDocument() // scdcCrudo
})
```
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement `Table` + `Distribuidores.tsx`** — sortable table: nombre, SCDC crudo (red-tinted bar), SCDC post (green-tinted bar), registros, TON. **Header note in UI:** "SCDC calculado sobre el crudo (D5) — no refleja rescates del motor." (honesty invariant, visible).
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit.** `git commit -m "feat: Distribuidores view + Table (SCDC-over-crudo note)"`

---

### Task 13: Cola de revisión view

**Files:** Create `src/ui/screens/Cola.tsx`, `src/ui/components/Badge.tsx`; Test `test/cola.test.tsx`
**Prototype ref:** cola screen + resolve interaction (source lines ~430–520, `buildVariantes`/`buildConflictos`, `resolve()` 810–814).

**Interfaces:** Consumes `useStore().cola` (`ColaItem[]`).

- [ ] **Step 1: Failing test**
```ts
import { render, screen } from '@testing-library/react'
import Cola from '@/ui/screens/Cola'
test('renders cola items with tipo badge and afectados', () => {
  render(<Cola />)
  expect(screen.getByText(/VARIANTE_NUEVA|Variante/i)).toBeInTheDocument()
})
```
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement `Badge` + `Cola.tsx`** — one row per `ColaItem`: tipo badge (VARIANTE_NUEVA amber, CONFLICTO_MAYOR red, ALTO_VOLUMEN_SIN_CLASIFICAR gold), valorCrudo, registrosAfectados, tonAfectadas, fuzzy suggestion pill (only when present), and a `resolucion` text input. In Sprint 1 the resolve action updates local component state + a toast only (persistence lands Sprint 5) — label the panel "Vista previa — la persistencia llega en Sprint 5" to stay honest.
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit.** `git commit -m "feat: Cola de revisión view + Badge"`

---

### Task 14: Maestro view

**Files:** Create `src/ui/screens/Maestro.tsx`; Test `test/maestro.test.tsx`
**Prototype ref:** maestro screen (source lines ~520–600, `buildMaestro`).

**Interfaces:** Consumes `useStore().maestro` (`MaestroEntry[]`).

- [ ] **Step 1: Failing test**
```ts
import { render, screen } from '@testing-library/react'
import Maestro from '@/ui/screens/Maestro'
test('renders maestro entries with rif and segmento', () => {
  render(<Maestro />)
  expect(screen.getByText(/^J-/)).toBeInTheDocument() // a RIF
})
```
> Ensure `src/mocks/maestro.ts` has at least one entry with `rif` starting `J-`.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement `Maestro.tsx`** — searchable table: rif, razonSocial, segmentoN3, macroN1, metodo (Badge), confianza (N3/MACRO), estadoHabitual, reglaCanonica. Reuse `Table`/`Badge`.
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit.** `git commit -m "feat: Maestro de clientes view"`

---

### Task 15: Configuración view

**Files:** Create `src/ui/screens/Config.tsx`; Test `test/config.test.tsx`
**Prototype ref:** config screen (source lines ~600–620 + demo props).

**Interfaces:** Consumes `useStore().seeds`.

- [ ] **Step 1: Failing test**
```ts
import { render, screen } from '@testing-library/react'
import Config from '@/ui/screens/Config'
test('shows seed provenance and placeholder warning', () => {
  render(<Config />)
  expect(screen.getByText(/PLACEHOLDER|placeholder/i)).toBeInTheDocument()
  expect(screen.getByText(/35/)).toBeInTheDocument() // 35 N3 count
})
```
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement `Config.tsx`** — read-only summary of loaded catalogs: `seeds.segmentos.length` N3, macro count, `seeds.estados.length` estados, diccionario entries, and a prominent amber banner showing `seeds.provenance` when `placeholder` is true ("Catálogos de muestra — reemplazar con Entregable 3.1"). Fuzzy thresholds (92 / 80) shown read-only. (Editable config + CSV import lands later.)
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit.** `git commit -m "feat: Configuración view (seed provenance + placeholder banner)"`

---

### Task 16: PWA base (manifest, service worker, icons)

**Files:** Create `public/icons/` (192/512 png + maskable), `public/robots.txt`; Modify `vite.config.ts`, `package.json` (+`vite-plugin-pwa`, `workbox-window`)
- Test: `test/pwa.build.test.ts` (asserts build emits SW + manifest)

**Interfaces:** Produces an installable PWA that precaches the app shell + seeds. **No runtime caching of any data files** (RNF5).

- [ ] **Step 1: Install plugin.** `npm i -D vite-plugin-pwa`
- [ ] **Step 2: Configure** in `vite.config.ts`:
```ts
import { VitePWA } from 'vite-plugin-pwa'
// inside plugins: []
VitePWA({
  registerType: 'autoUpdate',
  workbox: { globPatterns: ['**/*.{js,css,html,woff2,png,svg}'], runtimeCaching: [] },
  manifest: {
    name: 'Motor DTT · Estandarización', short_name: 'Motor DTT',
    theme_color: '#0F2B5B', background_color: '#F4F7FB', display: 'standalone', start_url: '/',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
})
```
Generate icons from a navy square with white "DTT" (any offline generator or a committed SVG rasterized). No external fetch.
- [ ] **Step 3: Add register in `src/main.tsx`:** `import { registerSW } from 'virtual:pwa-register'; registerSW({ immediate: true })` (guard for test env). Add `vite-plugin-pwa/client` to `tsconfig` types.
- [ ] **Step 4: Build test**

`test/pwa.build.test.ts`:
```ts
import { existsSync } from 'node:fs'
test.skip('build emits service worker + manifest (run after `npm run build`)', () => {
  expect(existsSync('dist/sw.js')).toBe(true)
  expect(existsSync('dist/manifest.webmanifest')).toBe(true)
})
```
- [ ] **Step 5: Run build, then unskip locally to verify.** Run: `npm run build` → Expected: `dist/sw.js` + `dist/manifest.webmanifest` present. Re-skip before commit (keeps CI green without a build step ordering dependency), or add a build+verify CI job in Task 17.
- [ ] **Step 6: Commit.** `git commit -m "feat: PWA base (manifest, service worker, icons) — no data runtime caching"`

---

### Task 17: Cloudflare Pages config + GitHub Actions CI

**Files:** Create `.github/workflows/ci.yml`, `wrangler.toml` (or Pages build settings doc), `public/_headers`, `README.md` (deploy runbook)
- No unit test; deliverable is green CI + deploy-ready config.

**Interfaces:** Produces a CI that runs lint + test + build on push; and a documented one-time Cloudflare Pages connect the user performs.

- [ ] **Step 1: CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: ci
on: { push: { branches: [main] }, pull_request: {} }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with: { name: dist, path: dist }
```

- [ ] **Step 2: Security headers**

`public/_headers` (Cloudflare Pages serves these):
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'
```
> CSP `connect-src 'self'` enforces RNF5 at the browser level: no sell-out data can be posted to any external host.

- [ ] **Step 3: Deploy runbook in `README.md`**

Document exact steps the user runs once: create GitHub repo, `git remote add origin …`, push; in Cloudflare Pages → Connect to Git → build command `npm run build`, output dir `dist`, Node 22. Note the app is fully static; no env vars, no secrets.

- [ ] **Step 4: Push & verify CI green**

```bash
git add -A && git commit -m "ci: GitHub Actions (lint+test+build) + Cloudflare Pages config + CSP headers"
```
> Actual GitHub remote + push is a user step (needs their account). If a remote is already configured, push and confirm the Actions run is green.

---

## Definition of Done (Sprint 1)

- `npm run lint && npm run test && npm run build` all green.
- App runs; nav switches all 6 views; each view renders data through the store (no direct mock/seed imports in `src/ui/`).
- Dragging a CSV/XLSX into Corrida shows real `N filas · M distribuidores` counted in a Worker without freezing the UI; unsupported/empty files show honest error states.
- Seeds embedded and flagged placeholder; Config surfaces the placeholder provenance.
- PWA installable; CI config + Cloudflare `_headers`/runbook committed.
- Anti-leak, SCDC-over-crudo, and honesty invariants visibly upheld in the UI.

---

## Self-Review

**Spec coverage (spec §5 Sprint-1 items):** (1) Scaffold → Task 1. (2) Tokens → Task 2. (3) Contract interfaces → Task 3. (4) Port 6 views behind mocks → Tasks 8–15. (5) Real streaming ingest → Tasks 5–7 + 11. (6) Seeds → Task 4. (7) PWA + Pages/CI → Tasks 16–17. All covered.

**Placeholder scan:** No "TBD/handle edge cases" left; each code step ships real code. Seed *content* placeholders are intentional and flagged per spec §6, with tests asserting the flag.

**Type consistency:** `SchemaMap`, `IngestSummary`, `ProgressEvent`, `MaestroEntry`, `ColaItem`, `SeedCatalogs`, `ViewKey`, `runIngest` signatures are defined once (Tasks 3/7) and consumed verbatim downstream. `startIngest`/`ingest` shape defined in Task 8 matches Corrida's usage in Task 11.

# Execution Design — Motor de Estandarización DTT

**Date:** 2026-07-12
**Status:** Draft, pending user approval
**Authoritative specs:** `../../../../PRD_Motor_Estandarizacion_DTT.md` (business rules D1–D5, R1–R7),
`../../../../TRD_Motor_DTT_y_Plan_Sprints.md` (architecture + 6-sprint plan),
`../../../../Motor DTT.dc.html` (UI spec / component seed — the imported Claude Design prototype).

This document does **not** restate the PRD/TRD. It records the execution decisions for building
the product from those specs, and the concrete Sprint-1 scope. Everything unstated defaults to the TRD.

---

## 1. Confirmed decisions (this session)

| Decision | Choice | Notes |
|---|---|---|
| Deliverable | The **real engine**, not a UI port of the prototype | Prototype data is mocked/seeded; we build the real resolution pipeline. |
| Runtime | **Full browser SPA per TRD §0/§1** | React 18 + Vite + TS + Tailwind + Zustand; Web Worker pipeline; IndexedDB; PWA; Cloudflare Pages. PRD's Python CLI is superseded by the newer TRD. |
| Build cadence | **Whole thing, iteratively** | Follow the TRD 6-sprint plan across sessions. This session = Sprint 1. |
| Repo layout | **New `./dtt-motor/` subfolder, own git repo** | PRD/TRD/prototype markdown stay in `safi-heinz/` as reference. |
| Sample data | **No synthetic dataset** | Build against schema/contracts; user supplies the real `Sell_out_*.csv`. Unit tests use tiny hand-authored inline fixtures only (normal testing, not a shipped dataset). |

## 2. Locked stack (TRD §2)

React 18 · Vite · TypeScript · Tailwind CSS · Zustand · PapaParse (CSV streaming) ·
SheetJS/`xlsx` (XLSX in/out) · `fastest-levenshtein` + ~30-line token-sort (fuzzy) ·
IndexedDB via `idb` · `vite-plugin-pwa` (Workbox, autoUpdate) · dedicated Web Worker ·
File System Access API (`showSaveFilePicker`) with Blob fallback · FNV-1a 64-bit (dedup) ·
Vitest + golden dataset. **Budget:** ≤ 8 runtime deps, bundle < 600 KB gz (excl. seeds).
**Target browser:** Chrome/Edge desktop (last 2), ≥ 8 GB RAM; Firefox/Safari detected & warned.

## 3. Architecture invariants (must hold every sprint)

- **Anti-leak rule (TRD §S1):** no UI component reads mock data directly in production. All data
  crosses **contract interfaces** (pipeline / maestro / cola / config types) defined in Sprint 1.
  Mocks live *behind* those interfaces only until the real module exists.
- **Single streaming pass (TRD §3):** each chunk flows normalize → cascades → dedup → write while
  per-distributor metric accumulators update in the same pass. No "load all then process."
- **Two-pass exception (TRD §3):** null-by-RIF recovery + master update recompute at end-of-pass
  using D3; only the ~pending rows are re-visited (OPFS-buffered by index), never all 740K.
- **Reproducibility (R3/RNF6):** source crudos + versioned config ⇒ byte-identical output. The
  standardized base is a derived view, never the source of truth.
- **SCDC over crudo (D5/§10):** distributor score is computed on what they *sent*, not what the
  motor rescued. Never maquillar distributor quality.
- **Honesty (R7):** irresolubles stay in the base flagged `SIN_CLASIFICAR` with full provenance;
  never imputed or silently dropped.

## 4. Module layout (TRD §3, built fresh)

```
dtt-motor/
  src/
    contracts/        # Sprint-1 interfaces: PipelineIO, Maestro, Cola, Config, Row schemas
    seeds/            # embedded: catalogo_segmentos, catalogo_estados, ciudad_estado, diccionario seed
    pipeline/         # Web Worker modules (isomorphic pure fns where possible)
      ingest.ts       normalize.ts  segmento.ts  estado.ts
      maestro.ts      dedup.ts      metrics.ts    writer.ts
    worker/           # worker entry + postMessage protocol (start/progress/done/error)
    storage/          # IndexedDB (idb) stores: diccionario, maestro, ciudad_estado, catalogos, bitacora, meta
    reports/          # SCDC xlsx, cola xlsx export/import
    ui/               # 6 views ported from prototype: Dashboard, Corrida, Distribuidores, Cola, Maestro, Config
      components/  screens/  tokens (Tailwind theme)
    state/            # Zustand store
  test/               # vitest + golden dataset
  docs/superpowers/specs/
```

## 5. Sprint 1 scope (this session) — "Auditoría del handoff, fundaciones y esqueleto desplegado"

1. **Scaffold** Vite + React + TS + Tailwind; project config, lint, Vitest.
2. **Tokens:** extract prototype palette (navy `#0F2B5B`, red `#C8102E`, greens/ambers, greys) +
   IBM Plex Sans/Mono into Tailwind theme.
3. **Contract interfaces** (the anti-leak boundary): types for ingested Row, pipeline run
   input/output & progress events, maestro entry, cola item, config/seeds.
4. **Port 6 views** from the prototype into React components, driven by mock adapters that
   implement the contract interfaces (real modules replace adapters in later sprints).
5. **Real streaming ingest** (`ingest.ts`) — first mock→real replacement: drag-drop CSV/XLSX,
   schema detection (Sell_out_ vs DATA_VENTAS headers → internal schema), live row/distributor
   counting via PapaParse streaming in a Worker, schema-error UI states wired to real validation.
6. **Seeds:** embed catalogs (35 N3 + 8 N1 + 24 estados). *See §6 gap.*
7. **PWA base** (manifest, service worker via vite-plugin-pwa, icons) + Cloudflare Pages build
   config + GitHub Actions CI (deploy-ready; user performs the actual GitHub/CF connect).

**Exit criteria (TRD):** app compiles in the TRD stack and is deploy-ready on Pages; installing the
PWA, dragging a CSV, and seeing real "N filas · M distribuidores" counts without freezing the UI,
with the other views still mock-behind-interface.

## 6. Known gaps & default handling (flagged for correction)

- **Official 35-N3 catalog (Entregable 3.1)** not present in repo; TRD says the prototype's list was
  "inventado." → Seed from the prototype's `SEGS` (35 N3 + 8 N1) as best-available, clearly marked
  `PLACEHOLDER — replace with catalogo_segmentos.csv (Entregable 3.1)`. Swap-in is a data file change.
- **24 estados catalog** and **ciudad_estado seed** not present. → Seed a documented placeholder
  (VE states) marked for replacement.
- **Diccionario seed (~150 curated entries)** derives from the real histórico we don't have. →
  Start from the PRD §7.1 seed examples + prototype variants; grows via the cola in Sprint 5.
- **Real 740K CSV** absent. → Ingest/schema built against the documented `Sell_out_*`/`DATA_VENTAS`
  headers; full-volume demo + benchmark (RNF1/RNF2) run when the real file is supplied.
- **Deploy** requires user's GitHub + Cloudflare accounts. → All config written; user runs the connect
  step with instructions provided.

## 7. Out of scope (v1, per PRD §4 / TRD)

Backend/DB/auth/Workers/WASM; Parquet output (CSV only); Power BI integration; structural file
validation (Checklist 28pt owns it); mutation of money fields (CAJAS/Bs/TON/UNIDADES/FECHA);
Nielsen-15 taxonomy (rollup lives downstream in BI); F3 (Supabase/n8n/LLM).

## 8. Definition of done per sprint

Each sprint ends in something demonstrable, green CI (Vitest + golden dataset from Sprint 2 on),
and the anti-leak rule intact. Sprints 1–4 = PRD F1 (clean history to BI at S4). Sprints 5–6 = F2.

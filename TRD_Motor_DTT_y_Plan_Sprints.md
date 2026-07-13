# TRD — Motor de Estandarización DTT
## Documento de Requerimientos Técnicos + Plan de 6 Sprints

| | |
|---|---|
| **Producto** | Motor de Estandarización DTT (`dtt-motor`) |
| **Versión** | 1.0 — Julio 2026 |
| **PRD de referencia** | PRD_Motor_Estandarizacion_DTT v1.0 |
| **Restricciones de entrada** | Mínima complejidad · Cloudflare tier gratuito · instalable como aplicación |

---

## 0. Decisión arquitectónica central (léase primero)

Las tres restricciones se resuelven con una sola decisión: **aplicación web local-first, 100% estática, con todo el procesamiento en el navegador del analista**.

El razonamiento no es estético, es forzado por la física del free tier: Cloudflare Workers gratuito limita a ~10ms de CPU por invocación con 128MB de memoria — procesar 322MB / 740K filas server-side en ese plan es imposible. La alternativa (pagar cómputo, colas, R2) contradice la restricción de costo y de complejidad. En cambio, una laptop estándar procesa 740K filas con lookups de hash en segundos.

Consecuencias (todas favorables):

1. **Cloudflare Pages free** sirve solo estáticos: requests y ancho de banda ilimitados, cero costo, cero backend que mantener.
2. **La data de ventas de Heinz nunca sale de la máquina del analista.** No hay upload, no hay servidor que la toque. Esto convierte una restricción de presupuesto en un argumento de venta (confidencialidad de sell-out ante el cliente).
3. **PWA instalable** (manifest + service worker): el analista la "descarga" como aplicación de escritorio desde el navegador y funciona offline después de la primera carga — el procesamiento es local de todos modos.
4. Se conserva el principio del PRD v1 (cero infraestructura); solo cambia el runtime: de CLI Python a navegador.

**Anti-requisito explícito:** no hay backend, no hay base de datos remota, no hay autenticación, no hay Workers, no hay WASM. Cualquier propuesta que agregue uno de estos en v1 se rechaza por defecto (F3 del PRD sigue existiendo como futuro condicional).

---

## 1. Desviaciones respecto al PRD v1

| Tema | PRD decía | TRD define | Razón |
|---|---|---|---|
| Runtime | CLI Python + Polars | SPA TypeScript en navegador (Web Worker) | Instalabilidad + Cloudflare free |
| Output principal | Parquet + CSV | **Solo CSV** (y XLSX para reportes) | Escribir Parquet en browser agrega dependencia WASM sin beneficio: Power BI consume CSV igual |
| Cola de revisión | Export/import Excel | Resolución **dentro de la app** + export/import XLSX se mantiene como respaldo | La UI ya existe (prototipo validado); menos fricción |
| Diccionario/maestro | CSVs en Git | **Seeds embebidos en la app + estado local (IndexedDB) + export/import CSV** para versionar en Git | El analista no debe tocar Git para operar; Git sigue siendo el registro versionado |
| Comandos CLI (`motor run`, etc.) | Sección 9 del PRD | Reemplazados por 6 vistas: las 5 del prototipo + Configuración (export/import de config y bitácora) | 1:1 funcional |

**Todo lo demás del PRD se mantiene sin cambios:** decisiones D1–D5, reglas R1–R7, cascadas, esquema de salida con provenance, métricas de éxito (sección 12) y la distinción SCDC-sobre-crudo.

Corrección de datos incorporada tras auditoría del prototipo: catálogo oficial de **35 segmentos N3** del Entregable 3.1 (no el inventado por el prototipo) y cifra real de normalización **766 variantes crudas → 712 tras R1** (medida contra el histórico).

---

## 2. Stack técnico

| Capa | Elección | Justificación |
|---|---|---|
| Framework | **React 18 + Vite + TypeScript** | Stack estándar de Arizon; Vite build estático directo a Pages (Next.js sería overkill sin SSR) |
| Estilos | Tailwind CSS | Réplica rápida de la estética del prototipo (navy #0F2B5B / rojo #C8102E) |
| Estado UI | Zustand | Mínimo; sin boilerplate |
| Parsing CSV | **PapaParse** (modo streaming/chunk) | Nunca carga el archivo completo a memoria como string |
| XLSX (lectura input y escritura reportes) | **SheetJS (xlsx)** | Única opción madura browser-side |
| Fuzzy matching | `fastest-levenshtein` + token-sort propio (~30 líneas) | Corre solo sobre ~700 variantes distintas, no por fila; no se necesita nada más pesado |
| Persistencia local | **IndexedDB** vía `idb` (wrapper de 1KB) | localStorage es insuficiente; Dexie es innecesario |
| PWA | `vite-plugin-pwa` (Workbox, autoUpdate) | Instalable + offline con ~10 líneas de config |
| Procesamiento | **Web Worker dedicado** (postMessage plano con eventos de progreso) | UI nunca se congela; sin Comlink ni SharedArrayBuffer |
| Descarga de outputs | File System Access API (`showSaveFilePicker`, escritura streaming) con fallback a Blob | El output CSV (~350MB) se escribe a disco en streaming en Chrome/Edge |
| Hash dedup | FNV-1a 64-bit en JS puro | crypto.subtle es async por llamada (lento por fila); FNV es suficiente para dedup exacto |
| Testing | Vitest + dataset dorado | Ver sección 8 |
| Hosting | **Cloudflare Pages (free)** vía integración GitHub | Deploy automático por push a `main`; previews por PR |

Presupuesto de dependencias: **≤ 8 paquetes de runtime**. Bundle objetivo < 600KB gzip (sin contar seeds).

Navegador objetivo: **Chrome/Edge de escritorio** (últimas 2 versiones), máquina con ≥ 8GB RAM. Firefox/Safari: no soportados en v1 (File System Access API); la app lo detecta y lo informa.

---

## 3. Arquitectura de módulos

```
┌────────────────────────── NAVEGADOR (todo local) ──────────────────────────┐
│                                                                            │
│  UI (React) ── 6 vistas del prototipo:                                     │
│  Dashboard · Nueva corrida · Distribuidores · Cola · Maestro · Config      │
│        │  postMessage (start, progress, done, error)                       │
│        ▼                                                                   │
│  ┌─ Web Worker: PIPELINE ────────────────────────────────────────────┐     │
│  │ ingest.ts      PapaParse streaming (CSV) / SheetJS (XLSX→filas)   │     │
│  │ normalize.ts   R1: upper·trim·acentos·separadores·espacios        │     │
│  │ segmento.ts    Cascada: MAESTRO → EXACTO → FUZZY(≥92) → SIN_CLAS. │     │
│  │ estado.ts      Cascada: CATALOGO → RIF → CIUDAD → SIN_ESTADO      │     │
│  │ maestro.ts     Regla D3: MANUAL > reciente > moda · conflictos    │     │
│  │ dedup.ts       FNV-1a sobre fila completa                         │     │
│  │ metrics.ts     Acumuladores SCDC por distribuidor (un solo pase)  │     │
│  │ writer.ts      CSV output streaming a disco + provenance          │     │
│  └───────────────────────────────────────────────────────────────────┘     │
│        │                                                                   │
│  storage.ts (IndexedDB): diccionario · maestro · ciudad_estado ·           │
│                          catálogos · bitácora · snapshot última corrida    │
│  reports.ts: SCDC XLSX · cola XLSX (export/import)                         │
└────────────────────────────────────────────────────────────────────────────┘
         ▲ solo assets estáticos (HTML/JS/seeds) — nunca data de ventas
┌────────┴───────────────┐
│ Cloudflare Pages (free)│  ←  GitHub repo (CI: push a main = deploy)
└────────────────────────┘
```

Principio de diseño del pipeline: **un solo pase de streaming**. Cada chunk de filas atraviesa normalización → cascadas → dedup → escritura, mientras los acumuladores de métricas se actualizan en el mismo pase. No existe "cargar todo y luego procesar". Estructuras residentes en memoria: diccionario (Map ~1K entradas), maestro (Map ~45K entradas ≈ 10MB), set de hashes dedup (~740K × 8B ≈ 12MB), acumuladores por distribuidor (63). Total < 100MB de heap del Worker.

Excepción de dos pases: la recuperación de nulos vía RIF y la actualización del maestro requieren conocer el histórico completo del cliente. Solución sin segundo pase sobre el archivo: durante el pase único se registran (a) filas con segmento nulo cuyo RIF aún no resuelve y (b) evidencia por RIF (mes, valor, distribuidor). Al cierre del pase, el maestro se recalcula con la regla D3 y las filas pendientes (guardadas por índice en un buffer en disco OPFS) se reescriben en el output. Costo: re-visitar solo ~80K filas, no 740K.

---

## 4. Modelo de datos local (IndexedDB, DB `dtt-motor` v1)

| Store | Clave | Contenido |
|---|---|---|
| `diccionario` | variante_normalizada | { segmento_n3?, macro_canal_n1, estado_regla, origen, agregado_por, fecha, nota } |
| `maestro` | rif | { nombre, segmento_n3?, macro_canal_n1?, fuente, fecha, flag_conflicto, evidencia[] } |
| `ciudad_estado` | ciudad_normalizada | { estado } |
| `catalogos` | id fijo | 35 N3 + 8 N1 + 24 estados (solo lectura; se actualiza con release de la app) |
| `bitacora` | run_id | { fecha, archivo, filas, % por método, version_diccionario, duración } |
| `meta` | key | version_diccionario (SHA-256 del export), última corrida, preferencias |

**Versionado real:** el botón "Exportar configuración" genera `diccionario.csv` + `maestro_clientes.csv` + `ciudad_estado.csv`; esos archivos se commitean al repo (el analista los adjunta o Jose los commitea). "Importar configuración" reemplaza los stores con validación de esquema. IndexedDB es el estado de trabajo; **Git sigue siendo la fuente de verdad versionada** (mantiene R3: crudos + config ⇒ output reproducible).

Seeds embebidos en el build: catálogos oficiales, `ciudad_estado.csv` inicial y el diccionario seed generado del histórico real (~150 entradas curadas, 98% de cobertura).

## 5. Contratos de archivos

**Input aceptado:** CSV o XLSX con los encabezados del consolidado histórico (`Sell_out_*.csv`) **o** de la plantilla oficial (DATA_VENTAS). El módulo de ingesta detecta cuál de los dos esquemas es por los encabezados y mapea a un esquema interno único. Cualquier otro esquema → error claro con lista de columnas faltantes (no se intenta adivinar).

**Outputs:**

| Archivo | Formato | Contenido |
|---|---|---|
| `base_estandarizada_[run_id].csv` | CSV UTF-8 | Columnas originales intactas + las 11 columnas de provenance del PRD §7.3 |
| `reporte_scdc_[run_id].xlsx` | XLSX | Hoja 1: KPIs globales; Hoja 2: ranking 63 distribuidores (crudo vs post, tier, TON); Hoja 3: variantes nuevas |
| `cola_revision_[run_id].xlsx` | XLSX | Variantes sin mapear + conflictos mayores; columna `resolucion` para re-import |
| `duplicados_[run_id].csv` | CSV | Anexo de duplicados exactos excluidos (R6) |
| `config_export_[fecha].zip`-less | 3 CSVs | diccionario, maestro, ciudad_estado — para commit en Git |

`run_id` = `RUN-YYYY-MM-DD-NN`. La bitácora registra el SHA-256 de la config usada: misma config + mismo crudo ⇒ output byte-idéntico (R3).

---

## 6. Requerimientos no funcionales

| Req | Meta | Verificación |
|---|---|---|
| RNF1 — Rendimiento | Corrida completa del histórico (740K filas, 322MB) **< 3 min** en laptop i5/8GB, UI fluida durante el proceso | Benchmark en S6 con el CSV real |
| RNF2 — Memoria | Heap del Worker < 500MB pico (streaming, nunca archivo completo en memoria) | Chrome DevTools en S6 |
| RNF3 — Offline | Tras primera carga, la app opera sin red (procesar, resolver cola, exportar) | Test manual modo avión |
| RNF4 — Instalable | Instalación PWA en Windows (Chrome/Edge) con icono, ventana standalone y nombre "Motor DTT" | Lighthouse PWA ≥ 90 |
| RNF5 — Privacidad | Cero requests de red con data de ventas; ningún analytics de terceros | Auditoría de pestaña Network durante corrida |
| RNF6 — Reproducibilidad | Misma config + mismo input ⇒ output idéntico (hash) | Test automatizado en CI |
| RNF7 — Recuperación | Si el navegador se cierra a mitad de corrida, la app reinicia limpia (una corrida no deja estado corrupto; config intacta) | Test manual |
| RNF8 — Free tier | Proyecto opera con $0: Pages free (builds < 500/mes, assets < 25MB por archivo) | Revisión de plan CF |

## 7. Riesgos técnicos

| Riesgo | Prob. | Mitigación |
|---|---|---|
| XLSX de entrada muy grande revienta memoria (SheetJS no es streaming) | Media | Regla operativa: el histórico grande entra como CSV (ya lo es); XLSX solo para archivos mensuales por distribuidor (< 50K filas). La app avisa si un XLSX > 50MB |
| File System Access API no disponible (navegador no soportado) | Baja | Detección al inicio + banner "usar Chrome/Edge"; fallback Blob para outputs < 500MB |
| IndexedDB borrado por limpieza del navegador | Media | Recordatorio de export tras cada sesión con cambios + `navigator.storage.persist()` + la config vive en Git |
| Deriva entre seeds embebidos y config de Git | Media | `version_diccionario` visible en el footer (como en el prototipo); warning si el seed embebido es más nuevo que el importado |
| El pase de re-escritura de nulos-por-RIF complica el writer | Media | Buffer OPFS indexado, diseñado y testeado en S3 aislado del writer principal |

## 8. Estrategia de pruebas

- **Dataset dorado:** muestra estratificada real de 10K filas del histórico (incluye combinadas, nulos, NO IDENTIFICADO, duplicados, conflictos de RIF) con output esperado congelado. Corre en CI en cada push; cualquier diff = build rojo.
- **Unit (Vitest):** normalize (tabla de casos reales de las 766 variantes), cascada segmento (orden y precedencia), fuzzy (umbrales 92/80 exactos), regla D3, dedup, ciudad→estado.
- **Property test ligero:** ninguna fila del input se pierde: `filas_output + duplicados = filas_input`, siempre.
- **Benchmark:** script reproducible con el CSV completo, reporta filas/seg y pico de memoria (gate de RNF1/RNF2 en S6).

---

# Plan de 6 Sprints

Cadencia: **1 semana por sprint** (1 dev full-time + revisión de Jose). Cada sprint termina en algo demostrable en la URL de Pages.

**Punto de partida: el handoff de Claude Code** (export del prototipo final de Claude Design). El handoff es la **spec de UI y semilla de componentes** — vistas, estados, tokens visuales, microcopy —, no la arquitectura: el pipeline en Worker, el streaming, IndexedDB y los contratos de archivos se construyen desde cero según este TRD. Regla anti-fuga para todo el plan: **ningún componente del handoff lee data mock directamente en producción** — toda la data entra por las interfaces de contrato definidas en S1; el mock vive detrás de esas mismas interfaces solo mientras el módulo real no exista.

## Sprint 1 — Auditoría del handoff, fundaciones y esqueleto desplegado
**Objetivo:** convertir el export del handoff en la base real del proyecto, con URL viva en Cloudflare Pages.
- **Día 1 — leer el handoff antes de escribir código:** inventario de las 6 vistas, componentes, estados e interacciones que trae; extracción de tokens visuales (paleta, tipografía, espaciados) a la config de Tailwind; decisión componente-por-componente de qué se migra y qué se reescribe
- Migración del código del handoff al stack del TRD (Vite/React/TS/Tailwind): los componentes de UI se conservan; **la data mock y el runtime del prototipo se aíslan detrás de interfaces de contrato** (tipos del pipeline, del maestro y de la cola definidos este sprint) — es la regla anti-fuga del plan
- Repo + CI GitHub→Pages (deploy automático, previews por PR) + PWA base instalable (manifest, service worker, iconos)
- Ingesta streaming real (primer módulo que reemplaza mock): drag & drop CSV/XLSX, detección de esquema, conteo de filas/distribuidores en vivo, estados de error de esquema del prototipo conectados a validación real
- Seeds embebidos: catálogos oficiales (35 N3 + 8 N1 + 24 estados)

**Criterio de salida:** el handoff compila dentro del stack del TRD y está desplegado en Pages; instalar la PWA, arrastrar el CSV de 322MB y ver "740.009 filas · 63 distribuidores" reales sin congelar la UI, con el resto de vistas aún en mock detrás de las interfaces.

## Sprint 2 — Motor núcleo: normalización, diccionario y estado
**Objetivo:** el corazón del pipeline procesando el histórico completo en Worker.
- normalize.ts (R1) validado contra la cifra real 766→712
- Generación y curaduría del **diccionario seed real** (~150 entradas desde el histórico) — incluye decisión con TM de las entradas ambiguas tipo FARMACIAS
- Cascada segmento parcial: EXACTO + SIN_CLASIFICAR; cascada estado completa (catálogo + ciudad→estado seed)
- metrics.ts: acumuladores por distribuidor en el mismo pase; Dashboard con números reales de la corrida
- Suite Vitest + dataset dorado v1 en CI

**Criterio de salida:** corrida real del histórico muestra % EXACTO y % estado válido reales en el Dashboard (< 3 min).

## Sprint 3 — Maestro de clientes, fuzzy y dedup
**Objetivo:** cascada completa del PRD.
- maestro.ts: construcción por RIF con regla D3, detección CONFLICTO_MAYOR, evidencia por mes
- Recuperación de nulos vía RIF con buffer OPFS de re-escritura (el diseño de dos fases de §3)
- fuzzy.ts con umbrales R2 (≥92 auto, 80–91 sugerencia) sobre variantes distintas
- dedup.ts FNV-1a + anexo de duplicados
- Property test "ninguna fila se pierde"

**Criterio de salida:** los cuatro métodos (MAESTRO/EXACTO/FUZZY/SIN_CLASIFICAR) suman 100% en la corrida real y los números cuadran contra el análisis exploratorio de referencia.

## Sprint 4 — Salidas completas
**Objetivo:** todos los archivos que el PRD promete, con el histórico real.
- writer.ts: base estandarizada CSV con las 11 columnas de provenance, escritura streaming a disco
- reporte SCDC XLSX (3 hojas) con la distinción crudo vs post-motor
- Export cola XLSX + duplicados CSV + bitácora persistida
- Vista Distribuidores completa (ranking, tiers, expandibles con trazabilidad real)
- Test de reproducibilidad (RNF6) en CI

**Criterio de salida:** entregar a BI la primera **base histórica estandarizada real** — esto es el hito de valor del proyecto; lo que sigue es operación.

## Sprint 5 — Cola de revisión y gestión de configuración
**Objetivo:** el loop de mejora continua operable por el analista sin tocar código. La UI de Cola, Maestro y Configuración ya viene del handoff — el sprint la conecta a IndexedDB y a los flujos reales de import/export.
- Vista Cola: aprobar sugerencia / asignar segmento / solo macro-canal (D2), conflictos con historial y regla sugerida (D3) — resoluciones escriben a IndexedDB
- Vista Maestro: búsqueda sobre los 45,158 RIFs reales, ficha con historial crudo vs canónico
- Import de cola resuelta XLSX (flujo de respaldo)
- Export/Import de configuración (3 CSVs) con validación de esquema + `version_diccionario` por hash
- Re-corrida tras resolver cola demostrando propagación retroactiva (R3)

**Criterio de salida:** el analista resuelve 10 ítems reales de la cola, re-corre, y ve subir el % N3 exacto — sin intervención de desarrollo.

## Sprint 6 — Endurecimiento, UAT y release
**Objetivo:** v1.0 en producción con el analista operando solo.
- Benchmark formal RNF1/RNF2 y tuning (tamaño de chunk, batch de postMessage)
- Auditoría RNF5 (cero fuga de data) + Lighthouse PWA + pulido offline
- UAT con el analista de TM: corrida mensual simulada de punta a punta con guion
- Manual de operación de 2 páginas (corrida mensual, resolver cola, exportar config a Git, restaurar config)
- Buffer de correcciones UAT + tag `v1.0.0` + release en Pages

**Criterio de salida:** el analista ejecuta el ciclo mensual completo sin asistencia; métricas de la sección 12 del PRD verificadas contra la corrida real.

---

**Nota de alcance del plan:** los sprints 1–4 replican F1 del PRD (valor: histórico limpio, entregado al cierre del S4); los sprints 5–6 cubren F2 (operación mensual). F3 (Supabase/n8n/LLM) queda fuera, condicional a que la cola mensual supere ~1h de trabajo manual — igual que en el PRD.

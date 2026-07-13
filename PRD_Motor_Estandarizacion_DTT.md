# PRD — Motor de Estandarización DTT
## Pipeline de limpieza y homologación de data Sell-Out del Canal DTT · Kraft Heinz Venezuela

| | |
|---|---|
| **Producto** | Motor de Estandarización DTT (working name: `dtt-motor`) |
| **Versión del documento** | 1.0 — Julio 2026 |
| **Estado** | Aprobado para desarrollo |
| **Contexto** | Programa de Estandarización de Variables Cualitativas — Canal DTT |

---

## 1. Resumen ejecutivo

El Canal DTT reporta ~740K transacciones semestrales provenientes de 63 distribuidores, cada uno con su propio formato. Las dos variables cualitativas críticas — **Segmento de Tienda** (Canal/Tipo de Cliente) y **Estado** — llegan como texto libre: 732 variantes distintas para lo que deberían ser 35 segmentos, 10.9% de registros sin segmento y 6.3% de registros con Estado "NO IDENTIFICADO". Esto impide calcular Distribución Numérica, sell-out por formato de tienda y cobertura geográfica.

El Motor DTT es un pipeline batch que ingiere los reportes crudos, normaliza y resuelve el segmento y estado de cada registro mediante una **cascada de resolución** (diccionario de equivalencias → fuzzy matching → maestro de clientes → cola de revisión), y produce una base estandarizada con trazabilidad completa por registro, más un reporte de calidad por distribuidor (SCDC).

**Principio de diseño rector:** el segmento es una propiedad del **cliente**, no de la transacción. El diccionario de equivalencias es el mecanismo para poblar un maestro de clientes por RIF; una vez clasificado un cliente, todas sus transacciones pasadas y futuras heredan su segmento, independientemente de lo que tipee el distribuidor.

**Principio de honestidad de datos:** el motor no inventa data. Los registros irresolubles se marcan explícitamente como `SIN_CLASIFICAR` con provenance completo, nunca se imputan ni se descartan silenciosamente. La data alimenta bonos y comisiones: cada reclasificación debe ser auditable.

---

## 2. Problema y baseline medido

Perfil real del dataset `Sell_out_OCT-25_MAR-26` (Oct/25 – Mar/26):

| Métrica | Valor medido | Implicación de diseño |
|---|---|---|
| Registros totales | 740,009 | Volumen trivial para Polars/DuckDB; el reto no es throughput |
| Distribuidores | 63 | |
| Variantes distintas en Canal/Tipo de Cliente | 732 | Top 50 cubre 93.8%, top 100 cubre 97.9% de no nulos |
| Registros con segmento nulo | 80,616 (10.9%) | Solo 38.5% recuperable por cruce de RIF dentro del dataset |
| Variantes con categorías combinadas ("ABASTOS / BODEGAS" y afines) | ~151K registros (23% de no nulos) | No separables por diccionario; requieren política explícita (ver D2) |
| Clientes (RIF) con etiquetas contradictorias entre registros | 17.2% de 42,273 RIFs clasificables | Requiere regla canónica (ver D3) |
| Estado "NO IDENTIFICADO" | 46,955 (6.3%) | 44.9% recuperable por RIF; 77.6% tiene Ciudad → recuperación combinada estimada >85% |
| Variantes que son razones sociales | 0.15% de no nulos | Problema marginal en esta data (era grave en el dataset safi 2.xlsx anterior) |
| Toneladas en registros con segmento nulo | 726.7 TON de 7,828 TON | 9.3% del volumen ilegible por formato de tienda |

---

## 3. Decisiones de diseño (cerradas)

### D1 — Taxonomía objetivo: catálogo de 35 segmentos N3 con rollup a 8 macro-canales N1

Se adopta el catálogo de 35 segmentos Nivel 3 ya definido en el Entregable 3.1 (plantilla oficial) como única fuente de verdad, con derivación automática al macro-canal Nivel 1 (Trade Tradicional/UTT, Supermercados Independientes, Cadenas, Bodegones, Mayoristas, Farmacias Modernas, On Premise, Otros).

**Rationale:** es el catálogo ya embebido en la plantilla, la calculadora de autoclasificación y el flyer distribuidos a la red. Construir el motor contra una lista distinta (ej. los 15 de Nielsen) fragmentaría el programa y obligaría a mantener dos diccionarios. Si Heinz requiere la vista Nielsen-15, se resuelve con una tabla de rollup N3→Nielsen aguas abajo en BI, no en el motor.

### D2 — Categorías combinadas: mapeo jerárquico, sin adivinar

Las variantes combinadas ("ABASTOS / BODEGAS", "ABASTOS, BODEGAS", etc.) se mapean **solo al macro-canal N1** (`TRADE TRADICIONAL (UTT)`) con `segmento_n3 = NULL` y `confianza = MACRO`. El motor no decide entre abasto y bodega porque el texto no contiene esa información y una imputación afectaría cálculos de bonos.

La resolución a N3 ocurre por enriquecimiento del maestro de clientes: cuando el RIF reciba una clasificación exacta (de un mes posterior con plantilla nueva, de la calculadora de autoclasificación, o de revisión manual), esta se propaga retroactivamente a todo su historial en la siguiente corrida.

**Rationale:** reportes de DN y sell-out por macro-canal quedan 100% funcionales de inmediato (que es el uso principal); la granularidad N3 mejora orgánicamente mes a mes sin fabricar data.

### D3 — Regla canónica para clientes contradictorios: manual > más reciente > moda

Cuando un RIF tiene múltiples valores de segmento en su historial, la precedencia es:

1. **Clasificación manual** en el maestro (siempre gana, nunca es sobrescrita por el pipeline).
2. **Valor no ambiguo más reciente** (los formatos de tienda cambian; el reporte más nuevo refleja la realidad actual).
3. **Moda** del historial como desempate ante empates de fecha.

Conflictos **cross-macro-canal** (ej. un RIF que aparece como BODEGA y como MAYORISTA) se marcan `CONFLICTO_MAYOR` y van a cola de revisión; conflictos dentro del mismo macro-canal (ABASTO vs BODEGA) se resuelven automáticamente por la regla y no generan alerta.

### D4 — Gobernanza: diccionario y maestro versionados, dueño único, cola vía Excel en v1

- **Dueño:** el analista de Trade Marketing (rol pasante) es el único autorizado a resolver la cola de revisión y aprobar entradas nuevas al diccionario. El líder de TM aprueba cambios al catálogo de 35 segmentos (que no deberían ocurrir).
- **v1 (MVP):** diccionario y maestro viven como archivos versionados en el repositorio (CSV bajo Git). La cola de revisión es un export/import de Excel — cero infraestructura, cero UI, operativo en días.
- **v2:** migración de diccionario y maestro a Supabase/PostgreSQL, corridas mensuales orquestadas por n8n, y sugerencias LLM (vía OpenRouter) para la cola. UI de administración solo si el volumen de la cola lo justifica.

**Rationale de control de complejidad:** el 98% del valor está en la lógica de la cascada, no en la infraestructura. v1 corre local con un comando y entrega el histórico limpio la primera semana.

### D5 — El motor complementa la plantilla, no la reemplaza

El motor es (a) limpieza retroactiva del histórico, (b) red de seguridad para distribuidores no adoptantes, y (c) generador del maestro de clientes y de los scores SCDC que alimentan el protocolo de rechazo. **No** exime a los distribuidores de adoptar la plantilla con listas desplegables. El reporte de calidad por distribuidor que emite el motor es insumo directo del scoring trimestral y del protocolo de rechazo (Entregable 4.2).

---

## 4. Alcance

### Dentro de alcance (v1)

- Ingesta del CSV/Excel consolidado histórico (Oct/25–Mar/26, ~740K filas) y de archivos mensuales individuales por distribuidor.
- Estandarización de **Segmento de Tienda** (cascada completa) y **Estado** (catálogo 24 estados + recuperación por RIF y Ciudad).
- Construcción y mantenimiento incremental del **maestro de clientes** por RIF.
- Deduplicación de duplicados exactos (hash de fila completa).
- Salida: base estandarizada (Parquet + CSV), reporte de calidad SCDC por distribuidor (Excel), cola de revisión (Excel), bitácora de corridas.
- CLI con corridas idempotentes y reproducibles.

### Fuera de alcance (v1)

- UI web de administración (v2, condicional).
- Validación estructural de archivos entrantes (la cubre el Checklist de 28 puntos, Entregable 4.1 — el motor asume archivos ya aceptados o el consolidado).
- Estandarización de campos no críticos (Ciudad, Municipio se normalizan a mayúsculas pero no se validan contra catálogo).
- Corrección de montos, cajas o fechas (solo se reportan anomalías, no se alteran).
- Integración directa con Power BI (el output Parquet/CSV es el contrato; la conexión es responsabilidad del BI).

---

## 5. Usuarios

| Usuario | Uso |
|---|---|
| Analista de Trade Marketing (pasante) | Ejecuta corridas, resuelve la cola de revisión, mantiene el diccionario |
| Líder de Trade Marketing | Consume el reporte SCDC, decide escalamientos con distribuidores |
| Analista de BI | Consume la base estandarizada en Power BI para DN, sell-out y cobertura |

---

## 6. Arquitectura funcional

```
 Archivo(s) crudo(s)          CONFIG (versionada)
 CSV / XLSX                   ├─ catalogo_segmentos.csv   (35 N3 + rollup N1)
      │                       ├─ catalogo_estados.csv     (24)
      ▼                       ├─ diccionario.csv          (variante → N3/N1)
 ┌─────────────┐              ├─ ciudad_estado.csv
 │ 1. INGESTA  │              └─ maestro_clientes.csv     (RIF → segmento)
 └─────┬───────┘
       ▼
 ┌─────────────────┐
 │ 2. NORMALIZACIÓN│  trim · upper · sin acentos · puntuación colapsada
 └─────┬───────────┘  · espacios múltiples → uno
       ▼
 ┌─────────────────────────────┐
 │ 3. CASCADA SEGMENTO         │   por registro, en orden, primera que resuelve:
 │  a. Maestro clientes (RIF)  │   metodo = MAESTRO
 │  b. Match exacto diccionario│   metodo = EXACTO
 │  c. Fuzzy ≥ 92 (rapidfuzz)  │   metodo = FUZZY
 │  d. Sin resolver            │   metodo = NULL → flag SIN_CLASIFICAR
 └─────┬───────────────────────┘   (fuzzy 80–91 genera sugerencia en cola)
       ▼
 ┌─────────────────────────────┐
 │ 4. CASCADA ESTADO           │
 │  a. Match catálogo 24       │   metodo = EXACTO
 │  b. Cruce RIF (histórico)   │   metodo = RIF
 │  c. Ciudad → Estado         │   metodo = CIUDAD
 │  d. Sin resolver            │   flag SIN_ESTADO
 └─────┬───────────────────────┘
       ▼
 ┌─────────────────┐
 │ 5. ACTUALIZACIÓN│  nuevos RIFs clasificados → maestro (regla D3)
 │    DEL MAESTRO  │  conflictos mayores → cola
 └─────┬───────────┘
       ▼
 ┌─────────────────┐
 │ 6. DEDUP        │  hash fila completa; duplicados exactos se marcan y excluyen
 └─────┬───────────┘  del output principal (se conservan en anexo)
       ▼
 ┌───────────────────────────────────────────────┐
 │ 7. SALIDAS                                    │
 │  base_estandarizada.parquet / .csv            │
 │  reporte_scdc_[run].xlsx (por distribuidor)   │
 │  cola_revision_[run].xlsx                     │
 │  bitacora.csv (append)                        │
 └───────────────────────────────────────────────┘
```

Nota sobre el orden de la cascada de segmento: el maestro va **antes** que el diccionario porque la clasificación a nivel de cliente (curada, con precedencia manual) es más confiable que lo que el distribuidor tipeó en esa transacción específica. El texto original se conserva siempre en `valor_original`.

---

## 7. Modelo de datos

### 7.1 Diccionario de equivalencias (`diccionario.csv`)

| Campo | Tipo | Descripción |
|---|---|---|
| variante_normalizada | texto, PK | Valor tras normalización (ej. `ABASTOS / BODEGAS`) |
| segmento_n3 | texto, nullable | Uno de los 35; NULL si solo resuelve a macro |
| macro_canal_n1 | texto | Uno de los 8; obligatorio |
| estado_regla | ACTIVA / DEPRECADA | Las deprecadas no se aplican pero se conservan |
| origen | SEED / MANUAL / FUZZY_CONFIRMADO | |
| agregado_por, fecha, nota | | Auditoría |

Seed inicial: se genera automáticamente desde las top ~150 variantes del histórico (98% de cobertura de no nulos) y se cura manualmente una sola vez. Ejemplos del seed:

| variante_normalizada | segmento_n3 | macro_canal_n1 |
|---|---|---|
| ABASTOS | ABASTO | TRADE TRADICIONAL (UTT) |
| ABASTO | ABASTO | TRADE TRADICIONAL (UTT) |
| BODEGAS | BODEGA | TRADE TRADICIONAL (UTT) |
| ABASTOS / BODEGAS | *(NULL)* | TRADE TRADICIONAL (UTT) |
| ABASTOS/BODEGAS | *(NULL)* | TRADE TRADICIONAL (UTT) |
| SUPERMERCADOS INDEPENDIENTES | *(NULL)* | SUPERMERCADOS INDEPENDIENTES |
| SPM INDEPENDIENTE PEQUEÑO | SUPERMERCADO IND. PEQUEÑO | SUPERMERCADOS INDEPENDIENTES |
| SUPER. MINIMARTS | MINI MARKET | SUPERMERCADOS INDEPENDIENTES |
| MINI MARKETS | MINI MARKET | SUPERMERCADOS INDEPENDIENTES |
| PANADERIAS | PANADERIA | TRADE TRADICIONAL (UTT) |
| BODEGONES | BODEGON | BODEGONES |
| MAYORISTAS | *(NULL)* | MAYORISTAS |
| FARMACIAS | *(NULL)* | *(cola: ¿tradicional o moderna?)* |
| DISTRIBUIDORES | *(NULL)* | MAYORISTAS |
| OTROS CLIENTES CANAL BAJO | *(NULL)* | OTROS |

### 7.2 Maestro de clientes (`maestro_clientes.csv`)

| Campo | Tipo | Descripción |
|---|---|---|
| rif | texto, PK | Identificador del cliente |
| nombre_cliente | texto | Último nombre conocido (informativo) |
| segmento_n3 | texto, nullable | |
| macro_canal_n1 | texto | |
| fuente | MANUAL / CALCULADORA / AUTO_RECIENTE / AUTO_MODA | Precedencia D3 |
| fecha_clasificacion | fecha | |
| flag_conflicto | NINGUNO / MENOR / MAYOR | MAYOR = cross-macro-canal, va a cola |
| distribuidor_principal, estado_habitual | texto | Derivados, informativos |

### 7.3 Esquema de salida (base estandarizada)

Todas las columnas originales del archivo fuente **sin alterar**, más:

| Columna nueva | Valores |
|---|---|
| segmento_n3_std | Catálogo 35 o NULL |
| macro_canal_n1_std | Catálogo 8 o NULL |
| metodo_segmento | MAESTRO / EXACTO / FUZZY / MANUAL / NULL |
| confianza_segmento | N3 / MACRO / NULL |
| estado_std | Catálogo 24 o NULL |
| metodo_estado | EXACTO / RIF / CIUDAD / NULL |
| flag_registro | OK / SIN_CLASIFICAR / SIN_ESTADO / DUPLICADO / CONFLICTO_MAYOR |
| valor_original_segmento | Texto crudo del campo Canal/Tipo de Cliente |
| valor_original_estado | Texto crudo del campo Estado |
| version_diccionario | Hash/tag de la versión de config usada |
| run_id | Identificador de la corrida |

### 7.4 Cola de revisión (`cola_revision_[run].xlsx`)

Una fila por ítem pendiente: variantes nuevas sin mapear (con # de registros afectados y sugerencia fuzzy si score 80–91), RIFs con `CONFLICTO_MAYOR`, y RIFs de alto volumen sin clasificar (ordenados por TON afectadas, para priorizar el esfuerzo manual donde mueve la aguja). El analista completa la columna `resolucion` y re-importa con `motor queue import`, lo que actualiza diccionario y/o maestro.

### 7.5 Bitácora (`bitacora.csv`)

Append por corrida: run_id, fecha, archivo(s) fuente, registros procesados, % clasificación por método, versión de diccionario, duración. Garantiza reproducibilidad: cualquier corrida es re-ejecutable con la misma config y produce el mismo output.

---

## 8. Reglas de negocio

**R1 — Normalización:** mayúsculas, trim, colapso de espacios múltiples, remoción de acentos, homologación de separadores (`/`, `,`, `-` rodeados de espacios → forma canónica). La normalización por sí sola funde varios cientos de las 732 variantes.

**R2 — Umbrales fuzzy (rapidfuzz, token_sort_ratio contra claves del diccionario):** ≥ 92 auto-aplica con `metodo = FUZZY`; 80–91 no aplica, genera sugerencia en cola; < 80 va a cola sin sugerencia. Los fuzzy confirmados por el analista se promueven a entradas exactas del diccionario (dejan de ser fuzzy en corridas futuras).

**R3 — Propagación retroactiva:** cada corrida re-resuelve el histórico completo contra el maestro vigente. La clasificación de un cliente hoy corrige sus transacciones de octubre. Esto es deliberado: la base estandarizada es una **vista derivada** reconstruible, nunca la fuente de verdad (la fuente son los crudos + la config versionada).

**R4 — Estado:** "NO IDENTIFICADO" se trata como nulo (política del programa: valor prohibido). Recuperación por RIF usa el estado válido más frecuente del cliente en el histórico; recuperación por Ciudad usa la tabla `ciudad_estado.csv` (seed: ciudades presentes en la data, curada una vez). Si RIF y Ciudad discrepan, gana RIF y se anota en cola como advertencia de baja prioridad.

**R5 — Nunca imputar sobre campos que mueven dinero:** CAJAS, Bs, TON, UNIDADES, FECHA no se modifican jamás. Anomalías (negativos, extremos) solo se reportan en el SCDC.

**R6 — Dedup:** solo duplicados exactos (hash de todas las columnas originales). Near-duplicates se reportan sin excluir — con FECHA mayormente vacía en el histórico, cualquier heurística más agresiva eliminaría ventas legítimas.

**R7 — Registros irresolubles:** permanecen en la base con `flag = SIN_CLASIFICAR`. Los dashboards deben mostrar el bucket explícitamente; ocultarlo distorsionaría DN y volúmenes.

---

## 9. Interfaz (CLI, v1)

```
motor run --input <archivo(s)> [--mes MM/AA] [--config ./config]
motor queue export --run <run_id>          # genera cola_revision.xlsx
motor queue import --file <resuelto.xlsx>  # actualiza diccionario/maestro
motor report --run <run_id>                # regenera reporte SCDC
motor seed --input <historico.csv>         # genera diccionario seed (solo setup inicial)
```

Stack: Python 3.12, Polars (o DuckDB) para procesamiento, rapidfuzz para matching, openpyxl para reportes Excel. Repositorio Git con config versionada. Sin base de datos, sin servicios, sin credenciales en v1.

---

## 10. Reporte de calidad (SCDC)

Por corrida y por distribuidor, replicando la lógica del KPI del programa:

- % segmento resuelto (desglosado por método y por nivel N3 vs MACRO)
- % estado resuelto (desglosado por método)
- SCDC del distribuidor = promedio de completitud de ambas variables **sobre el crudo** (antes del motor) — este es el número que alimenta el scoring trimestral y el protocolo de rechazo; el motor no debe maquillar la calidad del distribuidor
- SCDC post-motor — demuestra el uplift del pipeline
- Ranking de distribuidores, TON afectadas por registros irresolubles, top variantes nuevas del mes

Distinción crítica: **el score del distribuidor se calcula sobre lo que él envió**, no sobre lo que el motor logró rescatar. De lo contrario el motor destruye el incentivo de adopción de la plantilla (D5).

---

## 11. Fases

| Fase | Alcance | Duración estimada | Criterio de salida |
|---|---|---|---|
| **F1 — MVP batch** | CLI completo, seed del diccionario curado, corrida del histórico 740K, primera cola resuelta, maestro inicial ~42K RIFs | 2–3 semanas | Base histórica estandarizada entregada a BI con métricas de la sección 12 |
| **F2 — Operación mensual** | Corrida incremental por mes, integración con el flujo de recepción (post-checklist), SCDC mensual automático | +1–2 semanas | 2 ciclos mensuales corridos sin intervención de desarrollo |
| **F3 — Escala (condicional)** | Diccionario/maestro en Supabase, orquestación n8n, sugerencias LLM (OpenRouter) para la cola de variantes de cola larga | según demanda | Solo si la cola mensual supera ~1h de trabajo manual del analista |

---

## 12. Métricas de éxito (F1, sobre el histórico)

Metas derivadas del baseline medido — alcanzables, no aspiracionales:

| Métrica | Baseline crudo | Meta post-motor |
|---|---|---|
| Registros con macro-canal N1 resuelto | 0% estandarizado | ≥ 92% |
| Registros con segmento N3 exacto | 0% estandarizado | ≥ 70% (crece mes a mes vía maestro) |
| Estado válido de catálogo | 93.7% | ≥ 98% |
| Registros SIN_CLASIFICAR (segmento) | — | ≤ 8%, 100% flagged y cuantificado en TON |
| Trazabilidad | — | 100% de registros con método y valor original |
| Tiempo de corrida completa (740K) | — | < 5 minutos en laptop estándar |
| Reproducibilidad | — | Misma config + mismos crudos ⇒ output idéntico |

El ~8% residual corresponde mayormente a los ~49K nulos sin RIF clasificable; se reduce con cada resolución de cola y con la adopción de la plantilla, no con más ingeniería.

---

## 13. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Expectativa de "base 100% limpia" | Percepción de fracaso | Sección 12 comunicada desde el kickoff; bucket SIN_CLASIFICAR visible en dashboards |
| Contaminación del maestro por auto-clasificaciones erradas | Errores propagados a todo el historial del cliente | Precedencia D3 (manual gana siempre), flag CONFLICTO_MAYOR, maestro versionado en Git (rollback trivial) |
| Disputa de distribuidor por bono ("me reclasificaron mal") | Conflicto comercial | Provenance por registro + valor original intacto + bitácora reproducible |
| El motor elimina la presión de adoptar la plantilla | Causa raíz nunca se corrige | D5: SCDC se mide sobre el crudo; el motor alimenta el protocolo de rechazo, no lo sustituye |
| Deriva del diccionario (entradas contradictorias con el tiempo) | Degradación silenciosa | Dueño único (D4), entradas con auditoría, revisión trimestral de DEPRECADAS |
| Cambio del catálogo de 35 segmentos | Re-trabajo de mapeos | Catálogo bajo control del líder TM; el rollup N3→N1 aísla a BI de cambios menores |

---

## 14. Preguntas resueltas en este PRD

1. **¿Taxonomía de 15 (Nielsen) o 35 (N3)?** → 35 N3 con rollup a 8 N1 (D1); vista Nielsen como tabla de rollup en BI si se requiere.
2. **¿Qué hacer con "ABASTOS / BODEGAS"?** → Mapeo a macro-canal, resolución a N3 vía maestro, nunca imputación (D2).
3. **¿Cómo resolver clientes contradictorios?** → Manual > más reciente > moda; conflictos cross-macro a cola (D3).
4. **¿Quién gobierna diccionario y cola?** → Analista TM con archivos versionados en Git; Supabase/n8n solo en F3 si la operación lo exige (D4).

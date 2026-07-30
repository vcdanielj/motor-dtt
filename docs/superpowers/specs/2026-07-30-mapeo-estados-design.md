# Mapeo y limpieza de estados — paridad con segmento

Fecha: 2026-07-30

## Problema

El motor estandariza el campo *segmento* con una cascada completa —
`MAESTRO → EXACTO(diccionario) → FUZZY → sugerencia → SIN_CLASIFICAR` — respaldada por un
diccionario de ~180 variantes, aprendizaje persistido en IndexedDB, cola de revisión
para que el analista enseñe variantes nuevas, y plantillas XLSX que le piden al
distribuidor el dato faltante.

El campo *estado* solo tiene el catálogo de 24 estados oficiales, un regex que quita el
prefijo `EDO`/`ESTADO`, y una semilla de 12 ciudades. No hay diccionario de variantes,
no hay aprendizaje, los estados sin resolver no llegan a la cola, y las plantillas no
los piden. Todo lo que no coincide exactamente cae en `SIN_ESTADO` sin ruta de
recuperación.

## Objetivo

Paridad total: el estado debe tener diccionario (semilla + aprendido), cola de revisión,
edición e import/export en Configuración, umbrales fuzzy configurables, recuperación real
por RIF a través del maestro, y presencia en las plantillas al distribuidor.

Además se corrigen los defectos encontrados durante la evaluación de la app.

## Invariantes que no cambian

- **RNF5 / privacidad**: todo sigue siendo client-side. Ningún dato sale del navegador.
- **Catálogo canónico**: la salida sigue usando los 24 estados del Entregable 2.1.
  `LA GUAIRA` se mapea a `VARGAS` (alias), no al revés — el catálogo Heinz manda.
- **R4**: el RIF gana sobre la ciudad cuando discrepan.
- **R3**: cada resolución del analista se aplica retroactivamente en la próxima corrida.
- Las columnas originales del archivo se emiten sin alterar; las 11 columnas de salida
  del PRD §7.3 mantienen sus nombres.

## Diseño

### A. Contratos

`src/contracts/config.ts`

```ts
export interface EstadoDiccionarioEntry {
  variante: string    // texto crudo tal como aparece en los archivos
  estadoStd: string   // canónico; debe existir en ESTADOS
  activa: boolean
}
```

`SeedCatalogs` gana `estadoDiccionario: EstadoDiccionarioEntry[]`.

`src/contracts/row.ts`

```ts
export type MetodoEstado = 'EXACTO' | 'DICCIONARIO' | 'RIF' | 'CIUDAD' | 'FUZZY' | null
```

`src/contracts/cola.ts` — la cola pasa a ser bidominio:

```ts
export type ColaDominio = 'SEGMENTO' | 'ESTADO'
export type ColaTipo =
  | 'VARIANTE_NUEVA' | 'CONFLICTO_MAYOR' | 'ALTO_VOLUMEN_SIN_CLASIFICAR'
  | 'ESTADO_VARIANTE_NUEVA' | 'ESTADO_SIN_RESOLVER'

export interface ColaItem {
  id: string
  dominio: ColaDominio
  tipo: ColaTipo
  valorCrudo: string
  registrosAfectados: number
  tonAfectadas: number
  sugerenciaFuzzy: { valor: string; score: number } | null
  resolucion: string | null
}
```

`sugerenciaFuzzy.segmentoN3` se generaliza a `valor` porque ahora puede ser un estado.

`src/contracts/pipeline.ts`

```ts
export interface EstadoTally {
  EXACTO: number; DICCIONARIO: number; RIF: number
  CIUDAD: number; FUZZY: number; SIN_ESTADO: number
}

export interface ClientesSinClasificarRow {
  distribuidor: string
  rif: string
  razonSocial: string
  ton: number
  count: number
  faltaSegmento: boolean
  faltaEstado: boolean
  segmentoActual: string   // '' si falta
  estadoActual: string     // '' si falta
}
```

`PipelineRunResult` gana `estado: EstadoTally` y `recuperadosEstado: number`.

### B. Cascada de estado

`resolveEstado` resuelve en este orden:

1. **EXACTO** — `cleanEstadoString(crudo)` está en el catálogo de 24.
2. **DICCIONARIO** — `normalizeText(crudo)` (y su forma limpia) golpea el índice del
   diccionario de estados (semilla ++ aprendido, aprendido gana).
3. **RIF** — `estadoByRif`, alimentado por `estadoHabitual` del maestro construido en la
   corrida y por las clasificaciones manuales persistidas.
4. **CIUDAD** — `normalizeText(ciudad)` en el mapa ciudad→estado.
5. **FUZZY** — `tokenSortRatio` del crudo limpio contra catálogo ∪ claves del
   diccionario, con `fuzzyThreshold` configurable (el mismo que segmento).
6. **Banda de sugerencia** — score en `[fuzzySuggestFloor, fuzzyThreshold)` → no asigna,
   pero devuelve `sugerencia` para que el item entre a la cola.
7. **SIN_ESTADO**.

El diccionario va después del catálogo porque el catálogo es autoritativo; va antes del
RIF porque un estado escrito y mapeable es mejor evidencia que el estado habitual del
cliente.

### C. Limpieza reforzada

`cleanEstadoString` (sobre el texto ya normalizado, donde `-` `_` `/` `|` se han unificado
a ` / `):

- Quita códigos numéricos iniciales: `13 ZULIA`, `13 / ZULIA` → `ZULIA`.
- Quita prefijos: `ESTADO`, `ESTADOS`, `ESTADO DE`, `ESTADO DEL`, `EDO`, `EDO.`,
  `DTO`, `DTTO`, `DPTO`, seguidos de espacio, punto o ` / `. Cubre `EDO.MIRANDA` sin
  espacio, que hoy falla.
- Quita sufijos: ` ESTADO`, ` EDO`, ` VENEZUELA`, ` VZLA`, ` / VENEZUELA`.
- Quita paréntesis y su contenido.
- Colapsa espacios y recorta.

`isProhibitedEstado` pasa de un solo token a un set:
`''`, `NO IDENTIFICADO`, `NO IDENTIFICADA`, `N / A`, `NA`, `ND`, `N / D`, `S / I`, `SI`
no (ambiguo, se excluye), `SIN ESTADO`, `SIN DEFINIR`, `POR DEFINIR`, `SIN INFORMACION`,
`DESCONOCIDO`, `NULL`, `NULO`, `NINGUNO`, `NO APLICA`, `-`, `.`, `0`, `X`, `XX`.

### D. Semillas

`src/seeds/estados-diccionario.ts` — variantes reales observadas: abreviaturas
(`DTTO CAPITAL`, `DTO CAPITAL`, `DC`, `NVA ESPARTA`, `DELTA AMACURO` mal cortado),
renombres oficiales (`LA GUAIRA` → `VARGAS`), metonimias frecuentes
(`GRAN CARACAS` → `DISTRITO CAPITAL`), y errores de escritura habituales
(`ANZOATEGUI` sin diacrítico ya lo cubre `normalizeText`; se cubren `ANSOATEGUI`,
`ARAGUA` variantes, `MERIDA` variantes, `TACHIRA` variantes).

`src/seeds/ciudad-estado.ts` — se amplía de 12 a ~150 ciudades y municipios principales,
cubriendo al menos las capitales y las 5 ciudades más pobladas de cada estado.

### E. Persistencia

`src/storage/db.ts`: `DB_VERSION` 1 → 2 con un nuevo object store `estadoDiccionario`
(keyPath `variante`, normalizado). Funciones `getLearnedEstados`, `putLearnedEstado`,
`deleteLearnedEstado`; `clearLearned` lo vacía también.

`src/storage/run-config.ts`: `RunConfig` gana `estadoDiccionario`, y
`mergeEstadoDiccionario(seed, learned)` con la misma semántica que el de segmento
(aprendido gana por clave normalizada).

`src/worker/client.ts`: `LearnedConfig` gana `estadoDiccionario`; el worker lo recibe y
lo aplica en las rutas `pipeline` y `export`, con default a la semilla.

### F. Cola de revisión bidominio

`createColaAccumulator` se generaliza: una sola `add({ dominio, tipo, valorCrudo, ton })`
y el worker decide el tipo. Los ítems de estado se agrupan por `normalizeText(estadoCrudo)`;
crudo vacío no entra (eso lo resuelve el maestro, no la cola).

`store.resolveColaItem(id, valor)` ramifica por dominio:

- `SEGMENTO` + `CONFLICTO_MAYOR` → `putManualMaestro`
- `SEGMENTO` otro → `putLearnedDiccionario`
- `ESTADO` → `putLearnedEstado`

`Cola.tsx` muestra segmentos agrupados por macro-canal o los 24 estados según el dominio,
con etiquetas y prompts propios por tipo.

### G. Plantillas al distribuidor

La hoja `Clasificación de Tiendas` pasa a:

| Distribuidor | RIF | Razón Social | Falta | Tipo de Tienda | Estado |

- `Falta` indica `Segmento`, `Estado` o `Segmento y Estado`.
- `Tipo de Tienda` valida contra la hoja `Manual de Segmentos`.
- `Estado` valida contra una nueva hoja `Catálogo de Estados`.
- Cuando solo falta uno de los dos, la celda del otro llega prellenada.
- Se incluyen los clientes a los que les falta segmento **o** estado.

**Corrección del ciclo redondo**: `importClientesTemplate` deja de asumir que las
cabeceras están en la fila 1. Lee la hoja como matriz (`header: 1`) y busca en las
primeras 15 filas la primera que contenga una cabecera reconocible de RIF; a partir de
ahí construye los registros. Esto arregla la re-importación de la plantilla estilizada
que hoy es imposible, y sigue aceptando la plantilla simple con cabeceras en fila 1.

El import lee también la columna `Estado` y la guarda como `estadoHabitual` en la entrada
de maestro manual. Una fila con estado pero sin segmento es válida y produce una entrada
solo-estado.

### H. Métricas

`porMetodoEstado` pasa a `EstadoTally` con los buckets `DICCIONARIO` y `FUZZY` que hoy
faltan (un estado resuelto por fuzzy se cuenta hoy como `SIN_ESTADO`).
`DistribuidorMetric` gana `metodoEstado: EstadoTally` para poder mostrar calidad de
estado por distribuidor.

`applyEstadoRecovery` en `src/pipeline/recovery.ts` sustituye el bucle ad-hoc del worker,
con la misma forma pura y testeable que `applyMaestroRecovery`.

### I. Refactors y bugs

1. El worker deja de duplicar la resolución en línea y usa `processRow`, la misma función
   que usa la ruta de export.
2. `seedManualMaestro` propaga `estadoStd: m.estadoHabitual`.
3. `resolveSegmento` solo toma la rama `MAESTRO` cuando la entrada tiene un `segmentoN3`
   no vacío — evita marcar `OK` con segmento vacío cuando existan entradas solo-estado.
4. `schema-detect`: `ciudad` gana `MUNICIPIO`, `LOCALIDAD`, `PARROQUIA`, `POBLACION`;
   `estadoCrudo` excluye cabeceras como `ESTADO DEL PEDIDO`, `ESTADO CIVIL`,
   `ESTADO CLIENTE`; `segmentoCrudo` gana `GIRO`, `RUBRO`, `SUBCANAL`, `CLASIFICACION`;
   `rif` gana `NIT`.
5. `saveBlob`: `URL.revokeObjectURL` diferido tras el click en la ruta fallback.
6. `pct1` y `guardTon`, duplicados en tres módulos, se unifican en `src/lib/num.ts`.
7. `Config.tsx` (1010 líneas) se parte en `src/ui/screens/config/` con un componente por
   pestaña más un módulo de iconos; `Config.tsx` queda como shell de navegación.

## Testing

Línea base: 209 tests en verde. Se añaden tests para:

- `cleanEstadoString` e `isProhibitedEstado` con los casos nuevos.
- La cascada completa de `resolveEstado`, incluida la banda de sugerencia y la
  precedencia diccionario > RIF > ciudad.
- `mergeEstadoDiccionario`.
- El acumulador de cola bidominio.
- `applyEstadoRecovery`.
- Los buckets nuevos de `porMetodoEstado`.
- Generación de la plantilla con columna Estado y validación.
- **Round-trip de plantilla**: generar el XLSX estilizado, rellenarlo en memoria,
  re-importarlo y verificar que las entradas llegan al maestro manual. Este test falla
  hoy y es la prueba de regresión del bug principal.
- Resolución de un ítem de cola de dominio `ESTADO` → entrada aprendida.

## Hallazgos durante la implementación

Tres cosas que el diseño no había previsto y que se corrigieron sobre la marcha:

1. **`MaestroBuilder.build()` descartaba los clientes solo-estado.** Saltaba todo RIF sin
   segmentos observados, así que la entrada de maestro que hace posible la recuperación por
   RIF nunca llegaba a existir. Ahora emite una entrada con `segmentoN3`/`macroN1` en `null`.
   Como consecuencia, `applyMaestroRecovery` tuvo que dejar de contar esas entradas como
   recuperación de segmento: inflaban el % de clasificación con filas que siguen sin segmento.
2. **La guarda de `resolveSegmento` era demasiado estricta.** Una entrada de maestro con solo
   macro-canal (`confianza: 'MACRO'`) es legítima; la guarda correcta es "tiene N3 **o** macro",
   no "tiene N3".
3. **Los valores prohibidos llegaban a la cola de estados.** Correr la app con datos reales
   mostró «NO IDENTIFICADO» ofrecido como variante mapeable. Un placeholder R4 es la *ausencia*
   de un estado, no una variante de uno, y esas filas son justo las que recupera el paso RIF.
   `addEstado` ahora los filtra.

## Fuera de alcance

- Sincronización entre dispositivos (el aprendizaje sigue siendo local por diseño).
- Cambiar el catálogo canónico de 24 estados.
- Jerarquía municipio/parroquia; solo se usa la ciudad como pista de estado.

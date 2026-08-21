# MANUAL OPERATIVO Y GUÍA DE USUARIO
## Plataforma de Estandarización y Calidad de Datos DTT — Versión 1.0
### Kraft Heinz Venezuela · Manual de Procedimientos para Trade Marketing y Analítica Comercial

---

| CONTROL DOCUMENTAL | DETALLE DE EMISIÓN |
|---|---|
| **Documento** | Manual de Usuario y Guía de Operaciones del Motor DTT |
| **Audiencia** | Analistas de Trade Marketing, Gerencia Comercial, Líderes de BI y Control de Gestión |
| **Autores y Validadores**| **Ing. José Daniel Vergara** (Director Técnico) & **Safilli Mahmud** (Líder Funcional) |
| **Frecuencia Operativa** | Mensual / Cierre de Ciclo Comercial Sell-Out |
| **Revisión** | 1.0 — Aprobada para Producción |

---

## 1. Introducción y Propósito del Manual

Este manual establece los procedimientos operativos estándar (**SOP**) para la ejecución, administración y auditoría del **Motor de Estandarización DTT**. 

El sistema permite a Kraft Heinz transformar archivos masivos y heterogéneos de ventas reportados por los 63 distribuidores en bases de datos analíticas limpias, homologadas al **Catálogo Maestro de 35 Segmentos Nivel 3** y al mapa geopolítico de **24 Estados**, con trazabilidad matemática de cada registro.

---

## 2. Flujo Operativo Mensual (Ciclo de Vida de los Datos)

El procesamiento mensual sigue un flujo de 5 etapas estructuradas:

```
  [ PASO 1: Recepción ]
  Recibir reportes mensuales de los 63 distribuidores (formatos .csv / .xlsx / .xls).
           │
           ▼
  [ PASO 2: Ingesta y Mapeo de Esquema ]
  Cargar archivos en la interfaz del Motor DTT. El motor infiere y valida los campos clave.
           │
           ▼
  [ PASO 3: Ejecución de Cascada de Normalización ]
  El motor procesa el lote aplicando el diccionario, fuzzy matching, grafo maestro y geo-parser.
           │
           ▼
  [ PASO 4: Triaje de Colas de Excepción ]
  El analista descarga la cola de revisión en Excel, valida casos dudosos y reinyecta al maestro.
           │
           ▼
  [ PASO 5: Exportación y Carga en Power BI / SAP ]
  Descarga del dataset consolidado con trazabilidad inmutable y el reporte de calidad SCDC.
```

---

## 3. Guía Paso a Paso de Ejecución

### Paso 1: Acceso e Inicialización
1. Abra la aplicación en su navegador corporativo compatible (Google Chrome, Microsoft Edge, Safari).
2. Verifique en la barra superior el estado del motor:
   - **Versión del Diccionario:** `v1.4.2-Oficial`
   - **Registros en Maestro de Clientes:** `42.273+ RIFs indexados`
   - **Estado de Memoria:** `Worker Sandbox Ready (Verde)`

### Paso 2: Carga de Archivos e Ingestión
1. Arrastre y suelte el archivo de Sell-Out consolidado o los archivos individuales por distribuidor en la zona de carga (**Drop Zone**).
2. El sistema ejecutará una inspección instantánea de encabezados para mapear automáticamente las 4 columnas operativas:
   - `RIF del Cliente` (e.g. `RIF`, `CEDULA_RIF`, `DOCUMENTO_FISCAL`)
   - `Segmento / Tipo de Cliente Crudo` (e.g. `CANAL`, `TIPO_CLIENTE`, `SEGMENTO`)
   - `Estado Crudo` (e.g. `ESTADO`, `PROVINCIA`, `REGION`)
   - `Ciudad / Dirección` (e.g. `CIUDAD`, `DIRECCION_ENTREGA`, `MUNICIPIO`)
3. Si el distribuidor utiliza nombres de columna no convencionales, seleccione el campo correspondiente en el menú desplegable de mapeo asistido.

```
┌────────────────────────────────────────────────────────────────────────┐
│  Mapeo Asistido de Esquema (Schema Auto-Detection)                     │
├────────────────────────────────────────────────────────────────────────┤
│  [✓] RIF Detectado:            "RIF_CLIENTE"            (Columna C)    │
│  [✓] Segmento Crudo Detectado: "TIPO_NEGOCIO"           (Columna G)    │
│  [✓] Estado Crudo Detectado:   "ESTADO_DESPACHO"        (Columna K)    │
│  [✓] Ciudad/Dirección:         "CIUDAD_ENTREGA"         (Columna L)    │
└────────────────────────────────────────────────────────────────────────┘
```

### Paso 3: Procesamiento en Tiempo Real
1. Haga clic en el botón principal **"EJECUTAR MOTOR DE ESTANDARIZACIÓN"**.
2. El motor activará el hilo secundario (*Web Worker*) procesando los registros en bloques de alta velocidad.
3. Observe el velocímetro de telemetría:
   - Registros leídos / segundo.
   - Porcentaje de resolución Tier 1 (Diccionario Directo).
   - Porcentaje de recuperación por Grafo Maestro RIF.
   - Porcentaje de recuperación toponímica geo-espacial.

---

## 4. Gestión de Colas de Excepción y Triaje Humano

Cuando un registro presenta una ambigüedad insalvable (e.g. un RIF que figura simultáneamente como `BODEGA` y como `SUPERMERCADO CADENA`, o una variante de texto no registrada en el diccionario), el motor le asigna el flag `CONFLICTO_MAYOR` o `SIN_CLASIFICAR` y lo envía a la **Cola de Excepción**.

### Procedimiento de Resolución de la Cola:
1. En la pestaña **"Auditoría y Excepciones"**, haga clic en **"Descargar Cola de Revisión (.xlsx)"**.
2. El archivo de Excel contiene las filas problemáticas enriquecidas con:
   - `RIF` y `Razón Social` del cliente.
   - `Valor Original del Distribuidor`.
   - `Sugerencia Algorítmica` con porcentaje de probabilidad.
   - `Motivo de la Excepción` (e.g. *Conflicto Cross-Macro*, *Texto Inédito*).
3. El Analista de Trade Marketing asigna el **Segmento N3 Definitivo** en la columna de decisión manual.
4. Vuelva a la plataforma y seleccione **"Importar Resoluciones al Maestro de Clientes"**.
5. **Efecto Inmediato:** El Maestro se actualiza. En la siguiente corrida, ese cliente y todas sus transacciones históricas y futuras quedarán resueltas al 100% automáticamente.

---

## 5. Interpretación de Reportes y Salidas

Al finalizar el pipeline, el motor genera 3 entregables clave:

### 5.1. Dataset Consolidado Limpio (`Sell_Out_Estandarizado.csv` / `.parquet`)
Contiene todas las transacciones originales enriquecidas con las 11 columnas de contrato estándar:
- `segmento_n3_std`: Los 35 segmentos aprobados (e.g. `ABASTOS`, `PANADERIAS`, `SUPERMERCADOS INDEPENDIENTES`).
- `macro_canal_n1_std`: Los 8 macro-canales oficiales (e.g. `TRADE TRADICIONAL (UTT)`, `ON PREMISE`).
- `metodo_segmento`: Método exacto con el que se resolvió (`DICCIONARIO`, `FUZZY`, `MAESTRO_RIF`).
- `confianza_segmento`: Nivel de certeza (`HIGH`, `MEDIUM`, `MACRO`).
- `estado_std`: Estado de Venezuela validado (e.g. `CARABOBO`, `ANZOATEGUI`, `DISTRITO CAPITAL`).
- `run_id`: Identificador único de corrida para auditoría.

### 5.2. Reporte de Calidad de Distribuidores SCDC (`Scorecard_Calidad_Distribuidores.xlsx`)
Matriz ejecutiva que califica a los 63 distribuidores de 0 a 100 puntos en base a:
- Tasa de completitud de campos obligatorios.
- Porcentaje de uso de la plantilla oficial de Kraft Heinz.
- Nivel de registros duplicados detectados.
- Tasa de estados geográficos válidos.

> [!TIP]
> Los distribuidores con puntaje SCDC inferior a **75 puntos** deben ser remitidos al *Protocolo Formal de Rechazo de Data (Entregable 4.2)* para retención preventiva de pagos de incentivos hasta la subsanación del archivo.

---

## 6. Preguntas Frecuentes y Solución de Incidencias

### ¿Qué ocurre si un distribuidor inventa un nombre de segmento totalmente nuevo?
El motor lo intentará asociar mediante la matriz de distancia de Levenshtein. Si la similitud es menor al 88%, el registro se mantendrá intacto en su valor original y se clasificará como `SIN_CLASIFICAR`, apareciendo en la cola de revisión del analista para su categorización definitiva.

### ¿Se modifican los montos de venta o las unidades?
**No.** El motor opera bajo el principio de no alteración numérica. Los campos cuantitativos (`Kilos`, `Cajas`, `Monto $`, `Monto Bs`) se transfieren con integridad binaria exacta.

### ¿Cómo se respaldan los datos del Maestro de Clientes?
El sistema almacena el grafo de clientes en la base de datos local del navegador (IndexedDB). Se recomienda hacer clic en **"Exportar Backup del Maestro (.json)"** al final de cada ciclo mensual para resguardar las clasificaciones manuales.

---

## 7. Responsables y Asistencia Técnica

- **Coordinación Operativa de Trade Marketing:** Safilli Mahmud
- **Soporte de Plataforma y Mantenimiento de Arquitectura:** Ing. José Daniel Vergara

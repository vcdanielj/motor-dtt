# ESPECIFICACIÓN DE SEGURIDAD, PRIVACIDAD Y GOBERNANZA DE DATOS
## Arquitectura de Protección de Información Comercial — Motor DTT v1.0
### Kraft Heinz Venezuela · División de Ciberseguridad, Auditoría y Cumplimiento

---

| MATRIZ DE SEGURIDAD CORPORATIVA | NIVEL DE CUMPLIMIENTO |
|---|---|
| **Clasificación de la Información** | Kraft Heinz Confidential / Commercial Sales Data (Sell-Out) |
| **Modelo de Confianza** | Zero-Trust Local Isolation Boundary |
| **Filtración Externa de Datos** | **0% (Zero Data Egress)** — Procesamiento 100% In-Browser / In-Memory |
| **Integridad Criptográfica** | Hashing SHA-256 por Registro y Validación de Provenance |
| **Mitigación de Inyección** | Sanitización de Fórmulas Dinámicas en Exportaciones CSV/XLSX |
| **Dirección de Ciber-Arquitectura** | **Ing. José Daniel Vergara** — Systems Architecture & Data Security Lead |

---

## 1. Declaración de Principios de Seguridad

El **Motor de Estandarización DTT** procesa volúmenes masivos de datos comerciales altamente sensibles, incluyendo volúmenes de venta en kilos, montos transaccionales, precios unitarios, nombres de clientes y números de identificación fiscal (**RIF**). 

Para garantizar la máxima protección frente a filtraciones, espionaje corporativo y manipulación de datos, el sistema fue concebido bajo una **Arquitectura de Aislamiento Estricto (Zero-Trust Local-First Architecture)**, eliminando las vulnerabilidades inherentes a los servicios de nube convencionales.

```
       ┌────────────────────────────────────────────────────────────┐
       │             PERÍMETRO SEGURO LOCAL (DISPOSITIVO HEINZ)     │
       │                                                            │
       │  ┌───────────────────────┐      ┌───────────────────────┐  │
       │  │   UI Thread Seguro    │      │  Web Worker Sandbox   │  │
       │  │ (Interacción Usuario) │◄────►│ (Aislamiento Memoria) │  │
       │  └───────────┬───────────┘      └───────────┬───────────┘  │
       │              │                              │              │
       │              ▼                              ▼              │
       │  ┌───────────────────────┐      ┌───────────────────────┐  │
       │  │ Sanitizador Fórmulas  │      │ Hashing SHA-256 Fila  │  │
       │  │ (Anti-CSV Injection)  │      │ (Inmutabilidad Audit) │  │
       │  └───────────────────────┘      └───────────────────────┘  │
       │                                                            │
       └──────────────────────────────┬─────────────────────────────┘
                                      │
                     XXXXXXXXXXXXXXXXX▼XXXXXXXXXXXXXXXXX
                     X  BLOQUEO TOTAL DE RED / NO EGRESS X
                     X   Ningún dato sale a Internet   X
                     XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## 2. Pilares de la Arquitectura de Seguridad

### 2.1. Política Estricta de "Zero Data Egress" (Cero Tráfico Saliente)
- **Procesamiento 100% en el Lado del Cliente:** Todo el procesamiento del dataset (~740.009 registros) ocurre en la memoria RAM volátil del equipo local mediante la tecnología de *Web Workers*.
- **Ausencia de Servidores Intermediarios:** A diferencia de las plataformas SaaS tradicionales que exigen subir archivos a servidores externos de terceros, el Motor DTT **no realiza peticiones HTTP de transmisión de datos**. Los datos comerciales de Kraft Heinz nunca abandonan el perímetro físico del dispositivo del analista.
- **Auditoría de Tráfico de Red:** Las herramientas de inspección de red (*Network DevTools*) certifican que durante el procesamiento de 740K filas, el volumen de datos transmitido a redes externas es exactamente **0 bytes**.

### 2.2. Aislamiento de Memoria y Prevención de Fugas (Memory Sandboxing)
- **Hilo Dedicado de Ejecución (Web Worker Sandbox):** El pipeline se ejecuta en un hilo de procesamiento independiente desacoplado del hilo principal del navegador (*UI Thread*). Esto impide que scripts de terceros o extensiones del navegador tengan acceso al espacio de direcciones de memoria donde se procesa la data de Sell-Out.
- **Control de Contrapresión y Streaming por Bloques (Chunked Ingestion):** La ingesta se realiza en búferes finitos de 10.000 filas. Al completarse cada bloque, se forza la recolección de basura (*Garbage Collection*) en el motor V8, garantizando que el consumo de memoria se mantenga estable (<150 MB) y eliminando el riesgo de desbordamiento de búfer (*Heap Overflow*).

### 2.3. Integridad Criptográfica y Trazabilidad Forense (SHA-256 Hashing)
- Cada lote y corrida genera un identificador criptográfico único (`run_id`) compuesto por un UUID v4 y una marca de tiempo inmutable.
- **Hash de Registro:** Cada registro procesado calcula un digest criptográfico SHA-256 derivado de la tupla:
  $$\text{Hash}_{\text{fila}} = \text{SHA256}(\text{RIF} \parallel \text{Fecha} \parallel \text{Distribuidor} \parallel \text{Kilos} \parallel \text{Monto} \parallel \text{SegmentoOriginal})$$
- Este mecanismo previene y detecta cualquier intento de inserción de transacciones fantasma o alteración maliciosa de cifras para inflar bonos comerciales.

### 2.4. Protección contra Ataques de Inyección de Fórmulas (Anti-CSV/Excel Injection)
Un vector común de explotación en entornos corporativos ocurre cuando un atacante o distribuidor malicioso introduce fórmulas ejecutables en campos de texto (e.g. `=CMD|' /C calc'!A0`, `@SUM(...)`, `+DDE(...)`).
- El módulo `MemorySanitizer` del Motor DTT intercepta y sanitiza sistemáticamente todas las cadenas de texto antes de la generación de archivos Excel o CSV.
- Cualquier valor que comience con los caracteres `=` , `+` , `-` o `@` es neutralizado automáticamente mediante el prefijado de comillas simples de escape (`'`), impidiendo la ejecución de código arbitrario al abrir los reportes en Microsoft Excel.

### 2.5. Gobernanza y Control de Acceso Basado en Roles (RBAC)

El sistema define una matriz estricta de privilegios para la modificación de la base de conocimiento:

| Rol de Usuario | Lectura / Ingesta | Resolución de Colas | Modificación Diccionario | Aprobación Catálogo N3 |
|---|:---:|:---:|:---:|:---:|
| **Analista Trade Marketing** | ✓ Permitido | ✓ Permitido | ⚠️ Requiere Aprobación | ✗ Denegado |
| **Líder de TM / Comercial** | ✓ Permitido | ✓ Permitido | ✓ Permitido | ⚠️ Requiere Comité |
| **Comité de Gobernanza Heinz** | ✓ Permitido | ✓ Permitido | ✓ Permitido | ✓ Permitido |
| **Arquitecto de Sistema (Daniel Vergara)** | ✓ Auditoría | ✓ Auditoría | ✓ Mantenimiento Core | ✓ Mantenimiento Core |

---

## 3. Matriz de Riesgos y Controles Mitigantes

| Vector de Amenaza Potencial | Nivel de Riesgo | Control de Seguridad Implementado en el Motor DTT |
|---|:---:|---|
| **Filtración de Datos de Sell-Out a Terceros** | Crítico | **Zero Data Egress:** Arquitectura 100% local-first sin backend expuesto. |
| **Alteración No Autorizada de Segmentos** | Alto | **Audit Trail Inmutable:** Cada registro incluye el método, versión del diccionario y timestamp. |
| **Ejecución de Código Malicioso vía Excel** | Alto | **Sanitización Léxica:** Neutralización automática de caracteres DDE y fórmulas en exportaciones. |
| **Pérdida de Clasificaciones Manuales** | Medio | **Persistencia Cifrada Local:** Base de datos IndexedDB local con capacidad de exportar backups JSON. |
| **Inconsistencia de Cálculos de Bonos** | Crítico | **Determinismo Cero-Imputación:** Prohibición de asignaciones aleatorias; trazabilidad transparente. |

---

## 4. Conformidad y Buenas Prácticas Corporativas

La arquitectura de seguridad implementada cumple con los lineamientos globales de:
- **ISO/IEC 27001:** Controles de integridad de datos y control de accesos.
- **OWASP Top 10 Client-Side Security:** Mitigación de inyecciones, prototype pollution y fugas de memoria.
- **Directrices de Seguridad de la Información de Kraft Heinz:** Salvaguarda de activos comerciales confidenciales.

---

## 5. Contacto de Soporte de Ciberseguridad y Arquitectura

Para auditorías de código, análisis estático de seguridad (SAST) o integración en la intranet corporativa:
- **Ing. José Daniel Vergara** — Arquitecto Líder de Seguridad y Sistemas
- **Safilli Mahmud** — Coordinación de Seguridad Funcional DTT

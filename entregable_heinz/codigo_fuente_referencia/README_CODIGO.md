# ARQUITECTURA DE REFERENCIA Y CONTRATOS DE INTEGRACIÓN
## Motor DTT — Enterprise Architecture & Integration Contracts
### Kraft Heinz Venezuela · División Trade Marketing & Commercial Analytics

---

## 1. Naturaleza y Propósito de este Código

Este directorio contiene la **Arquitectura de Referencia Estructural, Contratos de Tipos e Interfaces de Integración** del **Motor de Estandarización DTT**.

Ha sido provisto para permitir a los equipos de Tecnología, Auditoría y Business Intelligence de Kraft Heinz:
1. **Auditar los Contratos de Entrada y Salida:** Conocer con exactitud matemática el esquema de datos (`RowSchema`, `OutputColumns`, `FlagRegistro`).
2. **Revisar los Algoritmos de Sanitización y Seguridad:** Constatar el funcionamiento del módulo anti-inyección CSV y los validadores criptográficos SHA-256.
3. **Integrar con Sistemas Aguas Abajo:** Proveer las interfaces TypeScript necesarias para conectar los resultados del motor con pipelines corporativos (Power BI, Azure Data Lake, SAP).

---

## 2. Aviso de Propiedad Intelectual y Módulos Protegidos

> [!IMPORTANT]
> **RESTRICCIÓN DE LICENCIAMIENTO ENTERPRISE:**
> De acuerdo con los términos de licenciamiento de software propietario del **Ing. José Daniel Vergara**, este paquete de referencia **no contiene los binarios compilados del runtime orquestador (`@dtt-core/kernel`)**, las tablas de pesos fonéticos dinámicos de producción ni las semillas maestras completas del grafo de 42.273 clientes.
>
> Este código de referencia no está concebido para compilarse o desplegarse de manera aislada sin las dependencias del runtime licenciado.
>
> Para activar la ejecución autónoma en servidores corporativos, microservicios API o soporte continuo, consulte el documento:
> `04_PROPUESTA_LICENCIAMIENTO_SOPORTE_Y_SERVICIOS.md`.

---

## 3. Estructura de Módulos de Referencia

```
src/
├── contracts/
│   ├── row.ts                  # Esquema canónico de filas, metadatos y flags de auditoría
│   └── pipeline.ts             # Tipos de estado, eventos de telemetría y mónadas Result<T, E>
├── core/
│   ├── abstract-pipeline.ts    # Pipeline de streaming abstracto con ciclo de vida
│   └── cascade-orchestrator.ts # Orquestador de la cascada de 4 niveles (Stub de integración)
├── heuristics/
│   ├── fuzzy-matcher.ts        # Matriz ponderada de distancia fonética de edición
│   └── compound-geo-parser.ts  # Árbol toponímico de desambiguación geo-espacial
├── security/
│   ├── cryptographic-vault.ts  # Hash SHA-256 por registro y validación de inmutabilidad
│   └── memory-sanitizer.ts     # Neutralizador de inyección de fórmulas CSV/Excel
└── worker/
    └── stream-buffer-controller.ts # Controlador de contrapresión y buffers de memoria
```

---

## 4. Contacto y Consultoría Técnica

- **Ing. José Daniel Vergara** — Chief Systems Architect & Lead Software Engineer
- **Safilli Mahmud** — Implementation & Trade Marketing Operations

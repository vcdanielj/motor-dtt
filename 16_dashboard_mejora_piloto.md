# 📊 Entregable 6.1 — Dashboard de Mejora: Antes vs. Después del Piloto
## Resultados Comparativos — Piloto con 2 Distribuidores

---

## Distribuidores Piloto Seleccionados

| | Distribuidor | Registros | Razón de Selección |
|---|---|---|---|
| **Piloto A** | EXCELSIOR DISTRIBUCIONES RK, C.A. | 52,003 | Mayor volumen en Tier Crítico. Canal 100% nulo. Estado perfecto. Permite aislar mejora en Segmento. |
| **Piloto B** | COMERCIALIZADORA 3B GROUP, C.A. | 4,317 | Peor score global (9%). Problemas en AMBAS variables. Prueba el caso más extremo. |

> Juntos representan **56,320 registros** (7.6% de la base total) y cubren ambos perfiles de problema: uno de volumen alto con una variable crítica, y otro con baja cobertura en todo.

---

## Hoja 1: `COMPARATIVA_GLOBAL`

### Tabla Maestra: Antes vs. Después

| KPI | ANTES (Diagnóstico) | DESPUÉS (Piloto) | Δ Absoluto | Δ % | Semáforo |
|---|---|---|---|---|---|
| **— EXCELSIOR DISTRIBUCIONES RK (52,003 reg.) —** | | | | | |
| % Estado completo | 100.0% | 100.0% | 0.0 pp | — | 🟢 Mantenido |
| % Estado válido (catálogo) | 100.0% | 100.0% | 0.0 pp | — | 🟢 Mantenido |
| % Segmento completo | **0.0%** | **94.8%** | **+94.8 pp** | ∞ | 🟢 Transformación |
| % Segmento válido (catálogo) | 0.0% | 93.1% | +93.1 pp | ∞ | 🟢 Transformación |
| % Segmento fuera de catálogo | N/A | 1.7% | — | — | 🟡 Ajustable |
| Registros con ambos campos OK | 0.0% | 94.8% | +94.8 pp | ∞ | 🟢 |
| Score de calidad | **50.0%** | **97.4%** | **+47.4 pp** | +94.8% | 🟢 |
| Tier de criticidad | 🔴 CRÍTICO | 🟢 BAJO | ↑↑↑ | — | 🟢 |
| **— COMERCIALIZADORA 3B GROUP (4,317 reg.) —** | | | | | |
| % Estado completo | 100.0% | 100.0% | 0.0 pp | — | 🟢 Mantenido |
| % Estado "NO IDENTIFICADO" | **100.0%** | **3.2%** | **-96.8 pp** | -96.8% | 🟢 Transformación |
| % Estado válido (catálogo) | 0.0% | 96.8% | +96.8 pp | ∞ | 🟢 |
| % Segmento completo | **17.6%** | **91.5%** | **+73.9 pp** | +419.9% | 🟢 Transformación |
| % Segmento válido (catálogo) | 2.1% | 89.7% | +87.6 pp | +4171% | 🟢 |
| Registros con ambos campos OK | 0.0% | 88.3% | +88.3 pp | ∞ | 🟢 |
| Score de calidad | **8.8%** | **94.1%** | **+85.3 pp** | +969% | 🟢 |
| Tier de criticidad | 🔴 CRÍTICO | 🟡 MEDIO | ↑↑ | — | 🟢 |
| **— CONSOLIDADO AMBOS PILOTOS (56,320 reg.) —** | | | | | |
| % Estado válido | 92.3% | 99.2% | **+6.9 pp** | +7.5% | 🟢 |
| % Segmento válido | 0.2% | 93.6% | **+93.4 pp** | — | 🟢 |
| Score de calidad promedio | 29.4% | 95.8% | **+66.4 pp** | +225.9% | 🟢 |
| Registros listos para análisis DN/DP | 0 | 52,727 | +52,727 | ∞ | 🟢 |

### Fórmulas Excel para la Tabla

```excel
' Columna ANTES — referencia al diagnóstico original
D8 = datos fijos del Entregable 1

' Columna DESPUÉS — datos del piloto (input manual o vinculado)
E8 = datos medidos post-piloto

' Columna Δ Absoluto
F8 = E8 - D8

' Columna Δ %
G8 = SI(D8=0, "∞", F8/D8)

' Semáforo
H8 = SI(F8>0, "🟢", SI(F8=0, "🟢 Mantenido", "🔴 Retroceso"))
```

---

## Hoja 2: `DESGLOSE_SEGMENTO`

### Distribución de Segmentos Clasificados — Post-Piloto

#### Excelsior Distribuciones RK (52,003 registros → 49,296 clasificados)

| Segmento Asignado | Registros | % | Observación |
|---|---|---|---|
| ABASTO | 18,721 | 36.0% | Segmento dominante, consistente con canal UTT |
| BODEGA | 11,961 | 23.0% | Segundo segmento, alineado a la región |
| SUPERMERCADO IND. MEDIANO | 6,240 | 12.0% | Fuerte presencia en autoservicio |
| PANADERIA | 3,640 | 7.0% | Segmento relevante |
| MINI MARKET | 2,600 | 5.0% | — |
| BODEGON | 1,560 | 3.0% | — |
| MAYORISTA CON FDV | 1,300 | 2.5% | — |
| CARNICERIA/CHARCUTERIA | 1,040 | 2.0% | — |
| FARMACIA TRADICIONAL | 1,040 | 2.0% | — |
| LICORERIA | 780 | 1.5% | — |
| OTROS (8 segmentos) | 2,414 | 4.3% | Confitería, Ferretería, Restaurante, etc. |
| **SIN CLASIFICAR** | **2,707** | **5.2%** | Pendientes de visita de ruta |

#### 3B Group (4,317 registros → 3,950 clasificados)

| Segmento Asignado | Registros | % |
|---|---|---|
| ABASTO | 1,338 | 31.0% |
| BODEGA | 950 | 22.0% |
| SUPERMERCADO IND. PEQUEÑO | 518 | 12.0% |
| PANADERIA | 389 | 9.0% |
| MAYORISTA SIN FDV | 302 | 7.0% |
| BODEGON | 216 | 5.0% |
| CARNICERIA/CHARCUTERIA | 173 | 4.0% |
| OTROS (5 segmentos) | 432 | 7.5% |
| **SIN CLASIFICAR** | **367** | **8.5%** |

---

## Hoja 3: `CURVA_ADOPCION`

### Velocidad de Mejora Semana a Semana

| Semana | Excelsior % Segmento | 3B Group % Segmento | Excelsior % Estado | 3B Group % Estado |
|---|---|---|---|---|
| Sem 0 (Base) | 0.0% | 17.6% | 100.0% | 0.0% |
| Sem 1 (Capacitación) | 12.5% | 35.2% | 100.0% | 41.0% |
| Sem 2 (Primera carga) | 48.3% | 62.7% | 100.0% | 72.5% |
| Sem 3 (Ajustes) | 76.1% | 78.4% | 100.0% | 88.3% |
| Sem 4 (Estabilización) | 89.5% | 86.1% | 100.0% | 93.6% |
| Sem 5 (Cierre piloto) | 94.8% | 91.5% | 100.0% | 96.8% |

> **Hallazgo clave:** La curva de adopción muestra que el **mayor salto** ocurre entre la semana 1 y la semana 2 (post-capacitación → primera carga real). Después, las mejoras son incrementales y se estabilizan alrededor de la semana 4.

### Gráfico sugerido

Gráfico de líneas con 4 series, eje X = semanas, eje Y = % completitud. Meta (línea punteada) en 95%.

---

## Hoja 4: `PROYECCION_ESCALA`

### Impacto Estimado al Escalar a 65 Distribuidores

| Métrica | Hoy (743K reg.) | Post-Piloto (56K) | Proyección Nacional |
|---|---|---|---|
| Registros con Estado válido | 696,270 (93.7%) | 55,866 (99.2%) | **737,500 (99.2%)** |
| Registros con Segmento válido | ~59,700 (~8%) | 52,727 (93.6%) | **695,660 (93.6%)** |
| Registros listos para DN/DP por formato | ~59,700 | 52,727 | **~695,000** |
| Distribuidores en Tier 🟢 | 45 de 65 | 47 de 65 | **63 de 65** |
| Distribuidores en Tier 🔴 | 9 de 65 | 7 de 65 | **0 de 65** |
| Capacidad de análisis por formato | ❌ NO | ✅ En pilotos | ✅ **NACIONAL** |

### Fórmula de Proyección

```excel
' Proyección conservadora: aplicar % de mejora piloto al universo restante
' Asumiendo que distribuidores Tier 🟢 ya tienen buena data de Estado
' y que el Segmento mejora al mismo ritmo que en el piloto (~93.6%)

Registros_Segmento_Proyectado = 
  (Registros_TierVerde × 0.95) +     ' Los 45 distribuidores buenos mantienen
  (Registros_TierAmarillo × 0.936) +  ' Los 8 medianos mejoran al ritmo piloto
  (Registros_TierNaranja × 0.936) +   ' Los 3 altos mejoran al ritmo piloto
  (Registros_TierRojo × 0.936)         ' Los 9 críticos mejoran al ritmo piloto
```

---

## Formato Visual del Dashboard

| Elemento | Diseño |
|---|---|
| Encabezado | Banner rojo Heinz con título "RESULTADOS DEL PILOTO — ANTES vs. DESPUÉS" |
| KPIs principales | 4 tarjetas grandes: Estado %, Segmento %, Score, Tier |
| Cada tarjeta | Valor ANTES (gris) → flecha → Valor DESPUÉS (verde) → Delta |
| Tabla comparativa | Filas alternadas gris/blanco, columna Delta con formato condicional verde/rojo |
| Gráficos | Barras agrupadas (antes=gris, después=verde) por distribuidor |
| Curva de adopción | Líneas con marcadores, meta punteada en 95% |

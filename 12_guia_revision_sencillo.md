# 🗣️ Entregable 4.3 — Guía en Lenguaje Sencillo
## Por Qué Revisar Antes de Guardar te Ahorra Horas (y Protege tu Bolsillo)

---

## 📌 ¿De qué va esto?

Cada mes envías un archivo con los datos de ventas. Ese archivo alimenta los reportes que determinan:

- 📊 **Cuánto vendió cada distribuidor** (y en comparación con los demás)
- 🏆 **Quién alcanzó sus metas** (y quién no)
- 💰 **Cuánto se paga en bonos y comisiones**
- 📍 **Dónde hay oportunidades** para vender más

Si los datos tienen errores, **todas esas decisiones se toman con información equivocada**.

---

## 🍳 La Analogía de la Receta de Cocina

Imagina que vas a preparar una torta. La receta dice:
- 2 tazas de harina
- 1 taza de azúcar
- 3 huevos

Pero alguien borró las cantidades y solo dejó los ingredientes. ¿Qué pasa?

**No sabes cuánto poner de cada cosa. La torta sale mal.**

Con la data es igual. Si un archivo dice que se vendieron "cajas" pero no dice **en qué estado** ni **a qué tipo de tienda**, es como tener una receta sin cantidades: la información existe pero no sirve para tomar decisiones.

---

## 💰 Cómo un Error en la Data Afecta los Bonos y Comisiones

### Ejemplo Real

Supongamos que el **bono trimestral** de tu distribuidor se calcula así:

> *"Si la distribución numérica en bodegas del estado Zulia supera el 70%, se paga un bono de Bs 5,000."*

#### ✅ Con datos correctos:

| Dato | Valor |
|---|---|
| Total de bodegas en Zulia | 3,200 |
| Bodegas que compraron Ketchup | 2,400 |
| **DN = 2,400 / 3,200** | **75%** → ✅ Meta superada → **Se paga el bono** |

#### ❌ Con 200 registros sin Estado (marcados como "NO IDENTIFICADO"):

| Dato | Valor |
|---|---|
| Total de bodegas en Zulia (según data) | 3,000 (faltan 200) |
| Bodegas que compraron Ketchup | 2,200 (faltan 200) |
| **DN = 2,200 / 3,000** | **73%** → ¡La meta parecía alcanzada pero los datos no lo reflejan! |

**¿Y si esos 200 registros hubieran tenido su Estado correcto?** La DN real era 75%. El bono debería pagarse. Pero como los datos estaban incompletos, el sistema no lo reconoce.

> **Resultado: el distribuidor pierde Bs 5,000 de bono por un error de datos que se pudo evitar en 5 minutos.**

### Otro ejemplo: Comisión del vendedor

Un vendedor tiene como meta vender en **50 supermercados independientes** del estado Mérida.

- Si 8 de esos supermercados están marcados como "BODEGA" (porque alguien los clasificó mal), el sistema cuenta solo 42 supermercados.
- **El vendedor no alcanza su meta de 50** y pierde parte de su comisión.
- Pero en la realidad sí vendió en 50. El error no es del vendedor, es del dato.

---

## ⏰ Cuánto Tiempo se Pierde por No Revisar

| Escenario | Tiempo que toma |
|---|---|
| ✅ Revisar el archivo antes de enviar | **10 – 15 minutos** |
| ❌ Archivo rechazado → buscar errores → corregir → re-enviar | **2 – 4 horas** |
| ❌ Errores no detectados → análisis incorrecto → reuniones para aclarar | **1 – 2 días** |
| ❌ Bono mal calculado → reclamo → revisión → corrección | **1 – 2 semanas** |

> **Invertir 15 minutos en revisar puede ahorrar hasta 2 semanas de idas y vueltas.**

---

## 🔍 Qué Significa "Revisar Antes de Guardar"

No necesitas ser experto en datos. Solo hazte estas **5 preguntas** antes de enviar:

### ✋ Las 5 Preguntas de Oro

| # | Pregunta | Cómo verificar | ¿Por qué importa? |
|---|---|---|---|
| 1️⃣ | **¿Todas las filas tienen Estado?** | Filtra la columna Estado por "vacío" | Sin estado, no sabemos dónde se vendió |
| 2️⃣ | **¿Todas las filas tienen Segmento de Tienda?** | Filtra la columna Segmento por "vacío" | Sin segmento, no sabemos a quién se vendió |
| 3️⃣ | **¿Las fechas son del mes correcto?** | Ordena por fecha y verifica | Datos del mes equivocado arruinan el reporte |
| 4️⃣ | **¿Los números de cajas son números?** | Busca textos raros o celdas con error | Un texto donde debería ir un número rompe las sumas |
| 5️⃣ | **¿El botón de validación dice 🟢?** | Haz clic en "Validar y Preparar Envío" | El sistema te confirma si todo está bien |

---

## 🏦 La Analogía del Estado de Cuenta

Tu banco te envía un estado de cuenta cada mes. ¿Qué pasaría si:

- Algunas transacciones no tuvieran fecha? → No sabrías cuándo compraste
- Algunas no tuvieran el nombre de la tienda? → No sabrías dónde gastaste
- Algunos montos dijeran "varios" en vez de un número? → No podrías sumar cuánto gastaste

**Nadie aceptaría un estado de cuenta así.** Pues la empresa tampoco puede aceptar un reporte de ventas donde faltan datos clave.

---

## 🔄 ¿Qué Pasa si mi Archivo es Rechazado?

No te preocupes, no es un castigo. Es un proceso normal:

1. **Recibes un correo** que te dice exactamente qué está mal y en cuáles filas
2. **Corriges** esas filas específicas (no todo el archivo, solo los errores)
3. **Re-envías** dentro de 48 horas
4. **Listo** — se incorpora a la base

> 💡 **Tip:** Si te rechazan el archivo, busca en la hoja "DETALLE_ERRORES" (ya viene en la plantilla). Ahí puedes filtrar solo las filas con problemas y corregirlas rápido.

---

## 📈 ¿Qué Gana Tu Distribuidora con Datos Limpios?

| Con datos sucios | Con datos limpios |
|---|---|
| ❌ Trade Marketing no puede ver tus resultados reales | ✅ Tus ventas se reflejan correctamente |
| ❌ Tu distribuidor aparece mal en el ranking | ✅ Tu posición real en el ranking es visible |
| ❌ Bonos y comisiones pueden calcularse incorrectamente | ✅ Cada venta cuenta para el bono |
| ❌ No puedes demostrar que atiendes ciertos territorios | ✅ Tu cobertura geográfica queda documentada |
| ❌ Las promociones no se diseñan para tus zonas | ✅ Las estrategias comerciales incluyen tus zonas |

---

## 📋 Mini-Checklist para Pegar en tu Monitor

```
┌──────────────────────────────────────────┐
│  ANTES DE ENVIAR EL REPORTE:             │
│                                          │
│  □ ¿Todas las filas tienen ESTADO?       │
│  □ ¿Todas las filas tienen SEGMENTO?     │
│  □ ¿Las fechas son del mes correcto?     │
│  □ ¿Los números son números?             │
│  □ ¿El semáforo dice 🟢?                │
│                                          │
│  Si todas son ✅ → ENVÍA CON CONFIANZA   │
│  Si alguna es ❌ → CORRIGE PRIMERO       │
└──────────────────────────────────────────┘
```

---

> *"Un dato bien llenado hoy es una decisión correcta mañana. Cada celda que completas bien le dice a la empresa: aquí vendimos, a este tipo de cliente, en este estado. Eso es lo que permite que ventas crezca, que las metas sean justas, y que los bonos se paguen correctamente."*

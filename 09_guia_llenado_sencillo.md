# 🗣️ Entregable 3.3 — Guía en Lenguaje Sencillo
## Cómo Llenar tu Reporte de Ventas sin Morir en el Intento
### Instructivo Paso a Paso para el Analista del Distribuidor

---

## 👋 ¿Para quién es esta guía?

Para **ti**, que cada mes recibes un archivo de Excel y tienes que llenarlo con las ventas de tu distribuidor para enviarlo a Heinz. Esta guía te explica paso a paso cómo hacerlo correctamente para que no te lo devuelvan.

---

## 📁 Paso 1: Abrir el Archivo Correcto

1. Busca el archivo que te enviaron por correo. Se llama algo como: `VENTAS_DTT_218809_202605.xlsx`
2. **Haz doble clic** para abrirlo en Excel
3. Si aparece un aviso amarillo que dice **"Habilitar edición"**, haz clic en él
4. Si aparece un aviso que dice **"Habilitar contenido"** o **"Habilitar macros"**, también haz clic

> ⚠️ Si NO habilitas las macros, el botón de validación no funcionará al final.

---

## 📋 Paso 2: Ubícate en la Hoja Correcta

Abajo del todo, verás unas pestañas. Haz clic en **"DATA_VENTAS"**:

```
[INSTRUCCIONES] [DATA_VENTAS] [VALIDACION] [RESUMEN]
                 ^^^^^^^^^^^
                 👆 Esta es tu hoja de trabajo
```

Verás algo así:

```
Fila 1: REPORTE DE VENTAS DTT — [nombre de tu distribuidora]
Fila 2: MES: [▼ elegir]    AÑO: [▼ elegir]
Fila 3: DISTRIBUIDOR: [▼ elegir]
Fila 4: Nro. | COD.DIST | ... | SEGMENTO DE TIENDA | ... | ESTADO | ... | FECHA | ...
Fila 5: ← AQUÍ EMPIEZAS A LLENAR
```

---

## 📝 Paso 3: Llena el Período y tu Distribuidor

**Antes de cargar datos, llena las celdas de arriba:**

1. En **MES** → haz clic en la celda y aparece una flechita ▼. Haz clic y selecciona el mes
2. En **AÑO** → igual, selecciona de la lista
3. En **DISTRIBUIDOR** → selecciona tu distribuidora de la lista

> 💡 Estas celdas tienen lista desplegable. No escribas, solo selecciona.

---

## ✍️ Paso 4: Cargar los Datos de Ventas (Fila por Fila)

Empieza en la **fila 5**. Cada fila es una transacción de venta.

### Los campos se llenan así:

#### 🔵 Campos AZULES (texto libre — tú escribes)

| Campo | Qué poner | Ejemplo |
|---|---|---|
| DIR. DE ENTREGA | Dirección del cliente | Av. Bolívar #123 |
| VENDEDOR HEINZ | Nombre del vendedor | MARCOS FIGUEROA |
| CODIGO CLIENTE | El código interno de tu sistema | CLI-0042 |
| CLIENTE | Nombre del cliente | BODEGA EL SOL, C.A. |
| RIF | RIF del cliente SIN puntos ni guiones | J123456789 |
| CIUDAD | Ciudad en MAYÚSCULAS | MARACAIBO |
| MUNICIPIO | Municipio en MAYÚSCULAS | MARACAIBO |
| NRO. DOCUMENTO | Número de factura | FAC-00123 |

#### 🟢 Campos VERDES (lista desplegable — selecciona de la lista)

Estos campos tienen una **flechita ▼** que aparece cuando haces clic en la celda:

| Campo | Qué hacer | ¿Qué opciones tiene? |
|---|---|---|
| **SEGMENTO DE TIENDA** ⭐ | Clic en la celda → clic en ▼ → selecciona | ABASTO, BODEGA, SUPERMERCADO IND. GRANDE, PANADERIA, etc. (35 opciones) |
| **ESTADO** ⭐ | Clic en la celda → clic en ▼ → selecciona | ZULIA, TACHIRA, MERIDA, etc. (24 estados) |
| TIPO DOCUMENTO | Clic en la celda → clic en ▼ → selecciona | Factura, Nota de Crédito, Nota de Débito |

> [!IMPORTANT]
> **SEGMENTO DE TIENDA** es el **tipo** de tienda, NO el nombre del dueño.
> - ✅ Correcto: seleccionar **"ABASTO"** de la lista
> - ❌ Incorrecto: escribir "COMERCIAL LUCKY WUINY, C.A."
> 
> Si no sabes qué tipo de tienda es, pregúntale al vendedor de ruta que la visita.

#### 🟠 Campos NARANJAS (numéricos — solo números)

| Campo | Qué poner | Ejemplo bueno | Ejemplo malo |
|---|---|---|---|
| FECHA | Día/Mes/Año | 15/03/2026 | 15 de marzo |
| COD. SKU | Código del producto | 15765 | SKU-15765 |
| CAJAS | Cantidad vendida | 2.50 | dos cajas y media |
| MONTO (Bs) | Precio total | 1250.00 | 1.250,00 |
| UNIDADES | Unidades vendidas | 48 | 48 unidades |

> 💡 **Truco para la fecha:** Escribe el número directamente: `15/03/2026`. Si Excel lo transforma a formato de fecha automáticamente, está bien. NO escribas nombres de meses.

---

## 🔍 Paso 5: Revisa que Todo Esté Bien

### Señales visuales que te ayudan:

| Qué ves | Qué significa | Qué hacer |
|---|---|---|
| Fila con fondo **rosa/rojo claro** | Falta el Estado o el Segmento | Completa esos campos |
| Celda con **borde rojo** | El valor no es válido | Borra y selecciona de la lista |
| Número de fila en **verde** (columna A) | La fila está completa | ¡Bien! No hagas nada |
| Fecha en **texto rojo** | La fecha es futura o inválida | Corrige la fecha |

### Autodiagnóstico rápido:

1. Ve a la pestaña **"VALIDACION"** (abajo)
2. Mira la celda grande arriba:
   - 🟢 **"LISTO PARA ENVIAR"** → ¡Todo bien!
   - 🟡 **"REVISAR"** → Hay algunos campos vacíos, intenta completarlos
   - 🔴 **"NO ENVIAR"** → Muchos errores. Revisa las filas marcadas con ❌

---

## ✅ Paso 6: Valida Antes de Enviar

1. Ve a la pestaña **"RESUMEN"**
2. Haz clic en el botón **"VALIDAR Y PREPARAR ENVÍO"**
3. Espera unos segundos
4. Aparecerá un mensaje:

**Si dice "ARCHIVO LISTO"** → Continúa al Paso 7

**Si dice "ARCHIVO NO LISTO"** → Lee los errores y corrige:
- "Estados vacíos: 15" → Ve a las filas donde falta Estado y complétalo
- "Segmentos vacíos: 8" → Ve a las filas donde falta Segmento y complétalo

---

## 📧 Paso 7: Guarda y Envía

1. **Guarda el archivo:** `Ctrl + S` (o `Archivo > Guardar`)
2. **No cambies el nombre del archivo.** Debe seguir siendo `VENTAS_DTT_[tucódigo]_[añomes].xlsx`
3. **Envía por correo** al contacto de Trade Marketing que te indicaron
4. Listo. ¡Hasta el próximo mes! 🎉

---

## 🆘 Solución a Problemas Comunes

### "No puedo escribir en las celdas de arriba"
Las filas 1-4 están protegidas. Solo puedes escribir desde la fila 5 hacia abajo. Los campos de Período y Distribuidor (filas 2-3) se llenan con lista desplegable.

### "No aparece la flechita ▼ del desplegable"
Haz clic exactamente dentro de la celda. La flecha aparece en la esquina derecha de la celda. Si no aparece, verifica que estás en la columna correcta (K para Segmento, N para Estado).

### "Excel me dice que el valor no es válido"
Estás intentando escribir algo que no está en la lista. **No escribas, selecciona.** Si necesitas un valor que no está en la lista, contacta a Trade Marketing.

### "La fecha se ve rara (como un número)"
Haz clic derecho en la celda → "Formato de celdas" → "Fecha" → elige `DD/MM/AAAA`. O simplemente escribe la fecha como `15/03/2026`.

### "No puedo pegar datos de mi sistema"
Sí puedes, pero usa **"Pegado especial > Solo valores"**:
1. Copia los datos de tu sistema
2. En la plantilla, haz clic derecho donde quieres pegar
3. Elige **"Pegado especial"**
4. Selecciona **"Valores"**
5. Aceptar

> ⚠️ NO uses Ctrl+V directamente. Puede dañar los formatos y las validaciones.

### "El archivo dice que tiene macros y me da miedo"
Es normal. Las macros son pequeños programas que validan tus datos automáticamente. Son seguras, fueron creadas por Trade Marketing. Haz clic en "Habilitar contenido".

### "Tengo muchas filas y no sé si están todas bien"
Ve a la pestaña VALIDACION. Todas las filas con ❌ en alguna columna tienen un error. Puedes usar el filtro (Ctrl+Shift+L en la fila de encabezados) para ver solo las filas con errores.

### "Me equivoqué y quiero borrar una fila"
Haz clic derecho en el número de fila (al lado izquierdo) → "Eliminar". La plantilla lo permite.

---

## 📋 Checklist Final (antes de enviar)

Antes de hacer clic en "Enviar" en tu correo, verifica:

| ✅ | Verificación |
|---|---|
| ☐ | ¿Llené el Mes, Año y Distribuidor en las filas 2 y 3? |
| ☐ | ¿Todas las filas tienen Estado seleccionado de la lista? |
| ☐ | ¿Todas las filas tienen Segmento de Tienda seleccionado de la lista? |
| ☐ | ¿Las fechas están en formato DD/MM/AAAA y no son futuras? |
| ☐ | ¿Hice clic en "VALIDAR Y PREPARAR ENVÍO" y me dijo 🟢? |
| ☐ | ¿El nombre del archivo es correcto (no lo cambié)? |

**Si todas son ✅, envía con confianza.** 💪

---

> *"Llenar bien este reporte toma 5 minutos extra al mes, pero le ahorra a la empresa semanas de correcciones y le permite vender más inteligentemente."*

---

*¿Algo no quedó claro? Contacta a Trade Marketing. Es mejor preguntar que enviar con errores.* 📞

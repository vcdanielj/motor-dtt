# 🗣️ Entregable 1.3 — Guía en Lenguaje Sencillo
## ¿Por qué llenar bien los datos nos ayuda a vender más?
### Una explicación para todos los que trabajan con la data de ventas

---

## 📌 ¿De qué se trata esto?

Imagina que tienes un negocio de empanadas y llevas un cuaderno donde anotas todas tus ventas del día. Ahora imagina que en varias páginas olvidaste escribir **a quién** le vendiste o **en cuál esquina** estabas parado cuando vendiste. 

Al final del mes, cuando quieras saber *"¿En cuál esquina vendo más?"* o *"¿Los restaurantes me compran más que las bodegas?"*, no podrás responder porque esa información no está en tu cuaderno.

**Eso es exactamente lo que nos pasa hoy con nuestra base de datos de ventas.**

---

## 🔍 ¿Qué encontramos?

Revisamos **más de 743 mil registros de ventas** de nuestros 65 distribuidores en todo el país. Encontramos dos problemas principales:

### Problema 1: Ventas sin ubicación 📍

> **6 de cada 100 ventas** no tienen el Estado donde se realizaron. Aparecen como "NO IDENTIFICADO".

Esto es como si un repartidor de pizza entregara pedidos pero no anotara la dirección. Después no sabes a cuáles zonas ya fuiste y a cuáles no.

**¿A cuántas ventas afecta?** Casi 47,000 registros.

### Problema 2: No sabemos a qué tipo de tienda le vendemos 🏪

> **8 de cada 10 ventas** no tienen el tipo de tienda (¿es bodega, supermercado, panadería, mayorista?). En vez de eso, el campo tiene el **nombre del dueño** de la tienda.

Es como si en vez de escribir "bodega" alguien escribiera "Don José". Saber que le vendimos a "Don José" no nos dice si fue una bodega de barrio o un supermercado grande.

**¿A cuántas ventas afecta?** Más de 600,000 registros.

---

## 🤔 ¿Y eso por qué importa?

### Analogía del GPS 🧭

Piensa en la data como el **GPS de la empresa**. Cuando un dato falta, es como si el GPS tuviera zonas borrosas en el mapa:

- **Con datos completos** = GPS con mapa completo → Sabes exactamente dónde ir para vender más.
- **Con datos faltantes** = GPS con zonas en blanco → Podrías estar pasando al lado de oportunidades de venta y no verlas.

### ¿Qué no podemos hacer hoy por culpa de estos huecos?

| Lo que necesitamos saber | Por qué no podemos hoy | ¿Qué se pierde? |
|--------------------------|----------------------|-----------------|
| *"¿En cuáles estados vendemos más Ketchup?"* | 47,000 ventas no dicen de qué estado son | No sabemos si hay estados donde podríamos vender más |
| *"¿Las bodegas compran más que los supermercados?"* | No sabemos si la tienda es bodega o supermercado | No podemos decidir qué productos enviar a cada tipo de tienda |
| *"¿Cuántas tiendas de cada tipo atienden nuestros distribuidores?"* | Sin tipo de tienda, es imposible contarlas | No podemos comparar el desempeño entre distribuidores |
| *"¿Dónde hay tiendas que NO nos compran todavía?"* | Sin ubicación ni tipo, no podemos ver los espacios vacíos | Oportunidades de crecimiento invisibles |

---

## 🎯 Un ejemplo real para entenderlo

Supongamos que el equipo de Trade Marketing quiere lanzar una promoción de Ketchup Heinz **solo para bodegas del estado Zulia**.

### Con datos completos ✅
> "Tenemos 120,348 registros de Zulia. De esos, 45,000 son de bodegas. Ketchup está presente en 30,000 de esas bodegas. **El 67% de las bodegas de Zulia ya compran Ketchup**. Nos falta llegar a 15,000 bodegas."

➡️ Saben exactamente cuántas bodegas faltan y pueden planificar la promoción.

### Con datos como están hoy ❌
> "Tenemos 120,348 registros de Zulia... pero no sabemos cuántos son bodegas, cuántos son supermercados y cuántos son panaderías. 🤷"

➡️ No pueden planificar nada específico. La promoción se hace "a ciegas".

---

## 📊 ¿De dónde vienen estos problemas?

No es culpa de una sola persona. Son problemas del **proceso**:

### 1️⃣ Confusión en qué anotar
Cuando el campo dice "Tipo de Cliente", algunos distribuidores entienden que deben poner **el nombre** del cliente (como "Bodegón El Rencuentro"), cuando en realidad se necesita **el tipo de tienda** (como "BODEGA").

> Es como si en un formulario médico donde dice "Tipo de sangre", alguien escribiera su nombre en vez de "A+". La intención era buena, pero la información no sirve para lo que se necesita.

### 2️⃣ No hay una lista para elegir
Si le das a alguien una hoja en blanco y le dices *"escribe el tipo de tienda"*, cada quien lo escribe diferente:
- Uno pone "Bodega"
- Otro pone "BODEGA"  
- Otro pone "Bdga"
- Otro pone el nombre del dueño

**Solución:** Dar una lista cerrada donde solo se pueda elegir entre opciones predefinidas (como cuando eliges tu país en un formulario de internet).

### 3️⃣ No se revisa antes de enviar
La data llega de los distribuidores y se carga tal cual, sin revisar si los campos importantes están llenos y bien escritos.

> Es como enviar un pedido de mercancía sin verificar que la dirección esté completa. Si falta el número de la casa, el pedido no llega.

---

## 💡 ¿Qué estamos haciendo al respecto?

### El diagnóstico que acabamos de realizar

Lo que acabamos de hacer es como llevar el carro al mecánico para un **chequeo general**:

1. ✅ **Revisamos toda la data** (743,225 registros)
2. ✅ **Identificamos qué falta y dónde** (por cada distribuidor)
3. ✅ **Medimos qué tan grave es el problema** (ranking de criticidad)
4. ✅ **Priorizamos** qué arreglar primero

### ¿Por qué es importante este diagnóstico?

> **No puedes arreglar lo que no mides.**

Sin este diagnóstico, seguiríamos trabajando con datos incompletos **sin saber cuánto nos afecta**. Ahora sabemos:

- **Cuáles distribuidores** necesitan ayuda urgente (9 en situación crítica)
- **Cuántas ventas** están afectadas (más de 100,000 registros con problemas)
- **Qué impacto tiene** en nuestra capacidad de planificar ventas y promociones

---

## 🚦 El Semáforo de Nuestros Distribuidores

Así están hoy nuestros distribuidores en cuanto a calidad de datos:

| Estado | Cuántos | Significado |
|--------|---------|------------|
| 🔴 Crítico | 9 distribuidores | Más de la mitad de su data tiene problemas serios. Necesitan ayuda urgente. |
| 🟠 Alto | 3 distribuidores | Problemas significativos pero no tan graves. Plan de mejora en 30 días. |
| 🟡 Medio | 8 distribuidores | Problemas menores pero que debemos monitorear mes a mes. |
| 🟢 Bueno | 45 distribuidores | Data de ubicación bien reportada. Falta mejorar tipo de tienda. |

---

## 🎬 ¿Qué sigue?

| Paso | Qué haremos | Para qué |
|------|------------|----------|
| 1 | Crear una **plantilla estándar** con listas cerradas | Que todos los distribuidores llenen los datos de la misma forma |
| 2 | Hacer una **guía sencilla** para distribuidores | Que sepan exactamente qué poner en cada campo |
| 3 | **Probar con 2 distribuidores** primero | Verificar que funciona antes de pedírselo a los 65 |
| 4 | **Medir la mejora** antes vs. después | Demostrar con números que el cambio funciona |

---

## 📝 En una frase

> **Si no sabemos *dónde* ni *a quién* le vendemos, no podemos saber *dónde más* podríamos vender. Este diagnóstico es el primer paso para dejar de navegar a ciegas y empezar a tomar decisiones con datos completos.**

---

*¿Tienes preguntas? Este documento fue diseñado para que cualquier persona del equipo pueda entender por qué la calidad de los datos es importante para el negocio. Si algo no quedó claro, pregunta con confianza.*

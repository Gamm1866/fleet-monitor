# Registro de correcciones a la IA

Bitácora de decisiones donde el criterio humano corrigió o redirigió lo que propuso la IA.
Insumo para el video de presentación.

---

## 001 — El umbral de "dato desactualizado" medía la variable equivocada

**Fecha:** 2026-08-03
**Categoría:** UX / modelo de datos

**Qué propuso la IA**
Una máquina de frescura con umbral de 2 minutos para pasar a estado `stale` y 12 minutos
para `lost`, calculada únicamente sobre la antigüedad de `fixTime`.

**Qué estaba mal**
Germán objetó con un caso de uso real: *"¿qué pasa si va al baño o para para comer?"*
Un chofer detenido 20 minutos con el rastreador encendido tiene `fixTime` fresco y
velocidad 0 — es un dato perfecto, no una falla. Pero si el equipo se duerme al apagar
el motor, `fixTime` envejece y el sistema lo pintaba de rojo. Resultado: alarma por un
almuerzo. El falso positivo más caro en una sala de control es el que enseña al operador
a ignorar las alertas.

**Cómo se corrigió**
Se separó *movimiento del vehículo* de *silencio del dispositivo*, que son dos señales
independientes que Traccar expone por separado (`device.status` vs `position.fixTime`):

| Estado | Condición | Tratamiento visual |
|---|---|---|
| En movimiento | fixTime fresco, velocidad > 2 km/h | activo |
| Detenido | fixTime fresco, velocidad ~ 0 | neutro, muestra hace cuánto |
| Sin reportar | fixTime entre 2 y 30 min | informativo, gris — ausencia de dato, no error |
| Sin contacto | fixTime > 30 min | jerarquía alta |

Umbral de "sin contacto" subido de 12 a 30 minutos por decisión de Germán, para que una
parada de almuerzo con el motor apagado no escale a la franja fuerte.

**Principio que queda**
Una ausencia de información no se comunica con el mismo lenguaje visual que una falla.
Gris, no rojo.

---

## 002 — CORS era un supuesto, no un hecho

**Fecha:** 2026-08-03
**Categoría:** Técnica / verificación de supuestos

**Qué se asumía**
Que `demo.traccar.org` bloquearía las peticiones del navegador por CORS, y que esa era
la razón principal para construir un proxy serverless.

**Qué estaba mal**
Se verificó con un preflight real antes de escribir la app. Traccar demo responde:

```
Access-Control-Allow-Origin: <refleja el Origin>
Access-Control-Allow-Headers: origin, content-type, accept, authorization
Access-Control-Allow-Credentials: true
```

CORS no bloquea nada. El supuesto era falso.

**Cómo se corrigió**
El proxy se mantiene, pero por la razón correcta: llamar a Traccar directamente desde el
navegador obligaría a enviar el header `Authorization: Basic` desde el cliente, lo que
significa embarcar usuario y contraseña de la cuenta en el bundle de JavaScript. El proxy
existe para que la credencial nunca salga del servidor, no para sortear CORS.

Se agregó además una allowlist estricta (`devices`, `positions`, solo GET): sin ella el
proxy sería un relay abierto contra la cuenta Traccar y cualquiera con la URL del deploy
podría enviarle comandos al dispositivo.

**Principio que queda**
Verificar el supuesto antes de diseñar la solución alrededor de él. La mitigación era
correcta; la justificación no.

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

---

## 003 — El sistema de diseño arrancó como un sistema paralelo

**Fecha:** 2026-08-03
**Categoría:** Arquitectura de tokens

**Qué propuso la IA**
Una capa semántica propia (`--color-surface`, `--color-text-primary`, `--color-border-subtle`)
definida desde cero en `@theme`, sin mirar qué traía Untitled UI.

**Qué estaba mal**
Untitled UI ya publica su propia capa semántica completa —`--color-bg-primary`,
`--color-text-primary`, `--color-border-secondary`, escalas de marca y de error— y todos
sus componentes la consumen. Dos capas semánticas conviviendo significan que `Button` y
`Select` habrían ignorado la paleta del proyecto y renderizado con el azul de la
librería, o directamente sin estilo.

**Cómo se corrigió**
Se invirtió la relación. `untitled-theme.css` se incorpora como archivo vendor sin tocar,
y `theme.css` se carga después para *reasignar* esos tokens a las primitivas del proyecto.
Solo se agregan los tokens que la librería no puede tener porque son de dominio: estado
del vehículo, superficies del mapa y la duración de la interpolación del marcador.

Resultado: `Button` y `Select` adoptaron el acento azul y los neutros azulados sin que se
les tocara una línea.

**Principio que queda**
Antes de escribir tokens, leer los que la librería ya define. Un sistema de diseño que
pelea con su propia librería de componentes no es un sistema, son dos.

---

## 004 — Tres bugs encontrados mirando la pantalla, no el build

**Fecha:** 2026-08-03
**Categoría:** Verificación

El proyecto compilaba sin errores y `tsc` pasaba limpio. Los tres problemas aparecieron
recién al abrir la página y consultar el CSS ya generado:

1. **`border-border-subtle` no existía.** Al reasignar los tokens quedaron sin definir
   `--color-border-subtle` y `--color-border-default`. Tailwind no genera una clase para
   un token inexistente, así que `border` caía a `currentColor` y los bordes se pintaban
   del color del texto —casi blancos en modo oscuro— sin que nada fallara.
2. **Los swatches del showcase leían variables inexistentes.** `@theme inline` incrusta
   el valor en cada utilidad en vez de emitir una custom property, así que
   `var(--color-surface)` no existe en runtime. Es la contracara de poder cambiar de tema
   sin recompilar. Los swatches ahora leen las primitivas.
3. **Formato numérico en inglés.** `toFixed(1)` producía "73.3 km/h". En español el
   separador decimal es la coma, y en una herramienta de operación eso se lee como un
   error del sistema antes que como una cifra.

**Principio que queda**
Un build verde solo prueba que el código compila. Las clases de Tailwind que nunca se
generaron y los tokens que no existen en runtime fallan en silencio: hay que mirar el CSS
emitido y la pantalla.

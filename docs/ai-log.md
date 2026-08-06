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

---

## 005 — El código correcto contra el entorno real: dos empates perdidos

**Fecha:** 2026-08-05
**Categoría:** Integración técnica

**Qué propuso la IA**
Dos piezas escritas "bien" según la documentación, que fallaron al tocar el entorno real.

1. El proxy de Traccar con la firma web estándar: `handler(request: Request)`, leyendo
   `new URL(request.url)`.
2. Los estilos que neutralizan el CSS de Leaflet, ordenados dentro de
   `@layer components` como corresponde a un override de librería.

**Qué estaba mal**
Ninguna de las dos cosas se puede detectar con `tsc` ni con el build. Las dos compilan.

1. La función recibe el `req` de Node, no un `Request` web. El `.url` de Node llega
   **relativo** (`/api/traccar/devices?resource=devices`), y `new URL()` sin base lanza
   `ERR_INVALID_URL`. El endpoint devolvía `FUNCTION_INVOCATION_FAILED` sin más pista:
   la causa estaba en los logs de runtime de Vercel, no en la respuesta. De paso apareció
   que Vercel inyecta el segmento dinámico como query param, que no hay que reenviar.
2. `leaflet.css` lo inyecta el bundle en runtime, **sin capa**. En la cascada, cualquier
   estilo sin capa le gana a uno dentro de una capa, sin importar el orden ni la
   especificidad. El `background: #ddd` de Leaflet ganaba y el mapa mostraba un rectángulo
   gris claro sobre el tema oscuro cada vez que faltaba una tesela. La misma clase de
   Tailwind (`bg-surface-sunken`) tampoco podía ganar, por vivir en una capa.

**Cómo se corrigió**
El proxy pasó a la firma `(req, res)` de `node:http`. Los estilos de Leaflet salieron de
`@layer` y subieron un escalón de especificidad (`.leaflet-container.fleet-map`), con el
motivo escrito al lado para que nadie los "limpie" después.

**Principio que queda**
El que gana una regla de CSS o define una firma no es la documentación: es el entorno
donde el código se ejecuta. Los dos bugs se encontraron leyendo los logs de producción y
midiendo el DOM con `getComputedStyle`, no releyendo el código.

---

## 006 — La interfaz afirmaba dos cosas incompatibles a la vez

**Fecha:** 2026-08-05
**Categoría:** UX / honestidad del dato

**Qué propuso la IA**
El panel mostraba, uno al lado del otro: la etiqueta **SIN CONTACTO** en rojo y
**27,8 km/h** en números grandes. Además el mapa reencuadraba el vehículo seleccionado en
cada sondeo, cada ocho segundos.

**Qué estaba mal**
La lógica de estado ya trataba el silencio del dispositivo como dominante —si el
rastreador dejó de hablar, la velocidad guardada es un recuerdo— pero esa decisión se
había aplicado solo al color del punto. El panel seguía presentando el dato viejo con el
mismo formato que uno vivo. Entre una etiqueta y una cifra grande, el operador le cree a
la cifra. Es exactamente el error del que hablaba la entrada 001, de vuelta en otra capa.

El reencuadre tenía el mismo defecto de origen: trataba cada respuesta del servidor como
una orden de mover la vista. Un operador que está mirando otra zona del mapa pierde su
posición cada ocho segundos. Y sobre Leaflet, además, el zoom animado se interrumpía a sí
mismo y dejaba teselas de un nivel estiradas sobre otro: el mapa se veía borroso.

**Cómo se corrigió**
- Con el dispositivo en silencio, el panel lo dice antes de los datos ("los datos de abajo
  son de la última transmisión, hace 1 día") y las etiquetas cambian a *Última velocidad*
  y *Último rumbo*. El dato no se oculta —sigue siendo útil— pero deja de afirmarse como
  presente.
- El mapa encuadra solo al **cambiar** de vehículo, sin animación. Mientras uno sigue
  seleccionado, se desplaza únicamente si se salió del encuadre.

**Principio que queda**
Una decisión de producto no está implementada hasta que está en todas las capas donde el
usuario la lee. Aplicarla al color y olvidarla en el texto deja la contradicción a la
vista, y el usuario resuelve el empate por su cuenta —casi siempre mal.

---

## 007 — Dos relojes para dos preguntas distintas

**Fecha:** 2026-08-05
**Categoría:** Modelo de datos / UX

**Qué propuso la IA**
El recorrido de las últimas seis horas, ordenado por `serverTime` —el mismo campo que ya
se usaba para medir la antigüedad del contacto—. Reusar el criterio parecía coherente.

**Qué estaba mal**
Se vio en pantalla apenas hubo datos reales: el trazo hacía un zigzag que ningún vehículo
podría recorrer. `serverTime` es *cuándo llegó el dato al servidor*, no *cuándo ocurrió*.
Un equipo que pierde señal en un túnel y descarga todo junto al recuperar cobertura manda
media hora de posiciones con el mismo horario de llegada: ordenadas así, la línea salta
hacia atrás y hacia adelante.

**Cómo se corrigió**
El recorrido se ordena por `fixTime` —la hora del GPS, cuándo ocurrió—, y la antigüedad
del contacto se sigue midiendo con el reloj del servidor. La entrada 001 ya había separado
*movimiento del vehículo* de *silencio del dispositivo*; esto es la misma distinción una
capa más abajo, en los relojes: cada pregunta tiene el suyo y usar uno solo para las dos
rompe una de las dos.

**Nota de encuadre**
Con recorrido disponible, el mapa encuadra el trazo completo en vez de centrar en la
posición actual: centrado en el punto, el origen queda fuera de pantalla y la ruta se lee
como una línea que entra desde la nada.

---

## 008 — El alta de vehículos no va en esta app

**Fecha:** 2026-08-05
**Categoría:** Seguridad / alcance

**Qué se pidió**
Un lugar para configurar vehículos nuevos desde el monitor.

**Por qué no se construyó ahí**
El proxy guarda las credenciales de la cuenta de Traccar y está limitado a `GET` sobre dos
recursos. Habilitar `POST` para crear dispositivos convertiría la URL pública del deploy en
un relay de escritura contra la cuenta: cualquiera que la conozca podría dar de alta o
modificar vehículos y, con el resto de la API de Traccar, enviar comandos a los equipos. La
app no tiene sesiones de usuario, así que no hay a quién pedirle permiso antes de escribir.

**Cómo se resolvió**
Un enlace explícito a Traccar en el encabezado. El alta se hace donde ya existe control de
acceso por usuario, y el monitor sigue siendo de solo lectura.

**Principio que queda**
Un monitor de solo lectura es una decisión de arquitectura, no una funcionalidad faltante.
La alternativa no era "agregar un formulario": era agregar un formulario *y* un sistema de
autenticación que la prueba no pide.

---

## 009 — El error tenía dos formas, no una

**Fecha:** 2026-08-05
**Categoría:** UX / estados críticos

**Qué propuso la IA**
Una franja roja con el mensaje del fallo, igual para cualquier error.

**Qué estaba mal**
Dos cosas. La primera: no había botón de reintento, que el enunciado pide explícitamente.
La segunda es más de fondo: un fallo al arrancar y un fallo intermitente no son el mismo
evento para el operador.

- Si la app nunca cargó, no hay nada en pantalla y una franja delgada es un susurro
  cuando hace falta una explicación.
- Si la app ya tenía datos, un modal que tapa el mapa le quita al operador la última
  posición conocida —la única información que le queda— justo cuando el sistema falla.

**Cómo se corrigió**
Dos tratamientos con el mismo origen. Sin datos: pantalla completa, con micro-copy que
nombra lo que se sabe y lo que no ("la posición puede haber cambiado: por ahora, el
sistema no lo sabe") y botón de reintento. Con datos: franja no bloqueante con el mismo
botón, porque el polling ya reintenta solo y el botón existe para quien no quiere esperar
los ocho segundos.

**El detalle que se vio en pantalla**
Traccar responde a un 401 con un stack trace de Java completo, y la primera versión lo
volcaba entero en la interfaz. No ayuda a nadie —el operador no lo entiende, el
desarrollador ya lo tiene en la consola— y publica la estructura interna del servidor a
cualquiera que abra la app. Ahora los errores se traducen a una línea: *"Error 401: las
credenciales fueron rechazadas."*

---

## 010 — Interpolar sin mentir

**Fecha:** 2026-08-05
**Categoría:** UX / micro-interacción

**Qué propuso la IA**
`marker.setLatLng()` en cada sondeo. El marcador saltaba de una posición a otra.

**Qué estaba mal**
El enunciado pide que el marcador se deslice, y con razón: un salto obliga al ojo a
buscar de nuevo dónde quedó el vehículo, ocho veces por minuto.

**Cómo se corrigió**
Deslizamiento por `requestAnimationFrame` con desaceleración cúbica, 1,2 s —más corto que
el intervalo de sondeo, para que el marcador tenga momentos quietos y no viva animándose—.
Verificado midiendo el DOM: 10 posiciones intermedias con deltas decrecientes (7, 7, 7, 5,
4, 3, 2, 2, 1 px), no un salto.

**La decisión que no es obvia**
Hay un tope: más de 2 km, salta. Deslizar suavemente veinte kilómetros en un segundo
dibuja un trayecto que el vehículo nunca hizo — es una animación que miente. Un salto
grande casi siempre significa que el equipo estuvo sin reportar, y esa discontinuidad es
información: merece leerse como corte, no como viaje.

Con `prefers-reduced-motion` no hay deslizamiento más rápido: no hay deslizamiento.

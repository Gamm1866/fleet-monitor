# Monitor de Vehículo en Tiempo Real

Monitor de flota para sala de control, conectado a la API de [Traccar](https://www.traccar.org/).
Muestra la posición de los vehículos sobre un mapa, su recorrido reciente y una tarjeta de
estado que distingue entre *el vehículo no se mueve* y *el dispositivo dejó de reportar* —
dos cosas que se parecen en los datos y no significan lo mismo para quien vigila.

**Aplicación desplegada:** https://fleet-monitor-ivory.vercel.app
**Sistema de diseño:** https://fleet-monitor-ivory.vercel.app/design-system

Prueba técnica para el rol de Design Engineer (UX/UI).

---

## Cómo ejecutarlo localmente

Requiere Node 20 o superior.

```bash
git clone <url-del-repositorio>
cd fleet-monitor
npm install
cp .env.example .env.local   # completar con credenciales de Traccar
npm run dev                  # http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Verificación de tipos (`tsc -b`) y build de producción |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run lint` | Oxlint |

## Variables de entorno

Dos variables, **ninguna con prefijo `VITE_`**. Ese prefijo es justamente lo que hay que
evitar: Vite incrusta en el bundle del navegador todo lo que lo lleve, así que la
contraseña quedaría publicada en el JavaScript que descarga cualquier visitante.

```
TRACCAR_EMAIL=germanalexander77@gmail.com
TRACCAR_PASSWORD=zyzmib-mezquz-3fYdja
```

En local van en `.env.local` (ignorado por git). En producción, como variables de entorno
del proyecto en Vercel, para *Production* y *Preview*.

> Credenciales de una cuenta de prueba en `demo.traccar.org`, publicadas acá a propósito
> para que quien evalúe pueda levantar el proyecto localmente sin pedirlas aparte.

## Endpoints

El navegador **nunca habla con Traccar directamente**. Todas las llamadas pasan por un
proxy del lado del servidor que agrega la autenticación:

| Ruta de la app | Recurso de Traccar | Para qué |
|---|---|---|
| `GET /api/traccar/devices` | `/api/devices` | Lista de vehículos |
| `GET /api/traccar/positions?deviceId=…` | `/api/positions` | Última posición de cada vehículo |
| `GET /api/traccar/positions?deviceId=…&from=…&to=…` | `/api/positions` | Recorrido de las últimas 6 horas |

El mismo contrato de URL funciona en los dos entornos:

- **Producción:** función serverless en `api/traccar/[resource].ts`.
- **Desarrollo:** proxy de Vite configurado en `vite.config.ts`.

El proxy tiene una **allowlist estricta** de dos recursos (`devices` y `positions`) y solo
acepta `GET`. Lleva las credenciales de la cuenta, así que sin ese límite la URL pública
del deploy sería un relay de escritura contra Traccar: cualquiera que la conociera podría
crear vehículos o enviarles comandos. El alta de vehículos se hace en Traccar, donde ya
existe control de acceso por usuario; la app enlaza allí y es de solo lectura.

> **Nota sobre las credenciales de demostración.** El enunciado sugiere usar `admin/admin`
> o `demo/demo` en los servidores públicos de Traccar. A la fecha de este desarrollo esas
> credenciales **ya no funcionan**: los cuatro servidores (`demo`, `demo2`, `demo3`,
> `demo4`) responden `401`. Por eso la app usa una cuenta propia en `demo.traccar.org`, con
> dispositivos alimentados por el protocolo OsmAnd (puerto `5055`).

### Vehículos de demostración mantenidos vivos

Traccar degrada cualquier dispositivo a "sin contacto" a los 30 minutos sin una posición
nueva. Para que la demo siempre tenga los cuatro estados visibles sin reseeding manual, un
workflow de **GitHub Actions** (`.github/workflows/refresh-demo.yml`) llama cada 5 minutos
a `api/cron/refresh-demo.ts`, que reenvía posición a los dispositivos "en movimiento" y
"detenido" sobre una ruta de calles reales en Usaquén (`src/lib/demo-route.ts`, compartida
con el vehículo sintético que se detiene a los 2 minutos).

Se descartó el cron nativo de Vercel: el plan Hobby solo permite frecuencia diaria, y el
despliegue rechaza cualquier expresión más frecuente (ver
[`docs/ai-log.md#014`](docs/ai-log.md)).

---

## Decisiones de diseño

Las decisiones y sus correcciones están documentadas en **[`docs/ai-log.md`](docs/ai-log.md)**,
que registra qué propuso la IA, qué estaba mal y cómo se corrigió. Un resumen:

**El estado no es una sola señal.** Un chofer detenido veinte minutos con el rastreador
encendido tiene un dato perfecto, no una falla. Un rastreador que dejó de hablar es una
ausencia de información. La app los trata distinto:

| Estado | Condición | Color |
|---|---|---|
| En movimiento | reportando, > 2 km/h | verde |
| Detenido | reportando, ≤ 2 km/h | gris |
| Sin reportar | 2 a 30 minutos de silencio | ámbar |
| Sin contacto | más de 30 minutos de silencio | rojo |

**Dos relojes para dos preguntas.** La antigüedad del contacto se mide contra el reloj del
servidor (`X-Server-Time`), nunca contra el del navegador —que puede estar corrido— ni
contra `fixTime` —que el dispositivo puede falsear—. El recorrido, en cambio, se ordena por
`fixTime`: el trazo es la cronología del vehículo, no la de las llegadas al servidor.

**Con el dispositivo en silencio, los datos dejan de afirmarse como presentes.** El panel
avisa antes de mostrarlos y las etiquetas cambian a *Última velocidad* y *Último rumbo*.

**El seguimiento del mapa es conmutable.** Arranca encendido —recentra con cada posición
nueva— y se apaga solo en cuanto el operador arrastra el mapa con la mano.

**El marcador dice hacia dónde va, pero solo cuando lo sabe.** Flecha rotada por el rumbo
en movimiento, punto cuando no: por debajo de 2 km/h el `course` del GPS es ruido.

**El error tiene dos formas.** Sin datos, pantalla completa con reintento. Con datos, un
aviso que no tapa nada: esconder la última posición conocida detrás de un modal le quita al
operador la única información que le queda justo cuando el sistema falla.

## Accesibilidad

- Pares etiqueta-valor en `<dl>`/`<dt>`/`<dd>`, no en `<div>`.
- `aria-live` reservado para los cambios de estado. La velocidad cambia cada ocho segundos:
  anunciarla inutilizaría el lector de pantalla.
- Anillo de foco global con offset, definido una sola vez para que ningún control pueda
  quedarse sin foco visible por olvido. No hay `outline: none` sin reemplazo.
- Marcadores del mapa alcanzables con teclado y anunciados con nombre y estado.
- Todo lo que dibuja el mapa —incluido el recorrido— existe también como texto en el panel.
- Contraste del verde de estado: 9,52:1 en tema oscuro, 5,48:1 en claro. Son colores
  distintos por tema, no el mismo con opacidad.
- `prefers-reduced-motion` apaga el realce, el deslizamiento del marcador y el
  desplazamiento del mapa. La duración sale de un token, así que la animación deja de
  existir desde el CSS, no desde un condicional en JavaScript.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · TanStack Query · Leaflet ·
[Untitled UI React](https://www.untitledui.com/react) sobre React Aria · Geist · Vercel

## Estructura

```
api/
├── traccar/[resource].ts   Proxy serverless con allowlist
└── cron/refresh-demo.ts    Mantiene vivos los dispositivos demo (ver GitHub Actions)
.github/workflows/          Cron cada 5 min hacia api/cron/refresh-demo.ts
src/
├── components/
│   ├── map/                Mapa Leaflet, interpolación del marcador, seguimiento
│   ├── panel/              Tarjeta de estado y selector de vehículos
│   ├── ui/                 StatusPill, DataRow, AnimatedValue, Skeleton, ErrorState
│   └── base/               Untitled UI, re-tematizado con los tokens del proyecto
├── hooks/                  useFleet (sondeo), useRoute (recorrido)
├── lib/                    Cliente de Traccar, vocabulario de estados, formato,
│                            ruta real compartida de los vehículos demo
├── pages/                  Monitor y sistema de diseño
└── styles/                 Tokens en dos capas y estilos globales
docs/ai-log.md              Bitácora de correcciones a la IA
```

## Sobre el polling

Se descartó el WebSocket de Traccar: `/api/socket` solo autentica con la cookie de sesión
del navegador, que el proxy no puede reenviar sin exponer la cuenta. El sondeo es de 8
segundos para la flota y 60 para el recorrido histórico, que casi no cambia entre lecturas.

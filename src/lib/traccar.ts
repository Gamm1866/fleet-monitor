import {
  LOST_AFTER_MINUTES,
  MOVING_ABOVE_KMH,
  STALE_AFTER_MINUTES,
  STATUS_META,
  type VehicleStatus,
} from './status'
import { knotsToKmh } from './format'
import { fetchRoadRoute } from './osrm'
import { bearingDegrees, haversineMeters } from './geo'
import { type Geofence, parseCircleArea } from './geofence'

export interface TraccarDevice {
  id: number
  name: string
  uniqueId: string
  /** Momento del último contacto del DISPOSITIVO, no del último movimiento. */
  lastUpdate: string | null
  positionId: number
}

export interface TraccarPosition {
  id: number
  deviceId: number
  latitude: number
  longitude: number
  /** Traccar reporta la velocidad en nudos, siempre. */
  speed: number
  course: number
  serverTime: string
  fixTime: string
  attributes: {
    batteryLevel?: number
    totalDistance?: number
    motion?: boolean
  }
}

/** Un dispositivo con su última posición conocida, ya interpretado. */
export interface Vehicle {
  id: number
  name: string
  uniqueId: string
  status: VehicleStatus
  /** `undefined` mientras el dispositivo no haya reportado nunca. */
  position?: TraccarPosition
  speedKmh: number
  /** Minutos de silencio del dispositivo al momento de la lectura. */
  silenceMinutes: number
  batteryLevel?: number
}

export interface FleetSnapshot {
  vehicles: Vehicle[]
  /**
   * Reloj del servidor al momento de la respuesta. Todo cálculo de antigüedad
   * se hace contra esto y no contra `Date.now()`: la máquina del operador
   * puede tener el reloj corrido y eso pintaría vehículos sanos como perdidos.
   */
  serverTime: number
}

/** Motivos que el proxy reporta en su propio JSON. */
const PROXY_REASONS: Record<string, string> = {
  missing_credentials: 'el servidor no tiene configuradas las credenciales',
  upstream_unreachable: 'el servidor de Traccar no responde',
  resource_not_allowed: 'el recurso pedido no está permitido',
}

const STATUS_REASONS: Record<number, string> = {
  401: 'las credenciales fueron rechazadas',
  403: 'la cuenta no tiene permiso sobre este recurso',
  429: 'demasiadas peticiones seguidas',
  500: 'el servidor falló al procesar la petición',
  502: 'el servidor de Traccar no responde',
  504: 'el servidor de Traccar tardó demasiado',
}

/**
 * Convierte un fallo en una línea legible.
 *
 * Traccar responde a un 401 con un stack trace de Java completo. Volcarlo en
 * pantalla no ayuda a nadie —el operador no lo entiende y el desarrollador ya
 * lo tiene en la consola— y de paso publica la estructura interna del servidor
 * a cualquiera que abra la app.
 */
async function describeFailure(response: Response): Promise<string> {
  const body = await response.text()

  try {
    const parsed: unknown = JSON.parse(body)
    const code =
      typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : undefined

    if (code && PROXY_REASONS[code]) {
      return `Error ${response.status}: ${PROXY_REASONS[code]}.`
    }
  } catch {
    // Traccar no siempre responde JSON. El status alcanza.
  }

  const reason = STATUS_REASONS[response.status]

  return reason
    ? `Error ${response.status}: ${reason}.`
    : `El servidor respondió con un error ${response.status}.`
}

async function get<T>(resource: string, params?: URLSearchParams) {
  const query = params?.toString()
  const response = await fetch(`/api/traccar/${resource}${query ? `?${query}` : ''}`)

  if (!response.ok) {
    throw new Error(await describeFailure(response))
  }

  const header = response.headers.get('X-Server-Time')

  return {
    data: (await response.json()) as T,
    serverTime: header ? Date.parse(header) : Date.now(),
  }
}

/**
 * Deriva el estado combinando dos señales independientes.
 *
 * El silencio del dispositivo se evalúa PRIMERO y gana siempre: si el
 * rastreador dejó de hablar, la velocidad que guardamos es un recuerdo, no una
 * medición. Pintar "en movimiento" con un dato de hace media hora es afirmar
 * algo que no sabemos.
 */
export function deriveStatus(silenceMinutes: number, speedKmh: number): VehicleStatus {
  if (silenceMinutes >= LOST_AFTER_MINUTES) return 'lost'
  if (silenceMinutes >= STALE_AFTER_MINUTES) return 'stale'
  return speedKmh > MOVING_ABOVE_KMH ? 'moving' : 'stopped'
}

/**
 * Ventana del recorrido dibujado en el mapa.
 *
 * Seis horas cubre un turno de reparto sin convertir el mapa en una madeja.
 * Un histórico completo no es contexto, es ruido: lo que el operador necesita
 * saber es de dónde viene el vehículo ahora, no dónde estuvo el martes.
 */
export const ROUTE_WINDOW_HOURS = 6

/** Recorrido reciente de un dispositivo, en orden cronológico. */
export async function fetchRoute(deviceId: number): Promise<TraccarPosition[]> {
  // Los vehículos demo no tienen recorrido real en Traccar: se calculan del
  // mismo modo que su posición actual, sin llamar al proxy.
  const demoProfile = DEMO_PROFILES.find((profile) => profile.id === deviceId)
  if (demoProfile) {
    await ensureDemoRoadRoute()
    return demoRoute(demoProfile, Date.now())
  }

  if (deviceId === ALERT_DEMO_ID) {
    return [buildAlertDemoVehicle(Date.now()).position as TraccarPosition]
  }

  const to = new Date()
  const from = new Date(to.getTime() - ROUTE_WINDOW_HOURS * 3_600_000)

  const params = new URLSearchParams({
    deviceId: String(deviceId),
    from: from.toISOString(),
    to: to.toISOString(),
  })

  const { data } = await get<TraccarPosition[]>('positions', params)

  // Se ordena por `fixTime` —cuándo ocurrió— y no por `serverTime` —cuándo
  // llegó al servidor—. Son dos relojes distintos para dos preguntas
  // distintas: la antigüedad del contacto se mide con el del servidor (ver
  // `deriveStatus`), pero el trazo de un recorrido es la cronología del
  // vehículo. Un equipo que estuvo sin señal y descarga todo junto al recuperar
  // cobertura llega desordenado, y ordenar por hora de llegada dibuja un
  // zigzag que el vehículo nunca hizo.
  return data.toSorted((a, b) => Date.parse(a.fixTime) - Date.parse(b.fixTime))
}

/**
 * Vehículos de demostración.
 *
 * La cuenta demo de Traccar tiene un solo dispositivo real (OsmAnd), así que
 * no puede mostrar los cuatro estados del sistema a la vez. Estos vehículos
 * sintéticos rellenan los estados que la flota real no cubre en el momento de
 * la lectura — nunca duplican uno que ya esté presente.
 *
 * Se recalculan a partir del reloj en cada sondeo, no de un proceso externo
 * enviando posiciones falsas: así no dependen de que algo siga corriendo, y
 * "en movimiento" se ve realmente moverse porque la posición es función del
 * tiempo.
 */
const DEMO_ORIGIN = { latitude: 4.711, longitude: -74.0721 } // Bogotá
const KNOTS_PER_KMH = 1 / 1.852

/**
 * Recorrido real por calles para el demo "en movimiento".
 *
 * Un círculo alrededor de un punto es geometría, no una calle: corta por
 * el medio de las manzanas y atraviesa edificios. `fetchRoadRoute` le pide a
 * OSRM la geometría real entre dos puntos de Bogotá una sola vez, y el
 * camión recorre esa polilínea de ida y vuelta —el patrullaje se calcula con
 * el reloj, no reenviando la petición en cada sondeo.
 *
 * Si OSRM no responde (sin red, servidor demo caído), se cae a un círculo
 * sintético: la demo sigue funcionando, solo pierde el ajuste a la calle.
 */
const DEMO_ROUTE_FROM: [number, number] = [4.711, -74.0721]
const DEMO_ROUTE_TO: [number, number] = [4.698, -74.0405] // ~4 km, cruzando Usaquén

interface DemoRoadRoute {
  coordinates: [number, number][]
  /** Distancia acumulada en metros hasta cada punto de `coordinates`. */
  cumulative: number[]
  totalMeters: number
}

let demoRoadRoute: DemoRoadRoute | null = null
let demoRoadRoutePromise: Promise<void> | null = null

function ensureDemoRoadRoute(): Promise<void> {
  demoRoadRoutePromise ??= fetchRoadRoute(DEMO_ROUTE_FROM, DEMO_ROUTE_TO)
    .then(({ coordinates }) => {
      const cumulative = [0]
      for (let i = 1; i < coordinates.length; i++) {
        const [lat1, lon1] = coordinates[i - 1]
        const [lat2, lon2] = coordinates[i]
        cumulative.push(cumulative[i - 1] + haversineMeters(lat1, lon1, lat2, lon2))
      }
      demoRoadRoute = { coordinates, cumulative, totalMeters: cumulative.at(-1) ?? 0 }
    })
    .catch(() => {
      demoRoadRoute = null
    })

  return demoRoadRoutePromise
}

/** Punto a una distancia dada sobre la polilínea real, con el rumbo del tramo. */
function pointOnRoadRoute(
  route: DemoRoadRoute,
  distanceMeters: number,
): { latitude: number; longitude: number; course: number } {
  const distance = Math.min(Math.max(distanceMeters, 0), route.totalMeters)
  let i = 1
  while (i < route.cumulative.length - 1 && route.cumulative[i] < distance) i++

  const [lat1, lon1] = route.coordinates[i - 1]
  const [lat2, lon2] = route.coordinates[i]
  const segmentStart = route.cumulative[i - 1]
  const segmentLength = route.cumulative[i] - segmentStart || 1
  const ratio = (distance - segmentStart) / segmentLength

  return {
    latitude: lat1 + (lat2 - lat1) * ratio,
    longitude: lon1 + (lon2 - lon1) * ratio,
    course: bearingDegrees(lat1, lon1, lat2, lon2),
  }
}

/**
 * Patrullaje de ida y vuelta sobre la ruta real: una vuelta completa
 * (ida + vuelta) dura lo mismo que la ventana de recorrido, así las 24
 * muestras del trazo cubren un solo tramo limpio y no se pisan entre sí.
 */
function demoRoadPosition(atMs: number): { latitude: number; longitude: number; course: number } {
  const route = demoRoadRoute
  if (!route) return demoOrbit(atMs)

  const loopMs = ROUTE_WINDOW_HOURS * 3_600_000
  const half = loopMs / 2
  const cyclePos = atMs % loopMs
  const isOutbound = cyclePos <= half
  const distanceMeters = (isOutbound ? cyclePos / half : (loopMs - cyclePos) / half) * route.totalMeters

  const point = pointOnRoadRoute(route, distanceMeters)
  return isOutbound ? point : { ...point, course: (point.course + 180) % 360 }
}

/** Respaldo si OSRM no responde: un círculo alrededor del origen. Una vuelta
 * cada 8 horas, para que la ventana de recorrido (6h) no la complete entera y
 * el trazo no se dibuje como una estrella por aliasing entre muestras. */
const DEMO_ORBIT_LAP_MS = 8 * 3_600_000
const DEMO_ORBIT_RADIUS_DEG = 0.012

function demoOrbit(atMs: number): { latitude: number; longitude: number; course: number } {
  const angle = ((atMs % DEMO_ORBIT_LAP_MS) / DEMO_ORBIT_LAP_MS) * 2 * Math.PI
  return {
    latitude: DEMO_ORIGIN.latitude + Math.sin(angle) * DEMO_ORBIT_RADIUS_DEG,
    longitude: DEMO_ORIGIN.longitude + Math.cos(angle) * DEMO_ORBIT_RADIUS_DEG,
    course: (((angle * 180) / Math.PI) + 90) % 360,
  }
}

interface DemoProfile {
  id: number
  name: string
  uniqueId: string
  status: VehicleStatus
  /** Desplazamiento fijo respecto del origen, para los que no se mueven. */
  offset: { lat: number; lon: number }
  speedKmh: number
  silenceMinutes: number
  batteryLevel: number
}

const DEMO_PROFILES: DemoProfile[] = [
  {
    id: -1,
    name: 'Demo — En movimiento',
    uniqueId: 'demo-moving',
    status: 'moving',
    offset: { lat: 0, lon: 0 },
    speedKmh: 34,
    silenceMinutes: 0,
    batteryLevel: 91,
  },
  {
    id: -2,
    name: 'Demo — Detenido',
    uniqueId: 'demo-stopped',
    status: 'stopped',
    offset: { lat: 0.014, lon: -0.01 },
    speedKmh: 0,
    silenceMinutes: 1,
    batteryLevel: 78,
  },
  {
    id: -3,
    name: 'Demo — Sin reportar',
    uniqueId: 'demo-stale',
    status: 'stale',
    offset: { lat: -0.012, lon: 0.016 },
    speedKmh: 0,
    silenceMinutes: STALE_AFTER_MINUTES + 4,
    batteryLevel: 54,
  },
  {
    id: -4,
    name: 'Demo — Sin contacto',
    uniqueId: 'demo-lost',
    status: 'lost',
    offset: { lat: 0.02, lon: 0.022 },
    speedKmh: 0,
    silenceMinutes: LOST_AFTER_MINUTES + 15,
    batteryLevel: 12,
  },
]

function buildDemoVehicle(profile: DemoProfile, serverTime: number): Vehicle {
  const point =
    profile.status === 'moving'
      ? demoRoadPosition(serverTime)
      : {
          latitude: DEMO_ORIGIN.latitude + profile.offset.lat,
          longitude: DEMO_ORIGIN.longitude + profile.offset.lon,
          course: 0,
        }
  const fixTime = new Date(serverTime - profile.silenceMinutes * 60_000).toISOString()

  const position: TraccarPosition = {
    id: profile.id,
    deviceId: profile.id,
    latitude: point.latitude,
    longitude: point.longitude,
    speed: profile.speedKmh * KNOTS_PER_KMH,
    course: point.course,
    serverTime: new Date(serverTime).toISOString(),
    fixTime,
    attributes: { batteryLevel: profile.batteryLevel },
  }

  return {
    id: profile.id,
    name: profile.name,
    uniqueId: profile.uniqueId,
    status: profile.status,
    position,
    speedKmh: profile.speedKmh,
    silenceMinutes: profile.silenceMinutes,
    batteryLevel: profile.batteryLevel,
  }
}

/** Recorrido reciente del demo "en movimiento"; los otros no se desplazan. */
function demoRoute(profile: DemoProfile, serverTime: number): TraccarPosition[] {
  if (profile.status !== 'moving') {
    return [buildDemoVehicle(profile, serverTime).position as TraccarPosition]
  }

  const samples = 24
  const stepMs = (ROUTE_WINDOW_HOURS * 3_600_000) / samples

  return Array.from({ length: samples }, (_, i) => {
    const atMs = serverTime - (samples - 1 - i) * stepMs
    const point = demoRoadPosition(atMs)
    return {
      id: profile.id * 1000 - i,
      deviceId: profile.id,
      latitude: point.latitude,
      longitude: point.longitude,
      speed: profile.speedKmh * KNOTS_PER_KMH,
      course: point.course,
      serverTime: new Date(atMs).toISOString(),
      fixTime: new Date(atMs).toISOString(),
      attributes: {},
    }
  })
}

interface TraccarGeofence {
  id: number
  name: string
  area: string
}

/** Mismo origen que la flota demo: la zona real que el camión "en movimiento"
 * cruza al patrullar, para que la funcionalidad se vea sin tener que dar de
 * alta un geofence en Traccar primero. */
const DEMO_GEOFENCE: Geofence = {
  id: -100,
  name: 'Zona demo — Usaquén',
  center: [DEMO_ORIGIN.latitude, DEMO_ORIGIN.longitude],
  radiusMeters: 1200,
  isDemo: true,
}

export async function fetchGeofences(): Promise<Geofence[]> {
  const { data } = await get<TraccarGeofence[]>('geofences')

  const real = data
    .map((geofence): Geofence | null => {
      const circle = parseCircleArea(geofence.area)
      if (!circle) return null
      return {
        id: geofence.id,
        name: geofence.name,
        center: circle.center,
        radiusMeters: circle.radiusMeters,
        isDemo: false,
      }
    })
    .filter((geofence): geofence is Geofence => geofence !== null)

  return real.length > 0 ? real : [DEMO_GEOFENCE]
}

/**
 * El caso que falta en el set fijo de arriba: un vehículo que se ve moverse
 * y en algún momento se detiene DE VERDAD, en vivo — para que la alerta de
 * cambio de estado (ver `use-status-alerts`) tenga algo que disparar sin
 * esperar horas. En vez de un estado fijo, este vehículo cicla: 2 minutos
 * en movimiento, 1 minuto detenido, y vuelve a arrancar — así la transición
 * se puede ver (y volver a ver) en cualquier demo en vivo.
 */
const ALERT_DEMO_ID = -5
const ALERT_DEMO_ORIGIN = { latitude: DEMO_ORIGIN.latitude + 0.006, longitude: DEMO_ORIGIN.longitude - 0.018 }
const ALERT_DEMO_LAP_MS = 90_000
const ALERT_DEMO_RADIUS_DEG = 0.006
const ALERT_DEMO_MOVING_MS = 2 * 60_000
const ALERT_DEMO_STOPPED_MS = 60_000
const ALERT_DEMO_CYCLE_MS = ALERT_DEMO_MOVING_MS + ALERT_DEMO_STOPPED_MS

function alertDemoOrbit(atMs: number): { latitude: number; longitude: number; course: number } {
  const angle = ((atMs % ALERT_DEMO_LAP_MS) / ALERT_DEMO_LAP_MS) * 2 * Math.PI
  return {
    latitude: ALERT_DEMO_ORIGIN.latitude + Math.sin(angle) * ALERT_DEMO_RADIUS_DEG,
    longitude: ALERT_DEMO_ORIGIN.longitude + Math.cos(angle) * ALERT_DEMO_RADIUS_DEG,
    course: (((angle * 180) / Math.PI) + 90) % 360,
  }
}

function buildAlertDemoVehicle(serverTime: number): Vehicle {
  const cyclePos = serverTime % ALERT_DEMO_CYCLE_MS
  const isMoving = cyclePos < ALERT_DEMO_MOVING_MS
  const status: VehicleStatus = isMoving ? 'moving' : 'stopped'
  // Mientras está "detenido" el reloj de la órbita queda congelado en el
  // instante en que se detuvo — si no, seguiría calculando una posición
  // nueva cada sondeo y el vehículo se vería mover estando quieto.
  const effectiveAtMs = isMoving ? serverTime : serverTime - (cyclePos - ALERT_DEMO_MOVING_MS)
  const point = alertDemoOrbit(effectiveAtMs)
  const speedKmh = isMoving ? 28 : 0

  const position: TraccarPosition = {
    id: ALERT_DEMO_ID,
    deviceId: ALERT_DEMO_ID,
    latitude: point.latitude,
    longitude: point.longitude,
    speed: speedKmh * KNOTS_PER_KMH,
    course: point.course,
    serverTime: new Date(serverTime).toISOString(),
    fixTime: new Date(serverTime).toISOString(),
    attributes: { batteryLevel: 64 },
  }

  return {
    id: ALERT_DEMO_ID,
    name: 'Demo — Se detiene a los 2 min',
    uniqueId: 'demo-alert-stop',
    status,
    position,
    speedKmh,
    silenceMinutes: 0,
    batteryLevel: 64,
  }
}

function withDemoVehicles(vehicles: Vehicle[], serverTime: number): Vehicle[] {
  const covered = new Set(vehicles.map((vehicle) => vehicle.status))
  const missing = DEMO_PROFILES.filter((profile) => !covered.has(profile.status))

  return [
    ...vehicles,
    ...missing.map((profile) => buildDemoVehicle(profile, serverTime)),
    buildAlertDemoVehicle(serverTime),
  ]
}

export async function fetchFleet(): Promise<FleetSnapshot> {
  // Memoizado: solo pega contra OSRM la primera vez, después reusa la
  // geometría cacheada en cada sondeo de 8 segundos.
  await ensureDemoRoadRoute()

  const { data: devices, serverTime } = await get<TraccarDevice[]>('devices')

  if (devices.length === 0) {
    return { vehicles: withDemoVehicles([], serverTime), serverTime }
  }

  // `/positions` sin parámetros devuelve un array vacío en la instancia demo.
  // Hay que pedir explícitamente los deviceId, o el panel se queda en blanco
  // sin que ninguna petición falle.
  const params = new URLSearchParams()
  for (const device of devices) {
    params.append('deviceId', String(device.id))
  }

  const { data: positions } = await get<TraccarPosition[]>('positions', params)
  const byDevice = new Map(positions.map((position) => [position.deviceId, position]))

  const vehicles = devices.map((device): Vehicle => {
    const position = byDevice.get(device.id)
    const lastContact = device.lastUpdate ? Date.parse(device.lastUpdate) : undefined
    const silenceMinutes =
      lastContact === undefined
        ? Number.POSITIVE_INFINITY
        : Math.max(0, (serverTime - lastContact) / 60_000)
    const speedKmh = position ? knotsToKmh(position.speed) : 0
    const status = deriveStatus(silenceMinutes, speedKmh)

    return {
      id: device.id,
      // "Demo — <estado>", igual que los vehículos sintéticos: la prueba se
      // ve como un solo set consistente en vez de tres "Demo — X" más un
      // "Camión 01" con otra convención de nombre. El nombre real del
      // dispositivo (`device.name`) no se pierde — sigue en `uniqueId`/los
      // datos del proxy, esto solo cambia lo que se muestra.
      name: `Demo — ${STATUS_META[status].label}`,
      uniqueId: device.uniqueId,
      status,
      position,
      speedKmh,
      silenceMinutes,
      batteryLevel: position?.attributes.batteryLevel,
    }
  })

  return { vehicles: withDemoVehicles(vehicles, serverTime), serverTime }
}

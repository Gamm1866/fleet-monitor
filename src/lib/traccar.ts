import {
  LOST_AFTER_MINUTES,
  MOVING_ABOVE_KMH,
  STALE_AFTER_MINUTES,
  type VehicleStatus,
} from './status'
import { knotsToKmh } from './format'
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
  // El demo de alerta no tiene recorrido real en Traccar: se calcula del
  // mismo modo que su posición actual, sin llamar al proxy.
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
 * Vehículo de demostración.
 *
 * Ahora que la cuenta tiene los cuatro estados cubiertos con dispositivos
 * reales, no hace falta rellenar huecos con vehículos sintéticos estáticos.
 * El único que queda es el que demuestra una funcionalidad que un
 * dispositivo real sin un proceso corriendo todo el tiempo no puede mostrar
 * de forma confiable: la alerta de "se detuvo" (ver `buildAlertDemoVehicle`
 * más abajo).
 */
const DEMO_ORIGIN = { latitude: 4.711, longitude: -74.0721 } // Bogotá
const KNOTS_PER_KMH = 1 / 1.852

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
  return [...vehicles, buildAlertDemoVehicle(serverTime)]
}

export async function fetchFleet(): Promise<FleetSnapshot> {
  const { data: devices, serverTime } = await get<TraccarDevice[]>('devices')

  if (devices.length === 0) {
    return { vehicles: withDemoVehicles([], serverTime), serverTime }
  }

  // `/positions` sin parámetros devuelve un array vacío en la instancia demo,
  // y solo respeta el PRIMER `deviceId` cuando se mandan varios en la misma
  // consulta —con un dispositivo pasaba desapercibido, con varios se traía
  // la posición de uno solo y el resto quedaba en blanco sin que ninguna
  // petición fallara. Una consulta por dispositivo, en paralelo.
  const positionLists = await Promise.all(
    devices.map((device) => {
      const params = new URLSearchParams({ deviceId: String(device.id) })
      return get<TraccarPosition[]>('positions', params).then(({ data }) => data)
    }),
  )
  const byDevice = new Map(
    positionLists.flat().map((position) => [position.deviceId, position]),
  )

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
      // El nombre real del dispositivo, no un alias "Demo — <estado>": con
      // varios dispositivos reales dados de alta, todos DECAEN a "lost" en
      // paralelo en cuanto pasan 30 minutos sin que nadie les mande una
      // posición nueva (Traccar mide el silencio contra la hora en que
      // llega el request, no contra el timestamp que uno le manda — no se
      // puede fingir). Si a todos les tocara el mismo alias dinámico,
      // terminarían mostrando el mismo nombre a la vez — la flota sintética
      // ya cubre los estados con nombres fijos que no chocan con estos.
      name: device.name,
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

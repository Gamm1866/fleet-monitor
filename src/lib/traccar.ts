import {
  LOST_AFTER_MINUTES,
  MOVING_ABOVE_KMH,
  STALE_AFTER_MINUTES,
  type VehicleStatus,
} from './status'
import { knotsToKmh } from './format'

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

async function get<T>(resource: string, params?: URLSearchParams) {
  const query = params?.toString()
  const response = await fetch(`/api/traccar/${resource}${query ? `?${query}` : ''}`)

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Traccar respondió ${response.status}: ${detail.slice(0, 200)}`)
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

export async function fetchFleet(): Promise<FleetSnapshot> {
  const { data: devices, serverTime } = await get<TraccarDevice[]>('devices')

  if (devices.length === 0) {
    return { vehicles: [], serverTime }
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

    return {
      id: device.id,
      name: device.name,
      uniqueId: device.uniqueId,
      status: deriveStatus(silenceMinutes, speedKmh),
      position,
      speedKmh,
      silenceMinutes,
      batteryLevel: position?.attributes.batteryLevel,
    }
  })

  return { vehicles, serverTime }
}

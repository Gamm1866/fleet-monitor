import { haversineMeters } from './geo'

export interface Geofence {
  id: number
  name: string
  center: [number, number]
  radiusMeters: number
  /** Distingue el geofence de demostración de uno real dado de alta en Traccar. */
  isDemo: boolean
}

/**
 * Traccar guarda el área como WKT. Esta app solo entiende `CIRCLE`, que es la
 * forma que cubre el caso real de "el vehículo salió del predio/la zona de
 * reparto" sin meter un parser de polígonos completo para una prueba técnica.
 * Un geofence poligonal real, dado de alta en Traccar, simplemente no se
 * dibuja — no rompe nada, solo no se representa.
 */
const CIRCLE_AREA_RE =
  /CIRCLE\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/i

export function parseCircleArea(
  area: string,
): { center: [number, number]; radiusMeters: number } | null {
  const match = CIRCLE_AREA_RE.exec(area)
  if (!match) return null

  const [, lat, lon, radius] = match
  return { center: [Number(lat), Number(lon)], radiusMeters: Number(radius) }
}

export function isInsideGeofence(lat: number, lon: number, geofence: Geofence): boolean {
  return haversineMeters(lat, lon, geofence.center[0], geofence.center[1]) <= geofence.radiusMeters
}

/** ¿Está el punto dentro de al menos uno de los geofences? `true` si no hay ninguno definido. */
export function isWithinAnyGeofence(
  lat: number,
  lon: number,
  geofences: Geofence[],
): boolean {
  if (geofences.length === 0) return true
  return geofences.some((geofence) => isInsideGeofence(lat, lon, geofence))
}

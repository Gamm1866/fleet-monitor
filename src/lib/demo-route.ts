/**
 * Puntos fijos de una ruta real por Usaquén (Bogotá) — ya resueltos una vez
 * contra OSRM, no hace falta pedirlos de nuevo. Compartida por el cron que
 * mueve a Camión 02 (api/cron/refresh-demo.ts) y por el vehículo demo que se
 * detiene a los 2 min (src/lib/traccar.ts): ambos son puntos sintéticos y
 * ninguno debería flotar sobre un humedal en vez de seguir una calle.
 */
export const ROUTE_POINTS: [number, number][] = [
  [4.710894, -74.07209],
  [4.710512, -74.068215],
  [4.708933, -74.062978],
  [4.706611, -74.058103],
  [4.704127, -74.053841],
  [4.701595, -74.049866],
  [4.699241, -74.045513],
  [4.697912, -74.040505],
]

export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLon = toRad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

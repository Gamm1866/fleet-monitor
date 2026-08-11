import type { IncomingMessage, ServerResponse } from 'node:http'

// ponytail: duplicado de src/lib/demo-route.ts en vez de importado — el
// bundler de Node/ESM de Vercel no empaqueta imports relativos fuera de
// api/ para funciones serverless (ERR_MODULE_NOT_FOUND en runtime aunque el
// build pase). Si demo-route.ts cambia, replicar aquí también.
const ROUTE_POINTS: [number, number][] = [
  [4.710894, -74.07209],
  [4.710915, -74.071853],
  [4.710994, -74.071293],
  [4.711082, -74.070717],
  [4.711157, -74.070108],
  [4.711163, -74.069713],
  [4.711092, -74.069106],
  [4.710883, -74.06845],
  [4.710313, -74.06717],
  [4.709897, -74.066364],
  [4.709454, -74.065651],
  [4.709166, -74.065043],
  [4.708917, -74.064476],
  [4.708707, -74.06402],
  [4.7081, -74.062601],
  [4.707889, -74.061727],
  [4.707683, -74.060564],
  [4.70729, -74.058218],
  [4.706997, -74.056473],
  [4.706861, -74.055659],
  [4.706851, -74.054751],
  [4.7064, -74.052267],
  [4.706124, -74.051343],
  [4.705856, -74.050466],
  [4.705701, -74.049964],
  [4.705604, -74.049646],
  [4.705397, -74.048958],
  [4.70533, -74.048733],
  [4.705114, -74.048013],
  [4.704948, -74.04746],
  [4.704747, -74.046809],
  [4.704475, -74.045896],
  [4.704405, -74.045655],
  [4.704328, -74.04536],
  [4.704195, -74.04464],
  [4.704075, -74.0435],
  [4.704021, -74.042934],
  [4.703994, -74.042701],
  [4.703936, -74.042178],
  [4.703871, -74.041162],
  [4.703863, -74.041024],
  [4.703854, -74.040879],
  [4.703804, -74.039957],
  [4.703781, -74.039484],
  [4.703731, -74.039415],
  [4.703144, -74.039455],
  [4.70231, -74.039502],
  [4.701973, -74.039513],
  [4.701842, -74.039545],
  [4.70162, -74.03968],
  [4.700926, -74.039728],
  [4.70078, -74.039735],
  [4.698733, -74.039841],
  [4.698579, -74.03985],
  [4.697884, -74.039947],
  [4.697912, -74.040505],
]

function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLon = toRad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/**
 * Mantiene vivo a Camión 02 (moviéndose).
 *
 * Sin esto, cualquier dispositivo real decae a "sin contacto" a los 30
 * minutos de la última posición. Cada llamada le manda al protocolo OsmAnd de
 * Traccar una posición nueva con la hora actual, así el silencio nunca pasa de
 * unos minutos.
 *
 * Quien llama es el proceso de keepalive/ en Railway, cada 60 s. GitHub
 * Actions también lo llama, pero como red de seguridad: promete una corrida
 * cada 5 minutos y en la práctica entrega ~1 por hora, insuficiente para los
 * 30 minutos de margen.
 */

async function ping(
  uniqueId: string,
  lat: number,
  lon: number,
  speedKmh: number,
  course: number,
  battery: number,
): Promise<void> {
  const ts = Math.floor(Date.now() / 1000)
  const speedKnots = speedKmh / 1.852
  const url =
    `http://demo.traccar.org:5055/?id=${uniqueId}&timestamp=${ts}&lat=${lat}&lon=${lon}` +
    `&speed=${speedKnots.toFixed(2)}&bearing=${course.toFixed(1)}&altitude=2600&batt=${battery}`
  await fetch(url)
}

export default async function handler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Camión 02: avanza de punto en punto sobre la ruta, ida y vuelta, cada
  // corrida del cron — así se ve realmente moverse de una llamada a otra.
  const tickIndex = Math.floor(Date.now() / 60_000)
  const cycle = ROUTE_POINTS.length * 2 - 2
  const pos = tickIndex % cycle
  const routeIndex = pos < ROUTE_POINTS.length ? pos : cycle - pos
  const nextIndex = Math.min(routeIndex + 1, ROUTE_POINTS.length - 1)
  const [lat, lon] = ROUTE_POINTS[routeIndex]
  const [nextLat, nextLon] = ROUTE_POINTS[nextIndex]
  const course = routeIndex === nextIndex ? 0 : bearing(lat, lon, nextLat, nextLon)

  try {
    await ping('camion02-monitor-2026', lat, lon, 32, course, 88)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: true, routeIndex }))
  } catch {
    res.statusCode = 502
    res.end(JSON.stringify({ ok: false }))
  }
}

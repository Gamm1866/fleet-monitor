import type { IncomingMessage, ServerResponse } from 'node:http'
import { ROUTE_POINTS, bearing } from '../../src/lib/demo-route'

/**
 * Mantiene vivos a Camión 02 (moviéndose) y Camión 03 (detenido).
 *
 * Sin esto, cualquier dispositivo real decae a "sin contacto" a los 30
 * minutos de la última posición — y como los tres se sembraban a mano en el
 * mismo momento, decaían todos juntos, mostrando la flota entera en el mismo
 * estado. Vercel Cron llama a este endpoint cada 5 minutos; cada llamada le
 * manda al protocolo OsmAnd de Traccar una posición nueva con la hora
 * actual, así el silencio nunca pasa de unos minutos.
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
  const tickIndex = Math.floor(Date.now() / (5 * 60_000))
  const cycle = ROUTE_POINTS.length * 2 - 2
  const pos = tickIndex % cycle
  const routeIndex = pos < ROUTE_POINTS.length ? pos : cycle - pos
  const nextIndex = Math.min(routeIndex + 1, ROUTE_POINTS.length - 1)
  const [lat, lon] = ROUTE_POINTS[routeIndex]
  const [nextLat, nextLon] = ROUTE_POINTS[nextIndex]
  const course = routeIndex === nextIndex ? 0 : bearing(lat, lon, nextLat, nextLon)

  try {
    await Promise.all([
      ping('camion02-monitor-2026', lat, lon, 32, course, 88),
      // Camión 03: siempre el mismo punto, velocidad 0 — detenido de verdad,
      // no en movimiento con el reloj congelado.
      ping('camion03-monitor-2026', 4.701595, -74.049866, 0, 0, 74),
    ])
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: true, routeIndex }))
  } catch {
    res.statusCode = 502
    res.end(JSON.stringify({ ok: false }))
  }
}

/**
 * Puntos de una ruta real por Usaquén (Bogotá) — resueltos una vez contra
 * OSRM (router.project-osrm.org, overview=full), no hace falta pedirlos de
 * nuevo. Compartida por el cron que mueve a Camión 02 (api/cron/refresh-demo.ts,
 * copia manual — ver comentario ahí) y por el vehículo demo que se detiene a
 * los 2 min (src/lib/traccar.ts).
 *
 * Antes eran 8 puntos con ~470m de espaciado interpolados en línea recta:
 * sobre un tramo curvo eso corta directo por manzanas y humedales en vez de
 * seguir la calle. Estos 56 vienen de un muestreo cada 3 puntos sobre la
 * geometría completa que devuelve OSRM (165 puntos), suficiente para que las
 * curvas se vean como curvas sin arrastrar el trazado completo.
 */
export const ROUTE_POINTS: [number, number][] = [
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

export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLon = toRad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

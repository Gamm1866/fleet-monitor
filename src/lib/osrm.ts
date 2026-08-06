/**
 * Ruta real sobre calles, vía OSRM.
 *
 * Servidor demo público (`router.project-osrm.org`), gratis y sin API key —
 * pensado para pruebas, no para tráfico de producción. Si este proyecto
 * necesitara rutas en volumen real, lo que cambia es la URL: mismo contrato
 * apuntando a una instancia propia o a Mapbox/Google Directions.
 */
const OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving'

export interface RoadRoute {
  /** [latitud, longitud], en el orden que recorre la calle. */
  coordinates: [number, number][]
}

export async function fetchRoadRoute(
  from: [number, number],
  to: [number, number],
): Promise<RoadRoute> {
  const coords = `${from[1]},${from[0]};${to[1]},${to[0]}`
  const url = `${OSRM_ROUTE_URL}/${coords}?overview=full&geometries=geojson`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`OSRM respondió ${response.status}`)
  }

  const body = (await response.json()) as {
    routes?: { geometry: { coordinates: [number, number][] } }[]
  }
  const route = body.routes?.[0]

  if (!route) {
    throw new Error('OSRM no encontró una ruta entre los dos puntos')
  }

  // GeoJSON viene [lon, lat]; el resto de la app trabaja en [lat, lon].
  return {
    coordinates: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
  }
}

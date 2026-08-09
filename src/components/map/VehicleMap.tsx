import { useCallback, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useResizeObserver } from '@/hooks/use-resize-observer'
import { animateMarkerTo } from './animate-marker'
import { markerHtml, markerSize } from './marker'
import type { BaseLayer } from './MapLayers'
import { useTheme } from '@/providers/theme-provider'
import { STATUS_META } from '@/lib/status'
import type { Geofence } from '@/lib/geofence'
import type { Vehicle } from '@/lib/traccar'

interface VehicleMapProps {
  vehicles: Vehicle[]
  selectedId?: number
  onSelect: (id: number) => void
  /** Recorrido reciente del vehículo seleccionado, en orden cronológico. */
  route?: L.LatLngTuple[]
  /** Con seguimiento activo el mapa recentra en cada posición nueva. */
  isFollowing: boolean
  /** El mapa avisa cuando el operador toma el control moviéndolo con la mano. */
  onFollowingChange: (isFollowing: boolean) => void
  baseLayer: BaseLayer
  weatherEnabled: boolean
  geofences?: Geofence[]
  /** Posición histórica del vehículo seleccionado mientras se reproduce el
   * recorrido. `undefined` en vivo: no reemplaza al marcador real, se dibuja
   * aparte para no tocar la animación de la posición actual. */
  previewPosition?: { latitude: number; longitude: number }
}

/** Bogotá. Encuadre inicial mientras no hay ninguna posición que mostrar. */
const FALLBACK_CENTER: L.LatLngTuple = [4.711, -74.0721]
const FALLBACK_ZOOM = 12
const FOCUS_ZOOM = 15

const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
}

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

/** Satélite (Esri) y terreno (OpenTopoMap): las dos alternativas gratis sin
 * API key. Ninguna cambia con el tema — son fotos y curvas de nivel, no hay
 * "satélite oscuro". */
const SATELLITE_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const SATELLITE_ATTRIBUTION = '&copy; Esri, Maxar, Earthstar Geographics'
const TERRAIN_TILES = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
const TERRAIN_ATTRIBUTION =
  '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'

/** Radar de lluvia de RainViewer: público, gratis, sin API key. Es la única
 * capa de clima real disponible sin contratar un proveedor de pago. */
async function fetchRainViewerTileUrl(): Promise<string | null> {
  try {
    const response = await fetch('https://api.rainviewer.com/public/weather-maps.json')
    if (!response.ok) return null
    const data = (await response.json()) as {
      radar?: { past?: { path: string }[] }
    }
    const latest = data.radar?.past?.at(-1)
    if (!latest) return null
    return `https://tilecache.rainviewer.com${latest.path}/256/{z}/{x}/{y}/2/1_1.png`
  } catch {
    return null
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function buildIcon(vehicle: Vehicle, isSelected: boolean): L.DivIcon {
  const options = {
    status: vehicle.status,
    course: vehicle.position?.course,
    isSelected,
  }
  const size = markerSize(options)

  return L.divIcon({
    className: 'fleet-marker',
    html: markerHtml(options),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export function VehicleMap({
  vehicles,
  selectedId,
  onSelect,
  route,
  isFollowing,
  onFollowingChange,
  baseLayer,
  weatherEnabled,
  geofences,
  previewPosition,
}: VehicleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map>(null)
  const tileRef = useRef<L.TileLayer>(null)
  const weatherRef = useRef<L.TileLayer>(null)
  const markersRef = useRef(new Map<number, L.Marker>())
  const routeRef = useRef<L.Polyline>(null)
  const originRef = useRef<L.CircleMarker>(null)
  const geofenceLayersRef = useRef<L.Circle[]>([])
  const previewMarkerRef = useRef<L.CircleMarker>(null)
  /** Cancelador de la animación en curso de cada marcador. */
  const animationsRef = useRef(new Map<number, () => void>())
  /** Última firma visual dibujada por cada marcador. */
  const iconStatesRef = useRef(new Map<number, string>())
  // El mapa se crea una sola vez, así que sus handlers no pueden capturar la
  // prop de este render: leen siempre la última versión desde el ref.
  const onFollowingChangeRef = useRef(onFollowingChange)

  useEffect(() => {
    onFollowingChangeRef.current = onFollowingChange
  }, [onFollowingChange])
  /** Último vehículo encuadrado. Distingue "cambió la selección" de "llegó otro sondeo". */
  const focusedRef = useRef<number>(undefined)
  /** La vista general de la flota se encuadra una sola vez, al llegar la
   * primera posición — no en cada sondeo, o el mapa saltaría cada vez que un
   * vehículo se mueve mientras nadie eligió a cuál mirar todavía. */
  const overviewFitRef = useRef(false)
  const { resolved } = useTheme()

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: FALLBACK_CENTER,
      zoom: FALLBACK_ZOOM,
      zoomControl: false,
      // El scroll del mouse sobre el mapa robaría el scroll de la página en
      // pantallas donde el panel queda debajo. Se activa al hacer clic.
      scrollWheelZoom: false,
    })

    map.on('click', () => map.scrollWheelZoom.enable())

    // Arrastrar el mapa apaga el seguimiento. Es la regla que evita la pelea
    // más molesta de un monitor: el operador mueve la vista para revisar otra
    // zona y el sistema se la devuelve al vehículo un segundo después. Quien
    // toma el mapa con la mano manda.
    map.on('dragstart', () => onFollowingChangeRef.current(false))

    // `bottomright` quedaba tapado por la hoja inferior del panel en mobile
    // (a todo lo ancho) y pegado al reproductor de ruta en desktop.
    // `topright` no compite con ninguno de los dos.
    L.control.zoom({ position: 'topright' }).addTo(map)
    mapRef.current = map

    return () => {
      for (const cancel of animationsRef.current.values()) cancel()
      animationsRef.current.clear()
      iconStatesRef.current.clear()
      map.remove()
      mapRef.current = null
      tileRef.current = null
      markersRef.current.clear()
    }
  }, [])

  // Leaflet mide el contenedor una sola vez, al crearse, y en un grid ese
  // momento llega antes de que la celda tenga su ancho definitivo: quedan
  // franjas sin teselas. Hay que avisarle cada vez que la caja cambia —
  // también al plegarse el layout en pantallas chicas.
  const handleResize = useCallback(() => mapRef.current?.invalidateSize(), [])
  useResizeObserver({ ref: containerRef, onResize: handleResize })

  // El basemap se cambia con el tema. Un mapa claro dentro de una interfaz
  // oscura es la fuente de luz más brillante de la pantalla y arruina la
  // jerarquía que sostiene todo lo demás. Satélite y terreno ganan sobre el
  // tema: son capas fotográficas, no hay versión oscura de una foto satelital.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const [url, attribution] =
      baseLayer === 'satellite'
        ? [SATELLITE_TILES, SATELLITE_ATTRIBUTION]
        : baseLayer === 'terrain'
          ? [TERRAIN_TILES, TERRAIN_ATTRIBUTION]
          : [TILES[resolved], ATTRIBUTION]

    tileRef.current?.remove()
    tileRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(map)
    // La capa de clima va sobre el mapa base: si el base se reconstruye,
    // vuelve a quedar debajo del radar en vez de encima.
    weatherRef.current?.bringToFront()
  }, [resolved, baseLayer])

  // Overlay de clima: se pide una sola vez por activación, no en cada
  // sondeo — el radar de RainViewer no cambia cada 8 segundos.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    weatherRef.current?.remove()
    weatherRef.current = null
    if (!weatherEnabled) return

    let cancelled = false
    fetchRainViewerTileUrl().then((url) => {
      if (cancelled || !url || !mapRef.current) return
      // RainViewer no genera tiles más allá de zoom 12: pedirlos a un zoom
      // mayor devuelve un tile de "no soportado". `maxNativeZoom` hace que
      // Leaflet reuse y escale el tile de zoom 12 en vez de pedir uno que no
      // existe.
      weatherRef.current = L.tileLayer(url, {
        opacity: 0.55,
        zIndex: 450,
        maxNativeZoom: 12,
      }).addTo(mapRef.current)
    })

    return () => {
      cancelled = true
    }
  }, [weatherEnabled])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const markers = markersRef.current
    const seen = new Set<number>()

    for (const vehicle of vehicles) {
      if (!vehicle.position) continue

      seen.add(vehicle.id)
      const { latitude, longitude } = vehicle.position
      const isSelected = vehicle.id === selectedId
      const target = L.latLng(latitude, longitude)
      // Firma de lo que el icono dibuja. Reemplazar el DOM del marcador en
      // cada sondeo cortaría la animación de pulso y el deslizamiento a la
      // mitad, así que solo se reconstruye cuando cambia algo que se ve.
      // El rumbo se redondea a 5°: por debajo de eso el giro no se percibe y
      // solo provocaría reconstruir el marcador en cada sondeo.
      const heading = Math.round((vehicle.position.course ?? 0) / 5) * 5
      const iconState = `${vehicle.status}:${isSelected}:${heading}`

      const existing = markers.get(vehicle.id)

      if (existing) {
        if (iconStatesRef.current.get(vehicle.id) !== iconState) {
          existing.setIcon(buildIcon(vehicle, isSelected))
          iconStatesRef.current.set(vehicle.id, iconState)
        }

        existing.setZIndexOffset(isSelected ? 1000 : 0)

        if (!existing.getLatLng().equals(target)) {
          // Una sola animación por marcador: si llega una posición nueva antes
          // de que termine la anterior, se cancela y se sale desde donde está,
          // no desde donde debería haber estado.
          animationsRef.current.get(vehicle.id)?.()
          animationsRef.current.set(
            vehicle.id,
            animateMarkerTo(existing, target, { reducedMotion: prefersReducedMotion() }),
          )
        }

        continue
      }

      iconStatesRef.current.set(vehicle.id, iconState)

      const marker = L.marker(target, {
        icon: buildIcon(vehicle, isSelected),
        zIndexOffset: isSelected ? 1000 : 0,
        keyboard: true,
        // El marcador es un control real, no una decoración: se alcanza con
        // Tab y se anuncia con el nombre y el estado del vehículo.
        alt: `${vehicle.name}. ${STATUS_META[vehicle.status].announcement}`,
      })
        .addTo(map)
        .on('click', () => onSelect(vehicle.id))
        .on('keydown', (event: L.LeafletKeyboardEvent) => {
          if (event.originalEvent.key === 'Enter' || event.originalEvent.key === ' ') {
            onSelect(vehicle.id)
          }
        })

      markers.set(vehicle.id, marker)
    }

    for (const [id, marker] of markers) {
      if (seen.has(id)) continue
      animationsRef.current.get(id)?.()
      animationsRef.current.delete(id)
      iconStatesRef.current.delete(id)
      marker.remove()
      markers.delete(id)
    }
  }, [vehicles, selectedId, onSelect])

  // Recorrido reciente.
  //
  // Va debajo de los marcadores y en un tono atenuado a propósito: el trazo es
  // contexto —de dónde viene—, no el dato principal. Si compite en peso visual
  // con la posición actual, el operador tarda en encontrar dónde está el
  // vehículo, que es la única pregunta urgente.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    routeRef.current?.remove()
    originRef.current?.remove()
    routeRef.current = null
    originRef.current = null

    // Un solo punto no es un recorrido: dibujar una línea de longitud cero
    // deja un artefacto sin significado.
    if (!route || route.length < 2) return

    const styles = getComputedStyle(document.documentElement)
    const color = styles.getPropertyValue('--color-accent').trim()

    routeRef.current = L.polyline(route, {
      color,
      weight: 3,
      opacity: 0.55,
      lineJoin: 'round',
      lineCap: 'round',
      // Fuera del orden de tabulación: la ruta ya se describe en el panel y un
      // trazo sin contenido en el foco solo agrega paradas vacías al teclado.
      interactive: false,
    }).addTo(map)

    // Punta de origen: sin ella el trazo no dice en qué dirección se recorrió.
    originRef.current = L.circleMarker(route[0], {
      radius: 4,
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.3,
      interactive: false,
    }).addTo(map)
  }, [route])

  // Geofences: círculos fijos, no cambian con el sondeo de posición.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    for (const circle of geofenceLayersRef.current) circle.remove()
    geofenceLayersRef.current = []

    if (!geofences) return

    const styles = getComputedStyle(document.documentElement)
    const color = styles.getPropertyValue('--color-status-stale').trim()

    geofenceLayersRef.current = geofences.map((geofence) =>
      L.circle(geofence.center, {
        radius: geofence.radiusMeters,
        color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.06,
        dashArray: geofence.isDemo ? '6 4' : undefined,
        interactive: false,
      }).addTo(map),
    )
  }, [geofences])

  // Marcador fantasma de la reproducción: aparte del marcador en vivo, para
  // no interferir con su animación de deslizamiento entre sondeos.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    previewMarkerRef.current?.remove()
    previewMarkerRef.current = null

    if (!previewPosition) return

    const styles = getComputedStyle(document.documentElement)
    const color = styles.getPropertyValue('--color-accent').trim()
    const outline = styles.getPropertyValue('--color-surface').trim()

    previewMarkerRef.current = L.circleMarker(
      [previewPosition.latitude, previewPosition.longitude],
      {
        radius: 7,
        color: outline,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.9,
        interactive: false,
      },
    ).addTo(map)
  }, [previewPosition])

  // Vista general: sin nadie seleccionado todavía, la primera pantalla
  // encuadra a toda la flota en vez de dejar el mapa centrado en Bogotá por
  // defecto sin motivo. Es la pantalla "general" antes del detalle.
  useEffect(() => {
    const map = mapRef.current
    if (!map || selectedId !== undefined || overviewFitRef.current) return

    const positions = vehicles
      .filter((vehicle) => vehicle.position)
      .map((vehicle) => L.latLng(vehicle.position!.latitude, vehicle.position!.longitude))

    if (positions.length === 0) return

    overviewFitRef.current = true

    if (positions.length === 1) {
      map.setView(positions[0], FOCUS_ZOOM, { animate: false })
    } else {
      map.fitBounds(L.latLngBounds(positions), { padding: [48, 48], maxZoom: FOCUS_ZOOM, animate: false })
    }
  }, [vehicles, selectedId])

  // Seguimiento del vehículo seleccionado.
  //
  // Al CAMBIAR de vehículo siempre se encuadra: es una acción del operador y
  // espera que el mapa lo lleve. Después manda el interruptor de seguimiento,
  // que arranca encendido —el mapa recentra en cada posición nueva— y se apaga
  // solo en cuanto el operador arrastra el mapa con la mano.
  //
  // `prefers-reduced-motion` no se negocia: el desplazamiento animado de un
  // mapa es de los movimientos más agresivos que puede hacer una interfaz.
  useEffect(() => {
    const map = mapRef.current
    const selected = vehicles.find((vehicle) => vehicle.id === selectedId)
    if (!map || !selected?.position) return

    const target = L.latLng(selected.position.latitude, selected.position.longitude)
    const isNewSelection = focusedRef.current !== selectedId

    if (isNewSelection) {
      // Se marca resuelto ACÁ, antes de animar, no después: el recorrido
      // llega en una consulta aparte un instante más tarde, y si se espera a
      // marcarlo, ese segundo render dispara un SEGUNDO viaje encima del
      // primero — el mapa se ve dar dos saltos por un solo click.
      focusedRef.current = selectedId

      const targetZoom = Math.max(map.getZoom(), FOCUS_ZOOM)

      // Vuelo suave a la posición del vehículo, como al tocar un marcador en
      // Google Maps: un solo movimiento con inicio y final relajados, ni
      // instantáneo ni lento. `prefers-reduced-motion` cae directo al salto
      // fijo — acá no hay margen de negociación.
      if (prefersReducedMotion()) {
        map.setView(target, targetZoom, { animate: false })
      } else {
        map.flyTo(target, targetZoom, { duration: 1, easeLinearity: 0.25 })
      }

      return
    }

    if (!isFollowing) return

    // Desplazamiento suave, no salto: el mapa acompaña al marcador que ya se
    // está deslizando en vez de teletransportarse debajo de él.
    map.panTo(target, { animate: !prefersReducedMotion() })
  }, [vehicles, selectedId, route, isFollowing])

  return (
    <div
      ref={containerRef}
      className="fleet-map size-full"
      // El mapa es un complemento: todo dato que muestra existe también como
      // texto en el panel. Sin esa garantía, un mapa no es accesible.
      role="application"
      aria-label="Mapa de la flota. Los datos de cada vehículo están disponibles en el panel lateral."
    />
  )
}

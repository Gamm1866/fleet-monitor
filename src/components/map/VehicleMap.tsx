import { useCallback, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useResizeObserver } from '@/hooks/use-resize-observer'
import { animateMarkerTo } from './animate-marker'
import { useTheme } from '@/providers/theme-provider'
import { STATUS_META, type VehicleStatus } from '@/lib/status'
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
}

/** Bogotá. Encuadre inicial mientras no hay ninguna posición que mostrar. */
const FALLBACK_CENTER: L.LatLngTuple = [4.711, -74.0721]
const FALLBACK_ZOOM = 12
const FOCUS_ZOOM = 15

// Se usan clases completas y no interpoladas: Tailwind lee el código como
// texto plano y una clase armada con template string nunca llega al CSS.
const MARKER_TONE: Record<VehicleStatus, string> = {
  moving: 'bg-status-online',
  stopped: 'bg-status-offline',
  stale: 'bg-status-stale',
  lost: 'bg-status-critical',
}

const MARKER_INK: Record<VehicleStatus, string> = {
  moving: 'text-status-online',
  stopped: 'text-status-offline',
  stale: 'text-status-stale',
  lost: 'text-status-critical',
}

const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
}

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Marcador del vehículo: flecha si va a algún lado, punto si no.
 *
 * La forma comunica antes que el color, y aquí carga la información que el
 * color no puede: hacia dónde va. Pero el rumbo solo se dibuja en movimiento —
 * por debajo de 2 km/h el `course` que reporta el GPS es ruido, y una flecha
 * apuntando a un rumbo inventado es peor que ninguna flecha: el operador la
 * lee como un hecho.
 *
 * Un vehículo detenido, sin reportar o sin contacto es un punto: no afirma una
 * dirección que no se sabe.
 */
function markerHtml(vehicle: Vehicle, isSelected: boolean): string {
  const dimmed = isSelected ? '' : 'opacity-45'

  if (vehicle.status !== 'moving' || !vehicle.position) {
    const tone = MARKER_TONE[vehicle.status]
    return `<span class="relative flex size-3.5 ${dimmed}">
      <span class="relative inline-flex size-3.5 rounded-full ${tone} ring-2 ring-surface"></span>
    </span>`
  }

  const ink = MARKER_INK[vehicle.status]
  // El halo solo late en el vehículo seleccionado. Animar todos a la vez
  // convierte el mapa en ruido y deja de señalar nada, que es justo lo
  // contrario de lo que debe hacer una alerta.
  const halo = isSelected
    ? `<span class="absolute inset-1.5 animate-status-pulse rounded-full ${MARKER_TONE[vehicle.status]} opacity-50"></span>`
    : ''

  // El `stroke` del color de la superficie hace que la flecha se lea sobre
  // cualquier tesela, clara u oscura, sin depender del basemap.
  return `<span class="relative flex size-6 items-center justify-center ${dimmed}">
    ${halo}
    <svg viewBox="0 0 24 24" class="relative size-6 ${ink}" style="transform: rotate(${Math.round(vehicle.position.course)}deg)" aria-hidden="true">
      <path d="M12 3.2 18.4 20 12 16.3 5.6 20Z" fill="currentColor" stroke="var(--color-surface)" stroke-width="1.4" stroke-linejoin="round"/>
    </svg>
  </span>`
}

function buildIcon(vehicle: Vehicle, isSelected: boolean): L.DivIcon {
  const size = vehicle.status === 'moving' && vehicle.position ? 24 : 14

  return L.divIcon({
    className: 'fleet-marker',
    html: markerHtml(vehicle, isSelected),
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
}: VehicleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map>(null)
  const tileRef = useRef<L.TileLayer>(null)
  const markersRef = useRef(new Map<number, L.Marker>())
  const routeRef = useRef<L.Polyline>(null)
  const originRef = useRef<L.CircleMarker>(null)
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

    L.control.zoom({ position: 'bottomright' }).addTo(map)
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
  // jerarquía que sostiene todo lo demás.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    tileRef.current?.remove()
    tileRef.current = L.tileLayer(TILES[resolved], {
      attribution: ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map)
  }, [resolved])

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
      // El recorrido llega en una consulta aparte y siempre después de la
      // posición. Se encuadra provisionalmente sin marcar la selección como
      // resuelta, para volver a encuadrar cuando el trazo exista.
      if (route === undefined) {
        map.setView(target, Math.max(map.getZoom(), FOCUS_ZOOM), { animate: false })
        return
      }

      // Sin animación: el zoom animado de Leaflet se interrumpe con cada
      // refetch y deja teselas de un nivel estiradas sobre otro, borrosas.
      if (route.length > 1) {
        // Con recorrido, el encuadre es el recorrido entero: centrar en el
        // punto actual deja el origen fuera de pantalla y el trazo se lee como
        // una línea que entra desde la nada. `maxZoom` evita que un vehículo
        // quieto durante horas acerque el mapa hasta la vereda.
        map.fitBounds(L.latLngBounds(route), {
          padding: [48, 48],
          maxZoom: FOCUS_ZOOM,
          animate: false,
        })
      } else {
        map.setView(target, Math.max(map.getZoom(), FOCUS_ZOOM), { animate: false })
      }

      focusedRef.current = selectedId
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

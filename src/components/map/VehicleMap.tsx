import { useCallback, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useResizeObserver } from '@/hooks/use-resize-observer'
import { useTheme } from '@/providers/theme-provider'
import { STATUS_META, type VehicleStatus } from '@/lib/status'
import type { Vehicle } from '@/lib/traccar'

interface VehicleMapProps {
  vehicles: Vehicle[]
  selectedId?: number
  onSelect: (id: number) => void
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

const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
}

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

function markerHtml(vehicle: Vehicle, isSelected: boolean): string {
  const tone = MARKER_TONE[vehicle.status]
  // El halo solo late en el vehículo seleccionado y en movimiento. Animar
  // todos los puntos a la vez convierte el mapa en ruido y deja de señalar
  // nada, que es justo lo contrario de lo que debe hacer una alerta.
  const halo =
    isSelected && vehicle.status === 'moving'
      ? `<span class="absolute inline-flex size-full animate-status-pulse rounded-full ${tone} opacity-60"></span>`
      : ''

  return `<span class="relative flex size-3.5 ${isSelected ? '' : 'opacity-45'}">
    ${halo}
    <span class="relative inline-flex size-3.5 rounded-full ${tone} ring-2 ring-surface"></span>
  </span>`
}

export function VehicleMap({ vehicles, selectedId, onSelect }: VehicleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map>(null)
  const tileRef = useRef<L.TileLayer>(null)
  const markersRef = useRef(new Map<number, L.Marker>())
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
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    mapRef.current = map

    return () => {
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
      const icon = L.divIcon({
        className: 'fleet-marker',
        html: markerHtml(vehicle, isSelected),
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })

      const existing = markers.get(vehicle.id)

      if (existing) {
        existing.setLatLng([latitude, longitude])
        existing.setIcon(icon)
        existing.setZIndexOffset(isSelected ? 1000 : 0)
        continue
      }

      const marker = L.marker([latitude, longitude], {
        icon,
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
      marker.remove()
      markers.delete(id)
    }
  }, [vehicles, selectedId, onSelect])

  // Seguimiento del vehículo seleccionado.
  //
  // Dos reglas, y las dos son decisiones de producto:
  //
  // 1. Solo se encuadra al CAMBIAR de vehículo. Recentrar en cada sondeo le
  //    arranca el mapa de las manos al operador que estaba mirando otra zona,
  //    cada ocho segundos.
  // 2. Mientras el vehículo siga seleccionado solo se desplaza si se salió del
  //    encuadre. Perseguirlo píxel a píxel convierte un mapa en un temblor.
  //
  // `prefers-reduced-motion` no se negocia: el desplazamiento animado de un
  // mapa es de los movimientos más agresivos que puede hacer una interfaz.
  useEffect(() => {
    const map = mapRef.current
    const selected = vehicles.find((vehicle) => vehicle.id === selectedId)
    if (!map || !selected?.position) return

    const target = L.latLng(selected.position.latitude, selected.position.longitude)
    const isNewSelection = focusedRef.current !== selectedId
    focusedRef.current = selectedId

    if (isNewSelection) {
      // Sin animación: el zoom animado de Leaflet se interrumpe con cada
      // refetch y deja teselas de un nivel estiradas sobre otro, borrosas.
      map.setView(target, Math.max(map.getZoom(), FOCUS_ZOOM), { animate: false })
      return
    }

    if (!map.getBounds().contains(target)) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      map.panTo(target, { animate: !reducedMotion })
    }
  }, [vehicles, selectedId])

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

import { cx } from '@/utils/cx'
import type { VehicleStatus } from '@/lib/status'
import { formatDecimal } from '@/lib/format'
import type { Vehicle } from '@/lib/traccar'
import { Skeleton } from '@/components/ui/Skeleton'

interface VehicleListProps {
  vehicles: Vehicle[]
  selectedId?: number
  onSelect: (id: number) => void
  /** Sin flota todavía: dibuja filas de relleno en vez de una lista vacía. */
  loading?: boolean
}

const DOT: Record<VehicleStatus, string> = {
  moving: 'bg-status-online',
  stopped: 'bg-status-offline',
  stale: 'bg-status-stale',
  lost: 'bg-status-critical',
}

/** Cuántas filas de relleno se dibujan mientras no hay flota todavía. Un
 * número fijo, no medido: no hay dato real que diga cuántos vehículos va a
 * traer la respuesta. */
const SKELETON_ROWS = 4

/**
 * Color por nivel de batería del rastreador (no del vehículo — ver la misma
 * aclaración en VehiclePanel). Mismo vocabulario semántico que el estado del
 * vehículo (verde/ámbar/rojo) en vez de tokens nuevos: 20% es el corte que
 * Traccar marca como batería baja, la señal que de verdad importa acá.
 */
function batteryColor(level: number): string {
  if (level <= 20) return 'fill-status-critical'
  if (level <= 50) return 'fill-status-stale'
  return 'fill-status-online'
}

/**
 * Pila física, no un ícono de librería: cuerpo + terminal, con una barra
 * interna que sube o baja con el nivel real en vez de saltar entre 4 dibujos
 * fijos (vacía/baja/media/llena). El color ya dice "atención" o "normal" de
 * un vistazo; el número exacto vive en el tooltip, no compite en la fila.
 */
function BatteryGauge({ level }: { level: number }) {
  const clamped = Math.min(100, Math.max(0, level))
  const bodyHeight = 12
  const fillHeight = Math.max(2, Math.round((clamped / 100) * bodyHeight))

  return (
    <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
      <rect x="3" y="0" width="4" height="2" rx="1" className="fill-text-quaternary" />
      <rect
        x="0.5"
        y="2.5"
        width="9"
        height="13"
        rx="2"
        className="fill-none stroke-text-quaternary"
        strokeWidth="1"
      />
      <rect
        x="2"
        y={14.5 - fillHeight}
        width="6"
        height={fillHeight}
        rx="1"
        className={batteryColor(clamped)}
      />
    </svg>
  )
}

/** Fila de relleno: mismo alto y misma disposición que una fila real, sin
 * texto real dentro — igual que el resto de los skeletons de la app, el
 * tamaño lo da texto invisible, no un valor en píxeles a mantener a mano. */
function VehicleRowSkeleton() {
  return (
    <li>
      <div className="flex w-full items-center gap-3 rounded-control bg-surface px-3 py-2.5 shadow-[0_1px_2px_rgb(15_21_32_/_0.05)]">
        <Skeleton className="size-2 shrink-0 rounded-full">•</Skeleton>
        <Skeleton className="flex-1 text-data-md">Camión 00</Skeleton>
        <Skeleton className="tabular text-data-sm">00,0 km/h</Skeleton>
        <Skeleton className="size-4 rounded-[2px]">■</Skeleton>
      </div>
    </li>
  )
}

/**
 * Selector de vehículo.
 *
 * Botones dentro de una lista, no un `<select>`: el estado de cada vehículo se
 * ve sin abrir nada, que es el punto de una sala de control. Y no son divs con
 * onClick — un botón trae foco, Enter, Espacio y rol sin escribir una línea.
 */
export function VehicleList({ vehicles, selectedId, onSelect, loading = false }: VehicleListProps) {
  if (loading && vehicles.length === 0) {
    return (
      <nav aria-label="Vehículos de la flota" className="p-3">
        <ul className="flex flex-col gap-2">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <VehicleRowSkeleton key={index} />
          ))}
        </ul>
      </nav>
    )
  }

  return (
    <nav aria-label="Vehículos de la flota" className="p-3">
      <ul className="flex flex-col gap-2">
        {vehicles.map((vehicle) => {
          const isSelected = vehicle.id === selectedId

          return (
            <li key={vehicle.id}>
              <button
                type="button"
                onClick={() => onSelect(vehicle.id)}
                aria-current={isSelected ? 'true' : undefined}
                className={cx(
                  'flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left shadow-[0_1px_2px_rgb(15_21_32_/_0.05)] transition-all duration-fast active:scale-[0.98]',
                  isSelected
                    ? 'bg-bg-active text-text-primary'
                    : 'bg-surface text-text-secondary hover:bg-bg-active/60',
                )}
              >
                <span className={cx('size-2 shrink-0 rounded-full', DOT[vehicle.status])} />
                <span className="flex-1 truncate text-data-md">{vehicle.name}</span>
                {/* El estado ya lo dice el punto de color; acá siempre va la
                    velocidad, dato pedido explícitamente para la vista
                    general — el detalle aclara si es la última conocida. */}
                <span className="tabular text-data-sm text-text-tertiary">
                  {formatDecimal(vehicle.speedKmh)} km/h
                </span>
                {vehicle.batteryLevel === undefined ? null : (
                  // `group/battery` en vez de `group`: el botón entero ya es
                  // el `group` de la fila (así funciona el hover general), un
                  // segundo scope con el mismo nombre pisaría el estado de
                  // hover de la fila con el de este span nomás.
                  <span
                    className="group/battery relative flex shrink-0 items-center"
                    aria-label={`Batería del rastreador: ${Math.round(vehicle.batteryLevel)}%`}
                  >
                    <BatteryGauge level={vehicle.batteryLevel} />
                    <span
                      role="tooltip"
                      aria-hidden="true"
                      className="pointer-events-none absolute right-0 bottom-full z-10 mb-1.5 whitespace-nowrap rounded-chip bg-text-primary px-2 py-1 text-label text-surface opacity-0 shadow-raised transition-opacity duration-fast group-hover/battery:opacity-100"
                    >
                      Batería: {Math.round(vehicle.batteryLevel)}%
                    </span>
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

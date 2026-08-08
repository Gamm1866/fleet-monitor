import { cx } from '@/utils/cx'
import type { VehicleStatus } from '@/lib/status'
import { formatDecimal } from '@/lib/format'
import type { Vehicle } from '@/lib/traccar'

interface VehicleListProps {
  vehicles: Vehicle[]
  selectedId?: number
  onSelect: (id: number) => void
}

const DOT: Record<VehicleStatus, string> = {
  moving: 'bg-status-online',
  stopped: 'bg-status-offline',
  stale: 'bg-status-stale',
  lost: 'bg-status-critical',
}

/**
 * Selector de vehículo.
 *
 * Botones dentro de una lista, no un `<select>`: el estado de cada vehículo se
 * ve sin abrir nada, que es el punto de una sala de control. Y no son divs con
 * onClick — un botón trae foco, Enter, Espacio y rol sin escribir una línea.
 */
export function VehicleList({ vehicles, selectedId, onSelect }: VehicleListProps) {
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
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

import { BatteryEmpty, BatteryFull, BatteryLow, BatteryMid } from '@untitledui/icons'
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
 * Icono + color por nivel de batería del rastreador (no del vehículo — ver
 * la misma aclaración en VehiclePanel). Los mismos cortes que usa Traccar
 * para "batería baja": por debajo de 20% es la señal que de verdad importa
 * en una sala de control, el resto es solo información de contexto.
 */
function batteryIcon(level: number) {
  if (level <= 20) return BatteryEmpty
  if (level <= 50) return BatteryLow
  if (level <= 80) return BatteryMid
  return BatteryFull
}

function batteryColor(level: number): string {
  return level <= 20 ? 'text-status-critical' : 'text-text-tertiary'
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
          const BatteryIcon =
            vehicle.batteryLevel === undefined ? undefined : batteryIcon(vehicle.batteryLevel)

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
                {BatteryIcon ? (
                  <span
                    className={cx('flex shrink-0 items-center gap-1', batteryColor(vehicle.batteryLevel!))}
                    aria-label={`Batería del rastreador: ${Math.round(vehicle.batteryLevel!)}%`}
                  >
                    <BatteryIcon aria-hidden="true" className="size-4" />
                    <span className="tabular text-data-sm">{Math.round(vehicle.batteryLevel!)}%</span>
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

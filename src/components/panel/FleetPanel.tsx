import { ChevronLeft, Truck01, XClose } from '@untitledui/icons'
import { cx } from '@/utils/cx'
import { VehicleList } from '@/components/panel/VehicleList'
import type { Vehicle } from '@/lib/traccar'

interface FleetPanelProps {
  vehicles: Vehicle[]
  selectedId?: number
  onSelect: (id: number) => void
  isOpen: boolean
  isMinimized: boolean
  onMinimizedChange: (minimized: boolean) => void
  onOpenChange: (open: boolean) => void
}

const RAIL_WIDTH = 'w-11'
const PANEL_WIDTH = 'w-72'

const ICON_BUTTON =
  'flex size-6 items-center justify-center rounded text-text-tertiary transition-colors duration-fast hover:bg-bg-active hover:text-text-primary'

/**
 * Panel de flota acoplado al borde izquierdo, a todo el alto — el mismo
 * lenguaje que un sidebar de mapa real (Traccar, Google Maps): la lista
 * completa siempre visible en su propio carril, no una tarjeta flotando
 * sobre el mapa. Minimizar la deja como un riel angosto; cerrar la saca del
 * todo y deja un botón de un ícono para volver a abrirla.
 */
export function FleetPanel({
  vehicles,
  selectedId,
  onSelect,
  isOpen,
  isMinimized,
  onMinimizedChange,
  onOpenChange,
}: FleetPanelProps) {
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label={`Mostrar la flota, ${vehicles.length} vehículos`}
        className="pointer-events-auto absolute left-3 top-3 z-[500] flex size-9 items-center justify-center rounded-control bg-surface-raised/90 text-text-secondary shadow-raised ring-1 ring-border-default backdrop-blur-sm transition-colors duration-fast hover:text-text-primary"
      >
        <Truck01 aria-hidden="true" className="size-4" />
      </button>
    )
  }

  if (isMinimized) {
    return (
      <button
        type="button"
        onClick={() => onMinimizedChange(false)}
        aria-label={`Mostrar la lista de la flota, ${vehicles.length} vehículos`}
        className={cx(
          RAIL_WIDTH,
          'pointer-events-auto absolute inset-y-0 left-0 z-[500] flex flex-col items-center gap-3 border-r border-border-default bg-surface-raised/95 pt-4 text-text-tertiary shadow-raised backdrop-blur-sm transition-colors duration-fast hover:text-text-primary',
        )}
      >
        <Truck01 aria-hidden="true" className="size-4" />
        <span className="text-data-sm [writing-mode:vertical-rl]">{vehicles.length}</span>
      </button>
    )
  }

  return (
    <div
      className={cx(
        PANEL_WIDTH,
        'pointer-events-auto absolute inset-y-0 left-0 z-[500] flex flex-col border-r border-border-default bg-surface-raised/95 shadow-raised backdrop-blur-sm',
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-subtle px-3 py-2.5">
        <span className="flex items-baseline gap-2">
          <span className="text-data-sm font-medium text-text-primary">Flota</span>
          <span className="tabular text-data-sm text-text-tertiary">{vehicles.length}</span>
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMinimizedChange(true)}
            aria-label="Minimizar la lista de vehículos"
            className={ICON_BUTTON}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar la lista de vehículos"
            className={ICON_BUTTON}
          >
            <XClose aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <VehicleList vehicles={vehicles} selectedId={selectedId} onSelect={onSelect} />
      </div>
    </div>
  )
}

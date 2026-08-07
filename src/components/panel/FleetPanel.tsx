import { useState } from 'react'
import { ChevronDown, Truck01, XClose } from '@untitledui/icons'
import { cx } from '@/utils/cx'
import { VehicleList } from '@/components/panel/VehicleList'
import type { Vehicle } from '@/lib/traccar'

interface FleetPanelProps {
  vehicles: Vehicle[]
  selectedId?: number
  onSelect: (id: number) => void
}

const ICON_BUTTON =
  'flex size-6 items-center justify-center rounded text-text-tertiary transition-colors duration-fast hover:bg-bg-active hover:text-text-primary'

/**
 * Ventana flotante con la flota completa, sobre el mapa.
 *
 * Antes de elegir un vehículo el operador necesita ver todos a la vez —eso
 * pasaba en una columna fija junto al mapa, compitiendo por el mismo alto que
 * el detalle del vehículo seleccionado. Como ventana flotante vive en su
 * propia capa, con dos grados de "quitar del medio": minimizar la deja como
 * una barra de título (el operador la va a volver a abrir en seguida) y
 * cerrar la reduce a un botón de un solo ícono (la sacó de la vista a
 * propósito, por más tiempo).
 */
export function FleetPanel({ vehicles, selectedId, onSelect }: FleetPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  const [isOpen, setIsOpen] = useState(true)

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Mostrar la flota, ${vehicles.length} vehículos`}
        className="pointer-events-auto flex size-9 items-center justify-center rounded-control bg-surface-raised/90 text-text-secondary shadow-raised ring-1 ring-border-default backdrop-blur-sm transition-colors duration-fast hover:text-text-primary"
      >
        <Truck01 aria-hidden="true" className="size-4" />
      </button>
    )
  }

  return (
    <div
      className={cx(
        'pointer-events-auto flex w-72 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-control bg-surface-raised/95 shadow-raised ring-1 ring-border-default backdrop-blur-sm',
        !isMinimized && 'max-h-[min(28rem,60vh)]',
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setIsMinimized((value) => !value)}
          aria-expanded={!isMinimized}
          className="flex items-baseline gap-2 text-left"
        >
          <span className="text-data-sm font-medium text-text-primary">Flota</span>
          <span className="tabular text-data-sm text-text-tertiary">{vehicles.length}</span>
          <span className="sr-only">
            {isMinimized ? 'Mostrar la lista de vehículos' : 'Minimizar la lista de vehículos'}
          </span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMinimized((value) => !value)}
            aria-label={isMinimized ? 'Maximizar' : 'Minimizar'}
            className={ICON_BUTTON}
          >
            <ChevronDown
              aria-hidden="true"
              className={cx('size-4 transition-transform duration-fast', isMinimized && '-rotate-90')}
            />
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Cerrar la lista de vehículos"
            className={ICON_BUTTON}
          >
            <XClose aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      {isMinimized ? null : (
        <div className="min-h-0 overflow-y-auto border-t border-border-subtle">
          <VehicleList vehicles={vehicles} selectedId={selectedId} onSelect={onSelect} />
        </div>
      )}
    </div>
  )
}

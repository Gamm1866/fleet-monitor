import { useState } from 'react'
import { ChevronDown } from '@untitledui/icons'
import { cx } from '@/utils/cx'
import { VehicleList } from '@/components/panel/VehicleList'
import type { Vehicle } from '@/lib/traccar'

interface FleetPanelProps {
  vehicles: Vehicle[]
  selectedId?: number
  onSelect: (id: number) => void
}

/**
 * Ventana flotante con la flota completa, sobre el mapa.
 *
 * Antes de elegir un vehículo el operador necesita ver todos a la vez —eso
 * pasaba en una columna fija junto al mapa, compitiendo por el mismo alto que
 * el detalle del vehículo seleccionado. Como ventana flotante minimizable
 * vive en su propia capa: se puede achicar a solo el título mientras se mira
 * el mapa, y volver a abrir sin perder la posición del mapa ni el
 * seguimiento activo.
 */
export function FleetPanel({ vehicles, selectedId, onSelect }: FleetPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false)

  return (
    <div
      className={cx(
        'pointer-events-auto flex w-72 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-control bg-surface-raised/95 shadow-raised ring-1 ring-border-default backdrop-blur-sm',
        !isMinimized && 'max-h-[min(28rem,60vh)]',
      )}
    >
      <button
        type="button"
        onClick={() => setIsMinimized((value) => !value)}
        aria-expanded={!isMinimized}
        className="flex shrink-0 items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <span className="flex items-baseline gap-2">
          <span className="text-data-sm font-medium text-text-primary">Flota</span>
          <span className="tabular text-data-sm text-text-tertiary">{vehicles.length}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cx(
            'size-4 text-text-tertiary transition-transform duration-fast',
            isMinimized && '-rotate-90',
          )}
        />
        <span className="sr-only">
          {isMinimized ? 'Mostrar la lista de vehículos' : 'Minimizar la lista de vehículos'}
        </span>
      </button>

      {isMinimized ? null : (
        <div className="min-h-0 overflow-y-auto border-t border-border-subtle">
          <VehicleList vehicles={vehicles} selectedId={selectedId} onSelect={onSelect} />
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { ChevronRight } from '@untitledui/icons'
import { cx } from '@/utils/cx'
import { VehiclePanel } from '@/components/panel/VehiclePanel'
import type { Vehicle } from '@/lib/traccar'

interface VehicleDetailPanelProps {
  vehicle: Vehicle
  loading: boolean
  routePoints?: number
  routeWindowHours: number
  outsideGeofenceName?: string
  /** Deseleccionar: vuelve a la vista general de la flota. */
  onClose: () => void
}

/**
 * Detalle del vehículo acoplado al borde derecho, a todo el alto — mismo
 * lenguaje que `FleetPanel` en el borde izquierdo, y el mismo patrón que un
 * panel lateral de registro (Attio, Avalon): no una tarjeta flotando sobre
 * el mapa, un carril fijo. Minimizar la deja como un riel angosto con el
 * nombre en vertical; cerrar deselecciona, porque acá la selección ya ES el
 * estado de qué mostrar — no hace falta un booleano aparte.
 */
export function VehicleDetailPanel({
  vehicle,
  loading,
  routePoints,
  routeWindowHours,
  outsideGeofenceName,
  onClose,
}: VehicleDetailPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false)

  if (isMinimized) {
    return (
      <button
        type="button"
        onClick={() => setIsMinimized(false)}
        aria-label={`Mostrar el detalle de ${vehicle.name}`}
        className="pointer-events-auto absolute inset-y-0 right-0 z-[500] flex w-11 flex-col items-center gap-3 border-l border-border-default bg-surface-raised/95 pt-4 text-text-tertiary shadow-raised backdrop-blur-sm transition-colors duration-fast hover:text-text-primary"
      >
        <ChevronRight aria-hidden="true" className="size-4 rotate-180" />
        <span className="max-w-[70vh] truncate text-data-sm [writing-mode:vertical-rl]">
          {vehicle.name}
        </span>
      </button>
    )
  }

  return (
    <div
      className={cx(
        'pointer-events-auto absolute inset-y-0 right-0 z-[500] flex w-96 max-w-[calc(100vw-1.5rem)] flex-col overflow-y-auto border-l border-border-default bg-surface-raised/95 shadow-raised backdrop-blur-sm',
      )}
    >
      <VehiclePanel
        vehicle={vehicle}
        loading={loading}
        routePoints={routePoints}
        routeWindowHours={routeWindowHours}
        outsideGeofenceName={outsideGeofenceName}
        onMinimize={() => setIsMinimized(true)}
        onClose={onClose}
      />
    </div>
  )
}

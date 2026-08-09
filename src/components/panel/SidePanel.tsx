import { useState } from 'react'
import { ChevronLeft, LayoutRight } from '@untitledui/icons'
import { cx } from '@/utils/cx'
import { VehicleList } from '@/components/panel/VehicleList'
import { VehiclePanel } from '@/components/panel/VehiclePanel'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Vehicle } from '@/lib/traccar'

interface SidePanelProps {
  vehicles: Vehicle[]
  selected?: Vehicle
  onSelect: (id: number) => void
  /** Volver a la lista sin cerrar el panel. */
  onDeselect: () => void
  loading: boolean
  routePoints?: number
  routeWindowHours: number
  outsideGeofenceName?: string
}

const ICON_BUTTON =
  'flex size-6 shrink-0 items-center justify-center rounded text-text-tertiary transition-colors duration-fast hover:bg-bg-active hover:text-text-primary active:scale-90'

/**
 * Ventana flotante en escritorio; hoja inferior en celular — mismo
 * componente, dos posiciones según el ancho, porque una tarjeta de 384px
 * clavada arriba a la derecha en una pantalla de 375px tapa casi todo el
 * mapa. Abajo del breakpoint `sm` se acopla al borde inferior, a todo el
 * ancho, con las esquinas de arriba redondeadas — el patrón que ya conoce
 * cualquiera que usó Google Maps o Uber en el celular.
 *
 * Lista y detalle son dos preguntas distintas, pero la responde LA MISMA
 * ventana: entrás por la lista, elegís un vehículo y transiciona a su
 * detalle con un "volver", en vez de dos paneles compitiendo por el mapa.
 *
 * Un solo control de ventana, no dos: plegar ya deja el mapa casi entero a
 * la vista, así que un botón de cerrar aparte era redundante con el de
 * plegar — dos maneras de decir lo mismo confunden más de lo que ayudan.
 */
export function SidePanel({
  vehicles,
  selected,
  onSelect,
  onDeselect,
  loading,
  routePoints,
  routeWindowHours,
  outsideGeofenceName,
}: SidePanelProps) {
  const [isMinimized, setIsMinimized] = useState(false)

  return (
    <div
      className={cx(
        'pointer-events-auto fixed inset-x-0 bottom-0 z-[500] flex animate-panel-in flex-col overflow-hidden rounded-t-control bg-panel-surface shadow-raised ring-1 ring-border-default',
        'sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-3 sm:w-96 sm:max-w-[calc(100vw-1.5rem)] sm:rounded-control',
        !isMinimized && 'max-h-[70vh] sm:max-h-[min(34rem,calc(100vh-6rem))]',
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5">
        {selected ? (
          <button
            type="button"
            onClick={onDeselect}
            className="flex items-center gap-1 rounded text-data-sm text-text-secondary transition-colors duration-fast hover:text-text-primary active:scale-95"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            Flota
          </button>
        ) : (
          <span className="flex items-baseline gap-2">
            <span className="text-data-sm font-medium text-text-primary">Flota</span>
            {loading && vehicles.length === 0 ? (
              <Skeleton className="tabular text-data-sm">0</Skeleton>
            ) : (
              <span className="tabular text-data-sm text-text-tertiary">{vehicles.length}</span>
            )}
          </span>
        )}

        <button
          type="button"
          onClick={() => setIsMinimized((value) => !value)}
          aria-label={isMinimized ? 'Desplegar' : 'Plegar, ver el mapa completo'}
          aria-pressed={isMinimized}
          className={ICON_BUTTON}
        >
          <LayoutRight aria-hidden="true" className="size-4" />
        </button>
      </div>

      {/* Plegado con `grid-template-rows` en vez de desmontar el contenido:
          la transición anima un alto real sin tener que medir el contenido en
          JS, y funciona sea cual sea la altura de la lista o el detalle. */}
      <div
        className={cx(
          'grid transition-[grid-template-rows] duration-normal ease-[var(--ease)]',
          isMinimized ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
        )}
      >
        <div className="overflow-hidden">
          <div
            className={cx(
              'min-h-0 overflow-y-auto border-t border-border-subtle',
              selected && 'flex flex-col',
            )}
          >
            {selected ? (
              <VehiclePanel
                vehicle={selected}
                loading={loading}
                routePoints={routePoints}
                routeWindowHours={routeWindowHours}
                outsideGeofenceName={outsideGeofenceName}
              />
            ) : (
              <VehicleList vehicles={vehicles} onSelect={onSelect} loading={loading} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

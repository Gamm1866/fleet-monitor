import { useCallback, useState } from 'react'
import { VehicleMap } from '@/components/map/VehicleMap'
import { VehicleList } from '@/components/panel/VehicleList'
import { VehiclePanel } from '@/components/panel/VehiclePanel'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useFleet } from '@/hooks/use-fleet'
import { useRoute } from '@/hooks/use-route'
import { formatTime } from '@/lib/format'
import { ROUTE_WINDOW_HOURS } from '@/lib/traccar'

/**
 * El alta de vehículos vive en Traccar, no acá.
 *
 * El proxy guarda las credenciales de la cuenta y está limitado a GET sobre
 * dos recursos. Abrirlo a POST para crear dispositivos convertiría la URL
 * pública del deploy en un relay de escritura contra la cuenta: cualquiera que
 * la conozca podría dar de alta o modificar vehículos, y con la API de Traccar,
 * enviar comandos al equipo. Un monitor de solo lectura es una decisión, no una
 * carencia; el alta se hace donde ya existe control de acceso por usuario.
 */
const TRACCAR_ADMIN_URL = 'https://demo.traccar.org'

export default function Monitor() {
  const { data, isPending, isError, error, isFetching, dataUpdatedAt } = useFleet()
  const [pickedId, setPickedId] = useState<number>()

  const vehicles = data?.vehicles ?? []
  // El seleccionado se deriva en vez de sincronizarse con un efecto: si el
  // vehículo elegido desaparece de la flota, la interfaz cae sola al primero
  // en lugar de quedarse apuntando a un id que ya no existe.
  const selected =
    vehicles.find((vehicle) => vehicle.id === pickedId) ?? vehicles.at(0)

  const handleSelect = useCallback((id: number) => setPickedId(id), [])

  const { data: routePositions } = useRoute(selected?.id)
  const route = routePositions?.map(
    (position): [number, number] => [position.latitude, position.longitude],
  )

  return (
    <div className="flex h-dvh flex-col bg-surface">
      <header className="flex items-center justify-between gap-4 border-b border-border-subtle px-6 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-title text-text-primary">Monitor de flota</h1>
          <p className="text-label uppercase text-text-tertiary">Tiempo real</p>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={TRACCAR_ADMIN_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-control text-data-sm text-text-secondary underline underline-offset-4 hover:text-text-primary"
          >
            Administrar vehículos ↗
          </a>
          <ThemeToggle />
        </div>
      </header>

      {isError ? (
        <p
          role="alert"
          className="border-b border-status-critical/30 bg-status-critical/10 px-6 py-3 text-data-sm text-status-critical"
        >
          No se pudo leer la flota. Se muestra la última lectura conocida.{' '}
          <span className="text-text-tertiary">{error.message}</span>
        </p>
      ) : null}

      {/* 60/40: el mapa domina porque responde "dónde", que es la pregunta que
          trae al operador. El panel se lleva el 40% porque responde "cómo
          está", que es la que lo retiene. Debajo de lg el mapa pasa arriba y
          el panel abajo, sin achicar ninguno a un tamaño inútil. */}
      <main className="grid min-h-0 flex-1 grid-rows-[minmax(16rem,45vh)_1fr] lg:grid-cols-[3fr_2fr] lg:grid-rows-1">
        <VehicleMap
          vehicles={vehicles}
          selectedId={selected?.id}
          onSelect={handleSelect}
          route={route}
        />

        <div className="flex min-h-0 flex-col overflow-y-auto border-t border-border-subtle lg:border-l lg:border-t-0">
          {vehicles.length > 1 ? (
            <VehicleList
              vehicles={vehicles}
              selectedId={selected?.id}
              onSelect={handleSelect}
            />
          ) : null}

          {!isPending && vehicles.length === 0 ? (
            <p className="p-6 text-data-md text-text-secondary">
              La cuenta no tiene vehículos registrados.
            </p>
          ) : (
            <VehiclePanel
              vehicle={selected}
              loading={isPending}
              routePoints={route?.length}
              routeWindowHours={ROUTE_WINDOW_HOURS}
            />
          )}

          <footer className="mt-auto flex items-center gap-2 border-t border-border-subtle px-6 py-3 text-data-sm text-text-tertiary">
            <span
              aria-hidden="true"
              className={
                isFetching
                  ? 'size-1.5 rounded-full bg-status-online'
                  : 'size-1.5 rounded-full bg-text-quaternary'
              }
            />
            {dataUpdatedAt ? (
              <span className="tabular">Última lectura {formatTime(dataUpdatedAt)}</span>
            ) : (
              <span>Conectando…</span>
            )}
          </footer>
        </div>
      </main>
    </div>
  )
}

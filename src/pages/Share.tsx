import { useState } from 'react'
import { VehicleMap } from '@/components/map/VehicleMap'
import { VehiclePanel } from '@/components/panel/VehiclePanel'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useFleet } from '@/hooks/use-fleet'
import { useRoute } from '@/hooks/use-route'
import { ROUTE_WINDOW_HOURS } from '@/lib/traccar'

interface ShareProps {
  vehicleId: number
}

/**
 * Vista de "Live Share": un vehículo, sin el resto de la flota.
 *
 * Reusa el mismo `useFleet` de solo lectura que el monitor —no hay un
 * segundo backend ni un token que validar— y filtra al vehículo pedido. Si
 * el link se comparte con alguien fuera de la cuenta, lo único que ve es la
 * posición de ESE vehículo, nunca la lista completa de la flota.
 */
export default function Share({ vehicleId }: ShareProps) {
  const { data, isPending } = useFleet()
  const vehicle = data?.vehicles.find((candidate) => candidate.id === vehicleId)
  const { data: routePositions } = useRoute(vehicle?.id)
  const route = routePositions?.map((position): [number, number] => [
    position.latitude,
    position.longitude,
  ])
  const [isFollowing, setIsFollowing] = useState(true)

  return (
    <div className="flex h-dvh flex-col bg-surface">
      <header className="flex items-center justify-between gap-4 border-b border-border-subtle px-6 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-title text-text-primary">
            {vehicle?.name ?? 'Seguimiento compartido'}
          </h1>
          <p className="text-label uppercase text-text-tertiary">Solo lectura</p>
        </div>
        <ThemeToggle />
      </header>

      {!isPending && !vehicle ? (
        <p className="p-6 text-data-md text-text-secondary">
          Este link ya no corresponde a ningún vehículo de la flota.
        </p>
      ) : (
        <main className="grid min-h-0 flex-1 grid-rows-[minmax(16rem,55vh)_1fr] lg:grid-cols-[3fr_2fr] lg:grid-rows-1">
          <div className="relative min-h-0">
            <VehicleMap
              vehicles={vehicle ? [vehicle] : []}
              selectedId={vehicle?.id}
              onSelect={() => {}}
              route={route}
              isFollowing={isFollowing}
              onFollowingChange={setIsFollowing}
              baseLayer="auto"
              weatherEnabled={false}
            />
          </div>
          <div className="min-h-0 overflow-y-auto border-t border-border-subtle lg:border-l lg:border-t-0">
            <VehiclePanel
              vehicle={vehicle}
              loading={isPending}
              routePoints={route?.length}
              routeWindowHours={ROUTE_WINDOW_HOURS}
            />
          </div>
        </main>
      )}
    </div>
  )
}

import { useCallback, useMemo, useState } from 'react'
import { FollowToggle } from '@/components/map/FollowToggle'
import { MapLayers, type BaseLayer } from '@/components/map/MapLayers'
import { RoutePlayback } from '@/components/map/RoutePlayback'
import { VehicleMap } from '@/components/map/VehicleMap'
import { FleetPanel } from '@/components/panel/FleetPanel'
import { VehiclePanel } from '@/components/panel/VehiclePanel'
import { ErrorBanner, ErrorState } from '@/components/ui/ErrorState'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useFleet } from '@/hooks/use-fleet'
import { useGeofences } from '@/hooks/use-geofences'
import { useRoute } from '@/hooks/use-route'
import { formatTime } from '@/lib/format'
import { haversineMeters } from '@/lib/geo'
import { isWithinAnyGeofence } from '@/lib/geofence'
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
  const { data, isPending, isError, error, isFetching, dataUpdatedAt, refetch } = useFleet()
  const [pickedId, setPickedId] = useState<number>()
  // Arranca encendido: el enunciado pide que el mapa siga al vehículo, y esa
  // es la expectativa por defecto de un monitor. Apagarlo es la excepción.
  const [isFollowing, setIsFollowing] = useState(true)
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('auto')
  const [weatherEnabled, setWeatherEnabled] = useState(false)
  // `null` = en vivo. Un índice fija el marcador fantasma en un punto del
  // recorrido histórico sin tocar la posición real que sigue llegando.
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null)

  const vehicles = data?.vehicles ?? []
  // `data` sobrevive al error gracias a `keepPreviousData`: haber fallado ahora
  // no es lo mismo que no tener nada que mostrar.
  const hasData = data !== undefined
  // El seleccionado se deriva en vez de sincronizarse con un efecto: si el
  // vehículo elegido desaparece de la flota, la interfaz cae sola al primero
  // en lugar de quedarse apuntando a un id que ya no existe.
  const selected =
    vehicles.find((vehicle) => vehicle.id === pickedId) ?? vehicles.at(0)

  // Elegir un vehículo es pedir que el mapa lo lleve: el seguimiento se
  // reactiva aunque el operador lo hubiera apagado mirando otra zona, y la
  // reproducción de un vehículo anterior no tiene sentido sobre el nuevo.
  const handleSelect = useCallback((id: number) => {
    setPickedId(id)
    setIsFollowing(true)
    setPlaybackIndex(null)
  }, [])

  const { data: routePositions } = useRoute(selected?.id)
  const route = routePositions?.map(
    (position): [number, number] => [position.latitude, position.longitude],
  )
  const { data: geofences } = useGeofences()

  // Nombre del geofence más cercano cuando el vehículo seleccionado está
  // fuera de todos — "fuera de zona" a secas no le dice al operador de cuál.
  const outsideGeofenceName = useMemo(() => {
    const position = selected?.position
    if (!position || !geofences || geofences.length === 0) return undefined
    if (isWithinAnyGeofence(position.latitude, position.longitude, geofences)) return undefined

    const nearest = geofences.reduce((closest, geofence) => {
      const distance = haversineMeters(
        position.latitude,
        position.longitude,
        geofence.center[0],
        geofence.center[1],
      )
      return distance < closest.distance ? { geofence, distance } : closest
    }, { geofence: geofences[0], distance: Number.POSITIVE_INFINITY })

    return nearest.geofence.name
  }, [selected?.position, geofences])

  const previewPosition =
    playbackIndex !== null && routePositions?.[playbackIndex]
      ? {
          latitude: routePositions[playbackIndex].latitude,
          longitude: routePositions[playbackIndex].longitude,
        }
      : undefined

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

      {/* Dos tratamientos para el mismo fallo, según haya o no algo que
          mostrar. El arranque fallido se lleva la pantalla; la caída
          intermitente, apenas una franja: tapar la última posición conocida
          con un modal le quita al operador la única información que le queda
          justo cuando el sistema falla. */}
      {isError && !hasData ? (
        <ErrorState
          detail={error.message}
          onRetry={() => void refetch()}
          isRetrying={isFetching}
        />
      ) : (
        <>
          {isError ? (
            <ErrorBanner onRetry={() => void refetch()} isRetrying={isFetching} />
          ) : null}

      {/* 60/40: el mapa domina porque responde "dónde", que es la pregunta que
          trae al operador. El panel se lleva el 40% porque responde "cómo
          está", que es la que lo retiene. Debajo de lg el mapa pasa arriba y
          el panel abajo, sin achicar ninguno a un tamaño inútil. */}
      <main className="grid min-h-0 flex-1 grid-rows-[minmax(16rem,45vh)_1fr] lg:grid-cols-[3fr_2fr] lg:grid-rows-1">
        <div className="relative min-h-0">
          <VehicleMap
            vehicles={vehicles}
            selectedId={selected?.id}
            onSelect={handleSelect}
            route={route}
            isFollowing={isFollowing}
            onFollowingChange={setIsFollowing}
            baseLayer={baseLayer}
            weatherEnabled={weatherEnabled}
            geofences={geofences}
            previewPosition={previewPosition}
          />
          {/* Sobre el mapa y no en la barra superior: el control pertenece a lo
              que modifica. Los controles de Leaflet viven en z-400, así que el
              toggle tiene que ir por encima para no quedar tapado. */}
          <div className="pointer-events-none absolute left-3 top-3 z-[500]">
            <FollowToggle
              isFollowing={isFollowing}
              onChange={setIsFollowing}
              vehicleName={selected?.name}
            />
          </div>

          {/* Capas y flota comparten esquina: dos controles del mismo tipo
              —"qué muestra el mapa"— en vez de repartirlos por las cuatro
              puntas sin motivo. La ventana de flota es flotante y no columna
              fija: ver toda la flota y ver el detalle de una son dos
              preguntas distintas, y la primera no necesita quedarse abierta
              una vez que el operador ya eligió a quién mirar. */}
          <div className="pointer-events-none absolute right-3 top-3 z-[500] flex items-start gap-2">
            <MapLayers
              baseLayer={baseLayer}
              onBaseLayerChange={setBaseLayer}
              weatherEnabled={weatherEnabled}
              onWeatherChange={setWeatherEnabled}
            />
            {vehicles.length > 0 ? (
              <FleetPanel vehicles={vehicles} selectedId={selected?.id} onSelect={handleSelect} />
            ) : null}
          </div>

          {/* Reproducción del recorrido: solo tiene sentido con el vehículo
              seleccionado y al menos dos posiciones — un solo punto no es
              nada que recorrer. */}
          {routePositions && routePositions.length > 1 ? (
            <div className="pointer-events-none absolute bottom-3 left-3 z-[500]">
              <RoutePlayback
                positions={routePositions}
                index={playbackIndex}
                onIndexChange={setPlaybackIndex}
              />
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col overflow-y-auto border-t border-border-subtle lg:border-l lg:border-t-0">
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
              outsideGeofenceName={outsideGeofenceName}
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
        </>
      )}
    </div>
  )
}

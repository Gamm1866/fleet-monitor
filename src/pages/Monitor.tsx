import { useCallback, useMemo, useState } from 'react'
import { FollowToggle } from '@/components/map/FollowToggle'
import { MapLayers, type BaseLayer } from '@/components/map/MapLayers'
import { RoutePlayback } from '@/components/map/RoutePlayback'
import { VehicleMap } from '@/components/map/VehicleMap'
import { SidePanel } from '@/components/panel/SidePanel'
import { AlertToast } from '@/components/ui/AlertToast'
import { ErrorBanner, ErrorState } from '@/components/ui/ErrorState'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useFleet } from '@/hooks/use-fleet'
import { useGeofences } from '@/hooks/use-geofences'
import { useRoute } from '@/hooks/use-route'
import { useStatusAlerts } from '@/hooks/use-status-alerts'
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
  // vehículo elegido desaparece de la flota, la interfaz cae sola a "ninguno"
  // en lugar de quedarse apuntando a un id que ya no existe. Sin elegir
  // ninguno todavía, a propósito: la primera pantalla es la flota completa
  // —lista y mapa encuadrado a todos— no el detalle de un vehículo al azar.
  const selected = vehicles.find((vehicle) => vehicle.id === pickedId)

  // Elegir un vehículo es pedir que el mapa lo lleve: el seguimiento se
  // reactiva aunque el operador lo hubiera apagado mirando otra zona, y la
  // reproducción de un vehículo anterior no tiene sentido sobre el nuevo.
  const handleSelect = useCallback((id: number) => {
    setPickedId(id)
    setIsFollowing(true)
    setPlaybackIndex(null)
  }, [])

  // Volver a la lista es deseleccionar: la selección ya es la fuente de
  // verdad de qué muestra el mapa y el panel, no hace falta un estado aparte.
  const handleDeselect = useCallback(() => {
    setPickedId(undefined)
    setPlaybackIndex(null)
  }, [])

  const { data: routePositions } = useRoute(selected?.id)
  const route = routePositions?.map(
    (position): [number, number] => [position.latitude, position.longitude],
  )
  const { data: geofences } = useGeofences()
  const { alerts, dismiss } = useStatusAlerts(vehicles)

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
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border-subtle px-4 py-3 sm:px-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-title text-text-primary">Monitor de flota</h1>
          {/* En una pantalla angosta el header ya se lee de arriba a abajo
              como "tablero en vivo"; repetirlo en texto es ruido, no
              información — el label queda para pantallas con lugar de sobra. */}
          <p className="hidden text-label uppercase text-text-tertiary sm:block">Tiempo real</p>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <a
            href={TRACCAR_ADMIN_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-control text-data-sm text-text-secondary underline underline-offset-4 hover:text-text-primary"
          >
            {/* La flecha sola en mobile, la frase completa donde entra. */}
            <span className="hidden sm:inline">Administrar vehículos</span>
            <span aria-hidden="true" className="sm:hidden">
              Administrar
            </span>{' '}
            ↗
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

          {/* El mapa ocupa toda la pantalla: la flota es un solo panel
              flotante encima, no una columna que le quita ancho. Es la vista
              "general" por defecto —mapa encuadrado a toda la flota— y ese
              mismo panel transiciona a detalle cuando se elige un vehículo. */}
          <main className="relative min-h-0 flex-1">
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

            {/* Avisos de transición, arriba al centro — ni compiten con los
                controles de las esquinas ni tapan el vehículo que los generó. */}
            {alerts.length > 0 ? (
              <div className="pointer-events-none absolute left-1/2 top-3 z-[600] flex -translate-x-1/2 flex-col items-center gap-2">
                {alerts.map((alert) => (
                  <AlertToast
                    key={alert.id}
                    alert={alert}
                    onDismiss={dismiss}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            ) : null}

            {!isPending && vehicles.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="pointer-events-auto rounded-control bg-surface-raised/95 px-4 py-3 text-data-md text-text-secondary shadow-raised ring-1 ring-border-default backdrop-blur-sm">
                  La cuenta no tiene vehículos registrados.
                </p>
              </div>
            ) : null}

            {/* Sobre el mapa y no en la barra superior: el control pertenece a
                lo que modifica. Los controles de Leaflet viven en z-400, así
                que el toggle tiene que ir por encima para no quedar tapado. */}
            <div className="pointer-events-none absolute left-3 top-3 z-[500] flex items-start gap-2">
              <FollowToggle
                isFollowing={isFollowing}
                onChange={setIsFollowing}
                vehicleName={selected?.name}
              />
              <MapLayers
                baseLayer={baseLayer}
                onBaseLayerChange={setBaseLayer}
                weatherEnabled={weatherEnabled}
                onWeatherChange={setWeatherEnabled}
              />
            </div>

            {/* Un solo panel: lista de flota o detalle del vehículo elegido,
                nunca los dos a la vez. */}
            {vehicles.length > 0 || isPending ? (
              <SidePanel
                vehicles={vehicles}
                selected={selected}
                onSelect={handleSelect}
                onDeselect={handleDeselect}
                loading={isPending}
                routePoints={route?.length}
                routeWindowHours={ROUTE_WINDOW_HOURS}
                outsideGeofenceName={outsideGeofenceName}
              />
            ) : null}

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
          </main>

          <footer className="flex items-center gap-2 border-t border-border-subtle px-6 py-3 text-data-sm text-text-tertiary">
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
        </>
      )}
    </div>
  )
}

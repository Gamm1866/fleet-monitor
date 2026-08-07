import { useState } from 'react'
import { ChevronDown, Share07, XClose } from '@untitledui/icons'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { DataRow } from '@/components/ui/DataRow'
import { StatusPill } from '@/components/ui/StatusPill'
import { cx } from '@/utils/cx'
import { formatCourse, formatDecimal, formatSilence } from '@/lib/format'
import { STATUS_META } from '@/lib/status'
import type { Vehicle } from '@/lib/traccar'

interface VehiclePanelProps {
  vehicle?: Vehicle
  loading: boolean
  /** Puntos del recorrido dibujado en el mapa. */
  routePoints?: number
  routeWindowHours: number
  /** Nombre del geofence más cercano si el vehículo está fuera de todos. */
  outsideGeofenceName?: string
  /** Controles de la ventana flotante, cuando el panel vive sobre el mapa en
   * vez de en una columna fija. `undefined` los oculta — así el mismo
   * componente sirve para el monitor (flotante) y para Live Share (fijo). */
  onMinimize?: () => void
  onClose?: () => void
}

const WINDOW_CONTROL =
  'flex size-6 items-center justify-center rounded text-text-tertiary transition-colors duration-fast hover:bg-bg-active hover:text-text-primary'

/**
 * Copia un link de solo lectura a este vehículo.
 *
 * Sin token ni backend nuevo: toda la app ya es de solo lectura y sin login
 * —el alta y el control de acceso viven en Traccar, como documenta el
 * README— así que "compartir" es simplemente abrir el mismo monitor filtrado
 * a un vehículo, vía un parámetro en la URL.
 */
function ShareButton({ vehicleId }: { vehicleId: number }) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = `${window.location.origin}/?share=${vehicleId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      className="flex items-center gap-1.5 rounded-control px-2.5 py-1 text-data-sm text-text-secondary transition-colors duration-fast hover:bg-bg-active hover:text-text-primary"
    >
      <Share07 aria-hidden="true" className="size-3.5" />
      {copied ? 'Link copiado' : 'Compartir'}
      <span aria-live="polite" className="sr-only">
        {copied ? 'Link de solo lectura copiado al portapapeles' : ''}
      </span>
    </button>
  )
}

/**
 * Todo lo que el mapa dibuja, escrito.
 *
 * El panel no es un resumen del mapa: es la fuente autorizada. Un operador que
 * navega con teclado o lector de pantalla obtiene acá la misma información,
 * completa, sin tener que interpretar píxeles.
 */
export function VehiclePanel({
  vehicle,
  loading,
  routePoints,
  routeWindowHours,
  outsideGeofenceName,
  onMinimize,
  onClose,
}: VehiclePanelProps) {
  const position = vehicle?.position
  // Con el dispositivo en silencio, todo lo que sigue en pantalla es un
  // recuerdo. La interfaz tiene que decirlo: mostrar "27,8 km/h" al lado de
  // "sin contacto" es afirmar dos cosas incompatibles y el operador le va a
  // creer a la que está en números grandes.
  const isSilent = vehicle?.status === 'stale' || vehicle?.status === 'lost'

  return (
    <section
      className="flex flex-col gap-6 p-6"
      aria-labelledby="vehicle-name"
      aria-busy={loading}
    >
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-label uppercase text-text-tertiary">Vehículo seleccionado</p>
          <div className="flex items-center gap-1">
            {vehicle ? <ShareButton vehicleId={vehicle.id} /> : null}
            {onMinimize ? (
              <button
                type="button"
                onClick={onMinimize}
                aria-label="Minimizar el detalle del vehículo"
                className={WINDOW_CONTROL}
              >
                <ChevronDown aria-hidden="true" className="size-4" />
              </button>
            ) : null}
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar el detalle del vehículo"
                className={WINDOW_CONTROL}
              >
                <XClose aria-hidden="true" className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
        <h2 id="vehicle-name" className="text-title text-text-primary">
          {vehicle?.name ?? 'Ningún vehículo seleccionado'}
        </h2>
        {!vehicle && !loading ? (
          <p className="text-data-sm text-text-secondary">
            Elegí un camión de la lista para ver su detalle.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {vehicle ? <StatusPill status={vehicle.status} /> : null}
          {outsideGeofenceName ? (
            <span
              className={cx(
                'rounded-control bg-status-stale/15 px-2 py-0.5 text-data-sm text-status-stale',
              )}
            >
              Fuera de {outsideGeofenceName}
            </span>
          ) : null}
        </div>
        {isSilent && vehicle ? (
          <p className="text-data-sm text-text-tertiary">
            Los datos de abajo son de la última transmisión,{' '}
            {formatSilence(vehicle.silenceMinutes)}.
          </p>
        ) : null}
      </header>

      {/* El cambio de estado es la única información que interrumpe. La
          velocidad cambia cada ocho segundos: anunciarla sería inutilizar el
          lector de pantalla. */}
      <p className="sr-only" aria-live="polite">
        {vehicle ? STATUS_META[vehicle.status].announcement : ''}
      </p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
        <DataRow
          label={isSilent ? 'Última velocidad' : 'Velocidad'}
          placeholder="000,0 km/h"
          loading={loading}
          value={
            vehicle && position ? (
              <>
                <AnimatedValue value={formatDecimal(vehicle.speedKmh)} />
                <span className="text-text-tertiary"> km/h</span>
              </>
            ) : undefined
          }
        />
        <DataRow
          label={isSilent ? 'Último rumbo' : 'Rumbo'}
          placeholder="000° NE"
          loading={loading}
          value={position ? formatCourse(position.course) : undefined}
        />
        <DataRow
          label="Último contacto"
          placeholder="hace 00 minutos"
          loading={loading}
          value={vehicle ? formatSilence(vehicle.silenceMinutes) : undefined}
        />
        <DataRow
          label="Batería"
          placeholder="000 %"
          loading={loading}
          value={
            vehicle?.batteryLevel === undefined ? undefined : (
              <>
                <AnimatedValue value={Math.round(vehicle.batteryLevel)} />
                <span className="text-text-tertiary"> %</span>
              </>
            )
          }
        />
        <DataRow
          label="Latitud"
          placeholder="-00,000000"
          loading={loading}
          value={position?.latitude.toFixed(6).replace('.', ',')}
        />
        <DataRow
          label="Longitud"
          placeholder="-00,000000"
          loading={loading}
          value={position?.longitude.toFixed(6).replace('.', ',')}
        />
        {/* El trazo del mapa, dicho con palabras. Un recorrido que solo existe
            como línea de colores es información que el operador con lector de
            pantalla no tiene. */}
        <DataRow
          className="col-span-2"
          label={`Recorrido de las últimas ${routeWindowHours} horas`}
          placeholder="000 posiciones registradas"
          loading={loading}
          value={
            routePoints === undefined
              ? undefined
              : routePoints < 2
                ? 'Sin recorrido en la ventana: una sola posición registrada'
                : `${routePoints} posiciones registradas`
          }
        />
        <DataRow
          className="col-span-2"
          label="Identificador"
          placeholder="demo0000-monitor-0000"
          loading={loading}
          value={vehicle?.uniqueId}
        />
      </dl>
    </section>
  )
}

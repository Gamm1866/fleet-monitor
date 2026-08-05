import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { DataRow } from '@/components/ui/DataRow'
import { StatusPill } from '@/components/ui/StatusPill'
import { formatCourse, formatDecimal, formatSilence } from '@/lib/format'
import { STATUS_META } from '@/lib/status'
import type { Vehicle } from '@/lib/traccar'

interface VehiclePanelProps {
  vehicle?: Vehicle
  loading: boolean
  /** Puntos del recorrido dibujado en el mapa. */
  routePoints?: number
  routeWindowHours: number
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
        <p className="text-label uppercase text-text-tertiary">Vehículo seleccionado</p>
        <h2 id="vehicle-name" className="text-title text-text-primary">
          {vehicle?.name ?? 'Sin vehículo'}
        </h2>
        {vehicle ? <StatusPill status={vehicle.status} className="self-start" /> : null}
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
            vehicle?.batteryLevel === undefined
              ? undefined
              : `${Math.round(vehicle.batteryLevel)} %`
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

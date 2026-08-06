import { RefreshCw02 } from '@untitledui/icons'
import { Button } from '@/components/base/buttons/button'

interface ErrorStateProps {
  /** Mensaje técnico del fallo. Se muestra, pero en segundo plano. */
  detail?: string
  onRetry: () => void
  isRetrying: boolean
}

/**
 * Pantalla de error para el arranque fallido.
 *
 * Solo aparece cuando no hay ningún dato que mostrar. Si la app ya tenía una
 * lectura, el error se avisa sin tapar nada (ver `ErrorBanner`): esconder la
 * última posición conocida detrás de un modal le quita al operador la única
 * información que le queda justo cuando el sistema falla.
 *
 * El micro-copy nombra lo que pasó y lo que NO se sabe, sin culpar al usuario
 * ni fingir tranquilidad. En una sala de control, "algo salió mal" no es
 * empatía: es una respuesta que obliga a adivinar.
 */
export function ErrorState({ detail, onRetry, isRetrying }: ErrorStateProps) {
  return (
    <section
      role="alert"
      aria-live="assertive"
      className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center"
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-status-critical/12 text-status-critical ring-1 ring-status-critical/25"
      >
        <RefreshCw02 className="size-5" />
      </span>

      <div className="flex max-w-sm flex-col gap-2">
        <h2 className="text-title text-text-primary">Sin conexión con Traccar</h2>
        <p className="text-data-md text-text-secondary">
          No pudimos obtener la flota. La posición de los vehículos que ves en pantalla
          puede haber cambiado: por ahora, el sistema no lo sabe.
        </p>
      </div>

      <Button size="md" color="primary" onClick={onRetry} isLoading={isRetrying}>
        Reintentar
      </Button>

      {detail ? (
        // El detalle técnico se muestra pero no manda: sirve a quien depura,
        // no al operador. Por eso va al final, chico y en tono terciario.
        <p className="max-w-sm text-data-sm text-text-tertiary">{detail}</p>
      ) : null}
    </section>
  )
}

interface ErrorBannerProps {
  onRetry: () => void
  isRetrying: boolean
}

/**
 * Aviso para el fallo intermitente: hay datos en pantalla, pero envejecieron.
 *
 * No bloquea ni interrumpe. La app sigue reintentando sola con cada sondeo; el
 * botón existe para quien no quiere esperar los ocho segundos.
 */
export function ErrorBanner({ onRetry, isRetrying }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-status-critical/25 bg-status-critical/10 px-6 py-2.5"
    >
      <p className="text-data-sm text-status-critical">
        Se perdió la conexión con Traccar. Lo que ves es la última lectura conocida.
      </p>
      <Button size="sm" color="secondary" onClick={onRetry} isLoading={isRetrying}>
        Reintentar
      </Button>
    </div>
  )
}

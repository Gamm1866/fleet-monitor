import { AlertTriangle, XClose } from '@untitledui/icons'
import type { StatusAlert } from '@/hooks/use-status-alerts'

interface AlertToastProps {
  alert: StatusAlert
  onDismiss: (id: string) => void
  onSelect: (vehicleId: number) => void
}

/**
 * Aviso de una transición real, no un estado permanente en pantalla.
 *
 * `role="status"` + `aria-live="polite"`: se anuncia solo una vez, al
 * aparecer — no es una alarma que interrumpa, es información que el
 * operador puede seguir leyendo o descartar cuando quiera.
 */
export function AlertToast({ alert, onDismiss, onSelect }: AlertToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex animate-panel-in items-center gap-3 rounded-control bg-surface-raised px-4 py-3 shadow-raised ring-1 ring-status-stale/40"
    >
      <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-status-stale" />
      <button
        type="button"
        onClick={() => onSelect(alert.vehicleId)}
        className="text-data-sm text-text-primary underline-offset-2 hover:underline"
      >
        {alert.message}
      </button>
      <button
        type="button"
        onClick={() => onDismiss(alert.id)}
        aria-label="Descartar aviso"
        className="flex size-5 shrink-0 items-center justify-center rounded text-text-tertiary transition-colors duration-fast hover:bg-bg-active hover:text-text-primary"
      >
        <XClose aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  )
}

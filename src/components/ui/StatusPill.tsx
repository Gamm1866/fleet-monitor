import { cx } from '@/utils/cx'
import { STATUS_META, type VehicleStatus } from '@/lib/status'

interface StatusPillProps {
  status: VehicleStatus
  className?: string
}

// El color de estado se resuelve con clases completas y no interpolando el
// token: Tailwind escanea el código fuente como texto y una clase construida
// con template string nunca llega al CSS final.
const TONE: Record<VehicleStatus, { dot: string; text: string; ring: string }> = {
  moving: {
    dot: 'bg-status-online',
    text: 'text-status-online',
    ring: 'ring-status-online/30',
  },
  stopped: {
    dot: 'bg-status-offline',
    text: 'text-status-offline',
    ring: 'ring-status-offline/30',
  },
  stale: {
    dot: 'bg-status-stale',
    text: 'text-status-stale',
    ring: 'ring-status-stale/30',
  },
  lost: {
    dot: 'bg-status-critical',
    text: 'text-status-critical',
    ring: 'ring-status-critical/30',
  },
}

export function StatusPill({ status, className }: StatusPillProps) {
  const meta = STATUS_META[status]
  const tone = TONE[status]
  const isPulsing = status === 'moving'

  return (
    <span
      // `key` fuerza el remontaje al cambiar de estado y el realce vuelve a
      // correr desde cero. Un cambio de estado es la actualización más
      // importante de la tarjeta: si la velocidad se realza y esto no, la
      // jerarquía de la atención queda invertida.
      key={status}
      className={cx(
        'inline-flex animate-value-in items-center gap-2 rounded-chip px-2 py-1',
        'text-label font-medium uppercase ring-1 ring-inset',
        tone.text,
        tone.ring,
        className,
      )}
    >
      {/* El punto se marca decorativo porque el texto de al lado ya dice lo
          mismo. Anunciarlo duplicaría el estado en el lector de pantalla. */}
      <span aria-hidden="true" className="relative grid size-2 place-items-center">
        {isPulsing && (
          // El pulso es la CAPA de refuerzo, nunca el portador del estado:
          // con movimiento reducido desaparece y la información sigue completa
          // gracias al color, la forma y el texto.
          <span
            className={cx(
              'absolute inset-0 animate-status-pulse rounded-full motion-reduce:hidden',
              tone.dot,
            )}
          />
        )}
        <span className={cx('size-2 rounded-full', tone.dot)} />
      </span>
      {meta.label}
    </span>
  )
}

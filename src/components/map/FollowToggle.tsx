import { NavigationPointer01, NavigationPointerOff01 } from '@untitledui/icons'
import { cx } from '@/utils/cx'

interface FollowToggleProps {
  isFollowing: boolean
  onChange: (isFollowing: boolean) => void
  /** Nombre del vehículo seguido, para que la etiqueta accesible diga a quién. */
  vehicleName?: string
}

/**
 * Interruptor de seguimiento del mapa.
 *
 * Existe porque el comportamiento correcto depende de qué está haciendo el
 * operador, y eso el sistema no lo puede adivinar: mientras vigila un vehículo
 * quiere que el mapa lo persiga; mientras revisa una zona quiere que se quede
 * quieto. En vez de elegir por él, la regla se vuelve visible y reversible.
 *
 * `aria-pressed` en vez de un checkbox: es un botón que conmuta un estado del
 * mapa, no un campo de formulario.
 */
export function FollowToggle({ isFollowing, onChange, vehicleName }: FollowToggleProps) {
  // El icono cambia de forma, no solo de color: el estado tiene que leerse sin
  // depender de distinguir dos tonos del mismo azul.
  const Icon = isFollowing ? NavigationPointer01 : NavigationPointerOff01

  return (
    <button
      type="button"
      aria-pressed={isFollowing}
      onClick={() => onChange(!isFollowing)}
      className={cx(
        'pointer-events-auto flex items-center gap-2 rounded-control px-3 py-2 text-data-sm shadow-raised backdrop-blur-sm transition-all duration-fast active:scale-95',
        isFollowing
          ? 'bg-surface-raised text-text-primary ring-1 ring-border-default'
          : 'bg-surface-raised/85 text-text-tertiary ring-1 ring-border-subtle hover:text-text-secondary',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cx('size-4', isFollowing ? 'text-accent' : 'text-text-quaternary')}
      />
      Seguir
      <span className="sr-only">
        {vehicleName ? ` a ${vehicleName}` : ' al vehículo'} con el mapa.{' '}
        {isFollowing
          ? 'Activado: el mapa se recentra con cada posición nueva.'
          : 'Desactivado: el mapa se queda donde lo dejaste.'}
      </span>
    </button>
  )
}

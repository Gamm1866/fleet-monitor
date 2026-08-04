import { cx } from '@/utils/cx'

interface AnimatedValueProps {
  /** Valor a mostrar. Cambiarlo dispara el realce. */
  value: string | number
  className?: string
}

/**
 * Aplica un realce breve cuando el valor cambia.
 *
 * La animación se dispara con `key`: React desmonta y remonta el nodo cuando el
 * valor cambia, y el navegador vuelve a correr la animación CSS desde cero. Sin
 * efectos, sin temporizadores que limpiar, sin estado duplicado.
 *
 * La duración sale de `--duration-fast`, que con `prefers-reduced-motion` vale
 * 1ms. El realce no se apaga con un condicional en JavaScript: deja de existir
 * desde el token.
 */
export function AnimatedValue({ value, className }: AnimatedValueProps) {
  return (
    <span key={String(value)} className={cx('animate-value-in tabular', className)}>
      {value}
    </span>
  )
}

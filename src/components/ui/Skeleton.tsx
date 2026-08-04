import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

interface SkeletonProps {
  /**
   * Texto de referencia que define el tamaño del bloque. No se ve, pero ocupa
   * espacio.
   */
  children: ReactNode
  className?: string
}

/**
 * Bloque de carga con CLS 0.
 *
 * En vez de una tabla de anchos en píxeles —que se desincroniza en cuanto
 * cambia la tipografía o el tamaño de fuente del sistema— el skeleton se
 * dimensiona con texto real invisible. El navegador mide los glifos con la
 * misma fuente, el mismo tamaño y el mismo interlineado que el contenido
 * definitivo, así que la caja es idéntica por construcción, no por coincidencia.
 *
 * Con `tabular` (Geist Mono + tabular-nums) además el ancho es exacto: "00,0"
 * mide lo mismo que "84,2".
 */
export function Skeleton({ children, className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-block animate-pulse rounded-chip bg-text-tertiary/20',
        className,
      )}
    >
      <span className="invisible">{children}</span>
    </span>
  )
}

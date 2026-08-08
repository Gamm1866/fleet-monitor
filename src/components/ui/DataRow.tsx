import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { Skeleton } from './Skeleton'

interface DataRowProps {
  label: string
  /**
   * `undefined` significa que el dato no está disponible: el dispositivo no lo
   * reporta. No es lo mismo que un cero ni que un error.
   */
  value?: ReactNode
  loading?: boolean
  /** Texto de referencia para dimensionar el skeleton y el guion de vacío. */
  placeholder: string
  className?: string
}

/**
 * Par etiqueta/valor. Pensado para vivir dentro de un <dl>.
 *
 * `<dt>`/`<dd>` en vez de dos <div>: un lector de pantalla anuncia la relación
 * entre el rótulo y el dato en lugar de leer ocho textos sueltos sin vínculo,
 * que es lo que pasa cuando una lista de definiciones se maqueta con divs.
 */
export function DataRow({
  label,
  value,
  loading = false,
  placeholder,
  className,
}: DataRowProps) {
  const isUnavailable = !loading && value === undefined

  return (
    <div
      className={cx(
        // Tarjeta blanca sobre el fondo FAFAFA del panel, mismo lenguaje que
        // las filas de la lista de flota: cada dato es su propio bloque, no
        // texto suelto flotando sobre el panel.
        'flex flex-col gap-1 rounded-control bg-surface px-3 py-2.5 shadow-[0_1px_2px_rgb(15_21_32_/_0.05)]',
        className,
      )}
    >
      <dt className="text-label font-medium uppercase text-text-tertiary">{label}</dt>
      {/* `tabular` va acá y no en cada valor: en este producto TODO lo que va
          en un <dd> es un dato que se actualiza solo. Dejarlo opcional por
          componente garantiza que alguno se olvide y su valor tiemble de ancho
          en cada poll. */}
      <dd
        className={cx(
          'text-data-md tabular',
          isUnavailable ? 'text-text-tertiary' : 'text-text-primary',
        )}
      >
        {loading ? (
          <Skeleton className="tabular">{placeholder}</Skeleton>
        ) : isUnavailable ? (
          <>
            {/* El guion largo comunica "acá no hay dato" a quien mira, pero
                para un lector de pantalla es basura tipográfica. El texto
                real solo existe para tecnología asistiva. */}
            <span aria-hidden="true" className="tabular">
              —
            </span>
            <span className="sr-only">Dato no disponible</span>
          </>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}

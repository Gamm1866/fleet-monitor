/**
 * Formato de números para la interfaz.
 *
 * `toFixed()` produce siempre formato inglés (73.3). En español el separador
 * decimal es la coma, y una interfaz de sala de control que muestra "73.3 km/h"
 * a un operador hispanohablante se lee como un error de la herramienta antes
 * que como una cifra.
 */
const LOCALE = 'es-AR'

const decimalFormatter = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function formatDecimal(value: number): string {
  return decimalFormatter.format(value)
}

/** Nudos a km/h. Traccar reporta la velocidad en nudos, siempre. */
const KNOTS_TO_KMH = 1.852

export function knotsToKmh(knots: number): number {
  return knots * KNOTS_TO_KMH
}

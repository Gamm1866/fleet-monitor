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

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']

/**
 * Rumbo en grados a punto cardinal.
 *
 * Se muestran los dos: "90° E". El grado solo es preciso pero no se lee de un
 * vistazo, y el cardinal solo se lee rápido pero pierde información. En un
 * tablero que se mira de reojo hacen falta los dos.
 */
export function formatCourse(degrees: number): string {
  const index = Math.round(degrees / 45) % CARDINALS.length
  return `${Math.round(degrees)}° ${CARDINALS[index]}`
}

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  // 24 horas, aunque el locale prefiera 12: "02:02:28 p. m." obliga a leer el
  // sufijo para saber si el dato es de hace un minuto o de hace doce horas.
  hour12: false,
})

export function formatTime(timestamp: number): string {
  return timeFormatter.format(timestamp)
}

/**
 * Antigüedad en palabras.
 *
 * Se redondea hacia abajo a propósito: decir "hace 2 minutos" cuando pasaron
 * 2:50 es preferible a decir "hace 3 minutos" cuando pasaron 2:10. En una sala
 * de control el número que acompaña a una alerta se lee como un hecho, y
 * exagerar el silencio del dispositivo cuesta confianza en la herramienta.
 */
export function formatSilence(minutes: number): string {
  if (!Number.isFinite(minutes)) return 'nunca reportó'
  if (minutes < 1) return 'hace menos de un minuto'

  const total = Math.floor(minutes)
  if (total < 60) return `hace ${total} ${total === 1 ? 'minuto' : 'minutos'}`

  const hours = Math.floor(total / 60)
  if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`

  const days = Math.floor(hours / 24)
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`
}

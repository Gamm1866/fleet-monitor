import type { VehicleStatus } from '@/lib/status'

// Se usan clases completas y no interpoladas: Tailwind lee el código como
// texto plano y una clase armada con template string nunca llega al CSS.
const MARKER_TONE: Record<VehicleStatus, string> = {
  moving: 'bg-status-online',
  stopped: 'bg-status-offline',
  stale: 'bg-status-stale',
  lost: 'bg-status-critical',
}

const MARKER_INK: Record<VehicleStatus, string> = {
  moving: 'text-status-online',
  stopped: 'text-status-offline',
  stale: 'text-status-stale',
  lost: 'text-status-critical',
}

/**
 * Figura del marcador para un vehículo que no se está moviendo.
 *
 *     detenido      ●   punto lleno      — el dato está completo
 *     sin reportar  ◎   anillo hueco     — el dato empezó a faltar
 *     sin contacto  ⊘   anillo cortado   — el dato no está
 *
 * El marcador se va vaciando a medida que el dispositivo se calla. Es una
 * progresión que se entiende sin leyenda y, sobre todo, no depende del color:
 * sobre un mapa no hay texto al lado del punto, así que distinguir tres
 * estados solo por el tono deja afuera a quien no los diferencia (WCAG 1.4.1)
 * y, en la práctica, también a quien mira de reojo una pantalla a dos metros.
 *
 * El contorno del color de la superficie despega la figura de la tesela, sea
 * clara u oscura.
 */
function idleMarkerSvg(status: VehicleStatus): string {
  const shape: Record<VehicleStatus, string> = {
    stopped: '<circle cx="9" cy="9" r="4.5" fill="currentColor"/>',
    stale:
      '<circle cx="9" cy="9" r="4.5" fill="var(--color-surface)" stroke="currentColor" stroke-width="2.5"/>',
    lost: '<circle cx="9" cy="9" r="4.5" fill="var(--color-surface)" stroke="currentColor" stroke-width="2.5" stroke-dasharray="4.7 3.4" stroke-linecap="round"/>',
    // El estado en movimiento no llega hasta acá: dibuja una flecha.
    moving: '',
  }

  return `<svg viewBox="0 0 18 18" class="size-[18px] ${MARKER_INK[status]}" aria-hidden="true">
    <circle cx="9" cy="9" r="6" fill="none" stroke="var(--color-surface)" stroke-width="2"/>
    ${shape[status]}
  </svg>`
}

interface MarkerOptions {
  status: VehicleStatus
  /** Rumbo en grados. Solo se dibuja si el vehículo está en movimiento. */
  course?: number
  isSelected?: boolean
}

/** Alto y ancho del marcador según el estado, en píxeles. */
export function markerSize({ status, course }: MarkerOptions): number {
  return status === 'moving' && course !== undefined ? 24 : 18
}

/**
 * Marcador del vehículo: flecha si va a algún lado, figura de estado si no.
 *
 * El rumbo solo se dibuja en movimiento — por debajo de 2 km/h el `course` que
 * reporta el GPS es ruido, y una flecha apuntando a un rumbo inventado es peor
 * que ninguna flecha: el operador la lee como un hecho.
 */
export function markerHtml({ status, course, isSelected = true }: MarkerOptions): string {
  const dimmed = isSelected ? '' : 'opacity-45'

  if (status !== 'moving' || course === undefined) {
    return `<span class="relative flex size-[18px] items-center justify-center ${dimmed}">
      ${idleMarkerSvg(status)}
    </span>`
  }

  // El halo solo late en el vehículo seleccionado. Animar todos a la vez
  // convierte el mapa en ruido y deja de señalar nada, que es justo lo
  // contrario de lo que debe hacer una alerta.
  const halo = isSelected
    ? `<span class="absolute inset-1.5 animate-status-pulse rounded-full ${MARKER_TONE[status]} opacity-50 motion-reduce:hidden"></span>`
    : ''

  return `<span class="relative flex size-6 items-center justify-center ${dimmed}">
    ${halo}
    <svg viewBox="0 0 24 24" class="relative size-6 ${MARKER_INK[status]}" style="transform: rotate(${Math.round(course)}deg)" aria-hidden="true">
      <path d="M12 3.2 18.4 20 12 16.3 5.6 20Z" fill="currentColor" stroke="var(--color-surface)" stroke-width="1.4" stroke-linejoin="round"/>
    </svg>
  </span>`
}

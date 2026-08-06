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
/** Sombra elíptica bajo el marcador: separa la figura de la tesela, sea del
 * color que sea, y es lo que le da la lectura "elevada" al estilo Uber. */
function shadowSvg(box: number, cx: number, cy: number, rx: number): string {
  return `<svg viewBox="0 0 ${box} ${box}" class="absolute inset-0" aria-hidden="true">
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx * 0.34}" fill="#000" opacity="0.28"/>
  </svg>`
}

function idleMarkerSvg(status: VehicleStatus): string {
  const shape: Record<VehicleStatus, string> = {
    stopped: '<circle cx="9" cy="9" r="4.5" fill="currentColor"/>',
    stale:
      '<circle cx="9" cy="9" r="4.5" fill="var(--color-surface)" stroke="currentColor" stroke-width="2.5"/>',
    lost: '<circle cx="9" cy="9" r="4.5" fill="var(--color-surface)" stroke="currentColor" stroke-width="2.5" stroke-dasharray="4.7 3.4" stroke-linecap="round"/>',
    // El estado en movimiento no llega hasta acá: dibuja un camión.
    moving: '',
  }

  return `<svg viewBox="0 0 18 18" class="relative size-[18px] ${MARKER_INK[status]}" aria-hidden="true">
    <circle cx="9" cy="9" r="6" fill="none" stroke="var(--color-surface)" stroke-width="2"/>
    ${shape[status]}
  </svg>`
}

/**
 * Camión visto desde arriba con un poco de perspectiva — cabina, caja y
 * parabrisas — al estilo del marcador de Uber: una figura reconocible sin
 * ser un modelo 3D real, que gira con el rumbo y se lee bien sobre cualquier
 * tesela por el contorno del color de superficie.
 */
function truckSvg(status: VehicleStatus, course: number): string {
  return `<svg viewBox="0 0 24 24" class="relative size-full ${MARKER_INK[status]}" style="transform: rotate(${Math.round(course)}deg)" aria-hidden="true">
    <rect x="6" y="7" width="12" height="11.5" rx="2.6" fill="currentColor" stroke="var(--color-surface)" stroke-width="1.3"/>
    <path d="M7.4 7 V2.9 Q7.4 1.3 9 1.3 H15 Q16.6 1.3 16.6 2.9 V7 Z" fill="currentColor" stroke="var(--color-surface)" stroke-width="1.3" stroke-linejoin="round"/>
    <rect x="8.9" y="2.5" width="6.2" height="3.6" rx="0.9" fill="var(--color-surface)" opacity="0.55"/>
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
  return status === 'moving' && course !== undefined ? 30 : 18
}

/**
 * Marcador del vehículo: camión si va a algún lado, figura de estado si no.
 *
 * El rumbo solo se dibuja en movimiento — por debajo de 2 km/h el `course` que
 * reporta el GPS es ruido, y un camión apuntando a un rumbo inventado es peor
 * que ninguna flecha: el operador la lee como un hecho.
 */
export function markerHtml({ status, course, isSelected = true }: MarkerOptions): string {
  const dimmed = isSelected ? '' : 'opacity-45'

  if (status !== 'moving' || course === undefined) {
    return `<span class="relative flex size-[18px] items-center justify-center ${dimmed}">
      ${shadowSvg(18, 9, 15.5, 5)}
      ${idleMarkerSvg(status)}
    </span>`
  }

  // El halo solo late en el vehículo seleccionado. Animar todos a la vez
  // convierte el mapa en ruido y deja de señalar nada, que es justo lo
  // contrario de lo que debe hacer una alerta.
  const halo = isSelected
    ? `<span class="absolute inset-1.5 animate-status-pulse rounded-full ${MARKER_TONE[status]} opacity-50 motion-reduce:hidden"></span>`
    : ''

  // La sombra no rota con el camión: en el piso, la luz no gira con el
  // vehículo. Solo la figura de arriba gira con `course`.
  return `<span class="relative flex size-[30px] items-center justify-center ${dimmed}">
    ${shadowSvg(24, 12, 20, 7.5)}
    ${halo}
    ${truckSvg(status, course)}
  </span>`
}

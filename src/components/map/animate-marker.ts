import type L from 'leaflet'

/**
 * Cuánto dura el deslizamiento del marcador hacia su nueva posición.
 *
 * Se eligió más corto que el intervalo de sondeo (8 s) a propósito: si la
 * animación durara lo mismo, el marcador estaría siempre en movimiento y nunca
 * mostraría una posición estable. El operador necesita ver dónde ESTÁ el
 * vehículo, no una animación perpetua.
 */
const SLIDE_DURATION_MS = 1200

/**
 * Distancia a partir de la cual no se interpola, se salta.
 *
 * Deslizar suavemente veinte kilómetros en un segundo dibuja un trayecto que
 * el vehículo no hizo: es una animación que miente. Un salto grande casi
 * siempre significa que el equipo estuvo sin reportar, y eso se lee mejor como
 * un salto —una discontinuidad real— que como un viaje imposible.
 */
const MAX_SLIDE_METERS = 2_000

/** Desaceleración: rápido al salir, suave al llegar. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/**
 * Desliza un marcador hasta su nueva posición.
 *
 * @returns una función para cancelar la animación en curso.
 */
export function animateMarkerTo(
  marker: L.Marker,
  to: L.LatLng,
  options: { reducedMotion: boolean },
): () => void {
  const from = marker.getLatLng()

  // Con `prefers-reduced-motion` el marcador aparece en su lugar. No es una
  // animación más rápida: es ninguna animación.
  if (options.reducedMotion || from.distanceTo(to) > MAX_SLIDE_METERS) {
    marker.setLatLng(to)
    return () => {}
  }

  const start = performance.now()
  let frame = requestAnimationFrame(function step(now: number) {
    const progress = Math.min((now - start) / SLIDE_DURATION_MS, 1)
    const eased = easeOutCubic(progress)

    marker.setLatLng([
      from.lat + (to.lat - from.lat) * eased,
      from.lng + (to.lng - from.lng) * eased,
    ])

    if (progress < 1) {
      frame = requestAnimationFrame(step)
    }
  })

  return () => cancelAnimationFrame(frame)
}

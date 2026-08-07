import { useEffect, useRef, useState } from 'react'
import { Play } from '@untitledui/icons'
import { formatTime } from '@/lib/format'
import type { TraccarPosition } from '@/lib/traccar'

interface RoutePlaybackProps {
  /** Recorrido del vehículo seleccionado, cronológico, con al menos 2 puntos. */
  positions: TraccarPosition[]
  /** `null` = en vivo (posición actual). Un número es un índice sobre `positions`. */
  index: number | null
  onIndexChange: (index: number | null) => void
}

const STEP_MS = 350

function PauseIcon() {
  return (
    <svg viewBox="0 0 14 14" className="size-3.5" aria-hidden="true">
      <rect x="3" y="2" width="3" height="10" rx="1" fill="currentColor" />
      <rect x="8" y="2" width="3" height="10" rx="1" fill="currentColor" />
    </svg>
  )
}

/**
 * Reproductor del recorrido reciente.
 *
 * El índice vive en el padre (Monitor) porque el mapa necesita conocerlo para
 * dibujar el marcador fantasma en la posición histórica. Este componente solo
 * decide CUÁNDO avanza —el `setInterval` de la reproducción— no dónde se
 * pinta nada.
 */
export function RoutePlayback({ positions, index, onIndexChange }: RoutePlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const indexRef = useRef(index)
  indexRef.current = index

  const lastIndex = positions.length - 1
  const activeIndex = index ?? lastIndex
  const isLive = index === null

  useEffect(() => {
    if (!isPlaying) return

    const id = setInterval(() => {
      const current = indexRef.current ?? lastIndex
      const next = current + 1

      if (next > lastIndex) {
        setIsPlaying(false)
        onIndexChange(null)
        return
      }

      onIndexChange(next)
    }, STEP_MS)

    return () => clearInterval(id)
  }, [isPlaying, lastIndex, onIndexChange])

  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-control bg-surface-raised/95 px-3 py-2 shadow-raised ring-1 ring-border-default backdrop-blur-sm">
      <button
        type="button"
        onClick={() => {
          // Arrancar en vivo es arrancar desde el principio: quedarse en el
          // último índice y sumarle uno se pasa del recorrido en el primer
          // tick, así que la reproducción nunca se veía avanzar.
          if (!isPlaying && index === null) onIndexChange(0)
          setIsPlaying((value) => !value)
        }}
        aria-label={isPlaying ? 'Pausar reproducción' : 'Reproducir recorrido'}
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-bg-active text-text-primary transition-colors duration-fast hover:bg-bg-active/70"
      >
        {isPlaying ? <PauseIcon /> : <Play aria-hidden="true" className="size-3.5" />}
      </button>

      <input
        type="range"
        min={0}
        max={lastIndex}
        value={activeIndex}
        onChange={(event) => {
          setIsPlaying(false)
          onIndexChange(Number(event.target.value))
        }}
        className="w-28 accent-[var(--color-accent)] sm:w-40"
        aria-label="Posición en el recorrido de las últimas 6 horas"
      />

      <span className="tabular w-16 shrink-0 text-data-sm text-text-tertiary">
        {formatTime(Date.parse(positions[activeIndex].fixTime))}
      </span>

      {!isLive ? (
        <button
          type="button"
          onClick={() => {
            setIsPlaying(false)
            onIndexChange(null)
          }}
          className="shrink-0 text-data-sm text-accent underline underline-offset-4"
        >
          En vivo
        </button>
      ) : null}
    </div>
  )
}

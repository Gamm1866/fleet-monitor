import { useState } from 'react'
import { LayersThree01 } from '@untitledui/icons'
import { cx } from '@/utils/cx'

export type BaseLayer = 'auto' | 'satellite' | 'terrain'

interface MapLayersProps {
  baseLayer: BaseLayer
  onBaseLayerChange: (layer: BaseLayer) => void
  weatherEnabled: boolean
  onWeatherChange: (enabled: boolean) => void
}

const BASE_OPTIONS: { value: BaseLayer; label: string }[] = [
  { value: 'auto', label: 'Predeterminado' },
  { value: 'terrain', label: 'Terreno' },
  { value: 'satellite', label: 'Satélite' },
]

/**
 * Selector de capas: base del mapa + overlays.
 *
 * "Tráfico" se muestra pero deshabilitado en vez de no mostrarse. Fingir que
 * existe con datos inventados sería peor que decir la verdad: un operador que
 * confía en una capa de tráfico falsa toma una decisión con información que
 * no es real. Las capas de tráfico en tiempo real (Google/TomTom/HERE) son
 * todas de pago; esta es la que sí es gratis y real: precipitación de
 * RainViewer, sin API key.
 */
export function MapLayers({
  baseLayer,
  onBaseLayerChange,
  weatherEnabled,
  onWeatherChange,
}: MapLayersProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="pointer-events-auto relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label="Capas del mapa"
        onClick={() => setIsOpen((value) => !value)}
        className={cx(
          'flex size-9 items-center justify-center rounded-control shadow-raised backdrop-blur-sm transition-colors duration-fast',
          isOpen
            ? 'bg-surface-raised text-accent ring-2 ring-accent'
            : 'bg-surface-raised/90 text-text-secondary ring-1 ring-border-default hover:text-text-primary',
        )}
      >
        <LayersThree01 aria-hidden="true" className="size-4" />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-11 w-52 rounded-control bg-surface-raised p-4 shadow-raised ring-1 ring-border-default"
        >
          <p className="text-label uppercase text-text-tertiary">Base del mapa</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {BASE_OPTIONS.map((option) => (
              <li key={option.value}>
                <label className="flex cursor-pointer items-center gap-2.5 text-data-sm text-text-secondary">
                  <input
                    type="radio"
                    name="base-layer"
                    checked={baseLayer === option.value}
                    onChange={() => onBaseLayerChange(option.value)}
                    className="size-3.5 accent-[var(--color-accent)]"
                  />
                  {option.label}
                </label>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-label uppercase text-text-tertiary">Overlay</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            <li>
              <label className="flex cursor-pointer items-center gap-2.5 text-data-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={weatherEnabled}
                  onChange={(event) => onWeatherChange(event.target.checked)}
                  className="size-3.5 accent-[var(--color-accent)]"
                />
                Clima (lluvia)
              </label>
            </li>
            <li>
              <label className="flex cursor-not-allowed items-center gap-2.5 text-data-sm text-text-quaternary">
                <input type="checkbox" disabled className="size-3.5" />
                Tráfico
                <span className="text-label">— requiere API paga</span>
              </label>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  )
}

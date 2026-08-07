import { Moon01, Sun } from '@untitledui/icons'
import { cx } from '@/utils/cx'
import { useTheme, type Theme } from '@/providers/theme-provider'

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Oscuro', Icon: Moon01 },
]

/**
 * Control de tema de dos posiciones.
 *
 * Es un radiogroup nativo, no dos botones: el navegador ya da navegación con
 * flechas, gestión de foco como un solo tab stop y el anuncio correcto
 * ("Oscuro, opción 2 de 2, seleccionada"). Reimplementar eso con botones y
 * aria-pressed es más código y peor resultado.
 *
 * Sin "Sistema" en el selector a pedido: `theme-provider` sigue resolviendo
 * la preferencia del SO como default la primera vez que alguien abre la app
 * (nadie elige explícitamente "Sistema" acá, pero un visitante nuevo igual
 * arranca en el tema correcto para su equipo).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <fieldset className="inline-flex rounded-control border border-border-default p-0.5">
      <legend className="sr-only">Tema de la interfaz</legend>

      {OPTIONS.map(({ value, label, Icon }) => {
        const isSelected = theme === value

        return (
          <label
            key={value}
            className={cx(
              'relative flex cursor-pointer items-center gap-2 rounded-chip px-2 py-1',
              'text-label font-medium uppercase transition-colors duration-fast ease-[var(--ease)]',
              // El foco se dibuja sobre la etiqueta porque el input real está
              // oculto visualmente; sin esto el anillo no se vería en absoluto.
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
              'has-[:focus-visible]:outline-focus-ring',
              isSelected
                ? 'bg-accent text-text-on-accent'
                : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary',
            )}
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={isSelected}
              onChange={() => setTheme(value)}
              className="sr-only"
            />
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </label>
        )
      })}
    </fieldset>
  )
}

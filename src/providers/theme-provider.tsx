import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'fleet-monitor-theme'
const DARK_CLASS = 'dark-mode'

interface ThemeContextValue {
  /** Lo que el usuario eligió, incluido 'system'. */
  theme: Theme
  /** El tema efectivamente aplicado. Nunca es 'system'. */
  resolved: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme debe usarse dentro de <ThemeProvider>')
  }

  return context
}

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)
  const [systemIsDark, setSystemIsDark] = useState(systemPrefersDark)

  // Con theme='system' hay que seguir escuchando: el sistema operativo puede
  // cambiar de claro a oscuro solo (al anochecer) mientras la pestaña vive.
  // En una app que corre 8 horas seguidas eso pasa de verdad.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystemIsDark(event.matches)

    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const resolved = theme === 'system' ? (systemIsDark ? 'dark' : 'light') : theme

  useEffect(() => {
    document.documentElement.classList.toggle(DARK_CLASS, resolved === 'dark')
  }, [resolved])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)

    if (next === 'system') {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, next)
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

import { useEffect, useState } from 'react'
import { cx } from '@/utils/cx'
import { Button } from '@/components/base/buttons/button'
import { Select } from '@/components/base/select/select'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { DataRow } from '@/components/ui/DataRow'
import { Skeleton } from '@/components/ui/Skeleton'
import { markerHtml } from '@/components/map/marker'
import { StatusPill } from '@/components/ui/StatusPill'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { STATUS_META, type VehicleStatus } from '@/lib/status'
import { formatDecimal } from '@/lib/format'

const STATUSES: VehicleStatus[] = ['moving', 'stopped', 'stale', 'lost']

// Los swatches leen las PRIMITIVAS, no los tokens de Tailwind: `@theme inline`
// incrusta el valor en cada utilidad en vez de emitir una custom property, así
// que `var(--color-surface)` no existe en runtime. Es la contracara de que el
// tema pueda cambiar sin recompilar.
const SURFACES = [
  { token: '--surface-sunken', name: 'surface-sunken', use: 'Fondo del mapa' },
  { token: '--surface', name: 'surface', use: 'Lienzo base' },
  { token: '--surface-raised', name: 'surface-raised', use: 'Tarjetas y paneles' },
  { token: '--color-border-secondary', name: 'border-subtle', use: 'Separadores internos' },
  { token: '--color-border-primary', name: 'border-default', use: 'Contorno de tarjeta' },
]

// Las clases se escriben completas y no se arman por interpolación: Tailwind
// escanea el código como texto plano y una clase construida con template string
// nunca llega al CSS final. Acá funcionaba de casualidad porque esas mismas
// clases aparecen literales en otro componente.
const TEXTS = [
  { name: 'text-primary', cls: 'text-text-primary', dark: '15.52:1', light: '18.31:1' },
  { name: 'text-secondary', cls: 'text-text-secondary', dark: '7.59:1', light: '7.03:1' },
  { name: 'text-tertiary', cls: 'text-text-tertiary', dark: '5.35:1', light: '4.76:1' },
]

const STATUS_TOKENS = [
  { name: 'status-online', token: '--status-online', dark: '9.52:1', light: '5.48:1', means: 'En movimiento' },
  { name: 'status-offline', token: '--status-offline', dark: '5.35:1', light: '4.76:1', means: 'Detenido' },
  { name: 'status-stale', token: '--status-stale', dark: '10.97:1', light: '5.02:1', means: 'Sin reportar' },
  { name: 'status-critical', token: '--status-critical', dark: '6.62:1', light: '6.47:1', means: 'Sin contacto' },
  { name: 'accent', token: '--accent', dark: '7.25:1', light: '6.70:1', means: 'Interacción' },
]

const TYPE_SCALE = [
  { cls: 'text-display', name: 'display', spec: '28 / 32 · −0.02em', sample: 'Camión 04' },
  { cls: 'text-title', name: 'title', spec: '20 / 28 · −0.01em', sample: 'Estado actual' },
  { cls: 'text-label uppercase', name: 'label', spec: '12 / 16 · +0.06em', sample: 'Velocidad' },
  { cls: 'text-data-lg tabular', name: 'data-lg', spec: '32 / 36 · tabular', sample: '84,2' },
  { cls: 'text-data-md tabular', name: 'data-md', spec: '16 / 24 · tabular', sample: '−34,6037' },
  { cls: 'text-data-sm tabular', name: 'data-sm', spec: '13 / 18 · tabular', sample: '14:32:01' },
]

const SPACING = [
  { name: '0.5', px: 2 },
  { name: '1', px: 4 },
  { name: '2', px: 8 },
  { name: '4', px: 16 },
  { name: '6', px: 24 },
  { name: '8', px: 32 },
  { name: '12', px: 48 },
  { name: '16', px: 64 },
]

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border-subtle py-8">
      <h2 className="text-title text-text-primary">{title}</h2>
      {hint && <p className="mt-1 max-w-2xl text-data-sm text-text-secondary">{hint}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}

export default function DesignSystem() {
  const [loading, setLoading] = useState(true)
  const [speed, setSpeed] = useState(84.2)

  // El showcase simula el polling real para poder ver el realce de AnimatedValue
  // y confirmar que el skeleton no desplaza nada al resolverse.
  useEffect(() => {
    const timer = setInterval(() => {
      setSpeed(Number((Math.random() * 110).toFixed(1)))
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-dvh bg-surface px-6 py-10 text-text-primary">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-label uppercase text-text-tertiary">Sistema de diseño</p>
            <h1 className="mt-1 text-display">Monitor de flota</h1>
            <p className="mt-2 max-w-2xl text-data-sm text-text-secondary">
              Sala de control para turnos largos. Todo ratio de contraste está medido
              con la fórmula WCAG 2.1, no estimado. Cambiá de tema para verificar que
              ninguno se cae.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <Section
          title="Superficies"
          hint="En oscuro la elevación se comunica con superficie y borde; una sombra sobre fondo casi negro no se ve. En claro es al revés."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SURFACES.map((surface) => (
              <div
                key={surface.name}
                className="flex items-center gap-3 rounded-card border border-border-subtle p-3"
              >
                <div
                  className="size-10 shrink-0 rounded-control border border-border-default"
                  style={{ background: `var(${surface.token})` }}
                />
                <div className="min-w-0">
                  <p className="text-data-sm text-text-primary">{surface.name}</p>
                  <p className="text-data-sm text-text-tertiary">{surface.use}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Texto" hint="Ratio medido sobre la superficie base de cada tema.">
          <dl className="grid gap-4 sm:grid-cols-3">
            {TEXTS.map((text) => (
              <div key={text.name} className="rounded-card border border-border-subtle p-4">
                <dt className={cx('text-data-md', text.cls)}>Vehículo en ruta</dt>
                <dd className="mt-2 text-data-sm text-text-tertiary">
                  <span className="tabular">{text.name}</span>
                  <br />
                  oscuro <span className="tabular">{text.dark}</span> · claro{' '}
                  <span className="tabular">{text.light}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section
          title="Color de estado"
          hint="El color siempre significa algo. El verde de oscuro y el de claro son colores distintos, no el mismo con opacidad: el verde correcto para fondo claro da 3,9:1 sobre superficie oscura y rompe AA justo en el indicador más mirado de la pantalla."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STATUS_TOKENS.map((token) => (
              <div
                key={token.name}
                className="rounded-card border border-border-subtle bg-surface-raised p-4"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full"
                    style={{ background: `var(${token.token})` }}
                  />
                  <span className="text-data-sm text-text-primary">{token.name}</span>
                </div>
                <p className="mt-2 text-data-sm text-text-secondary">{token.means}</p>
                <p className="mt-1 text-data-sm text-text-tertiary">
                  oscuro <span className="tabular">{token.dark}</span> · claro{' '}
                  <span className="tabular">{token.light}</span>
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="StatusPill"
          hint="El pulso solo anima en 'en movimiento' y desaparece con prefers-reduced-motion. El estado nunca depende del movimiento: color, forma y texto lo comunican igual."
        >
          <div className="flex flex-wrap items-center gap-3">
            {STATUSES.map((status) => (
              <StatusPill key={status} status={status} />
            ))}
          </div>
          <p className="mt-4 text-data-sm text-text-secondary">
            Anuncio para lector de pantalla:{' '}
            <span className="text-text-primary">
              «{STATUS_META.stale.announcement}»
            </span>
          </p>
        </Section>

        <Section
          title="Marcadores del mapa"
          hint="Sobre el mapa no hay texto al lado del punto, así que el color no puede ser el único canal. La figura se va vaciando a medida que el dispositivo se calla: lleno, hueco, cortado. En movimiento el marcador es una flecha rotada por el rumbo — pero solo por encima de 2 km/h, porque debajo de ese umbral el course del GPS es ruido."
        >
          <div className="flex flex-wrap gap-8">
            {STATUSES.map((status) => (
              <div key={status} className="flex flex-col items-center gap-3">
                <span
                  className="grid size-12 place-items-center rounded-card bg-surface-sunken"
                  // El marcador se dibuja como cadena de HTML porque Leaflet lo
                  // inyecta así en el mapa: mostrarlo acá con otro camino sería
                  // documentar algo distinto de lo que se ve en producción.
                  dangerouslySetInnerHTML={{
                    __html: markerHtml({
                      status,
                      course: status === 'moving' ? 45 : undefined,
                    }),
                  }}
                />
                <span className="text-data-sm text-text-secondary">
                  {STATUS_META[status].label}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="DataRow · tres estados"
          hint="El skeleton se dimensiona con texto real invisible, no con una tabla de píxeles. La caja es idéntica al contenido definitivo por construcción, así que el CLS es 0 sin ajustar nada a mano."
        >
          <dl className="grid gap-6 rounded-card border border-border-subtle bg-surface-raised p-6 sm:grid-cols-3">
            <DataRow label="Velocidad" placeholder="000,0" value={`${formatDecimal(speed)} km/h`} />
            <DataRow label="Coordenadas" placeholder="−00,0000" loading />
            <DataRow label="Batería" placeholder="000 %" />
          </dl>
          <div className="mt-4 flex items-center gap-3">
            <Button size="sm" color="secondary" onClick={() => setLoading((v) => !v)}>
              {loading ? 'Resolver carga' : 'Volver a cargar'}
            </Button>
            <span className="text-data-sm text-text-tertiary">
              La tercera fila muestra el estado «dato no disponible»: el
              dispositivo no reporta batería.
            </span>
          </div>
          <dl className="mt-4 grid gap-6 rounded-card border border-border-subtle bg-surface-raised p-6 sm:grid-cols-3">
            <DataRow
              label="Última actualización"
              placeholder="00:00:00"
              loading={loading}
              value={<span className="tabular">14:32:01</span>}
            />
            <DataRow
              label="Rumbo"
              placeholder="000°"
              loading={loading}
              value={<span className="tabular">184°</span>}
            />
            <DataRow
              label="Odómetro"
              placeholder="000.000 km"
              loading={loading}
              value={<span className="tabular">128.430 km</span>}
            />
          </dl>
        </Section>

        <Section
          title="AnimatedValue"
          hint="Se actualiza solo cada 3 segundos, como el polling real. El realce tiene que ser perceptible con la visión periférica y olvidable de inmediato."
        >
          <p className="text-data-lg text-text-primary">
            <AnimatedValue value={formatDecimal(speed)} /> <span className="text-title text-text-tertiary">km/h</span>
          </p>
        </Section>

        <Section title="Skeleton" hint="Cada bloque ocupa exactamente el espacio de su contenido real.">
          <div className="flex flex-wrap items-end gap-4">
            <Skeleton className="text-display">Camión 04</Skeleton>
            <Skeleton className="text-data-lg tabular">000,0</Skeleton>
            <Skeleton className="text-data-sm tabular">00:00:00</Skeleton>
          </div>
        </Section>

        <Section title="Tipografía" hint="Geist para el chrome, Geist Mono para todo dato en vivo.">
          <div className="space-y-4">
            {TYPE_SCALE.map((type) => (
              <div
                key={type.name}
                className="flex flex-wrap items-baseline justify-between gap-4 border-b border-border-subtle pb-4"
              >
                <span className={type.cls}>{type.sample}</span>
                <span className="text-data-sm text-text-tertiary">
                  {type.name} · {type.spec}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Espaciado" hint="Escala estricta. Ningún valor fuera de esta lista en todo el proyecto.">
          <div className="flex flex-wrap items-end gap-4">
            {SPACING.map((step) => (
              <div key={step.name} className="text-center">
                <div className="bg-accent" style={{ width: step.px, height: step.px }} />
                <p className="mt-2 text-data-sm text-text-tertiary tabular">{step.px}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Foco y controles"
          hint="Navegá con Tab. Todo control interactivo muestra el mismo anillo, definido una sola vez con :focus-visible para que ninguno pueda quedarse sin él por olvido."
        >
          <div className="flex flex-wrap items-end gap-4">
            <Button color="primary">Reintentar</Button>
            <Button color="secondary">Ver detalle</Button>
            <div className="w-64">
              <Select label="Vehículo" placeholder="Elegí un vehículo" items={[
                { id: '1', label: 'Camión 04' },
                { id: '2', label: 'Utilitario 11' },
                { id: '3', label: 'Furgón 27' },
              ]}>
                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
              </Select>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}

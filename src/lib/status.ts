/**
 * Vocabulario de estado del sistema.
 *
 * La distinción crítica del producto vive acá: el movimiento del VEHÍCULO y el
 * silencio del DISPOSITIVO son dos señales independientes.
 *
 * Un chofer detenido veinte minutos con el rastreador encendido tiene un dato
 * perfecto — no es una falla. Un rastreador que dejó de reportar es una ausencia
 * de información. Tratar los dos casos con el mismo lenguaje visual entrena al
 * operador a ignorar las alertas, que es el peor resultado posible en una sala
 * de control.
 */
export type VehicleStatus = 'moving' | 'stopped' | 'stale' | 'lost'

interface StatusMeta {
  /** Etiqueta corta para el pill. */
  label: string
  /** Frase completa para lectores de pantalla y anuncios aria-live. */
  announcement: string
  /** Token semántico de color. */
  token: 'online' | 'offline' | 'stale' | 'critical'
}

export const STATUS_META: Record<VehicleStatus, StatusMeta> = {
  moving: {
    label: 'En movimiento',
    announcement: 'El vehículo está en movimiento',
    token: 'online',
  },
  stopped: {
    label: 'Detenido',
    announcement: 'El vehículo está detenido y reportando con normalidad',
    token: 'offline',
  },
  stale: {
    label: 'Sin reportar',
    announcement: 'El vehículo dejó de reportar su posición',
    token: 'stale',
  },
  lost: {
    label: 'Sin contacto',
    announcement: 'Se perdió el contacto con el vehículo',
    token: 'critical',
  },
}

/** Minutos de silencio del dispositivo antes de degradar el estado. */
export const STALE_AFTER_MINUTES = 2
export const LOST_AFTER_MINUTES = 30

/** Por debajo de este umbral el rumbo que reporta el GPS es ruido. */
export const MOVING_ABOVE_KMH = 2

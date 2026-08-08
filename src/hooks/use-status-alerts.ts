import { useCallback, useEffect, useRef, useState } from 'react'
import type { Vehicle } from '@/lib/traccar'

export interface StatusAlert {
  id: string
  vehicleId: number
  vehicleName: string
  message: string
}

const AUTO_DISMISS_MS = 6_000

/**
 * Avisos de transición: no "está detenido" (eso ya lo dice el pill de
 * estado todo el tiempo), sino "ACABA de detenerse" — el instante en que
 * pasa de moverse a no moverse es la única vez que amerita interrumpir con
 * un aviso en pantalla. El resto del tiempo el estado se lee, no se anuncia.
 */
export function useStatusAlerts(vehicles: Vehicle[]) {
  const previousStatusRef = useRef(new Map<number, Vehicle['status']>())
  const [alerts, setAlerts] = useState<StatusAlert[]>([])

  const dismiss = useCallback((id: string) => {
    setAlerts((current) => current.filter((alert) => alert.id !== id))
  }, [])

  useEffect(() => {
    const previous = previousStatusRef.current

    for (const vehicle of vehicles) {
      const previousStatus = previous.get(vehicle.id)

      if (previousStatus === 'moving' && vehicle.status === 'stopped') {
        const id = `${vehicle.id}-${Date.now()}`
        setAlerts((current) => [
          ...current,
          { id, vehicleId: vehicle.id, vehicleName: vehicle.name, message: `${vehicle.name} se detuvo` },
        ])
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
      }

      previous.set(vehicle.id, vehicle.status)
    }
  }, [vehicles, dismiss])

  return { alerts, dismiss }
}

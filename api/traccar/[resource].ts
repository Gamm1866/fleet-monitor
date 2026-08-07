import type { IncomingMessage, ServerResponse } from 'node:http'

const UPSTREAM = 'https://demo.traccar.org'

// Allowlist estricta: el proxy lleva credenciales de la cuenta Traccar,
// asi que solo puede leer estos dos recursos. Sin esto seria un relay
// abierto contra la cuenta (se podrian enviar comandos al dispositivo).
const ALLOWED = new Set(['devices', 'positions', 'geofences'])

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return json(res, { error: 'method_not_allowed' }, 405)
  }

  // req.url llega relativo ("/api/traccar/devices?..."), no absoluto:
  // new URL() sin base lanzaria ERR_INVALID_URL.
  const url = new URL(req.url ?? '', 'http://localhost')
  const resource = url.pathname.replace(/^\/api\/traccar\/?/, '')

  if (!ALLOWED.has(resource)) {
    return json(res, { error: 'resource_not_allowed', resource }, 403)
  }

  const email = process.env.TRACCAR_EMAIL
  const password = process.env.TRACCAR_PASSWORD

  if (!email || !password) {
    return json(res, { error: 'missing_credentials' }, 500)
  }

  // Vercel inyecta el segmento dinamico como query param; no es de Traccar.
  const params = new URLSearchParams(url.search)
  params.delete('resource')
  const query = params.toString()

  const auth = Buffer.from(`${email}:${password}`).toString('base64')

  try {
    const upstream = await fetch(
      `${UPSTREAM}/api/${resource}${query ? `?${query}` : ''}`,
      { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } },
    )

    const body = await upstream.text()

    res.statusCode = upstream.status
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    // El cliente compara fixTime contra esta fecha, no contra el reloj
    // del navegador, que puede estar desfasado.
    res.setHeader('X-Server-Time', new Date().toISOString())
    res.end(body)
  } catch {
    json(res, { error: 'upstream_unreachable' }, 502)
  }
}

function json(res: ServerResponse, body: unknown, status: number): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

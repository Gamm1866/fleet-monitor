const UPSTREAM = 'https://demo.traccar.org'

// Allowlist estricta: el proxy lleva credenciales de la cuenta Traccar,
// asi que solo puede leer estos dos recursos. Sin esto seria un relay
// abierto contra la cuenta (se podrian enviar comandos al dispositivo).
const ALLOWED = new Set(['devices', 'positions'])

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  const url = new URL(request.url)
  const resource = url.pathname.replace(/^\/api\/traccar\/?/, '')

  if (!ALLOWED.has(resource)) {
    return json({ error: 'resource_not_allowed', resource }, 403)
  }

  const email = process.env.TRACCAR_EMAIL
  const password = process.env.TRACCAR_PASSWORD

  if (!email || !password) {
    return json({ error: 'missing_credentials' }, 500)
  }

  const auth = Buffer.from(`${email}:${password}`).toString('base64')

  try {
    const upstream = await fetch(`${UPSTREAM}/api/${resource}${url.search}`, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    })

    const body = await upstream.text()

    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        // El cliente compara fixTime contra esta fecha, no contra el reloj
        // del navegador, que puede estar desfasado.
        'X-Server-Time': new Date().toISOString(),
      },
    })
  } catch (error) {
    return json({ error: 'upstream_unreachable' }, 502)
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

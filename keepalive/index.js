// Latido del demo. GitHub Actions promete */5 y entrega ~1/hora (los cron
// programados los estrangula), así que el camión pasaba el día en "sin
// contacto". Esto vive en Railway como proceso siempre encendido.
// ponytail: setInterval sin scheduler ni reintentos — si el proceso muere,
// Railway lo reinicia; si un ping falla, el siguiente llega en 60 s.

const URL = process.env.TARGET_URL ?? 'https://fleet-monitor-ivory.vercel.app/api/cron/refresh-demo'
const EVERY_MS = 60_000

async function tick() {
  try {
    const res = await fetch(URL)
    console.log(new Date().toISOString(), res.status, await res.text())
  } catch (err) {
    console.error(new Date().toISOString(), 'ping falló:', err.message)
  }
}

tick()
setInterval(tick, EVERY_MS)

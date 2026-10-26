// Licensed/generated repository reference photos only. No API keys read or printed.
// Dry run: node scripts/sprint-smoke.mjs
// Live: node scripts/sprint-smoke.mjs --run (at most 11 requested units; app reserve still applies).
import fs from 'node:fs/promises'
import path from 'node:path'
const run = process.argv.includes('--run')
const base = process.env.SMOKE_URL || 'http://localhost:3123'
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Use a local app instance for this smoke test.')
const scenarios = [
  { name: 'earring', source: 'face', productId: 'gilded-teardrop', flow: 'ear', sizeCm: 3, irisPx: 41, ear: 'right', units: 1 },
  { name: 'earring-compare', source: 'face', productId: 'gilded-teardrop', flow: 'ear', sizeCm: 6, irisPx: 41, ear: 'right', units: 1 },
  { name: 'necklace', source: 'neck', productId: 'orb-chain', flow: 'neck', units: 1 },
  { name: 'ring', source: 'hand', productId: 'met-carnelian-ring', flow: 'hand', finger: 3, ringSizeUs: 7, units: 1 },
  { name: 'watch', source: 'wrist', productId: 'atlantic-classic', flow: 'hand', units: 1 },
  { name: 'bracelet', source: 'wrist', productId: 'met-open-cuff', flow: 'hand', units: 1 },
  { name: 'lipstick', source: 'face', productId: 'gilded-teardrop', flow: 'ear', sizeCm: 3, irisPx: 41, ear: 'right', options: { lipstick: { hex: '#9B1B30', texture: 'satin', intensity: 80 } }, units: 2 },
  { name: 'hair', source: 'face', productId: 'gilded-teardrop', flow: 'ear', sizeCm: 3, irisPx: 41, ear: 'right', units: 3 },
]
if (!run) { console.log(JSON.stringify({ mode: 'dry-run', maximumRequestedUnits: scenarios.reduce((n,s) => n+s.units,0), scenarios: scenarios.map(s => s.name) })); process.exit(0) }
const output = path.resolve('..', 'outputs', 'sprint-real')
await fs.mkdir(output, { recursive: true })
let cookie = ''
async function request(url, init = {}, authenticated = true) {
  const response = await fetch(`${base}${url}`, { ...init, headers: { ...(authenticated && cookie ? { Cookie: cookie } : {}), ...init.headers }, signal: AbortSignal.timeout(100000) })
  if (authenticated) for (const entry of response.headers.getSetCookie()) { if (entry.startsWith('darpan_session=')) cookie = entry.split(';')[0] }
  return response
}
const photos = {}
const sources = { face: 'public/sample-face.png', neck: 'public/samples/neck-face.png', hand: 'public/samples/hand.png', wrist: 'public/samples/wrist.png' }
const report = []
let requested = 0
try {
  for (const scenario of scenarios) {
    const { name, source, units, ...params } = scenario
    if (requested + units > 11) throw new Error('Smoke credit ceiling reached')
    if (!photos[source]) {
      await request('/api/photo/upload', { method: 'POST' })
      const form = new FormData(); form.append('photo', new Blob([await fs.readFile(sources[source])], { type: 'image/png' }), `${source}.png`)
      const uploaded = await request('/api/photo', { method: 'POST', body: form })
      const data = await uploaded.json()
      if (!uploaded.ok) throw new Error(`Photo preparation failed: ${data.userMessage || uploaded.status}`)
      photos[source] = data.photoId
    }
    if (name === 'hair') {
      const available = await request('/api/hair/templates')
      const templates = await available.json()
      const preset = Array.isArray(templates) && templates.find(t => /braid|bun|updo|ponytail|tied/i.test(t.title))
      if (!available.ok || !preset) { report.push({ name, status: 'unavailable', note: 'No live hair template was returned' }); continue }
      params.options = { hairUp: { templateId: preset.id } }
    }
    requested += units
    const response = await request('/api/tryon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoId: photos[source], ...params }) })
    let data = await response.json()
    if (!response.ok) { report.push({ name, status: 'failed', code: data.code, message: data.userMessage }); console.log(`${name}: ${data.code || response.status}`); continue }
    if (data.jobId) {
      const jobId = data.jobId
      for (let poll = 0; poll < 180; poll++) {
        const polled = await request(`/api/tryon/${jobId}`)
        data = await polled.json()
        if (polled.status === 409) { await new Promise(r => setTimeout(r, 1500)); continue }
        if (!polled.ok || data.status === 'done' || data.status === 'error') break
        await new Promise(r => setTimeout(r, 1500))
      }
    }
    if (data.status === 'done' && data.result?.imageUrl) {
      const image = await request(data.result.imageUrl)
      if (!image.ok) throw new Error(`Private result not accessible for ${name}`)
      await fs.writeFile(path.join(output, `${name}.png`), Buffer.from(await image.arrayBuffer()))
      const denied = await request(data.result.imageUrl, {}, false)
      if (![401,404].includes(denied.status)) throw new Error('Private result was exposed without its session')
      report.push({ name, status: 'done', unitsSpent: data.result.unitsSpent, measurement: data.result.measurement || null, unauthenticatedStatus: denied.status })
    } else report.push({ name, status: 'failed', code: data.code || 'TIMEOUT', message: data.userMessage })
    console.log(`${name}: ${report.at(-1).status}`)
  }
} finally {
  for (const photoId of Object.values(photos)) {
    const deleted = await request(`/api/photo/${photoId}`, { method: 'DELETE' })
    const after = await request(`/api/photo/${photoId}`)
    report.push({ name: 'photo-deletion', status: deleted.ok && after.status === 404 ? 'done' : 'failed', deleteStatus: deleted.status, afterStatus: after.status })
  }
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ maximumRequestedUnits: 11, requestedUnits: requested, report }, null, 2))
  console.log(`Report: ${path.join(output, 'report.json')}`)
}
if (report.some(item => item.status !== 'done')) process.exitCode = 1

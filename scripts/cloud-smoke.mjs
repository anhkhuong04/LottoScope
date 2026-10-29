// Read-only cloud acceptance: never call sync, prizes enrichment or a migration.
import assert from 'node:assert/strict'

const [siteInput, originInput] = process.argv.slice(2)
if (!siteInput || !originInput) {
  console.error('Usage: node scripts/cloud-smoke.mjs https://SITE.vercel.app https://API.onrender.com')
  process.exit(1)
}
const site = new URL(siteInput)
const origin = new URL(originInput)
for (const url of [site, origin]) {
  assert.equal(url.protocol, 'https:')
  assert.equal(url.pathname, '/')
  assert.equal(url.username + url.password + url.search + url.hash, '')
}

async function get(base, path, expected = 200) {
  const response = await fetch(new URL(path, base), {
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(270_000),
  })
  assert.equal(response.status, expected, `${path}: HTTP ${response.status}, expected ${expected}`)
  assert.match(response.headers.get('content-type') ?? '', /application\/json/i, path)
  return response
}

assert.deepEqual(await (await get(origin, '/health/live')).json(), { status: 'ok' })
for (const path of ['/api/v1/games', '/health/ready', '/docs', '/openapi.json']) {
  const denied = await get(origin, path, 401)
  assert.equal((await denied.json()).error.code, 'unauthorized')
}

const gamesResponse = await get(site, '/api/v1/games')
assert.equal(gamesResponse.headers.get('cache-control'), 'no-store')
const games = (await gamesResponse.json()).items
assert.deepEqual(games.map((game) => game.id).sort(), ['lotto_535', 'mega_645', 'power_655'])
const unknown = await get(site, '/api/v1/does-not-exist', 404)
assert.equal((await unknown.json()).error.code, 'not_found')

for (const game of games) {
  const path = `/api/v1/games/${game.id}`
  const status = await (await get(site, `${path}/status`)).json()
  assert.ok(status.latest_draw_id, `${game.id}: missing restored history`)
  const latest = await (await get(site, `${path}/draws/latest`)).json()
  assert.equal(latest.draw_id, status.latest_draw_id)
  assert.equal(latest.main_numbers.length, game.main_count)
  const numbers = await (await get(site, `${path}/analytics/numbers?window=last_draws&count=30`)).json()
  assert.equal(numbers.context.game, game.id)
  assert.equal(numbers.context.analysis_window.kind, 'last_draws')
  assert.equal(numbers.context.analysis_window.count, 30)
  assert.ok(numbers.context.actual_draw_count > 0)
  console.log(`${game.id}: latest=${latest.draw_id}, window=${numbers.context.actual_draw_count}, API OK`)
}

for (const path of ['/dashboard', '/history/00001', '/numbers/1', '/pairs/1/2', '/checker', '/generator']) {
  const response = await fetch(new URL(path, site), { signal: AbortSignal.timeout(90_000) })
  assert.equal(response.status, 200, `${path}: deep link failed`)
  assert.match(response.headers.get('content-type') ?? '', /text\/html/i)
  assert.match(await response.text(), /id="root"/)
}
const started = performance.now()
await Promise.all(
  Array.from({ length: 10 }, () =>
    get(site, '/api/v1/games/mega_645/analytics/numbers?window=last_draws&count=30'),
  ),
)
console.log(`10 concurrent reads completed in ${Math.round(performance.now() - started)} ms`)
console.log('Cloud HTTP smoke passed. Browser, cold-start, backup and live-source acceptance are separate.')

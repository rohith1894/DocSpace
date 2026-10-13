/**
 * End-to-end check of real-time sync across laptop, phone and tablet windows.
 *
 *   APP_URL=http://127.0.0.1:5173 API_URL=http://localhost:8080 npm run e2e
 *
 * Registers two throwaway users, shares a document between them and drives four browser
 * windows at once: concurrent typing, a phone dropping offline, reloads, and a cold reopen
 * that must load everything back from the database.
 */
import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'

const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:5173'
const API_URL = process.env.API_URL ?? 'http://localhost:8080'
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ROUNDS = Number(process.env.ROUNDS ?? 10)
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR

async function api(path, body, token) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body)
  })
  const json = await res.json()
  if (!json.success) throw new Error(`${path}: ${json.message}`)
  return json.data
}

async function registerUser(name) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return api('/api/auth/register', { email: `e2e-${name.toLowerCase()}-${id}@docspace.test`, name, password: `pw-${id}` })
}

async function openDevice(browser, label, descriptor, auth, docId) {
  const context = await browser.newContext(descriptor)
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('docspace_jwt_token', token)
    localStorage.setItem('docspace_current_user', JSON.stringify(user))
  }, auth)
  const page = await context.newPage()
  page.on('pageerror', (err) => console.error(`[${label}] page error:`, err.message))
  page.on('console', (msg) => msg.type() === 'error' && console.error(`[${label}] console:`, msg.text()))
  await page.goto(`${APP_URL}/#${docId}`)
  try {
    await page.locator('[data-testid=editor]').waitFor({ timeout: 20_000 })
  } catch (err) {
    const body = (await page.locator('body').innerText()).slice(0, 300)
    throw new Error(`[${label}] editor did not open. Page shows: ${JSON.stringify(body)}`, { cause: err })
  }
  return { label, context, page, isMobile: !!descriptor.isMobile }
}

const editorText = (device) => device.page.locator('[data-testid=editor]').innerText()

async function typeLine(device, text) {
  const editor = device.page.locator('[data-testid=editor]')
  if (device.isMobile) await editor.tap()
  else await editor.click()
  await device.page.keyboard.press('ControlOrMeta+End')
  await device.page.keyboard.press('Enter')
  await device.page.keyboard.type(text, { delay: 15 })
}

async function waitForConvergence(devicesList, expected, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  let texts = []
  while (Date.now() < deadline) {
    texts = await Promise.all(devicesList.map(editorText))
    const allEqual = texts.every((t) => t === texts[0])
    const complete = expected.every((line) => texts[0].includes(line))
    if (allEqual && complete) return texts[0]
    await new Promise((r) => setTimeout(r, 200))
  }
  const missing = devicesList.map((d, i) => `${d.label}: missing ${expected.filter((l) => !texts[i].includes(l)).join(', ') || '-'}`)
  throw new Error(`Devices did not converge:\n${missing.join('\n')}`)
}

async function waitForSaved(device, timeoutMs = 10_000) {
  await device.page.locator('[data-testid=save-status][data-status=saved]').waitFor({ timeout: timeoutMs })
}

async function main() {
  console.log(`App: ${APP_URL}  API: ${API_URL}`)
  const alice = await registerUser('Alice')
  const bob = await registerUser('Bob')
  const doc = await api('/api/documents', { title: `E2E multi-device ${new Date().toISOString()}` }, alice.token)
  await api(`/api/documents/${doc.id}/share`, { email: bob.user.email, role: 'EDITOR' }, alice.token)
  console.log(`Document ${doc.id} shared between ${alice.user.email} and ${bob.user.email}`)

  const browser = await chromium.launch({ executablePath: CHROME, headless: process.env.HEADED !== '1' })
  const laptop = await openDevice(browser, 'laptop', { viewport: { width: 1440, height: 900 } }, alice, doc.id)
  const phone = await openDevice(browser, 'phone', devices['iPhone 13'], bob, doc.id)
  const tablet = await openDevice(browser, 'tablet', devices['iPad (gen 7)'], alice, doc.id)
  const laptop2 = await openDevice(browser, 'laptop-2', { viewport: { width: 1280, height: 800 } }, bob, doc.id)
  const all = [laptop, phone, tablet, laptop2]
  const expected = []

  // 1. Every device types at the same time, round after round.
  for (let round = 1; round <= ROUNDS; round++) {
    const lines = all.map((d) => `${d.label} round ${round} says hello`)
    await Promise.all(all.map((d, i) => typeLine(d, lines[i])))
    expected.push(...lines)
    await waitForConvergence(all, expected)
    console.log(`✓ round ${round}/${ROUNDS}: ${all.length} devices typed concurrently and converged`)
  }

  // 2. Presence: two distinct users, Alice on two devices.
  const presence = await laptop.page.locator('[data-testid=presence-bar] > div[title]').count()
  assert.equal(presence, 2, 'presence bar should show 2 users')
  console.log('✓ presence shows 2 users across 4 windows')

  // 3. Phone goes offline, both sides keep typing, phone comes back.
  await phone.context.setOffline(true)
  await phone.page.waitForFunction(() => document.querySelector('[data-testid=save-status]')?.dataset.status === 'offline', null, { timeout: 30_000 })
  const offlineLines = ['phone typed this while offline', 'laptop typed this while phone was offline']
  await typeLine(phone, offlineLines[0])
  await typeLine(laptop, offlineLines[1])
  await phone.context.setOffline(false)
  expected.push(...offlineLines)
  await waitForConvergence(all, expected, 30_000)
  console.log('✓ offline phone edits merged after reconnect, and the phone received missed edits')

  // 4. Reloading a device restores the full document.
  await tablet.page.reload()
  await tablet.page.locator('[data-testid=editor]').waitFor()
  await waitForConvergence(all, expected)
  console.log('✓ tablet reload restored the full document')

  await Promise.all(all.map((d) => waitForSaved(d)))
  console.log('✓ every device reports "Saved"')

  if (SCREENSHOT_DIR) {
    await Promise.all(all.map((d) => d.page.screenshot({ path: `${SCREENSHOT_DIR}/${d.label}.png` })))
  }

  // 5. Close everything; a cold open must load from the database.
  const finalText = await editorText(laptop)
  await Promise.all(all.map((d) => d.context.close()))
  await new Promise((r) => setTimeout(r, 1500))
  const reopened = await openDevice(browser, 'reopened-phone', devices['iPhone 13'], bob, doc.id)
  await waitForConvergence([reopened], expected)
  assert.equal(await editorText(reopened), finalText)
  console.log('✓ cold reopen after all windows closed loaded identical content from the server')

  await browser.close()
  console.log(`\nPASS: ${expected.length} lines from ${all.length} devices, all replicas identical.`)
}

main().catch((err) => {
  console.error('\nFAIL:', err.message)
  process.exit(1)
})

import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => console.error('Browser error:', error.message))
})

const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'specialist@example.com' }
const session = { access_token: 'test-access-token', refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }

async function backend(page: Page, options: { publishError?: boolean; setupError?: boolean; admin?: boolean; legacy?: boolean; plan?: boolean } = {}) {
  let published: Record<string, unknown> | null = options.legacy ? { slot: 'help-overview', title: 'Old upload', file_path: 'help/old.mp4', mime_type: 'video/mp4' } : null
  let uploadRequests = 0
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '', contentType: 'text/css' }))
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('https://test.supabase.co/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.includes('/auth/v1/')) return route.fulfill({ json: url.pathname.includes('/token') ? session : user })
    if (url.pathname.endsWith('/rpc/ward_progress_stats')) return route.fulfill({ json: null })
    if (url.pathname.endsWith('/rpc/is_admin')) return route.fulfill({ json: options.admin !== false })
    if (url.pathname.endsWith('/site_media')) {
      if (options.setupError) return route.fulfill({ status: 404, json: { message: 'Could not find the table site_media' } })
      if (route.request().method() === 'POST') {
        if (options.publishError) return route.fulfill({ status: 403, json: { message: 'Publishing permission denied' } })
        published = route.request().postDataJSON()
      }
      return route.fulfill({ json: published })
    }
    if (url.pathname.endsWith('/documents')) return route.fulfill({ json: options.plan ? [{ id: 'plan', title: 'Ward plan', kind: 'plan', file_path: 'plan/test.pdf', published_at: '2026-09-01', description: '' }] : [] })
    return route.fulfill({ json: [] })
  })
  await page.route('https://test.storage.supabase.co/**', async (route) => {
    uploadRequests++
    return route.abort()
  })
  return { published: () => published, uploadRequests: () => uploadRequests }
}

async function signIn(page: Page) {
  await page.goto('/specialist', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email address').fill(user.email)
  await page.getByLabel('Password').fill('test-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Specialist dashboard' })).toBeVisible()
}

function videoForm(page: Page) { return page.locator('form').filter({ has: page.getByRole('heading', { name: 'Help video settings' }) }) }
const defaultUrl = 'https://drive.google.com/file/d/199KZvSWlzFuu5LmEsGCPycLYD0E7MjGO/view?usp=sharing'
const customUrl = 'https://drive.google.com/file/d/replacement/view?usp=sharing'

test('administrator saves a link that persists across reloads and appears on Help without uploading', async ({ page }) => {
  const api = await backend(page)
  await signIn(page)
  let form = videoForm(page)
  await expect(form.getByLabel('Video link')).toHaveValue(defaultUrl)
  await form.getByLabel('Video link').fill(customUrl)
  await form.getByLabel('Video title').fill('Our new walkthrough')
  await form.getByRole('button', { name: 'Save video link' }).click()
  await expect(form.getByRole('status')).toContainText('Video link saved')
  expect(api.published()?.file_path).toBe(customUrl)
  expect(api.uploadRequests()).toBe(0)
  await expect(page.locator('.help-video-admin a.help-video-card')).toHaveAttribute('href', customUrl)
  await page.reload({ waitUntil: 'domcontentloaded' })
  form = videoForm(page)
  await expect(form.getByLabel('Video link')).toHaveValue(customUrl)
  await expect(form.getByLabel('Video title')).toHaveValue('Our new walkthrough')
  await page.goto('/help', { waitUntil: 'domcontentloaded' })
  const card = page.getByRole('link', { name: 'Watch Our new walkthrough (opens in a new tab)' })
  await expect(card).toHaveAttribute('href', customUrl)
  await expect(card).toHaveAttribute('target', '_blank')
  await expect(card).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(page.locator('video, iframe')).toHaveCount(0)
})

test('save failures retain entered settings and allow retry', async ({ page }) => {
  await backend(page, { publishError: true })
  await signIn(page)
  const form = videoForm(page)
  await form.getByLabel('Video link').fill(customUrl)
  await form.getByRole('button', { name: 'Save video link' }).click()
  await expect(form.getByRole('alert')).toContainText('Publishing permission denied')
  await expect(form.getByLabel('Video link')).toHaveValue(customUrl)
  await expect(form.getByRole('button', { name: 'Save video link' })).toBeEnabled()
  await expect(page.locator('.help-video-admin a.help-video-card')).toHaveAttribute('href', defaultUrl)
})

test('invalid links cannot be saved', async ({ page }) => {
  const api = await backend(page)
  await signIn(page)
  const form = videoForm(page)
  for (const value of ['', 'javascript:alert(1)', 'http://example.com/video', 'https://user:secret@example.com/video']) {
    await form.getByLabel('Video link').fill(value)
    await form.getByRole('button', { name: 'Save video link' }).click()
    await expect(form.getByRole('alert')).toContainText('Enter a valid HTTPS video link')
  }
  expect(api.published()).toBeNull()
})

for (const options of [{}, { legacy: true }, { setupError: true }]) {
  test(`Help uses the supplied Drive link with fallback ${JSON.stringify(options)}`, async ({ page }) => {
    await backend(page, options)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/help', { waitUntil: 'domcontentloaded' })
    const card = page.locator('a.help-video-card')
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('href', defaultUrl)
    await expect(page.locator('video, iframe')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('non-admin cannot access video settings', async ({ page }) => {
  await backend(page, { admin: false })
  await page.goto('/specialist', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email address').fill(user.email)
  await page.getByLabel('Password').fill('test-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await expect(videoForm(page)).toHaveCount(0)
})

test('household members can be removed and ages can be cleared, replaced, and persisted', async ({ page }) => {
  await backend(page)
  await page.goto('/planner', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Add household member' }).click()
  const age = page.getByLabel('Person 2 age')
  await age.fill('0')
  await age.press('Backspace')
  await expect(age).toHaveValue('')
  await age.fill('12')
  await age.blur()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ward-members') ?? '[]')[1]?.age)).toBe(12)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByLabel('Person 2 age')).toHaveValue('12')
  await page.getByRole('button', { name: 'Remove person 2', exact: true }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ward-members') ?? '[]').length)).toBe(1)
  await expect(page.getByLabel('Person 2 age')).toHaveCount(0)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByLabel('Person 2 age')).toHaveCount(0)
})

test('ward plan download stays readable when hovered and focused', async ({ page }) => {
  await backend(page, { plan: true })
  await page.goto('/library', { waitUntil: 'domcontentloaded' })
  const download = page.getByRole('link', { name: 'Download a copy' })
  await download.hover()
  await expect(download).toBeVisible()
  for (const focus of [false, true]) {
    if (focus) await download.focus()
    const colors = await download.evaluate((element) => { const style = getComputedStyle(element); return [style.color, style.backgroundColor] })
    expect(colors[0]).not.toBe(colors[1])
    expect(colors[1]).not.toBe('rgba(0, 0, 0, 0)')
  }
})

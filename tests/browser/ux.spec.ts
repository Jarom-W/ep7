import { expect, test, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => console.error('Browser error:', error.message))
})

const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'specialist@example.com' }
const session = { access_token: 'test-access-token', refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }

async function backend(page: Page, options: { publishError?: boolean; setupError?: boolean; uploadError?: boolean; plan?: boolean } = {}) {
  let published: Record<string, unknown> | null = null
  let uploadRequests = 0
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '', contentType: 'text/css' }))
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('https://test.supabase.co/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.includes('/auth/v1/')) return route.fulfill({ json: url.pathname.includes('/token') ? session : user })
    if (url.pathname.endsWith('/rpc/ward_progress_stats')) return route.fulfill({ json: null })
    if (url.pathname.endsWith('/rpc/is_admin')) return route.fulfill({ json: true })
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
    // Enforce the actual wire header: XHR combines duplicate Authorization values.
    // Supabase rejects "Bearer token, Bearer token" with this exact error.
    if (route.request().headers().authorization !== `Bearer ${session.access_token}`) {
      return route.fulfill({ status: 400, json: { statusCode: '403', error: 'AccessDenied', message: 'Invalid Compact JWS' } })
    }
    if (options.uploadError) return route.fulfill({ status: 403, body: 'Storage permission denied' })
    const sent = route.request().postDataBuffer()?.length ?? 0
    const offset = Number(route.request().headers()['upload-offset'] ?? 0) + sent
    return route.fulfill({ status: route.request().method() === 'POST' ? 201 : 204, headers: {
      location: 'https://test.storage.supabase.co/storage/v1/upload/resumable/test-upload',
      'tus-resumable': '1.0.0', 'upload-offset': String(offset),
      'access-control-allow-origin': '*', 'access-control-expose-headers': 'location,upload-offset,tus-resumable',
    } })
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

function videoForm(page: Page) { return page.locator('form').filter({ has: page.getByRole('heading', { name: 'Publish the Help video' }) }) }
const video = { name: 'walkthrough.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(10, 1) }

test('video upload validates selection, transfers multiple chunks, publishes, and refreshes preview', async ({ page }, testInfo) => {
  const api = await backend(page)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await signIn(page)
  const form = videoForm(page)
  const publish = form.getByRole('button', { name: 'Upload & publish video' })
  await publish.click()
  await expect(form.getByRole('alert')).toContainText('Choose a video')
  const videoPath = testInfo.outputPath('walkthrough.mp4')
  await mkdir(dirname(videoPath), { recursive: true })
  await writeFile(videoPath, Buffer.alloc(7 * 1024 * 1024, 1))
  await form.locator('input[type=file]').setInputFiles(videoPath)
  await expect(form).toContainText('Selected: walkthrough.mp4')
  await publish.click()
  await expect(form.getByRole('status')).toContainText('Video published successfully', { timeout: 15000 })
  expect(api.uploadRequests()).toBeGreaterThan(1)
  expect(api.published()?.mime_type).toBe('video/mp4')
  await expect(page.locator('.help-video-admin video')).toHaveAttribute('src', /help\/.*walkthrough.mp4/)
  await expect(form.locator('input[type=file]')).toHaveValue('')
  expect(errors).toEqual([])
  await page.goto('/help', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.help-video-card source')).toHaveAttribute('src', /help\/.*walkthrough.mp4/)
})

test('publish failures stay visible and allow retry without losing the selected file', async ({ page }) => {
  await backend(page, { publishError: true })
  await signIn(page)
  const form = videoForm(page)
  await form.locator('input[type=file]').setInputFiles({ ...video, buffer: Buffer.alloc(10) })
  await form.getByRole('button', { name: 'Upload & publish video' }).click()
  await expect(form.getByRole('alert')).toContainText('Publishing permission denied')
  await expect(form.getByRole('button', { name: 'Upload & publish video' })).toBeEnabled()
  await expect(form).toContainText('Selected: walkthrough.mp4')
  await expect(page.locator('.help-video-admin video')).toHaveCount(0)
})

test('missing video schema is reported before transferring the file', async ({ page }) => {
  const api = await backend(page, { setupError: true })
  await signIn(page)
  const form = videoForm(page)
  await form.locator('input[type=file]').setInputFiles(video)
  await form.getByRole('button', { name: 'Upload & publish video' }).click()
  await expect(form.getByRole('alert')).toContainText('Video publishing is unavailable')
  expect(api.uploadRequests()).toBe(0)
})

test('invalid and empty files show a useful message', async ({ page }) => {
  await backend(page)
  await signIn(page)
  const form = videoForm(page)
  await form.locator('input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
  await expect(form.getByRole('alert')).toContainText('Please choose an MP4')
  await form.locator('input[type=file]').setInputFiles({ ...video, buffer: Buffer.alloc(0) })
  await expect(form.getByRole('alert')).toContainText('file is empty')
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

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SiteMediaRecord } from '../types'

export const defaultHelpVideo = {
  title: 'How to use Ready Together',
  description: 'A guided tour of your household plan, pantry, meals, and ward tools.',
  url: 'https://drive.google.com/file/d/199KZvSWlzFuu5LmEsGCPycLYD0E7MjGO/view?usp=sharing',
}

export function validateVideoUrl(value: string) {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error()
    return url.href
  } catch {
    throw new Error('Enter a valid HTTPS video link, such as a public Google Drive sharing link.')
  }
}

export function helpVideoDetails(record: SiteMediaRecord | null) {
  // Older records contain Storage paths. Start with the supplied Drive video
  // until an administrator saves an external link in the existing media slot.
  try {
    if (record) return { title: record.title, description: record.description, url: validateVideoUrl(record.file_path) }
  } catch { /* Fall back for legacy Storage paths or invalid URLs. */ }
  return defaultHelpVideo
}

export async function publishHelpVideo(client: SupabaseClient, url: string, title: string, description: string) {
  const videoUrl = validateVideoUrl(url)
  if (!title.trim() || title.trim().length > 160) throw new Error('Enter a video title of 1–160 characters.')
  if (description.trim().length > 500) throw new Error('Keep the description to 500 characters or fewer.')
  const { data: { session }, error: sessionError } = await client.auth.getSession()
  if (sessionError || !session) throw new Error('Please sign in again before saving a video link.')
  // Reuse the existing admin-protected record without requiring a migration.
  // mime_type is legacy metadata required by the table; links are never embedded.
  const record: SiteMediaRecord & { updated_by: string } = {
    slot: 'help-overview', title: title.trim(), description: description.trim() || null,
    file_path: videoUrl, mime_type: 'video/mp4', updated_by: session.user.id, updated_at: new Date().toISOString(),
  }
  const { data, error } = await client.from('site_media').upsert(record, { onConflict: 'slot' }).select('*').single()
  if (error) throw new Error(`Unable to save the video link: ${error.message}`)
  return data as SiteMediaRecord
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { Upload } from 'tus-js-client'
import type { SiteMediaRecord } from '../types'

export function videoContentType(file: Pick<File, 'name' | 'type' | 'size'>) {
  const types: Record<string, SiteMediaRecord['mime_type']> = { mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg', ogv: 'video/ogg' }
  const type = Object.values(types).includes(file.type as SiteMediaRecord['mime_type']) ? file.type as SiteMediaRecord['mime_type']
    : (!file.type || file.type === 'application/octet-stream') ? types[file.name.split('.').pop()?.toLowerCase() ?? ''] : undefined
  if (!type) throw new Error('Please choose an MP4, WebM, or Ogg video.')
  if (!file.size) throw new Error('This video file is empty. Please choose another file.')
  if (file.size > 250 * 1024 * 1024) throw new Error('The guide video must be 250 MB or smaller.')
  return type
}

export async function publishHelpVideo(client: SupabaseClient, projectUrl: string, file: File, title: string, description: string, onProgress: (percent: number) => void) {
  const contentType = videoContentType(file)
  if (!title.trim() || title.trim().length > 160) throw new Error('Enter a video title of 1–160 characters.')
  if (description.trim().length > 500) throw new Error('Keep the description to 500 characters or fewer.')
  const { data: { session }, error: sessionError } = await client.auth.getSession()
  if (sessionError || !session) throw new Error('Please sign in again before uploading a video.')
  // Check the publishing table before transferring a potentially large file.
  const { error: setupError } = await client.from('site_media').select('slot').eq('slot', 'help-overview').maybeSingle()
  if (setupError) throw new Error(`Video publishing is unavailable: ${setupError.message}`)
  const path = `help/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
  const endpoint = new URL(projectUrl)
  if (endpoint.hostname.endsWith('.supabase.co') && !endpoint.hostname.endsWith('.storage.supabase.co')) {
    endpoint.hostname = endpoint.hostname.replace('.supabase.co', '.storage.supabase.co')
  }
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/storage/v1/upload/resumable`
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: endpoint.toString(),
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: 6 * 1024 * 1024,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      storeFingerprintForResuming: false,
      headers: { authorization: `Bearer ${session.access_token}` },
      metadata: { bucketName: 'preparedness-media', objectName: path, contentType, cacheControl: '3600' },
      onBeforeRequest: async (request) => {
        const { data, error } = await client.auth.getSession()
        if (error || !data.session) throw new Error('Your session expired. Sign in again and retry.')
        request.setHeader('authorization', `Bearer ${data.session.access_token}`)
      },
      onProgress: (sent, total) => onProgress(Math.round(sent / total * 100)),
      onError: (error) => reject(new Error(`Video upload failed. Check your connection and storage permissions, then retry. ${error.message}`)),
      onSuccess: () => resolve(),
    })
    upload.start()
  })
  const record: SiteMediaRecord & { updated_by: string } = {
    slot: 'help-overview', title: title.trim(), description: description.trim() || null,
    file_path: path, mime_type: contentType, updated_by: session.user.id, updated_at: new Date().toISOString(),
  }
  const { data, error } = await client.from('site_media').upsert(record, { onConflict: 'slot' }).select('*').single()
  if (error) throw new Error(`The file uploaded, but publishing failed: ${error.message}. Please retry.`)
  return data as SiteMediaRecord
}

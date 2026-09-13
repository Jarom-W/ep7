import { type FormEvent, useRef, useState } from 'react'
import { Loader2, Video } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { helpVideoDetails, publishHelpVideo } from '../lib/helpVideo'
import type { SiteMediaRecord } from '../types'

export default function HelpVideoSettings({ video, onPublished }: { video: SiteMediaRecord | null; onPublished: (video: SiteMediaRecord) => void }) {
  const current = helpVideoDetails(video)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const submitting = useRef(false)

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const form = new FormData(event.currentTarget)
    setFailed(false)
    setMessage('')
    if (!supabase) { setFailed(true); setMessage('Video settings are not connected.'); return }
    submitting.current = true
    setBusy(true)
    try {
      const saved = await publishHelpVideo(supabase, String(form.get('url') ?? ''), String(form.get('title') ?? ''), String(form.get('description') ?? ''))
      onPublished(saved)
      setMessage('Video link saved. It is now available on the Help page.')
    } catch (error) {
      setFailed(true)
      setMessage(error instanceof Error ? error.message : 'Unable to save the video link. Please try again.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return <form className="admin-form" onSubmit={publish} noValidate aria-busy={busy}>
    <h2><Video /> Help video settings</h2>
    <p className="admin-help">The Help page’s play card opens this link in a new tab. For Google Drive, set sharing to “Anyone with the link” so visitors can watch.</p>
    <label><span>Video link</span><input required type="url" name="url" key={current.url} defaultValue={current.url} disabled={busy} /></label>
    <label><span>Video title</span><input required name="title" key={current.title} maxLength={160} defaultValue={current.title} disabled={busy} /></label>
    <label><span>Short description</span><textarea name="description" key={current.description} maxLength={500} rows={3} defaultValue={current.description ?? ''} disabled={busy} /></label>
    {message && <p className={failed ? 'form-error' : 'video-upload-success'} role={failed ? 'alert' : 'status'}>{message}</p>}
    <button type="submit" className="button primary" disabled={busy}>{busy ? <><Loader2 className="spin" size={17} /> Saving…</> : 'Save video link'}</button>
  </form>
}

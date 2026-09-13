import { type FormEvent, useRef, useState } from 'react'
import { Loader2, Video } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { publishHelpVideo, videoContentType } from '../lib/helpVideo'
import type { SiteMediaRecord } from '../types'

export default function HelpVideoUpload({ onPublished }: { onPublished: (video: SiteMediaRecord) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const submitting = useRef(false)

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setFailed(false)
    setMessage('')
    if (!file) { setFailed(true); setMessage('Choose a video file before publishing.'); return }
    if (!supabase) { setFailed(true); setMessage('Video publishing is not connected. Please contact the site administrator.'); return }
    submitting.current = true
    setBusy(true)
    setProgress(0)
    try {
      const video = await publishHelpVideo(supabase, import.meta.env.VITE_SUPABASE_URL, file, String(form.get('title') ?? ''), String(form.get('description') ?? ''), setProgress)
      onPublished(video)
      formElement.reset()
      setFile(null)
      setMessage('Video published successfully. It is now available on the Help page.')
    } catch (error) {
      setFailed(true)
      setMessage(error instanceof Error ? error.message : 'Unable to publish the video. Please try again.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return <form className="admin-form" onSubmit={publish} noValidate aria-busy={busy}>
    <h2><Video /> Publish the Help video</h2>
    <p className="admin-help">This video appears at the top of the Help page. Uploading again replaces the video shown on the site.</p>
    <label><span>Video title</span><input required name="title" maxLength={160} defaultValue="How to use Ready Together" disabled={busy} /></label>
    <label><span>Short description</span><textarea name="description" maxLength={500} rows={3} placeholder="A quick tour of the household plan, pantry, meals, and ward tools." disabled={busy} /></label>
    <label className="file-field"><Video /><span><b>Choose video</b><small>MP4, WebM, or Ogg · up to 250 MB</small></span><input name="file" type="file" accept=".mp4,.webm,.ogg,.ogv,video/mp4,video/webm,video/ogg" disabled={busy} onChange={(event) => {
      const selected = event.target.files?.[0] ?? null
      setFile(null)
      setMessage('')
      setFailed(false)
      if (!selected) return
      try { videoContentType(selected); setFile(selected) }
      catch (error) { setFailed(true); setMessage((error as Error).message); event.target.value = '' }
    }} /></label>
    {file && <p className="admin-help">Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>}
    {busy && <div className="video-upload-progress" role="status"><progress aria-label="Video upload progress" max={100} value={progress} /><span>{progress < 100 ? `Uploading video… ${progress}%` : 'Upload complete. Publishing video…'} Keep this page open.</span></div>}
    {message && <p className={failed ? 'form-error' : 'video-upload-success'} role={failed ? 'alert' : 'status'}>{message}</p>}
    <button type="submit" className="button primary" disabled={busy}>{busy ? <><Loader2 className="spin" size={17} /> {progress < 100 ? `Uploading… ${progress}%` : 'Publishing…'}</> : 'Upload & publish video'}</button>
  </form>
}

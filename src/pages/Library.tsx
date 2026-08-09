import { useEffect, useState } from 'react'
import { CalendarDays, Download, ExternalLink, FileText, Newspaper } from 'lucide-react'
import type { DocumentRecord } from '../types'
import { isSupabaseConfigured, publicDocumentUrl, supabase } from '../lib/supabase'

export default function Library() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.from('documents').select('*').order('published_at', { ascending: false }).then(({ data }) => {
      setDocuments((data as DocumentRecord[]) ?? [])
      setLoading(false)
    })
  }, [])

  const plan = documents.find((document) => document.kind === 'plan')
  const newsletters = documents.filter((document) => document.kind === 'newsletter')

  return (
    <div className="page-width interior-page">
      <div className="page-heading">
        <span className="eyebrow">Ward resources</span><h1>Newsletters & emergency plan</h1>
        <p>Read the latest preparedness guidance and keep a copy of the standing ward plan.</p>
      </div>
      {!isSupabaseConfigured && <div className="notice"><b>Preview mode</b><span>Connect Supabase to publish newsletters and the ward plan.</span></div>}
      <section className="document-feature">
        <div className="document-icon"><FileText /></div>
        <div><span className="document-type">Standing document</span><h2>{plan?.title ?? 'Ward emergency plan'}</h2><p>{plan?.description ?? 'The current plan will appear here after the emergency preparedness specialist publishes it.'}</p></div>
        {plan ? <a className="button primary" href={publicDocumentUrl(plan.file_path)} target="_blank" rel="noreferrer">View plan <ExternalLink size={17} /></a> : <button className="button primary" disabled>Coming soon</button>}
      </section>
      <section className="newsletter-section">
        <div className="section-heading inline"><div><span className="eyebrow">Monthly preparedness</span><h2>Newsletter archive</h2></div><Newspaper size={30} /></div>
        {loading ? <div className="empty-state">Loading publications…</div> : newsletters.length ? (
          <div className="document-list">{newsletters.map((item, index) => (
            <article className="document-row" key={item.id}>
              <div className="issue-number">{String(newsletters.length - index).padStart(2, '0')}</div>
              <div><h3>{item.title}</h3><p>{item.description || 'Monthly emergency preparedness newsletter'}</p><span><CalendarDays size={14} /> {new Date(item.published_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span></div>
              <a className="icon-button" aria-label={`Open ${item.title}`} href={publicDocumentUrl(item.file_path)} target="_blank" rel="noreferrer"><Download /></a>
            </article>
          ))}</div>
        ) : <div className="empty-state"><Newspaper size={34} /><h3>No newsletters published yet</h3><p>The specialist can upload the first PDF from the admin area.</p></div>}
      </section>
    </div>
  )
}

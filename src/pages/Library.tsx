import { useEffect, useState } from 'react'
import { CalendarDays, ChevronDown, Download, FileText, Newspaper } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import type { DocumentRecord } from '../types'
import { isSupabaseConfigured, publicDocumentUrl, supabase } from '../lib/supabase'
import WardDashboard from './Home'

export default function Library() {
  const location = useLocation()
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNewsletterId, setSelectedNewsletterId] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.from('documents').select('*').order('published_at', { ascending: false }).then(({ data }) => {
      setDocuments((data as DocumentRecord[]) ?? [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const targetId = location.hash.slice(1)
    if (!targetId) return
    const frame = window.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ block: 'start' }))
    return () => window.cancelAnimationFrame(frame)
  }, [location.hash])

  const plan = documents.find((document) => document.kind === 'plan')
  const newsletters = documents.filter((document) => document.kind === 'newsletter')
  const selectedNewsletter = newsletters.find((document) => document.id === selectedNewsletterId) ?? newsletters[0]

  return (
    <div className="page-width interior-page ward-hub-page">
      <div className="page-heading">
        <span className="eyebrow">Ward resources & progress</span><h1>News, plan & preparedness dashboard</h1>
        <p>Read the latest guidance, keep the standing ward plan nearby, and see privacy-protected preparedness progress in one place.</p>
      </div>
      <div className="ward-hub-grid">
        <div className="ward-hub-library">
          {!isSupabaseConfigured && <div className="notice"><b>Preview mode</b><span>Connect Supabase to publish newsletters and the ward plan.</span></div>}
          <section id="ward-plan" className="embedded-document-section">
            <div className="document-feature">
              <div className="document-icon"><FileText /></div>
              <div><span className="document-type">Standing document</span><h2>{plan?.title ?? 'Ward emergency plan'}</h2><p>{plan?.description ?? 'The current plan will appear here after the emergency preparedness specialist publishes it.'}</p></div>
              {plan ? <a className="button primary" href={publicDocumentUrl(plan.file_path)} download>Download a copy <Download size={17} /></a> : <button className="button primary" disabled>Coming soon</button>}
            </div>
            {plan && <PdfReader document={plan} />}
          </section>
          <section id="ward-news" className="newsletter-section">
            <div className="section-heading inline"><div><span className="eyebrow">Monthly preparedness</span><h2>Newsletter archive</h2></div><Newspaper size={30} /></div>
            {loading ? <div className="empty-state">Loading publications…</div> : newsletters.length ? (
              <div className="document-list">{newsletters.map((item, index) => {
                const isSelected = selectedNewsletter?.id === item.id
                return <div className={isSelected ? 'newsletter-reader-row selected' : 'newsletter-reader-row'} key={item.id}>
                  <article className="document-row">
                    <div className="issue-number">{String(newsletters.length - index).padStart(2, '0')}</div>
                    <div><h3>{item.title}</h3><p>{item.description || 'Monthly emergency preparedness newsletter'}</p><span><CalendarDays size={14} /> {new Date(item.published_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span></div>
                    <button type="button" className="read-document-button" aria-expanded={isSelected} aria-label={`Read ${item.title} on this page`} onClick={() => setSelectedNewsletterId(item.id)}><span>{isSelected ? 'Reading' : 'Read here'}</span><ChevronDown /></button>
                  </article>
                  {isSelected && <PdfReader document={item} />}
                </div>
              })}</div>
            ) : <div className="empty-state"><Newspaper size={34} /><h3>No newsletters published yet</h3><p>The specialist can upload the first PDF from the admin area.</p></div>}
          </section>
        </div>
        <WardDashboard embedded />
      </div>
    </div>
  )
}

function PdfReader({ document }: { document: DocumentRecord }) {
  const url = publicDocumentUrl(document.file_path)
  return <div className="pdf-reader">
    <iframe title={`${document.title} PDF reader`} src={`${url}#view=FitH&toolbar=1&navpanes=0`} loading="lazy" />
    <div><span>If the document does not appear in your browser, you can keep a copy on your device.</span><a href={url} download><Download /> Download PDF</a></div>
  </div>
}

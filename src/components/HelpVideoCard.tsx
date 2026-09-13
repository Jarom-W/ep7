import { ArrowUpRight, Play, ShieldCheck } from 'lucide-react'
import { helpVideoDetails } from '../lib/helpVideo'
import type { SiteMediaRecord } from '../types'

export default function HelpVideoCard({ video }: { video: SiteMediaRecord | null }) {
  const { title, description, url } = helpVideoDetails(video)
  return <a className="help-video-card" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${title} (opens in a new tab)`}>
    <div className="help-video-poster" aria-hidden="true">
      <span className="help-video-brand"><ShieldCheck /> READY TOGETHER</span>
      <span className="help-video-play"><Play fill="currentColor" /></span>
      <span className="help-video-caption">A little guidance. A more prepared home.</span>
      <span className="help-video-controls"><Play fill="currentColor" /><span /><ArrowUpRight /></span>
    </div>
    <div className="help-video-copy"><span className="eyebrow">Video walkthrough</span><h2>{title}</h2>{description && <p>{description}</p>}<span className="help-video-action">Watch the walkthrough <ArrowUpRight /><small>Opens in a new tab</small></span></div>
  </a>
}

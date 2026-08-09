import { ArrowRight, BookOpen, ClipboardCheck, Droplets, FileText, MapPinned, Utensils } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <>
      <section className="hero page-width">
        <div className="hero-copy">
          <span className="eyebrow">Prepared together</span>
          <h1>Small steps today.<br /><em>More peace tomorrow.</em></h1>
          <p>Build a realistic household plan, make the most of what’s already in your pantry, and know who to contact when neighbors need one another.</p>
          <div className="button-row">
            <Link className="button primary" to="/planner">Start my household plan <ArrowRight size={18} /></Link>
            <Link className="button secondary" to="/library">Read this month’s update</Link>
          </div>
        </div>
        <div className="hero-card" aria-label="Preparedness priorities">
          <div className="hero-card-top"><span>Start with the basics</span><strong>01</strong></div>
          <div className="priority"><Droplets /><div><b>Water</b><small>Know your daily minimum</small></div></div>
          <div className="priority"><Utensils /><div><b>Food</b><small>Plan familiar, shelf-stable meals</small></div></div>
          <div className="priority"><MapPinned /><div><b>Neighbors</b><small>Connect with your block captain</small></div></div>
        </div>
      </section>

      <section className="quick-start page-width">
        <div className="section-heading"><span className="eyebrow">Your preparedness hub</span><h2>What would help today?</h2></div>
        <div className="feature-grid">
          <Link to="/planner" className="feature-card feature-green"><ClipboardCheck /><span>Personal tool</span><h3>Household planner</h3><p>Estimate food and water needs and track what you have on hand.</p><b>Build a plan <ArrowRight size={16} /></b></Link>
          <Link to="/recipes" className="feature-card"><BookOpen /><span>Pantry ideas</span><h3>Emergency-friendly meals</h3><p>See what your inventory can make and what you still need.</p><b>Browse meals <ArrowRight size={16} /></b></Link>
          <Link to="/block-map" className="feature-card"><MapPinned /><span>Neighborhood</span><h3>Block captain map</h3><p>Find your ward block and the captain assigned to your area.</p><b>Open the map <ArrowRight size={16} /></b></Link>
        </div>
      </section>

      <section className="preparedness-callout">
        <div className="page-width callout-inner">
          <FileText size={36} />
          <div><span className="eyebrow light">Current resources</span><h2>Know the ward emergency plan</h2><p>Review gathering points, communication guidance, and ward response roles before an emergency.</p></div>
          <Link className="button light-button" to="/library">Open the plan <ArrowRight size={18} /></Link>
        </div>
      </section>
    </>
  )
}

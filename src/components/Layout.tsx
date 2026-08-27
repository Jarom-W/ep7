import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { BookOpen, Bug, CircleHelp, ClipboardList, FileText, Home, Map, Menu, ShieldCheck, UserRound, X } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

const nav = [
  { to: '/', label: 'Start here', icon: Home },
  { to: '/library', label: 'News & plan', icon: FileText },
  { to: '/planner', label: 'My preparedness', icon: ClipboardList },
  { to: '/recipes', label: 'Pantry meals', icon: BookOpen },
  { to: '/block-map', label: 'Block map', icon: Map },
  { to: '/help', label: 'Help', icon: CircleHelp },
]

export default function Layout() {
  const [open, setOpen] = useState(false)
  const { session } = useAuth()

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark"><ShieldCheck size={24} /></span>
          <span><strong>Ready Together</strong><small>Spanish Fork 7th Ward</small></span>
        </Link>
        <button className="menu-button" aria-label="Toggle navigation" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
        <nav className={open ? 'main-nav open' : 'main-nav'} aria-label="Main navigation">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}>
              <Icon size={17} /> {label}
            </NavLink>
          ))}
          <NavLink to="/account" onClick={() => setOpen(false)}><UserRound size={17} /> {session ? 'My account' : 'Sign in'}</NavLink>
        </nav>
      </header>
      <main id="main"><Outlet /></main>
      <Link className="feedback-fab" to="/feedback"><Bug size={17} /> <span>Report a bug or idea</span></Link>
      <footer>
        <div>
          <strong>Ready Together</strong>
          <p>A practical preparedness resource for neighbors in the Spanish Fork 7th Ward.</p>
        </div>
        <div className="footer-links">
          <Link to="/library">Emergency plan</Link>
          <Link to="/block-map">Find your block</Link>
          <Link to="/help"><CircleHelp size={14} /> How to use the site</Link>
          <Link to="/feedback"><Bug size={14} /> Report a bug or idea</Link>
          <Link to="/specialist">Specialist sign in</Link>
        </div>
        <p className="fine-print">This independent ward resource is not an official website of The Church of Jesus Christ of Latter-day Saints. Nutrition and water figures are planning estimates; adjust for medical needs, climate, and activity.</p>
      </footer>
    </div>
  )
}

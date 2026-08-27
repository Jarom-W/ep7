import { useEffect } from 'react'
import { ArrowRight, BookOpen, Check, CircleHelp, ClipboardList, Heart, LockKeyhole, Map, PackagePlus, ShieldCheck, Sparkles, UserPlus, Users, Utensils } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function Welcome() {
  const { session } = useAuth()

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>('[data-reveal]')
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.target.classList.toggle('in-view', entry.isIntersecting)), { threshold: .2, rootMargin: '-5% 0px -8%' })
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  return <div className="welcome-page">
    <section className="welcome-hero page-width">
      <div className="welcome-hero-copy" data-reveal><span className="eyebrow">Preparedness built around your family</span><h1>Make a plan you’ll actually want to use.</h1><p>Turn the food your family enjoys, the supplies you already own, and the neighbors you know into one private, practical emergency plan.</p><div className="button-row"><Link className="button primary" to={session ? '/planner' : '/account?mode=signup'}>{session ? 'Open my plan' : 'Create my private plan'} <ArrowRight /></Link><Link className="button secondary" to={session ? '/dashboard' : '/account'}>{session ? 'View ward dashboard' : 'Sign in'}</Link><Link className="button help-button" to="/help"><CircleHelp /> Show me how it works</Link></div><div className="welcome-trust"><ShieldCheck /><span><b>Your pantry stays private.</b> Only anonymous totals contribute to the ward dashboard.</span></div></div>
      <div className="welcome-hero-scene" data-reveal>
        <div className="scene-card pantry-scene"><span>My pantry</span><strong>12.4 days</strong><div><i style={{ width: '76%' }} /></div><small>Rice · beans · favorite meals · water</small></div>
        <div className="scene-card meal-scene"><Heart /><span>Meal wishlist</span><b>6 family favorites</b><small>One combined shopping list</small></div>
        <div className="scene-card block-scene"><Map /><span>My block</span><b>People, not pins</b><small>A private directory for real coordination</small></div>
      </div>
    </section>

    <section className="welcome-path">
      <div className="page-width welcome-section-heading" data-reveal><span className="eyebrow">A calm place to begin</span><h2>Start with what you know. Build from there.</h2><p>You do not need a perfect plan on day one. The site guides you through a few useful choices and saves your place.</p></div>
      <div className="page-width welcome-steps">
        <article data-reveal><div className="step-number">01</div><UserPlus /><h3>Create your household</h3><p>Add your address, block, and household ages. Your account unlocks the private map and keeps every plan synced.</p><Link to="/account?mode=signup">Create an account <ArrowRight /></Link></article>
        <article data-reveal><div className="step-number">02</div><PackagePlus /><h3>Make the pantry yours</h3><p>Use the starter supplies or add the exact grains, proteins, fruit, packages, and calorie information your family buys.</p><Link to="/planner">Build my pantry <ArrowRight /></Link></article>
        <article data-reveal><div className="step-number">03</div><Utensils /><h3>Plan food you enjoy</h3><p>Create familiar pantry meals, choose how many you want, and see the combined quantities still needed.</p><Link to="/recipes">Explore meals <ArrowRight /></Link></article>
      </div>
    </section>

    <section className="welcome-feature page-width" data-reveal>
      <div className="feature-mock pantry-mock"><div className="mock-toolbar"><span>My supplies</span><button><PackagePlus /> Add ingredient</button></div><div className="mock-grid"><div><small>GRAINS</small><b>White rice</b><span>4 cups</span></div><div><small>PROTEIN</small><b>Black beans</b><span>8 cans</span></div><div className="custom"><small>MY INGREDIENT</small><b>Family granola</b><span>3 bags</span></div><div><small>WATER</small><b>Stored water</b><span>21 gallons</span></div></div></div>
      <div className="welcome-feature-copy"><span className="eyebrow">Private by design</span><h2>Your food is personal. Your plan should be too.</h2><p>Custom ingredients, meals, quantities, and wishlists live under your family account. Other households cannot inspect what you eat or what you have stored.</p><ul><li><Check /> Add any ingredient and its real package unit</li><li><Check /> Create meals from your own ingredients</li><li><Check /> Combine wishlist quantities automatically</li></ul></div>
    </section>

    <section className="welcome-feature reverse page-width" data-reveal>
      <div className="feature-mock map-mock"><div className="mock-map-block"><span>A</span>{Array.from({ length: 11 }, (_, index) => <i key={index} style={{ left: `${10 + (index % 4) * 23}%`, top: `${12 + Math.floor(index / 4) * 29}%` }} />)}</div><aside><small>SELECTED HOUSEHOLD</small><b>475 N</b><div><Users /> Family directory</div><div><LockKeyhole /> Protected needs</div></aside></div>
      <div className="welcome-feature-copy"><span className="eyebrow">Know the people nearby</span><h2>A useful map without giving away private needs.</h2><p>Signed-in ward families can find addresses and family names. Needs and special circumstances remain limited to the household, the specialist, and explicitly authorized ministering assignments.</p><Link className="text-link" to="/block-map">Open the private map <ArrowRight /></Link></div>
    </section>

    <section className="welcome-resources"><div className="page-width" data-reveal><span className="eyebrow">Keep going when you are ready</span><h2>Plans, news, meals, and ward-level progress live together.</h2><div className="resource-link-grid"><Link to="/library"><BookOpen /><b>Emergency plan & news</b><span>Know what to expect</span></Link><Link to="/planner"><ClipboardList /><b>My preparedness</b><span>Supplies, water, and meals</span></Link><Link to="/dashboard"><Sparkles /><b>Ward dashboard</b><span>Anonymous progress only</span></Link></div></div></section>

    <section className="welcome-cta page-width" data-reveal><div><span className="eyebrow">Your next useful step</span><h2>{session ? 'Pick up where your family left off.' : 'Create a plan that feels like yours.'}</h2><p>A few minutes now can make the first hours of an emergency much calmer.</p></div><Link className="button primary" to={session ? '/planner' : '/account?mode=signup'}>{session ? 'Open my household plan' : 'Create my account'} <ArrowRight /></Link></section>
  </div>
}

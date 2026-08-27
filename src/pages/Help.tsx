import { useEffect } from 'react'
import { ArrowRight, BookOpen, Bug, CheckCircle2, CircleHelp, Cloud, FileText, Heart, ListChecks, LockKeyhole, Map, MousePointer2, PackagePlus, ShieldCheck, Sparkles, UserPlus, Utensils } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

const chapters = [
  { id: 'quick-start', label: 'Quick start' },
  { id: 'account', label: 'Account & privacy' },
  { id: 'pantry', label: 'Household & pantry' },
  { id: 'meals', label: 'Recipes & wishlist' },
  { id: 'ward', label: 'Ward tools' },
  { id: 'troubleshooting', label: 'Common questions' },
]

export default function Help() {
  const { session } = useAuth()

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>('[data-help-reveal]')
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.target.classList.toggle('in-view', entry.isIntersecting)), { threshold: .14, rootMargin: '-4% 0px -10%' })
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  return <div className="help-page">
    <section className="help-hero">
      <div className="page-width help-hero-grid">
        <div className="help-hero-copy" data-help-reveal><span className="eyebrow">Ready Together field guide</span><h1>From first click to a family-ready plan.</h1><p>This guide explains what every part of the site does, what information is private, and the simplest path from an empty pantry list to an actionable preparedness plan.</p><div className="button-row"><Link className="button primary" to={session ? '/planner' : '/account?mode=signup'}>{session ? 'Continue my plan' : 'Start with an account'} <ArrowRight /></Link><a className="button secondary" href="#quick-start">Read the guide</a></div></div>
        <div className="help-journey" aria-label="Animated overview of the four planning stages" data-help-reveal>
          <div className="journey-line"><i /></div>
          <div className="journey-step active"><UserPlus /><span>Household</span><b>1</b></div>
          <div className="journey-step"><PackagePlus /><span>Pantry</span><b>2</b></div>
          <div className="journey-step"><Utensils /><span>Meals</span><b>3</b></div>
          <div className="journey-step"><Sparkles /><span>Plan</span><b>4</b></div>
          <div className="journey-cursor"><MousePointer2 /></div>
          <p><CheckCircle2 /> Progress saves as you go</p>
        </div>
      </div>
    </section>

    <div className="page-width help-layout">
      <aside className="help-toc" aria-label="Help topics"><span>In this guide</span>{chapters.map((chapter) => <a key={chapter.id} href={`#${chapter.id}`}>{chapter.label}</a>)}<Link to="/feedback"><Bug /> Still need help?</Link></aside>
      <div className="help-content">
        <section id="quick-start" className="help-chapter" data-help-reveal>
          <div className="chapter-heading"><span>01</span><div><small>Ten-minute setup</small><h2>The shortest path to a useful plan</h2></div></div>
          <p className="chapter-lede">You do not need to finish the whole site at once. These four actions create a practical starting point, and you can refine every number later.</p>
          <ol className="help-step-list">
            <li><span>1</span><div><b>Create your family account.</b><p>Enter your full grid address and the site will suggest your ward block from the mapped streets and homes. You can correct the suggestion before creating the account.</p></div><Link to="/account?mode=signup">Account <ArrowRight /></Link></li>
            <li><span>2</span><div><b>Add household ages and stored water.</b><p>Ages create a planning estimate for daily calories and water. The result is a starting point, not a medical prescription.</p></div><Link to="/planner">My preparedness <ArrowRight /></Link></li>
            <li><span>3</span><div><b>Record the foods already on your shelves.</b><p>Use the plus and minus controls for built-in ingredients. Choose “Add an Ingredient” when your food is not in the starter catalog.</p></div><Link to="/planner">Open pantry <ArrowRight /></Link></li>
            <li><span>4</span><div><b>Choose meals and build the combined list.</b><p>Add recipe batches to the meal wishlist. The site combines duplicate ingredients and subtracts what you already have.</p></div><Link to="/recipes">Browse meals <ArrowRight /></Link></li>
          </ol>
          <div className="help-callout"><ListChecks /><div><b>A good first finish line</b><p>Aim for three days of water, three familiar meals, and one written list of what is missing. Then work toward seven and fourteen days over time.</p></div></div>
        </section>

        <section id="account" className="help-chapter" data-help-reveal>
          <div className="chapter-heading"><span>02</span><div><small>Account & privacy</small><h2>What syncs, and who can see it</h2></div></div>
          <div className="help-card-grid">
            <article><Cloud /><h3>Your family workspace</h3><p>When signed in, household ages, pantry quantities, water, custom ingredients, custom recipes, and the meal wishlist sync to your private family record. The account page also lets you update your display name, address, block, and password.</p></article>
            <article><LockKeyhole /><h3>Private by default</h3><p>Other families cannot browse your inventory or meal plan. Row-level database rules limit those records to the signed-in owner. Your address is used to connect your account to the private ward directory.</p></article>
            <article><ShieldCheck /><h3>Anonymous ward totals</h3><p>The dashboard receives calculated totals rather than household records. Detailed preparedness numbers remain hidden until at least three households participate, reducing the chance that one family can be inferred.</p></article>
          </div>
          <div className="help-note"><b>Using the site without an account:</b> the planner works in the current browser and saves locally. It will not follow you to another device, and the private block directory remains locked.</div>
        </section>

        <section id="pantry" className="help-chapter" data-help-reveal>
          <div className="chapter-heading"><span>03</span><div><small>Household & pantry</small><h2>Build an honest picture of what you have</h2></div></div>
          <div className="help-split">
            <div><h3>Household estimates</h3><p>Add one row for each person and enter their age. The planner uses age bands to estimate daily food energy and minimum drinking/cooking water. Use the stored-water control in gallons or liters; coverage updates automatically.</p><p>Increase the estimate for heat, physical work, pets, pregnancy, nursing, illness, sanitation, or instructions from a health professional.</p></div>
            <div className="help-mini-demo water-demo"><span>Stored water</span><strong>21.0 <small>gallons</small></strong><div><i /></div><small>7.0 estimated days</small></div>
          </div>
          <div className="help-split reverse">
            <div><h3>Ingredients and quantities</h3><p>Filter the catalog by category, then use the round plus and minus buttons. Each quantity uses the unit printed on the card—such as a can, box, cup, jar, or package—so check the label before entering a count.</p><p>For a custom ingredient, copy the calories per tracking unit from its nutrition label. That estimate powers the pantry coverage calculation.</p></div>
            <div className="help-mini-demo pantry-demo"><span>PROTEIN · CUSTOM</span><b>Family lentil mix</b><small>1,240 cal per bag</small><div><button>−</button><strong>3</strong><button>+</button></div></div>
          </div>
        </section>

        <section id="meals" className="help-chapter" data-help-reveal>
          <div className="chapter-heading"><span>04</span><div><small>Recipes & wishlist</small><h2>Plan food your family will actually eat</h2></div></div>
          <div className="help-card-grid two">
            <article><Utensils /><h3>Read a recipe card</h3><p>The visible ingredient glimpse tells you what the meal uses before you open “What’s still needed.” “Batches ready” counts complete recipe batches. “Household meals” divides the resulting servings across the number of people in your plan.</p></article>
            <article><BookOpen /><h3>Create a family recipe</h3><p>Enter a name, optional tags, servings, preparation time, and directions. Search inside “Ingredient for one batch,” enter only the amounts the recipe uses, and save. Custom meals stay private to your browser or family account.</p></article>
            <article><Heart /><h3>Use the meal wishlist</h3><p>Add a meal, then adjust its planned batch count with the stepper. The combined list totals every recipe requirement, compares it with pantry quantities, and marks each ingredient as stocked or still needed.</p></article>
            <article><FileText /><h3>Use Pantry meals for cooking</h3><p>The Pantry meals tab offers filters, search, batch scaling, ingredient shortages, directions, and a safety note. Selecting a card opens the full cooking view without changing pantry counts.</p></article>
          </div>
        </section>

        <section id="ward" className="help-chapter" data-help-reveal>
          <div className="chapter-heading"><span>05</span><div><small>Ward tools</small><h2>Coordinate without exposing a family’s pantry</h2></div></div>
          <div className="help-card-grid">
            <article><Sparkles /><h3>Ward dashboard</h3><p>News, the emergency plan, and the dashboard now share one ward resources page. The dashboard shows privacy-safe participation, food and water milestones, readiness trends, and block-level signals.</p><Link to="/library#ward-dashboard">Open dashboard <ArrowRight /></Link></article>
            <article><Map /><h3>Block map</h3><p>Signed-in ward families can open a block and find directory households that have been approved for display. Sensitive needs remain limited to the household, specialist, and explicitly authorized ministering assignments.</p><Link to="/block-map">Open map <ArrowRight /></Link></article>
            <article><FileText /><h3>News & emergency plan</h3><p>The latest standing emergency plan and ward newsletters appear in the left column beside the live dashboard. Shared content is published by the specialist.</p><Link to="/library#ward-plan">Open ward resources <ArrowRight /></Link></article>
          </div>
        </section>

        <section id="troubleshooting" className="help-chapter" data-help-reveal>
          <div className="chapter-heading"><span>06</span><div><small>Common questions</small><h2>When something does not look right</h2></div></div>
          <div className="help-faq">
            <details><summary>Why did my pantry disappear on another device?<CircleHelp /></summary><p>Browser-only plans stay on the device where they were created. Sign in on the original device first so the local plan can seed your cloud workspace, then use the same account elsewhere.</p></details>
            <details><summary>Why does a recipe say zero batches ready?<CircleHelp /></summary><p>At least one required ingredient is below the amount needed for a full batch. Open “What’s still needed” to find the limiting ingredient and its unit.</p></details>
            <details><summary>Why is a ward dashboard number hidden?<CircleHelp /></summary><p>Preparedness totals are withheld until the privacy threshold is met. This is intentional and keeps the first participating households from being easy to identify.</p></details>
            <details><summary>What if my address does not match the map?<CircleHelp /></summary><p>Enter both parts of the grid address, such as “469 N 900 E.” The account form suggests a block once the match is clear, but the block menu always remains available for correction. If no suggestion fits, select the block manually and report the address so the map can be checked.</p></details>
            <details><summary>How do I report a mistake or suggest an improvement?<CircleHelp /></summary><p>Use the rust-colored “Report a bug or idea” button at the bottom-right of any page. Include what you expected, what happened, and the page you were using.</p></details>
          </div>
          <div className="help-final-cta"><div><Bug /><span><b>Still stuck?</b><small>Send enough detail to reproduce the problem.</small></span></div><Link className="button primary" to="/feedback">Report a bug or idea</Link></div>
        </section>
      </div>
    </div>
  </div>
}

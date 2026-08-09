import { useMemo, useState } from 'react'
import { Check, Clock3, Search, Users } from 'lucide-react'
import { ingredients, recipes } from '../data/recipes'
import { useLocalStorage } from '../lib/useLocalStorage'
import { recipeCapacity, recipeProgress } from '../lib/planner'
import type { InventoryItem } from '../types'

const filters = ['All', 'Gluten free', 'Dairy free', 'One pot', 'No cook', 'Breakfast']

export default function Recipes() {
  const [inventory] = useLocalStorage<InventoryItem[]>('ep7-inventory', [])
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(recipes[0]!)
  const [targetBatches, setTargetBatches] = useState(1)
  const visible = useMemo(() => recipes.filter((recipe) => (filter === 'All' || recipe.tags.includes(filter)) && recipe.name.toLowerCase().includes(query.toLowerCase())), [filter, query])

  return <div className="page-width interior-page recipe-page">
    <div className="page-heading"><span className="eyebrow">Familiar food, resilient pantry</span><h1>Emergency-friendly meals</h1><p>Simple meals chosen for shelf-stable ingredients, minimal fuel, and family-friendly flavors.</p></div>
    <div className="recipe-toolbar"><label className="search"><Search /><input placeholder="Search meals" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="filter-row">{filters.map((item) => <button className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div></div>
    <div className="recipe-layout">
      <div className="recipe-list">{visible.map((recipe) => {
        const progress = recipeProgress(recipe, inventory)
        return <button key={recipe.id} className={selected.id === recipe.id ? 'recipe-card selected' : 'recipe-card'} onClick={() => setSelected(recipe)}>
          <div className="recipe-card-top"><span>{recipe.tags[0]}</span>{recipeCapacity(recipe, inventory) > 0 && <i><Check size={12} /> Ready</i>}</div>
          <h2>{recipe.name}</h2><p>{recipe.description}</p>
          <div className="recipe-meta"><span><Clock3 /> {recipe.minutes} min</span><span><Users /> {recipe.servings}</span><b>{progress}% stocked</b></div>
          <div className="progress"><i style={{ width: `${progress}%` }} /></div>
        </button>
      })}</div>
      <aside className="recipe-detail">
        <span className="eyebrow">Recipe details</span><h2>{selected.name}</h2><p>{selected.description}</p>
        <div className="tag-row">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        <div className="batch-target"><label><span>Plan batches</span><input type="number" min="1" max="100" value={targetBatches} onChange={(event) => setTargetBatches(Math.max(1, Number(event.target.value)))} /></label><strong>{targetBatches * selected.servings}<small> total servings</small></strong></div>
        <h3>Supplies for {targetBatches} {targetBatches === 1 ? 'batch' : 'batches'}</h3>
        <ul className="ingredient-list">{selected.ingredients.map((item) => {
          const ingredient = ingredients.find((entry) => entry.id === item.ingredientId)!
          const owned = inventory.find((entry) => entry.ingredientId === item.ingredientId)?.quantity ?? 0
          const required = item.amount * targetBatches
          return <li key={item.ingredientId}><span>{ingredient.name}<small>{owned >= required ? 'Enough in your pantry' : `${Math.max(0, required - owned).toFixed(1)} more needed`}</small></span><b>{Number(required.toFixed(2))} {ingredient.unit}</b></li>
        })}</ul>
        <h3>Directions</h3><ol>{selected.instructions.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol>
        <p className="recipe-safety"><b>Safety note:</b> Use safe water, observe food allergy needs, and refrigerate leftovers within two hours when refrigeration is available.</p>
      </aside>
    </div>
  </div>
}

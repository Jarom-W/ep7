import { useMemo, useState } from 'react'
import { ChevronDown, Droplets, Info, Minus, PackagePlus, Plus, RotateCcw, Users, Utensils } from 'lucide-react'
import { ingredients, recipes } from '../data/recipes'
import { householdNeeds, inventoryCalories, litersPerGallon, recipeCapacity, recipeProgress } from '../lib/planner'
import { useLocalStorage } from '../lib/useLocalStorage'
import type { HouseholdMember, InventoryItem } from '../types'

const initialMembers: HouseholdMember[] = [{ id: 'member-1', age: 35 }]

export default function Planner() {
  const [members, setMembers] = useLocalStorage<HouseholdMember[]>('ep7-members', initialMembers)
  const [inventory, setInventory] = useLocalStorage<InventoryItem[]>('ep7-inventory', [])
  const [waterLiters, setWaterLiters] = useLocalStorage<number>('ep7-water', 0)
  const [waterUnit, setWaterUnit] = useLocalStorage<'gallons' | 'liters'>('ep7-water-unit', 'gallons')
  const [category, setCategory] = useState('All')

  const needs = useMemo(() => householdNeeds(members), [members])
  const calories = useMemo(() => inventoryCalories(inventory, ingredients), [inventory])
  const foodDays = needs.calories ? calories / needs.calories : 0
  const waterDays = needs.waterLiters ? waterLiters / needs.waterLiters : 0
  const categories = ['All', ...new Set(ingredients.map((item) => item.category))]

  function changeInventory(ingredientId: string, amount: number) {
    setInventory((current) => {
      const match = current.find((item) => item.ingredientId === ingredientId)
      const quantity = Math.max(0, (match?.quantity ?? 0) + amount)
      return match
        ? current.map((item) => item.ingredientId === ingredientId ? { ...item, quantity } : item)
        : [...current, { ingredientId, quantity }]
    })
  }

  function changeWater(value: number) {
    const liters = waterUnit === 'gallons' ? value * litersPerGallon : value
    setWaterLiters(Math.max(0, liters))
  }

  return (
    <div className="page-width interior-page planner-page">
      <div className="page-heading split-heading">
        <div><span className="eyebrow">Private to this device</span><h1>My household plan</h1><p>Set your household, add what you have, and turn your pantry into a practical meal plan.</p></div>
        <button className="text-button" onClick={() => { setInventory([]); setWaterLiters(0) }}><RotateCcw size={15} /> Reset supplies</button>
      </div>

      <section className="planner-summary">
        <div className="summary-household">
          <div className="summary-title"><Users /><div><span>Household</span><strong>{members.length} {members.length === 1 ? 'person' : 'people'}</strong></div></div>
          <div className="members-list">{members.map((member, index) => (
            <label key={member.id}><span>Person {index + 1} age</span><input type="number" min="0" max="110" value={member.age} onChange={(event) => setMembers(members.map((item) => item.id === member.id ? { ...item, age: Number(event.target.value) } : item))} />
              {members.length > 1 && <button aria-label="Remove person" onClick={() => setMembers(members.filter((item) => item.id !== member.id))}><Minus size={14} /></button>}
            </label>
          ))}</div>
          <button className="add-person" onClick={() => setMembers([...members, { id: crypto.randomUUID(), age: 18 }])}><Plus size={16} /> Add household member</button>
        </div>
        <div className="need-card food"><Utensils /><span>Estimated daily food need</span><strong>{needs.calories.toLocaleString()}</strong><small>calories / day</small></div>
        <div className="need-card water"><Droplets /><span>Estimated daily water minimum</span><strong>{(needs.waterLiters / litersPerGallon).toFixed(1)}</strong><small>gallons / day</small></div>
      </section>

      <div className="guidance-note"><Info size={18} /><p>Planning estimates use age-based calorie ranges and a conservative drinking/cooking water minimum. Store more for hot weather, sanitation, pets, pregnancy, nursing, illness, or strenuous activity.</p></div>

      <section className="supply-section">
        <div className="section-heading inline"><div><span className="eyebrow">Step 1</span><h2>Add your supplies</h2></div><PackagePlus size={30} /></div>
        <div className="water-entry-card">
          <div><Droplets /><span><b>Stored water</b><small>Include sealed bottles and containers</small></span></div>
          <div className="water-control"><input aria-label="Stored water" type="number" min="0" step="0.5" value={Number((waterUnit === 'gallons' ? waterLiters / litersPerGallon : waterLiters).toFixed(2))} onChange={(event) => changeWater(Number(event.target.value))} /><select value={waterUnit} onChange={(event) => setWaterUnit(event.target.value as 'gallons' | 'liters')}><option value="gallons">gallons</option><option value="liters">liters</option></select></div>
          <strong>{waterDays.toFixed(1)} <small>days</small></strong>
        </div>
        <div className="category-tabs" aria-label="Inventory categories">{categories.map((item) => <button className={category === item ? 'active' : ''} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="inventory-grid">{ingredients.filter((item) => category === 'All' || item.category === category).map((item) => {
          const quantity = inventory.find((entry) => entry.ingredientId === item.id)?.quantity ?? 0
          return <article className={quantity ? 'inventory-item has-stock' : 'inventory-item'} key={item.id}>
            <div><span>{item.category}</span><h3>{item.name}</h3><small>per {item.unit}</small></div>
            <div className="stepper"><button aria-label={`Remove one ${item.name}`} onClick={() => changeInventory(item.id, -1)} disabled={!quantity}><Minus /></button><strong>{Number(quantity.toFixed(2))}</strong><button aria-label={`Add one ${item.name}`} onClick={() => changeInventory(item.id, 1)}><Plus /></button></div>
          </article>
        })}</div>
      </section>

      <section className="forecast-section">
        <div className="section-heading"><span className="eyebrow">Step 2</span><h2>See what your pantry can do</h2><p>Meal counts show full recipe batches, not individual servings.</p></div>
        <div className="forecast-banner">
          <div><span>Food energy on hand</span><strong>{Math.round(calories).toLocaleString()} <small>calories</small></strong></div>
          <div className="forecast-days"><span>Estimated coverage</span><strong>{foodDays.toFixed(1)} <small>days</small></strong></div>
          <div className="forecast-track"><span style={{ width: `${Math.min(100, foodDays / 14 * 100)}%` }} /></div>
          <small>Progress toward a 14-day starting goal</small>
        </div>
        <div className="meal-progress-grid">{recipes.slice(0, 8).map((recipe) => {
          const progress = recipeProgress(recipe, inventory)
          const capacity = recipeCapacity(recipe, inventory)
          return <article className="meal-progress" key={recipe.id}>
            <div><span>{recipe.tags[0]}</span><h3>{recipe.name}</h3><small>{recipe.servings} servings per batch</small></div>
            <strong>{capacity}<small> batches ready</small></strong>
            <span>{members.length ? Math.floor(capacity * recipe.servings / members.length) : 0} complete household meals</span>
            <div className="progress"><i style={{ width: `${progress}%` }} /></div><span>{progress}% of one batch stocked</span>
            <details><summary>What’s still needed <ChevronDown size={15} /></summary><ul>{recipe.ingredients.map((needed) => {
              const ingredient = ingredients.find((item) => item.id === needed.ingredientId)!
              const owned = inventory.find((item) => item.ingredientId === needed.ingredientId)?.quantity ?? 0
              return <li key={needed.ingredientId}><span>{ingredient.name}</span><b>{Math.max(0, needed.amount - owned).toFixed(1)} {ingredient.unit}</b></li>
            })}</ul></details>
          </article>
        })}</div>
      </section>
    </div>
  )
}

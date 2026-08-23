import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { ChefHat, ChevronDown, Cloud, CloudOff, Droplets, Heart, Info, Minus, PackagePlus, Plus, RotateCcw, Save, ShieldCheck, Trash2, Users, Utensils } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ingredients, recipes } from '../data/recipes'
import { householdNeeds, inventoryCalories, litersPerGallon, recipeCapacity, recipeProgress } from '../lib/planner'
import { useLocalStorage } from '../lib/useLocalStorage'
import type { HouseholdMember, Ingredient, InventoryItem, MealWishlistItem, Recipe } from '../types'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

const initialMembers: HouseholdMember[] = [{ id: 'member-1', age: 35 }]

export default function Planner() {
  const { session } = useAuth()
  const [members, setMembers] = useLocalStorage<HouseholdMember[]>('ward-members', initialMembers)
  const [inventory, setInventory] = useLocalStorage<InventoryItem[]>('ward-inventory', [])
  const [waterLiters, setWaterLiters] = useLocalStorage<number>('ward-water', 0)
  const [waterUnit, setWaterUnit] = useLocalStorage<'gallons' | 'liters'>('ward-water-unit', 'gallons')
  const [customSupplies, setCustomSupplies] = useLocalStorage<Ingredient[]>('ward-custom-supplies', [])
  const [customRecipes, setCustomRecipes] = useLocalStorage<Recipe[]>('ward-custom-recipes', [])
  const [mealWishlist, setMealWishlist] = useLocalStorage<MealWishlistItem[]>('ward-meal-wishlist', [])
  const [addingSupply, setAddingSupply] = useState(false)
  const [addingRecipe, setAddingRecipe] = useState(false)
  const [recipeIngredientAmounts, setRecipeIngredientAmounts] = useState<Record<string, number>>({})
  const [category, setCategory] = useState('All')
  const [cloudReady, setCloudReady] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const needs = useMemo(() => householdNeeds(members), [members])
  const allIngredients = useMemo(() => [...ingredients, ...customSupplies], [customSupplies])
  const allRecipes = useMemo(() => [...recipes, ...customRecipes], [customRecipes])
  const calories = useMemo(() => inventoryCalories(inventory, allIngredients), [inventory, allIngredients])
  const foodDays = needs.calories ? calories / needs.calories : 0
  const waterDays = needs.waterLiters ? waterLiters / needs.waterLiters : 0
  const categories = ['All', ...new Set(allIngredients.map((item) => item.category))]
  const readyRecipeCount = useMemo(() => allRecipes.filter((recipe) => recipeCapacity(recipe, inventory) > 0).length, [allRecipes, inventory])
  const wishlistNeeds = useMemo(() => {
    const totals = new Map<string, number>()
    mealWishlist.forEach((wish) => {
      const recipe = allRecipes.find((item) => item.id === wish.recipeId)
      recipe?.ingredients.forEach((item) => totals.set(item.ingredientId, (totals.get(item.ingredientId) ?? 0) + item.amount * wish.batches))
    })
    return [...totals.entries()].map(([ingredientId, required]) => {
      const ingredient = allIngredients.find((item) => item.id === ingredientId)
      const owned = inventory.find((item) => item.ingredientId === ingredientId)?.quantity ?? 0
      return { ingredientId, name: ingredient?.name ?? ingredientId, unit: ingredient?.unit ?? 'unit', required, owned, needed: Math.max(0, required - owned) }
    }).sort((left, right) => right.needed - left.needed)
  }, [allIngredients, allRecipes, inventory, mealWishlist])

  useEffect(() => {
    if (!session || !supabase) { setCloudReady(false); setSaveStatus('idle'); return }
    const client = supabase
    let cancelled = false
    setCloudReady(false)
    client.from('household_plans').select('*').eq('user_id', session.user.id).maybeSingle().then(async ({ data, error }) => {
      if (cancelled) return
      if (error) { setSaveStatus('error'); return }
      if (data) {
        setMembers(data.members as HouseholdMember[])
        setInventory(data.inventory as InventoryItem[])
        setWaterLiters(Number(data.water_liters))
        setCustomSupplies((data.custom_supplies as Ingredient[]) ?? [])
        setCustomRecipes((data.custom_recipes as Recipe[]) ?? [])
        setMealWishlist((data.meal_wishlist as MealWishlistItem[]) ?? [])
      } else {
        await client.from('household_plans').insert({ user_id: session.user.id, members, inventory, water_liters: waterLiters, custom_supplies: customSupplies, custom_recipes: customRecipes, meal_wishlist: mealWishlist, daily_calories: needs.calories, daily_water_liters: needs.waterLiters, inventory_calories: calories, ready_recipe_count: readyRecipeCount })
      }
      if (!cancelled) { setCloudReady(true); setSaveStatus('saved') }
    })
    return () => { cancelled = true }
    // Load once when the signed-in identity changes; local values are the seed for a new plan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id])

  useEffect(() => {
    if (!session || !supabase || !cloudReady) return
    const client = supabase
    setSaveStatus('saving')
    const timer = window.setTimeout(async () => {
      const { error } = await client.from('household_plans').upsert({ user_id: session.user.id, members, inventory, water_liters: waterLiters, custom_supplies: customSupplies, custom_recipes: customRecipes, meal_wishlist: mealWishlist, daily_calories: needs.calories, daily_water_liters: needs.waterLiters, inventory_calories: calories, ready_recipe_count: readyRecipeCount })
      setSaveStatus(error ? 'error' : 'saved')
    }, 650)
    return () => window.clearTimeout(timer)
  }, [session, cloudReady, members, inventory, waterLiters, customSupplies, customRecipes, mealWishlist, needs.calories, needs.waterLiters, calories, readyRecipeCount])

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

  function addCustomSupply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name')).trim()
    const supply: Ingredient = { id: `custom-${crypto.randomUUID()}`, name, unit: String(form.get('unit')).trim(), calories: Math.max(0, Number(form.get('calories'))), category: String(form.get('category')), notes: String(form.get('notes')).trim() }
    setCustomSupplies((current) => [...current, supply])
    setAddingSupply(false)
    event.currentTarget.reset()
  }

  function addCustomRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const selectedIngredients = Object.entries(recipeIngredientAmounts).filter(([, amount]) => amount > 0).map(([ingredientId, amount]) => ({ ingredientId, amount }))
    if (!selectedIngredients.length) return
    const recipe: Recipe = {
      id: `custom-recipe-${crypto.randomUUID()}`,
      name: String(form.get('name')).trim(),
      description: String(form.get('description')).trim(),
      servings: Math.max(1, Number(form.get('servings'))),
      minutes: Math.max(0, Number(form.get('minutes'))),
      tags: String(form.get('tags')).split(',').map((tag) => tag.trim()).filter(Boolean),
      ingredients: selectedIngredients,
      instructions: String(form.get('instructions')).split('\n').map((step) => step.trim()).filter(Boolean),
      isCustom: true,
    }
    setCustomRecipes((current) => [...current, recipe])
    setRecipeIngredientAmounts({})
    setAddingRecipe(false)
    event.currentTarget.reset()
  }

  function changeWishlist(recipeId: string, amount: number) {
    setMealWishlist((current) => {
      const match = current.find((item) => item.recipeId === recipeId)
      const batches = Math.max(0, (match?.batches ?? 0) + amount)
      if (!batches) return current.filter((item) => item.recipeId !== recipeId)
      return match ? current.map((item) => item.recipeId === recipeId ? { ...item, batches } : item) : [...current, { recipeId, batches }]
    })
  }

  return (
    <div className="page-width interior-page planner-page">
      <div className="page-heading split-heading">
        <div><span className="eyebrow">{session ? 'Private cloud workspace' : 'Private to this device'}</span><h1>My household plan</h1><p>Set your household, add what you have, and turn your pantry into a practical meal plan.</p></div>
        <div className="planner-actions">{session && <span className={`sync-status ${saveStatus}`}><Cloud size={15} /> {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Sync error' : 'Saved'}</span>}<button className="text-button" onClick={() => { setInventory([]); setWaterLiters(0) }}><RotateCcw size={15} /> Reset supplies</button></div>
      </div>

      {session ? <div className="cloud-privacy-bar"><ShieldCheck /><p><b>Synced privately.</b> Only your signed-in family can read this plan. The ward dashboard receives anonymous totals, never your inventory or household record.</p><Link to="/account">Account & privacy</Link></div> : <div className="cloud-privacy-bar guest"><CloudOff /><p><b>This plan currently lives only on this browser.</b> Create a free family account to access it on any device. We never sell your data or show your individual plan to others.</p><Link to="/account?mode=signup">Save my progress</Link></div>}

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
        <div className="section-heading inline"><div><span className="eyebrow">Step 1</span><h2>Add your supplies</h2></div><button className="button secondary" onClick={() => setAddingSupply(!addingSupply)}><PackagePlus size={18} /> {addingSupply ? 'Cancel' : 'Create a supply'}</button></div>
        {addingSupply && <form className="custom-entry-form" onSubmit={addCustomSupply}><div className="custom-form-heading"><PackagePlus /><div><h3>Create a pantry supply</h3><p>Add the package size and nutrition information you actually buy.</p></div></div><div className="form-row"><label><span>Supply name</span><input required name="name" placeholder="Quinoa" /></label><label><span>Category</span><select required name="category" defaultValue="Grains"><option>Grains</option><option>Protein</option><option>Fruit</option><option>Vegetables</option><option>Dairy</option><option>Soups</option><option>Baking</option><option>Cooking</option><option>Snacks</option><option>Other</option></select></label></div><div className="form-row"><label><span>Tracking unit</span><input required name="unit" placeholder="bag, can, cup…" /></label><label><span>Calories per unit</span><input required name="calories" type="number" min="0" step="1" placeholder="1200" /></label></div><label><span>Storage or preparation notes <small>optional</small></span><textarea name="notes" rows={2} placeholder="16 oz bag; requires water and 15 minutes of cooking" /></label><button className="button primary"><Save /> Add supply</button></form>}
        <div className="water-entry-card">
          <div><Droplets /><span><b>Stored water</b><small>Include sealed bottles and containers</small></span></div>
          <div className="water-control"><input aria-label="Stored water" type="number" min="0" step="0.5" value={Number((waterUnit === 'gallons' ? waterLiters / litersPerGallon : waterLiters).toFixed(2))} onChange={(event) => changeWater(Number(event.target.value))} /><select value={waterUnit} onChange={(event) => setWaterUnit(event.target.value as 'gallons' | 'liters')}><option value="gallons">gallons</option><option value="liters">liters</option></select></div>
          <strong>{waterDays.toFixed(1)} <small>days</small></strong>
        </div>
        <div className="category-tabs" aria-label="Inventory categories">{categories.map((item) => <button className={category === item ? 'active' : ''} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="inventory-grid">{allIngredients.filter((item) => category === 'All' || item.category === category).map((item) => {
          const quantity = inventory.find((entry) => entry.ingredientId === item.id)?.quantity ?? 0
          return <article className={quantity ? 'inventory-item has-stock' : 'inventory-item'} key={item.id}>
            <div><span>{item.category}{item.id.startsWith('custom-') ? ' · Custom' : ''}</span><h3>{item.name}</h3><small>{item.calories.toLocaleString()} cal per {item.unit}</small>{item.notes && <small>{item.notes}</small>}</div>
            <div className="stepper"><button aria-label={`Remove one ${item.name}`} onClick={() => changeInventory(item.id, -1)} disabled={!quantity}><Minus /></button><strong>{Number(quantity.toFixed(2))}</strong><button aria-label={`Add one ${item.name}`} onClick={() => changeInventory(item.id, 1)}><Plus /></button></div>
            {item.id.startsWith('custom-') && !quantity && <button className="remove-custom" aria-label={`Delete ${item.name}`} onClick={() => setCustomSupplies((current) => current.filter((entry) => entry.id !== item.id))}><Trash2 /></button>}
          </article>
        })}</div>
      </section>

      <section className="forecast-section">
        <div className="section-heading inline"><div><span className="eyebrow">Step 2</span><h2>Build meals your family enjoys</h2><p>Meal counts show full recipe batches, not individual servings.</p></div><button className="button secondary" onClick={() => setAddingRecipe(!addingRecipe)}><ChefHat size={18} /> {addingRecipe ? 'Cancel' : 'Create a meal'}</button></div>
        {addingRecipe && <form className="custom-entry-form custom-recipe-form" onSubmit={addCustomRecipe}><div className="custom-form-heading"><ChefHat /><div><h3>Create a pantry meal</h3><p>Use default or custom supplies, then record enough detail to make it during an emergency.</p></div></div><div className="form-row"><label><span>Meal name</span><input required name="name" placeholder="Grandma’s lentil stew" /></label><label><span>Tags <small>comma separated</small></span><input name="tags" placeholder="One pot, Family favorite" /></label></div><div className="form-row"><label><span>Servings per batch</span><input required name="servings" type="number" min="1" defaultValue="4" /></label><label><span>Preparation time in minutes</span><input required name="minutes" type="number" min="0" defaultValue="20" /></label></div><label><span>Description</span><textarea required name="description" rows={2} /></label><fieldset className="recipe-supply-picker"><legend>Supplies for one batch</legend>{allIngredients.map((ingredient) => <label key={ingredient.id}><span>{ingredient.name}<small>{ingredient.unit}</small></span><input aria-label={`${ingredient.name} amount`} type="number" min="0" step="0.05" value={recipeIngredientAmounts[ingredient.id] ?? ''} onChange={(event) => setRecipeIngredientAmounts((current) => ({ ...current, [ingredient.id]: Number(event.target.value) }))} /></label>)}</fieldset><label><span>Directions <small>one step per line</small></span><textarea required name="instructions" rows={5} placeholder={'Combine ingredients.\nSimmer until tender.\nSeason and serve.'} /></label><button className="button primary" disabled={!Object.values(recipeIngredientAmounts).some((amount) => amount > 0)}><Save /> Add pantry meal</button></form>}
        <div className="forecast-banner">
          <div><span>Food energy on hand</span><strong>{Math.round(calories).toLocaleString()} <small>calories</small></strong></div>
          <div className="forecast-days"><span>Estimated coverage</span><strong>{foodDays.toFixed(1)} <small>days</small></strong></div>
          <div className="forecast-track"><span style={{ width: `${Math.min(100, foodDays / 14 * 100)}%` }} /></div>
          <small>Progress toward a 14-day starting goal</small>
        </div>
        <div className="meal-progress-grid">{allRecipes.map((recipe) => {
          const progress = recipeProgress(recipe, inventory)
          const capacity = recipeCapacity(recipe, inventory)
          return <article className="meal-progress" key={recipe.id}>
            <div><span>{recipe.tags[0]}</span><h3>{recipe.name}</h3><small>{recipe.servings} servings per batch</small></div>
            <strong>{capacity}<small> batches ready</small></strong>
            <span>{members.length ? Math.floor(capacity * recipe.servings / members.length) : 0} complete household meals</span>
            <div className="progress"><i style={{ width: `${progress}%` }} /></div><span>{progress}% of one batch stocked</span>
            <details><summary>What’s still needed <ChevronDown size={15} /></summary><ul>{recipe.ingredients.map((needed) => {
              const ingredient = allIngredients.find((item) => item.id === needed.ingredientId)!
              const owned = inventory.find((item) => item.ingredientId === needed.ingredientId)?.quantity ?? 0
              return <li key={needed.ingredientId}><span>{ingredient.name}</span><b>{Math.max(0, needed.amount - owned).toFixed(1)} {ingredient.unit}</b></li>
            })}</ul></details><div className="meal-card-actions"><button onClick={() => changeWishlist(recipe.id, 1)}><Heart /> Add to wishlist</button>{recipe.isCustom && <button onClick={() => { setCustomRecipes((current) => current.filter((item) => item.id !== recipe.id)); setMealWishlist((current) => current.filter((item) => item.recipeId !== recipe.id)) }}><Trash2 /> Remove custom meal</button>}</div>
          </article>
        })}</div>
      </section>

      <section className="wishlist-section">
        <div className="section-heading"><span className="eyebrow">Step 3</span><h2>Plan the meals you want to have.</h2><p>Choose target batches and the planner will combine every ingredient into one private supply list.</p></div>
        {!mealWishlist.length ? <div className="empty-state"><Heart /><h3>Your meal wishlist is empty.</h3><p>Add a favorite meal above to begin planning quantities.</p></div> : <div className="wishlist-layout"><div className="wishlist-meals">{mealWishlist.map((wish) => { const recipe = allRecipes.find((item) => item.id === wish.recipeId); if (!recipe) return null; return <article key={wish.recipeId}><div><b>{recipe.name}</b><small>{wish.batches * recipe.servings} planned servings</small></div><div className="stepper"><button onClick={() => changeWishlist(wish.recipeId, -1)}><Minus /></button><strong>{wish.batches}</strong><button onClick={() => changeWishlist(wish.recipeId, 1)}><Plus /></button></div></article> })}</div><aside className="wishlist-needs"><h3>Combined supply needs</h3><ul>{wishlistNeeds.map((item) => <li key={item.ingredientId} className={item.needed === 0 ? 'stocked' : ''}><span><b>{item.name}</b><small>{Number(item.required.toFixed(2))} {item.unit} planned · {Number(item.owned.toFixed(2))} on hand</small></span><strong>{item.needed === 0 ? 'Stocked' : `${Number(item.needed.toFixed(2))} ${item.unit} needed`}</strong></li>)}</ul></aside></div>}
      </section>
    </div>
  )
}

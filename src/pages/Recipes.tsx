import { useEffect, useMemo, useState } from 'react'
import { Check, Clock3, Heart, Search, Users } from 'lucide-react'
import { ingredients, recipes } from '../data/recipes'
import { useLocalStorage } from '../lib/useLocalStorage'
import { recipeCapacity, recipeProgress } from '../lib/planner'
import type { Ingredient, InventoryItem, MealWishlistItem, Recipe } from '../types'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

const filters = ['All', 'Gluten free', 'Dairy free', 'One pot', 'No cook', 'Breakfast']

export default function Recipes() {
  const { session } = useAuth()
  const [inventory, setInventory] = useLocalStorage<InventoryItem[]>('ward-inventory', [])
  const [customSupplies, setCustomSupplies] = useLocalStorage<Ingredient[]>('ward-custom-supplies', [])
  const [customRecipes, setCustomRecipes] = useLocalStorage<Recipe[]>('ward-custom-recipes', [])
  const [wishlist, setWishlist] = useLocalStorage<MealWishlistItem[]>('ward-meal-wishlist', [])
  const [cloudReady, setCloudReady] = useState(false)
  const [planExists, setPlanExists] = useState(false)
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const allIngredients = useMemo(() => [...ingredients, ...customSupplies], [customSupplies])
  const allRecipes = useMemo(() => [...recipes, ...customRecipes], [customRecipes])
  const [selectedId, setSelectedId] = useState(recipes[0]!.id)
  const selected = allRecipes.find((recipe) => recipe.id === selectedId) ?? allRecipes[0]!
  const [targetBatches, setTargetBatches] = useState(1)
  const visible = useMemo(() => allRecipes.filter((recipe) => (filter === 'All' || recipe.tags.includes(filter)) && recipe.name.toLowerCase().includes(query.toLowerCase())), [allRecipes, filter, query])

  useEffect(() => {
    if (!session || !supabase) return
    setCloudReady(false)
    supabase.from('household_plans').select('inventory, custom_supplies, custom_recipes, meal_wishlist').eq('user_id', session.user.id).maybeSingle().then(({ data }) => {
      setPlanExists(Boolean(data))
      if (data) {
        setInventory((data.inventory as InventoryItem[]) ?? [])
        setCustomSupplies((data.custom_supplies as Ingredient[]) ?? [])
        setCustomRecipes((data.custom_recipes as Recipe[]) ?? [])
        setWishlist((data.meal_wishlist as MealWishlistItem[]) ?? [])
      }
      setCloudReady(true)
    })
    // Load once when the signed-in identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id])

  useEffect(() => {
    if (!session || !supabase || !cloudReady) return
    const timer = window.setTimeout(async () => {
      if (planExists) await supabase!.from('household_plans').update({ meal_wishlist: wishlist }).eq('user_id', session.user.id)
      else {
        const { error } = await supabase!.from('household_plans').insert({ user_id: session.user.id, members: [{ id: 'member-1', age: 35 }], meal_wishlist: wishlist })
        if (!error) setPlanExists(true)
      }
    }, 500)
    return () => window.clearTimeout(timer)
  }, [cloudReady, planExists, session, wishlist])

  function addToWishlist(recipeId: string) {
    setWishlist((current) => {
      const match = current.find((item) => item.recipeId === recipeId)
      return match ? current.map((item) => item.recipeId === recipeId ? { ...item, batches: item.batches + 1 } : item) : [...current, { recipeId, batches: 1 }]
    })
  }

  return <div className="page-width interior-page recipe-page">
    <div className="page-heading"><span className="eyebrow">Familiar food, resilient pantry</span><h1>Emergency-friendly meals</h1><p>Simple meals chosen for shelf-stable ingredients, minimal fuel, and family-friendly flavors.</p></div>
    <div className="recipe-toolbar"><label className="search"><Search /><input placeholder="Search meals" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="filter-row">{filters.map((item) => <button className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div></div>
    <div className="recipe-layout">
      <div className="recipe-list">{visible.map((recipe) => {
        const progress = recipeProgress(recipe, inventory)
        const ingredientNames = recipe.ingredients.map((item) => allIngredients.find((ingredient) => ingredient.id === item.ingredientId)?.name).filter(Boolean)
        return <button key={recipe.id} className={selected.id === recipe.id ? 'recipe-card selected' : 'recipe-card'} onClick={() => setSelectedId(recipe.id)}>
          <div className="recipe-card-top"><span>{recipe.tags[0]}</span>{recipeCapacity(recipe, inventory) > 0 && <i><Check size={12} /> Ready</i>}</div>
          <h2>{recipe.name}</h2>{recipe.description && <p>{recipe.description}</p>}
          <div className="recipe-ingredient-preview"><span>Ingredients</span><b>{ingredientNames.slice(0, 3).join(' · ')}{ingredientNames.length > 3 ? ` + ${ingredientNames.length - 3} more` : ''}</b></div>
          <div className="recipe-meta"><span><Clock3 /> {recipe.minutes} min</span><span><Users /> {recipe.servings}</span><b>{progress}% stocked</b></div>
          <div className="progress"><i style={{ width: `${progress}%` }} /></div>
        </button>
      })}</div>
      <aside className="recipe-detail">
        <span className="eyebrow">Recipe details</span><h2>{selected.name}</h2>{selected.description && <p>{selected.description}</p>}
        <div className="tag-row">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        <div className="batch-target"><label><span>Plan batches</span><input type="number" min="1" max="100" value={targetBatches} onChange={(event) => setTargetBatches(Math.max(1, Number(event.target.value)))} /></label><strong>{targetBatches * selected.servings}<small> total servings</small></strong></div>
        <h3>Ingredients for {targetBatches} {targetBatches === 1 ? 'batch' : 'batches'}</h3>
        <ul className="ingredient-list">{selected.ingredients.map((item) => {
          const ingredient = allIngredients.find((entry) => entry.id === item.ingredientId)
          const owned = inventory.find((entry) => entry.ingredientId === item.ingredientId)?.quantity ?? 0
          const required = item.amount * targetBatches
          return <li key={item.ingredientId}><span>{ingredient?.name ?? 'Unavailable ingredient'}<small>{owned >= required ? 'Enough in your pantry' : `${Math.max(0, required - owned).toFixed(1)} more needed`}</small></span><b>{Number(required.toFixed(2))} {ingredient?.unit ?? 'unit'}</b></li>
        })}</ul><button className="button wishlist-button" onClick={() => addToWishlist(selected.id)}><Heart /> Add {selected.name} to wishlist{wishlist.find((item) => item.recipeId === selected.id) ? ` · ${wishlist.find((item) => item.recipeId === selected.id)!.batches} planned` : ''}</button>
        <h3>Directions</h3><ol>{selected.instructions.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol>
        <p className="recipe-safety"><b>Safety note:</b> Use safe water, observe food allergy needs, and refrigerate leftovers within two hours when refrigeration is available.</p>
      </aside>
    </div>
  </div>
}

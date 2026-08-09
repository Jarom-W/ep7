import type { HouseholdMember, Ingredient, InventoryItem, Recipe } from '../types'

export function dailyCaloriesForAge(age: number) {
  if (age <= 3) return 1100
  if (age <= 8) return 1500
  if (age <= 13) return 2000
  if (age <= 18) return 2400
  if (age <= 59) return 2200
  return 1900
}

export function dailyWaterLitersForAge(age: number) {
  if (age <= 3) return 1.0
  if (age <= 8) return 1.5
  if (age <= 13) return 2.0
  return 2.84 // 0.75 gallon minimum planning target
}

export function householdNeeds(members: HouseholdMember[]) {
  return {
    calories: members.reduce((sum, member) => sum + dailyCaloriesForAge(member.age), 0),
    waterLiters: members.reduce((sum, member) => sum + dailyWaterLitersForAge(member.age), 0),
  }
}

export function inventoryCalories(inventory: InventoryItem[], ingredients: Ingredient[]) {
  return inventory.reduce((sum, item) => {
    const ingredient = ingredients.find((candidate) => candidate.id === item.ingredientId)
    return sum + (ingredient?.calories ?? 0) * item.quantity
  }, 0)
}

export function recipeCapacity(recipe: Recipe, inventory: InventoryItem[]) {
  return Math.max(0, Math.floor(Math.min(...recipe.ingredients.map((needed) => {
    const owned = inventory.find((item) => item.ingredientId === needed.ingredientId)?.quantity ?? 0
    return owned / needed.amount
  }))))
}

export function recipeProgress(recipe: Recipe, inventory: InventoryItem[]) {
  if (!recipe.ingredients.length) return 0
  return Math.min(100, Math.round(recipe.ingredients.reduce((total, needed) => {
    const owned = inventory.find((item) => item.ingredientId === needed.ingredientId)?.quantity ?? 0
    return total + Math.min(1, owned / needed.amount)
  }, 0) / recipe.ingredients.length * 100))
}

export const litersPerGallon = 3.78541

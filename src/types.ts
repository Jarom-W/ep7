export type DocumentRecord = {
  id: string
  title: string
  kind: 'newsletter' | 'plan'
  file_path: string
  published_at: string
  description: string | null
}

export type HouseholdMember = { id: string; age: number }

export type InventoryItem = {
  ingredientId: string
  quantity: number
}

export type Ingredient = {
  id: string
  name: string
  unit: string
  calories: number
  category: string
  notes?: string
}

export type RecipeIngredient = { ingredientId: string; amount: number }

export type Recipe = {
  id: string
  name: string
  description: string
  servings: number
  minutes: number
  tags: string[]
  ingredients: RecipeIngredient[]
  instructions: string[]
  isCustom?: boolean
}

export type BlockCaptain = {
  id: string
  block_id: string
  name: string
  address: string | null
  phone: string | null
  is_public: boolean
  building_id?: string | null
}

export type BlockHousehold = {
  id: string
  block_id: string
  display_name: string
  address: string | null
  is_public: boolean
  notes?: string | null
  building_id?: string | null
}

export type MealWishlistItem = {
  recipeId: string
  batches: number
}

export type HouseholdPlanRecord = {
  custom_supplies?: Ingredient[]
  custom_recipes?: Recipe[]
  meal_wishlist?: MealWishlistItem[]
}

export type FamilyProfile = {
  user_id: string
  household_name: string | null
  address: string | null
  block_id: string | null
  household_id: string | null
}

export type HouseholdPrivateDetail = {
  household_id: string
  needs: string
  special_circumstances: string
  updated_at?: string
}

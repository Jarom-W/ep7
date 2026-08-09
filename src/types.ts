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
}

export type Block = {
  id: string
  label: string
  points: string
}

export type BlockCaptain = {
  id: string
  block_id: string
  name: string
  address: string | null
  phone: string | null
  is_public: boolean
}

export type BlockHousehold = {
  id: string
  block_id: string
  display_name: string
  address: string | null
  is_public: boolean
  notes?: string | null
}

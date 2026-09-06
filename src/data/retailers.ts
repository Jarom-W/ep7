export type DealRetailer = {
  id: string
  name: string
  offerLabel: string
  offerUrl: string
  searchUrl?: (ingredient: string) => string
}

export const dealRetailers: DealRetailer[] = [
  {
    id: 'harmons',
    name: 'Harmons',
    offerLabel: 'Weekly ad',
    offerUrl: 'https://shop.harmonsgrocery.com/store/harmons/storefront',
    searchUrl: (ingredient) => `https://shop.harmonsgrocery.com/store/harmons/search_v3/${encodeURIComponent(ingredient)}`,
  },
  {
    id: 'walmart',
    name: 'Walmart',
    offerLabel: 'Local rollbacks',
    offerUrl: 'https://www.walmart.com/store/4068-spanish-fork-ut/shopping-services',
    searchUrl: (ingredient) => `https://www.walmart.com/search?q=${encodeURIComponent(ingredient)}`,
  },
  {
    id: 'maceys',
    name: "Macey's",
    offerLabel: 'Weekly ad',
    offerUrl: 'https://shop.maceys.com/store/maceys/storefront',
    searchUrl: (ingredient) => `https://shop.maceys.com/store/maceys/search_v3/${encodeURIComponent(ingredient)}`,
  },
  {
    id: 'target',
    name: 'Target',
    offerLabel: 'Weekly ad',
    offerUrl: 'https://www.target.com/weekly-ad?method=get',
    searchUrl: (ingredient) => `https://www.target.com/s?searchTerm=${encodeURIComponent(ingredient)}`,
  },
]

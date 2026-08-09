import type { Block } from '../types'

// Coordinates are percentages in the corrected landscape image's 3088 × 1680 viewBox.
// They intentionally follow streets rather than property boundaries; admins can refine them in data.
export const blocks: Block[] = [
  { id: 'A', label: 'A', points: '55,555 460,555 460,925 55,925' },
  { id: 'B', label: 'B', points: '470,555 845,555 845,925 470,925' },
  { id: 'C', label: 'C', points: '855,555 1375,555 1375,900 855,925' },
  { id: 'D', label: 'D', points: '855,940 1335,940 1335,1260 855,1260' },
  { id: 'E', label: 'E', points: '855,1270 1335,1270 1335,1650 855,1650' },
  { id: 'F', label: 'F', points: '1345,380 1735,380 1735,540 1345,540' },
  { id: 'G', label: 'G', points: '1345,940 1725,940 1725,1260 1345,1260' },
  { id: 'H', label: 'H', points: '1345,1270 1725,1270 1725,1650 1345,1650' },
  { id: 'I', label: 'I', points: '1390,555 1725,555 1725,925 1390,925' },
  { id: 'J', label: 'J', points: '1740,155 2070,155 2070,525 1740,525' },
  { id: 'K', label: 'K', points: '1735,535 2110,535 2110,925 1735,925' },
  { id: 'L', label: 'L', points: '1735,940 2100,940 2100,1260 1735,1260' },
  { id: 'M', label: 'M', points: '1735,1270 2100,1270 2100,1650 1735,1650' },
  { id: 'N', label: 'N', points: '2120,700 2380,650 2460,925 2120,925' },
  { id: 'O', label: 'O', points: '2110,940 2470,940 2600,1260 2110,1260' },
  { id: 'P', label: 'P', points: '2110,1270 2590,1270 2700,1650 2110,1650' },
  { id: 'Q', label: 'Q', points: '2610,180 3050,180 3050,540 2500,540' },
  { id: 'R', label: 'R', points: '2510,550 3050,550 3050,925 2400,925' },
]

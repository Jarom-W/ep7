import { blockDetails } from '../data/blockDetails'

type Direction = 'N' | 'S' | 'E' | 'W'
type Coordinate = { direction: Direction; value: number }
type BlockZone = { north: [number, number]; east: [number, number] }

export type BlockSuggestion = {
  blockId: string
  confidence: 'confirmed' | 'possible'
  detail: string
  score: number
}

// The rectangular ranges come from the street boundaries drawn on the map.
// Irregular eastern blocks use broader envelopes and lean more heavily on
// their mapped building labels.
const blockZones: Record<string, BlockZone> = {
  A: { north: [400, 500], east: [500, 600] },
  B: { north: [400, 500], east: [600, 700] },
  C: { north: [400, 500], east: [700, 800] },
  D: { north: [300, 400], east: [700, 800] },
  E: { north: [200, 300], east: [700, 800] },
  F: { north: [500, 600], east: [800, 900] },
  G: { north: [300, 400], east: [800, 900] },
  H: { north: [200, 300], east: [800, 900] },
  I: { north: [400, 500], east: [800, 900] },
  J: { north: [500, 600], east: [900, 1000] },
  K: { north: [400, 500], east: [900, 1000] },
  L: { north: [300, 400], east: [900, 1000] },
  M: { north: [200, 300], east: [900, 1000] },
  N: { north: [380, 540], east: [1000, 1120] },
  O: { north: [200, 360], east: [1000, 1120] },
  P: { north: [200, 300], east: [980, 1070] },
  Q: { north: [480, 550], east: [1160, 1250] },
  R: { north: [400, 480], east: [1150, 1220] },
}

export function suggestBlocksForAddress(input: string): BlockSuggestion[] {
  const normalizedInput = normalizeDirections(input)
  const coordinates = extractCoordinates(normalizedInput)
  const north = axisValue(coordinates, 'N', 'S')
  const east = axisValue(coordinates, 'E', 'W')
  const hasFullGridAddress = north !== null && east !== null
  const numberFragments = normalizedInput.match(/\d+/g)?.filter((value) => value.length >= 2) ?? []

  if (!normalizedInput.trim() || (!coordinates.length && !numberFragments.length)) return []

  const scored = Object.values(blockDetails).map((detail) => {
    const zone = blockZones[detail.id]
    let score = 0
    let mappedAddressMatch = false
    let mappedStreetMatch = false

    for (const building of detail.buildings) {
      for (const address of building.addresses) {
        const labelCoordinates = extractCoordinates(normalizeDirections(address.label))
        const exactMatches = coordinates.filter((coordinate) => includesCoordinate(labelCoordinates, coordinate)).length
        if (exactMatches) {
          score += exactMatches * 160
          mappedAddressMatch = true
        } else if (!hasFullGridAddress && numberFragments.some((fragment) => address.label.replace(/\D/g, '').startsWith(fragment))) {
          score += 24
        }
      }
    }

    for (const street of detail.streetLabels) {
      const labelCoordinates = extractCoordinates(normalizeDirections(street.label))
      const exactMatches = coordinates.filter((coordinate) => includesCoordinate(labelCoordinates, coordinate)).length
      if (exactMatches) {
        score += exactMatches * 25
        mappedStreetMatch = true
      } else if (!hasFullGridAddress && numberFragments.some((fragment) => street.label.replace(/\D/g, '').startsWith(fragment))) {
        score += 8
      }
    }

    const zoneDistance = zone && hasFullGridAddress ? distanceFromZone(zone, north, east) : null
    const zoneMatch = zoneDistance === 0
    if (zoneDistance !== null && zone && north !== null && east !== null) {
      score += zoneMatch ? 100 : -Math.min(180, zoneDistance)
      if (zoneMatch) score += boundarySideScore(zone, north, east)
    } else if (zone) {
      if (north !== null && isWithin(north, zone.north)) score += 10
      if (east !== null && isWithin(east, zone.east)) score += 10
    }

    return { blockId: detail.id, mappedAddressMatch, mappedStreetMatch, score, zoneMatch }
  }).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score || a.blockId.localeCompare(b.blockId)).slice(0, 3)

  const lead = scored[0]
  const runnerUp = scored[1]
  const confirmed = Boolean(hasFullGridAddress && lead?.zoneMatch && lead.score - (runnerUp?.score ?? 0) >= 20)

  return scored.map((candidate, index) => ({
    blockId: candidate.blockId,
    confidence: index === 0 && confirmed ? 'confirmed' : 'possible',
    detail: candidate.zoneMatch && (candidate.mappedAddressMatch || candidate.mappedStreetMatch)
      ? 'Matched against the mapped address and surrounding ward streets.'
      : candidate.zoneMatch
        ? 'The address coordinates fall inside this mapped ward block.'
        : 'Part of the address matches a home or street shown on this block.',
    score: candidate.score,
  }))
}

export function confidentBlockForAddress(input: string) {
  return suggestBlocksForAddress(input).find((suggestion) => suggestion.confidence === 'confirmed')?.blockId ?? null
}

function normalizeDirections(value: string) {
  return value.toUpperCase()
    .replace(/\bNORTH\b/g, 'N')
    .replace(/\bSOUTH\b/g, 'S')
    .replace(/\bEAST\b/g, 'E')
    .replace(/\bWEST\b/g, 'W')
}

function extractCoordinates(value: string): Coordinate[] {
  return Array.from(value.matchAll(/(\d{1,4})\s*([NSEW])\b/g), (match) => ({ value: Number(match[1]), direction: match[2] as Direction }))
}

function axisValue(coordinates: Coordinate[], positive: Direction, negative: Direction) {
  const coordinate = coordinates.find((item) => item.direction === positive || item.direction === negative)
  if (!coordinate) return null
  return coordinate.direction === negative ? -coordinate.value : coordinate.value
}

function includesCoordinate(coordinates: Coordinate[], target: Coordinate) {
  return coordinates.some((coordinate) => coordinate.direction === target.direction && coordinate.value === target.value)
}

function isWithin(value: number, range: [number, number]) {
  return value >= range[0] && value <= range[1]
}

function distanceFromRange(value: number, range: [number, number]) {
  if (value < range[0]) return range[0] - value
  if (value > range[1]) return value - range[1]
  return 0
}

function distanceFromZone(zone: BlockZone, north: number, east: number) {
  return distanceFromRange(north, zone.north) + distanceFromRange(east, zone.east)
}

// Spanish Fork grid addresses use odd/even house numbers to distinguish the
// two sides of a boundary street. This prevents an address directly on 900 E,
// for example, from producing two equally likely blocks.
function boundarySideScore(zone: BlockZone, north: number, east: number) {
  let score = 0
  if (east === zone.east[1]) score += Math.abs(north) % 2 === 1 ? 30 : -20
  else if (east === zone.east[0]) score += Math.abs(north) % 2 === 0 ? 30 : -20
  if (north === zone.north[0]) score += Math.abs(east) % 2 === 1 ? 30 : -20
  else if (north === zone.north[1]) score += Math.abs(east) % 2 === 0 ? 30 : -20
  return score
}

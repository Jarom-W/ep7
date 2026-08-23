export type MapBlock = {
  id: string
  x: number
  y: number
  width: number
  height: number
  shape?: string
  homes: number
  structures?: number
}

export type MapBuilding = {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export const mapBlocks: MapBlock[] = [
  { id: 'A', x: 42, y: 190, width: 170, height: 135, homes: 17, structures: 16 },
  { id: 'B', x: 225, y: 190, width: 170, height: 135, homes: 21, structures: 16 },
  { id: 'C', x: 408, y: 190, width: 190, height: 135, homes: 30, structures: 12 },
  { id: 'F', x: 610, y: 80, width: 150, height: 95, homes: 33, structures: 12 },
  { id: 'I', x: 610, y: 190, width: 165, height: 135, homes: 26, structures: 11 },
  { id: 'J', x: 788, y: 72, width: 155, height: 103, homes: 24, structures: 12 },
  { id: 'K', x: 788, y: 190, width: 155, height: 135, homes: 16, structures: 10 },
  { id: 'D', x: 408, y: 338, width: 190, height: 145, homes: 13, structures: 13 },
  { id: 'G', x: 610, y: 338, width: 165, height: 145, homes: 13, structures: 13 },
  { id: 'L', x: 788, y: 338, width: 155, height: 145, homes: 18, structures: 14 },
  { id: 'N', x: 955, y: 310, width: 105, height: 173, shape: '955,310 1005,310 1060,483 955,483', homes: 28, structures: 11 },
  { id: 'O', x: 965, y: 496, width: 125, height: 166, shape: '965,496 1065,496 1090,662 965,662', homes: 28, structures: 14 },
  { id: 'E', x: 408, y: 496, width: 190, height: 166, homes: 18, structures: 14 },
  { id: 'H', x: 610, y: 496, width: 165, height: 166, homes: 14, structures: 14 },
  { id: 'M', x: 788, y: 496, width: 155, height: 166, homes: 14, structures: 10 },
  { id: 'P', x: 110, y: 496, width: 285, height: 166, homes: 11, structures: 11 },
  { id: 'Q', x: 1032, y: 92, width: 130, height: 126, shape: '1065,92 1162,92 1162,218 1032,218', homes: 30, structures: 11 },
  { id: 'R', x: 1065, y: 232, width: 105, height: 160, homes: 29, structures: 9 },
]

export const streetLabels = [
  { label: '600 N', x: 485, y: 52, rotate: 0 },
  { label: '500 N', x: 670, y: 184, rotate: 0 },
  { label: '400 N', x: 550, y: 332, rotate: 0 },
  { label: '300 N', x: 560, y: 490, rotate: 0 },
  { label: '200 N', x: 555, y: 690, rotate: 0 },
  { label: '700 E', x: 401, y: 275, rotate: -90 },
  { label: '800 E', x: 603, y: 565, rotate: -90 },
  { label: '900 E', x: 780, y: 565, rotate: -90 },
  { label: '1000 E', x: 950, y: 405, rotate: -90 },
  { label: 'Grand Army of the Republic Hwy', x: 1048, y: 390, rotate: 77 },
]

export function buildingsFor(block: MapBlock): MapBuilding[] {
  const buildings: MapBuilding[] = []
  const padding = 15
  const usableWidth = block.width - padding * 2
  const usableHeight = block.height - padding * 2
  const columns = block.width > 200 ? 5 : block.width > 150 ? 4 : 3
  const buildingCount = block.structures ?? block.homes
  const rows = Math.ceil(buildingCount / columns)
  const cellWidth = usableWidth / columns
  const cellHeight = usableHeight / rows
  for (let index = 0; index < buildingCount; index += 1) {
    const column = index % columns
    const row = Math.floor(index / columns)
    const jitterX = ((index * 17 + block.id.charCodeAt(0)) % 7) - 3
    const jitterY = ((index * 11 + block.id.charCodeAt(0)) % 5) - 2
    const width = Math.max(15, Math.min(27, cellWidth * .58 + (index % 3) * 2))
    const height = Math.max(11, Math.min(19, cellHeight * .48 + (index % 2) * 2))
    buildings.push({
      id: `${block.id}-${index + 1}`,
      x: block.x + padding + column * cellWidth + (cellWidth - width) / 2 + jitterX,
      y: block.y + padding + row * cellHeight + (cellHeight - height) / 2 + jitterY,
      width,
      height,
      rotation: ((index * 7) % 5) - 2,
    })
  }
  return buildings
}

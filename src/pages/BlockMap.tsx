import { useEffect, useState } from 'react'
import { Home, MapPin, Phone, Shield, Users } from 'lucide-react'
import { blocks } from '../data/blocks'
import { supabase } from '../lib/supabase'
import type { BlockCaptain, BlockHousehold } from '../types'

export default function BlockMap() {
  const [selected, setSelected] = useState('G')
  const [captains, setCaptains] = useState<BlockCaptain[]>([])
  const [households, setHouseholds] = useState<BlockHousehold[]>([])

  useEffect(() => {
    if (!supabase) return
    Promise.all([
      supabase.from('block_captains').select('*').eq('is_public', true),
      supabase.from('block_households').select('*').eq('is_public', true),
    ]).then(([captainResult, householdResult]) => {
      setCaptains((captainResult.data as BlockCaptain[]) ?? [])
      setHouseholds((householdResult.data as BlockHousehold[]) ?? [])
    })
  }, [])

  const blockCaptain = captains.find((captain) => captain.block_id === selected)
  const blockHouseholds = households.filter((household) => household.block_id === selected)

  return <div className="page-width interior-page map-page">
    <div className="page-heading"><span className="eyebrow">Neighbors helping neighbors</span><h1>Ward block map</h1><p>Select a labeled area to find its block captain and publicly listed households.</p></div>
    <div className="map-layout">
      <div className="map-panel">
        <div className="map-instructions"><MapPin size={18} /><span>Tap any outlined block A–R</span></div>
        <div className="interactive-map">
          <img src="/ward-block-map.jpg" alt="Ward block map near 400 North and 900 East in Spanish Fork, Utah" />
          <svg viewBox="0 0 3088 1680" preserveAspectRatio="none" role="group" aria-label="Selectable ward blocks">
            {blocks.map((block) => <polygon key={block.id} points={block.points} className={selected === block.id ? 'active' : ''} role="button" tabIndex={0} aria-label={`Select block ${block.label}`} onClick={() => setSelected(block.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelected(block.id) }} />)}
          </svg>
        </div>
        <p className="map-caption">Map boundaries are for ward emergency coordination and are approximate. The photo is the specialist-provided reference map.</p>
      </div>
      <aside className="block-detail">
        <div className="block-badge">{selected}</div><span className="eyebrow">Selected area</span><h2>Block {selected}</h2>
        <div className="captain-card">
          <Shield />
          <div><span>Block captain</span><strong>{blockCaptain?.name ?? 'Not publicly listed'}</strong>
            {blockCaptain?.address && <p><MapPin /> {blockCaptain.address}</p>}
            {blockCaptain?.phone && <p><Phone /> {blockCaptain.phone}</p>}
          </div>
        </div>
        <div className="household-heading"><div><Users /><h3>Households</h3></div><span>{blockHouseholds.length} listed</span></div>
        {blockHouseholds.length ? <ul className="household-list">{blockHouseholds.map((household) => <li key={household.id}><Home /><span><b>{household.display_name}</b>{household.address && <small>{household.address}</small>}</span></li>)}</ul> : <div className="mini-empty">No households have opted into the public listing for this block.</div>}
        <div className="privacy-note"><b>About this listing</b><p>Only information marked public by the specialist appears here. Contact ward leadership to correct or remove a listing.</p></div>
      </aside>
    </div>
  </div>
}

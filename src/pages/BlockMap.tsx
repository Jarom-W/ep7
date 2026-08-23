import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Building2, Home, LocateFixed, LockKeyhole, MapPin, Pencil, Phone, Plus, Save, Shield, Trash2, Users, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { blockDetails, type DetailBuilding } from '../data/blockDetails'
import { buildingsFor, mapBlocks, streetLabels, type MapBlock, type MapBuilding } from '../data/neighborhood'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import type { BlockCaptain, BlockHousehold, FamilyProfile, HouseholdPrivateDetail } from '../types'

type DirectoryDraft = { id?: string; display_name: string; address: string }

export default function BlockMap() {
  const { session, loading } = useAuth()
  const [params] = useSearchParams()
  const requested = params.get('block')?.toUpperCase()
  const [selected, setSelected] = useState(requested && /^[A-R]$/.test(requested) ? requested : '')
  const [selectedBuilding, setSelectedBuilding] = useState<DetailBuilding | null>(null)
  const [selectedHousehold, setSelectedHousehold] = useState<BlockHousehold | null>(null)
  const [captains, setCaptains] = useState<BlockCaptain[]>([])
  const [households, setHouseholds] = useState<BlockHousehold[]>([])
  const [profile, setProfile] = useState<FamilyProfile | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingDirectory, setEditingDirectory] = useState(false)
  const [directoryDrafts, setDirectoryDrafts] = useState<DirectoryDraft[]>([])
  const [deletedDirectoryIds, setDeletedDirectoryIds] = useState<string[]>([])
  const [privateDetail, setPrivateDetail] = useState<HouseholdPrivateDetail | null>(null)
  const [canWritePrivate, setCanWritePrivate] = useState(false)
  const [editingPrivate, setEditingPrivate] = useState(false)
  const [status, setStatus] = useState('')

  async function loadDirectory() {
    if (!supabase || !session) return
    const [captainResult, householdResult, profileResult, adminResult] = await Promise.all([
      supabase.from('block_captains').select('*'),
      supabase.from('block_households').select('*').order('display_name'),
      supabase.from('family_profiles').select('*').eq('user_id', session.user.id).maybeSingle(),
      supabase.rpc('is_admin'),
    ])
    setCaptains((captainResult.data as BlockCaptain[]) ?? [])
    setHouseholds((householdResult.data as BlockHousehold[]) ?? [])
    setProfile((profileResult.data as FamilyProfile | null) ?? null)
    setIsAdmin(Boolean(adminResult.data))
  }

  // Reload whenever the authenticated household changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadDirectory() }, [session?.user.id])
  useEffect(() => { setSelectedBuilding(null); setSelectedHousehold(null); setEditingDirectory(false) }, [selected])

  useEffect(() => {
    if (!supabase || !selectedHousehold) { setPrivateDetail(null); setCanWritePrivate(false); return }
    let cancelled = false
    Promise.all([
      supabase.from('household_private_details').select('*').eq('household_id', selectedHousehold.id).maybeSingle(),
      supabase.rpc('can_write_household_detail', { target_household_id: selectedHousehold.id }),
    ]).then(([detailResult, permissionResult]) => {
      if (cancelled) return
      setPrivateDetail((detailResult.data as HouseholdPrivateDetail | null) ?? null)
      setCanWritePrivate(Boolean(permissionResult.data))
    })
    return () => { cancelled = true }
  }, [selectedHousehold])

  const selectedBlock = mapBlocks.find((block) => block.id === selected)
  const detail = selected ? blockDetails[selected] : undefined
  const blockCaptain = captains.find((captain) => captain.block_id === selected)
  const blockHouseholds = households.filter((household) => household.block_id === selected)
  const buildingHouseholds = useMemo(() => {
    if (!selectedBuilding) return []
    const labels = selectedBuilding.addresses.map((item) => normalizeAddress(item.label))
    return blockHouseholds.filter((household) => household.building_id === selectedBuilding.id || (!household.building_id && household.address && labels.some((label) => normalizeAddress(household.address!).includes(label))))
  }, [blockHouseholds, selectedBuilding])

  function openBuilding(building: DetailBuilding) {
    setSelectedBuilding(building)
    const matches = households.filter((household) => household.building_id === building.id)
    setSelectedHousehold(matches.length === 1 ? matches[0]! : null)
    setEditingDirectory(false)
    setEditingPrivate(false)
    setStatus('')
  }

  function beginDirectoryEdit() {
    if (!selectedBuilding) return
    setDirectoryDrafts(buildingHouseholds.map((household) => ({ id: household.id, display_name: household.display_name, address: household.address ?? selectedBuilding.addresses[0]?.label ?? '' })))
    setDeletedDirectoryIds([])
    setEditingDirectory(true)
  }

  async function saveDirectory() {
    if (!supabase || !selectedBuilding || !selected) return
    const client = supabase
    setStatus('Saving directory…')
    const existing = directoryDrafts.filter((draft) => draft.id && draft.display_name.trim())
    const additions = directoryDrafts.filter((draft) => !draft.id && draft.display_name.trim())
    const operations = [
      ...existing.map((draft) => client.from('block_households').update({ display_name: draft.display_name.trim(), address: draft.address.trim() || null, building_id: selectedBuilding.id, block_id: selected, is_public: true }).eq('id', draft.id!)),
      ...additions.map((draft) => client.from('block_households').insert({ display_name: draft.display_name.trim(), address: draft.address.trim() || null, building_id: selectedBuilding.id, block_id: selected, is_public: true })),
      ...deletedDirectoryIds.map((id) => client.from('block_households').delete().eq('id', id)),
    ]
    const results = await Promise.all(operations)
    const error = results.find((result) => result.error)?.error
    setStatus(error?.message ?? 'Directory saved.')
    if (!error) { setEditingDirectory(false); await loadDirectory() }
  }

  async function savePrivate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !selectedHousehold || !session) return
    const form = new FormData(event.currentTarget)
    setStatus('Saving private household details…')
    const needs = String(form.get('needs') ?? '').trim()
    const specialCircumstances = String(form.get('special_circumstances') ?? '').trim()
    const { error } = await supabase.from('household_private_details').upsert({ household_id: selectedHousehold.id, needs, special_circumstances: specialCircumstances, updated_by: session.user.id })
    setStatus(error?.message ?? 'Private details saved.')
    if (!error) { setPrivateDetail({ household_id: selectedHousehold.id, needs, special_circumstances: specialCircumstances }); setEditingPrivate(false) }
  }

  if (loading) return <div className="full-loader">Loading private map…</div>
  if (!session) return <div className="page-width interior-page map-auth-gate"><LockKeyhole /><span className="eyebrow">Private ward directory</span><h1>Sign in to view the block map.</h1><p>Addresses and family names are available only to authenticated ward households. Preparedness needs and special circumstances remain restricted to the household, the specialist, and approved ministering assignments.</p><div className="button-row"><Link className="button primary" to="/account">Sign in</Link><Link className="button secondary" to="/account?mode=signup">Create an account</Link></div></div>

  return <div className="page-width interior-page map-page code-map-page">
    <div className="page-heading split-heading"><div><span className="eyebrow">Private neighborhood directory</span><h1>Find a household.</h1><p>Open a block to follow its streets and select any address. Every structure is drawn from the ward block references—not overlaid from a photo.</p></div>{selectedBlock && <button className="button secondary" onClick={() => setSelected('')}><ArrowLeft /> All blocks</button>}</div>
    <div className={selectedBlock ? 'map-stage focused' : 'map-stage'}>
      <div className="map-canvas">
        <div className="map-mode"><LocateFixed /><span>{selectedBlock ? `Block ${selectedBlock.id} · Detailed household view` : 'Ward overview · Select a block'}</span></div>
        <div className="map-art">
          <NeighborhoodOverview blocks={mapBlocks} captains={captains} selected={selected} onSelect={setSelected} />
          {selectedBlock && detail && <DetailedBlockMap detail={detail} selectedBuildingId={selectedBuilding?.id ?? ''} captainBuildingId={blockCaptain?.building_id ?? ''} onSelect={openBuilding} onClose={() => setSelected('')} />}
        </div>
        <div className="map-key"><span><i className="home-key" /> Household structure</span><span><i className="captain-key" /> Block captain</span><span><i className="selected-key" /> Selected address</span></div>
      </div>

      <aside className="block-detail code-detail">
        {!selectedBlock ? <MapWelcome onSelect={setSelected} /> : selectedBuilding ? <>
          <button className="detail-back" onClick={() => { setSelectedBuilding(null); setSelectedHousehold(null) }}><ArrowLeft /> Block {selected}</button>
          <div className="block-badge">{selected}</div><span className="eyebrow">Selected household</span><h2>{selectedBuilding.addresses.length === 1 ? selectedBuilding.addresses[0]!.label : `${selectedBuilding.addresses.length} addresses`}</h2>
          <div className="address-chip-list">{selectedBuilding.addresses.map((address) => <span key={address.label}><MapPin /> {address.label}</span>)}</div>
          <div className="household-heading"><div><Users /><h3>Families at this structure</h3></div><span>{buildingHouseholds.length} listed</span></div>
          {editingDirectory ? <div className="directory-editor">{directoryDrafts.map((draft, index) => <div className="directory-edit-row" key={draft.id ?? `new-${index}`}><input aria-label="Family name" placeholder="Family or household name" value={draft.display_name} onChange={(event) => setDirectoryDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, display_name: event.target.value } : item))} /><select aria-label="Address" value={draft.address} onChange={(event) => setDirectoryDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, address: event.target.value } : item))}>{selectedBuilding.addresses.map((address) => <option key={address.label}>{address.label}</option>)}</select><button aria-label="Remove family" onClick={() => { if (draft.id) setDeletedDirectoryIds((ids) => [...ids, draft.id!]); setDirectoryDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index)) }}><Trash2 /></button></div>)}<button className="add-directory-row" onClick={() => setDirectoryDrafts((current) => [...current, { display_name: '', address: selectedBuilding.addresses[0]?.label ?? '' }])}><Plus /> Add family</button><div className="button-row"><button className="button primary" onClick={saveDirectory}><Save /> Save</button><button className="button secondary" onClick={() => setEditingDirectory(false)}><X /> Cancel</button></div></div> : <>
            {buildingHouseholds.length ? <ul className="household-list selectable">{buildingHouseholds.map((household) => <li className={selectedHousehold?.id === household.id ? 'selected' : ''} key={household.id}><button onClick={() => { setSelectedHousehold(household); setEditingPrivate(false) }}><Home /><span><b>{household.display_name}</b><small>{household.address}</small></span></button></li>)}</ul> : <div className="mini-empty">No family has been linked to this address yet.</div>}
            {isAdmin && <button className="button secondary directory-edit-button" onClick={beginDirectoryEdit}><Pencil /> Edit household directory</button>}
          </>}
          {selectedHousehold && <PrivateDetailsPanel household={selectedHousehold} detail={privateDetail} canWrite={canWritePrivate} isOwner={profile?.household_id === selectedHousehold.id} editing={editingPrivate} onEdit={() => setEditingPrivate(true)} onCancel={() => setEditingPrivate(false)} onSave={savePrivate} />}
          {status && <p className="account-message map-status">{status}</p>}
        </> : <>
          <div className="block-badge">{selected}</div><span className="eyebrow">Selected area</span><h2>Block {selected}</h2>
          <div className="captain-card"><Shield /><div><span>Block captain</span><strong>{blockCaptain?.name ?? 'Not listed'}</strong>{blockCaptain?.address && <p><MapPin /> {blockCaptain.address}</p>}{blockCaptain?.phone && <p><Phone /> {blockCaptain.phone}</p>}</div></div>
          <div className="building-count"><Building2 /><span><b>{selectedBlock.homes}</b><small>mapped household addresses</small></span></div>
          <div className="block-open-prompt"><Home /><div><b>Select an address on the map</b><p>Each footprint follows the supplied block diagram, including multi-family homes and private roads.</p></div></div>
          {detail?.note && <div className="mini-empty">{detail.note}</div>}
        </>}
        <div className="privacy-note"><b>Directory privacy</b><p>Map access requires sign-in. Needs and special circumstances are protected separately and appear only to the household, the specialist, or accounts the specialist explicitly authorizes.</p></div>
      </aside>
    </div>
  </div>
}

function MapWelcome({ onSelect }: { onSelect: (id: string) => void }) {
  return <div className="map-welcome"><MapPin /><span className="eyebrow">Start here</span><h2>Select any block A–R</h2><p>Open a block to see the street layout, every mapped household address, and its family directory.</p><div className="block-button-grid">{mapBlocks.map((block) => <button key={block.id} onClick={() => onSelect(block.id)}>{block.id}</button>)}</div></div>
}

function PrivateDetailsPanel({ household, detail, canWrite, isOwner, editing, onEdit, onCancel, onSave }: { household: BlockHousehold; detail: HouseholdPrivateDetail | null; canWrite: boolean; isOwner: boolean; editing: boolean; onEdit: () => void; onCancel: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void }) {
  if (!detail && !canWrite) return <div className="restricted-detail"><LockKeyhole /><p>Preparedness needs for {household.display_name} are restricted.</p></div>
  return <section className="private-household-detail"><div className="private-detail-heading"><div><Shield /><span><b>Protected household notes</b><small>{isOwner ? 'Your household' : canWrite ? 'Authorized access' : 'Read-only ministering access'}</small></span></div>{canWrite && !editing && <button onClick={onEdit}><Pencil /> Edit</button>}</div>{editing ? <form onSubmit={onSave}><label><span>Current needs</span><textarea name="needs" rows={4} defaultValue={detail?.needs ?? ''} placeholder="Supplies, transportation, communication, accessibility, or other needs" /></label><label><span>Special circumstances</span><textarea name="special_circumstances" rows={4} defaultValue={detail?.special_circumstances ?? ''} placeholder="Private circumstances responders or assigned ministers should understand" /></label><div className="button-row"><button className="button primary"><Save /> Save privately</button><button type="button" className="button secondary" onClick={onCancel}>Cancel</button></div></form> : <div className="private-detail-copy"><div><span>Current needs</span><p>{detail?.needs || 'None reported.'}</p></div><div><span>Special circumstances</span><p>{detail?.special_circumstances || 'None reported.'}</p></div></div>}</section>
}

function DetailedBlockMap({ detail, selectedBuildingId, captainBuildingId, onSelect, onClose }: { detail: (typeof blockDetails)[string]; selectedBuildingId: string; captainBuildingId: string; onSelect: (building: DetailBuilding) => void; onClose: () => void }) {
  return <svg className="block-zoom-svg detailed-block-svg" viewBox="0 0 1000 700" role="img" aria-label={`Detailed streets and household addresses in block ${detail.id}`}>
    <rect width="1000" height="700" className="detail-map-ground" />
    <g className="detail-roads">{detail.roads.map((item, index) => <path key={index} d={item.d} style={{ strokeWidth: item.width ?? 34 }} />)}</g>
    <g className="detail-street-labels">{detail.streetLabels.map((item) => <text key={`${item.label}-${item.x}`} x={item.x} y={item.y} transform={`rotate(${item.rotation ?? 0} ${item.x} ${item.y})`}>{item.label}</text>)}</g>
    {detail.buildings.map((building) => {
      const isMeetinghouse = building.addresses[0]?.label === 'Meetinghouse'
      return <g key={building.id} role={isMeetinghouse ? undefined : 'button'} tabIndex={isMeetinghouse ? undefined : 0} aria-label={isMeetinghouse ? 'Meetinghouse' : `Open ${building.addresses.map((item) => item.label).join(', ')}`} className={`detail-building ${selectedBuildingId === building.id ? 'selected' : ''} ${captainBuildingId === building.id ? 'captain' : ''} ${isMeetinghouse ? 'landmark' : ''}`} transform={`rotate(${building.rotation ?? 0} ${building.x + building.width / 2} ${building.y + building.height / 2})`} onClick={() => { if (!isMeetinghouse) onSelect(building) }} onKeyDown={(event) => { if (!isMeetinghouse && (event.key === 'Enter' || event.key === ' ')) onSelect(building) }}>
        <rect x={building.x} y={building.y} width={building.width} height={building.height} rx="5" /><AddressLabels building={building} />{captainBuildingId === building.id && <circle className="detail-captain-pin" cx={building.x + building.width - 4} cy={building.y + 4} r="9" />}
      </g>
    })}
    <g className="detail-compass" transform="translate(925 600)"><path d="M0 24L10 0l10 24-10-6z" /><text x="10" y="40">N</text></g>
    <g className="detail-map-back" role="button" tabIndex={0} onClick={onClose}><circle cx="35" cy="35" r="20" /><path d="M42 35H27m0 0 7-7m-7 7 7 7" /></g>
  </svg>
}

function AddressLabels({ building }: { building: DetailBuilding }) {
  const count = building.addresses.length
  const columns = count > 4 ? 2 : 1
  const rows = Math.ceil(count / columns)
  const fontSize = count > 6 ? 8 : count > 3 ? 9 : 11
  return <g className="detail-address-labels" style={{ fontSize }} aria-hidden="true">{building.addresses.map((address, index) => {
    const column = columns === 1 ? 0 : index % 2
    const row = columns === 1 ? index : Math.floor(index / 2)
    const x = building.x + building.width * (columns === 1 ? .5 : column ? .73 : .27)
    const y = building.y + building.height / 2 - ((rows - 1) * (fontSize + 2)) / 2 + row * (fontSize + 2) + fontSize * .35
    return <text key={address.label} x={x} y={y}>{address.label}</text>
  })}</g>
}

function NeighborhoodOverview({ blocks, captains, selected, onSelect }: { blocks: MapBlock[]; captains: BlockCaptain[]; selected: string; onSelect: (id: string) => void }) {
  return <svg className={selected ? 'neighborhood-svg receding' : 'neighborhood-svg'} viewBox="0 0 1200 720" role="img" aria-label="Schematic Spanish Fork 7th Ward block map">
    <rect width="1200" height="720" className="map-ground" /><path d="M1020 -20 L1115 -20 L1010 285 L1170 720 L1065 720 L910 300 Z" className="highway" /><path d="M1040 -20 L1090 -20 L985 285 L1142 720 L1090 720 L940 295 Z" className="highway-inner" />
    <g className="roads"><rect x="25" y="176" width="925" height="14" /><rect x="25" y="325" width="935" height="13" /><rect x="95" y="483" width="875" height="13" /><rect x="95" y="662" width="1010" height="14" /><rect x="395" y="70" width="13" height="605" /><rect x="598" y="55" width="12" height="630" /><rect x="775" y="55" width="13" height="630" /><rect x="943" y="48" width="13" height="635" /></g>
    <g className="street-labels">{streetLabels.map((item) => <text key={`${item.label}-${item.x}`} x={item.x} y={item.y} transform={`rotate(${item.rotate} ${item.x} ${item.y})`}>{item.label}</text>)}</g>
    <g className="meetinghouse"><rect x="465" y="215" width="72" height="44" rx="4" /><rect x="488" y="197" width="25" height="21" /><path d="M500 197v-18m-8 8h16" /><text x="501" y="275">MEETINGHOUSE</text></g>
    {blocks.map((block) => <g className="overview-block" key={block.id} role="button" tabIndex={0} aria-label={`Open block ${block.id}`} onClick={() => onSelect(block.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect(block.id) }}>
      {block.shape ? <polygon points={block.shape} className="block-lot" /> : <rect x={block.x} y={block.y} width={block.width} height={block.height} rx="5" className="block-lot" />}{buildingsFor(block).map((building) => <BuildingShape key={building.id} building={building} captain={captains.some((captain) => captain.block_id === block.id && (captain.building_id === building.id || (!captain.building_id && building.id === `${block.id}-1`)))} />)}<circle cx={block.x + block.width / 2} cy={block.y + block.height / 2} r="18" className="block-label-circle" /><text x={block.x + block.width / 2} y={block.y + block.height / 2 + 6} className="block-letter">{block.id}</text>
    </g>)}
  </svg>
}

function BuildingShape({ building, captain = false }: { building: MapBuilding; captain?: boolean }) {
  return <g className={captain ? 'map-building captain-building' : 'map-building'} transform={`rotate(${building.rotation} ${building.x + building.width / 2} ${building.y + building.height / 2})`}><rect x={building.x} y={building.y} width={building.width} height={building.height} rx="2" /><path d={`M${building.x + 3} ${building.y + 3}h${Math.max(4, building.width - 6)}`} /></g>
}

function normalizeAddress(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, '') }

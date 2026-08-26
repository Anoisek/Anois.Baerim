import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import ColorSystemViewer from '../components/ColorSystemViewer'
import {
  CLASSES, skillIconUrl,
  LOADOUT_CATS_ITEMS, LOADOUT_CATS_SKINS,
  SKIN_LOADOUT_ICON_IDS, ARMOR_DEFS, ARMOR_IDS_BY_CLASS,
  costumeDefFor, costumeIconsForClass,
  hairDefFor, hairIconsForClass, SASH_IDS, ICON_URL,
  weaponIdsForClassSubtype, weaponSubtypesForClass, WEAPON_SUBTYPE_LABELS, itemName,
} from '../lib/colorSystemCatalog'

const OVERRIDES_STORAGE_KEY = 'csCatalogOverrides_v1'
const EDITABLE_CATEGORIES = ['Zbroja', 'Bronie', 'Szarfa', 'Fryzury']

// Every icon reachable for a class, tagged with its "natural" (as-scraped)
// tab/category/subtype — used both to render the normal grids and, along
// with the user's override map, to let a miscategorized item be displayed
// under a different tab/category (see EquipmentEditor below).
// Zbroja(Skiny)/Fryzury are GENDER-PAIRED (see costumeIconsForClass/
// hairIconsForClass in the catalog) — costumes/hairstyles are two separate
// game items per shape (different icon+name per sex, e.g. "Rabbit Costume
// (m)" / "Bunny Costume (f)"), not one icon with two skins, so the universe
// itself must pick the gender-appropriate icon rather than relabeling one.
function classCatalogUniverse(classId, gender) {
  const entries = []
  ;(ARMOR_IDS_BY_CLASS[classId] || []).forEach((icon) => entries.push({ icon, tab: 'items', category: 'Zbroja' }))
  ;(SASH_IDS || []).forEach((icon) => entries.push({ icon, tab: 'items', category: 'Szarfa' }))
  weaponSubtypesForClass(classId).forEach((subtype) => {
    weaponIdsForClassSubtype(classId, subtype).forEach((icon) => entries.push({ icon, tab: 'items', category: 'Bronie', subtype }))
  })
  costumeIconsForClass(classId, gender).forEach((icon) => entries.push({ icon, tab: 'skins', category: 'Zbroja' }))
  hairIconsForClass(classId, gender).forEach((icon) => entries.push({ icon, tab: 'skins', category: 'Fryzury' }))
  ;(SKIN_LOADOUT_ICON_IDS['Bronie'] || []).forEach((icon) => entries.push({ icon, tab: 'skins', category: 'Bronie' }))
  return entries
}

const DEFAULT_WEAPON_BY_CLASS = { warrior: '00010', ninja: '00010', sura: '00010', shaman: '07000' }
const GENDER_MAP = { M: 'male', K: 'female' }

function buildLoadoutItems(catName, tab, classId, weaponSubtype, overrides = {}, gender = 'male') {
  const universe = classCatalogUniverse(classId, gender)
  const matches = universe.filter((e) => {
    const ov = overrides[e.icon]
    const effTab = ov?.tab || e.tab
    const effCategory = ov?.category || e.category
    if (effCategory === 'Szarfa') return catName === 'Szarfa'
    if (effCategory !== catName || effTab !== tab) return false
    if (catName === 'Bronie' && tab === 'items') return (ov?.subtype || e.subtype) === weaponSubtype
    return true
  })
  return matches.map((e, i) => {
    const ov = overrides[e.icon]
    return { icon: e.icon, label: ov?.name || itemName(e.icon, `${catName} ${String.fromCharCode(65 + i)}`) }
  })
}

export default function ColorSystem() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [maintenance, setMaintenance] = useState(false)
  const [dbLoading, setDbLoading] = useState(true)

  const [gender, setGender] = useState('M')
  const [classIndex, setClassIndex] = useState(0)
  const [pathIndex, setPathIndex] = useState(0)
  const [skillIndex, setSkillIndex] = useState(0)
  const [loadoutTab, setLoadoutTab] = useState('items')
  const [loadoutCat, setLoadoutCat] = useState('Bronie') // most visibly interactive by default
  const [weaponSubtypeTab, setWeaponSubtypeTab] = useState('SWORD')
  const [loadoutSelected, setLoadoutSelected] = useState({}) // "tab:cat" -> index
  const [weaponByClass, setWeaponByClass] = useState(DEFAULT_WEAPON_BY_CLASS)
  const [armorByClass, setArmorByClass] = useState({})
  const [costumeByClass, setCostumeByClass] = useState({})
  const [hairByClass, setHairByClass] = useState({})
  const [sashByClass, setSashByClass] = useState({})

  // Catalog correction tool (calibration-time only): the auto-scraped
  // catalog occasionally mis-tags an item's tab/category, or its name is
  // wrong/missing — rather than editing the generated JSON by hand, the
  // user can fix it live here and "Eksportuj poprawki" to paste back for
  // baking into colorSystemCatalog.js permanently. Persisted to
  // localStorage only so it survives reloads while calibrating.
  const [overrides, setOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem(OVERRIDES_STORAGE_KEY) || '{}') } catch { return {} }
  })
  useEffect(() => {
    try { localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides)) } catch { /* ignore */ }
  }, [overrides])
  const [editingIcon, setEditingIcon] = useState(null)
  const [editName, setEditName] = useState('')
  const [editTab, setEditTab] = useState('items')
  const [editCategory, setEditCategory] = useState('Zbroja')
  const [editSubtype, setEditSubtype] = useState('SWORD')

  useEffect(() => {
    db.from('settings').select('value').eq('key', 'system_colorsystem_maintenance').maybeSingle().then(({ data }) => {
      setMaintenance(data?.value === 'true')
      setDbLoading(false)
    })
  }, [])

  const blocked = maintenance && !isAdmin

  const currentClass = CLASSES[classIndex]

  function selectClass(i) {
    setClassIndex(i)
    setPathIndex(0)
    setSkillIndex(0)
  }
  function selectSkill(pi, si) {
    setPathIndex(pi)
    setSkillIndex(si)
  }

  const loadoutCatList = loadoutTab === 'skins' ? LOADOUT_CATS_SKINS : LOADOUT_CATS_ITEMS
  const catName = loadoutCatList.includes(loadoutCat) ? loadoutCat : loadoutCatList[0]
  const isWeaponCat = catName === 'Bronie' && loadoutTab !== 'skins'
  const availableSubtypes = useMemo(() => weaponSubtypesForClass(currentClass.id), [currentClass.id])
  const activeSubtype = availableSubtypes.includes(weaponSubtypeTab) ? weaponSubtypeTab : availableSubtypes[0]
  const loadoutKey = isWeaponCat ? `${loadoutTab}:${catName}:${activeSubtype}` : `${loadoutTab}:${catName}`
  const loadoutItems = useMemo(
    () => buildLoadoutItems(catName, loadoutTab, currentClass.id, isWeaponCat ? activeSubtype : undefined, overrides, GENDER_MAP[gender]),
    [catName, loadoutTab, currentClass.id, isWeaponCat, activeSubtype, overrides, gender]
  )
  const selectedLoadoutIndex = loadoutSelected[loadoutKey] ?? 0

  function openEditor(item) {
    const ov = overrides[item.icon]
    setEditingIcon(item.icon)
    setEditName(ov?.name || item.label)
    setEditTab(ov?.tab || loadoutTab)
    setEditCategory(ov?.category || catName)
    setEditSubtype(ov?.subtype || (isWeaponCat ? activeSubtype : (availableSubtypes[0] || 'SWORD')))
  }
  function saveEditor() {
    setOverrides((prev) => ({
      ...prev,
      [editingIcon]: {
        name: editName.trim() || undefined,
        tab: editTab,
        category: editCategory,
        subtype: editCategory === 'Bronie' && editTab === 'items' ? editSubtype : undefined,
      },
    }))
    setEditingIcon(null)
  }
  function clearEditorOverride() {
    setOverrides((prev) => {
      const next = { ...prev }
      delete next[editingIcon]
      return next
    })
    setEditingIcon(null)
  }
  function exportOverrides() {
    navigator.clipboard?.writeText(JSON.stringify(overrides, null, 2)).catch(() => {})
  }
  const overrideCount = Object.keys(overrides).length

  function selectGender(g) {
    setGender(g)
    // Armor/costume/hair picks are baked for ONE gender's body shape per
    // class — switching gender without resetting them would stitch a
    // male-shaped mesh onto a female skeleton (or vice versa). Weapons are
    // unaffected (same glb regardless of who's holding it).
    setArmorByClass((prev) => ({ ...prev, [currentClass.id]: undefined }))
    setCostumeByClass((prev) => ({ ...prev, [currentClass.id]: undefined }))
    setHairByClass((prev) => ({ ...prev, [currentClass.id]: undefined }))
  }

  function clickLoadoutItem(item, index) {
    setLoadoutSelected((prev) => ({ ...prev, [loadoutKey]: index }))
    if (catName === 'Bronie' && loadoutTab !== 'skins') {
      setWeaponByClass((prev) => ({ ...prev, [currentClass.id]: item.icon }))
    } else if (catName === 'Zbroja' && loadoutTab !== 'skins' && ARMOR_DEFS[item.icon]?.classId === currentClass.id) {
      setArmorByClass((prev) => ({ ...prev, [currentClass.id]: item.icon }))
    } else if (catName === 'Zbroja' && loadoutTab === 'skins' && costumeDefFor(currentClass.id, item.icon)) {
      setCostumeByClass((prev) => ({ ...prev, [currentClass.id]: item.icon }))
    } else if (catName === 'Fryzury' && loadoutTab === 'skins' && hairDefFor(currentClass.id, item.icon)) {
      setHairByClass((prev) => ({ ...prev, [currentClass.id]: item.icon }))
    } else if (catName === 'Szarfa') {
      setSashByClass((prev) => ({ ...prev, [currentClass.id]: item.icon }))
    }
  }

  function isRealEquip(item) {
    if (catName === 'Bronie' && loadoutTab !== 'skins') return true
    if (catName === 'Zbroja' && loadoutTab !== 'skins') return ARMOR_DEFS[item.icon]?.classId === currentClass.id
    if (catName === 'Zbroja' && loadoutTab === 'skins') return !!costumeDefFor(currentClass.id, item.icon)
    if (catName === 'Fryzury' && loadoutTab === 'skins') return !!hairDefFor(currentClass.id, item.icon)
    if (catName === 'Szarfa') return true
    return false
  }

  return (
    <div className="text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <Breadcrumbs items={[
            { label: t('common.home'), to: '/' },
            { label: t('systems.title'), to: '/systems' },
            { label: t('systems.colorSystem') },
          ]} />
          <div className="flex items-center gap-2 mb-6">
            <h1 className="text-2xl font-bold text-gray-100">{t('systems.colorSystem')}</h1>
            {maintenance && isAdmin && (
              <span className="text-xs font-bold text-yellow-400 bg-gray-900 border border-yellow-400/40 px-2 py-1 rounded-full">
                🚧 {t('common.inProgress')}
              </span>
            )}
          </div>

          {dbLoading ? <Spinner /> : blocked ? (
            <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
              <span className="text-5xl">🚧</span>
              <p className="text-sm">{t('systems.blockedMessage')}</p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-[320px_1fr] gap-6">
              {/* Left: character + skill picker */}
              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  {['M', 'K'].map((g) => (
                    <button
                      key={g}
                      onClick={() => selectGender(g)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${gender === g ? 'border-amber-400 text-amber-300 bg-amber-400/10' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                    >
                      {g === 'M' ? '♂ Mężczyzna' : '♀ Kobieta'}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {CLASSES.map((c, i) => (
                    <button
                      key={c.id}
                      onClick={() => selectClass(i)}
                      className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-sm transition ${i === classIndex ? 'border-amber-400 bg-amber-400/10' : 'border-gray-700 hover:border-gray-500'}`}
                    >
                      <span className="text-2xl">{c.icon}</span>
                      <span className="font-semibold text-gray-100">{c.label}</span>
                      <span className="text-[11px] text-gray-500">{c.weapon}</span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-3">
                  {currentClass.paths.map((path, pi) => (
                    <div key={path.name}>
                      <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-1">{path.name}</h3>
                      <div className="flex flex-col gap-1">
                        {path.skills.map((skillName, si) => {
                          const active = pi === pathIndex && si === skillIndex
                          return (
                            <button
                              key={skillName}
                              onClick={() => selectSkill(pi, si)}
                              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition ${active ? 'bg-amber-400/15 text-amber-300' : 'text-gray-400 hover:bg-white/5'}`}
                            >
                              <img
                                src={skillIconUrl(currentClass.id, pi, si)}
                                alt="" className={`w-6 h-6 rounded shrink-0 border ${active ? 'border-amber-400' : 'border-gray-700'}`}
                                loading="lazy"
                              />
                              {skillName}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: viewer + equipment panel */}
              <div className="flex flex-col gap-4">
                <div className="h-[480px]">
                  <ColorSystemViewer
                    classId={currentClass.id}
                    gender={GENDER_MAP[gender]}
                    weaponIcon={weaponByClass[currentClass.id]}
                    armorIcon={armorByClass[currentClass.id]}
                    costumeIcon={costumeByClass[currentClass.id]}
                    hairIcon={hairByClass[currentClass.id]}
                    sashIcon={sashByClass[currentClass.id]}
                    caption={`${currentClass.label} — ${currentClass.paths[pathIndex].skills[skillIndex]}`}
                  />
                </div>

                <div className="rounded-xl border border-gray-700 bg-black/30 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-300">Wyposażenie</h2>
                    {overrideCount > 0 && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-amber-400">{overrideCount} poprawek</span>
                        <button type="button" onClick={exportOverrides} className="underline text-blue-300 hover:text-blue-200">Eksportuj poprawki</button>
                        <button type="button" onClick={() => setOverrides({})} className="underline text-gray-500 hover:text-gray-300">Wyczyść</button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mb-3">
                    {[['items', 'Itemy'], ['skins', 'Skiny']].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setLoadoutTab(key)}
                        className={`rounded-full border px-3 py-1 text-xs transition ${loadoutTab === key ? 'border-amber-400 text-amber-300' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {loadoutCatList.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setLoadoutCat(cat)}
                        className={`rounded-full border px-3 py-1 text-xs transition ${catName === cat ? 'border-amber-400 text-amber-300' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  {isWeaponCat && availableSubtypes.length > 1 && (
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {availableSubtypes.map((st) => (
                        <button
                          key={st}
                          onClick={() => setWeaponSubtypeTab(st)}
                          className={`rounded-full border px-3 py-1 text-xs transition ${activeSubtype === st ? 'border-emerald-400 text-emerald-300' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                        >
                          {WEAPON_SUBTYPE_LABELS[st] || st}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[420px] overflow-y-auto pr-1">
                    {loadoutItems.filter(isRealEquip).map((item, i) => {
                      const hasOverride = !!overrides[item.icon]
                      return (
                        <div
                          key={item.icon + i}
                          data-icon={item.icon}
                          role="button"
                          tabIndex={0}
                          onClick={() => clickLoadoutItem(item, i)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') clickLoadoutItem(item, i) }}
                          className={`relative flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-[11px] text-center transition cursor-pointer ${i === selectedLoadoutIndex ? 'border-amber-400 bg-amber-400/10' : hasOverride ? 'border-blue-500/60' : 'border-gray-700 hover:border-gray-500'}`}
                        >
                          <span className="absolute top-1 right-1 text-[9px] font-bold text-emerald-400 bg-black/60 rounded px-1">3D</span>
                          <button
                            type="button"
                            title="Edytuj nazwę / przynależność"
                            onClick={(e) => { e.stopPropagation(); openEditor(item) }}
                            className={`absolute top-1 left-1 text-[9px] font-bold rounded px-1 bg-black/60 ${hasOverride ? 'text-blue-400' : 'text-gray-500 hover:text-amber-300'}`}
                          >
                            ✎
                          </button>
                          <img
                            src={ICON_URL(item.icon)}
                            onError={(e) => {
                              // m2icondb's icon CDN indexes a handful of items (e.g. the
                              // Zodiac/Kyanite tiers) under the zero-stripped numeric form
                              // instead of the padded icon id — same double-key quirk found
                              // earlier for item names, just on the image CDN this time.
                              const fallback = ICON_URL(String(Number(item.icon)))
                              if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback
                            }}
                            alt="" className="w-8 h-8 object-contain" loading="lazy"
                          />
                          <span className="text-gray-300 leading-tight">{item.label}</span>
                        </div>
                      )
                    })}
                  </div>

                  {editingIcon && (
                    <div className="mt-3 rounded-lg border border-blue-500/50 bg-blue-950/20 p-3 text-xs space-y-2">
                      <div className="font-semibold text-blue-300">Edycja itemka: {editingIcon}</div>
                      <label className="flex flex-col gap-1">
                        Nazwa
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="rounded bg-black/40 border border-gray-700 px-2 py-1 text-gray-100"
                        />
                      </label>
                      <div className="flex gap-2">
                        <label className="flex flex-col gap-1 flex-1">
                          Zakładka
                          <select
                            value={editTab}
                            onChange={(e) => setEditTab(e.target.value)}
                            className="rounded bg-black/40 border border-gray-700 px-2 py-1 text-gray-100"
                          >
                            <option value="items">Itemy</option>
                            <option value="skins">Skiny</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 flex-1">
                          Kategoria
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="rounded bg-black/40 border border-gray-700 px-2 py-1 text-gray-100"
                          >
                            {EDITABLE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </label>
                      </div>
                      {editCategory === 'Bronie' && editTab === 'items' && (
                        <label className="flex flex-col gap-1">
                          Kształt broni
                          <select
                            value={editSubtype}
                            onChange={(e) => setEditSubtype(e.target.value)}
                            className="rounded bg-black/40 border border-gray-700 px-2 py-1 text-gray-100"
                          >
                            {(availableSubtypes.length ? availableSubtypes : ['SWORD']).map((st) => (
                              <option key={st} value={st}>{WEAPON_SUBTYPE_LABELS[st] || st}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={saveEditor} className="rounded border border-amber-400 text-amber-300 px-2 py-1 hover:bg-amber-400/10">Zapisz</button>
                        {overrides[editingIcon] && (
                          <button type="button" onClick={clearEditorOverride} className="rounded border border-gray-600 text-gray-400 px-2 py-1 hover:border-gray-400">Usuń poprawkę</button>
                        )}
                        <button type="button" onClick={() => setEditingIcon(null)} className="rounded border border-gray-600 text-gray-400 px-2 py-1 hover:border-gray-400">Anuluj</button>
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] text-gray-500 mt-3">
                    Ikony, nazwy i przynależność klasowa są prawdziwe (m2icondb.com). Kategoria <strong>Bronie</strong> (oznaczona „3D")
                    to pełny, realny katalog broni per klasa, podzielony na podzakładki wg kształtu (widoczne tylko te, które dana
                    klasa może założyć — jednoręczna, dwuręczna, sztylet, łuk, wachlarz, dzwon), z prawdziwą teksturą, właściwą
                    wielkością i pozą trzymania. Kategoria <strong>Zbroja</strong> (też „3D") to pełny
                    katalog pancerzy per klasa — kliknięcie podmienia cały model postaci na prawdziwy pancerz + jego teksturę. W zakładce{' '}
                    <strong>Skiny</strong> ta sama kategoria Zbroja pokazuje realne, wymienialne kostiumy, a <strong>Fryzury</strong> pełny
                    katalog realnych fryzur (ten sam mechanizm co pancerz, tylko podmienia samą fryzurę, nie całe ciało).{' '}
                    <strong>Szarfa</strong> to też pełny, realny katalog (72 szarfy) — jedna wspólna lista dla wszystkich klas i płci,
                    bo w grze szarfa nie jest ograniczona do konkretnej klasy. Uwaga: zbroja/kostium/fryzura są dopasowane do JEDNEJ płci
                    naraz — zmiana płci resetuje je do domyślnego wyglądu tej postaci (szarfa i broń zostają, bo nie zależą od płci).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

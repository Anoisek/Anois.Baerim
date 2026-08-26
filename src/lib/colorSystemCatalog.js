// Static data for the Color System page: classes/skills, the real item
// catalog (names + wearable class + model wiring) sourced from m2icondb.com,
// and the weapon/armor calibration tables. Ported from the Aura Forge
// Claude Artifact prototype (same session) — see AURA_FORGE_NOTES.md if it
// exists, or ask for the prototype's history for the full trail of how this
// data was found (m2icondb's public /locales/en/translation.json exposes
// name/model/subtype/wearable-class for ~4400 items with no API key).

import weaponAtlasMapping from './weaponAtlasMapping.json'
import sashAtlasMapping from './sashAtlasMapping.json'
import fullCatalog from './colorSystemFullCatalog.json'

export const CLASSES = [
  {
    id: 'warrior', label: 'Wojownik', icon: '⚔️', weapon: 'Miecz',
    paths: [
      { name: 'Wojownik Ciała', skills: ['Aura Miecza', 'Berserk', 'Unik', 'Wirujące Ostrze', 'Cios Potrójny', 'Siła Życia'] },
      { name: 'Wojownik Umysłu', skills: ['Uderzenie', 'Uderzenie Ducha', 'Silne Ciało', 'Ogłuszenie', 'Uderzenie Mieczem', 'Kula Miecza'] },
    ],
  },
  {
    id: 'ninja', label: 'Ninja', icon: '🏹', weapon: 'Sztylety / Łuk',
    paths: [
      { name: 'Siła Łucznicza', skills: ['Deszcz Strzał', 'Krok Pióra', 'Ognista Strzała', 'Zatruta Strzała', 'Powtarzalny Strzał', 'Iskra'] },
      { name: 'Siła Ostrza', skills: ['Zasadzka', 'Szybki Atak', 'Trująca Chmura', 'Wirujący Sztylet', 'Skradanie', 'Podstępna Trucizna'] },
    ],
  },
  {
    id: 'sura', label: 'Sura', icon: '🌙', weapon: 'Miecz Pełni Księżyca',
    paths: [
      { name: 'Czarna Magia', skills: ['Mroczna Kula', 'Mroczna Ochrona', 'Mroczne Uderzenie', 'Duch Płomienia', 'Uderzenie Płomienia', 'Uderzenie Ducha'] },
      { name: 'Uzbrojenie', skills: ['Rozproszenie', 'Wir Smoka', 'Zaklęta Zbroja', 'Zaklęte Ostrze', 'Strach', 'Uderzenie Palcem'] },
    ],
  },
  {
    id: 'shaman', label: 'Szaman', icon: '🐉', weapon: 'Wachlarz',
    paths: [
      { name: 'Siła Smoka', skills: ['Błogosławieństwo', 'Ryk Smoka', 'Siła Smoka', 'Latający Talizman', 'Odbicie', 'Strzelający Smok'] },
      { name: 'Siła Leczenia', skills: ['Wzm. Ataku', 'Leczenie', 'Błyskawiczny Pazur', 'Rzut Błyskawicą', 'Przywołanie Błyskawicy', 'Szybkość'] },
    ],
  },
]

// Real, official skill icons — downloaded from the Gameforge Metin2 wiki
// (en-wiki.metin2.gameforge.com) via its MediaWiki API, keyed by each
// skill's real English name (looked up per class from the wiki's own
// skill-tree pages, e.g. Aura Miecza = "Aura of the Sword"). Hosted locally
// at public/skill-icons/, same pattern as every other asset in this system.
export function skillIconUrl(classId, pathIndex, skillIndex) {
  return `/skill-icons/${classId}_${pathIndex}_${skillIndex}.png`
}

// Hełm never had any 3D wiring possible (see ARMOR_DEFS notes — armor items
// carry no head-slot equivalent in m2icondb's data) and was dropped from
// Itemy entirely. In Skiny it's replaced by Fryzury, which — unlike Hełm —
// really is fully real and equippable (COSTUME_HAIR items, same mechanism
// as Zbroja/costumes there).
export const LOADOUT_CATS_ITEMS = ['Zbroja', 'Bronie', 'Szarfa']
export const LOADOUT_CATS_SKINS = ['Fryzury', 'Zbroja', 'Bronie', 'Szarfa']

// Bronie/Zbroja/Szarfa are all generated from the FULL catalog below
// (colorSystemFullCatalog.json), built by scripts straight from
// translation.json (+ the ShapeData table for Zbroja) — nothing hand-picked
// left except the still-unwired "Bronie" skin icons (weapon reskin items,
// decorative only — no model wiring found for these, unlike everything else).
export const LOADOUT_ICON_IDS = {}

export const SKIN_LOADOUT_ICON_IDS = {
  'Bronie': ['41298', '41481', '41488', '41489', '41504', '41505', '41540', '41541'],
}

// "Bronie" is split into per-shape sub-tabs (only the ones the current
// class actually has weapons for are shown) instead of one flat list —
// otherwise e.g. Ninja's swords/daggers/bows all pile into one 85-icon grid.
export const WEAPON_SUBTYPE_LABELS = {
  SWORD: 'Jednoręczna',
  TWO_HANDED: 'Dwuręczna',
  DAGGER: 'Sztylet',
  BOW: 'Łuk',
  FAN: 'Wachlarz',
  BELL: 'Dzwon',
}
// Fixed display order (not alphabetical) — one-handed/two-handed first,
// then the more exotic per-class shapes.
const WEAPON_SUBTYPE_ORDER = ['SWORD', 'TWO_HANDED', 'DAGGER', 'BOW', 'FAN', 'BELL']

// Non-equippable Szarfa (no 3D wiring exists — see ARMOR_DEFS comment) plus
// a few generic labels kept by hand; every equippable weapon/armor/hair
// name comes from colorSystemFullCatalog.json.
export const ITEM_NAMES = {
  '30646': 'Sash Design', '83010': 'Sash Box', '70070': 'Shoulder Sash Transfer',
  '85001': 'Lord Sash (basic)', '85002': 'Lord Sash (fine)', '85003': 'Lord Sash (noble)',
  '85004': 'Lord Sash (custom)', '85005': 'Master Sash (basic)',
  '70065': 'Costume Bonus Transfer', '41001': 'Bunny Costume (brown)', '41002': 'Rabbit Costume (brown)',
  '41117': 'Musketeer Costume', '41137': 'Christmas Costume (red)', '41139': 'Christmas Costume (green)',
  '41141': 'Christmas Costume (black)', '41143': 'Reindeer Costume (m)', '41144': 'Reindeer Costume (f)',
  '41291': 'Rabbit Costume (black)', '41292': 'Rabbit Costume (blue)', '41293': 'Rabbit Costume (green)',
  '41294': 'Rabbit Costume (pink)', '41295': 'Bunny Costume (black)', '41296': 'Bunny Costume (blue)',
  '41297': 'Bunny Costume (green)', '41298': 'Bunny Costume (pink)', '41481': 'Snowman Costume',
  '41488': 'Pharaoh Costume (red)', '41489': 'Pharaoh Costume (blue)', '41504': 'Bunny Costume (grey)',
  '41505': 'Bunny Costume (brown)', '41540': 'Bunny Costume (white)', '41541': 'Bunny Costume (rose)',
  '41542': 'Bunny Costume (n. blue)', '41543': 'Bunny Costume (magenta)', '70063': 'Transform Costume',
  '70064': 'Enchant Costume', '41480': 'Santa Frosty Costume', '41670': 'Brown Wolf Costume (m)',
  '41671': 'Grey Wolf Costume (m)', '41672': 'Brown Wolf Costume (f)',
  ...fullCatalog.itemNames,
}

// Full, real weapon catalog per class/subtype — built straight from
// translation.json's per-class wearable flags (see colorSystemFullCatalog.json
// / build_full_catalog.cjs), not a hand-picked "base tier" subset anymore.
export const WEAPONS_BY_CLASS_SUBTYPE = fullCatalog.weaponsByClassSubtype
export function weaponIdsForClass(classId) {
  const subs = WEAPONS_BY_CLASS_SUBTYPE[classId] || {}
  return Object.values(subs).flat()
}
export function weaponSubtypesForClass(classId) {
  const subs = WEAPONS_BY_CLASS_SUBTYPE[classId] || {}
  return WEAPON_SUBTYPE_ORDER.filter((s) => subs[s]?.length)
}
export function weaponIdsForClassSubtype(classId, subtype) {
  return WEAPONS_BY_CLASS_SUBTYPE[classId]?.[subtype] || []
}

export function itemName(icon, fallback) {
  return ITEM_NAMES[icon] || fallback
}

// ---------- 3D asset wiring ----------

const ASSET_BASE = '/models/color-system'

// Each class has a REAL male and female body — m2icondb stores two body
// variants per race (folder "pc"/"pc2"; which one is male flips between
// Warrior/Sura vs Assassin/Shaman) plus a gender-matched motion glb
// (motions/{race}_m.glb vs _w.glb — confirmed both exist for every race,
// "_m"/"_w" really is male/female here, not an abbreviation of "motion").
function classAssets(classId) {
  const base = `${ASSET_BASE}/classes/${classId}`
  return {
    male: {
      body: `${base}/male/body.glb`, motion: `${base}/male/motion.glb`,
      bodyTex: `${base}/male/bodytex.dds`, faceTex: `${base}/male/facetex.dds`,
    },
    female: {
      body: `${base}/female/body.glb`, motion: `${base}/female/motion.glb`,
      bodyTex: `${base}/female/bodytex.dds`, faceTex: `${base}/female/facetex.dds`,
    },
  }
}
export const CLASS_ASSETS = {
  warrior: classAssets('warrior'),
  ninja: classAssets('ninja'),
  sura: classAssets('sura'),
  shaman: classAssets('shaman'),
}

// Grip transform, common to all one-handed swords — each class's hand bone
// has a genuinely different rest orientation (measured, not guessed), so
// this is per-class, not per-weapon.
export const SWORD_ROTATION_BY_CLASS = {
  warrior: [-13, 9, -25],
  ninja: [1, 19, 18],
  sura: [-4, 13, 2],
}
export const SWORD_POSITION_BY_CLASS = {
  warrior: [4.5, -1.5, 1],
  ninja: [9.5, -1.5, 0],
  sura: [11.5, -2, -4],
}
export const HAND_BONE_MATCH = 'R_Hand'
export const LEFT_HAND_BONE_MATCH = 'L_Hand'
// A sash drapes across the torso from the shoulder down, not from the hip —
// attached to the upper spine/shoulder-blade area (not Pelvis) for that.
// Best-effort starting point, not checked against a real render yet, unlike
// the weapon transforms above (which went through several live-calibration
// rounds) — first attempt was Pelvis + a downward offset, which the user
// confirmed sat too low, "on the hips instead of the shoulders."
export const PELVIS_BONE_MATCH = 'Spine2'
export const SASH_TARGET_LENGTH = 1.1
export const SASH_TRANSFORM = { position: [0, 0, 0], rotation: [0, 0, 0] }

// Ninja daggers are dual-wielded (one per hand) and held reverse/icepick
// style (blade running back along the forearm), NOT one-handed forward like
// a sword — a completely different grip from SWORD_ROTATION/POSITION_BY_CLASS
// above, live-calibrated by the user against a real render via a temporary
// in-page slider panel (ColorSystemViewer's DaggerCalibrationPanel, removed
// once these numbers were confirmed good).
export const DAGGER_POSITION_BY_CLASS = {
  ninja: [5.1, -3.1, -4.7],
}
export const DAGGER_ROTATION_BY_CLASS = {
  ninja: [-179, -19, -18],
}
export const DAGGER_OFFHAND_POSITION_BY_CLASS = {
  ninja: [2, 0.7, 0],
}
export const DAGGER_OFFHAND_ROTATION_BY_CLASS = {
  ninja: [9, -18, 24],
}
export const OFFHAND_WEAPON_SUBTYPES = ['DAGGER']

// Base body meshes ship bald (hair is a separate, skinned attachment — same
// idea as armor, just keyed through m2icondb's "HairData" table instead of
// "ShapeData"). A default hairstyle is auto-attached after each class loads
// so nobody's bald by default; the mesh is REBOUND onto the body's own
// skeleton (matched by bone name, e.g. "Bip01_Head") instead of using its
// own bundled skeleton, so it moves with the body's actual animation for
// free — see ColorSystemEngine.rebindHairToBody.
//
// GENDER: the canonical default (value3 "0", "hair_1_1" for every race) is
// confirmed BROKEN at the source for warrior/sura/shaman female specifically
// — re-downloaded fresh from m2icondb and it's byte-identical to what we
// already had, so this is a real upstream asset defect (an internal
// bind-pose/scale inconsistency), not a fetch bug on our end. Ninja's
// female hair_1_1 is fine. Rather than ship these three bald, they use
// "hair_2_1" instead (a different basic haircut shape from the same
// per-race hairstyle set, one number over) — verified working (passes the
// real post-skinning distance check in attachHairSafely, not just "doesn't
// throw") for all three. A genuine plain hairstyle, not a costume/hat item
// — Sura's happens to be a shorter cut than the other two, not a bug, just
// that shape's actual design.
function defaultHairAssets(classId) {
  const base = `${ASSET_BASE}/classes/${classId}`
  const maleDef = { model: `${base}/male/hair.glb`, tex: `${base}/male/hairtex.dds` }
  const femaleDef = { model: `${base}/female/hair.glb`, tex: `${base}/female/hairtex.dds` }
  return { male: maleDef, female: femaleDef }
}
export const DEFAULT_HAIR_ASSETS = {
  warrior: defaultHairAssets('warrior'),
  ninja: defaultHairAssets('ninja'),
  sura: defaultHairAssets('sura'),
  shaman: defaultHairAssets('shaman'),
}
DEFAULT_HAIR_ASSETS.warrior.female = { model: `${ASSET_BASE}/hair/pc2_warrior_hair_hair_2_1.glb`, tex: `${ASSET_BASE}/hair/pc2_warrior_hair_hair_2_1.dds` }
DEFAULT_HAIR_ASSETS.sura.female = { model: `${ASSET_BASE}/hair/pc2_sura_hair_hair_2_1.glb`, tex: `${ASSET_BASE}/hair/pc2_sura_hair_hair_2_1.dds` }
DEFAULT_HAIR_ASSETS.shaman.female = { model: `${ASSET_BASE}/hair/pc_shaman_hair_hair_2_1.glb`, tex: `${ASSET_BASE}/hair/pc_shaman_hair_hair_2_1.dds` }

export const WEAPON_SUBTYPE_BY_ICON = fullCatalog.weaponSubtypeByIcon

// Per-subtype auto-fit target length (world units) — a bell reads much
// "bulkier" than a sword at the same max-bounding-box target since its
// raw shape is closer to a sphere, and a two-handed polearm should read
// as visibly longer than a one-handed sword, not the same size.
// BOW: a pixel-measurement pass against m2icondb's own reference render
// landed on 1.2, but the user checked it live and asked for 2x that —
// trusting their real render over the screenshot measurement.
export const WEAPON_TARGET_LENGTH_BY_SUBTYPE = { SWORD: 0.9, DAGGER: 0.55, BOW: 2.4, TWO_HANDED: 1.55, FAN: 0.55, BELL: 0.4 }

// Every bow's raw mesh has its own proportions and bounding-box offset (not
// baked into a shared scene-root transform), so one shared target length +
// auto-centering only gets most bows close — a handful (e.g. Giant Devil Bow)
// were still badly off. User live-calibrated all 27 ninja bows by hand via
// the in-app WeaponScalePanel sliders; these absolute values are used
// verbatim instead of the auto-fit heuristic whenever a match exists.
export const BOW_CALIBRATION_BY_ICON = {
  '02200': { size: 1.72, pos: [-6.60, 2.30, 4.34], rot: [0, 0, 0] }, // Zodiac Bow+0
  '02500': { size: 1.81, pos: [-3.80, 1.10, 1.10], rot: [0, 0, 0] }, // Kyanite Bow+0
  '21902': { size: 1.57, pos: [-3.80, 0.50, 0.89], rot: [0, 0, 0] }, // Dreamcatcher
  '02000': { size: 1.13, pos: [-3.80, -2.30, 3.34], rot: [0, 0, 0] }, // Bow+0
  '02010': { size: 1.21, pos: [-5.30, 0.50, 2.02], rot: [0, 0, 0] }, // Long Bow+0
  '02020': { size: 1.22, pos: [-3.50, 0.50, 1.26], rot: [0, 0, 0] }, // Composite Bow+0
  '02030': { size: 1.34, pos: [-4.40, -2.00, 3.16], rot: [0, 0, 0] }, // Battle Bow+0
  '02040': { size: 1.35, pos: [-2.90, -1.70, 1.10], rot: [0, 0, 0] }, // Horseback Long Bow+0
  '02050': { size: 1.44, pos: [-3.50, 1.10, 0.50], rot: [0, 0, 0] }, // Horseback Battle Bow+0
  '02060': { size: 1.58, pos: [-4.40, -1.40, 2.00], rot: [0, 0, 0] }, // Copper Crafted Bow+0
  '02070': { size: 1.60, pos: [-4.40, -1.40, 3.80], rot: [0, 0, 0] }, // Black Ruin Bow+0
  '02080': { size: 1.43, pos: [-3.50, -1.10, 4.60], rot: [0, 0, 0] }, // Red Eye Bow+0
  '02090': { size: 1.63, pos: [-3.80, -2.60, 0.87], rot: [0, 0, 0] }, // Thorn Leaf Bow+0
  '02100': { size: 1.58, pos: [-4.10, -1.70, 0.80], rot: [0, 0, 0] }, // Bull's Horn Bow+0
  '02110': { size: 1.76, pos: [-5.30, 0.20, 3.20], rot: [0, 0, 0] }, // Unicorn Bow+0
  '02120': { size: 1.73, pos: [-2.60, -2.00, 1.40], rot: [0, 0, 0] }, // Giant Wing Bow+0
  '02130': { size: 2.03, pos: [-4.10, -1.10, 2.90], rot: [0, 0, 0] }, // Divine Apricot Bow+0
  '02140': { size: 1.80, pos: [-3.50, -2.30, 1.40], rot: [-15, 12, 0] }, // Yellow Dragon Bow+0
  '02150': { size: 1.67, pos: [-4.10, 1.40, -1.70], rot: [0, 0, 0] }, // Hornbow+0
  '02160': { size: 2.48, pos: [0.20, 1.40, 4.40], rot: [-7, 26, 0] }, // Giant Devil Bow+0
  '02170': { size: 2.21, pos: [-3.20, 0.20, 1.30], rot: [0, 0, 0] }, // Crow Steel Bow+0
  '02180': { size: 2.03, pos: [-5.30, 0.00, 4.43], rot: [0, 0, 0] }, // Blue Dragon Bow+0
  '02190': { size: 2.07, pos: [-4.40, -0.20, 2.00], rot: [0, 0, 0] }, // Ghost Crossbow+0
  '02210': { size: 1.78, pos: [-5.00, -7.20, -1.36], rot: [0, 0, 0] }, // Gloom Dragon Bow+0
  '02230': { size: 1.65, pos: [-4.10, 0.00, 0.00], rot: [0, 0, 0] }, // Serpent Bow+0
  '02250': { size: 1.61, pos: [-4.70, 1.70, 2.90], rot: [0, 0, 0] }, // Moonshine Bow+0
  '02370': { size: 1.70, pos: [-4.40, -0.50, 4.40], rot: [0, 10, 0] }, // Phoenix Bow +0
}

// Fan/bell meshes are authored with their long axis along X/Z instead of a
// sword's Y, so the sword transform doesn't carry over.
export const WEAPON_TRANSFORM_OVERRIDE = {
  FAN: { position: [7, 2, -4], rotation: [0, -3, 23] },
  BELL: { position: [0, 0, 0], rotation: [0, 0, 0] },
}

// Real per-class hold-pose clips, shipped in the same motion glb already
// used for idling — dumped every clip name to confirm these exist:
// warrior: wait, wedding, onehand_sword, twohand_sword
// assassin (ninja): wait, wedding, bow, dualhand_sword, onehand_sword
// sura: wait, wedding, onehand_sword
// shaman: wait, wedding, bell, fan
export const WEAPON_POSE_CLIP = {
  warrior: { SWORD: 'onehand_sword', TWO_HANDED: 'twohand_sword' },
  ninja: { SWORD: 'onehand_sword', DAGGER: 'dualhand_sword', BOW: 'bow' },
  shaman: { BELL: 'bell', FAN: 'fan' },
}

export const WEAPON_ASSET_URL = (icon) => `${ASSET_BASE}/weapons/${icon}.glb`

// Weapon glbs carry no baked texture and no per-icon .dds — but their single
// material's NAME (e.g. "item/weapon/weapon_chogeup_01") turned out to
// resolve to a real, shared texture atlas at the same base URL
// (weapons/weapon_chogeup_01.dds). Only 19 distinct atlases cover all 175
// weapon items. Built once via a script matching each weapon glb's
// materials[0].name against what actually 200s on that CDN path.
export const WEAPON_ATLAS_BY_ICON = weaponAtlasMapping
export const WEAPON_ATLAS_URL = (atlasName) => `${ASSET_BASE}/weapons/atlases/${atlasName}.dds`

// Body armor swap — a REAL mesh+texture swap (Metin2's armor items don't
// carry their own "model" field; the model comes from m2icondb's separate
// ShapeData table keyed by the item's value3, one table per race+gender).
// FULL catalog now (24ish per class, ~90 total after a handful of 404s on
// m2icondb's own CDN — wedding/tuxedo costumes and one shaman piece aren't
// hosted there) — see colorSystemFullCatalog.json / build_full_catalog.cjs.
// Many items within a class share one body mesh (different value3 tiers of
// the same armor "shape" family, different skin only), so modelFile often
// repeats across a class's entries — that's expected, not a bug.
//
// GENDER: each entry carries BOTH a male and female mesh+skin (looked up
// from the OTHER race+gender ShapeData table by the same item's value3 —
// see build_gender_aware_catalog.cjs). The catalog was originally built
// from only one gender's ShapeData table per class (whichever folder,
// "pc" or "pc2", m2icondb calls male flips per race — pc=male for
// warrior/sura but pc2=male for assassin/shaman), so the missing gender
// silently fell back to a body mesh built for the other one entirely
// (ninja had NO male armor mesh at all; warrior/sura had no female one;
// shaman had no male one) — this now fetches and fills in the real
// missing-gender mesh for every item, falling back to reusing the other
// gender's mesh only for the handful of items that are genuinely
// gender-locked in the game (no shape entry exists for them at all).
export const ARMOR_DEFS = {}
export const ARMOR_IDS_BY_CLASS = {}
for (const [classId, items] of Object.entries(fullCatalog.armorByClass)) {
  ARMOR_IDS_BY_CLASS[classId] = items.map((it) => it.icon)
  for (const it of items) {
    ARMOR_DEFS[it.icon] = {
      classId,
      male: { body: `${ASSET_BASE}/armor/${it.male.modelFile}`, skin: `${ASSET_BASE}/armor/${it.male.skinFile}` },
      female: { body: `${ASSET_BASE}/armor/${it.female.modelFile}`, skin: `${ASSET_BASE}/armor/${it.female.skinFile}` },
    }
  }
}

// Costumes ("Skiny" tab, Zbroja category) use the EXACT same mesh+skin swap
// mechanism as armor — COSTUME_BODY items resolve through the identical
// ShapeData table, just under a different, much bigger value3 range (see
// project notes). One representative skin per unique costume SHAPE (~70-90
// exist per race) — the full set, not a capped subset.
// Keyed by "classId:icon", NOT just icon — unlike armor (class-restricted),
// the SAME costume icon can legitimately appear in more than one class's
// list (costumes are gender-restricted, not class-restricted, so e.g.
// Warrior and Sura — both rendered male here — both offer "Desert Warrior
// (M)"), each with its own race-specific model/skin file. Keying by icon
// alone caused later classes to silently overwrite earlier ones' entry.
//
// REAL GENDER PAIRING: costume (and hair, below) items in m2icondb's own
// data are NOT "one icon with a male+female skin" — they're two SEPARATE
// items with different icons/names sharing the same value3 shape index
// (e.g. icon 41001 "Rabbit Costume (m)" / 41002 "Bunny Costume (f)", both
// value3=40031) — confirmed by cross-referencing translation.json's
// `requires: "for male"/"for female"` flags. Selecting a gender must swap
// to the SIBLING icon+name, not just relabel the same one — each catalog
// entry below carries both sides (maleIcon/maleName + femaleIcon/femaleName,
// falling back to itself on either side for the items with no real
// opposite-gender counterpart in the game's own data).
export const COSTUME_DEFS = {}
export const COSTUME_IDS_BY_CLASS = {}
export const COSTUME_PAIRS_BY_CLASS = {}
for (const [classId, items] of Object.entries(fullCatalog.costumeByClass || {})) {
  COSTUME_PAIRS_BY_CLASS[classId] = items
  const iconSet = new Set()
  for (const it of items) {
    iconSet.add(it.maleIcon)
    iconSet.add(it.femaleIcon)
    const meshDef = {
      classId,
      male: { body: `${ASSET_BASE}/costumes/${it.male.modelFile}`, skin: `${ASSET_BASE}/costumes/${it.male.skinFile}` },
      female: { body: `${ASSET_BASE}/costumes/${it.female.modelFile}`, skin: `${ASSET_BASE}/costumes/${it.female.skinFile}` },
    }
    COSTUME_DEFS[`${classId}:${it.maleIcon}`] = meshDef
    COSTUME_DEFS[`${classId}:${it.femaleIcon}`] = meshDef
  }
  COSTUME_IDS_BY_CLASS[classId] = Array.from(iconSet)
}
export function costumeDefFor(classId, icon) {
  return COSTUME_DEFS[`${classId}:${icon}`]
}
// Gender-appropriate icon list for the loadout grid — one icon per shape,
// whichever side (male/female) matches the given gender (real name comes
// from itemName(icon) as usual — ITEM_NAMES already carries the correct,
// tagged name for each specific icon). `onlyGender` ('M'/'F') marks items
// with NO real counterpart anywhere in the game's own data (verified, not
// guessed — e.g. "Santa Frosty Costume" is genuinely male-only) — these are
// dropped from the OTHER gender's list entirely instead of falling back to
// showing the wrong-gender body/face, which is what the user actually
// flagged as broken.
export function costumeIconsForClass(classId, gender) {
  const pairs = COSTUME_PAIRS_BY_CLASS[classId] || []
  const wantGender = gender === 'female' ? 'F' : 'M'
  return pairs
    .filter((it) => !it.onlyGender || it.onlyGender === wantGender)
    .map((it) => (gender === 'female' ? it.femaleIcon : it.maleIcon))
}

// Hairstyles ("Skiny" tab, Fryzury category — replaces the non-functional
// Hełm slot) — same HairData table + same gender-pairing as costumes above
// (composite key + maleIcon/femaleIcon sibling pairs). Full catalog,
// ~80-90 per class (COSTUME_HAIR items in translation.json — includes
// actual hats/masks too, not just hair).
// GENDER (mesh): originally built from only ONE gender's HairData table per
// class (unlike ARMOR_DEFS/COSTUME_DEFS, which already had both) — confirmed
// via live network capture that selecting Kobieta and equipping a Fryzura
// still loaded the male ("pc"/"pc2", whichever that race's male folder is)
// mesh. Re-resolved both genders directly from m2icondb's own HairData
// table (assets.m2icondb.com/models/new/armors/{race-folder}/{race}/hair/),
// same mechanism as ARMOR_DEFS.
// GENDER (icon/name): see COSTUME_PAIRS_BY_CLASS comment above — same real
// sibling-icon pairing, not a relabel.
export const HAIR_DEFS = {}
export const HAIR_IDS_BY_CLASS = {}
export const HAIR_PAIRS_BY_CLASS = {}
for (const [classId, items] of Object.entries(fullCatalog.hairByClass || {})) {
  HAIR_PAIRS_BY_CLASS[classId] = items
  const iconSet = new Set()
  for (const it of items) {
    iconSet.add(it.maleIcon)
    iconSet.add(it.femaleIcon)
    const meshDef = {
      classId,
      male: { model: `${ASSET_BASE}/hair/${it.male.modelFile}`, tex: `${ASSET_BASE}/hair/${it.male.skinFile}` },
      female: { model: `${ASSET_BASE}/hair/${it.female.modelFile}`, tex: `${ASSET_BASE}/hair/${it.female.skinFile}` },
    }
    HAIR_DEFS[`${classId}:${it.maleIcon}`] = meshDef
    HAIR_DEFS[`${classId}:${it.femaleIcon}`] = meshDef
  }
  HAIR_IDS_BY_CLASS[classId] = Array.from(iconSet)
}
export function hairDefFor(classId, icon) {
  return HAIR_DEFS[`${classId}:${icon}`]
}
export function hairIconsForClass(classId, gender) {
  const pairs = HAIR_PAIRS_BY_CLASS[classId] || []
  const wantGender = gender === 'female' ? 'F' : 'M'
  return pairs
    .filter((it) => !it.onlyGender || it.onlyGender === wantGender)
    .map((it) => (gender === 'female' ? it.femaleIcon : it.maleIcon))
}

// Sashes ("Szarfa") turned out to be the EASY case, unlike armor/hair — the
// item's own "model" field already resolves directly (e.g. icon "85001" ->
// "wing/acce_01_85_001"), no ShapeData/value3 indirection needed, same as
// weapons. Also not class- or gender-restricted at all in translation.json
// (any class can wear any sash), so this is ONE global list, not per-class.
// Same shared-texture-atlas trick as weapons (10 atlases cover all 72 items).
export const SASH_IDS = fullCatalog.sashIds || []
export const SASH_ATLAS_BY_ICON = sashAtlasMapping
export const SASH_ASSET_URL = (icon) => `${ASSET_BASE}/sash/${icon}.glb`
export const SASH_ATLAS_URL = (atlasName) => `${ASSET_BASE}/sash/atlases/${atlasName}.dds`

export const ICON_URL = (icon) => `https://img.m2icondb.com/${icon}.png`

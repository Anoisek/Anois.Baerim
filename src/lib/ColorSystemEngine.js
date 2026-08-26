import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DDSLoader } from 'three/examples/jsm/loaders/DDSLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  CLASS_ASSETS, SWORD_ROTATION_BY_CLASS, SWORD_POSITION_BY_CLASS, HAND_BONE_MATCH, LEFT_HAND_BONE_MATCH,
  PELVIS_BONE_MATCH, SASH_TARGET_LENGTH, SASH_TRANSFORM, SASH_ASSET_URL, SASH_ATLAS_BY_ICON, SASH_ATLAS_URL,
  WEAPON_SUBTYPE_BY_ICON, WEAPON_TARGET_LENGTH_BY_SUBTYPE, WEAPON_TRANSFORM_OVERRIDE,
  WEAPON_POSE_CLIP, WEAPON_ASSET_URL, WEAPON_ATLAS_BY_ICON, WEAPON_ATLAS_URL,
  ARMOR_DEFS, COSTUME_DEFS, HAIR_DEFS, DEFAULT_HAIR_ASSETS, OFFHAND_WEAPON_SUBTYPES, hairIconsForClass,
  DAGGER_POSITION_BY_CLASS, DAGGER_ROTATION_BY_CLASS, DAGGER_OFFHAND_POSITION_BY_CLASS, DAGGER_OFFHAND_ROTATION_BY_CLASS,
  BOW_CALIBRATION_BY_ICON,
} from './colorSystemCatalog'

const gltfLoader = new GLTFLoader()
const ddsLoader = new DDSLoader()

function loadGltf(url) {
  return new Promise((resolve, reject) => gltfLoader.load(url, resolve, undefined, reject))
}
function loadDds(url) {
  return new Promise((resolve, reject) => ddsLoader.load(url, resolve, undefined, reject))
}

// A handful of shared texture atlases cover all real weapon items — cached
// once per atlas name so switching weapons doesn't re-fetch/re-decode a DDS
// every click.
const weaponAtlasCache = new Map()
function loadWeaponAtlas(atlasName) {
  if (!weaponAtlasCache.has(atlasName)) weaponAtlasCache.set(atlasName, loadDds(WEAPON_ATLAS_URL(atlasName)))
  return weaponAtlasCache.get(atlasName)
}
const sashAtlasCache = new Map()
function loadSashAtlas(atlasName) {
  if (!sashAtlasCache.has(atlasName)) sashAtlasCache.set(atlasName, loadDds(SASH_ATLAS_URL(atlasName)))
  return sashAtlasCache.get(atlasName)
}

function applyClassTextures(model, bodyTex, faceTex) {
  model.traverse((node) => {
    if (!node.isMesh) return
    const wasArray = Array.isArray(node.material)
    const mats = wasArray ? node.material : [node.material]
    const newMats = mats.map((m) => {
      const isFace = m && m.name && /face/i.test(m.name)
      return new THREE.MeshStandardMaterial({ map: isFace ? faceTex : bodyTex, roughness: 0.85, metalness: 0.02 })
    })
    node.material = wasArray ? newMats : newMats[0]
  })
}

// Hair glbs ship their OWN full skeleton (identical bone names to the body,
// e.g. "Bip01 Head", plus a few extra ponytail-only bones) because they're a
// skinned mesh, not a rigid attachment. Rebinding the hair's SkinnedMesh
// onto the BODY's actual bone objects (matched by name) makes it move with
// the body's real animation for free — no per-frame syncing needed. Ponytail
// bones with no counterpart on the body just keep their bind pose (no sway),
// which is an acceptable trade for "not bald" rather than full hair physics.
function rebindHairToBody(hairGltf, bodyModel, hairTex) {
  let hairMesh = null
  hairGltf.scene.traverse((n) => { if (n.isSkinnedMesh) hairMesh = n })
  if (!hairMesh) return null

  const bodyBones = {}
  bodyModel.traverse((n) => { if (n.isBone) bodyBones[n.name] = n })

  // A handful of hair-only bones (ponytail links, "Nub" end caps, extra
  // cloth-sim helper bones) have no match on the base body skeleton — that's
  // normal and harmless most of the time (those vertices just stay rigidly
  // wherever the nearest matched ancestor puts them). Falling back to the
  // body's Head bone for an unmatched joint is a safer default than reusing
  // the hair's own original bone object (which is still part of the never-
  // added-to-the-scene hair.scene graph, so its matrixWorld can be stale).
  // BUG FOUND (this was the actual root cause of the "hair shoots into the
  // air" issue, not the boneInverse math below — that fix was correct but
  // dead code, since this lookup NEVER matched anything): THREE's GLTFLoader
  // sanitizes bone names, replacing spaces with underscores at parse time
  // (PropertyBinding.sanitizeNodeName) — the actual runtime bone is named
  // "Bip01_Head", not "Bip01 Head". headFallback silently resolved to null
  // 100% of the time, so every genuinely-unmatched hair bone (ponytail
  // links etc.) fell through to reusing the hair's OWN original bone object
  // — never added to the live scene, so its matrixWorld is stale garbage —
  // producing the wild, far-flung vertex offsets.
  const headFallback = bodyBones['Bip01_Head'] || null
  bodyModel.updateMatrixWorld(true)
  // ROOT CAUSE (previously undiagnosed — see attachHairSafely below): a
  // fallback bone MUST get a boneInverse computed from ITS OWN current world
  // matrix, not the original hair skeleton's inverse for that joint slot.
  // The original inverse assumes the hair's OWN bind-pose position for that
  // bone (e.g. a ponytail tip sitting well behind/below the head) — pairing
  // that stale inverse with the head bone's actual (different) world matrix
  // produces a wildly wrong transform, sending those vertices flying off in
  // a straight line away from the head. A fresh inverse from the head's own
  // current matrix makes the joint resolve to "rigidly coincident with the
  // head, zero offset" instead, which is what a sane fallback should mean.
  const headFallbackInverse = headFallback ? new THREE.Matrix4().copy(headFallback.matrixWorld).invert() : null
  // Diagnosed with a live skinning probe (window.__hairDebug): some body/
  // costume meshes DO carry a same-named "Bip01_PonytailNN" bone (inherited
  // from the shared base rig) but leave it un-posed / parked far from the
  // head on that particular mesh — the name-match above trusted it anyway,
  // producing a vertex ~55 units from the head instead of ~1.5. These
  // hair-exclusive helper bones are never part of the actual body animation
  // skeleton, so a name match on the body is not trustworthy for them —
  // always pin them to the head fallback instead of trusting a same-named
  // body bone.
  const isHairOnlyBoneName = (name) => /ponytail/i.test(name)
  const newBones = []
  const newBoneInverses = []
  hairMesh.skeleton.bones.forEach((b, i) => {
    const matched = !isHairOnlyBoneName(b.name) && bodyBones[b.name]
    if (matched) {
      newBones.push(matched)
      newBoneInverses.push(hairMesh.skeleton.boneInverses[i])
    } else if (headFallback) {
      newBones.push(headFallback)
      newBoneInverses.push(headFallbackInverse)
    } else {
      newBones.push(b)
      newBoneInverses.push(hairMesh.skeleton.boneInverses[i])
    }
  })
  const newSkeleton = new THREE.Skeleton(newBones, newBoneInverses)
  hairMesh.bind(newSkeleton, hairMesh.matrixWorld)

  // The two fixes above (sanitized bone name, fresh fallback inverse, and
  // excluding untrustworthy same-named ponytail bones) eliminate the
  // diagnosed causes, but this rig has 8 different body/hair asset pairs
  // (4 races x 2 sexes) and there's no guarantee every combination is
  // internally consistent — some may still have a genuine bind-pose
  // mismatch between the hair asset's own skeleton and that specific body.
  // Rather than trust that in the dark, actually COMPUTE each vertex's real
  // post-skinning world position (the naive Box3-on-bind-pose check below
  // this function couldn't do this — it reads the undeformed rest geometry,
  // which looks perfectly normal-sized even when the skinned result is
  // wildly stretched) and report the worst-case distance from the head, so
  // attachHairSafely can reliably drop a broken result instead of shipping
  // a visible flying-texture artifact.
  newSkeleton.update()
  const posAttr = hairMesh.geometry.attributes.position
  const skinIndex = hairMesh.geometry.attributes.skinIndex
  const skinWeight = hairMesh.geometry.attributes.skinWeight
  const v = new THREE.Vector3()
  const skinned = new THREE.Vector3()
  const boneMat = new THREE.Matrix4()
  const tmp = new THREE.Vector3()
  const headPos = headFallback ? new THREE.Vector3().setFromMatrixPosition(headFallback.matrixWorld) : new THREE.Vector3()
  let maxDistFromHead = 0
  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i)
    skinned.set(0, 0, 0)
    for (let j = 0; j < 4; j++) {
      const w = skinWeight.getComponent(i, j)
      if (w === 0) continue
      const boneIdx = skinIndex.getComponent(i, j)
      boneMat.multiplyMatrices(newSkeleton.bones[boneIdx].matrixWorld, newSkeleton.boneInverses[boneIdx])
      tmp.copy(v).applyMatrix4(boneMat).multiplyScalar(w)
      skinned.add(tmp)
    }
    const dist = skinned.distanceTo(headPos)
    if (dist > maxDistFromHead) maxDistFromHead = dist
  }
  hairMesh.userData.maxDistFromHead = maxDistFromHead

  hairMesh.material = new THREE.MeshStandardMaterial({ map: hairTex, roughness: 0.6, metalness: 0.02 })
  hairMesh.position.set(0, 0, 0)
  hairMesh.rotation.set(0, 0, 0)
  hairMesh.scale.setScalar(1)
  return hairMesh
}

// Belt-and-braces guard around the rebind above: SOME specific hair/body
// combinations (confirmed: Sura's female default hairstyle) still come out
// with part of the mesh stretched wildly away from the head even with the
// Head-bone fallback above — root cause not fully pinned down (likely a
// bind-pose mismatch for one specific bone between this particular hair
// asset and this particular body rig, not something a same-name lookup can
// detect). Rather than ship a visible flying shard, measure the attached
// mesh's actual world-space size against the body right after binding and
// silently drop it (bald beats broken) if it's grossly oversized.
function attachHairSafely(bodyModel, hairMesh) {
  if (!hairMesh) return false
  // Measure the body's own height BEFORE attaching the hair — Box3 reads
  // every descendant's raw (untransformed) geometry bounds, so a broken
  // hair mesh with one corrupted/unbound vertex sitting far from origin in
  // its own raw local space would otherwise inflate "body height" itself
  // (self-contaminating the very check meant to catch it).
  bodyModel.updateMatrixWorld(true)
  const preBodyBox = new THREE.Box3().setFromObject(bodyModel)
  const preBodyHeight = preBodyBox.getSize(new THREE.Vector3()).y || 1
  bodyModel.add(hairMesh)
  bodyModel.updateMatrixWorld(true)
  // Use the REAL post-skinning distance computed in rebindHairToBody, not a
  // Box3 on the mesh — Box3.setFromObject reads the undeformed bind-pose
  // geometry for a SkinnedMesh, which looks normal-sized even when the
  // actual GPU-skinned result is stretched way off (this is why the old
  // check never caught the "hair shoots into the sky" bug: the bind pose
  // itself was fine, only the runtime deformation was broken).
  const maxDistFromHead = hairMesh.userData.maxDistFromHead ?? 0
  if (maxDistFromHead > preBodyHeight * 0.75) {
    console.warn('Dropping a hairstyle whose real (skinned) geometry strayed too far from the head — likely a bind-pose mismatch:', maxDistFromHead.toFixed(2), 'vs body height', preBodyHeight.toFixed(2))
    bodyModel.remove(hairMesh)
    return false
  }
  return true
}

function findHandBone(model) {
  let bone = null
  model.traverse((node) => { if (node.isBone && node.name.includes(HAND_BONE_MATCH)) bone = node })
  return bone
}
function findLeftHandBone(model) {
  let bone = null
  model.traverse((node) => { if (node.isBone && node.name.includes(LEFT_HAND_BONE_MATCH)) bone = node })
  return bone
}
function findPelvisBone(model) {
  let bone = null
  model.traverse((node) => { if (node.isBone && node.name.includes(PELVIS_BONE_MATCH)) bone = node })
  return bone
}

function fitAndCenter(model) {
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z) || 1
  const scale = 1.7 / maxDim
  model.scale.setScalar(scale)
  model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)
}

// Live, persistent Three.js scene for the color-system character preview —
// classes/weapons/armor are cached once loaded so switching back and forth
// is instant. Ported from the "Aura Forge" Claude Artifact prototype (same
// underlying calibration data), rewired from base64-embedded assets to
// plain fetch()'d files under /public/models/color-system/, since this
// runs on our own domain with no CSP/size constraints.
export class ColorSystemEngine {
  constructor(container) {
    this.container = container
    this.classes = {} // classId -> currently-displayed entry (may be armor/costume-swapped)
    this.bodyCache = {} // "classId:gender" -> loaded base-body entry, kept forever once loaded
    this.activeClassId = null
    this.activeGender = null
    this.armorLoadToken = 0

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0b0906)

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
    this.camera.position.set(0, 1.4, 3.2)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(this.renderer.domElement)

    const ambient = new THREE.AmbientLight(0xfff2dd, 0.7)
    const key = new THREE.DirectionalLight(0xffe6bf, 1.4)
    key.position.set(2, 4, 3)
    const rim = new THREE.DirectionalLight(0x8fb2ff, 0.55)
    rim.position.set(-3, 2, -2)
    this.scene.add(ambient, key, rim)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 1
    this.controls.maxDistance = 8
    this.controls.target.set(0, 1, 0)

    this.resizeObserver = new ResizeObserver(() => this._resize())
    this.resizeObserver.observe(container)
    this._resize()

    this.clock = new THREE.Clock()
    this._disposed = false
    this._animate = this._animate.bind(this)
    this._frameId = requestAnimationFrame(this._animate)
    if (typeof window !== 'undefined') window.__colorSystemEngine = this
  }

  _resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  _animate() {
    if (this._disposed) return
    this._frameId = requestAnimationFrame(this._animate)
    const delta = this.clock.getDelta()
    const mixers = new Set()
    Object.values(this.bodyCache).forEach((c) => { if (c.mixer) mixers.add(c.mixer) })
    Object.values(this.classes).forEach((c) => { if (c.mixer) mixers.add(c.mixer) })
    mixers.forEach((m) => m.update(delta))
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  async _attachDefaultHair(classId, gender, bodyModel, entry) {
    const hairDef = DEFAULT_HAIR_ASSETS[classId]?.[gender]
    if (hairDef) {
      const [hairGltf, hairTex] = await Promise.all([loadGltf(hairDef.model), loadDds(hairDef.tex)])
      if (this._disposed) return
      const hairMesh = rebindHairToBody(hairGltf, bodyModel, hairTex)
      if (hairMesh && attachHairSafely(bodyModel, hairMesh) && entry) { entry.hairMesh = hairMesh; return }
    }
    // The dedicated "default hairstyle" asset (hair_1_1) is confirmed
    // internally scale-inconsistent with its own body for 3 of 4 female
    // rigs (warrior/sura/shaman — verified byte-identical to a fresh
    // re-download from m2icondb, so this is an upstream asset issue, not a
    // fetch/caching bug on our end) — attachHairSafely correctly refuses to
    // show the resulting stretched mesh, but "nobody's bald by default" was
    // the whole point of auto-attaching a hairstyle in the first place.
    // Fall back to the first Fryzury catalog entry that actually binds
    // safely for this class/gender instead of leaving it bald.
    if (!hairDef || !entry?.hairMesh) {
      const candidates = hairIconsForClass(classId, gender)
      for (const icon of candidates) {
        const def = HAIR_DEFS[`${classId}:${icon}`]
        const genderedDef = def?.[gender]
        if (!genderedDef) continue
        try {
          // eslint-disable-next-line no-await-in-loop
          const [hairGltf, hairTex] = await Promise.all([loadGltf(genderedDef.model), loadDds(genderedDef.tex)])
          if (this._disposed) return
          const hairMesh = rebindHairToBody(hairGltf, bodyModel, hairTex)
          if (hairMesh && attachHairSafely(bodyModel, hairMesh)) {
            if (entry) { entry.hairMesh = hairMesh; entry.hairIcon = icon }
            return
          }
        } catch {
          // try the next candidate
        }
      }
    }
  }

  // Swaps out whatever hair mesh is currently on a class's body for a real,
  // named hairstyle item — independent of body/armor (just removes+re-adds
  // the hair mesh, doesn't touch the rest of the model).
  async equipHair(classId, icon) {
    const def = HAIR_DEFS[`${classId}:${icon}`]
    const entry = this.classes[classId]
    if (!def || !entry) return
    const genderedDef = def[entry.gender] || def.male || def.female
    const myToken = ++entry._hairToken || (entry._hairToken = 1)
    const [hairGltf, hairTex] = await Promise.all([loadGltf(genderedDef.model), loadDds(genderedDef.tex)])
    if (this._disposed || entry._hairToken !== myToken) return
    if (entry.hairMesh) entry.model.remove(entry.hairMesh)
    entry.hairMesh = null
    const hairMesh = rebindHairToBody(hairGltf, entry.model, hairTex)
    if (hairMesh && attachHairSafely(entry.model, hairMesh)) {
      entry.hairMesh = hairMesh
      entry.hairIcon = icon
    }
  }

  // Every class has a real male AND female body (see CLASS_ASSETS) — both
  // get loaded once and cached (keyed "classId:gender") so toggling gender
  // back and forth is instant after the first load of each, same as
  // switching between classes.
  async loadClassGender(classId, gender) {
    const key = `${classId}:${gender}`
    if (this.bodyCache[key]) return this.bodyCache[key]
    const def = CLASS_ASSETS[classId][gender]
    const [gltf, bodyTex, faceTex] = await Promise.all([
      loadGltf(def.body), loadDds(def.bodyTex), loadDds(def.faceTex),
    ])
    if (this._disposed) return null
    const model = gltf.scene
    fitAndCenter(model)
    applyClassTextures(model, bodyTex, faceTex)
    model.visible = false
    this.scene.add(model)
    const handBone = findHandBone(model)
    const leftHandBone = findLeftHandBone(model)
    const pelvisBone = findPelvisBone(model)

    const motionGltf = await loadGltf(def.motion)
    if (this._disposed) return null
    const mixer = new THREE.AnimationMixer(model)
    const clips = motionGltf.animations
    const waitClip = clips.find((a) => a.name === 'wait')
    const action = waitClip ? mixer.clipAction(waitClip).play() : null

    const entry = { model, mixer, handBone, leftHandBone, pelvisBone, weaponModel: null, offhandModel: null, hairMesh: null, sashModel: null, clips, action, weaponSubtype: null, gender }
    this._attachDefaultHair(classId, gender, model, entry)
    this.bodyCache[key] = entry
    return entry
  }

  async showClass(classId, gender) {
    const entry = await this.loadClassGender(classId, gender)
    if (!entry) return null
    Object.values(this.bodyCache).forEach((c) => { c.model.visible = false })
    entry.model.visible = true
    this.classes[classId] = entry
    this.activeClassId = classId
    this.activeGender = gender
    return entry
  }

  _setPose(entry, clipName) {
    if (!entry?.clips) return
    const clip = entry.clips.find((a) => a.name === clipName) || entry.clips.find((a) => a.name === 'wait')
    if (!clip) return
    const nextAction = entry.mixer.clipAction(clip)
    if (entry.action && entry.action !== nextAction) entry.action.fadeOut(0.15)
    nextAction.reset().fadeIn(0.15).play()
    entry.action = nextAction
  }

  async equipWeapon(classId, icon) {
    const entry = this.classes[classId]
    if (!entry || !entry.handBone) return
    const myToken = ++entry._weaponToken || (entry._weaponToken = 1)
    const atlasName = WEAPON_ATLAS_BY_ICON[icon]
    const subtype = WEAPON_SUBTYPE_BY_ICON[icon]
    const needsOffhand = OFFHAND_WEAPON_SUBTYPES.includes(subtype) && !!entry.leftHandBone
    // Daggers get a genuinely SEPARATE glb load for the off-hand copy, not
    // wm.clone() — the user asked for this directly ("wygeneruj drugi
    // model"), and it also rules out any clone()-specific quirk as a cause
    // of the offhand's earlier invisibility.
    const [gltf, atlasTex, offGltf] = await Promise.all([
      loadGltf(WEAPON_ASSET_URL(icon)),
      atlasName ? loadWeaponAtlas(atlasName).catch(() => null) : Promise.resolve(null),
      needsOffhand ? loadGltf(WEAPON_ASSET_URL(icon)) : Promise.resolve(null),
    ])
    if (this._disposed || entry._weaponToken !== myToken) return
    if (entry.weaponModel) entry.weaponModel.removeFromParent()
    if (entry.offhandModel) entry.offhandModel.removeFromParent()
    entry.offhandModel = null
    const wm = gltf.scene
    const applyWeaponMaterial = (root) => {
      root.traverse((node) => {
        if (node.isMesh) {
          node.material = atlasTex
            ? new THREE.MeshStandardMaterial({ map: atlasTex, roughness: 0.5, metalness: 0.3 })
            : new THREE.MeshStandardMaterial({ color: 0xb7c3d6, roughness: 0.65, metalness: 0.25 })
        }
      })
    }
    applyWeaponMaterial(wm)
    const override = WEAPON_TRANSFORM_OVERRIDE[subtype]
    const isDagger = subtype === 'DAGGER'
    // Daggers use a completely different (reverse/icepick) grip from the
    // one-handed sword calibration — live-tuned by the user against a real
    // render via a temporary slider panel, not derived from SWORD_*.
    const rot = (isDagger && DAGGER_ROTATION_BY_CLASS[classId]) || SWORD_ROTATION_BY_CLASS[classId] || override?.rotation || [0, 0, 0]
    const pos = (isDagger && DAGGER_POSITION_BY_CLASS[classId]) || SWORD_POSITION_BY_CLASS[classId] || override?.position || [0, 0, 0]

    // BOWs: attached to the rig's own "equip_right" bone, matching
    // m2icondb's own approach (see equip_left/equip_right discovery). Each
    // bow's raw mesh has its own proportions and origin offset, so a single
    // shared target length + auto-centering only gets most items close —
    // the user live-calibrated all 27 ninja bows by hand via the in-app
    // WeaponScalePanel sliders (BOW_CALIBRATION_BY_ICON), used verbatim
    // here. Any bow without a calibration entry (e.g. a future new item)
    // falls back to the auto-centering heuristic as a reasonable default.
    const bowCal = subtype === 'BOW' ? BOW_CALIBRATION_BY_ICON[icon] : null
    const equipRightBone = subtype === 'BOW' ? entry.handBone.children.find((c) => c.name === 'equip_right') : null
    const attachBone = equipRightBone || entry.handBone
    if (equipRightBone) {
      wm.quaternion.identity()
      if (bowCal) {
        wm.rotation.set(bowCal.rot[0] * Math.PI / 180, bowCal.rot[1] * Math.PI / 180, bowCal.rot[2] * Math.PI / 180)
        wm.position.set(bowCal.pos[0], bowCal.pos[1], bowCal.pos[2])
      } else {
        // Some raw weapon meshes aren't centered on their own local origin
        // (confirmed earlier for a dagger — same fix applies here): grip the
        // mesh at its own bounding-box center instead of its raw (0,0,0).
        const meshChild = (() => { let f = null; wm.traverse((n) => { if (n.isMesh && !f) f = n }); return f })()
        if (meshChild) {
          if (!meshChild.geometry.boundingBox) meshChild.geometry.computeBoundingBox()
          const localCenter = meshChild.geometry.boundingBox.getCenter(new THREE.Vector3())
          wm.position.set(-localCenter.x, -localCenter.y, -localCenter.z)
        } else {
          wm.position.set(0, 0, 0)
        }
      }
    } else {
      wm.position.set(pos[0], pos[1], pos[2])
      wm.rotation.set(rot[0] * Math.PI / 180, rot[1] * Math.PI / 180, rot[2] * Math.PI / 180)
    }
    entry.model.updateMatrixWorld(true)
    const rawBox = new THREE.Box3().setFromObject(wm)
    const rawSize = rawBox.getSize(new THREE.Vector3())
    const rawMax = Math.max(rawSize.x, rawSize.y, rawSize.z) || 1
    const handWorldScale = new THREE.Vector3()
    entry.handBone.getWorldScale(handWorldScale)
    const handScaleAvg = (handWorldScale.x + handWorldScale.y + handWorldScale.z) / 3 || 1
    const targetLength = bowCal ? bowCal.size : (WEAPON_TARGET_LENGTH_BY_SUBTYPE[subtype] || 0.9)
    // FAN/BELL/SWORD/TWO_HANDED: same "trust the raw file's own native
    // scale" fix validated for bows (see above) — no per-item calibration
    // table for these yet (position/rotation still use SWORD_*_BY_CLASS /
    // WEAPON_TRANSFORM_OVERRIDE, unchanged; only the forced single
    // target-length scale was the bug), but native scale alone already
    // matches the reference site far better than one shared length across
    // dozens of differently-proportioned items per subtype. DAGGER is
    // deliberately excluded — its grip/scale was hand-calibrated separately
    // (dual-wield reverse grip) and the user hasn't reported it as wrong.
    const useNativeScale = (equipRightBone && !bowCal) || ['FAN', 'BELL', 'SWORD', 'TWO_HANDED'].includes(subtype)
    const autoScale = useNativeScale ? 1 : targetLength / (rawMax * handScaleAvg)
    wm.scale.setScalar(autoScale)
    attachBone.add(wm)
    entry.weaponModel = wm
    entry.weaponSubtype = subtype
    entry.weaponIcon = icon
    // Exposed so a live calibration slider can compute "what target length
    // does the current live scale correspond to" for baking back in.
    entry.weaponRawMax = rawMax
    entry.weaponHandScaleAvg = handScaleAvg

    // Daggers are dual-wielded — a second, INDEPENDENTLY LOADED copy of the
    // same blade (not wm.clone()) attached into the off-hand, since
    // m2icondb's own model is single-bladed (the dual-wield look comes from
    // the game equipping the same item in both hand slots, not from a
    // special two-bladed dagger mesh). Attached directly to L_Hand with an
    // explicit local position/rotation, live-calibrated the same way as the
    // right-hand grip (not a mirror computed from it — this rig's L_Hand
    // rest orientation isn't a simple mirror of R_Hand's).
    if (offGltf && entry.leftHandBone) {
      const offhand = offGltf.scene
      applyWeaponMaterial(offhand)
      const offPos = DAGGER_OFFHAND_POSITION_BY_CLASS[classId] || [-pos[0], pos[1], pos[2]]
      const offRot = DAGGER_OFFHAND_ROTATION_BY_CLASS[classId] || rot
      offhand.position.set(offPos[0], offPos[1], offPos[2])
      offhand.rotation.set(offRot[0] * Math.PI / 180, offRot[1] * Math.PI / 180, offRot[2] * Math.PI / 180)

      const leftScale = new THREE.Vector3()
      entry.leftHandBone.getWorldScale(leftScale)
      const leftScaleAvg = (leftScale.x + leftScale.y + leftScale.z) / 3 || 1
      offhand.scale.setScalar(autoScale * (handScaleAvg / leftScaleAvg))

      entry.leftHandBone.add(offhand)
      entry.offhandModel = offhand
    }

    const poseClip = WEAPON_POSE_CLIP[classId]?.[subtype] || 'wait'
    this._setPose(entry, poseClip)
  }

  async equipArmor(icon) {
    return this._equipBodySwap(ARMOR_DEFS[icon])
  }

  async equipCostume(classId, icon) {
    return this._equipBodySwap(COSTUME_DEFS[`${classId}:${icon}`])
  }

  async _equipBodySwap(def) {
    if (!def) return
    const classId = def.classId
    const oldEntry = this.classes[classId]
    const gender = oldEntry?.gender || this.activeGender || 'male'
    const genderedDef = def[gender] || def.male || def.female
    const myToken = ++this.armorLoadToken
    const [gltf, skinTex] = await Promise.all([loadGltf(genderedDef.body), loadDds(genderedDef.skin)])
    if (this._disposed || this.armorLoadToken !== myToken) return
    const classDef = CLASS_ASSETS[classId][gender]
    const faceTex = await loadDds(classDef.faceTex)
    if (this._disposed || this.armorLoadToken !== myToken) return

    const newModel = gltf.scene
    fitAndCenter(newModel)
    applyClassTextures(newModel, skinTex, faceTex)
    const newHandBone = findHandBone(newModel)
    const newLeftHandBone = findLeftHandBone(newModel)
    const newPelvisBone = findPelvisBone(newModel)

    const motionGltf = await loadGltf(classDef.motion)
    if (this._disposed || this.armorLoadToken !== myToken) return
    const clips = motionGltf.animations
    const waitClip = clips.find((a) => a.name === 'wait')

    if (oldEntry?.model) this.scene.remove(oldEntry.model)
    newModel.visible = this.activeClassId === classId
    this.scene.add(newModel)
    const mixer = new THREE.AnimationMixer(newModel)
    const action = waitClip ? mixer.clipAction(waitClip).play() : null
    const prevWeaponIcon = oldEntry?.weaponIcon
    const prevHairIcon = oldEntry?.hairIcon
    const prevSashIcon = oldEntry?.sashIcon
    const newEntry = { model: newModel, mixer, handBone: newHandBone, leftHandBone: newLeftHandBone, pelvisBone: newPelvisBone, weaponModel: null, offhandModel: null, hairMesh: null, sashModel: null, clips, action, weaponSubtype: null, gender }
    this.classes[classId] = newEntry
    this.bodyCache[`${classId}:${gender}`] = newEntry
    if (prevHairIcon) await this.equipHair(classId, prevHairIcon)
    else this._attachDefaultHair(classId, gender, newModel, newEntry)
    if (prevWeaponIcon) await this.equipWeapon(classId, prevWeaponIcon)
    if (prevSashIcon) await this.equipSash(classId, prevSashIcon)
  }

  async equipSash(classId, icon) {
    const entry = this.classes[classId]
    if (!entry || !entry.pelvisBone) return
    const myToken = ++entry._sashToken || (entry._sashToken = 1)
    const atlasName = SASH_ATLAS_BY_ICON[icon]
    const [gltf, atlasTex] = await Promise.all([
      loadGltf(SASH_ASSET_URL(icon)),
      atlasName ? loadSashAtlas(atlasName).catch(() => null) : Promise.resolve(null),
    ])
    if (this._disposed || entry._sashToken !== myToken) return
    if (entry.sashModel) entry.pelvisBone.remove(entry.sashModel)
    const sm = gltf.scene
    sm.traverse((node) => {
      if (node.isMesh) {
        // Sash geometry is a thin single-layer plane (not a closed tube), so
        // the default FrontSide culling makes it vanish entirely when viewed
        // from the side that got culled — DoubleSide renders both faces.
        node.material = atlasTex
          ? new THREE.MeshStandardMaterial({ map: atlasTex, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide })
          : new THREE.MeshStandardMaterial({ color: 0xb7c3d6, roughness: 0.65, metalness: 0.1, side: THREE.DoubleSide })
      }
    })
    sm.position.set(SASH_TRANSFORM.position[0], SASH_TRANSFORM.position[1], SASH_TRANSFORM.position[2])
    sm.rotation.set(SASH_TRANSFORM.rotation[0] * Math.PI / 180, SASH_TRANSFORM.rotation[1] * Math.PI / 180, SASH_TRANSFORM.rotation[2] * Math.PI / 180)
    entry.model.updateMatrixWorld(true)
    const rawBox = new THREE.Box3().setFromObject(sm)
    const rawSize = rawBox.getSize(new THREE.Vector3())
    const rawMax = Math.max(rawSize.x, rawSize.y, rawSize.z) || 1
    const pelvisWorldScale = new THREE.Vector3()
    entry.pelvisBone.getWorldScale(pelvisWorldScale)
    const scaleAvg = (pelvisWorldScale.x + pelvisWorldScale.y + pelvisWorldScale.z) / 3 || 1
    sm.scale.setScalar(SASH_TARGET_LENGTH / (rawMax * scaleAvg))
    entry.pelvisBone.add(sm)
    entry.sashModel = sm
    entry.sashIcon = icon
  }

  dispose() {
    this._disposed = true
    cancelAnimationFrame(this._frameId)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.scene.traverse((node) => {
      if (node.isMesh) {
        node.geometry?.dispose()
        if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose())
        else node.material?.dispose()
      }
    })
    this.renderer.dispose()
    if (this.renderer.domElement.parentNode === this.container) this.container.removeChild(this.renderer.domElement)
  }
}

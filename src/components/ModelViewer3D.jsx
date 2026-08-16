import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// Live, rotatable glTF viewer (Three.js, client-side only — no server round trip).
// Centers and scales whatever model is loaded to fit the view, since source
// models come from very different pipelines with arbitrary units/pivots.
export default function ModelViewer3D({
  modelUrl,
  textureUrl,
  useOwnMaterials = false,
  zUp = false,
  playAnimation = false,
  weapon, // { url, boneMatch, position: [x,y,z], rotation: [x,y,z] (deg), scale }
}) {
  const containerRef = useRef(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let frameId

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b0e14)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
    camera.position.set(0, 1.4, 3.2)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const ambient = new THREE.AmbientLight(0xffffff, 0.7)
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(2, 4, 3)
    const rim = new THREE.DirectionalLight(0x8fb2ff, 0.6)
    rim.position.set(-3, 2, -2)
    scene.add(ambient, key, rim)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 1
    controls.maxDistance = 8
    controls.target.set(0, 1, 0)

    function resize() {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    resize()

    // Loaded once up front (not per-mesh) — recovered textures are recolored
    // atlases shared across the whole body, not per-part maps.
    let texture = null
    if (textureUrl) {
      texture = new THREE.TextureLoader().load(textureUrl)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.flipY = false
    }

    let model = null
    const loader = new GLTFLoader()
    loader.load(
      modelUrl,
      gltf => {
        if (disposed) return
        model = gltf.scene
        if (zUp) model.rotation.x = -Math.PI / 2
        if (!useOwnMaterials) {
          model.traverse(node => {
            if (node.isMesh) {
              node.material = texture
                ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, metalness: 0.02 })
                : new THREE.MeshStandardMaterial({ color: 0xb7c3d6, roughness: 0.75, metalness: 0.05 })
            }
          })
        }

        // Center on its own bounds and scale to a consistent on-screen size —
        // source models carry whatever units/pivot the extraction pipeline left them with.
        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z) || 1
        const scale = 1.7 / maxDim
        model.scale.setScalar(scale)
        model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)

        scene.add(model)

        if (weapon?.url) {
          let handBone = null
          model.traverse(node => {
            if (node.isBone && node.name.includes(weapon.boneMatch || 'R_Hand')) handBone = node
          })
          if (handBone) {
            new GLTFLoader().load(weapon.url, wgltf => {
              if (disposed) return
              const weaponModel = wgltf.scene
              const [wx, wy, wz] = weapon.position || [0, 0, 0]
              const [rx, ry, rz] = weapon.rotation || [0, 0, 0]
              weaponModel.position.set(wx, wy, wz)
              weaponModel.rotation.set(rx * Math.PI / 180, ry * Math.PI / 180, rz * Math.PI / 180)
              weaponModel.scale.setScalar(weapon.scale ?? 1)
              handBone.add(weaponModel)
            })
          }
        }

        if (playAnimation && gltf.animations?.length > 0) {
          mixer = new THREE.AnimationMixer(model)
          mixer.clipAction(gltf.animations[0]).play()
        }

        setLoading(false)
      },
      undefined,
      err => {
        if (disposed) return
        setError(err?.message || 'Failed to load model')
        setLoading(false)
      }
    )

    let mixer = null
    const clock = new THREE.Clock()
    function animate() {
      frameId = requestAnimationFrame(animate)
      const delta = clock.getDelta()
      mixer?.update(delta)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      disposed = true
      cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      controls.dispose()
      scene.traverse(node => {
        if (node.isMesh) {
          node.geometry?.dispose()
          if (Array.isArray(node.material)) node.material.forEach(m => m.dispose())
          else node.material?.dispose()
        }
      })
      renderer.dispose()
      texture?.dispose()
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement)
    }
  }, [modelUrl, textureUrl, useOwnMaterials, zUp, playAnimation, weapon])

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden border border-gray-700 bg-gray-950">
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm pointer-events-none">
          Loading model…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm px-4 text-center pointer-events-none">
          Couldn't load model: {error}
        </div>
      )}
    </div>
  )
}

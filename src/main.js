import { formatHex } from 'culori'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { InertiaPlugin } from 'gsap/InertiaPlugin'
import { Observer } from 'gsap/Observer'
import * as THREE from 'three'
import particlesFragmentShader from './shaders/particles/fragment.glsl'
import particlesVertexShader from './shaders/particles/vertex.glsl'
import { horizontalLoop, verticalLoop } from './vendor/loop'
import './style.css'

gsap.registerPlugin(Draggable, Observer, InertiaPlugin)

/**
 * Utilities
 */
const $ = (selector, scope = document) => scope.querySelector(selector)
const $$ = (selector, scope = document) => scope.querySelectorAll(selector)
const getTemplateClone = (selector) => {
  const template = $(selector)
  return template.content.cloneNode(true).firstElementChild
}

/**
 * Setup
 */
const grid = $('[data-grid]')
const canvas = $('[data-grid-webgl]')
const dragProxy = document.createElement('div')
const pointer = new THREE.Vector2()
const pointerFollower = new THREE.Vector2()
const loopProg = new THREE.Vector2()
const loopProgFollower = new THREE.Vector2()
const loopVelFollower = new THREE.Vector2()

// webgl
const sizes = {
  width: grid.clientWidth,
  height: grid.clientHeight,
  pixelRatio: Math.min(window.devicePixelRatio, 2),
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(sizes.pixelRatio)
renderer.setClearColor(0x000000, 0)
renderer.autoClear = false

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
camera.position.set(0, 0, 10)

const planeGeometry = new THREE.PlaneGeometry(1, 1, 20, 20)
const planeScale = 2 * Math.tan(((camera.fov / 2) * Math.PI) / 180) * camera.position.z
planeGeometry.setIndex(null)
planeGeometry.deleteAttribute('normal')

// plane geometry attributes
const intensitiesArray = new Float32Array(planeGeometry.attributes.position.count)
const anglesArray = new Float32Array(planeGeometry.attributes.position.count)
const rotatesArray = new Float32Array(planeGeometry.attributes.position.count)
for (let i = 0; i < planeGeometry.attributes.position.count; i++) {
  intensitiesArray[i] = gsap.utils.random(0.2, 1)
  anglesArray[i] = gsap.utils.random(-Math.PI / 12, Math.PI / 12)
  rotatesArray[i] = gsap.utils.random(-Math.PI, Math.PI)
}
planeGeometry.setAttribute('aIntensity', new THREE.BufferAttribute(intensitiesArray, 1))
planeGeometry.setAttribute('aAngle', new THREE.BufferAttribute(anglesArray, 1))
planeGeometry.setAttribute('aRotate', new THREE.BufferAttribute(rotatesArray, 1))

let items, loopX, loopY, loopCtx
let prevShapeId = -1

/**
 * Functions
 */
const addItem = () => {
  const item = getTemplateClone('#grid-item-template')
  const scene = new THREE.Scene()
  const shapeNames = ['Circle', 'Square', 'Pentagon', 'Hexagon', 'Star']
  const shapeId = gsap.utils.random([...Array(shapeNames.length).keys()].filter((_, i) => i !== prevShapeId))
  prevShapeId = shapeId
  $('[data-grid-item-hash]', item).textContent = `#${String(shapeId + 1).padStart(2, '0')}`
  $('[data-grid-item-name]', item).textContent = shapeNames[shapeId]
  item._canvas = $('[data-grid-item-canvas]', item)
  item._canvasSize = new THREE.Vector2()
  item._scene = scene
  item._pointerUv = new THREE.Vector2()
  grid.appendChild(item)

  const hue = (360 / shapeNames.length) * shapeId
  const bgColor = formatHex({ mode: 'oklch', l: 0.98, c: 0.02, h: hue })
  const particleColor = formatHex({ mode: 'oklch', l: 0.8, c: 0.25, h: hue })
  gsap.set(item, { '--bg-color': bgColor })

  const material = new THREE.ShaderMaterial({
    vertexShader: particlesVertexShader,
    fragmentShader: particlesFragmentShader,
    transparent: true,
    uniforms: {
      uShape: new THREE.Uniform(shapeId),
      uColor: new THREE.Uniform(new THREE.Color(particleColor)),
      uAlpha: new THREE.Uniform(1),
      uResolution: new THREE.Uniform(item._canvasSize),
      uPointerUv: new THREE.Uniform(item._pointerUv),
      uVelocity: new THREE.Uniform(loopVelFollower),
    },
  })
  item._material = material

  const mesh = new THREE.Points(planeGeometry, material)
  mesh.scale.set(planeScale, planeScale, 1)
  scene.add(mesh)
}

const removeItem = (item) => {
  item._scene.traverse((obj) => {
    if (obj.material) {
      obj.material.dispose()
    }
  })
  item._scene.clear()
  item.remove()
}

/**
 * Events
 */
const onResize = () => {
  // webgl
  sizes.width = grid.clientWidth
  sizes.height = grid.clientHeight
  sizes.pixelRatio = Math.min(window.devicePixelRatio, 2)
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(sizes.pixelRatio)

  // grid items
  const gridW = grid.offsetWidth
  const gridH = grid.offsetHeight
  const itemW = parseFloat(getComputedStyle(grid).getPropertyValue('--item-width').trim())
  const itemH = parseFloat(getComputedStyle(grid).getPropertyValue('--item-height').trim())
  const columnCount = Math.ceil(Math.ceil(gridW / itemW + 1) / 2) * 2 // always even
  const rowCount = Math.ceil(gridH / itemH + 1)
  const itemCount = columnCount * rowCount
  const itemCountDiff = itemCount - (items?.length || 0)

  if (itemCountDiff === 0) {
    return
  }

  loopCtx?.revert()
  if (itemCountDiff > 0) {
    Array.from({ length: itemCountDiff }, () => addItem())
  } else {
    items.slice(itemCountDiff).forEach((item) => removeItem(item))
  }
  items = gsap.utils.toArray('[data-grid-item]')
  items.forEach((item, i) => {
    item.removeAttribute('data-odd-column')
    if (i % (2 * rowCount) < rowCount) {
      item.setAttribute('data-odd-column', '')
    }
  })
  gsap.set(grid, { '--row-count': rowCount })

  // make loop tween
  loopCtx = gsap.context(() => {
    loopX = horizontalLoop(items, { paused: true })
    loopY = verticalLoop(items, { paused: true })
    return () => {}
  })
}

const onPointerMove = (e) => {
  pointer.set(e.clientX, sizes.height - e.clientY)
}

/**
 * Controls
 */
const onDrag = function () {
  loopProg.set(
    this.startProg.x + (this.startX - this.x) * this.progPerPixel.x,
    this.startProg.y + (this.startY - this.y) * this.progPerPixel.y,
  )
}

const draggable = Draggable.create(dragProxy, {
  trigger: grid,
  type: 'x,y',
  dragClickables: true,
  inertia: true,
  maxDuration: 0.5,
  throwResistance: 5000,
  onPressInit() {
    this.startProg = new THREE.Vector2(loopX.progress(), loopY.progress())
    this.progPerPixel = new THREE.Vector2(1 / loopX.totalWidth, 1 / loopY.totalHeight)
    loopProg.copy(this.startProg)
    loopProgFollower.copy(this.startProg)
    gsap.set(dragProxy, {
      x: this.startProg.x / this.progPerPixel.x,
      y: this.startProg.y / -this.progPerPixel.y,
    })
  },
  onDrag,
  onThrowUpdate: onDrag,
})[0]

const observer = Observer.create({
  target: grid,
  type: 'wheel',
  wheelSpeed: 0.5,
  onChange(self) {
    gsap.killTweensOf(dragProxy)

    if (!self.isScrolling) {
      self.isScrolling = true
      self.scrollDiff = 0
      self.startProg = loopY.progress()
      loopProg.y = self.startProg
      loopProgFollower.y = self.startProg
    }

    self.scrollDiff += self.deltaY
    const progPerPixel = 1 / loopY.totalHeight
    loopProg.y = self.startProg + self.scrollDiff * progPerPixel
  },
  onStop(self) {
    self.isScrolling = false
  },
  preventDefault: true,
})

/**
 * Animation
 */
const tick = () => {
  const velX = InertiaPlugin.getVelocity(draggable.target, 'x')
  const velY = -InertiaPlugin.getVelocity(draggable.target, 'y') || observer.velocityY
  loopProgFollower.lerp(loopProg, 0.15)
  gsap.to(loopVelFollower, { x: velX, y: velY, duration: 1 })
  gsap.to(pointerFollower, { x: pointer.x, y: pointer.y, duration: 0.25 })

  const wrapProg = gsap.utils.wrap(0, 1)
  loopX.progress(wrapProg(loopProgFollower.x))
  loopY.progress(wrapProg(loopProgFollower.y))
  gsap.set(grid, {
    '--border-radius': `${48 * Math.min(1, Math.abs(loopVelFollower.length()) / 2000)}px`,
    '--scaleX': 1 - 0.2 * Math.min(1, Math.abs(loopVelFollower.y) / 2000),
    '--scaleY': 1 - 0.2 * Math.min(1, Math.abs(loopVelFollower.x) / 2000),
  })

  // webgl
  renderer.setScissorTest(false)
  renderer.clear()
  renderer.setScissorTest(true)
  items.forEach((item) => {
    const scene = item._scene
    const rect = item._canvas.getBoundingClientRect()

    if (rect.bottom < 0 || rect.top > sizes.height || rect.right < 0 || rect.left > sizes.width) {
      return
    }

    const width = rect.width
    const height = rect.height
    const left = rect.left
    const bottom = sizes.height - rect.bottom

    item._canvasSize.set(width, height)
    item._pointerUv.set((pointerFollower.x - left) / width, (pointerFollower.y - bottom) / height)

    // expand viewport to allow particles to overflow the local canvas area
    const vpScale = 2
    const viewport = [
      left - (width * (vpScale - 1)) / 2,
      bottom - (height * (vpScale - 1)) / 2,
      width * vpScale,
      height * vpScale,
    ]
    renderer.setViewport(...viewport)
    renderer.setScissor(...viewport)
    scene.scale.set(1 / vpScale, 1 / vpScale, 1)

    renderer.render(scene, camera)
  })
}

/**
 * Main
 */
window.addEventListener('resize', onResize)
window.addEventListener('pointermove', onPointerMove, { passive: true })

// initialize
onResize()

setTimeout(() => {
  // particle's fade-in animation
  loopVelFollower.set(2000, 2000)
  items.forEach((item) => gsap.fromTo(item._material.uniforms.uAlpha, { value: 0 }, { value: 1, duration: 1.5 }))

  gsap.ticker.add(tick)
}, 500)

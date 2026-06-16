import * as THREE from 'three'

function createCanvasFromPixels(pixels, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not create 2D canvas context for capture.')
  }

  const imageData = context.createImageData(width, height)
  const rowStride = width * 4

  for (let y = 0; y < height; y += 1) {
    const sourceRow = height - 1 - y
    const sourceOffset = sourceRow * rowStride
    const targetOffset = y * rowStride

    for (let x = 0; x < rowStride; x += 4) {
      const sourceIndex = sourceOffset + x
      const targetIndex = targetOffset + x
      const value = pixels[sourceIndex]

      imageData.data[targetIndex] = value
      imageData.data[targetIndex + 1] = value
      imageData.data[targetIndex + 2] = value
      imageData.data[targetIndex + 3] = 255
    }
  }

  context.putImageData(imageData, 0, 0)
  return canvas
}

function createGrayscaleCanvasFromPixels(pixels, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not create 2D canvas context for capture.')
  }

  const imageData = context.createImageData(width, height)
  const rowStride = width * 4

  for (let y = 0; y < height; y += 1) {
    const sourceRow = height - 1 - y
    const sourceOffset = sourceRow * rowStride
    const targetOffset = y * rowStride

    for (let x = 0; x < rowStride; x += 4) {
      const sourceIndex = sourceOffset + x
      const targetIndex = targetOffset + x
      const red = pixels[sourceIndex]
      const green = pixels[sourceIndex + 1]
      const blue = pixels[sourceIndex + 2]
      const shade = Math.round(0.2126 * red + 0.7152 * green + 0.0722 * blue)

      imageData.data[targetIndex] = shade
      imageData.data[targetIndex + 1] = shade
      imageData.data[targetIndex + 2] = shade
      imageData.data[targetIndex + 3] = 255
    }
  }

  context.putImageData(imageData, 0, 0)
  return canvas
}

function renderPass({ gl, scene, camera, material, width, height }) {
  const target = new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
    stencilBuffer: false,
  })

  const previousTarget = gl.getRenderTarget()
  const previousOverrideMaterial = scene.overrideMaterial
  const previousAutoClear = gl.autoClear
  const previousClearColor = new THREE.Color()
  gl.getClearColor(previousClearColor)
  const previousClearAlpha = gl.getClearAlpha()

  scene.updateMatrixWorld(true)
  camera.updateMatrixWorld(true)

  scene.overrideMaterial = material
  gl.autoClear = true
  gl.setClearColor(0x000000, 1)
  gl.setRenderTarget(target)
  gl.clear()
  gl.render(scene, camera)

  const pixels = new Uint8Array(width * height * 4)
  gl.readRenderTargetPixels(target, 0, 0, width, height, pixels)

  gl.setRenderTarget(previousTarget)
  gl.setClearColor(previousClearColor, previousClearAlpha)
  gl.autoClear = previousAutoClear
  scene.overrideMaterial = previousOverrideMaterial
  target.dispose()

  return pixels
}

function renderScenePass({ gl, scene, camera, width, height }) {
  const target = new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
    stencilBuffer: false,
  })

  const previousTarget = gl.getRenderTarget()
  const previousAutoClear = gl.autoClear
  const previousClearColor = new THREE.Color()
  gl.getClearColor(previousClearColor)
  const previousClearAlpha = gl.getClearAlpha()

  scene.updateMatrixWorld(true)
  camera.updateMatrixWorld(true)

  gl.autoClear = true
  gl.setClearColor(0x000000, 1)
  gl.setRenderTarget(target)
  gl.clear()
  gl.render(scene, camera)

  const pixels = new Uint8Array(width * height * 4)
  gl.readRenderTargetPixels(target, 0, 0, width, height, pixels)

  gl.setRenderTarget(previousTarget)
  gl.setClearColor(previousClearColor, previousClearAlpha)
  gl.autoClear = previousAutoClear
  target.dispose()

  return pixels
}

function createDepthMaterial(camera) {
  const distance = camera.position.length()
  
  // TWEAK 1: Bring this back down a bit. 
  // 4.0 gives a tighter bounding box than 4.5, wasting less of the gradient on empty space.
  const radius = 4.0 

  return new THREE.ShaderMaterial({
    uniforms: {
      uNear: { value: Math.max(0.1, distance - radius) },
      uFar: { value: distance + radius },
    },
    vertexShader: /* glsl */ `
      varying float vViewZ;

      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewZ = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;

      varying float vViewZ;
      uniform float uNear;
      uniform float uFar;

      void main() {
        // 1. Get the raw linear depth (0.0 is the near plane, 1.0 is the far plane)
        float depth = clamp((vViewZ - uNear) / (uFar - uNear), 0.0, 1.0);
        
        // 2. Invert it so the closest points to the camera are white (1.0)
        float invertedDepth = 1.0 - depth;
        
        // TWEAK 2: The Magic S-Curve!
        // smoothstep(min_edge, max_edge, value)
        // Values below 0.2 become pure black. Values above 0.9 become pure white.
        // Everything in between is interpolated on a smooth curve, maximizing contrast.
        float shade = smoothstep(0.2, 0.9, invertedDepth); 
        
        gl_FragColor = vec4(vec3(shade), 1.0);
      }
    `,
    side: THREE.DoubleSide,
  })
}
function capturePass({ gl, scene, camera, kind }) {
  const width = 1024
  const height = 1024

  // Clone the camera to modify its aspect ratio for the capture
  // without affecting the live scene viewport.
  const captureCamera = camera.clone()
  captureCamera.aspect = width / height
  captureCamera.updateProjectionMatrix()

  if (kind === 'depth') {
    const material = createDepthMaterial(captureCamera)
    const pixels = renderPass({ gl, scene, camera: captureCamera, material, width, height })
    material.dispose()

    return createCanvasFromPixels(pixels, width, height).toDataURL('image/png')
  }

  const pixels = renderScenePass({ gl, scene, camera: captureCamera, width, height })
  return createGrayscaleCanvasFromPixels(pixels, width, height).toDataURL('image/png')
}

export function captureDepthMap(api) {
  return capturePass({ ...api, kind: 'depth' })
}

export function captureShadowMap(api, lighting) {
  return capturePass({ ...api, kind: 'shadow', lighting, lightPosition: lighting.position })
}
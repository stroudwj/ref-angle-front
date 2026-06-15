import { forwardRef, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import AsaroHead from './AsaroHead'
import LightTransformGizmo from './LightTransformGizmo'
import { captureDepthMap, captureShadowMap } from '../lib/capture'

const INITIAL_LIGHT_POSITION = {
  x: 2.3,
  y: 2.8,
  z: 3.2,
}

function CaptureBridge({ onReady }) {
  const api = useThree()

  useEffect(() => {
    onReady(api)
  }, [api, onReady])

  return null
}

function SceneLights({ lightPosition, lightIntensity, lightColor, ambientIntensity }) {
  const position = useMemo(
    () => new THREE.Vector3(lightPosition.x, lightPosition.y, lightPosition.z),
    [lightPosition],
  )

  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      <directionalLight position={position} intensity={lightIntensity} color={lightColor} />
    </>
  )
}

const PortraitScene = forwardRef(function PortraitScene(
  { onLightPositionChange, lighting },
  ref,
) {
  const apiRef = useRef(null)
  const captureHelperRef = useRef(null)
  const orbitControlsRef = useRef(null)
  const [lightPosition, setLightPosition] = useState(INITIAL_LIGHT_POSITION)

  const commitLightPosition = (nextPosition) => {
    setLightPosition(nextPosition)
    onLightPositionChange?.(nextPosition)
  }

  const captureScene = (captureFn) => {
    const previousVisibility = captureHelperRef.current?.visible

    if (captureHelperRef.current) {
      captureHelperRef.current.visible = false
    }

    try {
      return captureFn()
    } finally {
      if (captureHelperRef.current) {
        captureHelperRef.current.visible = previousVisibility
      }
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      captureDepthMap: async () => {
        if (!apiRef.current) {
          throw new Error('The 3D scene is not ready yet.')
        }

        return captureScene(() => captureDepthMap(apiRef.current))
      },
      captureShadowMap: async () => {
        if (!apiRef.current) {
          throw new Error('The 3D scene is not ready yet.')
        }

        return captureScene(() =>
          captureShadowMap(apiRef.current, {
            position: lightPosition,
            intensity: lighting?.intensity ?? 2.8,
            color: lighting?.color ?? '#fff4db',
          }),
        )
      },
      captureMaps: async () => {
        if (!apiRef.current) {
          throw new Error('The 3D scene is not ready yet.')
        }

        const depthMap = captureScene(() => captureDepthMap(apiRef.current))
        const shadowMap = captureScene(() =>
          captureShadowMap(apiRef.current, {
            position: lightPosition,
            intensity: lighting?.intensity ?? 2.8,
            color: lighting?.color ?? '#fff4db',
          }),
        )

        return {
          depthMap,
          shadowMap,
        }
      },
    }),
    [lightPosition, lighting],
  )

  return (
    <div
      className="scene-card__viewport"
      style={{
        height: '100%',
        minHeight: '72svh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        className="scene-card__canvas"
        style={{
          flex: 1,
          minHeight: '72svh',
          width: '100%',
          position: 'relative',
        }}
      >
        <Canvas
          camera={{ position: [0, 0.32, 12.5], fov: 36, near: 0.1, far: 50 }}
          dpr={[1, 2]}
          gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <color attach="background" args={['#080b12']} />
          <fog attach="fog" args={['#080b12', 20, 40]} />
          <SceneLights
            lightPosition={lightPosition}
            lightIntensity={lighting?.intensity ?? 2.8}
            lightColor={lighting?.color ?? '#fff4db'}
            ambientIntensity={lighting?.ambientIntensity ?? 0.8}
          />
          <Suspense
            fallback={
              <Html center>
                <div className="overlay-pill">Loading Asaro head...</div>
              </Html>
            }
          >
            <AsaroHead />
            <group ref={captureHelperRef}>
              <LightTransformGizmo
                position={lightPosition}
                onChange={commitLightPosition}
                orbitControlsRef={orbitControlsRef}
              />
            </group>
          </Suspense>
          <OrbitControls
            ref={orbitControlsRef}
            enableDamping
            dampingFactor={0.08}
            enablePan={false}
            minDistance={5}
            maxDistance={14}
            makeDefault
          />
          <CaptureBridge
            onReady={(api) => {
              apiRef.current = api
            }}
          />
        </Canvas>
      </div>
      <div className="scene-card__overlay">
        <div className="overlay-pill">Drag the transform gizmo to steer the light.</div>
        <div className="overlay-pill">Orbit the head by dragging the model viewport.</div>
      </div>
    </div>
  )
})

export default PortraitScene
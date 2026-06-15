import { useMemo, useRef } from 'react'
import { TransformControls } from '@react-three/drei'

export default function LightTransformGizmo({ position, onChange, orbitControlsRef }) {
  const lightAnchorRef = useRef(null)

  const positionArray = useMemo(() => [position.x, position.y, position.z], [position])

  const handleObjectChange = (e) => {
    if (e?.target?.object) {
      const { x, y, z } = e.target.object.position
      onChange({ x, y, z })
    }
  }

  const handleDraggingChanged = (event) => {
    if (orbitControlsRef.current) {
      orbitControlsRef.current.enabled = !event.value
    }
  }

  return (
    <>
      <TransformControls
        object={lightAnchorRef}
        mode="translate"
        space="world"
        size={1.8}
        showX
        showY
        showZ
        onObjectChange={handleObjectChange}
        onDraggingChanged={handleDraggingChanged}
      />
      <group ref={lightAnchorRef} position={positionArray}>
        <mesh>
          <octahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial
            color="#fef3c7"
            emissive="#f59e0b"
            emissiveIntensity={2.4}
            roughness={0.18}
            metalness={0.08}
          />
        </mesh>
      </group>
    </>
  )
}

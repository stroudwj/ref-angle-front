import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const modelPath = import.meta.env.BASE_URL + 'simple_asaro_head.glb'
useGLTF.preload(modelPath)

export default function AsaroHead() {
  const { scene } = useGLTF(modelPath)

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }, [scene])

  const frame = useMemo(() => {
    const bounds = new THREE.Box3().setFromObject(scene)
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    const height = Math.max(size.y, 0.001)
    const scale = 4.7 / height
    const offset = center.multiplyScalar(-scale)

    return {
      scale,
      position: [offset.x, offset.y - 0.12, offset.z],
    }
  }, [scene])

  return (
    <group rotation={[0, Math.PI, 0]}>
      <group position={frame.position} scale={frame.scale}>
        <primitive object={scene} />
      </group>
    </group>
  )
}
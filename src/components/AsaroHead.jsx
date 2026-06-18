import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const ASARO_PATH = import.meta.env.BASE_URL + 'simple_asaro_head.glb'
const HUMAN_PATH = import.meta.env.BASE_URL + 'humanhead.glb'

useGLTF.preload(ASARO_PATH)
useGLTF.preload(HUMAN_PATH)

export default function AsaroHead({ modelType = 'asaro' }) {
  const modelPath = modelType === 'human' ? HUMAN_PATH : ASARO_PATH;
  const { scene } = useGLTF(modelPath)

  // Clone scene so we don't mutate the cached one when switching back and forth
  const clonedScene = useMemo(() => scene.clone(), [scene])

  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }, [clonedScene])

  const frame = useMemo(() => {
    const bounds = new THREE.Box3().setFromObject(clonedScene)
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    const height = Math.max(size.y, 0.001)
    const scale = 4.7 / height
    const offset = center.multiplyScalar(-scale)

    return {
      scale,
      position: [offset.x, offset.y - 0.12, offset.z],
    }
  }, [clonedScene])

  return (
    <group rotation={[0, modelType === 'human' ? 0 : Math.PI, 0]}>
      <group position={frame.position} scale={frame.scale}>
        <primitive object={clonedScene} />
      </group>
    </group>
  )
}
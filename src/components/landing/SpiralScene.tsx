import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll, Text3D, Float, Environment, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

const SpiralScene: React.FC = () => {
  const scroll = useScroll();
  const groupRef = useRef<THREE.Group>(null);
  const cameraTarget = useRef(new THREE.Vector3(0, 0, 0));

  // Create a mathematical spiral path for the camera
  const curve = React.useMemo(() => {
    const points = [];
    // 5 loops down a deep Z-axis
    for (let i = 0; i < 50; i++) {
      const angle = i * 0.5;
      const radius = 8 - (i * 0.1); // Radius gets tighter as you go down
      const z = -i * 1.5; // Fall deeper into the screen
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, z));
    }
    return new THREE.CatmullRomCurve3(points);
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;

    // scroll.offset goes from 0 to 1 as the user scrolls down
    const offset = scroll.offset; 
    
    // Get the position on the curve based on scroll
    const camPos = curve.getPoint(offset);
    
    // Look slightly ahead on the curve to create the "falling" sensation
    const lookAtOffset = Math.min(offset + 0.05, 1);
    const targetPos = curve.getPoint(lookAtOffset);

    // Smooth camera movement
    state.camera.position.lerp(camPos, 0.1);
    cameraTarget.current.lerp(targetPos, 0.1);
    state.camera.lookAt(cameraTarget.current);
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />
      <pointLight position={[-10, -10, -5]} intensity={1} color="#0044ff" />

      {/* The Central Monolith Logo */}
      <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
        <Text3D
          font="https://threejs.org/examples/fonts/helvetiker_bold.typeface.json"
          size={12}
          height={2}
          curveSegments={12}
          bevelEnabled
          bevelThickness={0.1}
          bevelSize={0.1}
          bevelSegments={5}
          position={[-6, -4, -10]}
        >
          b
          <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
        </Text3D>
      </Float>

      {/* Deep Space Particles */}
      <Sparkles count={2000} scale={50} size={2} speed={0.2} opacity={0.5} color="#4488ff" position={[0,0,-30]} />

      <Environment preset="city" />
    </group>
  );
};

export default SpiralScene;
import React from 'react';
import { Plane, Box, RoundedBox } from '@react-three/drei';

const Couch: React.FC<{ position: [number, number, number], rotation?: [number, number, number], color?: string }> = ({ position, rotation = [0, 0, 0], color = '#a78bfa' }) => (
  <group position={position} rotation={rotation}>
    {/* Base */}
    <RoundedBox args={[2, 0.4, 0.8]} radius={0.05} smoothness={4} position={[0, 0.2, 0]}>
      <meshStandardMaterial color={color} />
    </RoundedBox>
    {/* Back */}
    <RoundedBox args={[2, 0.6, 0.2]} radius={0.05} smoothness={4} position={[0, 0.7, -0.3]}>
      <meshStandardMaterial color={color} />
    </RoundedBox>
    {/* Sides */}
    <RoundedBox args={[0.2, 0.6, 0.8]} radius={0.05} smoothness={4} position={[-0.9, 0.5, 0]}>
      <meshStandardMaterial color={color} />
    </RoundedBox>
    <RoundedBox args={[0.2, 0.6, 0.8]} radius={0.05} smoothness={4} position={[0.9, 0.5, 0]}>
      <meshStandardMaterial color={color} />
    </RoundedBox>
  </group>
);

const Stage = () => (
  <group position={[0, 0, -3]}>
     {/* Stage Floor */}
    <RoundedBox args={[10, 0.5, 6]} radius={0.1} smoothness={4} position={[0, 0.25, 0]}>
      <meshStandardMaterial color="#1e293b" roughness={0.2} metalness={0.1} />
    </RoundedBox>
    {/* Decorative Spotlight Cone */}
    <mesh position={[0, 5, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[4, 8, 32, 1, true]} />
        <meshBasicMaterial color="#6366f1" transparent opacity={0.05} side={2} />
    </mesh>
  </group>
);

const World = () => {
  return (
    <group>
      {/* Floor */}
      <Plane args={[50, 50]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.2} />
      </Plane>
      
      {/* Grid helper for retro feel */}
      <gridHelper args={[50, 50, 0x444444, 0x222222]} position={[0, 0.01, 0]} />

      <Stage />

      {/* Furniture on Stage */}
      <Couch position={[-2, 0.5, -2.5]} rotation={[0, 0.3, 0]} />
      <Couch position={[2, 0.5, -2.5]} rotation={[0, -0.3, 0]} />
      
      {/* Center Table */}
      <RoundedBox args={[1.5, 0.4, 0.8]} radius={0.02} smoothness={4} position={[0, 0.7, -2.5]}>
         <meshStandardMaterial color="#cbd5e1" roughness={0.1} />
      </RoundedBox>

      {/* Crowd Seating - Sunchairs abstract */}
      {Array.from({ length: 12 }).map((_, i) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        const x = (col - 1.5) * 1.5;
        const z = 2 + row * 1.5;
        return (
          <Box key={i} args={[0.8, 0.1, 0.8]} position={[x, 0.05, z]}>
            <meshStandardMaterial color="#334155" />
          </Box>
        )
      })}

      {/* Ambient Lights */}
      <ambientLight intensity={0.4} />
      <spotLight 
        position={[0, 10, -3]} 
        angle={0.5} 
        penumbra={0.5} 
        intensity={2} 
        castShadow 
        color="#818cf8"
      />
      <pointLight position={[-5, 5, 5]} intensity={0.5} color="#f472b6" />
    </group>
  );
};

export default World;
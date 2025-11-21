import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { User } from '../types';

interface AvatarProps {
  user: User;
  isMe: boolean;
  volume: number; // 0 to 1
  message?: string;
}

const Avatar: React.FC<AvatarProps> = ({ user, isMe, volume, message }) => {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Mesh>(null);

  // Smooth volume for animation
  const currentVolume = useRef(0);

  // Chat bubble visibility logic
  const [visibleMessage, setVisibleMessage] = useState<string | null>(null);
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (message) {
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      setVisibleMessage(message);
      messageTimeoutRef.current = setTimeout(() => {
        setVisibleMessage(null);
      }, 5000);
    }
  }, [message]);

  useFrame((state, delta) => {
    // LERP volume for smooth mouth animation
    currentVolume.current = THREE.MathUtils.lerp(currentVolume.current, volume, 0.2);

    if (mouthRef.current) {
      // Scale mouth Y based on volume
      const scaleY = 0.2 + (currentVolume.current * 1.5);
      mouthRef.current.scale.set(1, scaleY, 1);
    }

    if (groupRef.current) {
        // Use target position for smooth movement (Lerp)
        groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, user.position.x, 0.1);
        groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, user.position.z, 0.1);
        
        // Subtle breathing animation
        groupRef.current.position.y = user.position.y + Math.sin(state.clock.elapsedTime * 2) * 0.02;
        
        // Look at center logic (simplified)
        groupRef.current.lookAt(0, 1, 0); 
    }
  });

  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: user.color, roughness: 0.3 }), [user.color]);
  const darkMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.8 }), []);

  return (
    <group ref={groupRef} position={[user.position.x, user.position.y, user.position.z]}>
      {/* Body */}
      <mesh ref={bodyRef} position={[0, 0.6, 0]} castShadow receiveShadow material={material}>
        <capsuleGeometry args={[0.3, 0.6, 4, 8]} />
      </mesh>

      {/* Head */}
      <mesh ref={headRef} position={[0, 1.25, 0]} castShadow material={material}>
        <sphereGeometry args={[0.25, 32, 32]} />
      </mesh>

      {/* Mouth (Visual Voice Indicator) */}
      <mesh ref={mouthRef} position={[0, 1.25, 0.22]} rotation={[0, 0, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.1, 1.35, 0.2]} castShadow material={darkMaterial}>
        <sphereGeometry args={[0.04, 16, 16]} />
      </mesh>
      <mesh position={[0.1, 1.35, 0.2]} castShadow material={darkMaterial}>
        <sphereGeometry args={[0.04, 16, 16]} />
      </mesh>

      {/* Host Badge */}
      {user.isHost && (
        <Html position={[0, 2.6, 0]} center>
           <div className="text-yellow-400 text-2xl drop-shadow-md">👑</div>
        </Html>
      )}

      {/* Hand Raised Indicator */}
      {user.handRaised && (
        <Html position={[0.4, 1.8, 0]} center>
           <div className="animate-bounce text-3xl drop-shadow-md">✋</div>
        </Html>
      )}

      {/* Name Tag */}
      <Html position={[0, 1.8, 0]} center distanceFactor={10}>
        <div className={`px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap backdrop-blur-sm border ${user.isSpeaker ? 'bg-indigo-600/80 border-indigo-400' : 'bg-black/50 border-white/10'} text-white`}>
          {user.username} {isMe ? '(You)' : ''}
        </div>
      </Html>

      {/* Chat Bubble */}
      {visibleMessage && (
        <Html position={[0, 2.1, 0]} center zIndexRange={[100, 0]}>
          <div className="animate-bounce-in opacity-90 transition-opacity duration-500">
            <div className="bg-white text-slate-900 px-4 py-2 rounded-2xl rounded-bl-none shadow-lg text-sm font-medium max-w-[200px] leading-tight border-2 border-indigo-500">
              {visibleMessage}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

export default Avatar;

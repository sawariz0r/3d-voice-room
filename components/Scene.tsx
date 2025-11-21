import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Stars } from '@react-three/drei';
import World from './World';
import Avatar from './Avatar';
import { User, ChatMessage } from '../types';

interface SceneProps {
  users: User[];
  currentUser: User | null;
  lastMessages: Record<string, string>;
  voiceLevels: Record<string, number>;
}

const Scene: React.FC<SceneProps> = ({ users, currentUser, lastMessages, voiceLevels }) => {
  return (
    <Canvas shadows camera={{ position: [0, 5, 8], fov: 50 }}>
      <Suspense fallback={null}>
        <Environment preset="night" />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        <World />

        {users.map((user) => (
          <Avatar
            key={user.id}
            user={user}
            isMe={currentUser?.id === user.id}
            volume={voiceLevels[user.id] || 0}
            message={lastMessages[user.id]}
          />
        ))}

        <ContactShadows resolution={1024} scale={50} blur={2} opacity={0.5} far={10} color="#000000" />
      </Suspense>
      <OrbitControls 
        maxPolarAngle={Math.PI / 2 - 0.1} 
        minDistance={3}
        maxDistance={20}
        target={[0, 1, 0]}
      />
    </Canvas>
  );
};

export default Scene;
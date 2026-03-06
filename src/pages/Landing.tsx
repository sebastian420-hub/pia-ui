import React from 'react';
import { Canvas } from '@react-three/fiber';
import { ScrollControls, Scroll } from '@react-three/drei';
import SpiralScene from '../components/landing/SpiralScene';
import NarrativeOverlay from '../components/landing/NarrativeOverlay';
import './Landing.css';

const Landing: React.FC = () => {
  return (
    <div className="landing-container">
      {/* 
        ScrollControls creates a virtual scrollbar. 
        pages={5} means the scroll distance is 5 times the window height.
      */}
      <Canvas shadows camera={{ position: [0, 0, 10], fov: 45 }}>
        <color attach="background" args={['#050505']} />
        
        <ScrollControls pages={6} damping={0.2}>
          <SpiralScene />
          <Scroll html>
            <NarrativeOverlay />
          </Scroll>
        </ScrollControls>
        
      </Canvas>
    </div>
  );
};

export default Landing;
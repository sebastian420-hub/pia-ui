import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const NarrativeOverlay: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '600vh', pointerEvents: 'none' }}>
      
      {/* Section 1: The Hook */}
      <div style={{ position: 'absolute', top: '20vh', left: '10vw', color: 'white', maxWidth: '600px' }}>
        <h1 style={{ fontSize: '4rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
          burman<span style={{ color: '#0066ff' }}>labs</span>
        </h1>
        <p style={{ fontSize: '1.5rem', color: '#888', marginTop: '1rem' }}>
          The Intelligence Synthesis Engine. We don't just read the data. We map the world.
        </p>
        <p style={{ fontSize: '1rem', color: '#555', marginTop: '2rem' }}>Scroll to descend.</p>
      </div>

      {/* Section 2: The Ingestion */}
      <div style={{ position: 'absolute', top: '150vh', right: '10vw', color: 'white', maxWidth: '500px', textAlign: 'right' }}>
        <h2 style={{ fontSize: '3rem', margin: 0 }}>The Swarm.</h2>
        <p style={{ fontSize: '1.25rem', color: '#aaa' }}>
          Autonomous agents perpetually polling global aircraft transponders, maritime cargo grids, and the dark web.
        </p>
      </div>

      {/* Section 3: The Fusion */}
      <div style={{ position: 'absolute', top: '280vh', left: '10vw', color: 'white', maxWidth: '500px' }}>
        <h2 style={{ fontSize: '3rem', margin: 0 }}>The Graph.</h2>
        <p style={{ fontSize: '1.25rem', color: '#aaa' }}>
          LLMs fortified by Chain-of-Thought reasoning extract entities and forge them into a multi-tenant, relational web of power.
        </p>
      </div>

      {/* Section 4: The Call to Action */}
      <div style={{ position: 'absolute', top: '480vh', left: '50vw', transform: 'translateX(-50%)', color: 'white', textAlign: 'center' }}>
        <h2 style={{ fontSize: '4rem', margin: 0 }}>Decision Dominance.</h2>
        <p style={{ fontSize: '1.5rem', color: '#888', marginBottom: '3rem' }}>
          Tier-1 infrastructure available for enterprise deployment.
        </p>
        <button 
          onClick={() => navigate('/dashboard')}
          style={{
            pointerEvents: 'auto',
            background: 'linear-gradient(45deg, #0044ff, #0088ff)',
            color: 'white',
            border: 'none',
            padding: '1rem 3rem',
            fontSize: '1.25rem',
            fontWeight: 600,
            borderRadius: '50px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            margin: '0 auto',
            boxShadow: '0 0 40px rgba(0, 102, 255, 0.4)',
            transition: 'transform 0.2s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          Enter the War Room <ArrowRight size={24} />
        </button>
      </div>

    </div>
  );
};

export default NarrativeOverlay;
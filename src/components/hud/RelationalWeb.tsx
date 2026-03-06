import React, { useEffect, useState, useRef } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { motion } from 'framer-motion';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';

interface Node {
  id: string;
  name: string;
  group: string;
  val: number;
}

interface Link {
  source: string;
  target: string;
  label: string;
  confidence: number;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface RelationalWebProps {
  entityName: string;
  onClose: () => void;
}

const getGroupColor = (group: string) => {
  switch (group?.toUpperCase()) {
    case 'PERSON': return '#3b82f6'; // blue
    case 'ORGANIZATION': return '#eab308'; // yellow
    case 'GPE':
    case 'LOCATION': return '#22c55e'; // green
    case 'MILITARY':
    case 'VESSEL':
    case 'AIRCRAFT': return '#ef4444'; // red
    default: return '#9ca3af'; // gray
  }
};

const RelationalWeb: React.FC<RelationalWebProps> = ({ entityName, onClose }) => {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fgRef = useRef<any>();

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`http://localhost:8001/api/v1/graph/network/${encodeURIComponent(entityName)}`)
      .then(res => res.json())
      .then(result => {
        if (result.status === 'success') {
          setData(result.data);
        } else {
          setError(result.message || 'Failed to load graph data.');
        }
      })
      .catch(err => {
        console.error(err);
        setError('Network error connecting to API Bridge.');
      })
      .finally(() => setLoading(false));
  }, [entityName]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 z-40 bg-black/90 backdrop-blur-sm"
    >
      {/* Top Bar / Close Button */}
      <div className="absolute top-0 left-0 w-full p-6 z-50 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div>
          <h1 className="text-3xl font-mono font-bold text-white">Relational Network</h1>
          <p className="text-sentinel-blue font-mono text-sm tracking-widest mt-1">
            FOCUS: [{entityName.toUpperCase()}]
          </p>
        </div>
        <button 
          onClick={onClose}
          className="pointer-events-auto text-white border border-white/20 bg-black/50 hover:bg-white/10 px-4 py-2 rounded font-mono text-sm transition-colors"
        >
          RETURN TO GLOBE [ESC]
        </button>
      </div>

      {/* Semantic Legend */}
      <div className="absolute bottom-6 left-6 z-50 font-mono text-xs bg-black/60 p-4 border border-white/10 rounded backdrop-blur">
        <h3 className="text-white/50 mb-2 border-b border-white/10 pb-1">ONTOLOGY LEGEND</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ef4444]"></div><span className="text-white">MILITARY / THREAT</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#eab308]"></div><span className="text-white">ORGANIZATION</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#3b82f6]"></div><span className="text-white">PERSONNEL</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#22c55e]"></div><span className="text-white">GEOGRAPHY (GPE)</span></div>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="text-sentinel-blue font-mono animate-pulse text-xl tracking-widest">Querying Neural Core...</div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="text-sentinel-critical font-mono bg-black/50 p-4 border border-sentinel-critical rounded">
            {error}
          </div>
        </div>
      )}

      {!loading && !error && data.nodes.length > 0 && (
        <div className="absolute inset-0 cursor-move">
          <ForceGraph3D
            ref={fgRef}
            graphData={data}
            nodeRelSize={4}
            // Generate a combined 3D object: A sphere + a floating text label
            nodeThreeObject={(node: any) => {
              const group = new THREE.Group();
              
              // 1. The Sphere
              const geometry = new THREE.SphereGeometry(Math.cbrt(node.val) * 2);
              const material = new THREE.MeshLambertMaterial({ 
                color: getGroupColor(node.group),
                transparent: true,
                opacity: 0.9
              });
              const sphere = new THREE.Mesh(geometry, material);
              group.add(sphere);

              // 2. The Text Label (Persistent, crisp 2D text)
              const sprite = new SpriteText(node.name);
              sprite.color = 'white';
              sprite.textHeight = 4;
              sprite.fontWeight = 'bold';
              sprite.fontFace = 'monospace';
              // Float the text slightly above the sphere based on its size
              sprite.position.y = (Math.cbrt(node.val) * 2) + 3; 
              
              // Add a slight background to the text to make it pop against lines
              sprite.backgroundColor = 'rgba(0,0,0,0.6)';
              sprite.padding = 2;
              sprite.borderRadius = 2;

              group.add(sprite);
              return group;
            }}
            // Link formatting
            linkColor={() => 'rgba(255,255,255,0.15)'}
            linkWidth={(link: any) => Math.max(1, link.confidence * 3)}
            // Relationship Text floating on the link
            linkThreeObjectExtend={true}
            linkThreeObject={(link: any) => {
              // Extend the link with a text sprite in the middle
              const sprite = new SpriteText(link.label);
              sprite.color = 'rgba(255,255,255,0.7)';
              sprite.textHeight = 2.5;
              sprite.fontFace = 'monospace';
              return sprite;
            }}
            linkPositionUpdate={(sprite: any, { start, end }: any) => {
              const middlePos = Object.assign(...['x', 'y', 'z'].map(c => ({
                [c]: start[c] + (end[c] - start[c]) / 2 // Position text exactly halfway
              })));
              Object.assign(sprite.position, middlePos);
            }}
            linkDirectionalArrowLength={3.5}
            linkDirectionalArrowRelPos={1}
            backgroundColor="#050505"
            onNodeClick={(node: any) => {
              // Smoothly move the camera to focus on the clicked node
              const distance = 40;
              const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
              fgRef.current.cameraPosition(
                { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, 
                node, 
                1500  // ms transition
              );
            }}
          />
        </div>
      )}
    </motion.div>
  );
};

export default RelationalWeb;
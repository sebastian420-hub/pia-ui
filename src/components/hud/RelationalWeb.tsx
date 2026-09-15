import React, { useEffect, useState, useRef } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, ThumbsUp, ThumbsDown } from 'lucide-react';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import type { ForceGraphMethods } from 'react-force-graph-3d';
import { apiFetch, apiJson } from '../../lib/api';
import type { GraphData, GraphLink, GraphNode as Node } from '../../lib/types';

type Link = GraphLink;
type FeedbackType = 'CONFIRMED' | 'REJECTED_HALLUCINATION';

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
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, FeedbackType>>({});
  const fgRef = useRef<ForceGraphMethods<Node, Link> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      setSelectedNode(null); // Reset selection on new graph load
    });
    apiFetch<GraphData>(`/api/v1/graph/network/${encodeURIComponent(entityName)}`).then(result => {
      if (cancelled) return;
      if (result.status === 'success' && result.data) {
        setData(result.data);
        // Extreme-compact layout
        const fg = fgRef.current;
        if (fg) {
          fg.d3Force('link')?.distance?.(50);
          fg.d3Force('charge')?.strength?.(-150);
        }
      } else {
        setError(result.message || 'Failed to load graph data.');
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [entityName]);

  /** Human verdict on one inferred relationship (feeds the analyst's negative examples). */
  const sendFeedback = async (relationshipId: string, type: FeedbackType) => {
    const res = await apiJson(`/api/v1/feedback`, { relationship_id: relationshipId, feedback_type: type });
    if (res.status === 'success') setFeedbackSent(prev => ({ ...prev, [relationshipId]: type }));
    else console.error('Feedback failed:', res.message);
  };

  // Process data: Simplified (1 edge per pair guaranteed by backend)
  const processedData = React.useMemo(() => {
    return { nodes: data.nodes, links: data.links };
  }, [data]);

  // Helper to find connections for the selected node
  const getNodeConnections = (nodeId: string) => {
    return processedData.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return sourceId === nodeId || targetId === nodeId;
    });
  };

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
          <h1 className="text-2xl font-mono font-bold text-white">Relationships</h1>
          <p className="text-sentinel-blue font-mono text-sm tracking-widest mt-1">
            FOCUS: [{entityName.toUpperCase()}]
          </p>
        </div>
        <button 
          onClick={onClose}
          className="pointer-events-auto text-white border border-white/20 bg-black/50 hover:bg-white/10 px-4 py-2 rounded font-mono text-sm transition-colors"
        >
          CLOSE [ESC]
        </button>
      </div>

      {/* Semantic Legend */}
      <div className="absolute bottom-6 left-6 z-50 font-mono text-xs bg-black/60 p-4 border border-white/10 rounded backdrop-blur">
        <h3 className="text-white/50 mb-2 border-b border-white/10 pb-1">LEGEND</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ef4444]"></div><span className="text-white">VESSEL / AIRCRAFT</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#eab308]"></div><span className="text-white">ORGANIZATION</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#3b82f6]"></div><span className="text-white">PERSON</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#22c55e]"></div><span className="text-white">LOCATION</span></div>
        </div>
      </div>

      {/* Node Details Slide-Out Panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute top-0 right-0 w-96 h-full bg-black/80 backdrop-blur-lg border-l border-white/10 z-50 flex flex-col font-mono text-sm shadow-2xl"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-xs font-bold rounded text-black" style={{ backgroundColor: getGroupColor(selectedNode.group) }}>
                    {selectedNode.group}
                  </span>
                </div>
                <h2 className="text-white font-bold text-xl leading-tight">{selectedNode.name}</h2>
              </div>
              <button onClick={() => setSelectedNode(null)} className="text-white/50 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
              
              {/* Intelligence Brief */}
              <div>
                <h3 className="text-sentinel-blue text-xs tracking-widest mb-2 flex items-center gap-2">
                  DESCRIPTION
                </h3>
                <div className="text-xs text-white/80 bg-white/5 p-3 rounded border border-white/10 leading-relaxed">
                  {selectedNode.description ? selectedNode.description : <span className="italic text-white/40">No description yet.</span>}
                </div>
              </div>

              {/* Metadata */}
              <div>
                <h3 className="text-sentinel-blue text-xs tracking-widest mb-2 flex items-center gap-2">
                  DETAILS
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs bg-white/5 p-3 rounded border border-white/10">
                  <div>
                    <span className="text-white/40 block mb-1">MENTIONS</span>
                    <span className="text-white">{selectedNode.val}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block mb-1">INTERNAL ID</span>
                    <span className="text-white truncate block" title={selectedNode.id}>{selectedNode.id.split('-')[0]}...</span>
                  </div>
                </div>
              </div>

              {/* Connections Ledger */}
              <div>
                <h3 className="text-sentinel-blue text-xs tracking-widest mb-3 flex items-center gap-2">
                  <Share2 size={14} /> CONNECTIONS
                </h3>
                <div className="space-y-2">
                  {getNodeConnections(selectedNode.id).map((link, idx) => {
                    // Determine if the selected node is the source or target
                    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                    const isOutgoing = sourceId === selectedNode.id;
                    
                    // Get the other node object to display its name
                    const otherNodeId = isOutgoing ? (typeof link.target === 'object' ? link.target.id : link.target) : sourceId;
                    const otherNode = data.nodes.find(n => n.id === otherNodeId);
                    
                    if (!otherNode) return null;

                    return (
                      <div key={idx} className="bg-white/5 border border-white/10 p-2 rounded flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/40 font-bold tracking-widest">
                            {isOutgoing ? 'OUTGOING' : 'INCOMING'}
                          </span>
                          <span className="text-[10px] text-sentinel-blue">
                            CONF: {(link.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-white/70 italic">[{link.label}]</span>
                          <span className="text-white/40">➔</span>
                          <span className="text-white font-bold truncate">{otherNode.name}</span>
                        </div>
                        {link.reasoning && (
                          <div className="mt-1 pt-1 border-t border-white/5 text-[10px] text-white/50 italic">
                            {link.reasoning}
                          </div>
                        )}
                        {link.relationships && link.relationships.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-2">
                            {link.relationships.map(rel => {
                              const verdict = feedbackSent[rel.relationship_id];
                              return (
                                <span key={rel.relationship_id} className="flex items-center gap-1 text-[10px] text-white/50">
                                  <span>{rel.type}</span>
                                  {verdict ? (
                                    <span className={verdict === 'CONFIRMED' ? 'text-green-400' : 'text-sentinel-critical'}>
                                      {verdict === 'CONFIRMED' ? 'confirmed' : 'rejected'}
                                    </span>
                                  ) : (
                                    <>
                                      <button title="Confirm this relationship" className="hover:text-green-400" onClick={() => sendFeedback(rel.relationship_id, 'CONFIRMED')}>
                                        <ThumbsUp size={11} />
                                      </button>
                                      <button title="Reject as hallucination" className="hover:text-sentinel-critical" onClick={() => sendFeedback(rel.relationship_id, 'REJECTED_HALLUCINATION')}>
                                        <ThumbsDown size={11} />
                                      </button>
                                    </>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="text-sentinel-blue font-mono animate-pulse text-xl tracking-widest">Loading graph…</div>
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
            graphData={processedData}
            nodeRelSize={4}
            linkCurvature="curvature"
            // Generate a combined 3D object: A sphere + a floating text label
            nodeThreeObject={(node: Node) => {
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

              // 2. The Text Label (Smaller, Always Visible)
              const sprite = new SpriteText(node.name);
              sprite.color = 'white';
              sprite.textHeight = 2.0;
              sprite.fontWeight = 'bold';
              sprite.fontFace = 'monospace';
              sprite.position.y = (Math.cbrt(node.val) * 2) + 2.0; 
              
              sprite.backgroundColor = 'rgba(0,0,0,0.7)';
              sprite.padding = 1.5;
              sprite.borderRadius = 2;

              group.add(sprite);
              return group;
              }}
              // Link formatting
              linkColor={() => 'rgba(255,255,255,0.2)'}
              linkWidth={(link: Link) => Math.max(1, link.confidence * 2)}
              // Relationship Text floating on the link
              linkThreeObjectExtend={true}     
              linkThreeObject={(link: Link) => {
              const sprite = new SpriteText(link.label);
              sprite.color = '#3b82f6'; // Bright blue for the "verb"
              sprite.textHeight = 1.5; // Balanced for clarity and space
              sprite.fontFace = 'monospace'; 
              sprite.backgroundColor = 'rgba(0,0,0,0.8)';
              sprite.padding = 0.8;
              sprite.borderRadius = 1;
              
              return sprite;
            }}
            linkPositionUpdate={(sprite: THREE.Object3D, { start, end }: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } }) => {
              if (sprite) {
                sprite.position.x = start.x + (end.x - start.x) / 2;
                sprite.position.y = start.y + (end.y - start.y) / 2;
                sprite.position.z = start.z + (end.z - start.z) / 2;
              }
            }}
            linkDirectionalArrowLength={4.5}
            linkDirectionalArrowRelPos={1}
            backgroundColor="#050505"
            onNodeClick={(node: Node) => {
              // Select node to open right panel
              setSelectedNode(node);

              // Safe camera flight avoiding divide-by-zero on root node (0,0,0)
              const distance = 100;
              const x = node.x ?? 0, y = node.y ?? 0, z = node.z ?? 0;
              const hypot = Math.hypot(x, y, z);

              const camPos = hypot < 0.001
                ? { x: 0, y: 0, z: distance } // center node: just pull back on Z
                : (() => { const r = 1 + distance / hypot; return { x: x * r, y: y * r, z: z * r }; })();

              fgRef.current?.cameraPosition(camPos, { x, y, z }, 1500);
            }}
          />
        </div>
      )}
    </motion.div>
  );
};

export default RelationalWeb;
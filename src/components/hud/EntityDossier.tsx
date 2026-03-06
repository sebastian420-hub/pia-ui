import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, X, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import type { IntelligenceEvent } from './LiveTicker';

interface EntityDossierProps {
  event: IntelligenceEvent | null;
  onClose: () => void;
  onOpenGraph: (entityName: string) => void;
}

interface EventDetails {
  summary: string;
  entities: string[];
}

const EntityDossier: React.FC<EntityDossierProps> = ({ event, onClose, onOpenGraph }) => {
  const [details, setDetails] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (event && event.uid) {
      setLoading(true);
      setDetails(null);
      fetch(`http://localhost:8001/api/v1/event/${event.uid}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            setDetails(data.data);
          }
        })
        .catch(err => console.error("Failed to fetch event details:", err))
        .finally(() => setLoading(false));
    }
  }, [event]);

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="absolute top-0 right-0 w-96 h-full bg-black/80 backdrop-blur-lg border-l border-white/10 z-30 flex flex-col font-mono text-sm shadow-2xl"
        >
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                  event.priority === 'CRITICAL' ? 'bg-sentinel-critical text-white' :
                  event.priority === 'HIGH' ? 'bg-sentinel-high text-white' :
                  'bg-sentinel-normal text-black'
                }`}>
                  {event.priority || 'UNK'}
                </span>
                <span className="text-white/50 text-xs">{event.domain}</span>
              </div>
              <h2 className="text-white font-bold text-lg leading-tight">{event.headline}</h2>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white p-1">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {loading ? (
               <div className="flex items-center gap-2 text-sentinel-blue mt-4">
                  <Loader2 className="animate-spin" size={16} />
                  <span>Decrypting Intelligence Payload...</span>
               </div>
            ) : (
              <>
                {/* Context/Summary */}
                <div>
                  <h3 className="text-sentinel-blue text-xs tracking-widest mb-2 flex items-center gap-2">
                    <FileText size={14} /> AI SITREP
                  </h3>
                  <p className="text-white/80 leading-relaxed text-xs">
                    {details?.summary || (event.source_type === 'SYSTEM' ? "System diagnostic event. No advanced NLP synthesis required." : "No summary available.")}
                  </p>
                </div>

                {/* Entity Extraction */}
                <div>
                  <h3 className="text-sentinel-blue text-xs tracking-widest mb-2 flex items-center gap-2">
                    <AlertTriangle size={14} /> EXTRACTED ENTITIES
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {details?.entities && details.entities.length > 0 ? (
                      details.entities.map((ent, idx) => (
                        <button 
                          key={idx}
                          onClick={() => onOpenGraph(ent)}
                          className="px-2 py-1 bg-white/5 border border-white/20 hover:border-sentinel-blue hover:bg-sentinel-blue/10 rounded text-white text-xs transition-colors"
                        >
                          [{ent}]
                        </button>
                      ))
                    ) : (
                      <span className="text-white/40 text-xs italic">No specific entities isolated.</span>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Metadata */}
            <div className="border-t border-white/10 pt-4 mt-auto">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-white/40 block mb-1">SOURCE</span>
                  <span className="text-white">{event.source_type}</span>
                </div>
                <div>
                  <span className="text-white/40 block mb-1">RECORD ID</span>
                  <span className="text-white truncate block" title={event.uid}>{event.uid.split('-')[0]}...</span>
                </div>
              </div>
            </div>

          </div>

          {/* Action Footer */}
          <div className="p-4 border-t border-white/10 bg-black/50">
            <button 
              onClick={() => onOpenGraph(details?.entities?.[0] || event.domain || 'Israel')}
              className="w-full py-3 bg-sentinel-blue/20 hover:bg-sentinel-blue/40 border border-sentinel-blue text-white rounded font-bold tracking-widest flex items-center justify-center gap-2 transition-colors"
            >
              <Network size={16} /> VIEW RELATIONAL WEB
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EntityDossier;
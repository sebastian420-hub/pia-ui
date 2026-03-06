import React from 'react';
import { motion } from 'framer-motion';
import { Filter } from 'lucide-react';

interface FilterBarProps {
  activeDomains: string[];
  onToggleDomain: (domain: string) => void;
}

const DOMAINS = ['MILITARY', 'POLITICAL', 'NATURAL', 'CYBER', 'FINANCE', 'UNKNOWN'];

const FilterBar: React.FC<FilterBarProps> = ({ activeDomains, onToggleDomain }) => {
  return (
    <motion.div 
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute top-0 left-1/2 -translate-x-1/2 mt-4 z-20 flex items-center gap-4 bg-black/60 backdrop-blur-md border border-white/10 p-2 rounded-full font-mono text-sm"
    >
      <div className="flex items-center gap-2 pl-2 pr-4 text-sentinel-blue border-r border-white/10">
        <Filter size={16} />
        <span className="font-bold tracking-widest">FILTERS</span>
      </div>

      <div className="flex gap-2">
        {DOMAINS.map((domain) => {
          const isActive = activeDomains.includes(domain);
          return (
            <button
              key={domain}
              onClick={() => onToggleDomain(domain)}
              className={`px-3 py-1 rounded-full border transition-all ${
                isActive 
                  ? 'bg-sentinel-blue/20 border-sentinel-blue text-white shadow-[0_0_10px_rgba(0,102,255,0.3)]' 
                  : 'bg-transparent border-white/20 text-white/50 hover:text-white hover:border-white/50'
              }`}
            >
              {domain}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default FilterBar;
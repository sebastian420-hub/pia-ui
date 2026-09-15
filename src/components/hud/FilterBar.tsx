import React from 'react';
import { DOMAINS } from '../../lib/domains';
import { DOMAIN_ABBR } from '../../lib/symbology';

interface FilterBarProps {
  activeDomains: string[];
  onToggleDomain: (domain: string) => void;
}

/** Domain pills; lives in the tool row under the status bar (never over the globe). */
const FilterBar: React.FC<FilterBarProps> = ({ activeDomains, onToggleDomain }) => (
  <div className="flex items-center gap-1 font-mono text-[11px]">
    <span className="text-text-3 tracking-[0.2em] mr-1">DOMAIN</span>
    {DOMAINS.map(d => {
      const on = activeDomains.includes(d);
      return (
        <button key={d} onClick={() => onToggleDomain(d)} title={d}
          className={`px-1.5 py-0.5 rounded border transition-colors ${on ? 'border-line bg-bg-3 text-text-1' : 'border-transparent text-text-3 hover:text-text-2'}`}>
          {DOMAIN_ABBR[d]}
        </button>
      );
    })}
  </div>
);

export default FilterBar;

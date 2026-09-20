import React from 'react';

/** "threatened to …" / "claims to have …" — how sure the article is that the act happened. */
export const VerdictBadge: React.FC<{ verdict?: string | null }> = ({ verdict }) => {
  if (verdict === 'yes') return <span className="ml-1 text-[9px] px-1 rounded bg-ok/20 text-ok align-middle" title="an independent check agreed with the quote">verified</span>;
  if (verdict === 'partly') return <span className="ml-1 text-[9px] px-1 rounded bg-warn/20 text-warn align-middle" title="the check found the act but not exactly as described">partly</span>;
  if (verdict === 'no') return <span className="ml-1 text-[9px] px-1 rounded bg-err/20 text-err align-middle" title="the check did not find this in the article">rejected</span>;
  return <span className="ml-1 text-[9px] px-1 rounded bg-bg-3 text-text-3 align-middle" title="not yet checked">unchecked</span>;
};


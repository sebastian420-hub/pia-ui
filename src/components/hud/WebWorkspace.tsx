import React, { useRef, useState } from 'react';
import WebView from './WebView';
import type { WebViewHandle } from './WebView';
import InspectorColumn from '../frame/InspectorColumn';
import type { Selection } from '../../lib/types';

interface Props { entityKey: string; onClose: () => void }

/** Web + its own inspector column, for pages that do not have the dashboard frame (Archive). */
const WebWorkspace: React.FC<Props> = ({ entityKey, onClose }) => {
  const webRef = useRef<WebViewHandle>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [rootId, setRootId] = useState<string | null>(null);
  return (
    <div className="absolute inset-0 z-40 bg-bg-0 grid" style={{ gridTemplateColumns: `1fr ${selection ? '380px' : '0px'}` }}>
      <div className="relative min-w-0 overflow-hidden">
        <WebView ref={webRef} entityKey={entityKey} selectedId={selection?.kind === 'entity' ? selection.key : null}
          onClose={onClose} onSelectEntity={(id) => { if (id) setSelection({ kind: 'entity', key: id }); }}
          onSelectEvidence={(a, b) => setSelection({ kind: 'evidence', a, b })} onRootChange={setRootId} />
      </div>
      <aside className={`min-h-0 bg-bg-1 border-l border-line overflow-hidden ${selection ? '' : 'hidden'}`}>
        <InspectorColumn selection={selection} onClose={() => setSelection(null)}
          onOpenEntity={(k) => setSelection({ kind: 'entity', key: k })}
          onOpenReport={() => { /* reports open on the dashboard */ }}
          onOpenCamera={() => { /* cameras live on the globe */ }}
          onOpenWeb={(k) => webRef.current?.focus(k)}
          web={{ expand: (id) => webRef.current?.expand(id), focus: (id) => webRef.current?.focus(id), rootId }} />
      </aside>
    </div>
  );
};

export default WebWorkspace;

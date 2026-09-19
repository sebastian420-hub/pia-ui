import React from 'react';
import type { Selection } from '../../lib/types';
import EntityDossier from '../hud/EntityDossier';
import CameraInspector from '../hud/CameraInspector';
import EntityInspector from '../hud/EntityInspector';
import EvidencePanel from '../hud/EvidencePanel';

interface Props {
  selection: Selection;
  onClose: () => void;
  onOpenEntity: (key: string) => void;
  onOpenReport: (uid: string) => void;
  onOpenCamera: (sensorId: string) => void;
  onOpenWeb: (key: string) => void;
  onFlyTo?: (lon: number, lat: number) => void;
  /** Present when the web is open: lets the entity card expand / re-root the web. */
  web?: { expand: (id: string) => void; focus: (id: string) => void; rootId: string | null };
}

/** The one right-hand column: whatever is selected — report, camera, entity, or an edge's evidence. */
const InspectorColumn: React.FC<Props> = ({ selection, onClose, onOpenEntity, onOpenReport, onOpenCamera, onOpenWeb, onFlyTo, web }) => {
  if (!selection) return null;
  switch (selection.kind) {
    case 'report':
      return <EntityDossier event={selection.event} onClose={onClose} onOpenGraph={onOpenEntity} onOpenCamera={onOpenCamera} />;
    case 'camera':
      return <CameraInspector sensorId={selection.sensorId} onClose={onClose} />;
    case 'entity':
      return <EntityInspector entityKey={selection.key} onClose={onClose} onOpenEntity={onOpenEntity}
        onOpenReport={onOpenReport} onOpenWeb={onOpenWeb} onFlyTo={onFlyTo} web={web} />;
    case 'evidence':
      return <EvidencePanel a={selection.a} b={selection.b} onClose={onClose} onOpenEntity={onOpenEntity} />;
  }
};

export default InspectorColumn;

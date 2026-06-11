'use client';

import { Section } from '@/types';

interface SectionsBarProps {
  sections: Section[];
  activeSecId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onContextMenu: (e: React.MouseEvent, type: 'sec', id: string) => void;
}

export function SectionsBar({ sections, activeSecId, onSelect, onAdd, onContextMenu }: SectionsBarProps) {
  return (
    <div className="sections-bar">
      {sections.map(sec => (
        <div
          key={sec.id}
          className={`sec-tab${sec.id === activeSecId ? ' active' : ''}`}
          onClick={() => onSelect(sec.id)}
          onContextMenu={e => { e.preventDefault(); onContextMenu(e, 'sec', sec.id); }}
        >
          <span className="sec-color" style={{ background: sec.color }} />
          {sec.name}
        </div>
      ))}
      <button className="add-sec-btn" onClick={onAdd} title="Nova seção">
        + Seção
      </button>
    </div>
  );
}

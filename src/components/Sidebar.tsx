'use client';

import { Notebook } from '@/types';

interface SidebarProps {
  notebooks: Notebook[];
  activeNbId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onContextMenu: (e: React.MouseEvent, type: 'nb', id: string) => void;
}

export function Sidebar({ notebooks, activeNbId, onSelect, onAdd, onContextMenu }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Cadernos</span>
        <button className="add-btn" onClick={onAdd} title="Novo caderno">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      <div className="nb-list-container">
        {notebooks.map(nb => {
          const total = nb.sections.reduce((a, s) => a + s.pages.length, 0);
          return (
            <div
              key={nb.id}
              className={`nb-item${nb.id === activeNbId ? ' active' : ''}`}
              onClick={() => onSelect(nb.id)}
              onContextMenu={e => { e.preventDefault(); onContextMenu(e, 'nb', nb.id); }}
            >
              <div className="nb-dot" style={{ background: nb.color }} />
              <span className="nb-name">{nb.name}</span>
              <span className="nb-count">{total}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

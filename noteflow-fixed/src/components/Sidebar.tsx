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
        <button className="add-btn" onClick={onAdd} title="Novo caderno">+</button>
      </div>
      <div>
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

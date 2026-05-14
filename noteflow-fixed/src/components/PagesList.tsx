'use client';

import { Page } from '@/types';

interface PagesListProps {
  pages: Page[];
  activePageId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onContextMenu: (e: React.MouseEvent, type: 'page', id: string) => void;
}

export function PagesList({ pages, activePageId, onSelect, onAdd, onContextMenu }: PagesListProps) {
  return (
    <div className="pages-list">
      <div className="pages-header">
        <span className="sidebar-title">Páginas</span>
        <button className="add-btn" onClick={onAdd} title="Nova página">+</button>
      </div>
      {pages.map(pg => {
        const plain = pg.content.replace(/<[^>]+>/g, '').slice(0, 60);
        return (
          <div
            key={pg.id}
            className={`page-item${pg.id === activePageId ? ' active' : ''}`}
            onClick={() => onSelect(pg.id)}
            onContextMenu={e => { e.preventDefault(); onContextMenu(e, 'page', pg.id); }}
          >
            <div className="page-title-small">{pg.title || 'Sem título'}</div>
            <div className="page-preview">{plain || '...'}</div>
            <div className="page-date">{pg.date}</div>
          </div>
        );
      })}
    </div>
  );
}

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
        <button className="add-btn" onClick={onAdd} title="Nova página">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      {pages.map(pg => {
        const plain = pg.content ? pg.content.replace(/<[^>]+>/g, '').trim().slice(0, 60) : '';
        return (
          <div
            key={pg.id}
            className={`page-item${pg.id === activePageId ? ' active' : ''}`}
            onClick={() => onSelect(pg.id)}
            onContextMenu={e => { e.preventDefault(); onContextMenu(e, 'page', pg.id); }}
          >
            <div className="page-title-small">{pg.title || 'Sem título'}</div>
            <div className="page-preview">{plain || 'Comece a escrever...'}</div>
            <div className="page-date">{pg.date}</div>
          </div>
        );
      })}
    </div>
  );
}

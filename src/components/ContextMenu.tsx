'use client';

import { useEffect } from 'react';
import { ContextTarget } from '@/types';

interface ContextMenuProps {
  x: number;
  y: number;
  target: ContextTarget | null;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onExport?: () => void;
}

export function ContextMenu({ x, y, target, onClose, onRename, onDelete, onExport }: ContextMenuProps) {
  useEffect(() => {
    const handler = () => onClose();
    document.addEventListener('click', handler);
    document.addEventListener('contextmenu', handler);
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('contextmenu', handler);
    };
  }, [onClose]);

  if (!target) return null;

  return (
    <div
      className="ctx-menu"
      style={{ left: x, top: y }}
      onClick={e => e.stopPropagation()}
    >
      <div className="ctx-item" onClick={onRename}>✏️ Renomear</div>
      {onExport && (
        <div className="ctx-item" onClick={onExport}>📄 Exportar</div>
      )}
      <div className="ctx-item danger" onClick={onDelete}>🗑 Excluir</div>
    </div>
  );
}

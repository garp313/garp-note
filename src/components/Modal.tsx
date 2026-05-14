'use client';

import { useEffect, useRef } from 'react';
import { COLORS } from '@/lib/data';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actions: React.ReactNode;
}

export function Modal({ open, title, onClose, children, actions }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3>{title}</h3>
        {children}
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
}

interface ColorPickerProps {
  selected: string;
  onChange: (c: string) => void;
}

export function ColorPicker({ selected, onChange }: ColorPickerProps) {
  return (
    <>
      <span className="modal-label">Cor:</span>
      <div className="color-row">
        {COLORS.map(c => (
          <div
            key={c}
            className={`color-chip${selected === c ? ' sel' : ''}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
    </>
  );
}

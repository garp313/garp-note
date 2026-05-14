'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNoteFlow } from '@/hooks/useNoteFlow';
import { Sidebar } from '@/components/Sidebar';
import { SectionsBar } from '@/components/SectionsBar';
import { PagesList } from '@/components/PagesList';
import { Editor } from '@/components/Editor';
import { Modal, ColorPicker } from '@/components/Modal';
import { ContextMenu } from '@/components/ContextMenu';
import { COLORS } from '@/lib/data';
import { exportPage, exportSection, exportNotebook } from '@/lib/exportPdf';
import { ContextTarget } from '@/types';

export default function NoteFlowPage() {
  const {
    data, editorRef, titleRef,
    getActivNb, getActivSec, getActivPage,
    flushEditor, selectNotebook, selectSection, selectPage,
    createNotebook, createSection, createPage,
    renameItem, deleteItem, search, updateData,
  } = useNoteFlow();

  // Dark mode
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('nf_dark');
    const isDark = saved === '1';
    if (isDark) {
      setDark(true);
      // Aplica no <html> para as variáveis CSS cascatearem corretamente
      // no contentEditable e em todo o documento
      document.documentElement.classList.add('dark');
    }
  }, []);
  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('nf_dark', next ? '1' : '0');
    // Sincroniza com o <html> além da div.app
    document.documentElement.classList.toggle('dark', next);
  };

  // Toast
  const [toast, setToast] = useState({ msg: '', k: 0 });
  const showToast = useCallback((msg: string) => {
    setToast(prev => ({ msg, k: prev.k + 1 }));
    setTimeout(() => setToast(prev => ({ ...prev, msg: '' })), 2000);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        flushEditor();
        showToast('Salvo! ✓');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        editorRef.current?.focus();
        document.execCommand('bold', false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        editorRef.current?.focus();
        document.execCommand('italic', false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [editorRef, flushEditor, showToast]);

  // Context menu
  const [ctx, setCtx] = useState<{ x: number; y: number; target: ContextTarget | null }>({ x: 0, y: 0, target: null });
  const openCtx = useCallback((e: React.MouseEvent, type: ContextTarget['type'], id: string) => {
    e.preventDefault();
    setCtx({ x: e.clientX, y: e.clientY, target: { type, id } });
  }, []);
  const closeCtx = useCallback(() => setCtx(prev => ({ ...prev, target: null })), []);

  // Rename modal
  const [renameModal, setRenameModal] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const openRename = useCallback(() => {
    if (!ctx.target) return;
    const activNb = getActivNb();
    let cur = '';
    if (ctx.target.type === 'nb') cur = data.notebooks.find(n => n.id === ctx.target!.id)?.name ?? '';
    else if (ctx.target.type === 'sec') cur = activNb?.sections.find(s => s.id === ctx.target!.id)?.name ?? '';
    else cur = getActivSec()?.pages.find(p => p.id === ctx.target!.id)?.title ?? '';
    setRenameVal(cur);
    setRenameModal(true);
    closeCtx();
  }, [ctx.target, data, getActivNb, getActivSec, closeCtx]);

  const confirmRename = useCallback(() => {
    if (ctx.target && renameVal.trim()) renameItem(ctx.target, renameVal.trim());
    setRenameModal(false);
  }, [ctx.target, renameVal, renameItem]);

  // Export PDF
  const handleExport = useCallback(() => {
    if (!ctx.target) return;
    flushEditor();
    const nb = data.notebooks.find(n => n.id === (ctx.target?.type === 'nb' ? ctx.target.id : data.activeNb));
    if (ctx.target.type === 'nb' && nb) {
      exportNotebook(nb);
    } else if (ctx.target.type === 'sec') {
      const sec = nb?.sections.find(s => s.id === ctx.target?.id);
      if (sec) exportSection(sec);
    } else if (ctx.target.type === 'page') {
      const sec = nb?.sections.find(s => s.pages.some(p => p.id === ctx.target?.id));
      const page = sec?.pages.find(p => p.id === ctx.target?.id);
      if (page) exportPage(page);
    }
    showToast('Gerando PDF...');
  }, [ctx.target, data, flushEditor, showToast]);

  // Delete
  const handleDelete = useCallback(() => {
    if (!ctx.target) return;
    if (!confirm('Excluir este item?')) { closeCtx(); return; }
    deleteItem(ctx.target);
    closeCtx();
  }, [ctx.target, deleteItem, closeCtx]);

  // Notebook modal
  const [nbModal, setNbModal] = useState(false);
  const [nbName, setNbName] = useState('');
  const [nbColor, setNbColor] = useState(COLORS[0]);
  const confirmNb = () => {
    if (!nbName.trim()) return;
    createNotebook(nbName.trim(), nbColor);
    setNbModal(false); setNbName('');
  };

  // Section modal
  const [secModal, setSecModal] = useState(false);
  const [secName, setSecName] = useState('');
  const [secColor, setSecColor] = useState(COLORS[0]);
  const confirmSec = () => {
    if (!secName.trim()) return;
    createSection(secName.trim(), secColor);
    setSecModal(false); setSecName('');
  };

  // Math modal
  const [mathModal, setMathModal] = useState(false);
  const [mathVal, setMathVal] = useState('');
  const insertMath = () => {
    if (!mathVal.trim()) { setMathModal(false); return; }
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, `<div class="math-block">${mathVal}</div>`);
    flushEditor();
    setMathModal(false); setMathVal('');
  };

  // Search
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchResults = query.trim() ? search(query) : [];

  const goToResult = (nbId: string, secId: string, pgId: string) => {
    flushEditor();
    updateData(prev => ({ ...prev, activeNb: nbId, activeSec: secId, activePage: pgId }));
    setQuery(''); setSearchOpen(false);
  };

  // Attachment
  const handleAttach = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      editorRef.current?.focus();
      if (file.type.startsWith('image/')) {
        document.execCommand('insertHTML', false, `<img src="${e.target?.result}" alt="${file.name}">`);
      } else {
        document.execCommand('insertHTML', false, `<span class="attachment-icon">📄 ${file.name}</span>`);
      }
      flushEditor();
    };
    reader.readAsDataURL(file);
  }, [editorRef, flushEditor]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export PDF
  const handleExport = useCallback(() => {
    if (!ctx.target) return;
    flushEditor();
    const nb = data.notebooks.find(n => n.id === (ctx.target?.type === 'nb' ? ctx.target.id : data.activeNb));
    if (ctx.target.type === 'nb' && nb) {
      exportNotebook(nb);
    } else if (ctx.target.type === 'sec') {
      const sec = nb?.sections.find(s => s.id === ctx.target?.id);
      if (sec) exportSection(sec);
    } else if (ctx.target.type === 'page') {
      const sec = nb?.sections.find(s => s.pages.some(p => p.id === ctx.target?.id));
      const page = sec?.pages.find(p => p.id === ctx.target?.id);
      if (page) exportPage(page);
    }
    showToast('Gerando PDF...');
  }, [ctx.target, data, flushEditor, showToast]);
  const activSec = getActivSec();
  const activPage = getActivPage();

  return (
    <div className={`app${dark ? ' dark' : ''}`}>
      {/* TOPBAR */}
      <header className="topbar">
        <span className="logo">📒 Garp Note</span>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            className="search-bar"
            type="text"
            placeholder="Buscar em todos os cadernos..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            autoComplete="off"
          />
          {searchOpen && searchResults.length > 0 && (
            <div className="search-results" style={{ left: 0, top: '100%' }}>
              {searchResults.map(r => {
                const q = query.toLowerCase();
                const hiSnippet = r.snippet.replace(new RegExp(q, 'gi'), m => `<mark>${m}</mark>`);
                return (
                  <div key={r.pg.id} className="sr-item" onClick={() => goToResult(r.nb.id, r.sec.id, r.pg.id)}>
                    <div className="sr-path">{r.nb.name} › {r.sec.name}</div>
                    <div className="sr-title">{r.pg.title}</div>
                    <div className="sr-snippet" dangerouslySetInnerHTML={{ __html: hiSnippet }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <button className="top-btn" onClick={() => setNbModal(true)}>+ Caderno</button>
        <button className="top-btn" onClick={() => fileInputRef.current?.click()}>📎 Anexar</button>
        <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleAttach(f); e.target.value = ''; }} />
        <button className="top-btn round" onClick={toggleDark} title="Alternar modo escuro">{dark ? '☀️' : '🌙'}</button>
      </header>

      {/* SIDEBAR */}
      <Sidebar
        notebooks={data.notebooks}
        activeNbId={data.activeNb}
        onSelect={selectNotebook}
        onAdd={() => setNbModal(true)}
        onContextMenu={openCtx}
      />

      {/* MAIN */}
      <main className="main">
        {/* SECTIONS BAR */}
        {activNb && (
          <SectionsBar
            sections={activNb.sections}
            activeSecId={data.activeSec}
            onSelect={selectSection}
            onAdd={() => setSecModal(true)}
            onContextMenu={openCtx}
          />
        )}

        {/* PAGES + EDITOR */}
        <div className="pages-panel">
          <PagesList
            pages={activSec?.pages ?? []}
            activePageId={data.activePage}
            onSelect={selectPage}
            onAdd={createPage}
            onContextMenu={openCtx}
          />
          <div className="editor-wrap">
            <Editor
              page={activPage}
              editorRef={editorRef}
              titleRef={titleRef}
              onFlush={flushEditor}
              onSave={() => { flushEditor(); showToast('Salvo! ✓'); }}
              onAttach={handleAttach}
              onMathOpen={() => setMathModal(true)}
            />
          </div>
        </div>
      </main>

      {/* CONTEXT MENU */}
      {ctx.target && (
        <ContextMenu
          x={ctx.x} y={ctx.y}
          target={ctx.target}
          onClose={closeCtx}
          onRename={openRename}
          onDelete={handleDelete}
          onExport={handleExport}
        />
      )}

      {/* MODAL: Novo Caderno */}
      <Modal
        open={nbModal}
        title="Novo Caderno"
        onClose={() => setNbModal(false)}
        actions={<>
          <button className="btn-sec" onClick={() => setNbModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={confirmNb}>Criar</button>
        </>}
      >
        <input
          type="text"
          placeholder="Nome do caderno..."
          value={nbName}
          onChange={e => setNbName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && confirmNb()}
          autoFocus
        />
        <ColorPicker selected={nbColor} onChange={setNbColor} />
      </Modal>

      {/* MODAL: Nova Seção */}
      <Modal
        open={secModal}
        title="Nova Seção"
        onClose={() => setSecModal(false)}
        actions={<>
          <button className="btn-sec" onClick={() => setSecModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={confirmSec}>Criar</button>
        </>}
      >
        <input
          type="text"
          placeholder="Nome da seção..."
          value={secName}
          onChange={e => setSecName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && confirmSec()}
          autoFocus
        />
        <ColorPicker selected={secColor} onChange={setSecColor} />
      </Modal>

      {/* MODAL: Renomear */}
      <Modal
        open={renameModal}
        title="Renomear"
        onClose={() => setRenameModal(false)}
        actions={<>
          <button className="btn-sec" onClick={() => setRenameModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={confirmRename}>Salvar</button>
        </>}
      >
        <input
          type="text"
          value={renameVal}
          onChange={e => setRenameVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && confirmRename()}
          autoFocus
        />
      </Modal>

      {/* MODAL: Fórmula */}
      <Modal
        open={mathModal}
        title="Inserir Fórmula"
        onClose={() => setMathModal(false)}
        actions={<>
          <button className="btn-sec" onClick={() => setMathModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={insertMath}>Inserir</button>
        </>}
      >
        <textarea
          rows={3}
          placeholder="Ex: f(x) = \int_a^b x^2 dx"
          value={mathVal}
          onChange={e => setMathVal(e.target.value)}
          autoFocus
        />
        <span className="modal-label">Prévia:</span>
        <div className="math-preview">{mathVal || '...'}</div>
      </Modal>

      {/* TOAST */}
      {toast.msg && <div key={toast.k} className="toast">{toast.msg}</div>}
    </div>
  );
}

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNoteFlow } from '@/hooks/useNoteFlow';
import { Sidebar } from '@/components/Sidebar';
import { SectionsBar } from '@/components/SectionsBar';
import { PagesList } from '@/components/PagesList';
import { Editor } from '@/components/Editor';
import { Modal, ColorPicker } from '@/components/Modal';
import { ContextMenu } from '@/components/ContextMenu';
import { ImportPDF, ImportedNotebook } from '@/components/ImportPDF';
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
      document.documentElement.classList.add('dark');
    }
  }, []);
  
  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('nf_dark', next ? '1' : '0');
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
        showToast('Alterações salvas! ✓');
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
  const [renameTarget, setRenameTarget] = useState<ContextTarget | null>(null);

  const openRename = useCallback(() => {
    if (!ctx.target) return;
    const activNb = getActivNb();
    let cur = '';
    if (ctx.target.type === 'nb') cur = data.notebooks.find(n => n.id === ctx.target!.id)?.name ?? '';
    else if (ctx.target.type === 'sec') cur = activNb?.sections.find(s => s.id === ctx.target!.id)?.name ?? '';
    else cur = getActivSec()?.pages.find(p => p.id === ctx.target!.id)?.title ?? '';
    setRenameVal(cur);
    setRenameTarget(ctx.target);
    setRenameModal(true);
    closeCtx();
  }, [ctx.target, data, getActivNb, getActivSec, closeCtx]);

  const confirmRename = useCallback(() => {
    if (renameTarget && renameVal.trim()) renameItem(renameTarget, renameVal.trim());
    setRenameModal(false);
    setRenameTarget(null);
  }, [renameTarget, renameVal, renameItem]);

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
    showToast('Gerando documento PDF...');
  }, [ctx.target, data, flushEditor, showToast]);

  // Delete Confirmation Modal (Premium replacement for native confirm)
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContextTarget | null>(null);

  const openDeleteConfirm = useCallback(() => {
    if (!ctx.target) return;
    setDeleteTarget(ctx.target);
    setDeleteModal(true);
    closeCtx();
  }, [ctx.target, closeCtx]);

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteItem(deleteTarget);
      showToast('Item excluído.');
    }
    setDeleteModal(false);
    setDeleteTarget(null);
  }, [deleteTarget, deleteItem, showToast]);

  // Notebook modal
  const [nbModal, setNbModal] = useState(false);
  const [nbName, setNbName] = useState('');
  const [nbColor, setNbColor] = useState(COLORS[0]);
  const confirmNb = () => {
    if (!nbName.trim()) return;
    createNotebook(nbName.trim(), nbColor);
    setNbModal(false); setNbName('');
    showToast('Caderno criado!');
  };

  // Section modal
  const [secModal, setSecModal] = useState(false);
  const [secName, setSecName] = useState('');
  const [secColor, setSecColor] = useState(COLORS[0]);
  const confirmSec = () => {
    if (!secName.trim()) return;
    createSection(secName.trim(), secColor);
    setSecModal(false); setSecName('');
    showToast('Seção criada!');
  };

  // Math modal
  const [mathModal, setMathModal] = useState(false);
  const [mathVal, setMathVal] = useState('');
  const insertMath = () => {
    if (!mathVal.trim()) { setMathModal(false); return; }
    if (editorRef.current && (editorRef.current as any).restoreSelection) {
      (editorRef.current as any).restoreSelection();
    } else {
      editorRef.current?.focus();
    }
    document.execCommand('insertHTML', false, `<div class="math-block">${mathVal}</div>`);
    flushEditor();
    setMathModal(false); setMathVal('');
  };

  // Import PDF modal
  const [importModal, setImportModal] = useState(false);
  const handleImportPDF = useCallback((imported: ImportedNotebook) => {
    const now = new Date().toLocaleDateString('pt-BR');
    const ts = Date.now();
    const newNb = {
      id: 'nb' + ts,
      name: imported.notebookName,
      color: imported.notebookColor,
      sections: imported.sections.map((sec, si) => ({
        id: 's' + ts + si,
        name: sec.name,
        color: sec.color,
        pages: sec.pages.map((pg, pi) => ({
          id: 'p' + ts + si + pi,
          title: pg.title,
          content: pg.content,
          date: now,
        })),
      })),
    };
    updateData(prev => ({
      ...prev,
      notebooks: [...prev.notebooks, newNb],
      activeNb: newNb.id,
      activeSec: newNb.sections[0]?.id ?? null,
      activePage: newNb.sections[0]?.pages[0]?.id ?? null,
    }));
    showToast('📥 Caderno importado com sucesso!');
  }, [updateData, showToast]);

  // Search
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchResults = query.trim() ? search(query) : [];

  const goToResult = (nbId: string, secId: string, pgId: string) => {
    flushEditor();
    updateData(prev => ({ ...prev, activeNb: nbId, activeSec: secId, activePage: pgId }));
    setQuery(''); setSearchOpen(false);
  };

  // Close search results when clicking outside
  const searchContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const clickHandler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', clickHandler);
    return () => document.removeEventListener('mousedown', clickHandler);
  }, []);

  // Attachment
  const handleAttach = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      if (editorRef.current && (editorRef.current as any).restoreSelection) {
        (editorRef.current as any).restoreSelection();
      } else {
        editorRef.current?.focus();
      }
      if (file.type.startsWith('image/')) {
        const editor = editorRef.current;
        let top = 20;
        if (editor) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const editorRect = editor.getBoundingClientRect();
            if (rect.top !== 0 && rect.left !== 0) {
              top = rect.top - editorRect.top + editor.scrollTop;
            } else {
              top = editor.scrollTop + 50;
            }
          } else {
            top = editor.scrollTop + 50;
          }
        }
        const wrapperHTML = `
          <div class="resizable-image-wrapper" contenteditable="false" style="position: absolute; left: 10px; top: ${top}px; width: 300px; cursor: move; user-select: none; display: inline-block;">
            <img src="${e.target?.result}" alt="${file.name}" style="width: 100%; height: auto; display: block; border-radius: 4px; pointer-events: none;" />
            <div class="resize-handle top-left"></div>
            <div class="resize-handle top-right"></div>
            <div class="resize-handle bottom-left"></div>
            <div class="resize-handle bottom-right"></div>
          </div>
        `;
        document.execCommand('insertHTML', false, wrapperHTML);
      } else {
        document.execCommand('insertHTML', false, `<span class="attachment-icon">📄 ${file.name}</span>`);
      }
      flushEditor();
      showToast('Arquivo anexado!');
    };
    reader.readAsDataURL(file);
  }, [editorRef, flushEditor, showToast]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activNb = getActivNb();
  const activSec = getActivSec();
  const activPage = getActivPage();

  return (
    <div className={`app${dark ? ' dark' : ''}`}>
      {/* TOPBAR */}
      <header className="topbar">
        <span className="logo">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10"/></svg>
          Cadernin do Estevão
        </span>
        
        <div ref={searchContainerRef} className="search-container">
          <div className="search-icon-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
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
            <div className="search-results">
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

        <button className="top-btn" onClick={() => setImportModal(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Importar PDF
        </button>
        <button className="top-btn accent" onClick={() => setNbModal(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo Caderno
        </button>
        <button className="top-btn" onClick={() => fileInputRef.current?.click()} title="Anexar arquivos">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          Anexar
        </button>
        
        <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleAttach(f); e.target.value = ''; }} />
        
        <button className="top-btn round" onClick={toggleDark} title="Alternar modo escuro">
          {dark ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
          )}
        </button>
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
              onSave={() => { flushEditor(); showToast('Alterações salvas! ✓'); }}
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
          onDelete={openDeleteConfirm}
          onExport={handleExport}
        />
      )}

      {/* MODAL: Novo Caderno */}
      <Modal
        open={nbModal}
        title="Criar Novo Caderno"
        onClose={() => setNbModal(false)}
        actions={<>
          <button className="btn-sec" onClick={() => setNbModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={confirmNb}>Criar</button>
        </>}
      >
        <label className="modal-label">Nome do Caderno</label>
        <input
          type="text"
          placeholder="Ex: 1º Semestre, Projetos..."
          value={nbName}
          onChange={e => setNbName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && confirmNb()}
          autoFocus
        />
        <label className="modal-label">Cor de Identificação</label>
        <ColorPicker selected={nbColor} onChange={setNbColor} />
      </Modal>

      {/* MODAL: Nova Seção */}
      <Modal
        open={secModal}
        title="Criar Nova Seção"
        onClose={() => setSecModal(false)}
        actions={<>
          <button className="btn-sec" onClick={() => setSecModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={confirmSec}>Criar</button>
        </>}
      >
        <label className="modal-label">Nome da Seção</label>
        <input
          type="text"
          placeholder="Ex: Cálculo I, Anotações Gerais..."
          value={secName}
          onChange={e => setSecName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && confirmSec()}
          autoFocus
        />
        <label className="modal-label">Cor de Identificação</label>
        <ColorPicker selected={secColor} onChange={setSecColor} />
      </Modal>

      {/* MODAL: Renomear */}
      <Modal
        open={renameModal}
        title="Renomear Item"
        onClose={() => setRenameModal(false)}
        actions={<>
          <button className="btn-sec" onClick={() => setRenameModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={confirmRename}>Salvar</button>
        </>}
      >
        <label className="modal-label">Novo Nome</label>
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
        title="Inserir Fórmula Matemática"
        onClose={() => setMathModal(false)}
        actions={<>
          <button className="btn-sec" onClick={() => setMathModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={insertMath}>Inserir Fórmula</button>
        </>}
      >
        <label className="modal-label">Expressão (LaTeX / Unicode)</label>
        <textarea
          rows={3}
          placeholder="Ex: f(x) = \int_a^b x^2 dx ou E = mc²"
          value={mathVal}
          onChange={e => setMathVal(e.target.value)}
          autoFocus
        />
        <span className="modal-label">Pré-visualização:</span>
        <div className="math-preview">{mathVal || 'Escreva a fórmula acima...'}</div>
      </Modal>

      {/* MODAL: Confirmação de Exclusão (Premium) */}
      <Modal
        open={deleteModal}
        title="Excluir Item?"
        onClose={() => setDeleteModal(false)}
        actions={<>
          <button className="btn-sec" onClick={() => setDeleteModal(false)}>Cancelar</button>
          <button className="btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444', boxShadow: 'none' }} onClick={confirmDelete}>Excluir</button>
        </>}
      >
        <p style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: '1.5' }}>
          Esta ação é irreversível. O item selecionado e todo o seu conteúdo associado serão permanentemente apagados.
        </p>
      </Modal>

      {/* MODAL: Importar PDF */}
      {importModal && (
        <ImportPDF
          onImport={handleImportPDF}
          onClose={() => setImportModal(false)}
        />
      )}

      {/* TOAST */}
      {toast.msg && (
        <div key={toast.k} className="toast">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

'use client';

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Page } from '@/types';

interface EditorProps {
  page: Page | undefined;
  editorRef: RefObject<HTMLDivElement>;
  titleRef: RefObject<HTMLInputElement>;
  onFlush: () => void;
  onSave: () => void;
  onAttach: (file: File) => void;
  onMathOpen: () => void;
}

export function Editor({ page, editorRef, titleRef, onFlush, onSave, onAttach, onMathOpen }: EditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [prevPageId, setPrevPageId] = useState<string | undefined>(undefined);
  const [dragActive, setDragActive] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced auto-save
  const handleInput = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onFlush();
    }, 1000);
  }, [onFlush]);

  // Immediate save on blur
  const handleBlur = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    onFlush();
  }, [onFlush]);

  // Flush when page changes
  useEffect(() => {
    if (!page) {
      if (prevPageId && debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        onFlush();
      }
      setPrevPageId(undefined);
      return;
    }

    if (page.id !== prevPageId) {
      // If we are transitioning from another page, flush the old content first
      if (prevPageId) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        onFlush();
      }

      setPrevPageId(page.id);
      if (titleRef.current) titleRef.current.value = page.title ?? '';
      if (editorRef.current) editorRef.current.innerHTML = page.content ?? '';
    }
  }, [page, prevPageId, onFlush, titleRef, editorRef]);

  // Clean up on unmount and flush any pending saves
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Save on tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      onFlush();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [onFlush]);

  // Drag & Drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onAttach(e.dataTransfer.files[0]);
    }
  }, [onAttach]);

  // Remove inline styles injected by browsers
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const stripInlineColors = (node: Node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      el.style.removeProperty('color');
      el.style.removeProperty('background-color');
      el.style.removeProperty('background');
      if (el.getAttribute('style') === '') el.removeAttribute('style');
      el.childNodes.forEach(stripInlineColors);
    };

    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(stripInlineColors);
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          stripInlineColors(mutation.target);
        }
      });
    });

    observer.observe(editor, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });

    return () => observer.disconnect();
  }, [editorRef]);

  const fmt = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    handleInput();
  }, [editorRef, handleInput]);

  const fmtBlock = useCallback((tag: string) => {
    if (!tag) return;
    editorRef.current?.focus();
    document.execCommand('formatBlock', false, tag);
    handleInput();
  }, [editorRef, handleInput]);

  const insertHTML = useCallback((html: string) => {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, html);
    handleInput();
  }, [editorRef, handleInput]);

  const insertCheckbox = () => insertHTML('<label><input type="checkbox"> </label><br>');
  const insertCode = () => insertHTML('<pre>// código aqui</pre>');
  const insertQuote = () => insertHTML('<blockquote>Citação</blockquote>');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onAttach(file);
    e.target.value = '';
  };

  const exportMD = () => {
    if (!page) return;
    const md = `# ${page.title}\n\n${page.content.replace(/<[^>]+>/g, '').replace(/\n+/g, '\n')}`;
    const a = document.createElement('a');
    a.href = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(md);
    a.download = (page.title || 'nota') + '.md';
    a.click();
  };

  const copyPlain = () => {
    if (!page) return;
    navigator.clipboard.writeText(page.title + '\n\n' + page.content.replace(/<[^>]+>/g, ''));
  };

  if (!page) {
    return (
      <div className="no-page">
        <div className="empty-icon">📝</div>
        <div className="empty-title">Sem anotação aberta</div>
        <p className="empty-desc">Selecione um caderno ou crie uma nova página para começar.</p>
      </div>
    );
  }

  return (
    <div 
      className={`editor-area ${dragActive ? 'drag-active' : ''}`}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      {dragActive && (
        <div className="editor-drag-overlay">
          <div className="drag-overlay-box">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            <span>Solte o arquivo para anexar</span>
          </div>
        </div>
      )}

      <div className="editor-topbar">
        <div className="editor-toolbar-group">
          <button className="fmt-btn" onClick={() => fmt('bold')} title="Negrito">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12h9a4 4 0 0 0 0-8H6v8Z"/><path d="M6 20h10a4 4 0 0 0 0-8H6v8Z"/></svg>
          </button>
          <button className="fmt-btn" onClick={() => fmt('italic')} title="Itálico">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
          </button>
          <button className="fmt-btn" onClick={() => fmt('underline')} title="Sublinhado">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
          </button>
          <button className="fmt-btn" onClick={() => fmt('strikeThrough')} title="Tachado">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><path d="M16 6A5 5 0 0 0 8 9c0 2.2 1.8 3 3.5 3.5"/></svg>
          </button>
        </div>

        <span className="fmt-sep" />

        <div className="editor-toolbar-group">
          <select
            className="fmt-select"
            onChange={e => { fmtBlock(e.target.value); e.target.value = ''; }}
            defaultValue=""
          >
            <option value="" disabled>Formatar texto</option>
            <option value="h1">Título Grande (H1)</option>
            <option value="h2">Título Médio (H2)</option>
            <option value="h3">Subtítulo (H3)</option>
            <option value="p">Texto Normal</option>
          </select>
        </div>

        <span className="fmt-sep" />

        <div className="editor-toolbar-group">
          <button className="fmt-btn" onClick={() => fmt('insertUnorderedList')} title="Lista com Marcadores">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
          <button className="fmt-btn" onClick={() => fmt('insertOrderedList')} title="Lista Numerada">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
          </button>
          <button className="fmt-btn" onClick={insertCheckbox} title="Caixa de Seleção">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="m9 12 2 2 4-4"/></svg>
          </button>
        </div>

        <span className="fmt-sep" />

        <div className="editor-toolbar-group">
          <button className="fmt-btn" onClick={insertCode} title="Bloco de Código">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </button>
          <button className="fmt-btn" onClick={insertQuote} title="Citação">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3a5 5 0 0 0-4 2 5 5 0 0 0-4-2H4v13h4a5 5 0 0 1 4 2 5 5 0 0 1 4-2h4V3h-4Z"/><path d="M12 3v15"/></svg>
          </button>
          <button className="fmt-btn" onClick={onMathOpen} title="Fórmula Matemática">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 4H6L12 12L6 20H18"/></svg>
          </button>
        </div>

        <div className="export-group">
          <button className="export-btn" onClick={exportMD} title="Exportar como Markdown">📄 Markdown</button>
          <button className="export-btn" onClick={() => window.print()} title="Imprimir / Exportar como PDF">🖨️ PDF</button>
          <button className="export-btn" onClick={copyPlain} title="Copiar como Texto Plano">📋 Copiar</button>
        </div>
      </div>

      <div className="editor-scroller">
        <input
          ref={titleRef}
          className="page-title-input"
          type="text"
          placeholder="Título da página..."
          onInput={handleInput}
          onBlur={handleBlur}
        />

        <div
          ref={editorRef}
          className="editor-content"
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Comece a escrever aqui..."
          onInput={handleInput}
          onBlur={handleBlur}
        />
      </div>

      <input 
        ref={fileRef} 
        type="file" 
        accept="image/*,.pdf" 
        style={{ display: 'none' }} 
        onChange={handleFileChange} 
      />
    </div>
  );
}

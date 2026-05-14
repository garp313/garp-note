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

  // When page changes, update editor content
  useEffect(() => {
    if (!page) return;
    if (page.id === prevPageId) return;
    setPrevPageId(page.id);
    if (titleRef.current) titleRef.current.value = page.title ?? '';
    if (editorRef.current) editorRef.current.innerHTML = page.content ?? '';
  }, [page, editorRef, titleRef, prevPageId]);

  // Remove estilos inline de cor que o browser injeta via execCommand (bold, lists, etc.)
  // Isso garante que o modo escuro funcione em TODOS os cadernos
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
  }, [editorRef]);

  const fmtBlock = useCallback((tag: string) => {
    if (!tag) return;
    editorRef.current?.focus();
    document.execCommand('formatBlock', false, tag);
  }, [editorRef]);

  const insertHTML = useCallback((html: string) => {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, html);
  }, [editorRef]);

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
        <div>Selecione ou crie uma página</div>
      </div>
    );
  }

  return (
    <div className="editor-area">
      <div className="editor-topbar">
        <button className="fmt-btn" onClick={() => fmt('bold')} title="Negrito"><b>B</b></button>
        <button className="fmt-btn" onClick={() => fmt('italic')} title="Itálico"><i>I</i></button>
        <button className="fmt-btn" onClick={() => fmt('underline')} title="Sublinhado" style={{ textDecoration: 'underline' }}>U</button>
        <button className="fmt-btn" onClick={() => fmt('strikeThrough')} title="Tachado" style={{ textDecoration: 'line-through' }}>S</button>
        <span className="fmt-sep" />
        <select
          className="fmt-select"
          onChange={e => { fmtBlock(e.target.value); e.target.value = ''; }}
          defaultValue=""
        >
          <option value="" disabled>¶ Formato</option>
          <option value="h1">H1</option>
          <option value="h2">H2</option>
          <option value="h3">H3</option>
          <option value="p">Parágrafo</option>
        </select>
        <span className="fmt-sep" />
        <button className="fmt-btn" onClick={() => fmt('insertUnorderedList')} title="Lista">☰</button>
        <button className="fmt-btn" onClick={() => fmt('insertOrderedList')} title="Numerada">1.</button>
        <button className="fmt-btn" onClick={insertCheckbox} title="Checkbox">☑</button>
        <span className="fmt-sep" />
        <button className="fmt-btn" onClick={insertCode} title="Código">&lt;/&gt;</button>
        <button className="fmt-btn" onClick={insertQuote} title="Citação">❝</button>
        <button className="fmt-btn" onClick={onMathOpen} title="Fórmula matemática">∑</button>
        <div className="export-group">
          <button className="export-btn" onClick={exportMD}>📄 .md</button>
          <button className="export-btn" onClick={() => window.print()}>🖨 PDF</button>
          <button className="export-btn" onClick={copyPlain}>📋 Texto</button>
        </div>
      </div>

      <input
        ref={titleRef}
        className="page-title-input"
        type="text"
        placeholder="Título da página..."
        onInput={onFlush}
      />

      <div
        ref={editorRef}
        className="editor-content"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Comece a escrever..."
        onInput={onFlush}
      />

      <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  );
}

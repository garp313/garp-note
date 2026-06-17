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
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const [fontSizeOpen, setFontSizeOpen] = useState(false);
  const fontSizeRef = useRef<HTMLDivElement>(null);
  const [highlighterOpen, setHighlighterOpen] = useState(false);
  const highlighterRef = useRef<HTMLDivElement>(null);
  const lastRangeRef = useRef<Range | null>(null);

  const COLOR_PALETTE = [
    '#0f172a','#ef4444','#f97316','#eab308','#22c55e',
    '#3b82f6','#6366f1','#a855f7','#ec4899','#14b8a6',
    '#ffffff','#dc2626','#ea580c','#ca8a04','#16a34a',
    '#2563eb','#4f46e5','#9333ea','#db2777','#0d9488',
  ];

  const HIGHLIGHT_PALETTE = [
    'transparent',
    '#fef08a', // Amarelo
    '#bbf7d0', // Verde
    '#bfdbfe', // Azul
    '#fbcfe8', // Rosa
    '#fed7aa', // Laranja
    '#e9d5ff', // Roxo
  ];

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

  // Update the DOM when the active page changes.
  // NOTE: We do NOT call onFlush() here. The navigation functions (selectPage,
  // selectSection, selectNotebook) already flush the old page atomically in a
  // single setData call BEFORE changing activePage. Calling onFlush() here would
  // re-save the old DOM content (old title) into the already-changed activePage,
  // which is exactly the title-duplication bug we are fixing.
  useEffect(() => {
    if (!page) {
      // Just cancel any pending debounce; navigation already flushed.
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      setPrevPageId(undefined);
      return;
    }

    if (page.id !== prevPageId) {
      // Cancel any pending debounce — the navigation already saved the old page.
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      setPrevPageId(page.id);
      if (titleRef.current) titleRef.current.value = page.title ?? '';
      if (editorRef.current) editorRef.current.innerHTML = page.content ?? '';
    }
  }, [page, prevPageId, titleRef, editorRef]);

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

  // Save selection range when user is editing to prevent losing it on select/dropdown click
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        // Only save selection if it's inside the editor content area
        if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
          lastRangeRef.current = range;
        }
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [editorRef]);

  const restoreSelection = useCallback(() => {
    if (!lastRangeRef.current) return;
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(lastRangeRef.current);
    }
  }, []);

  // Close popups when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerOpen(false);
      }
      if (fontSizeRef.current && !fontSizeRef.current.contains(e.target as Node)) {
        setFontSizeOpen(false);
      }
      if (highlighterRef.current && !highlighterRef.current.contains(e.target as Node)) {
        setHighlighterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Apply color to selected text
  const applyColor = useCallback((color: string) => {
    restoreSelection();
    editorRef.current?.focus();
    document.execCommand('foreColor', false, color);
    handleInput();
    setColorPickerOpen(false);
  }, [editorRef, handleInput, restoreSelection]);

  // Apply font size (%) to selected text using a robust execCommand + node replacement strategy
  const applyFontSize = useCallback((percent: string) => {
    restoreSelection();
    editorRef.current?.focus();
    document.execCommand('fontSize', false, '7');
    if (editorRef.current) {
      const fonts = editorRef.current.querySelectorAll('font[size="7"]');
      fonts.forEach(font => {
        const span = document.createElement('span');
        span.style.fontSize = percent;
        while (font.firstChild) {
          span.appendChild(font.firstChild);
        }
        font.parentNode?.replaceChild(span, font);
      });
    }
    handleInput();
  }, [editorRef, handleInput, restoreSelection]);

  // Apply background (highlight) color to selected text
  const applyHighlight = useCallback((color: string) => {
    restoreSelection();
    editorRef.current?.focus();
    document.execCommand('backColor', false, color);
    handleInput();
    setHighlighterOpen(false);
  }, [editorRef, handleInput, restoreSelection]);

  // Insert a custom 3x3 table (OneNote style)
  const insertTable = useCallback(() => {
    editorRef.current?.focus();
    const tableHTML = `
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <thead>
          <tr style="background:var(--panel);">
            <th style="border:1px solid var(--border); padding:8px 12px; text-align:left; font-weight:600;">Cabeçalho 1</th>
            <th style="border:1px solid var(--border); padding:8px 12px; text-align:left; font-weight:600;">Cabeçalho 2</th>
            <th style="border:1px solid var(--border); padding:8px 12px; text-align:left; font-weight:600;">Cabeçalho 3</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid var(--border); padding:8px 12px;">Dado 1</td>
            <td style="border:1px solid var(--border); padding:8px 12px;">Dado 2</td>
            <td style="border:1px solid var(--border); padding:8px 12px;">Dado 3</td>
          </tr>
          <tr>
            <td style="border:1px solid var(--border); padding:8px 12px;">Dado 4</td>
            <td style="border:1px solid var(--border); padding:8px 12px;">Dado 5</td>
            <td style="border:1px solid var(--border); padding:8px 12px;">Dado 6</td>
          </tr>
        </tbody>
      </table><br>
    `;
    document.execCommand('insertHTML', false, tableHTML);
    handleInput();
  }, [editorRef, handleInput]);

  // Insert custom OneNote-like tags (⭐️ Important, ❓ Question)
  const insertTag = useCallback((type: 'star' | 'question') => {
    editorRef.current?.focus();
    let tagHTML = '';
    if (type === 'star') {
      tagHTML = '<span style="background: rgba(234, 179, 8, 0.1); border-left: 3px solid #eab308; padding: 2px 6px; margin: 2px 0; border-radius: 2px; font-weight: 500; font-size: 13px; color: var(--text);">⭐️ Importante: </span>&nbsp;';
    } else if (type === 'question') {
      tagHTML = '<span style="background: rgba(59, 130, 246, 0.1); border-left: 3px solid #3b82f6; padding: 2px 6px; margin: 2px 0; border-radius: 2px; font-weight: 500; font-size: 13px; color: var(--text);">❓ Dúvida: </span>&nbsp;';
    }
    document.execCommand('insertHTML', false, tagHTML);
    handleInput();
  }, [editorRef, handleInput]);

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

  // Paste handler: intercepts CTRL+V before the browser, reads image from
  // clipboard and inserts it as a resizable and draggable wrapper in the editor.
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));

    if (!imageItem) {
      // No image — strip injected colors from pasted HTML text
      const html = e.clipboardData.getData('text/html');
      if (html) {
        e.preventDefault();
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        const walk = (el: Element) => {
          if (el instanceof HTMLElement) {
            el.style.removeProperty('color');
            el.style.removeProperty('background-color');
            el.style.removeProperty('background');
            if (el.getAttribute('style') === '') el.removeAttribute('style');
          }
          Array.from(el.children).forEach(walk);
        };
        Array.from(tmp.children).forEach(walk);
        document.execCommand('insertHTML', false, tmp.innerHTML);
        handleInput();
      }
      return;
    }

    e.preventDefault(); // Block the broken native image paste

    const file = imageItem.getAsFile();
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      if (!src) return;
      editorRef.current?.focus();
      
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
          <img src="${src}" alt="imagem colada" style="width: 100%; height: auto; display: block; border-radius: 4px; pointer-events: none;" />
          <div class="resize-handle top-left"></div>
          <div class="resize-handle top-right"></div>
          <div class="resize-handle bottom-left"></div>
          <div class="resize-handle bottom-right"></div>
        </div>
      `;
      document.execCommand('insertHTML', false, wrapperHTML);
      handleInput();
    };
    reader.readAsDataURL(file);
  }, [editorRef, handleInput]);

  // Remove inline styles injected by browsers
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const ALLOWED_BACKGROUNDS = [
      'rgb(254, 240, 138)', '#fef08a',
      'rgb(187, 247, 208)', '#bbf7d0',
      'rgb(191, 219, 254)', '#bfdbfe',
      'rgb(251, 207, 232)', '#fbcfe8',
      'rgb(253, 215, 170)', '#fed7aa',
      'rgb(233, 213, 255)', '#e9d5ff'
    ];

    // Only strip background colors injected by the browser (not user-set text colors or highlight colors).
    const stripInlineColors = (node: Node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      
      const bg = el.style.backgroundColor?.toLowerCase();
      const hasAllowedBg = ALLOWED_BACKGROUNDS.some(allowed => bg.includes(allowed));
      
      if (bg && !hasAllowedBg) {
        el.style.removeProperty('background-color');
        el.style.removeProperty('background');
      }
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

  // Draggable and Resizable images handler (OneNote style)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    let activeElement: HTMLElement | null = null;
    let isDragging = false;
    let isResizing = false;
    let resizeDir = '';
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;
    let startLeft = 0;
    let startTop = 0;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      
      // 1. Check if we clicked a resize handle
      if (target.classList.contains('resize-handle')) {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        activeElement = target.closest('.resizable-image-wrapper');
        if (!activeElement) return;
        
        if (target.classList.contains('bottom-right')) resizeDir = 'br';
        else if (target.classList.contains('bottom-left')) resizeDir = 'bl';
        else if (target.classList.contains('top-right')) resizeDir = 'tr';
        else if (target.classList.contains('top-left')) resizeDir = 'tl';
        
        startX = e.clientX;
        startY = e.clientY;
        startWidth = activeElement.offsetWidth;
        startHeight = activeElement.offsetHeight;
        startLeft = activeElement.offsetLeft;
        startTop = activeElement.offsetTop;
        
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
        
        editor.querySelectorAll('.resizable-image-wrapper').forEach(el => el.classList.remove('selected'));
        activeElement.classList.add('selected');
        return;
      }
      
      // 2. Check if we clicked the image wrapper itself
      const wrapper = target.closest('.resizable-image-wrapper') as HTMLElement;
      if (wrapper) {
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        activeElement = wrapper;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = activeElement.offsetLeft;
        startTop = activeElement.offsetTop;
        
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
        
        editor.querySelectorAll('.resizable-image-wrapper').forEach(el => el.classList.remove('selected'));
        activeElement.classList.add('selected');
        return;
      }
      
      // Clicked elsewhere - remove selection outline
      editor.querySelectorAll('.resizable-image-wrapper').forEach(el => el.classList.remove('selected'));
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!activeElement) return;
      
      if (isDragging) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        activeElement.style.left = `${startLeft + dx}px`;
        activeElement.style.top = `${startTop + dy}px`;
      } else if (isResizing) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;
        
        if (resizeDir === 'br') {
          newWidth = startWidth + dx;
          newHeight = startHeight + dy;
        } else if (resizeDir === 'bl') {
          newWidth = startWidth - dx;
          newHeight = startHeight + dy;
          newLeft = startLeft + dx;
        } else if (resizeDir === 'tr') {
          newWidth = startWidth + dx;
          newHeight = startHeight - dy;
          newTop = startTop + dy;
        } else if (resizeDir === 'tl') {
          newWidth = startWidth - dx;
          newHeight = startHeight - dy;
          newLeft = startLeft + dx;
          newTop = startTop + dy;
        }
        
        if (newWidth > 50) {
          activeElement.style.width = `${newWidth}px`;
          activeElement.style.left = `${newLeft}px`;
        }
        if (newHeight > 50) {
          activeElement.style.height = `${newHeight}px`;
          activeElement.style.top = `${newTop}px`;
        }
      }
    };

    const handlePointerUp = () => {
      isDragging = false;
      isResizing = false;
      activeElement = null;
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      handleInput(); // Auto-save updated position/size!
    };

    editor.addEventListener('pointerdown', handlePointerDown);
    return () => {
      editor.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [editorRef, handleInput]);

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
          <button className="fmt-btn" onClick={() => fmt('bold')} title="Negrito" onMouseDown={(e) => e.preventDefault()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12h9a4 4 0 0 0 0-8H6v8Z"/><path d="M6 20h10a4 4 0 0 0 0-8H6v8Z"/></svg>
          </button>
          <button className="fmt-btn" onClick={() => fmt('italic')} title="Itálico" onMouseDown={(e) => e.preventDefault()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
          </button>
          <button className="fmt-btn" onClick={() => fmt('underline')} title="Sublinhado" onMouseDown={(e) => e.preventDefault()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
          </button>
          <button className="fmt-btn" onClick={() => fmt('strikeThrough')} title="Tachado" onMouseDown={(e) => e.preventDefault()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><path d="M16 6A5 5 0 0 0 8 9c0 2.2 1.8 3 3.5 3.5"/></svg>
          </button>

          {/* Color picker */}
          <div className="color-picker-wrapper" ref={colorPickerRef}>
            <button
              className="fmt-btn color-btn"
              title="Cor do texto"
              onClick={() => setColorPickerOpen(o => !o)}
              onMouseDown={(e) => e.preventDefault()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h16"/>
                <text x="5" y="16" fontSize="14" fontWeight="bold" stroke="none" fill="currentColor" fontFamily="sans-serif">A</text>
              </svg>
            </button>
            {colorPickerOpen && (
              <div className="color-picker-popup">
                <div className="color-picker-grid">
                  {COLOR_PALETTE.map(c => (
                    <button
                      key={c}
                      className="color-swatch"
                      style={{ background: c }}
                      title={c === '#ffffff' ? 'Branco' : c}
                      onClick={() => applyColor(c)}
                      onMouseDown={(e) => e.preventDefault()}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Highlighter picker */}
          <div className="color-picker-wrapper" ref={highlighterRef}>
            <button
              className="fmt-btn color-btn"
              title="Cor de realce do texto"
              onClick={() => setHighlighterOpen(o => !o)}
              onMouseDown={(e) => e.preventDefault()}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 11-6 6v3h3l6-6"/>
                <path d="m18 12 3 3-9 9M19 9l3-3-3-3-3 3"/>
              </svg>
            </button>
            {highlighterOpen && (
              <div className="color-picker-popup">
                <div className="color-picker-grid" style={{ gridTemplateColumns: 'repeat(4, 20px)' }}>
                  {HIGHLIGHT_PALETTE.map(c => (
                    <button
                      key={c}
                      className="color-swatch"
                      style={{ 
                        background: c === 'transparent' ? 'none' : c,
                        position: 'relative',
                        border: c === 'transparent' ? '1px dashed var(--muted)' : '1px solid var(--border)' 
                      }}
                      title={c === 'transparent' ? 'Sem realce' : c}
                      onClick={() => applyHighlight(c)}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {c === 'transparent' && (
                        <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', textAlign: 'center', lineHeight: '18px' }}>❌</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Clear formatting */}
          <button className="fmt-btn" onClick={() => fmt('removeFormat')} title="Limpar Formatação" onMouseDown={(e) => e.preventDefault()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7V4h16v3M9 20h6M12 4v16M5 20h14"/>
              <line x1="4" y1="18" x2="20" y2="6"/>
            </svg>
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

          {/* Custom Font Size Picker */}
          <div className="color-picker-wrapper" ref={fontSizeRef}>
            <button
              className="fmt-btn"
              title="Tamanho do texto"
              onClick={() => setFontSizeOpen(o => !o)}
              onMouseDown={(e) => e.preventDefault()}
              style={{ width: 'auto', padding: '0 8px', gap: '4px', display: 'flex', alignItems: 'center', height: '28px', fontSize: '12px' }}
            >
              <span>Tamanho</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            {fontSizeOpen && (
              <div className="color-picker-popup" style={{ minWidth: '80px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {['75%', '90%', '100%', '110%', '125%', '150%', '175%', '200%'].map(size => (
                    <button
                      key={size}
                      className="font-size-option"
                      onClick={() => { applyFontSize(size); setFontSizeOpen(false); }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Subscript / Superscript */}
          <button className="fmt-btn" onClick={() => fmt('subscript')} title="Subscrito" onMouseDown={(e) => e.preventDefault()}>
            <span style={{ fontSize: '10px', fontWeight: 'bold' }}>X<sub>2</sub></span>
          </button>
          <button className="fmt-btn" onClick={() => fmt('superscript')} title="Sobrescrito" onMouseDown={(e) => e.preventDefault()}>
            <span style={{ fontSize: '10px', fontWeight: 'bold' }}>X<sup>2</sup></span>
          </button>
        </div>

        <span className="fmt-sep" />

        <div className="editor-toolbar-group">
          <button className="fmt-btn" onClick={() => fmt('insertUnorderedList')} title="Lista com Marcadores" onMouseDown={(e) => e.preventDefault()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
          <button className="fmt-btn" onClick={() => fmt('insertOrderedList')} title="Lista Numerada" onMouseDown={(e) => e.preventDefault()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
          </button>
          <button className="fmt-btn" onClick={insertCheckbox} title="Caixa de Seleção" onMouseDown={(e) => e.preventDefault()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="m9 12 2 2 4-4"/></svg>
          </button>
          
          {/* Table */}
          <button className="fmt-btn" onClick={insertTable} title="Inserir Tabela" onMouseDown={(e) => e.preventDefault()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3h18v18H3z"/>
              <path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
            </svg>
          </button>
        </div>

        <span className="fmt-sep" />

        <div className="editor-toolbar-group">
          <button className="fmt-btn" onClick={insertCode} title="Bloco de Código" onMouseDown={(e) => e.preventDefault()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </button>
          <button className="fmt-btn" onClick={insertQuote} title="Citação" onMouseDown={(e) => e.preventDefault()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3a5 5 0 0 0-4 2 5 5 0 0 0-4-2H4v13h4a5 5 0 0 1 4 2 5 5 0 0 1 4-2h4V3h-4Z"/><path d="M12 3v15"/></svg>
          </button>
          <button className="fmt-btn" onClick={onMathOpen} title="Fórmula Matemática" onMouseDown={(e) => e.preventDefault()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 4H6L12 12L6 20H18"/></svg>
          </button>

          {/* OneNote style Tags */}
          <button className="fmt-btn" onClick={() => insertTag('star')} title="Marcar como Importante" onMouseDown={(e) => e.preventDefault()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
          <button className="fmt-btn" onClick={() => insertTag('question')} title="Marcar como Dúvida" onMouseDown={(e) => e.preventDefault()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
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
          onPaste={handlePaste}
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

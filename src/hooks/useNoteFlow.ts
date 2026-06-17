'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { AppData, Notebook, Section, Page, ContextTarget } from '@/types';
import { getSampleData } from '@/lib/data';

const STORAGE_KEY = 'noteflow_v2';

function loadData(): AppData {
  if (typeof window === 'undefined') return getSampleData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return getSampleData();
}

function saveData(data: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function useNoteFlow() {
  const [data, setData] = useState<AppData>(getSampleData);
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const loaded = loadData();
    setData(loaded);
  }, []);

  // Helpers
  const getNb = useCallback((id: string) => data.notebooks.find(n => n.id === id), [data]);
  const getActivNb = useCallback(() => data.activeNb ? data.notebooks.find(n => n.id === data.activeNb) : undefined, [data]);
  const getActivSec = useCallback(() => {
    const nb = getActivNb();
    return nb?.sections.find(s => s.id === data.activeSec);
  }, [data, getActivNb]);
  const getActivPage = useCallback(() => {
    const sec = getActivSec();
    return sec?.pages.find(p => p.id === data.activePage);
  }, [data, getActivSec]);

  const updateData = useCallback((updater: (prev: AppData) => AppData) => {
    setData(prev => {
      const next = updater(prev);
      saveData(next);
      return next;
    });
  }, []);

  // Remove estilos inline de cor do HTML antes de salvar
  // Evita que cores hardcoded do browser sobrescrevam o modo escuro
  const stripColorStyles = useCallback((html: string): string => {
    if (typeof document === 'undefined') return html;
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
    return tmp.innerHTML;
  }, []);

  // Auto-save current editor content into state.
  // Accepts an optional override for which page/section/notebook to save into,
  // so navigation and flush can be done atomically in a single setData call.
  const flushEditor = useCallback((overridePageId?: string, overrideSecId?: string, overrideNbId?: string) => {
    const title = titleRef.current?.value ?? '';
    const rawContent = editorRef.current?.innerHTML ?? '';
    const content = stripColorStyles(rawContent);
    const date = new Date().toLocaleDateString('pt-BR');
    setData(prev => {
      const targetNbId = overrideNbId ?? prev.activeNb;
      const targetSecId = overrideSecId ?? prev.activeSec;
      const targetPageId = overridePageId ?? prev.activePage;
      const nb = prev.notebooks.find(n => n.id === targetNbId);
      const sec = nb?.sections.find(s => s.id === targetSecId);
      const pg = sec?.pages.find(p => p.id === targetPageId);
      if (pg && pg.title === title && pg.content === content) {
        return prev;
      }
      const next = JSON.parse(JSON.stringify(prev)) as AppData;
      const nextNb = next.notebooks.find(n => n.id === targetNbId);
      const nextSec = nextNb?.sections.find(s => s.id === targetSecId);
      const nextPg = nextSec?.pages.find(p => p.id === targetPageId);
      if (nextPg) { nextPg.title = title; nextPg.content = content; nextPg.date = date; }
      saveData(next);
      return next;
    });
  }, []);

  // Navigation: each function flushes the current page atomically THEN navigates.
  // We use a single setData call to avoid race conditions where the title of the
  // old page gets saved into the new page (because activePage was already changed).
  const selectNotebook = useCallback((nbId: string) => {
    setData(prev => {
      // 1. Capture current editor values (DOM reads must happen outside setData)
      const title = titleRef.current?.value ?? '';
      const rawContent = editorRef.current?.innerHTML ?? '';
      const content = stripColorStyles(rawContent);
      const date = new Date().toLocaleDateString('pt-BR');

      const next = JSON.parse(JSON.stringify(prev)) as AppData;

      // 2. Flush old page
      const oldNb = next.notebooks.find(n => n.id === next.activeNb);
      const oldSec = oldNb?.sections.find(s => s.id === next.activeSec);
      const oldPg = oldSec?.pages.find(p => p.id === next.activePage);
      if (oldPg) { oldPg.title = title; oldPg.content = content; oldPg.date = date; }

      // 3. Navigate
      const nb = next.notebooks.find(n => n.id === nbId);
      const firstSec = nb?.sections[0];
      const firstPage = firstSec?.pages[0];
      next.activeNb = nbId;
      next.activeSec = firstSec?.id ?? null;
      next.activePage = firstPage?.id ?? null;

      saveData(next);
      return next;
    });
  }, [stripColorStyles]);

  const selectSection = useCallback((secId: string) => {
    setData(prev => {
      const title = titleRef.current?.value ?? '';
      const rawContent = editorRef.current?.innerHTML ?? '';
      const content = stripColorStyles(rawContent);
      const date = new Date().toLocaleDateString('pt-BR');

      const next = JSON.parse(JSON.stringify(prev)) as AppData;

      // Flush old page
      const oldNb = next.notebooks.find(n => n.id === next.activeNb);
      const oldSec = oldNb?.sections.find(s => s.id === next.activeSec);
      const oldPg = oldSec?.pages.find(p => p.id === next.activePage);
      if (oldPg) { oldPg.title = title; oldPg.content = content; oldPg.date = date; }

      // Navigate
      const nb = next.notebooks.find(n => n.id === next.activeNb);
      const sec = nb?.sections.find(s => s.id === secId);
      const firstPage = sec?.pages[0];
      next.activeSec = secId;
      next.activePage = firstPage?.id ?? null;

      saveData(next);
      return next;
    });
  }, [stripColorStyles]);

  const selectPage = useCallback((pgId: string) => {
    setData(prev => {
      const title = titleRef.current?.value ?? '';
      const rawContent = editorRef.current?.innerHTML ?? '';
      const content = stripColorStyles(rawContent);
      const date = new Date().toLocaleDateString('pt-BR');

      const next = JSON.parse(JSON.stringify(prev)) as AppData;

      // Flush old page first (save into the OLD activePage, not the new one)
      const oldNb = next.notebooks.find(n => n.id === next.activeNb);
      const oldSec = oldNb?.sections.find(s => s.id === next.activeSec);
      const oldPg = oldSec?.pages.find(p => p.id === next.activePage);
      if (oldPg) { oldPg.title = title; oldPg.content = content; oldPg.date = date; }

      // Then navigate to the new page
      next.activePage = pgId;

      saveData(next);
      return next;
    });
  }, [stripColorStyles]);

  // CRUD Notebooks
  const createNotebook = useCallback((name: string, color: string) => {
    const nb: Notebook = { id: 'nb' + Date.now(), name, color, sections: [] };
    updateData(prev => ({
      ...prev,
      notebooks: [...prev.notebooks, nb],
      activeNb: nb.id,
      activeSec: null,
      activePage: null,
    }));
  }, [updateData]);

  const renameItem = useCallback((target: ContextTarget, newName: string) => {
    flushEditor();
    updateData(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as AppData;
      if (target.type === 'nb') {
        const nb = next.notebooks.find(n => n.id === target.id);
        if (nb) nb.name = newName;
      } else if (target.type === 'sec') {
        const nb = next.notebooks.find(n => n.id === next.activeNb);
        const sec = nb?.sections.find(s => s.id === target.id);
        if (sec) sec.name = newName;
      } else {
        const nb = next.notebooks.find(n => n.id === next.activeNb);
        const sec = nb?.sections.find(s => s.id === next.activeSec);
        const pg = sec?.pages.find(p => p.id === target.id);
        if (pg) pg.title = newName;
      }
      return next;
    });
  }, [flushEditor, updateData]);

  const deleteItem = useCallback((target: ContextTarget) => {
    flushEditor();
    updateData(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as AppData;
      if (target.type === 'nb') {
        next.notebooks = next.notebooks.filter(n => n.id !== target.id);
        if (next.activeNb === target.id) {
          next.activeNb = next.notebooks[0]?.id ?? null;
          next.activeSec = next.notebooks[0]?.sections[0]?.id ?? null;
          next.activePage = next.notebooks[0]?.sections[0]?.pages[0]?.id ?? null;
        }
      } else if (target.type === 'sec') {
        const nb = next.notebooks.find(n => n.id === next.activeNb);
        if (nb) {
          nb.sections = nb.sections.filter(s => s.id !== target.id);
          if (next.activeSec === target.id) {
            next.activeSec = nb.sections[0]?.id ?? null;
            next.activePage = nb.sections[0]?.pages[0]?.id ?? null;
          }
        }
      } else {
        const nb = next.notebooks.find(n => n.id === next.activeNb);
        const sec = nb?.sections.find(s => s.id === next.activeSec);
        if (sec) {
          sec.pages = sec.pages.filter(p => p.id !== target.id);
          if (next.activePage === target.id) next.activePage = sec.pages[0]?.id ?? null;
        }
      }
      return next;
    });
  }, [flushEditor, updateData]);

  // CRUD Sections
  const createSection = useCallback((name: string, color: string) => {
    flushEditor();
    const sec: Section = { id: 's' + Date.now(), name, color, pages: [] };
    updateData(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as AppData;
      const nb = next.notebooks.find(n => n.id === next.activeNb);
      if (nb) nb.sections.push(sec);
      next.activeSec = sec.id;
      next.activePage = null;
      return next;
    });
  }, [flushEditor, updateData]);

  // CRUD Pages
  const createPage = useCallback(() => {
    flushEditor();
    const pg: Page = { id: 'p' + Date.now(), title: 'Nova Página', content: '', date: new Date().toLocaleDateString('pt-BR') };
    updateData(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as AppData;
      const nb = next.notebooks.find(n => n.id === next.activeNb);
      const sec = nb?.sections.find(s => s.id === next.activeSec);
      if (sec) sec.pages.push(pg);
      next.activePage = pg.id;
      return next;
    });
    setTimeout(() => titleRef.current?.focus(), 50);
  }, [flushEditor, updateData]);

  // Search
  const search = useCallback((query: string) => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const results: { nb: Notebook; sec: Section; pg: Page; snippet: string }[] = [];
    data.notebooks.forEach(nb => {
      nb.sections.forEach(sec => {
        sec.pages.forEach(pg => {
          const haystack = (pg.title + ' ' + pg.content.replace(/<[^>]+>/g, ' ')).toLowerCase();
          if (haystack.includes(q)) {
            const idx = haystack.indexOf(q);
            const snippet = haystack.slice(Math.max(0, idx - 20), idx + 60);
            results.push({ nb, sec, pg, snippet });
          }
        });
      });
    });
    return results.slice(0, 8);
  }, [data]);

  return {
    data,
    editorRef,
    titleRef,
    getActivNb,
    getActivSec,
    getActivPage,
    getNb,
    flushEditor,
    selectNotebook,
    selectSection,
    selectPage,
    createNotebook,
    createSection,
    createPage,
    renameItem,
    deleteItem,
    search,
    updateData,
  };
}

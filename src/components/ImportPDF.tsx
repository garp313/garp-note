'use client';

import { useRef, useState } from 'react';

interface ImportPDFProps {
  onImport: (notebook: ImportedNotebook) => void;
  onClose: () => void;
}

export interface ImportedNotebook {
  notebookName: string;
  notebookColor: string;
  sections: {
    name: string;
    color: string;
    pages: { title: string; content: string }[];
  }[];
}

type Step = 'idle' | 'processing' | 'done' | 'error';

const COLORS = ['#4a7c59', '#c4622a', '#5c7fa8', '#8c5ca8', '#c45c7a', '#7a8c3a'];

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Falha ao carregar o parser de PDF.'));
    document.head.appendChild(s);
  });
}

interface TextItem {
  str: string;
  transform: number[];
  height: number;
  fontName: string;
}

interface StructuredPage {
  lines: { text: string; isTitle: boolean; isBullet: boolean; fontSize: number }[];
}

async function extractStructuredPages(file: File): Promise<{ pages: StructuredPage[]; title: string }> {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  const pdfjsLib = (window as any).pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: StructuredPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items: TextItem[] = content.items as TextItem[];
    pages.push(parsePageItems(items));
  }

  const title = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
  return { pages, title };
}

function parsePageItems(items: TextItem[]): StructuredPage {
  if (!items.length) return { lines: [] };

  const heights = items.map(i => i.height).filter(h => h > 0);
  const avgHeight = heights.reduce((a, b) => a + b, 0) / (heights.length || 1);

  const lineMap = new Map<number, TextItem[]>();
  items.forEach(item => {
    const y = Math.round(item.transform[5]);
    if (!lineMap.has(y)) lineMap.set(y, []);
    lineMap.get(y)!.push(item);
  });

  const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
  const lines: StructuredPage['lines'] = [];

  sortedYs.forEach(y => {
    const lineItems = lineMap.get(y)!.sort((a, b) => a.transform[4] - b.transform[4]);
    const text = lineItems.map(i => i.str).join(' ').trim();
    if (!text) return;

    const fontSize = Math.max(...lineItems.map(i => i.height));
    const isTitle = fontSize > avgHeight * 1.2 || (text.length < 80 && fontSize >= avgHeight * 1.1);
    const isBullet = /^[•\-\*●▪►]\s/.test(text) || /^\d+\.\s/.test(text);

    lines.push({ text, isTitle, isBullet, fontSize });
  });

  return { lines };
}

function pagesToHTML(page: StructuredPage): string {
  let html = '';
  let inList = false;

  page.lines.forEach(line => {
    if (!line.text.trim()) return;

    if (line.isTitle && !line.isBullet) {
      if (inList) { html += '</ul>'; inList = false; }
      const tag = line.fontSize > 16 ? 'h2' : 'h3';
      html += `<${tag}>${line.text}</${tag}>`;
    } else if (line.isBullet) {
      if (!inList) { html += '<ul>'; inList = true; }
      const clean = line.text.replace(/^[•\-\*●▪►]\s+/, '').replace(/^\d+\.\s+/, '');
      html += `<li>${clean}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p>${line.text}</p>`;
    }
  });

  if (inList) html += '</ul>';
  return html;
}

function buildNotebook(pages: StructuredPage[], title: string): ImportedNotebook {
  const sections: { name: string; color: string; pages: { title: string; content: string }[] }[] = [];
  let currentSection: typeof sections[0] | null = null;

  pages.forEach((pg, idx) => {
    const firstTitle = pg.lines.find(l => l.isTitle)?.text || `Página ${idx + 1}`;
    const html = pagesToHTML(pg);
    if (!html.trim()) return;

    const isNewSection = idx % 4 === 0;
    if (isNewSection || !currentSection) {
      const secNum = sections.length + 1;
      currentSection = {
        name: firstTitle.slice(0, 40) || `Parte ${secNum}`,
        color: COLORS[sections.length % COLORS.length],
        pages: [],
      };
      sections.push(currentSection);
    }

    currentSection.pages.push({ title: firstTitle.slice(0, 60), content: html });
  });

  if (!sections.length) {
    sections.push({ name: 'Conteúdo', color: COLORS[0], pages: [{ title: title, content: '<p>PDF sem conteúdo extraível.</p>' }] });
  }

  return { notebookName: title, notebookColor: COLORS[0], sections };
}

export function ImportPDF({ onImport, onClose }: ImportPDFProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('idle');
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const processFile = async (file: File) => {
    if (file.type !== 'application/pdf') { setError('Selecione um arquivo PDF válido.'); return; }
    if (file.size > 20 * 1024 * 1024) { setError('O arquivo excede o limite de 20MB.'); return; }

    setFileName(file.name);
    setError('');
    setStep('processing');
    setProgress('Carregando leitor de PDF...');

    try {
      setProgress('Extraindo e estruturando conteúdo...');
      const { pages, title } = await extractStructuredPages(file);

      if (pages.every(p => p.lines.length === 0)) {
        throw new Error('PDF sem texto extraível. Pode ser um documento digitalizado (imagem).');
      }

      setProgress('Montando caderno e seções...');
      const notebook = buildNotebook(pages, title);

      setStep('done');
      setProgress('Caderno importado com sucesso!');
      setTimeout(() => { onImport(notebook); onClose(); }, 700);
    } catch (err: any) {
      setStep('error');
      setError(err.message || 'Erro inesperado ao processar o PDF.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const isLoading = step === 'processing';

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !isLoading) onClose(); }}>
      <div className="modal" style={{ maxWidth: '440px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <h3 style={{ margin: 0 }}>Importar PDF como Caderno</h3>
        </div>

        {step === 'idle' || step === 'error' ? (
          <>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px', lineHeight: '1.6' }}>
              Nosso leitor inteligente analisa títulos, listas e capítulos do PDF para estruturar automaticamente um caderno completo com páginas organizadas.
            </p>
            <div
              className={`pdf-dropzone${dragOver ? ' drag-over' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div style={{ color: 'var(--accent)', marginBottom: '10px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', color: 'var(--text)' }}>
                Arraste seu PDF ou clique para buscar
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                Tamanho máximo 20MB · Estruturação automática
              </div>
            </div>
            <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }} />
            
            {error && (
              <div className="import-error">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{error}</span>
              </div>
            )}
            
            <div className="modal-actions">
              <button className="btn-sec" onClick={onClose}>Cancelar</button>
            </div>
          </>
        ) : (
          <div className="import-progress">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              {step === 'done' ? (
                <div style={{ color: '#10b981' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
              ) : (
                <div style={{ color: 'var(--accent)' }} className="spinner">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                </div>
              )}
            </div>
            <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text)', marginBottom: '4px' }}>{fileName}</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>{progress}</div>
            {isLoading && <div className="progress-bar"><div className="progress-fill slow" /></div>}
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '14px' }}>
              {step === 'processing' && 'Analisando e construindo editor rico...'}
              {step === 'done' && 'Pronto! Redirecionando...'}
            </div>
          </div>
        )}
      </div>
      <style>{`
        .pdf-dropzone {
          border: 2px dashed var(--border);
          border-radius: var(--r);
          padding: 32px 20px;
          text-align: center;
          cursor: pointer;
          transition: var(--transition);
          margin-bottom: 16px;
          background: rgba(0, 0, 0, 0.01);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .pdf-dropzone:hover, .pdf-dropzone.drag-over {
          border-color: var(--accent);
          background: var(--accent-light);
        }
        .import-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #ef4444;
          border-radius: var(--r-sm);
          padding: 10px 14px;
          font-size: 13px;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          line-height: 1.4;
        }
        .import-progress {
          text-align: center;
          padding: 16px 0;
        }
        .progress-bar {
          height: 5px;
          background: var(--border);
          border-radius: 10px;
          overflow: hidden;
          width: 80%;
          margin: 0 auto;
        }
        .progress-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 10px;
        }
        .progress-fill.slow {
          animation: progressSlow 2s ease-in-out infinite alternate;
        }
        .animate-spin {
          animation: spin 1.5s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes progressSlow {
          from { width: 10%; margin-left: 0; }
          to { width: 45%; margin-left: 55%; }
        }
      `}</style>
    </div>
  );
}

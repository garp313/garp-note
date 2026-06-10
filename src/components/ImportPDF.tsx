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
    s.onerror = () => reject(new Error('Falha ao carregar PDF.js'));
    document.head.appendChild(s);
  });
}

interface TextItem {
  str: string;
  transform: number[];
  height: number;
  fontName: string;
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

interface StructuredPage {
  lines: { text: string; isTitle: boolean; isBullet: boolean; fontSize: number }[];
}

function parsePageItems(items: TextItem[]): StructuredPage {
  if (!items.length) return { lines: [] };

  // Calcula tamanho médio de fonte para detectar títulos
  const heights = items.map(i => i.height).filter(h => h > 0);
  const avgHeight = heights.reduce((a, b) => a + b, 0) / (heights.length || 1);

  // Agrupa itens em linhas por posição Y
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
  // Detecta seções por títulos grandes entre páginas
  const sections: { name: string; color: string; pages: { title: string; content: string }[] }[] = [];
  let currentSection: typeof sections[0] | null = null;

  // Cada página do PDF vira uma página no caderno
  pages.forEach((pg, idx) => {
    // Primeiro título grande da página vira nome da página
    const firstTitle = pg.lines.find(l => l.isTitle)?.text || `Página ${idx + 1}`;
    const html = pagesToHTML(pg);
    if (!html.trim()) return;

    // A cada 4 páginas (ou quando há título muito grande) cria nova seção
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
    if (file.type !== 'application/pdf') { setError('Selecione um arquivo PDF.'); return; }
    if (file.size > 20 * 1024 * 1024) { setError('PDF muito grande. Máximo 20MB.'); return; }

    setFileName(file.name);
    setError('');
    setStep('processing');
    setProgress('Carregando leitor de PDF...');

    try {
      setProgress('Extraindo e estruturando conteúdo...');
      const { pages, title } = await extractStructuredPages(file);

      if (pages.every(p => p.lines.length === 0)) {
        throw new Error('PDF sem texto extraível. Pode ser um PDF escaneado (imagem).');
      }

      setProgress('Montando caderno...');
      const notebook = buildNotebook(pages, title);

      setStep('done');
      setProgress('Caderno criado!');
      setTimeout(() => { onImport(notebook); onClose(); }, 700);
    } catch (err: any) {
      setStep('error');
      setError(err.message || 'Erro ao processar PDF.');
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
      <div className="modal" style={{ minWidth: 400 }}>
        <h3>📥 Importar PDF como Caderno</h3>

        {step === 'idle' || step === 'error' ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
              Importe um PDF e ele será convertido automaticamente em caderno com seções e páginas formatadas.
            </p>
            <div
              className={`pdf-dropzone${dragOver ? ' drag-over' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Clique ou arraste o PDF aqui</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Máximo 20MB · Detecta títulos e listas automaticamente</div>
            </div>
            <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }} />
            {error && <div className="import-error">{error}</div>}
            <div className="modal-actions">
              <button className="btn-sec" onClick={onClose}>Cancelar</button>
            </div>
          </>
        ) : (
          <div className="import-progress">
            <div style={{ fontSize: 48, marginBottom: 12 }}>{step === 'done' ? '✅' : '⏳'}</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{fileName}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>{progress}</div>
            {isLoading && <div className="progress-bar"><div className="progress-fill slow" /></div>}
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
              {step === 'processing' && 'Detectando títulos, listas e parágrafos...'}
              {step === 'done' && 'Redirecionando...'}
            </div>
          </div>
        )}
      </div>
      <style>{`
        .pdf-dropzone{border:2px dashed var(--border);border-radius:var(--r);padding:28px 20px;text-align:center;cursor:pointer;transition:.2s;margin-bottom:12px;background:var(--tag)}
        .pdf-dropzone:hover,.pdf-dropzone.drag-over{border-color:var(--accent);background:rgba(74,124,89,.07)}
        .import-error{background:rgba(192,57,43,.1);border:1px solid rgba(192,57,43,.3);color:#c0392b;border-radius:var(--r);padding:8px 12px;font-size:13px;margin-bottom:10px}
        .import-progress{text-align:center;padding:16px 0}
        .progress-bar{height:4px;background:var(--border);border-radius:2px;overflow:hidden;width:100%}
        .progress-fill{height:100%;background:var(--accent);border-radius:2px}
        .progress-fill.slow{animation:progressSlow 2s ease-in-out infinite alternate}
        @keyframes progressSlow{from{width:20%;margin-left:0}to{width:50%;margin-left:40%}}
      `}</style>
    </div>
  );
}

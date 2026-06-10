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
    pages: {
      title: string;
      content: string;
    }[];
  }[];
}

type Step = 'idle' | 'processing' | 'done' | 'error';

const COLORS = ['#4a7c59', '#c4622a', '#5c7fa8', '#8c5ca8', '#c45c7a', '#7a8c3a'];

// Carrega PDF.js dinamicamente
async function loadPdfJs() {
  const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js' as any);
  (window as any).pdfjsLib = pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  return pdfjsLib;
}

async function extractTextFromPDF(file: File): Promise<{ pages: string[]; title: string }> {
  const arrayBuffer = await file.arrayBuffer();

  // Usa PDF.js via CDN
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  await new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  const pdfjsLib = (window as any).pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => item.str).join(' ');
    pages.push(text.trim());
  }

  // Título: nome do arquivo sem extensão
  const title = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
  return { pages, title };
}

function structureNotebook(pages: string[], title: string): ImportedNotebook {
  // Agrupa páginas em seções de ~4 páginas cada
  const PAGES_PER_SECTION = 4;
  const sections = [];
  const totalPages = pages.length;

  for (let i = 0; i < totalPages; i += PAGES_PER_SECTION) {
    const sectionPages = pages.slice(i, i + PAGES_PER_SECTION);
    const secNum = Math.floor(i / PAGES_PER_SECTION) + 1;

    const builtPages = sectionPages.map((text, pi) => {
      const pageNum = i + pi + 1;
      // Tenta detectar título na primeira linha
      const lines = text.split(/\s{3,}|\n/).filter(l => l.trim().length > 0);
      const detectedTitle = lines[0]?.slice(0, 60) || `Página ${pageNum}`;
      const body = lines.slice(1).join(' ') || text;

      // Divide em parágrafos
      const chunks = body.match(/.{1,400}(\s|$)/g) || [body];
      const htmlContent = chunks
        .filter(c => c.trim().length > 10)
        .map(c => `<p>${c.trim()}</p>`)
        .join('');

      return {
        title: detectedTitle.trim() || `Página ${pageNum}`,
        content: htmlContent || `<p>${text.slice(0, 500)}</p>`,
      };
    });

    sections.push({
      name: `Parte ${secNum}`,
      color: COLORS[(secNum - 1) % COLORS.length],
      pages: builtPages,
    });
  }

  // Se só tem 1 seção, renomeia
  if (sections.length === 1) sections[0].name = 'Conteúdo';

  return {
    notebookName: title,
    notebookColor: COLORS[0],
    sections,
  };
}

export function ImportPDF({ onImport, onClose }: ImportPDFProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('idle');
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const processFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Por favor, selecione um arquivo PDF.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('PDF muito grande. Máximo 20MB.');
      return;
    }

    setFileName(file.name);
    setError('');
    setStep('processing');
    setProgress('Carregando PDF.js...');

    try {
      setProgress('Extraindo texto do PDF...');
      const { pages, title } = await extractTextFromPDF(file);

      if (pages.every(p => p.trim().length === 0)) {
        throw new Error('PDF sem texto extraível. Pode ser um PDF escaneado (imagem).');
      }

      setProgress('Estruturando caderno...');
      const notebook = structureNotebook(pages, title);

      setStep('done');
      setProgress('Caderno criado!');
      setTimeout(() => {
        onImport(notebook);
        onClose();
      }, 700);
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
              Importe um PDF e ele será convertido automaticamente em caderno com seções e páginas.
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
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Máximo 20MB · Funciona offline</div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }}
            />

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
            {isLoading && (
              <div className="progress-bar">
                <div className="progress-fill slow" />
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
              {step === 'processing' && 'Processando localmente, sem internet necessária...'}
              {step === 'done' && 'Redirecionando...'}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .pdf-dropzone {
          border: 2px dashed var(--border);
          border-radius: var(--r);
          padding: 28px 20px;
          text-align: center;
          cursor: pointer;
          transition: .2s;
          margin-bottom: 12px;
          background: var(--tag);
        }
        .pdf-dropzone:hover, .pdf-dropzone.drag-over {
          border-color: var(--accent);
          background: rgba(74,124,89,.07);
        }
        .import-error {
          background: rgba(192,57,43,.1);
          border: 1px solid rgba(192,57,43,.3);
          color: #c0392b;
          border-radius: var(--r);
          padding: 8px 12px;
          font-size: 13px;
          margin-bottom: 10px;
        }
        .import-progress { text-align: center; padding: 16px 0; }
        .progress-bar { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; width: 100%; }
        .progress-fill { height: 100%; background: var(--accent); border-radius: 2px; }
        .progress-fill.slow { animation: progressSlow 2s ease-in-out infinite alternate; }
        @keyframes progressSlow {
          from { width: 20%; margin-left: 0; }
          to { width: 50%; margin-left: 40%; }
        }
      `}</style>
    </div>
  );
}

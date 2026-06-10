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

type Step = 'idle' | 'reading' | 'processing' | 'done' | 'error';

export function ImportPDF({ onImport, onClose }: ImportPDFProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('idle');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
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
    setStep('reading');
    setProgress('Lendo o arquivo PDF...');

    // Convert to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    setStep('processing');
    setProgress('Analisando conteúdo com IA...');

    try {
      const res = await fetch('/api/import-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64, fileName: file.name }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Erro desconhecido');
      }

      setStep('done');
      setProgress('Caderno criado com sucesso!');
      setTimeout(() => {
        onImport(data.notebook);
        onClose();
      }, 800);
    } catch (err: any) {
      setStep('error');
      setError(err.message || 'Erro ao importar PDF. Tente novamente.');
    }
  };

  const handleFile = (file: File) => processFile(file);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const isLoading = step === 'reading' || step === 'processing';

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !isLoading) onClose(); }}>
      <div className="modal" style={{ minWidth: 400 }}>
        <h3>📥 Importar PDF como Caderno</h3>

        {step === 'idle' || step === 'error' ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
              A IA vai analisar seu PDF e criar automaticamente um caderno com seções e páginas organizadas.
            </p>

            {/* Drop zone */}
            <div
              className={`pdf-dropzone${dragOver ? ' drag-over' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Clique ou arraste o PDF aqui</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Máximo 20MB</div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
            />

            {error && (
              <div className="import-error">{error}</div>
            )}

            <div className="modal-actions">
              <button className="btn-sec" onClick={onClose}>Cancelar</button>
            </div>
          </>
        ) : (
          <div className="import-progress">
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              {step === 'done' ? '✅' : '⏳'}
            </div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{fileName}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>{progress}</div>

            {isLoading && (
              <div className="progress-bar">
                <div className={`progress-fill${step === 'processing' ? ' slow' : ''}`} />
              </div>
            )}

            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
              {step === 'reading' && 'Isso pode levar alguns segundos...'}
              {step === 'processing' && 'A IA está lendo e estruturando o conteúdo. Pode levar até 30 segundos...'}
              {step === 'done' && 'Redirecionando para o caderno...'}
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
        .import-progress {
          text-align: center;
          padding: 16px 0;
        }
        .progress-bar {
          height: 4px;
          background: var(--border);
          border-radius: 2px;
          overflow: hidden;
          width: 100%;
        }
        .progress-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 2px;
          animation: progressFast 1.2s ease-in-out infinite alternate;
        }
        .progress-fill.slow {
          animation: progressSlow 2.5s ease-in-out infinite alternate;
        }
        @keyframes progressFast {
          from { width: 10%; margin-left: 0; }
          to { width: 60%; margin-left: 30%; }
        }
        @keyframes progressSlow {
          from { width: 20%; margin-left: 0; }
          to { width: 50%; margin-left: 40%; }
        }
      `}</style>
    </div>
  );
}


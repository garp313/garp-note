import { Notebook, Section, Page } from '@/types';

// Gera HTML limpo para exportar em PDF
function buildHtml(title: string, pages: { title: string; content: string; date: string }[], dark: boolean): string {
  const pagesHtml = pages.map(p => `
    <div class="page-block">
      <h2 class="page-title">${p.title || 'Sem título'}</h2>
      <div class="page-date">${p.date}</div>
      <div class="page-content">${p.content || '<em>Página vazia</em>'}</div>
    </div>
  `).join('<div class="page-divider"></div>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Georgia', serif;
      font-size: 13px;
      line-height: 1.7;
      color: #1a1917;
      background: #fff;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .export-header {
      border-bottom: 2px solid #4a7c59;
      padding-bottom: 16px;
      margin-bottom: 32px;
    }
    .export-header h1 {
      font-size: 24px;
      color: #1a1917;
      font-weight: 700;
    }
    .export-header .meta {
      font-size: 11px;
      color: #888;
      margin-top: 4px;
    }
    .page-block { margin-bottom: 32px; }
    .page-title {
      font-size: 18px;
      font-weight: 600;
      color: #1a1917;
      margin-bottom: 4px;
    }
    .page-date {
      font-size: 10px;
      color: #aaa;
      margin-bottom: 12px;
    }
    .page-content {
      font-size: 13px;
      color: #2c2a24;
      line-height: 1.8;
    }
    .page-content ul, .page-content ol {
      padding-left: 20px;
      margin: 6px 0;
    }
    .page-content li { margin: 3px 0; }
    .page-content h1 { font-size: 20px; margin: 14px 0 6px; }
    .page-content h2 { font-size: 16px; margin: 12px 0 5px; }
    .page-content h3 { font-size: 14px; margin: 10px 0 4px; }
    .page-content blockquote {
      border-left: 3px solid #4a7c59;
      padding-left: 12px;
      color: #666;
      margin: 8px 0;
    }
    .page-content code, .page-content pre {
      background: #f4f1eb;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 12px;
    }
    .page-content img { max-width: 100%; border-radius: 4px; margin: 8px 0; }
    .page-divider {
      border: none;
      border-top: 1px dashed #ddd;
      margin: 28px 0;
    }
    .math-block {
      background: #f4f1eb;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: monospace;
      margin: 8px 0;
    }
  </style>
</head>
<body>
  <div class="export-header">
    <h1>${title}</h1>
    <div class="meta">Exportado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} • Garp Note</div>
  </div>
  ${pagesHtml}
</body>
</html>`;
}

function downloadHtmlAsPdf(html: string, filename: string) {
  // Usa iframe oculto + window.print() com CSS @media print
  // Isso garante qualidade perfeita sem depender de canvas
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '794px';
  iframe.style.height = '1123px';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  // Aguarda imagens/fontes carregarem
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }
  }, 600);
}

// Exporta uma única página
export function exportPage(page: Page) {
  const html = buildHtml(page.title || 'Página', [page], false);
  downloadHtmlAsPdf(html, `${page.title || 'pagina'}.pdf`);
}

// Exporta uma seção inteira (todas as páginas)
export function exportSection(section: Section) {
  const pages = section.pages.map(p => ({ title: p.title, content: p.content, date: p.date }));
  const html = buildHtml(`Seção: ${section.name}`, pages, false);
  downloadHtmlAsPdf(html, `${section.name}.pdf`);
}

// Exporta um caderno inteiro (todas as seções e páginas)
export function exportNotebook(notebook: Notebook) {
  const pages: { title: string; content: string; date: string }[] = [];
  notebook.sections.forEach(sec => {
    // Cabeçalho de seção como página especial
    pages.push({
      title: `📂 ${sec.name}`,
      content: '',
      date: '',
    });
    sec.pages.forEach(p => pages.push({ title: p.title, content: p.content, date: p.date }));
  });
  const html = buildHtml(`Caderno: ${notebook.name}`, pages, false);
  downloadHtmlAsPdf(html, `${notebook.name}.pdf`);
}

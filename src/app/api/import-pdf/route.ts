import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { pdfBase64, fileName } = await req.json();

    if (!pdfBase64) {
      return NextResponse.json({ error: 'PDF não fornecido' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 });
    }

    const prompt = `Você é um assistente que converte PDFs acadêmicos em cadernos de anotações estruturados.

Analise o PDF fornecido e extraia o conteúdo estruturado. Responda APENAS com um JSON válido, sem texto antes ou depois, sem blocos de código, sem markdown.

O JSON deve seguir exatamente esta estrutura:
{
  "notebookName": "Nome do caderno (título do documento ou disciplina)",
  "notebookColor": "#4a7c59",
  "sections": [
    {
      "name": "Nome da seção (capítulo, tema ou assunto principal)",
      "color": "#4a7c59",
      "pages": [
        {
          "title": "Título da página",
          "content": "Conteúdo HTML da página"
        }
      ]
    }
  ]
}

Regras para o conteúdo HTML das páginas:
- Use <h2> para subtítulos
- Use <p> para parágrafos
- Use <ul><li> para listas com marcadores
- Use <ol><li> para listas numeradas
- Use <strong> para negrito
- Use <em> para itálico
- Use <blockquote> para citações ou definições importantes
- Use <pre> para código ou fórmulas técnicas
- Use <div class="math-block"> para fórmulas matemáticas
- Preserve equações, fórmulas e notações especiais dentro de <div class="math-block">
- Mantenha tabelas como listas estruturadas
- Cada página deve ter conteúdo substancial (não apenas 1-2 linhas)

Regras de estruturação:
- Crie seções baseadas nos capítulos ou temas principais
- Divida cada seção em páginas por subtópico
- Use cores variadas para as seções: #4a7c59, #c4622a, #5c7fa8, #8c5ca8, #c45c7a, #7a8c3a
- O nome do caderno deve ser o título principal do documento
- Máximo de 8 seções, máximo de 6 páginas por seção
- Se o PDF for muito longo, priorize os conteúdos mais importantes

Nome do arquivo: ${fileName}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return NextResponse.json({ error: 'Erro ao processar com IA' }, { status: 500 });
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text ?? '';

    // Strip markdown fences if present
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.error('JSON parse error. Raw:', raw);
      return NextResponse.json({ error: 'IA retornou formato inválido' }, { status: 500 });
    }

    return NextResponse.json({ notebook: parsed });
  } catch (err) {
    console.error('Import PDF error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

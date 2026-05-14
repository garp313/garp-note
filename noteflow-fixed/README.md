# 📒 NoteFlow Universitário

Aplicativo completo de anotações universitárias, construído com **Next.js 14**, **TypeScript** e sem dependências extras.

## ✨ Funcionalidades

- **Hierarquia 3 níveis** — Cadernos → Seções → Páginas
- **Editor rico** — negrito, itálico, sublinhado, H1/H2/H3, listas, checkboxes, código, citações
- **Fórmulas matemáticas** — modal com prévia em tempo real
- **Busca global** — busca em todos os cadernos com trechos destacados
- **Exportação** — Markdown (.md), PDF (via impressão) e texto plano
- **Anexos** — imagens (inline) e PDFs (ícone)
- **Dark mode** — toggle no canto superior direito
- **Cores customizáveis** — cadernos e seções com cor própria
- **Clique direito** — renomear ou excluir qualquer item
- **Atalhos:** `Ctrl+B` (negrito), `Ctrl+I` (itálico), `Ctrl+S` (salvar)
- **Persistência** — tudo salvo automaticamente no `localStorage`

## 🚀 Instalação e uso

```bash
# 1. Entre na pasta
cd noteflow-universitario

# 2. Instale as dependências
npm install

# 3. Rode em desenvolvimento
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## 📁 Estrutura do projeto

```
src/
├── app/
│   ├── globals.css      # Todos os estilos + design tokens
│   ├── layout.tsx       # Layout raiz
│   └── page.tsx         # Página principal (orquestrador)
├── components/
│   ├── Editor.tsx       # Editor de texto rico
│   ├── Modal.tsx        # Modal reutilizável + ColorPicker
│   ├── ContextMenu.tsx  # Menu de contexto (clique direito)
│   ├── Sidebar.tsx      # Lista de cadernos
│   ├── SectionsBar.tsx  # Abas de seções
│   └── PagesList.tsx    # Lista de páginas
├── hooks/
│   └── useNoteFlow.ts   # Estado global + lógica de negócio
├── lib/
│   └/data.ts            # Dados de exemplo + constantes
└── types/
    └── index.ts         # Tipos TypeScript
```

## 🛠️ Build para produção

```bash
npm run build
npm start
```

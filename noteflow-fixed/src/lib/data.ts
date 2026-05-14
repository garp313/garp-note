import { AppData } from '@/types';

export const COLORS = [
  '#4a7c59', '#c4622a', '#5c7fa8', '#8c5ca8',
  '#c45c7a', '#7a8c3a', '#c49c2a', '#5c8c8a',
];

export function getSampleData(): AppData {
  return {
    activeNb: 'nb1',
    activeSec: 's1',
    activePage: 'p1',
    notebooks: [
      {
        id: 'nb1',
        name: '1º Semestre',
        color: '#4a7c59',
        sections: [
          {
            id: 's1',
            name: 'Cálculo I',
            color: '#4a7c59',
            pages: [
              {
                id: 'p1',
                title: 'Limites e Continuidade',
                content: `<h2>Limites</h2><p>O limite de uma função descreve o comportamento quando x se aproxima de um valor.</p><p><strong>Definição formal (ε-δ):</strong></p><div class="math-block">lim_{x→a} f(x) = L</div><ul><li>Limite lateral esquerdo</li><li>Limite lateral direito</li><li>Limite bilateral</li></ul>`,
                date: '10/05/2025',
              },
              {
                id: 'p2',
                title: 'Derivadas',
                content: `<h2>Regras de Derivação</h2><p>A derivada representa a taxa de variação instantânea.</p><div class="math-block">f\'(x) = lim_{h→0} [f(x+h) - f(x)] / h</div><ol><li>Regra da potência</li><li>Regra do produto</li><li>Regra da cadeia</li></ol>`,
                date: '12/05/2025',
              },
            ],
          },
          {
            id: 's2',
            name: 'Física I',
            color: '#c4622a',
            pages: [
              {
                id: 'p3',
                title: 'Cinemática',
                content: `<h2>Movimento Uniforme</h2><p>No MU, a velocidade é constante e a aceleração é zero.</p><div class="math-block">v = Δs / Δt</div><blockquote>A física é a mais fundamental das ciências naturais.</blockquote>`,
                date: '11/05/2025',
              },
            ],
          },
        ],
      },
      {
        id: 'nb2',
        name: '2º Semestre',
        color: '#5c7fa8',
        sections: [
          {
            id: 's3',
            name: 'Antropologia',
            color: '#8c5ca8',
            pages: [
              {
                id: 'p4',
                title: 'Cultura e Sociedade',
                content: `<h2>Conceito de Cultura</h2><p>Cultura é o conjunto de crenças, valores, normas e práticas compartilhadas por um grupo.</p><ul><li>Cultura material</li><li>Cultura imaterial</li><li>Aculturação</li></ul>`,
                date: '09/05/2025',
              },
            ],
          },
        ],
      },
    ],
  };
}

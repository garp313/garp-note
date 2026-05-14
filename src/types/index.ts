export interface Page {
  id: string;
  title: string;
  content: string;
  date: string;
}

export interface Section {
  id: string;
  name: string;
  color: string;
  pages: Page[];
}

export interface Notebook {
  id: string;
  name: string;
  color: string;
  sections: Section[];
}

export interface AppData {
  notebooks: Notebook[];
  activeNb: string | null;
  activeSec: string | null;
  activePage: string | null;
}

export interface ContextTarget {
  type: 'nb' | 'sec' | 'page';
  id: string;
}

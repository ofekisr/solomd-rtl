interface Note {
  id: string;
  title: string;
  tags: readonly string[];
}

export const byTag = (notes: Note[], tag: string): Note[] =>
  notes.filter((note) => note.tags.includes(tag));

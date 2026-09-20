/** "threatened to …" / "reportedly …" — how sure the article is that the act happened. */
export function modalityPrefix(m?: string | null): string {
  switch (m) {
    case 'intended': return 'threatened / planned to ';
    case 'claimed': return 'reportedly ';
    case 'hypothetical': return 'might ';
    case 'denied': return 'denies having ';
    default: return '';
  }
}


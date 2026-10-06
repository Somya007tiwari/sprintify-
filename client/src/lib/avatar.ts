const PASTEL_COLORS = [
  '#F9D5D3',
  '#D6E8F7',
  '#FDE7B8',
  '#D8F0E1',
  '#FBE0CC',
  '#D4ECE8',
  '#F3E3C3',
];

export function getAvatarColor(name: string = ''): string {
  if (!name) return PASTEL_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PASTEL_COLORS.length;
  return PASTEL_COLORS[index];
}

export function getInitials(name: string = ''): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

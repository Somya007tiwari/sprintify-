import React from 'react';

interface HighlightTextProps {
  text: string;
  highlight?: string;
  className?: string;
  highlightClassName?: string;
}

export const HighlightText: React.FC<HighlightTextProps> = ({
  text,
  highlight,
  className = '',
  highlightClassName = 'bg-[#F2B84B]/40 text-app-text font-bold px-0.5 rounded',
}) => {
  if (!highlight || !highlight.trim()) {
    return <span className={className}>{text}</span>;
  }

  const query = highlight.trim();
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className={highlightClassName}>
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </span>
  );
};

import React from 'react';

interface MarkdownViewProps {
  content: string;
  className?: string;
  dark?: boolean;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className = '', dark = false }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const C = dark
    ? { text: 'text-[#DCDCDC]', h1: 'text-white', h2: 'text-[#8BC34A]', h3: 'text-[#F4A261]', line: 'border-[#555]', quote: 'bg-[#343437] text-[#DCDCDC]', link: 'text-[#7FC7FF]', code: 'bg-[#1B2B0B] text-[#DCE8CF]' }
    : { text: 'text-[#222222]', h1: 'text-[#121212]', h2: 'text-[#004E98]', h3: 'text-[#D62828]', line: 'border-[#121212]', quote: 'bg-[#F6F5F0] text-[#333333]', link: 'text-[#004E98]', code: 'bg-[#F0F5FA] text-[#004E98]' };

  // Inline parser: **bold**, *italic*, `code`, [text](url)
  const parseInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*(.*?)\*\*|\*(.*?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.substring(lastIndex, match.index));
      if (match[2] !== undefined) {
        parts.push(<strong key={key++} className={`font-black ${C.text}`}>{match[2]}</strong>);
      } else if (match[3] !== undefined) {
        parts.push(<em key={key++} className="italic">{match[3]}</em>);
      } else if (match[4] !== undefined) {
        parts.push(<code key={key++} className={`px-1 py-0.5 text-[0.9em] ${C.code}`}>{match[4]}</code>);
      } else if (match[5] !== undefined && match[6] !== undefined) {
        parts.push(<a key={key++} href={match[6]} target="_blank" rel="noreferrer" className={`underline hover:opacity-80 ${C.link}`}>{match[5]}</a>);
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) parts.push(text.substring(lastIndex));
    return parts.length > 0 ? parts : text;
  };

  return (
    <div className={`space-y-1.5 text-xs sm:text-sm ${C.text} ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // 1. Divider line: ****
        if (trimmed === '****' || trimmed === '----' || trimmed === '***') {
          return <hr key={idx} className={`my-3 border-t-2 ${C.line}`} />;
        }

        // 2. Heading 1: #
        if (line.startsWith('# ')) {
          return (
            <h1 key={idx} className={`text-xl font-black pt-2 pb-1 border-b-2 ${C.h1} ${C.line}`}>
              {parseInline(line.substring(2))}
            </h1>
          );
        }

        // 3. Heading 2: ##
        if (line.startsWith('## ')) {
          return (
            <h2 key={idx} className={`text-lg font-black pt-1.5 pb-0.5 ${C.h2}`}>
              {parseInline(line.substring(3))}
            </h2>
          );
        }

        // 4. Heading 3: ###
        if (line.startsWith('### ')) {
          return (
            <h3 key={idx} className={`text-base font-bold pt-1 ${C.h3}`}>
              {parseInline(line.substring(4))}
            </h3>
          );
        }

        // 5. Blockquote: >
        if (line.startsWith('> ') || line.startsWith('>')) {
          const quoteText = line.startsWith('> ') ? line.substring(2) : line.substring(1);
          return (
            <blockquote
              key={idx}
              className={`border-l-4 border-[#D62828] pl-3 py-1.5 my-1.5 text-xs font-medium ${C.quote}`}
            >
              {parseInline(quoteText)}
            </blockquote>
          );
        }

        // 6. List item: -
        if (line.startsWith('- ') || line.startsWith('-')) {
          const listText = line.startsWith('- ') ? line.substring(2) : line.substring(1);
          return (
            <div key={idx} className="flex items-start gap-2 my-0.5 pl-1">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dark ? 'bg-[#8BC34A]' : 'bg-[#121212]'}`} />
              <div className="flex-1 leading-relaxed">{parseInline(listText)}</div>
            </div>
          );
        }

        // Empty line
        if (trimmed === '') {
          return <div key={idx} className="h-1.5" />;
        }

        // Regular paragraph
        return (
          <p key={idx} className="leading-relaxed">
            {parseInline(line)}
          </p>
        );
      })}
    </div>
  );
};

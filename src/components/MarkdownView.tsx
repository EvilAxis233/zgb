import React from 'react';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className = '' }) => {
  if (!content) return null;

  const lines = content.split('\n');

  // Inline parser for **bold**
  const parseInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      parts.push(
        <strong key={match.index} className="font-black text-[#121212]">
          {match[1]}
        </strong>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className={`space-y-1.5 text-xs sm:text-sm text-[#222222] ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // 1. Divider line: ****
        if (trimmed === '****' || trimmed === '----' || trimmed === '***') {
          return <hr key={idx} className="my-3 border-t-2 border-[#121212]" />;
        }

        // 2. Heading 1: #
        if (line.startsWith('# ')) {
          return (
            <h1 key={idx} className="text-xl font-black text-[#121212] pt-2 pb-1 border-b-2 border-[#121212]">
              {parseInline(line.substring(2))}
            </h1>
          );
        }

        // 3. Heading 2: ##
        if (line.startsWith('## ')) {
          return (
            <h2 key={idx} className="text-lg font-black text-[#004E98] pt-1.5 pb-0.5">
              {parseInline(line.substring(3))}
            </h2>
          );
        }

        // 4. Heading 3: ###
        if (line.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-base font-bold text-[#D62828] pt-1">
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
              className="border-l-4 border-[#D62828] bg-[#F6F5F0] pl-3 py-1.5 my-1.5 text-xs text-[#333333] font-medium"
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
              <span className="w-1.5 h-1.5 rounded-full bg-[#121212] mt-1.5 shrink-0" />
              <div className="flex-1 leading-relaxed">{parseInline(listText)}</div>
            </div>
          );
        }

        // Empty line
        if (trimmed === '') {
          return <div key={idx} className="h-1.5" />;
        }

        // Regular paragraph with inline **bold**
        return (
          <p key={idx} className="leading-relaxed">
            {parseInline(line)}
          </p>
        );
      })}
    </div>
  );
};

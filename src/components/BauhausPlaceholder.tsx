import React from 'react';

interface BauhausPlaceholderProps {
  title?: string;
  rule?: string;
  seedColor?: string;
  className?: string;
}

const PALETTES: Record<string, { primary: string; secondary: string; accent: string }> = {
  '#D62828': { primary: '#D62828', secondary: '#9E1B1B', accent: '#FF8585' }, // 包豪斯红
  '#004E98': { primary: '#004E98', secondary: '#002952', accent: '#60A5FA' }, // 包豪斯蓝
  '#F4A261': { primary: '#F4A261', secondary: '#E76F51', accent: '#FFD166' }, // 包豪斯黄
  '#121212': { primary: '#121212', secondary: '#3A3A3A', accent: '#888888' }, // 纯粹墨黑
};

export const BauhausPlaceholder: React.FC<BauhausPlaceholderProps> = ({
  title,
  rule = 'TRPG',
  seedColor = '#D62828',
  className = 'w-full h-44',
}) => {
  // Coordinated palette for all 3 geometric shapes
  const palette = PALETTES[seedColor] || {
    primary: seedColor,
    secondary: '#121212',
    accent: '#F4A261',
  };

  return (
    <div
      className={`relative overflow-hidden bg-[#F2F0E8] border-b-2 border-[#121212] flex items-center justify-center select-none ${className}`}
    >
      {/* Geometric background grid lines */}
      <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 pointer-events-none opacity-20">
        <div className="border-r border-b border-[#121212]" />
        <div className="border-r border-b border-[#121212]" />
        <div className="border-r border-b border-[#121212]" />
        <div className="border-r border-b border-[#121212]" />
        <div className="border-r border-b border-[#121212]" />
        <div className="border-b border-[#121212]" />
      </div>

      {/* Bauhaus Primary Shapes: Semicircle / Square / Circle - all 3 update with chosen main color */}
      {/* 1. Large bottom-right semicircle */}
      <div
        className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full border-2 border-[#121212] transition-colors duration-200"
        style={{ backgroundColor: palette.primary }}
      />
      {/* 2. Top-left square */}
      <div
        className="absolute top-3 left-4 w-12 h-12 border-2 border-[#121212] transition-colors duration-200"
        style={{ backgroundColor: palette.secondary }}
      />
      {/* 3. Bottom-left circle */}
      <div
        className="absolute bottom-4 left-1/4 w-8 h-8 rounded-full border-2 border-[#121212] transition-colors duration-200"
        style={{ backgroundColor: palette.accent }}
      />

      {/* Diagonal Bauhaus accent line */}
      <div className="absolute w-44 h-1 bg-[#121212] -rotate-45 transform origin-top-left -top-4 -left-4 opacity-70" />

      {/* Centerpiece campaign title. Rule remains available as the fallback label. */}
      <div className="relative z-10 bg-[#FFFFFF]/95 border-2 border-[#121212] px-3 py-2 shadow-[3px_3px_0px_#121212] flex items-center justify-center max-w-[84%]">
        <span className="text-sm sm:text-base font-black tracking-tight text-[#121212] text-center leading-tight break-words">
          {title || rule}
        </span>
      </div>

      {/* Top right Bauhaus stamp (unobscured) */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
        <div className="w-2.5 h-2.5 rounded-full bg-[#121212]" />
        <div className="w-2.5 h-2.5 bg-[#D62828]" />
        <div className="w-2.5 h-2.5 bg-[#004E98]" />
      </div>
    </div>
  );
};

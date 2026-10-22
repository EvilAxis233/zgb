import React from 'react';
import { UserNameplate } from '../types';

interface NameplateBadgeProps {
  nameplate?: UserNameplate | null;
  className?: string;
}

export const NameplateBadge: React.FC<NameplateBadgeProps> = ({ nameplate, className = '' }) => {
  if (!nameplate || !nameplate.text || !nameplate.styleId) return null;

  return (
    <div
      className={`nb-badge ${nameplate.styleId} ${className}`}
      title={`会员自定义铭牌：${nameplate.text}`}
      role="status"
      aria-label={`会员铭牌：${nameplate.text}`}
    >
      <span className="nb-text">{nameplate.text}</span>
    </div>
  );
};

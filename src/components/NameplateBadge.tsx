import React from 'react';
import { UserNameplate } from '../types';
import { REFERENCE_NAMEPLATE_STYLES } from '../nameplateGallery';

interface NameplateBadgeProps {
  nameplate?: UserNameplate | null;
  className?: string;
}

export const NameplateBadge: React.FC<NameplateBadgeProps> = ({ nameplate, className = '' }) => {
  if (!nameplate || !nameplate.text || !nameplate.styleId) return null;
  const referenceStyle = REFERENCE_NAMEPLATE_STYLES.find((style) => style.id === nameplate.styleId);
  const leftAnimationClass = nameplate.styleId === 'nb-ref-d05' ? 'spin-icon'
    : nameplate.styleId === 'nb-ref-d09' ? 'gear-1'
    : nameplate.styleId === 'nb-ref-d10' ? 'taiji-icon'
    : nameplate.styleId === 'nb-ref-d17' ? 'sakura-icon'
    : nameplate.styleId === 'nb-ref-d19' ? 'rad-icon'
    : nameplate.styleId === 'nb-ref-d28' ? 'warn-dot' : '';
  const rightAnimationClass = nameplate.styleId === 'nb-ref-d09' ? 'gear-2'
    : nameplate.styleId === 'nb-ref-d15' ? 'blink-dot' : '';

  return (
    <div
      className={`nb-badge ${nameplate.styleId} ${referenceStyle ? `nb-ref-font-${referenceStyle.font}` : ''} ${className}`}
      title={`会员自定义铭牌：${nameplate.text}`}
      role="status"
      aria-label={`会员铭牌：${nameplate.text}`}
    >
      {referenceStyle && (nameplate.styleId === 'nb-ref-d22'
        ? <span className="nb-ref-mark inline-flex items-end h-3" aria-hidden="true">
            <span className="eq-bar" style={{ height: 6 }} /><span className="eq-bar" style={{ height: 11, animationDelay: '0.2s' }} /><span className="eq-bar" style={{ height: 4, animationDelay: '0.4s' }} />
          </span>
        : <span className={`nb-ref-mark ${referenceStyle.leftMark.length > 2 ? 'nb-ref-mark-long' : ''} ${leftAnimationClass}`} aria-hidden="true">{referenceStyle.leftMark}</span>)}
      <span className="nb-text">{nameplate.text}</span>
      {referenceStyle && <span className={`nb-ref-mark ${referenceStyle.rightMark.length > 2 ? 'nb-ref-mark-long' : ''} ${rightAnimationClass}`} aria-hidden="true">{referenceStyle.rightMark}</span>}
    </div>
  );
};

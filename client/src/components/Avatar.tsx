import React from 'react';
import { getAvatarColor, getInitials } from '@/lib/avatar';

interface AvatarProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showTooltip?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  size = 'md',
  className = '',
  showTooltip = true,
}) => {
  const color = getAvatarColor(name);
  const initials = getInitials(name);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };

  return (
    <div
      title={showTooltip ? name : undefined}
      style={{ backgroundColor: color }}
      className={`rounded-full flex items-center justify-center font-semibold text-app-text border border-app-border/40 select-none transition-transform hover:scale-105 shrink-0 ${sizeClasses[size]} ${className}`}
    >
      {initials}
    </div>
  );
};

import React from 'react';
import { TaskPriority } from '@/lib/types';

interface PriorityBadgeProps {
  priority: TaskPriority;
  size?: 'sm' | 'md';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'sm' }) => {
  const styles = {
    HIGH: {
      bg: 'bg-[#FBDAD8]',
      text: 'text-[#B4413C]',
      label: 'HIGH',
    },
    MEDIUM: {
      bg: 'bg-[#FDE9C4]',
      text: 'text-[#A8680F]',
      label: 'MEDIUM',
    },
    LOW: {
      bg: 'bg-[#D9F0DF]',
      text: 'text-[#2E7D4F]',
      label: 'LOW',
    },
  };

  const config = styles[priority] || styles.MEDIUM;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-bold tracking-wider rounded-md ${config.bg} ${config.text} ${sizeClasses}`}
    >
      {config.label}
    </span>
  );
};

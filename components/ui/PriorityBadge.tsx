import React from 'react';

interface PriorityBadgeProps {
  priority: number;
  className?: string;
}

export function PriorityBadge({ priority, className = '' }: PriorityBadgeProps) {
  // กำหนดสีตามระดับความสำคัญ
  const getPriorityConfig = (priority: number) => {
    if (priority >= 9) {
      return {
        color: 'bg-red-500 text-white',
        label: 'ด่วนมาก',
        icon: '🔴'
      };
    } else if (priority >= 7) {
      return {
        color: 'bg-orange-500 text-white',
        label: 'ด่วน',
        icon: '🟠'
      };
    } else if (priority >= 5) {
      return {
        color: 'bg-yellow-500 text-gray-900',
        label: 'ปานกลาง',
        icon: '🟡'
      };
    } else {
      return {
        color: 'bg-blue-500 text-white',
        label: 'ปกติ',
        icon: '🔵'
      };
    }
  };

  const config = getPriorityConfig(priority);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium font-thai ${config.color} ${className}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
      <span className="ml-1 opacity-75">({priority}/10)</span>
    </span>
  );
}

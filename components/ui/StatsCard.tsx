import React from 'react';
import { LucideIcon } from 'lucide-react';
import Card from './Card';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: {
    value: string;
    type: 'increase' | 'decrease';
  };
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon: Icon,
  change,
  color = 'blue'
}) => {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      text: 'text-blue-600'
    },
    green: {
      bg: 'bg-green-50',
      icon: 'text-green-600',
      text: 'text-green-600'
    },
    yellow: {
      bg: 'bg-yellow-50',
      icon: 'text-yellow-600',
      text: 'text-yellow-600'
    },
    red: {
      bg: 'bg-red-50',
      icon: 'text-red-600',
      text: 'text-red-600'
    },
    purple: {
      bg: 'bg-purple-50',
      icon: 'text-purple-600',
      text: 'text-purple-600'
    }
  };

  const currentColor = colorClasses[color] || colorClasses.blue;

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center">
        <div className="flex-1">
          <p className="text-sm font-medium text-thai-gray-600 font-thai">
            {title}
          </p>
          <p className="text-2xl font-bold text-thai-gray-900 font-thai mt-1">
            {value}
          </p>
          {change && (
            <div className="flex items-center mt-2">
              <span className={`
                text-sm font-medium font-thai
                ${change.type === 'increase' ? 'text-green-600' : 'text-red-600'}
              `}>
                {change.type === 'increase' ? '+' : '-'}{change.value}
              </span>
              <span className="text-sm text-thai-gray-500 ml-1 font-thai">
                จากเดือนที่แล้ว
              </span>
            </div>
          )}
        </div>
        <div className={`
          w-12 h-12 rounded-lg flex items-center justify-center
          ${currentColor.bg}
        `}>
          <Icon className={`w-6 h-6 ${currentColor.icon}`} />
        </div>
      </div>
    </Card>
  );
};

export default StatsCard;
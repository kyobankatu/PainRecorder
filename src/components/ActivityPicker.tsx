'use client';

import { ACTIVITY_LEVELS } from '@/lib/constants';

interface Props {
  value: number;
  onChange: (value: number) => void;
}

export default function ActivityPicker({ value, onChange }: Props) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">活動量</p>
      <div className="grid grid-cols-7 gap-1">
        {ACTIVITY_LEVELS.map((level) => (
          <button
            key={level.value}
            type="button"
            onClick={() => onChange(level.value)}
            className={`flex flex-col items-center p-2 rounded-lg border-2 text-xs transition-all ${
              value === level.value
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <span className="text-lg font-bold">{level.value}</span>
            <span className="text-center leading-tight mt-1" style={{ fontSize: '10px' }}>
              {level.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

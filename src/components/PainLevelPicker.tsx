'use client';

import { PAIN_LEVEL_COLORS } from '@/lib/constants';

interface Props {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}

const PAIN_LABELS: Record<number, string> = {
  0: '全く痛くない',
  9: '最も痛い',
};

export default function PainLevelPicker({ value, onChange, label }: Props) {
  return (
    <div>
      {label && <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>}
      <div className="flex gap-1">
        {Array.from({ length: 10 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            title={PAIN_LABELS[i] ?? String(i)}
            className={`flex-1 h-10 rounded-lg text-sm font-bold transition-all ${
              value === i
                ? 'ring-2 ring-offset-1 ring-gray-800 scale-110 text-white'
                : 'opacity-60 hover:opacity-90 text-white'
            }`}
            style={{ backgroundColor: PAIN_LEVEL_COLORS[i] }}
          >
            {i}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>全く痛くない</span>
        <span>最も痛い</span>
      </div>
    </div>
  );
}

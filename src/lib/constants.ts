export const ACTIVITY_LEVELS = [
  { value: 0, label: '寝たきり' },
  { value: 1, label: 'リクライニングソファのみ' },
  { value: 2, label: 'リクライニングソファ＋立つ' },
  { value: 3, label: '家の中を動く(四つん這い掃除、立ったまま料理)' },
  { value: 4, label: '通院(車＋少し歩く)' },
  { value: 5, label: '杖、松葉杖で外出' },
  { value: 6, label: '歩行(外)' },
] as const;

// Colors from green (0) to red (9) for pain levels
export const PAIN_LEVEL_COLORS = [
  '#22c55e', // 0 - green-500
  '#84cc16', // 1 - lime-500
  '#a3e635', // 2 - lime-400
  '#eab308', // 3 - yellow-500
  '#f59e0b', // 4 - amber-500
  '#f97316', // 5 - orange-500
  '#ef4444', // 6 - red-500
  '#dc2626', // 7 - red-600
  '#b91c1c', // 8 - red-700
  '#7f1d1d', // 9 - red-900
];

// Colors for graph lines (one per pain type)
export const GRAPH_LINE_COLORS = [
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#f59e0b', // amber-500
  '#6366f1', // indigo-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
];

'use client';

import { useState, useEffect } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { GRAPH_LINE_COLORS, ACTIVITY_LEVELS } from '@/lib/constants';

interface PainType {
  id: string;
  name: string;
}

interface PainEntry {
  painTypeId: string;
  level: number;
  painType: { id: string; name: string };
}

interface Record {
  id: string;
  recordedAt: string;
  activityLevel: number;
  comment: string;
  painEntries: PainEntry[];
}

type Range = 'today' | '7d' | '30d' | 'all';

const RANGE_LABELS: Record<Range, string> = {
  today: '今日',
  '7d': '7日間',
  '30d': '30日間',
  all: '全期間',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function PainGraph() {
  const [range, setRange] = useState<Range>('7d');
  const [painTypes, setPainTypes] = useState<PainType[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/records?range=${range}`)
      .then((r) => r.json())
      .then(({ records: recs, painTypes: pts }: { records: Record[]; painTypes: PainType[] }) => {
        setRecords(recs);
        setPainTypes(pts);
        setVisibleTypes(new Set(pts.map((p) => p.id)));
      })
      .finally(() => setLoading(false));
  }, [range]);

  const chartData = records.map((rec) => {
    const point: Record<string, string | number> = {
      time: formatDateTime(rec.recordedAt),
      活動量: rec.activityLevel,
    };
    rec.painEntries.forEach((entry) => {
      point[entry.painType.name] = entry.level;
    });
    return point;
  });

  const colorMap = new Map(
    painTypes.map((pt, i) => [pt.id, GRAPH_LINE_COLORS[i % GRAPH_LINE_COLORS.length]])
  );

  const visiblePainTypes = painTypes.filter((pt) => visibleTypes.has(pt.id));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              range === r ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {painTypes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {painTypes.map((pt) => {
            const color = colorMap.get(pt.id) ?? '#ccc';
            return (
              <button
                key={pt.id}
                onClick={() =>
                  setVisibleTypes((prev) => {
                    const next = new Set(prev);
                    if (next.has(pt.id)) {
                      next.delete(pt.id);
                    } else {
                      next.add(pt.id);
                    }
                    return next;
                  })
                }
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border transition-all"
                style={{
                  borderColor: color,
                  backgroundColor: visibleTypes.has(pt.id) ? color + '22' : 'white',
                  color: visibleTypes.has(pt.id) ? color : '#9ca3af',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: visibleTypes.has(pt.id) ? color : '#d1d5db' }}
                />
                {pt.name}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="h-72 flex items-center justify-center text-gray-400">読み込み中...</div>
      ) : records.length === 0 ? (
        <div className="h-72 flex items-center justify-center text-gray-400 bg-white rounded-xl border border-gray-100">
          この期間のデータがありません
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">痛みレベル (左軸: 0〜9) / 活動量 (右軸: 0〜6)</p>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="pain" domain={[0, 9]} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="activity" orientation="right" domain={[0, 6]} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === '活動量') {
                    return [ACTIVITY_LEVELS[value]?.label ?? value, name];
                  }
                  return [value, name];
                }}
              />
              <Legend />
              {visiblePainTypes.map((pt) => (
                <Line
                  key={pt.id}
                  yAxisId="pain"
                  type="monotone"
                  dataKey={pt.name}
                  stroke={colorMap.get(pt.id) ?? '#ccc'}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                />
              ))}
              <Bar yAxisId="activity" dataKey="活動量" fill="#93c5fd" opacity={0.5} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

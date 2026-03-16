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

interface PainRecord {
    id: string;
    recordedAt: string;
    activityLevel: number;
    comment: string;
    temperature: number | null;
    humidity: number | null;
    pressure: number | null;
    painEntries: PainEntry[];
}

type Range = 'today' | '7d' | '30d' | 'all' | 'custom';

const RANGE_LABELS: Record<Range, string> = {
    today: '今日',
    '7d': '7日間',
    '30d': '30日間',
    all: '全期間',
    custom: '期間指定',
};

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

function downloadCsv(records: PainRecord[], painTypes: PainType[], range: string) {
    const headers = [
        '日時', '活動量', '活動量ラベル',
        '気温(°C)', '湿度(%)', '気圧(hPa)', 'コメント',
        ...painTypes.map((pt) => pt.name),
    ];
    const rows = records.map((rec) => {
        const cells: (string | number) [] = [
            formatDateTime(rec.recordedAt),
            rec.activityLevel,
            ACTIVITY_LEVELS.find((a) => a.value === rec.activityLevel)?.label ?? '',
            rec.temperature ?? '',
            rec.humidity ?? '',
            rec.pressure ?? '',
            `"${rec.comment.replace(/"/g, '""')}"`,
            ...painTypes.map((pt) => {
                const entry = rec.painEntries.find((e) => e.painTypeId === pt.id);
                return entry?.level ?? '';
            }),
        ];
        return cells.join(',');
    });
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pain-record-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/** ピアソン相関係数。データが3点未満またはどちらかの分散が0の場合はnull */
function pearson(xs: number[], ys: number[]): number | null {
    if (xs.length < 3) { return null; }
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i] - my), 0);
    const den = Math.sqrt(
        xs.reduce((acc, x) => acc + (x - mx) ** 2, 0) *
        ys.reduce((acc, y) => acc + (y - my) ** 2, 0)
    );
    if (den === 0) { return null; }
    return Math.round((num / den) * 100) / 100;
}

function correlationLabel(r: number): string {
    const abs = Math.abs(r);
    const dir = r >= 0 ? '正' : '負';
    if (abs < 0.2) { return 'ほぼ相関なし'; }
    if (abs < 0.4) { return `弱い${dir}の相関`; }
    if (abs < 0.7) { return `中程度の${dir}の相関`; }
    return `強い${dir}の相関`;
}

function correlationColor(r: number): string {
    const abs = Math.abs(r);
    if (abs < 0.2) { return 'text-gray-400'; }
    if (abs < 0.4) { return r >= 0 ? 'text-orange-400' : 'text-blue-400'; }
    if (abs < 0.7) { return r >= 0 ? 'text-orange-500' : 'text-blue-500'; }
    return r >= 0 ? 'text-red-600' : 'text-blue-700';
}

/** 線形回帰。傾き・切片・決定係数R²を返す。データが2点未満またはx分散が0の場合はnull */
function linearRegression(points: { t: number; y: number }[]): { slope: number; intercept: number; r2: number } | null {
    const n = points.length;
    if (n < 2) { return null; }
    const mx = points.reduce((a, p) => a + p.t, 0) / n;
    const my = points.reduce((a, p) => a + p.y, 0) / n;
    const ssxx = points.reduce((a, p) => a + (p.t - mx) ** 2, 0);
    const ssxy = points.reduce((a, p) => a + (p.t - mx) * (p.y - my), 0);
    const ssyy = points.reduce((a, p) => a + (p.y - my) ** 2, 0);
    if (ssxx === 0) { return null; }
    const slope = ssxy / ssxx;
    const r2 = ssyy === 0 ? 1 : (ssxy ** 2) / (ssxx * ssyy);
    return { slope, intercept: my - slope * mx, r2: Math.round(r2 * 100) / 100 };
}

/** レコードの全痛みエントリの平均値 */
function meanPain(rec: PainRecord): number | null {
    if (rec.painEntries.length === 0) { return null; }
    return rec.painEntries.reduce((s, e) => s + e.level, 0) / rec.painEntries.length;
}

export default function PainGraph() {
    const [range, setRange] = useState<Range>('7d');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [appliedStart, setAppliedStart] = useState('');
    const [appliedEnd, setAppliedEnd] = useState('');
    const [painTypes, setPainTypes] = useState<PainType[]>([]);
    const [records, setRecords] = useState<PainRecord[]>([]);
    const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [showReport, setShowReport] = useState(false);

    useEffect(() => {
        if (range === 'custom' && (!appliedStart || !appliedEnd)) { return; }
        setLoading(true);
        const url = range === 'custom'
            ? `/api/records?startDate=${appliedStart}&endDate=${appliedEnd}`
            : `/api/records?range=${range}`;
        fetch(url)
            .then((r) => r.json())
            .then(({ records: recs, painTypes: pts }: { records: PainRecord[]; painTypes: PainType[] }) => {
                setRecords(recs);
                setPainTypes(pts);
                setVisibleTypes(new Set(pts.map((p) => p.id)));
            })
            .finally(() => setLoading(false));
    }, [range, appliedStart, appliedEnd]);

    const chartData = records.map((rec) => {
        const point: Record<string, string | number | null> = {
            time: formatDateTime(rec.recordedAt),
            活動量: rec.activityLevel,
        };
        rec.painEntries.forEach((entry) => {
            point[entry.painType.name] = entry.level;
        });
        return point;
    });

    const tempHumData = records.map((rec) => ({
        time: formatDateTime(rec.recordedAt),
        気温: rec.temperature,
        湿度: rec.humidity,
    }));

    const pressureData = records.map((rec) => ({
        time: formatDateTime(rec.recordedAt),
        気圧: rec.pressure,
    }));

    const hasTempHum = records.some((rec) => rec.temperature !== null || rec.humidity !== null);
    const hasPressure = records.some((rec) => rec.pressure !== null);

    const colorMap = new Map(
        painTypes.map((pt, i) => [pt.id, GRAPH_LINE_COLORS[i % GRAPH_LINE_COLORS.length]])
    );

    const visiblePainTypes = painTypes.filter((pt) => visibleTypes.has(pt.id));

    // ── 傾向レポート計算 ──────────────────────────────────────────

    // タイプ別 平均・最小・最大・件数
    const avgByType = painTypes.map((pt) => {
        const levels = records.flatMap((rec) =>
            rec.painEntries.filter((e) => e.painTypeId === pt.id).map((e) => e.level)
        );
        if (levels.length === 0) { return { id: pt.id, name: pt.name, avg: null, min: null, max: null, count: 0 }; }
        const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
        return { id: pt.id, name: pt.name, avg, min: Math.min(...levels), max: Math.max(...levels), count: levels.length };
    });

    // 日別平均痛みレベル
    const painByDate = new Map<string, number[]>();
    records.forEach((rec) => {
        const date = formatDate(rec.recordedAt);
        const mp = meanPain(rec);
        if (mp !== null) {
            const arr = painByDate.get(date) ?? [];
            arr.push(mp);
            painByDate.set(date, arr);
        }
    });
    let worstDay: { date: string; avg: number } | null = null as { date: string; avg: number } | null;
    let bestDay: { date: string; avg: number } | null = null as { date: string; avg: number } | null;
    painByDate.forEach((vals, date) => {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        if (worstDay === null || avg > worstDay.avg) {
            worstDay = { date, avg: Math.round(avg * 10) / 10 };
        }
        if (bestDay === null || avg < bestDay.avg) {
            bestDay = { date, avg: Math.round(avg * 10) / 10 };
        }
    });

    // 期間サマリー
    const firstDate = records.length > 0 ? new Date(records[0].recordedAt) : null;
    const lastDate = records.length > 0 ? new Date(records[records.length - 1].recordedAt) : null;
    const spanDays = firstDate && lastDate
        ? Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)
        : null;
    const recordedDayCount = painByDate.size;

    // 痛みタイプ別 推移（日別平均に対する線形回帰）
    const trendByType = painTypes.map((pt) => {
        const dailyMap = new Map<string, number[]>();
        records.forEach((rec) => {
            const entry = rec.painEntries.find((e) => e.painTypeId === pt.id);
            if (entry === undefined) { return; }
            const d = new Date(rec.recordedAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const arr = dailyMap.get(key) ?? [];
            arr.push(entry.level);
            dailyMap.set(key, arr);
        });
        const points = Array.from(dailyMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, vals]) => ({
                t: new Date(key).getTime() / (1000 * 60 * 60 * 24),
                y: vals.reduce((a, b) => a + b, 0) / vals.length,
            }));
        return { id: pt.id, name: pt.name, result: linearRegression(points), days: points.length };
    });

    // 活動量の分布
    const maxActivityCount = Math.max(1, ...ACTIVITY_LEVELS.map((a) => records.filter((rec) => rec.activityLevel === a.value).length));
    const activityDist = ACTIVITY_LEVELS.map((a) => ({
        value: a.value,
        label: a.label,
        count: records.filter((rec) => rec.activityLevel === a.value).length,
    }));

    // 活動量 vs 平均痛みの相関
    const activityXs: number[] = [];
    const meanPainYs: number[] = [];
    records.forEach((rec) => {
        const mp = meanPain(rec);
        if (mp !== null) {
            activityXs.push(rec.activityLevel);
            meanPainYs.push(mp);
        }
    });
    const activityCorr = pearson(activityXs, meanPainYs);

    // ── 気象相関計算 ──────────────────────────────────────────────

    type WeatherKey = 'temperature' | 'humidity' | 'pressure';
    const weatherLabels: Record<WeatherKey, string> = { temperature: '気温', humidity: '湿度', pressure: '気圧' };
    const weatherUnits: Record<WeatherKey, string> = { temperature: '°C', humidity: '%', pressure: 'hPa' };

    const weatherCorr = (['temperature', 'humidity', 'pressure'] as WeatherKey[]).map((key) => {
        const pairs = records
            .map((rec) => ({ w: rec[key], p: meanPain(rec) }))
            .filter((x): x is { w: number; p: number } => x.w !== null && x.p !== null);
        const r = pearson(pairs.map((x) => x.w), pairs.map((x) => x.p));
        return { key, label: weatherLabels[key], unit: weatherUnits[key], r, n: pairs.length };
    });

    const hasWeatherCorr = weatherCorr.some((w) => w.r !== null);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
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
                {!loading && records.length > 0 && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                const label = range === 'custom' ? `${appliedStart}_${appliedEnd}` : range;
                                downloadCsv(records, painTypes, label);
                            }}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            CSVダウンロード
                        </button>
                        <a
                            href={
                                range === 'custom'
                                    ? `/print-preview?startDate=${appliedStart}&endDate=${appliedEnd}`
                                    : `/print-preview?range=${range}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            印刷・PDF
                        </a>
                    </div>
                )}
            </div>

            {range === 'custom' && (
                <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl shadow-sm px-4 py-3">
                    <label className="text-sm text-gray-600">開始</label>
                    <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <label className="text-sm text-gray-600">終了</label>
                    <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="button"
                        onClick={() => {
                            if (customStart && customEnd) {
                                setAppliedStart(customStart);
                                setAppliedEnd(customEnd);
                            }
                        }}
                        disabled={!customStart || !customEnd}
                        className="px-3 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm rounded-lg transition-colors"
                    >
                        適用
                    </button>
                </div>
            )}

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
                <div className="space-y-4">
                    {/* 痛みグラフ */}
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

                    {/* 気温・湿度グラフ */}
                    {hasTempHum && (
                        <div className="bg-white rounded-xl shadow-sm p-4">
                            <p className="text-xs text-gray-500 mb-1">気温 °C (左軸) / 湿度 % (右軸: 0〜100)</p>
                            <ResponsiveContainer width="100%" height={200}>
                                <ComposedChart data={tempHumData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                                    <YAxis yAxisId="temp" tick={{ fontSize: 11 }} unit="°" />
                                    <YAxis yAxisId="hum" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                                    <Tooltip
                                        formatter={(value: number, name: string) => {
                                            if (name === '気温') { return [`${value} °C`, name]; }
                                            if (name === '湿度') { return [`${value} %`, name]; }
                                            return [value, name];
                                        }}
                                    />
                                    <Legend />
                                    <Line yAxisId="temp" type="monotone" dataKey="気温" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                                    <Line yAxisId="hum" type="monotone" dataKey="湿度" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* 気圧グラフ */}
                    {hasPressure && (
                        <div className="bg-white rounded-xl shadow-sm p-4">
                            <p className="text-xs text-gray-500 mb-1">気圧 hPa</p>
                            <ResponsiveContainer width="100%" height={160}>
                                <ComposedChart data={pressureData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} width={60} />
                                    <Tooltip formatter={(value: number) => [`${value} hPa`, '気圧']} />
                                    <Legend />
                                    <Line type="monotone" dataKey="気圧" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                                </ComposedChart>
                            </ResponsiveContainer>

                        </div>
                    )}

                    {/* 傾向レポート */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setShowReport((v) => !v)}
                            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <span>
                                傾向レポート（{range === 'custom' ? `${appliedStart} 〜 ${appliedEnd}` : RANGE_LABELS[range]}）
                            </span>
                            <span className="text-gray-400 text-xs">{showReport ? '▲ 閉じる' : '▼ 開く'}</span>
                        </button>

                        {showReport && (
                            <div className="px-4 pb-4 space-y-5 border-t border-gray-100">
                                {/* 期間サマリー */}
                                <div>
                                    <p className="text-xs font-medium text-gray-500 mt-3 mb-2">期間サマリー</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                                            <p className="text-xl font-bold text-blue-500">{records.length}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">総記録数</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                                            <p className="text-xl font-bold text-blue-500">{recordedDayCount}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">記録した日数</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                                            <p className="text-xl font-bold text-blue-500">
                                                {spanDays !== null ? (records.length / spanDays).toFixed(1) : '—'}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">平均記録/日</p>
                                        </div>
                                    </div>
                                </div>

                                {/* タイプ別 平均・最小・最大 */}
                                <div>
                                    <p className="text-xs font-medium text-gray-500 mb-2">痛みタイプ別 統計</p>
                                    {avgByType.length === 0 ? (
                                        <p className="text-xs text-gray-400">データなし</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {avgByType.map(({ id, name, avg, min, max, count }) => {
                                                const color = colorMap.get(id) ?? '#ccc';
                                                const pct = avg !== null ? (avg / 9) * 100 : 0;
                                                return (
                                                    <div key={id}>
                                                        <div className="flex items-center justify-between text-sm mb-0.5">
                                                            <span className="text-gray-700">{name}</span>
                                                            <span className="text-xs text-gray-400">{count}件</span>
                                                        </div>
                                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                                                            <div
                                                                className="h-full rounded-full transition-all"
                                                                style={{ width: `${pct}%`, backgroundColor: color }}
                                                            />
                                                        </div>
                                                        <div className="flex justify-between text-xs text-gray-500">
                                                            <span>最小 <span className="font-mono font-semibold text-blue-400">{min ?? '—'}</span></span>
                                                            <span>平均 <span className="font-mono font-semibold" style={{ color }}>{avg !== null ? avg.toFixed(1) : '—'}</span></span>
                                                            <span>最大 <span className="font-mono font-semibold text-red-400">{max ?? '—'}</span></span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* 最も痛みが強かった日 / 最も楽だった日 */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-red-50 rounded-lg p-3">
                                        <p className="text-xs font-medium text-gray-500 mb-1">最も痛みが強かった日</p>
                                        {worstDay !== null ? (
                                            <>
                                                <p className="font-semibold text-red-500">{worstDay.date}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">平均 {worstDay.avg} / 9</p>
                                            </>
                                        ) : (
                                            <p className="text-xs text-gray-400">データなし</p>
                                        )}
                                    </div>
                                    <div className="bg-green-50 rounded-lg p-3">
                                        <p className="text-xs font-medium text-gray-500 mb-1">最も楽だった日</p>
                                        {bestDay !== null ? (
                                            <>
                                                <p className="font-semibold text-green-600">{bestDay.date}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">平均 {bestDay.avg} / 9</p>
                                            </>
                                        ) : (
                                            <p className="text-xs text-gray-400">データなし</p>
                                        )}
                                    </div>
                                </div>

                                {/* 痛みタイプ別 推移（線形回帰） */}
                                {trendByType.some((t) => t.result !== null) && (
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 mb-2">痛みタイプ別 推移（線形回帰）</p>
                                        <div className="space-y-3">
                                            {trendByType.map(({ id, name, result, days }) => {
                                                const color = colorMap.get(id) ?? '#ccc';
                                                if (result === null) {
                                                    return (
                                                        <div key={id} className="flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                                            <span className="text-xs text-gray-700 w-28 shrink-0">{name}</span>
                                                            <span className="text-xs text-gray-300">データ不足（{days}日）</span>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div key={id}>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                                            <span className="text-xs font-medium text-gray-700 flex-1">{name}</span>
                                                            <span className="text-xs text-gray-300">{days}日分</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 pl-4">
                                                            <div className="flex-1">
                                                                {result.slope < -0.05 ? (
                                                                    <span className="text-green-600 font-semibold text-sm">改善傾向 ↓</span>
                                                                ) : result.slope > 0.05 ? (
                                                                    <span className="text-red-500 font-semibold text-sm">悪化傾向 ↑</span>
                                                                ) : (
                                                                    <span className="text-gray-400 font-semibold text-sm">横ばい →</span>
                                                                )}
                                                                <p className="text-xs text-gray-400 mt-0.5">
                                                                    1日あたり {result.slope >= 0 ? '+' : ''}{result.slope.toFixed(3)}
                                                                </p>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <p className="text-xs text-gray-400">R²</p>
                                                                <p className={`font-mono font-bold text-sm ${result.r2 >= 0.5 ? 'text-blue-500' : result.r2 >= 0.2 ? 'text-gray-500' : 'text-gray-300'}`}>
                                                                    {result.r2.toFixed(2)}
                                                                </p>
                                                                <p className="text-xs text-gray-300">
                                                                    {result.r2 >= 0.5 ? '明確' : result.r2 >= 0.2 ? '弱い' : '散乱'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <p className="text-xs text-gray-300 mt-2">R²: 傾向の信頼度（1に近いほど明確）</p>
                                    </div>
                                )}

                                {/* 活動量の分布 */}
                                <div>
                                    <p className="text-xs font-medium text-gray-500 mb-2">活動量の分布</p>
                                    <div className="space-y-1.5">
                                        {activityDist.filter((a) => a.count > 0).map((a) => (
                                            <div key={a.value} className="flex items-center gap-2">
                                                <span className="font-mono text-xs text-blue-500 w-4 shrink-0">{a.value}</span>
                                                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-200 rounded-full"
                                                        style={{ width: `${(a.count / maxActivityCount) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-400 w-6 text-right shrink-0">{a.count}</span>
                                                <span className="text-xs text-gray-400 hidden sm:inline shrink-0">{a.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 活動量との相関 */}
                                <div>
                                    <p className="text-xs font-medium text-gray-500 mb-1">活動量との相関</p>
                                    {activityCorr !== null ? (
                                        <div className="text-sm">
                                            <span className={`font-mono font-bold ${correlationColor(activityCorr)}`}>
                                                r = {activityCorr >= 0 ? '+' : ''}{activityCorr.toFixed(2)}
                                            </span>
                                            <span className={`ml-2 text-xs ${correlationColor(activityCorr)}`}>
                                                {correlationLabel(activityCorr)}
                                            </span>
                                            {activityCorr <= -0.2 && (
                                                <p className="text-xs text-gray-400 mt-0.5">活動量が高いほど痛みが低い傾向があります</p>
                                            )}
                                            {activityCorr >= 0.2 && (
                                                <p className="text-xs text-gray-400 mt-0.5">活動量が高いほど痛みが高い傾向があります</p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400">データが3件以上あると計算できます</p>
                                    )}
                                </div>

                                {/* 気象との相関 */}
                                {hasWeatherCorr && (
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 mb-1">気象との相関</p>
                                        <div className="space-y-1">
                                            {weatherCorr.map(({ key, label, r, n }) => {
                                                if (r === null) { return null; }
                                                return (
                                                    <div key={key} className="flex items-center gap-2 text-sm">
                                                        <span className="text-gray-500 w-10">{label}</span>
                                                        <span className={`font-mono font-bold ${correlationColor(r)}`}>
                                                            {r >= 0 ? '+' : ''}{r.toFixed(2)}
                                                        </span>
                                                        <span className={`text-xs ${correlationColor(r)}`}>
                                                            {correlationLabel(r)}
                                                        </span>
                                                        <span className="text-xs text-gray-300 ml-auto">{n}件</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <p className="text-xs text-gray-300 mt-1">r: ピアソン相関係数（-1〜+1）</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    ComposedChart, Line, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { ACTIVITY_LEVELS, GRAPH_LINE_COLORS } from '@/lib/constants';

// ── 型定義 ────────────────────────────────────────────────────────

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

// ── ユーティリティ ────────────────────────────────────────────────

const RANGE_LABELS: Record<string, string> = {
    today: '今日', '7d': '7日間', '30d': '30日間', all: '全期間',
};

function formatDT(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

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
    const dir = 0 <= r ? '正' : '負';
    if (abs < 0.2) { return 'ほぼ相関なし'; }
    if (abs < 0.4) { return `弱い${dir}の相関`; }
    if (abs < 0.7) { return `中程度の${dir}の相関`; }
    return `強い${dir}の相関`;
}

function meanPain(rec: PainRecord): number | null {
    if (rec.painEntries.length === 0) { return null; }
    return rec.painEntries.reduce((s, e) => s + e.level, 0) / rec.painEntries.length;
}

function linearRegression(points: { t: number; y: number }[]): { slope: number; r2: number } | null {
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
    return { slope, r2: Math.round(r2 * 100) / 100 };
}

// ── メインコンテンツ ──────────────────────────────────────────────

function PrintPreviewContent() {
    const searchParams = useSearchParams();
    const { data: session } = useSession();
    const range = searchParams.get('range') ?? '7d';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const [records, setRecords] = useState<PainRecord[]>([]);
    const [painTypes, setPainTypes] = useState<PainType[]>([]);
    const [loading, setLoading] = useState(true);

    const rangeLabel = startDate && endDate
        ? `${startDate} 〜 ${endDate}`
        : (RANGE_LABELS[range] ?? range);

    useEffect(() => {
        const url = startDate && endDate
            ? `/api/records?startDate=${startDate}&endDate=${endDate}`
            : `/api/records?range=${range}`;
        fetch(url)
            .then((r) => r.json())
            .then(({ records: recs, painTypes: pts }) => {
                setRecords(recs);
                setPainTypes(pts);
            })
            .finally(() => setLoading(false));
    }, [range, startDate, endDate]);

    // ── グラフ用データ ──────────────────────────────────────────

    const colorMap = new Map(
        painTypes.map((pt, i) => [pt.id, GRAPH_LINE_COLORS[i % GRAPH_LINE_COLORS.length]])
    );

    const chartData = records.map((rec) => {
        const point: Record<string, string | number | null> = {
            time: formatDate(rec.recordedAt),
            活動量: rec.activityLevel,
        };
        rec.painEntries.forEach((e) => { point[e.painType.name] = e.level; });
        return point;
    });

    const tempHumData = records.map((rec) => ({
        time: formatDate(rec.recordedAt),
        気温: rec.temperature,
        湿度: rec.humidity,
    }));

    const pressureData = records.map((rec) => ({
        time: formatDate(rec.recordedAt),
        気圧: rec.pressure,
    }));

    const hasTempHum = records.some((rec) => rec.temperature !== null || rec.humidity !== null);
    const hasPressure = records.some((rec) => rec.pressure !== null);

    // ── 統計 ────────────────────────────────────────────────────

    // タイプ別 平均・最小・最大・件数・推移
    const statsByType = painTypes.map((pt) => {
        const levels = records.flatMap((rec) =>
            rec.painEntries.filter((e) => e.painTypeId === pt.id).map((e) => e.level)
        );
        if (levels.length === 0) { return { id: pt.id, name: pt.name, avg: null, min: null, max: null, count: 0, trend: null }; }
        const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
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
        return { id: pt.id, name: pt.name, avg, min: Math.min(...levels), max: Math.max(...levels), count: levels.length, trend: linearRegression(points) };
    });

    // 日別平均
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
        if (worstDay === null || worstDay.avg < avg) {
            worstDay = { date, avg: Math.round(avg * 10) / 10 };
        }
        if (bestDay === null || bestDay.avg > avg) {
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

    // 活動量の分布
    const maxActivityCount = Math.max(1, ...ACTIVITY_LEVELS.map((a) => records.filter((rec) => rec.activityLevel === a.value).length));
    const activityDist = ACTIVITY_LEVELS.map((a) => ({
        value: a.value,
        label: a.label,
        count: records.filter((rec) => rec.activityLevel === a.value).length,
    }));

    // 相関
    const actXs: number[] = [];
    const actYs: number[] = [];
    records.forEach((rec) => {
        const mp = meanPain(rec);
        if (mp !== null) { actXs.push(rec.activityLevel); actYs.push(mp); }
    });
    const actCorr = pearson(actXs, actYs);

    type WKey = 'temperature' | 'humidity' | 'pressure';
    const weatherMeta: { key: WKey; label: string; unit: string }[] = [
        { key: 'temperature', label: '気温', unit: '°C' },
        { key: 'humidity', label: '湿度', unit: '%' },
        { key: 'pressure', label: '気圧', unit: 'hPa' },
    ];
    const weatherCorr = weatherMeta.map(({ key, label, unit }) => {
        const pairs = records
            .map((rec) => ({ w: rec[key], p: meanPain(rec) }))
            .filter((x): x is { w: number; p: number } => x.w !== null && x.p !== null);
        return { label, unit, r: pearson(pairs.map((x) => x.w), pairs.map((x) => x.p)), n: pairs.length };
    });
    const hasWeatherCorr = weatherCorr.some((w) => w.r !== null);

    // ── レンダリング ──────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-white">
            <style>{`
                @page { size: landscape; margin: 8mm; }
                @media print {
                    .no-print { display: none !important; }
                    body { font-size: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .print-section { page-break-inside: avoid; }
                    .print-page-break { page-break-before: always; }
                    .overflow-x-auto { overflow: visible !important; }
                    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                    tr { page-break-inside: avoid; }
                    th, td { border: 1px solid #d1d5db !important; padding: 2px 4px !important; white-space: normal !important; word-break: break-word; }
                    .col-dt { width: 11%; }
                    .col-act { width: 14%; }
                    .col-weather { width: 5%; }
                    .col-pain { width: 7%; }
                    .col-comment { width: auto; }
                }
            `}</style>

            {/* 操作バー（印刷時は非表示） */}
            <div className="no-print flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-gray-50">
                <button
                    onClick={() => window.history.back()}
                    className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
                >
                    ← 戻る
                </button>
                <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
                    disabled={loading}
                >
                    印刷 / PDF保存
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64 text-gray-400">読み込み中...</div>
            ) : (
                <div className="px-6 py-6 max-w-5xl mx-auto space-y-8">

                    {/* ヘッダー */}
                    <div className="print-section">
                        <h1 className="text-2xl font-bold text-gray-900">痛み記録レポート</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            期間: {rangeLabel}　／　出力日時: {formatDT(new Date().toISOString())}
                        </p>
                        {session?.user?.name && (
                            <p className="text-sm text-gray-500">{session.user.name} さん　／　{records.length} 件</p>
                        )}
                    </div>

                    {records.length === 0 ? (
                        <p className="text-gray-400">この期間のデータがありません</p>
                    ) : (
                        <>
                            {/* 痛みグラフ */}
                            <div className="print-section">
                                <h2 className="text-base font-semibold text-gray-700 mb-2">痛みレベル・活動量</h2>
                                <p className="text-xs text-gray-400 mb-1">痛みレベル (左軸: 0〜9) / 活動量 (右軸: 0〜6)</p>
                                <ResponsiveContainer width="100%" height={240}>
                                    <ComposedChart data={chartData} margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                                        <YAxis yAxisId="pain" domain={[0, 9]} tick={{ fontSize: 10 }} />
                                        <YAxis yAxisId="activity" orientation="right" domain={[0, 6]} tick={{ fontSize: 10 }} />
                                        <Tooltip
                                            formatter={(value: number, name: string) => {
                                                if (name === '活動量') { return [ACTIVITY_LEVELS[value]?.label ?? value, name]; }
                                                return [value, name];
                                            }}
                                        />
                                        <Legend />
                                        {painTypes.map((pt) => (
                                            <Line
                                                key={pt.id}
                                                yAxisId="pain"
                                                type="monotone"
                                                dataKey={pt.name}
                                                stroke={colorMap.get(pt.id) ?? '#ccc'}
                                                strokeWidth={2}
                                                dot={{ r: 3 }}
                                                connectNulls
                                            />
                                        ))}
                                        <Bar yAxisId="activity" dataKey="活動量" fill="#93c5fd" opacity={0.5} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>

                            {/* 気温・湿度グラフ */}
                            {hasTempHum && (
                                <div className="print-section">
                                    <h2 className="text-base font-semibold text-gray-700 mb-2">気温・湿度</h2>
                                    <p className="text-xs text-gray-400 mb-1">気温 °C (左軸) / 湿度 % (右軸: 0〜100)</p>
                                    <ResponsiveContainer width="100%" height={160}>
                                        <ComposedChart data={tempHumData} margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                                            <YAxis yAxisId="temp" tick={{ fontSize: 10 }} unit="°" />
                                            <YAxis yAxisId="hum" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                                            <Tooltip
                                                formatter={(value: number, name: string) => {
                                                    if (name === '気温') { return [`${value} °C`, name]; }
                                                    if (name === '湿度') { return [`${value} %`, name]; }
                                                    return [value, name];
                                                }}
                                            />
                                            <Legend />
                                            <Line yAxisId="temp" type="monotone" dataKey="気温" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                                            <Line yAxisId="hum" type="monotone" dataKey="湿度" stroke="#22d3ee" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* 気圧グラフ */}
                            {hasPressure && (
                                <div className="print-section">
                                    <h2 className="text-base font-semibold text-gray-700 mb-2">気圧</h2>
                                    <p className="text-xs text-gray-400 mb-1">気圧 hPa</p>
                                    <ResponsiveContainer width="100%" height={130}>
                                        <ComposedChart data={pressureData} margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                                            <YAxis tick={{ fontSize: 10 }} unit=" hPa" width={60} />
                                            <Tooltip formatter={(value: number) => [`${value} hPa`, '気圧']} />
                                            <Legend />
                                            <Line type="monotone" dataKey="気圧" stroke="#a78bfa" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* 統計サマリー */}
                            <div className="print-section space-y-4">
                                <h2 className="text-base font-semibold text-gray-700">統計サマリー</h2>

                                {/* 期間サマリー */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                                        <p className="text-xl font-bold text-blue-500">{records.length}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">総記録数</p>
                                    </div>
                                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                                        <p className="text-xl font-bold text-blue-500">{recordedDayCount}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">記録した日数</p>
                                    </div>
                                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                                        <p className="text-xl font-bold text-blue-500">
                                            {spanDays !== null ? (records.length / spanDays).toFixed(1) : '—'}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">平均記録/日</p>
                                    </div>
                                </div>

                                {/* タイプ別統計テーブル */}
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">痛みタイプ別 統計・推移</h3>
                                    <table className="w-full text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-gray-200">
                                                <th className="border border-gray-300 px-2 py-1 text-left">タイプ</th>
                                                <th className="border border-gray-300 px-2 py-1 text-center">件数</th>
                                                <th className="border border-gray-300 px-2 py-1 text-center">平均</th>
                                                <th className="border border-gray-300 px-2 py-1 text-center">最小</th>
                                                <th className="border border-gray-300 px-2 py-1 text-center">最大</th>
                                                <th className="border border-gray-300 px-2 py-1 text-center">傾向</th>
                                                <th className="border border-gray-300 px-2 py-1 text-center">傾き/日</th>
                                                <th className="border border-gray-300 px-2 py-1 text-center">R²</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {statsByType.map(({ id, name, avg, min, max, count, trend }) => {
                                                const color = colorMap.get(id) ?? '#ccc';
                                                return (
                                                    <tr key={id}>
                                                        <td className="border border-gray-300 px-2 py-1 font-medium" style={{ color }}>{name}</td>
                                                        <td className="border border-gray-300 px-2 py-1 text-center text-gray-600">{count}</td>
                                                        <td className="border border-gray-300 px-2 py-1 text-center font-mono">{avg !== null ? avg.toFixed(1) : '—'}</td>
                                                        <td className="border border-gray-300 px-2 py-1 text-center text-blue-500 font-mono">{min ?? '—'}</td>
                                                        <td className="border border-gray-300 px-2 py-1 text-center text-red-400 font-mono">{max ?? '—'}</td>
                                                        <td className="border border-gray-300 px-2 py-1 text-center">
                                                            {trend === null ? '—' : trend.slope < -0.05 ? '改善↓' : trend.slope > 0.05 ? '悪化↑' : '横ばい→'}
                                                        </td>
                                                        <td className="border border-gray-300 px-2 py-1 text-center font-mono text-gray-600">
                                                            {trend !== null ? `${0 <= trend.slope ? '+' : ''}${trend.slope.toFixed(3)}` : '—'}
                                                        </td>
                                                        <td className="border border-gray-300 px-2 py-1 text-center font-mono text-gray-600">
                                                            {trend !== null ? trend.r2.toFixed(2) : '—'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    <p className="text-xs text-gray-400 mt-1">傾き: 1日あたりの痛みレベル変化　R²: 傾向の信頼度（1に近いほど明確）</p>
                                </div>

                                {/* 最良・最悪の日 / 相関 */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-red-50 rounded-lg p-3">
                                                <p className="text-xs font-medium text-gray-500 mb-1">最も痛みが強かった日</p>
                                                {worstDay !== null ? (
                                                    <>
                                                        <p className="font-semibold text-red-500">{worstDay.date}</p>
                                                        <p className="text-xs text-gray-500">平均 {worstDay.avg} / 9</p>
                                                    </>
                                                ) : <p className="text-xs text-gray-400">データなし</p>}
                                            </div>
                                            <div className="bg-green-50 rounded-lg p-3">
                                                <p className="text-xs font-medium text-gray-500 mb-1">最も楽だった日</p>
                                                {bestDay !== null ? (
                                                    <>
                                                        <p className="font-semibold text-green-600">{bestDay.date}</p>
                                                        <p className="text-xs text-gray-500">平均 {bestDay.avg} / 9</p>
                                                    </>
                                                ) : <p className="text-xs text-gray-400">データなし</p>}
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="text-xs font-medium text-gray-700 mb-2">活動量の分布</p>
                                            <div className="space-y-1">
                                                {activityDist.filter((a) => a.count > 0).map((a) => (
                                                    <div key={a.value} className="flex items-center gap-2">
                                                        <span className="font-mono text-xs text-blue-500 w-3 shrink-0">{a.value}</span>
                                                        <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                                                            <div className="h-full bg-blue-300 rounded-full" style={{ width: `${(a.count / maxActivityCount) * 100}%` }} />
                                                        </div>
                                                        <span className="text-xs text-gray-400 w-4 text-right shrink-0">{a.count}</span>
                                                        <span className="text-xs text-gray-400 shrink-0">{a.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="text-xs font-medium text-gray-700 mb-2">活動量との相関</p>
                                            {actCorr !== null ? (
                                                <p className="text-sm">
                                                    <span className="font-mono font-bold text-gray-800">r = {0 <= actCorr ? '+' : ''}{actCorr.toFixed(2)}</span>
                                                    <span className="text-xs text-gray-500 ml-2">{correlationLabel(actCorr)}</span>
                                                </p>
                                            ) : (
                                                <p className="text-xs text-gray-400">データが3件以上必要</p>
                                            )}
                                        </div>
                                        {hasWeatherCorr && (
                                            <div className="bg-gray-50 rounded-lg p-3">
                                                <p className="text-xs font-medium text-gray-700 mb-2">気象と痛みの相関</p>
                                                <div className="space-y-1.5">
                                                    {weatherCorr.map(({ label, unit, r, n }) => {
                                                        if (r === null) { return null; }
                                                        return (
                                                            <div key={label} className="text-xs flex items-center gap-2">
                                                                <span className="text-gray-500 w-8">{label}</span>
                                                                <span className="font-mono font-bold text-gray-800">{0 <= r ? '+' : ''}{r.toFixed(2)}</span>
                                                                <span className="text-gray-400">{correlationLabel(r)}</span>
                                                                <span className="text-gray-300 ml-auto">({n}件)</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <p className="text-xs text-gray-300 mt-1">r: ピアソン相関係数</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* データテーブル */}
                            <div className="print-page-break">
                                <h2 className="text-base font-semibold text-gray-700 mb-3">記録一覧</h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border-collapse">
                                        <colgroup>
                                            <col className="col-dt" />
                                            <col className="col-act" />
                                            <col className="col-weather" />
                                            <col className="col-weather" />
                                            <col className="col-weather" />
                                            {painTypes.map((pt) => <col key={pt.id} className="col-pain" />)}
                                            <col className="col-comment" />
                                        </colgroup>
                                        <thead>
                                            <tr className="bg-gray-100">
                                                <th className="border border-gray-300 px-3 py-2 text-left">日時</th>
                                                <th className="border border-gray-300 px-3 py-2 text-left">活動量</th>
                                                <th className="border border-gray-300 px-3 py-2 text-center">気温(°C)</th>
                                                <th className="border border-gray-300 px-3 py-2 text-center">湿度(%)</th>
                                                <th className="border border-gray-300 px-3 py-2 text-center">気圧(hPa)</th>
                                                {painTypes.map((pt) => (
                                                    <th key={pt.id} className="border border-gray-300 px-3 py-2 text-center">{pt.name}</th>
                                                ))}
                                                <th className="border border-gray-300 px-3 py-2 text-left">コメント</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {records.map((rec, i) => (
                                                <tr key={rec.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="border border-gray-300 px-3 py-2">{formatDT(rec.recordedAt)}</td>
                                                    <td className="border border-gray-300 px-3 py-2 text-xs">
                                                        {rec.activityLevel}　{ACTIVITY_LEVELS.find((a) => a.value === rec.activityLevel)?.label}
                                                    </td>
                                                    <td className="border border-gray-300 px-3 py-2 text-center">{rec.temperature ?? '—'}</td>
                                                    <td className="border border-gray-300 px-3 py-2 text-center">{rec.humidity ?? '—'}</td>
                                                    <td className="border border-gray-300 px-3 py-2 text-center">{rec.pressure ?? '—'}</td>
                                                    {painTypes.map((pt) => {
                                                        const entry = rec.painEntries.find((e) => e.painTypeId === pt.id);
                                                        return (
                                                            <td key={pt.id} className="border border-gray-300 px-3 py-2 text-center">
                                                                {entry?.level ?? '—'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="border border-gray-300 px-3 py-2">{rec.comment}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default function PrintPreviewPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">読み込み中...</div>}>
            <PrintPreviewContent />
        </Suspense>
    );
}

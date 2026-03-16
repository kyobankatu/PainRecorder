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

function formatDate(iso: string): string {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

function downloadCsv(records: PainRecord[], painTypes: PainType[], range: Range) {
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

/** レコードの全痛みエントリの平均値 */
function meanPain(rec: PainRecord): number | null {
    if (rec.painEntries.length === 0) { return null; }
    return rec.painEntries.reduce((s, e) => s + e.level, 0) / rec.painEntries.length;
}

export default function PainGraph() {
    const [range, setRange] = useState<Range>('7d');
    const [painTypes, setPainTypes] = useState<PainType[]>([]);
    const [records, setRecords] = useState<PainRecord[]>([]);
    const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [showReport, setShowReport] = useState(false);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/records?range=${range}`)
            .then((r) => r.json())
            .then(({ records: recs, painTypes: pts }: { records: PainRecord[]; painTypes: PainType[] }) => {
                setRecords(recs);
                setPainTypes(pts);
                setVisibleTypes(new Set(pts.map((p) => p.id)));
            })
            .finally(() => setLoading(false));
    }, [range]);

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

    // タイプ別平均痛みレベル
    const avgByType = painTypes.map((pt) => {
        const levels = records.flatMap((rec) =>
            rec.painEntries.filter((e) => e.painTypeId === pt.id).map((e) => e.level)
        );
        const avg = levels.length === 0 ? null : levels.reduce((a, b) => a + b, 0) / levels.length;
        return { id: pt.id, name: pt.name, avg };
    });

    // 最も痛みが強かった日
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
    painByDate.forEach((vals, date) => {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        if (worstDay === null || avg > worstDay.avg) {
            worstDay = { date, avg: Math.round(avg * 10) / 10 };
        }
    });

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
                {!loading && records.length > 0 && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => downloadCsv(records, painTypes, range)}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            CSVダウンロード
                        </button>
                        <a
                            href={`/print-preview?range=${range}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            印刷・PDF
                        </a>
                    </div>
                )}
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
                                    <YAxis tick={{ fontSize: 11 }} unit=" hPa" width={60} />
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
                            <span>傾向レポート（{RANGE_LABELS[range]}）</span>
                            <span className="text-gray-400 text-xs">{showReport ? '▲ 閉じる' : '▼ 開く'}</span>
                        </button>

                        {showReport && (
                            <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
                                {/* タイプ別平均 */}
                                <div>
                                    <p className="text-xs font-medium text-gray-500 mt-3 mb-2">痛みタイプ別 平均レベル</p>
                                    {avgByType.length === 0 ? (
                                        <p className="text-xs text-gray-400">データなし</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {avgByType.map(({ id, name, avg }) => {
                                                const color = colorMap.get(id) ?? '#ccc';
                                                const pct = avg !== null ? (avg / 9) * 100 : 0;
                                                return (
                                                    <div key={id}>
                                                        <div className="flex items-center justify-between text-sm mb-0.5">
                                                            <span className="text-gray-700">{name}</span>
                                                            <span className="font-mono font-semibold" style={{ color }}>
                                                                {avg !== null ? avg.toFixed(1) : '—'} / 9
                                                            </span>
                                                        </div>
                                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full transition-all"
                                                                style={{ width: `${pct}%`, backgroundColor: color }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* 最も痛みが強かった日 */}
                                <div>
                                    <p className="text-xs font-medium text-gray-500 mb-1">最も痛みが強かった日</p>
                                    {worstDay !== null ? (
                                        <p className="text-sm text-gray-800">
                                            <span className="font-semibold text-red-500">{worstDay.date}</span>
                                            <span className="text-gray-500 ml-2">（平均痛みレベル {worstDay.avg}）</span>
                                        </p>
                                    ) : (
                                        <p className="text-xs text-gray-400">データなし</p>
                                    )}
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
                                            {weatherCorr.map(({ key, label, unit, r, n }) => {
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

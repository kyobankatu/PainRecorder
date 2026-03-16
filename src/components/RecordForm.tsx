'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PainLevelPicker from './PainLevelPicker';
import ActivityPicker from './ActivityPicker';

interface PainType {
    id: string;
    name: string;
}

interface InitialData {
    activityLevel: number;
    comment: string;
    recordedAt: string;
    painLevels: Record<string, number>;
}

interface Props {
    recordId?: string;
    initialData?: InitialData;
}

function toLocalDateTimeString(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
}

interface ApiWeather {
    temperature: number | null;
    humidity: number | null;
    pressure: number | null;
}

type FieldMode = 'auto' | 'manual' | null;

const WEATHER_FIELDS = [
    { key: 'temperature' as const, label: '気温', unit: '°C', step: '0.1', width: 'w-24', placeholder: '例: 22.5' },
    { key: 'humidity' as const, label: '湿度', unit: '%', step: '1', width: 'w-20', placeholder: '例: 55' },
    { key: 'pressure' as const, label: '気圧', unit: 'hPa', step: '0.1', width: 'w-28', placeholder: '例: 1013.2' },
];

export default function RecordForm({ recordId, initialData }: Props) {
    const router = useRouter();
    const [painTypes, setPainTypes] = useState<PainType[]>([]);
    const [activityLevel, setActivityLevel] = useState(initialData?.activityLevel ?? 3);
    const [painLevels, setPainLevels] = useState<Record<string, number>>({});
    const [comment, setComment] = useState(initialData?.comment ?? '');
    const [recordedAt, setRecordedAt] = useState(initialData?.recordedAt ?? toLocalDateTimeString(new Date()));
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const [apiWeather, setApiWeather] = useState<ApiWeather | null>(null);
    const [apiFetching, setApiFetching] = useState(false);
    const [apiError, setApiError] = useState('');
    const [tempMode, setTempMode] = useState<FieldMode>(null);
    const [humidityMode, setHumidityMode] = useState<FieldMode>(null);
    const [pressureMode, setPressureMode] = useState<FieldMode>(null);
    const [manualTemp, setManualTemp] = useState('');
    const [manualHumidity, setManualHumidity] = useState('');
    const [manualPressure, setManualPressure] = useState('');
    const [copying, setCopying] = useState(false);

    useEffect(() => {
        fetch('/api/pain-types')
            .then((r) => r.json())
            .then((data: PainType[]) => {
                setPainTypes(data);
                const initial: Record<string, number> = {};
                data.forEach((pt) => { initial[pt.id] = initialData?.painLevels[pt.id] ?? 0; });
                setPainLevels(initial);
            });
    }, []);

    const fetchApi = useCallback((force = false) => {
        if (!force && apiWeather !== null) {
            return;
        }
        setApiError('');
        if (!navigator.geolocation) {
            setApiError('位置情報が利用できません');
            return;
        }
        setApiFetching(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,surface_pressure`
                )
                    .then((r) => r.json())
                    .then((data) => {
                        const current = data?.current;
                        if (current) {
                            setApiWeather({
                                temperature: current.temperature_2m ?? null,
                                humidity: current.relative_humidity_2m ?? null,
                                pressure: current.surface_pressure ?? null,
                            });
                        }
                    })
                    .catch(() => { setApiError('気象データの取得に失敗しました'); })
                    .finally(() => { setApiFetching(false); });
            },
            () => {
                setApiError('位置情報の取得を許可してください');
                setApiFetching(false);
            }
        );
    }, [apiWeather]);

    async function handleCopyLast() {
        setCopying(true);
        try {
            const res = await fetch('/api/records/latest');
            const rec = await res.json();
            if (!rec) { return; }
            setActivityLevel(rec.activityLevel);
            setPainLevels((prev) => {
                const next = { ...prev };
                rec.painEntries.forEach((e: { painTypeId: string; level: number }) => {
                    next[e.painTypeId] = e.level;
                });
                return next;
            });
        } finally {
            setCopying(false);
        }
    }

    function setFieldMode(field: 'temperature' | 'humidity' | 'pressure', mode: FieldMode) {
        if (field === 'temperature') { setTempMode(mode); }
        if (field === 'humidity') { setHumidityMode(mode); }
        if (field === 'pressure') { setPressureMode(mode); }
        if (mode === 'auto') {
            fetchApi();
        }
    }

    function getFieldMode(field: 'temperature' | 'humidity' | 'pressure'): FieldMode {
        if (field === 'temperature') { return tempMode; }
        if (field === 'humidity') { return humidityMode; }
        return pressureMode;
    }

    function getManualValue(field: 'temperature' | 'humidity' | 'pressure'): string {
        if (field === 'temperature') { return manualTemp; }
        if (field === 'humidity') { return manualHumidity; }
        return manualPressure;
    }

    function setManualValue(field: 'temperature' | 'humidity' | 'pressure', value: string) {
        if (field === 'temperature') { setManualTemp(value); }
        else if (field === 'humidity') { setManualHumidity(value); }
        else { setManualPressure(value); }
    }

    function resolveWeatherValue(field: 'temperature' | 'humidity' | 'pressure'): number | null {
        const mode = getFieldMode(field);
        if (mode === 'auto') {
            return apiWeather?.[field] ?? null;
        }
        if (mode === 'manual') {
            const raw = getManualValue(field);
            return raw === '' ? null : Number(raw);
        }
        return null;
    }

    const anyAutoField = tempMode === 'auto' || humidityMode === 'auto' || pressureMode === 'auto';

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        const painEntries = Object.entries(painLevels).map(([painTypeId, level]) => ({
            painTypeId,
            level,
        }));

        const temperature = resolveWeatherValue('temperature');
        const humidity = resolveWeatherValue('humidity');
        const pressure = resolveWeatherValue('pressure');

        try {
            const res = await fetch(recordId ? `/api/records/${recordId}` : '/api/records', {
                method: recordId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activityLevel, comment, recordedAt, painEntries, temperature, humidity, pressure }),
            });
            if (!res.ok) {
                const data = await res.json();
                setError(data.error ?? '記録に失敗しました');
                return;
            }
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                router.push('/dashboard');
            }, 1500);
        } finally {
            setSubmitting(false);
        }
    }

    if (painTypes.length === 0) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
                <p className="text-yellow-800 font-medium">痛みの種類が登録されていません</p>
                <p className="text-yellow-600 text-sm mt-1">
                    設定ページで痛みの種類を追加してください
                </p>
                <a
                    href="/settings"
                    className="mt-4 inline-block bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                    設定へ
                </a>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {!recordId && (
                <button
                    type="button"
                    onClick={handleCopyLast}
                    disabled={copying}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-blue-300 text-blue-500 hover:bg-blue-50 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                    {copying ? '読み込み中...' : '前回の記録をコピーして入力'}
                </button>
            )}

            <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">記録日時</label>
                    <input
                        type="datetime-local"
                        value={recordedAt}
                        onChange={(e) => setRecordedAt(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <ActivityPicker value={activityLevel} onChange={setActivityLevel} />
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5 space-y-5">
                <h2 className="font-semibold text-gray-800">痛みレベル</h2>
                {painTypes.map((pt) => (
                    <PainLevelPicker
                        key={pt.id}
                        label={pt.name}
                        value={painLevels[pt.id] ?? 0}
                        onChange={(v) => setPainLevels((prev) => ({ ...prev, [pt.id]: v }))}
                    />
                ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-gray-800">気象データ（任意）</h2>
                    {anyAutoField && apiWeather !== null && (
                        <button
                            type="button"
                            onClick={() => fetchApi(true)}
                            disabled={apiFetching}
                            className="text-xs text-blue-500 hover:text-blue-700 disabled:text-gray-300"
                        >
                            再取得
                        </button>
                    )}
                </div>

                {apiError && <p className="text-red-500 text-xs">{apiError}</p>}

                <div className="space-y-3">
                    {WEATHER_FIELDS.map(({ key, label, unit, step, width, placeholder }) => {
                        const mode = getFieldMode(key);
                        return (
                            <div key={key} className="flex items-center gap-3 flex-wrap">
                                <span className="text-sm text-gray-700 w-16 shrink-0">{label}</span>
                                <div className="flex gap-1">
                                    {(['auto', 'manual', null] as FieldMode[]).map((m) => (
                                        <button
                                            key={String(m)}
                                            type="button"
                                            onClick={() => setFieldMode(key, m)}
                                            className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                                                mode === m
                                                    ? 'bg-blue-500 text-white border-blue-500'
                                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            {m === 'auto' ? '自動' : m === 'manual' ? '手動' : 'なし'}
                                        </button>
                                    ))}
                                </div>
                                {mode === 'auto' && (
                                    <span className="text-sm text-gray-600">
                                        {apiFetching
                                            ? '取得中...'
                                            : apiWeather?.[key] !== null && apiWeather?.[key] !== undefined
                                                ? `${apiWeather[key]} ${unit}`
                                                : '—'
                                        }
                                    </span>
                                )}
                                {mode === 'manual' && (
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            step={step}
                                            value={getManualValue(key)}
                                            onChange={(e) => setManualValue(key, e.target.value)}
                                            className={`${width} border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                            placeholder={placeholder}
                                        />
                                        <span className="text-xs text-gray-400">{unit}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">コメント（任意）</label>
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="体調や状況のメモ..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            {success && (
                <p className="text-green-600 text-sm font-medium">記録しました！</p>
            )}

            <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium py-3 rounded-xl transition-colors text-lg"
            >
                {submitting ? '記録中...' : '記録する'}
            </button>
        </form>
    );
}

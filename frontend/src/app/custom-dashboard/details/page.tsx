'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ComposedChart, Legend, LabelList } from 'recharts';

interface CategoryData {
    monthly: { Month: string; 판매액: number; 이익률: number; 일평균매출: number }[];
    daily: { Date: string; 판매액: number; 이익률: number }[];
}

interface ComprehensiveData {
    ecommerce: CategoryData;
    offline: CategoryData;
    ecommerce_myb: CategoryData;
    ecommerce_nubi: CategoryData;
    ecommerce_sonreve: CategoryData;
    offline_myb: CategoryData;
    offline_nubi: CategoryData;
    offline_sonreve: CategoryData;
    main_overall: CategoryData;
    main_myb: CategoryData;
    main_nubi: CategoryData;
    main_sonreve: CategoryData;
    stain_ecommerce: CategoryData;
    stain_offline: CategoryData;
    stain_main: CategoryData;
    // Nubi
    nubi_longhandle_ecommerce: CategoryData; nubi_longhandle_offline: CategoryData; nubi_longhandle_main: CategoryData;
    nubi_stainless_ecommerce: CategoryData; nubi_stainless_offline: CategoryData; nubi_stainless_main: CategoryData;
    nubi_jungle_ecommerce: CategoryData; nubi_jungle_offline: CategoryData; nubi_jungle_main: CategoryData;
    nubi_spoon_ecommerce: CategoryData; nubi_spoon_offline: CategoryData; nubi_spoon_main: CategoryData;
    nubi_2in1_ecommerce: CategoryData; nubi_2in1_offline: CategoryData; nubi_2in1_main: CategoryData;
    nubi_ladybug_ecommerce: CategoryData; nubi_ladybug_offline: CategoryData; nubi_ladybug_main: CategoryData;
    nubi_pacifier_ecommerce: CategoryData; nubi_pacifier_offline: CategoryData; nubi_pacifier_main: CategoryData;
    // Sonreve
    sonreve_toneup_ecommerce: CategoryData; sonreve_toneup_offline: CategoryData; sonreve_toneup_main: CategoryData;
    sonreve_shampoo_ecommerce: CategoryData; sonreve_shampoo_offline: CategoryData; sonreve_shampoo_main: CategoryData;
    sonreve_cleanser_ecommerce: CategoryData; sonreve_cleanser_offline: CategoryData; sonreve_cleanser_main: CategoryData;
    sonreve_lotion_ecommerce: CategoryData; sonreve_lotion_offline: CategoryData; sonreve_lotion_main: CategoryData;
    [key: string]: CategoryData; // Allow dynamic category keys (mild_ecommerce, etc.)
}

const CustomLabel = (props: any) => {
    const { x, y, value, fill, formatter } = props;
    if (value === undefined || value === null) return null;
    return (
        <text
            x={x}
            y={y}
            dy={-10}
            fill={fill}
            fontSize={10}
            textAnchor="middle"
            fontWeight="bold"
        >
            {formatter ? formatter(value) : value}
        </text>
    );
};

const formatMillions = (value: any): string => {
    if (typeof value !== 'number') return String(value);
    if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
    if (value >= 10000) return `${(value / 10000).toFixed(0)}만`;
    return value.toLocaleString();
};

const formatPercent = (value: any): string => {
    if (typeof value !== 'number') return String(value);
    return `${value.toFixed(1)}%`;
};

const formatXAxisTick = (value: string, index: number) => {
    // YYYY-MM format (e.g., "2024-01")
    if (value.length === 7) {
        const year = value.substring(2, 4);
        const month = parseInt(value.substring(5, 7));
        // Show year only for January or first item (공백 제거)
        if (index === 0 || month === 1) {
            return `${year}'${month}`;
        }
        return `${month}`;
    }
    // Daily format YYYY-MM-DD
    if (value.length === 10) {
        return `${value.substring(5, 7)}.${value.substring(8, 10)}`;
    }
    return value;
};

// Reusable Dynamic Section Component
const DynamicAnalysisSection = ({ title, data, emoji, defaultMode = 'total' }: { title: string, data: CategoryData, emoji: string, defaultMode?: 'total' | 'avg' | 'daily' }) => {
    const [mode, setMode] = useState<'total' | 'avg' | 'daily'>(defaultMode as any);

    // Ensure data is not null/undefined to prevent crashes, but allow empty arrays
    const safeData = data || { monthly: [], daily: [] };

    const isDaily = mode === 'daily';
    // Use last 180 days for daily mode
    const chartData = isDaily ? safeData.daily.slice(-180) : safeData.monthly;

    return (
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-4 md:p-8 border border-slate-100 transition-all hover:shadow-2xl hover:shadow-slate-200/60 mt-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
                <h3 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight leading-tight">
                    {emoji} {title} 동적 매출 분석
                </h3>
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                    <button
                        onClick={() => setMode('total')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'total' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        월매출 (꺾은선)
                    </button>
                    <button
                        onClick={() => setMode('avg')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'avg' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        일평균 (꺾은선)
                    </button>
                    <button
                        onClick={() => setMode('daily')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'daily' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        일매출 (꺾은선)
                    </button>
                </div>
            </div>

            <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis
                            dataKey={isDaily ? "Date" : "Month"}
                            tickFormatter={(val, index) => isDaily ? val.split('-').slice(1).join('/') : formatXAxisTick(val, index)}
                            stroke="#94a3b8"
                            style={{ fontSize: '9px', fontWeight: 500 }}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                        />
                        <YAxis yAxisId="left" stroke="#94a3b8" style={{ fontSize: '9px', fontWeight: 600 }} tickFormatter={formatMillions} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" stroke="#ec4899" style={{ fontSize: '9px', fontWeight: 600 }} tickFormatter={formatPercent} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(val: any, name: any) => name === '이익률' ? [formatPercent(val), name] : [formatMillions(val), name]} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ddd', borderRadius: '8px', padding: '10px' }} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />

                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="판매액"
                            name={mode === 'total' ? "월매출액" : (mode === 'daily' ? "일매출액" : "일평균 매출")}
                            data={isDaily ? undefined : (mode === 'avg' ? chartData.map(d => ({ ...d, "판매액": (d as any).일평균매출 })) : undefined)}
                            stroke="#8b5cf6"
                            strokeWidth={isDaily ? 2 : 3}
                            dot={isDaily ? false : { fill: "#8b5cf6", r: 4 }}
                            activeDot={{ r: 6 }}
                        >
                            {!isDaily && <LabelList dataKey={mode === 'total' ? "판매액" : "일평균매출"} position="top" content={<CustomLabel fill="#8b5cf6" formatter={formatMillions} />} />}
                        </Line>

                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="이익률"
                            name="이익률"
                            stroke="#ec4899"
                            strokeWidth={isDaily ? 2 : 3}
                            dot={isDaily ? false : { fill: "#ec4899", r: 4 }}
                            activeDot={{ r: 6 }}
                            strokeDasharray="5 5"
                        >
                            {!isDaily && <LabelList dataKey="이익률" position="bottom" content={<CustomLabel fill="#ec4899" formatter={formatPercent} />} />}
                        </Line>
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

function DetailsContent() {
    const searchParams = useSearchParams();
    const filename = searchParams.get('filename');
    const [data, setData] = useState<ComprehensiveData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isProductAnalysisExpanded, setIsProductAnalysisExpanded] = useState(false);
    const [isNubiExpanded, setIsNubiExpanded] = useState(false);
    const [isSonreveExpanded, setIsSonreveExpanded] = useState(false);
    const type = searchParams.get('type') || 'ecommerce';
    const isOffline = type === 'offline';
    const isMain = type === 'main';

    useEffect(() => {
        if (!filename) return;
        const fetchData = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/dashboard/ecommerce-details`, { params: { filename } });
                setData(response.data);
            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        fetchData();
    }, [filename]);

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
        </div>
    );

    if (!data) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-xl font-bold text-slate-600">데이터를 불러올 수 없습니다.</div>
        </div>
    );

    const mainData = isOffline ? data.offline : (isMain ? data.main_overall : (data[type] || data.ecommerce));

    // Dynamic Title Logic
    let typeLabel = "이커머스";
    if (isOffline) typeLabel = "오프라인";
    else if (isMain) typeLabel = "이커머스 주력채널(쿠팡 제외)";
    else {
        const typeMap: Record<string, string> = {
            'coupang': '쿠팡(로켓)',
            'naver_zeze': '스팜(제제지크)',
            'naver_sonreve': '스팜(쏭레브)',
            '11st': '11st',
            'ebay': '이베이',
            'kakao': '카카오',
            'cj': 'CJ',
            'babybilly': '베이비빌리',
            // New Accounts
            'overseas': '해외',
            'emart': '이마트',
            'lotte': '롯데마트',
            'daiso': '다이소',
            'agency': '오프라인 대리점'
        };
        if (typeMap[type]) typeLabel = typeMap[type];
    }

    const brandPrefix = isMain ? "주력채널" : (isOffline ? "오프라인" : (type && type !== 'ecommerce' ? typeLabel : "이커머스"));

    // Function to get brand data dynamically
    const getBrandData = (brand: 'myb' | 'nubi' | 'sonreve') => {
        if (isOffline) return (data as any)[`offline_${brand}`];
        if (isMain) return (data as any)[`main_${brand}`];
        if (type && type !== 'ecommerce' && (data as any)[`${type}_${brand}`]) return (data as any)[`${type}_${brand}`];
        return (data as any)[`ecommerce_${brand}`]; // Default
    };

    // Prepare Merged Data for Brand Comparison Chart
    const comparisonData = mainData.monthly.map((m: any) => {
        const month = m.Month;
        const myb = getBrandData('myb')?.monthly.find((d: any) => d.Month === month)?.판매액 || 0;
        const nubi = getBrandData('nubi')?.monthly.find((d: any) => d.Month === month)?.판매액 || 0;
        const sonreve = getBrandData('sonreve')?.monthly.find((d: any) => d.Month === month)?.판매액 || 0;
        return {
            Month: month,
            [`${brandPrefix} 전체`]: m.판매액,
            "마이비": myb,
            "누비": nubi,
            "쏭레브": sonreve
        };

    });

    return (
        <div className="min-h-screen bg-slate-50 p-8 pb-32">
            <div className="max-w-7xl mx-auto space-y-12">
                <header className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">{typeLabel} 및 채널별 상세 분석 리포트</h1>
                        <p className="text-slate-500 mt-2 font-medium italic">데이터 기반 심층 성과 대시보드</p>
                    </div>
                    <button onClick={() => window.close()} className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 font-bold transition-all shadow-sm hover:shadow-md">
                        닫기
                    </button>
                </header>

                {/* 1. Dynamic Overall Analysis (Monthly/Daily) */}
                <DynamicAnalysisSection
                    title={`${typeLabel} 전체 매출 분석`}
                    emoji=""
                    data={mainData}
                    defaultMode="total"
                />

                {/* 2. Brand Monthly Comparison (Line) */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-4 md:p-8 border border-slate-100 transition-all hover:shadow-2xl hover:shadow-slate-200/60">
                    <h3 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight leading-tight mb-8">
                        {typeLabel} 브랜드별 월별 매출추이
                    </h3>
                    <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={comparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                <XAxis dataKey="Month" tickFormatter={formatXAxisTick} stroke="#94a3b8" style={{ fontSize: '9px', fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} interval={0} angle={-45} textAnchor="end" height={60} />
                                <YAxis stroke="#94a3b8" style={{ fontSize: '9px', fontWeight: 600 }} tickFormatter={formatMillions} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(val: any) => [formatMillions(val), '매출액']} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ddd', borderRadius: '8px', padding: '10px' }} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Line type="monotone" dataKey={`${isMain ? "주력채널" : typeLabel} 전체`} stroke="#8b5cf6" strokeWidth={3} dot={{ fill: "#8b5cf6", r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="마이비" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} />
                                <Line type="monotone" dataKey="누비" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 3 }} />
                                <Line type="monotone" dataKey="쏭레브" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Deep Analysis Section */}
                <div className="space-y-12">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                        <span className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </span>
                        채널 및 브랜드별 성과 분석
                    </h2>

                    <DynamicAnalysisSection title={`${brandPrefix} 마이비`} emoji="" data={getBrandData('myb') || mainData} />
                    <DynamicAnalysisSection title={`${brandPrefix} 누비`} emoji="" data={getBrandData('nubi') || mainData} />
                    <DynamicAnalysisSection title={`${brandPrefix} 쏭레브`} emoji="" data={getBrandData('sonreve') || mainData} />
                </div>

                <div className="pt-12 border-t border-slate-200 mt-12 transition-opacity duration-500 ease-in-out">
                    <button
                        onClick={() => setIsProductAnalysisExpanded(!isProductAnalysisExpanded)}
                        className="w-full flex items-center justify-between p-6 bg-white rounded-3xl border border-slate-200 shadow-lg hover:shadow-xl transition-all group"
                    >
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-4">
                            <span className="p-3 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-100 group-hover:scale-110 transition-transform">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a2 2 0 00-1.96 1.414l-.477 2.387a2 2 0 00.547 1.022l1.428 1.428a2 2 0 001.022.547l2.387.477a2 2 0 001.96-1.414l.477-2.387a2 2 0 00-.547-1.022l-1.428-1.428z" />
                                </svg>
                            </span>
                            마이비 품목별 분석
                            <span className="text-sm font-medium text-slate-400 ml-4 group-hover:text-emerald-500 transition-colors">
                                {isProductAnalysisExpanded ? "접기 ▲" : "펼쳐보기 ▼"}
                            </span>
                        </h2>
                    </button>

                    {isProductAnalysisExpanded && (
                        <div className="mt-8 space-y-12 animate-in fade-in slide-in-from-top-4 duration-500">
                            <DynamicAnalysisSection
                                title={`${brandPrefix} 얼룩제거제`}
                                emoji="✨"
                                data={(isOffline ? (data as any).stain_offline : (isMain ? (data as any).stain_main : (data as any)[`stain_${type || 'ecommerce'}`] || (data as any).stain_ecommerce)) || mainData}
                            />
                            <DynamicAnalysisSection
                                title={`${brandPrefix} 순한라인`}
                                emoji="✨"
                                data={(isOffline ? (data as any).mild_offline : (isMain ? (data as any).mild_main : (data as any)[`mild_${type || 'ecommerce'}`] || (data as any).mild_ecommerce)) || mainData}
                            />
                            <DynamicAnalysisSection
                                title={`${brandPrefix} 삶기세제`}
                                emoji="✨"
                                data={(isOffline ? (data as any).boil_offline : (isMain ? (data as any).boil_main : (data as any)[`boil_${type || 'ecommerce'}`] || (data as any).boil_ecommerce)) || mainData}
                            />
                            <DynamicAnalysisSection
                                title={`${brandPrefix} 건조기시트`}
                                emoji="✨"
                                data={(isOffline ? (data as any).dryer_offline : (isMain ? (data as any).dryer_main : (data as any)[`dryer_${type || 'ecommerce'}`] || (data as any).dryer_ecommerce)) || mainData}
                            />
                            <DynamicAnalysisSection
                                title={`${brandPrefix} 캡슐세제`}
                                emoji="✨"
                                data={(isOffline ? (data as any).capsule_offline : (isMain ? (data as any).capsule_main : (data as any)[`capsule_${type || 'ecommerce'}`] || (data as any).capsule_ecommerce)) || mainData}
                            />
                            <DynamicAnalysisSection
                                title={`${brandPrefix} 비건 고불소 치약`}
                                emoji="✨"
                                data={(isOffline ? (data as any).fluoride_offline : (isMain ? (data as any).fluoride_main : (data as any)[`fluoride_${type || 'ecommerce'}`] || (data as any).fluoride_ecommerce)) || mainData}
                            />
                            <DynamicAnalysisSection
                                title={`${brandPrefix} 구강티슈`}
                                emoji="✨"
                                data={(isOffline ? (data as any).oral_offline : (isMain ? (data as any).oral_main : (data as any)[`oral_${type || 'ecommerce'}`] || (data as any).oral_ecommerce)) || mainData}
                            />
                            <DynamicAnalysisSection
                                title={`${brandPrefix} 수유패드`}
                                emoji="✨"
                                data={(isOffline ? (data as any).pad_offline : (isMain ? (data as any).pad_main : (data as any)[`pad_${type || 'ecommerce'}`] || (data as any).pad_ecommerce)) || mainData}
                            />
                            <DynamicAnalysisSection
                                title={`${brandPrefix} 욕조클리너`}
                                emoji="✨"
                                data={(isOffline ? (data as any).bath_offline : (isMain ? (data as any).bath_main : (data as any)[`bath_${type || 'ecommerce'}`] || (data as any).bath_ecommerce)) || mainData}
                            />
                        </div>
                    )}
                </div>

                <div className="pt-12 border-t border-slate-200 mt-12 transition-opacity duration-500 ease-in-out">
                    <button
                        onClick={() => setIsNubiExpanded(!isNubiExpanded)}
                        className="w-full flex items-center justify-between p-6 bg-white rounded-3xl border border-slate-200 shadow-lg hover:shadow-xl transition-all group"
                    >
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-4">
                            <span className="p-3 bg-blue-500 rounded-2xl shadow-lg shadow-blue-100 group-hover:scale-110 transition-transform">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </span>
                            🍼 누비 품목별 분석
                            <span className="text-sm font-medium text-slate-400 ml-4 group-hover:text-blue-500 transition-colors">
                                {isNubiExpanded ? "접기 ▲" : "펼쳐보기 ▼"}
                            </span>
                        </h2>
                    </button>

                    {isNubiExpanded && (
                        <div className="mt-8 space-y-12 animate-in fade-in slide-in-from-top-4 duration-500">
                            <DynamicAnalysisSection title={`${typeLabel} 롱핸들`} emoji="🥄" data={(isOffline ? (data as any).nubi_longhandle_offline : (isMain ? (data as any).nubi_longhandle_main : (data as any)[`nubi_longhandle_${type || 'ecommerce'}`] || (data as any).nubi_longhandle_ecommerce)) || mainData} />
                            <DynamicAnalysisSection title={`${typeLabel} 스텐 물병`} emoji="💧" data={(isOffline ? (data as any).nubi_stainless_offline : (isMain ? (data as any).nubi_stainless_main : (data as any)[`nubi_stainless_${type || 'ecommerce'}`] || (data as any).nubi_stainless_ecommerce)) || mainData} />
                            <DynamicAnalysisSection title={`${typeLabel} 정글 물병`} emoji="🌴" data={(isOffline ? (data as any).nubi_jungle_offline : (isMain ? (data as any).nubi_jungle_main : (data as any)[`nubi_jungle_${type || 'ecommerce'}`] || (data as any).nubi_jungle_ecommerce)) || mainData} />
                            <DynamicAnalysisSection title={`${typeLabel} 3스텝 스푼`} emoji="🥄" data={(isOffline ? (data as any).nubi_spoon_offline : (isMain ? (data as any).nubi_spoon_main : (data as any)[`nubi_spoon_${type || 'ecommerce'}`] || (data as any).nubi_spoon_ecommerce)) || mainData} />
                            <DynamicAnalysisSection title={`${typeLabel} 2in1 컵`} emoji="🥤" data={(isOffline ? (data as any).nubi_2in1_offline : (isMain ? (data as any).nubi_2in1_main : (data as any)[`nubi_2in1_${type || 'ecommerce'}`] || (data as any).nubi_2in1_ecommerce)) || mainData} />
                            <DynamicAnalysisSection title={`${typeLabel} 무당벌레 빨대컵`} emoji="🐞" data={(isOffline ? (data as any).nubi_ladybug_offline : (isMain ? (data as any).nubi_ladybug_main : (data as any)[`nubi_ladybug_${type || 'ecommerce'}`] || (data as any).nubi_ladybug_ecommerce)) || mainData} />
                            <DynamicAnalysisSection title={`${typeLabel} 실리콘노리개`} emoji="👶" data={(isOffline ? (data as any).nubi_pacifier_offline : (isMain ? (data as any).nubi_pacifier_main : (data as any)[`nubi_pacifier_${type || 'ecommerce'}`] || (data as any).nubi_pacifier_ecommerce)) || mainData} />
                        </div>
                    )}
                </div>

                <div className="pt-12 border-t border-slate-200 mt-12 transition-opacity duration-500 ease-in-out">
                    <button
                        onClick={() => setIsSonreveExpanded(!isSonreveExpanded)}
                        className="w-full flex items-center justify-between p-6 bg-white rounded-3xl border border-slate-200 shadow-lg hover:shadow-xl transition-all group"
                    >
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-4">
                            <span className="p-3 bg-pink-500 rounded-2xl shadow-lg shadow-pink-100 group-hover:scale-110 transition-transform">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                </svg>
                            </span>
                            🧴 쏭레브 품목별 분석
                            <span className="text-sm font-medium text-slate-400 ml-4 group-hover:text-pink-500 transition-colors">
                                {isSonreveExpanded ? "접기 ▲" : "펼쳐보기 ▼"}
                            </span>
                        </h2>
                    </button>

                    {isSonreveExpanded && (
                        <div className="mt-8 space-y-12 animate-in fade-in slide-in-from-top-4 duration-500">
                            <DynamicAnalysisSection title={`${typeLabel} 톤업 크림`} emoji="✨" data={(isOffline ? (data as any).sonreve_toneup_offline : (isMain ? (data as any).sonreve_toneup_main : (data as any)[`sonreve_toneup_${type || 'ecommerce'}`] || (data as any).sonreve_toneup_ecommerce)) || mainData} />
                            <DynamicAnalysisSection title={`${typeLabel} 키즈 샴푸`} emoji="🧴" data={(isOffline ? (data as any).sonreve_shampoo_offline : (isMain ? (data as any).sonreve_shampoo_main : (data as any)[`sonreve_shampoo_${type || 'ecommerce'}`] || (data as any).sonreve_shampoo_ecommerce)) || mainData} />
                            <DynamicAnalysisSection title={`${typeLabel} 키즈 페이셜클렌저`} emoji="🧼" data={(isOffline ? (data as any).sonreve_cleanser_offline : (isMain ? (data as any).sonreve_cleanser_main : (data as any)[`sonreve_cleanser_${type || 'ecommerce'}`] || (data as any).sonreve_cleanser_ecommerce)) || mainData} />
                            <DynamicAnalysisSection title={`${typeLabel} 키즈 페이셜로션`} emoji="🧴" data={(isOffline ? (data as any).sonreve_lotion_offline : (isMain ? (data as any).sonreve_lotion_main : (data as any)[`sonreve_lotion_${type || 'ecommerce'}`] || (data as any).sonreve_lotion_ecommerce)) || mainData} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ComprehensiveDetailsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            </div>
        }>
            <DetailsContent />
        </Suspense>
    );
}

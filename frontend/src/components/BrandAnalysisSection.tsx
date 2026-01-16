import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';
import DynamicAnalysisSection, { CategoryData } from './DynamicAnalysisSection';

interface BrandAnalysisSectionProps {
    filename: string | null;
}

interface EcommerceDetailsData {
    [key: string]: any; // Allow dynamic keys
    total_myb: CategoryData;
    ecommerce_myb: CategoryData;
    offline_myb: CategoryData;

    total_nubi: CategoryData;
    ecommerce_nubi: CategoryData;
    offline_nubi: CategoryData;

    total_sonreve: CategoryData;
    ecommerce_sonreve: CategoryData;
    offline_sonreve: CategoryData;
}

const BrandAnalysisSection: React.FC<BrandAnalysisSectionProps> = ({ filename }) => {
    const [data, setData] = useState<EcommerceDetailsData | null>(null);
    const [loading, setLoading] = useState(false);

    // Toggle States
    const [isMybExpanded, setIsMybExpanded] = useState(false);
    const [isNubiExpanded, setIsNubiExpanded] = useState(false);
    const [isSonreveExpanded, setIsSonreveExpanded] = useState(false);

    // Date Range Filter State
    const [startMonth, setStartMonth] = useState<string>('');
    const [endMonth, setEndMonth] = useState<string>('');
    const [availableMonths, setAvailableMonths] = useState<string[]>([]);

    useEffect(() => {
        if (!filename) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`${API_BASE_URL}/api/dashboard/ecommerce-details`, { params: { filename } });
                setData(response.data);

                // Extract available months from MyBee Total (assuming it has representative data)
                // Format: YYYY-MM
                if (response.data.total_myb && response.data.total_myb.monthly) {
                    const months = response.data.total_myb.monthly.map((m: any) => m.Month);
                    const uniqueMonths = Array.from(new Set(months)) as string[];
                    uniqueMonths.sort();

                    setAvailableMonths(uniqueMonths);
                    if (uniqueMonths.length > 0) {
                        setStartMonth(uniqueMonths[0]);
                        setEndMonth(uniqueMonths[uniqueMonths.length - 1]);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch brand analysis data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [filename]);

    if (!filename) return null;

    if (loading && !data) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-slate-500 font-medium">품목별 데이터 불러오는 중...</span>
            </div>
        );
    }

    if (!data) return null;

    const renderSection = (title: string, emoji: string, keyPrefix: string) => {
        return (
            <DynamicAnalysisSection
                title={title}
                emoji={emoji}
                dataOptions={{
                    total: data[`${keyPrefix}_total`],
                    ecommerce: data[`${keyPrefix}_ecommerce`],
                    offline: data[`${keyPrefix}_offline`]
                }}
                startMonth={startMonth}
                endMonth={endMonth}
            />
        );
    };

    // Generalized helper for sub-categories (e.g., stain_total, stain_ecommerce, stain_offline)
    const renderCategory = (title: string, emoji: string, catKey: string) => {
        return (
            <DynamicAnalysisSection
                title={title}
                emoji={emoji}
                dataOptions={{
                    total: data[`${catKey}_total`],
                    ecommerce: data[`${catKey}_ecommerce`],
                    offline: data[`${catKey}_offline`]
                }}
                startMonth={startMonth}
                endMonth={endMonth}
            />
        );
    };

    return (
        <div className="space-y-8 mt-12 mb-12">

            {/* Global Date Range Selector */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-700">📅 조회 기간 설정</span>
                    <span className="text-sm text-slate-400 font-medium">(전체 브랜드 적용)</span>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <select
                        value={startMonth}
                        onChange={(e) => setStartMonth(e.target.value)}
                        className="bg-transparent text-sm font-bold text-slate-600 focus:outline-none p-1.5"
                    >
                        {availableMonths.map(m => (
                            <option key={`start-${m}`} value={m}>{m}</option>
                        ))}
                    </select>
                    <span className="text-slate-400 font-bold">~</span>
                    <select
                        value={endMonth}
                        onChange={(e) => setEndMonth(e.target.value)}
                        className="bg-transparent text-sm font-bold text-slate-600 focus:outline-none p-1.5"
                    >
                        {availableMonths.map(m => (
                            <option key={`end-${m}`} value={m}>{m}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* MyBee Toggle */}
            <div className="transition-opacity duration-500 ease-in-out">
                <button
                    onClick={() => setIsMybExpanded(!isMybExpanded)}
                    className="w-full flex items-center justify-between p-6 bg-white rounded-3xl border border-slate-200 shadow-lg hover:shadow-xl transition-all group"
                >
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-4">
                        <span className="p-3 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-100 group-hover:scale-110 transition-transform">
                            📦
                        </span>
                        마이비 품목별 분석
                        <span className="text-sm font-medium text-slate-400 ml-4 group-hover:text-emerald-500 transition-colors">
                            {isMybExpanded ? "접기 ▲" : "펼쳐보기 ▼"}
                        </span>
                    </h2>
                </button>

                {isMybExpanded && (
                    <div className="mt-8 space-y-12 animate-in fade-in slide-in-from-top-4 duration-500">
                        {/* Overall MyBee */}
                        <DynamicAnalysisSection
                            title="마이비 전체"
                            emoji="📦"
                            dataOptions={{
                                total: data.total_myb,
                                ecommerce: data.ecommerce_myb,
                                offline: data.offline_myb
                            }}
                            startMonth={startMonth}
                            endMonth={endMonth}
                        />

                        {renderCategory("얼룩제거제", "✨", "stain")}
                        {renderCategory("순한라인", "✨", "mild")}
                        {renderCategory("삶기세제", "✨", "boil")}
                        {renderCategory("건조기시트", "✨", "dryer")}
                        {renderCategory("캡슐세제", "✨", "capsule")}
                        {renderCategory("비건 고불소 치약", "✨", "fluoride")}
                        {renderCategory("구강티슈", "✨", "oral")}
                        {renderCategory("수유패드", "✨", "pad")}
                        {renderCategory("욕조클리너", "✨", "bath")}
                    </div>
                )}
            </div>

            {/* Nubi Toggle */}
            <div className="transition-opacity duration-500 ease-in-out">
                <button
                    onClick={() => setIsNubiExpanded(!isNubiExpanded)}
                    className="w-full flex items-center justify-between p-6 bg-white rounded-3xl border border-slate-200 shadow-lg hover:shadow-xl transition-all group"
                >
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-4">
                        <span className="p-3 bg-blue-500 rounded-2xl shadow-lg shadow-blue-100 group-hover:scale-110 transition-transform">
                            🍼
                        </span>
                        누비 품목별 분석
                        <span className="text-sm font-medium text-slate-400 ml-4 group-hover:text-blue-500 transition-colors">
                            {isNubiExpanded ? "접기 ▲" : "펼쳐보기 ▼"}
                        </span>
                    </h2>
                </button>

                {isNubiExpanded && (
                    <div className="mt-8 space-y-12 animate-in fade-in slide-in-from-top-4 duration-500">
                        {/* Overall Nubi */}
                        <DynamicAnalysisSection
                            title="누비 전체"
                            emoji="🍼"
                            dataOptions={{
                                total: data.total_nubi,
                                ecommerce: data.ecommerce_nubi,
                                offline: data.offline_nubi
                            }}
                            startMonth={startMonth}
                            endMonth={endMonth}
                        />
                        {renderCategory("롱핸들", "🥄", "nubi_longhandle")}
                        {renderCategory("스텐 물병", "💧", "nubi_stainless")}
                        {renderCategory("정글 물병", "🌴", "nubi_jungle")}
                        {renderCategory("3스텝 스푼", "🥄", "nubi_spoon")}
                        {renderCategory("2in1 컵", "🥤", "nubi_2in1")}
                        {renderCategory("무당벌레 빨대컵", "🐞", "nubi_ladybug")}
                        {renderCategory("실리콘노리개", "👶", "nubi_pacifier")}
                    </div>
                )}
            </div>

            {/* Sonreve Toggle */}
            <div className="transition-opacity duration-500 ease-in-out">
                <button
                    onClick={() => setIsSonreveExpanded(!isSonreveExpanded)}
                    className="w-full flex items-center justify-between p-6 bg-white rounded-3xl border border-slate-200 shadow-lg hover:shadow-xl transition-all group"
                >
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-4">
                        <span className="p-3 bg-pink-500 rounded-2xl shadow-lg shadow-pink-100 group-hover:scale-110 transition-transform">
                            🧴
                        </span>
                        쏭레브 품목별 분석
                        <span className="text-sm font-medium text-slate-400 ml-4 group-hover:text-pink-500 transition-colors">
                            {isSonreveExpanded ? "접기 ▲" : "펼쳐보기 ▼"}
                        </span>
                    </h2>
                </button>

                {isSonreveExpanded && (
                    <div className="mt-8 space-y-12 animate-in fade-in slide-in-from-top-4 duration-500">
                        {/* Overall Sonreve */}
                        <DynamicAnalysisSection
                            title="쏭레브 전체"
                            emoji="🧴"
                            dataOptions={{
                                total: data.total_sonreve,
                                ecommerce: data.ecommerce_sonreve,
                                offline: data.offline_sonreve
                            }}
                            startMonth={startMonth}
                            endMonth={endMonth}
                        />
                        {renderCategory("톤업 크림", "✨", "sonreve_toneup")}
                        {renderCategory("키즈 샴푸", "🧴", "sonreve_shampoo")}
                        {renderCategory("키즈 페이셜클렌저", "🧼", "sonreve_cleanser")}
                        {renderCategory("키즈 페이셜로션", "🧴", "sonreve_lotion")}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BrandAnalysisSection;

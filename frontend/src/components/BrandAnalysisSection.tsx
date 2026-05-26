import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';
import DynamicAnalysisSection, { CategoryData } from './DynamicAnalysisSection';
import { loadDashboardDate, saveDashboardDate } from '@/lib/dashboardDateStorage';

const CHART_ID = 'brand';

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

    // Global Channel State
    const [globalChannel, setGlobalChannel] = useState<'total' | 'ecommerce' | 'offline'>('total');

    // Handlers
    const handleExpandAll = () => {
        setIsMybExpanded(true);
        setIsNubiExpanded(true);
        setIsSonreveExpanded(true);
    };

    const handleCollapseAll = () => {
        setIsMybExpanded(false);
        setIsNubiExpanded(false);
        setIsSonreveExpanded(false);
    };

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
                        // 저장된 기간이 유효하면 복원, 아니면 전체 범위
                        const saved = await loadDashboardDate(CHART_ID);
                        if (saved && uniqueMonths.includes(saved.start) && uniqueMonths.includes(saved.end) && saved.start <= saved.end) {
                            setStartMonth(saved.start);
                            setEndMonth(saved.end);
                        } else {
                            setStartMonth(uniqueMonths[0]);
                            setEndMonth(uniqueMonths[uniqueMonths.length - 1]);
                        }
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
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-black border-t-transparent"></div>
                <span className="ml-3 text-[#5d5d5d] font-normal">품목별 데이터 불러오는 중...</span>
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
                    offline: data[`${keyPrefix}_offline`],
                    coupang: data[`coupang_${keyPrefix}`],
                    major: data[`main_${keyPrefix}`]
                }}
                startMonth={startMonth}
                endMonth={endMonth}
                defaultChannel={globalChannel}
                key={`${keyPrefix}-${globalChannel}`}
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
                    offline: data[`${catKey}_offline`],
                    coupang: data[`${catKey}_coupang`],
                    major: data[`${catKey}_main`]
                }}
                startMonth={startMonth}
                endMonth={endMonth}
                defaultChannel={globalChannel}
                key={`${catKey}-${globalChannel}`}
            />
        );
    };

    return (
        <div className="space-y-8 mt-12 mb-12">

            {/* Global Date Range Selector */}
            <div className="bg-white p-6 border border-[#c4c4c4] flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-black">통합 조회 설정</span>
                        <span className="text-sm text-[#5d5d5d] font-normal">(전체 브랜드 적용)</span>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleExpandAll}
                            className="px-3 py-1.5 bg-white hover:border-black text-black text-xs font-bold rounded-sm transition-colors border border-[#c4c4c4]"
                        >
                            모두 펼치기
                        </button>
                        <button
                            onClick={handleCollapseAll}
                            className="px-3 py-1.5 bg-white hover:border-black text-black text-xs font-bold rounded-sm transition-colors border border-[#c4c4c4]"
                        >
                            모두 접기
                        </button>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full xl:w-auto">
                    {/* Global Channel Selector */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-xs font-bold text-black whitespace-nowrap">기본 채널:</span>
                        <select
                            value={globalChannel}
                            onChange={(e) => setGlobalChannel(e.target.value as any)}
                            className="w-full sm:w-auto px-3 py-2 rounded text-sm font-bold border border-[#c4c4c4] bg-white text-black focus:outline-none focus:border-black"
                        >
                            <option value="total">전체 (통합)</option>
                            <option value="ecommerce">이커머스</option>
                            <option value="offline">오프라인</option>
                        </select>
                    </div>

                    {/* Date Range Selector */}
                    <div className="flex items-center gap-2 bg-white p-2 rounded border border-[#c4c4c4] w-full sm:w-auto">
                        <span className="text-xs font-bold text-black ml-1">기간:</span>
                        <select
                            value={startMonth}
                            onChange={(e) => { setStartMonth(e.target.value); saveDashboardDate(CHART_ID, e.target.value, endMonth); }}
                            className="bg-transparent text-sm font-bold text-black focus:outline-none p-1.5 grow sm:grow-0"
                        >
                            {availableMonths.map(m => (
                                <option key={`start-${m}`} value={m}>{m}</option>
                            ))}
                        </select>
                        <span className="text-[#c4c4c4] font-bold">~</span>
                        <select
                            value={endMonth}
                            onChange={(e) => { setEndMonth(e.target.value); saveDashboardDate(CHART_ID, startMonth, e.target.value); }}
                            className="bg-transparent text-sm font-bold text-black focus:outline-none p-1.5 grow sm:grow-0"
                        >
                            {availableMonths.map(m => (
                                <option key={`end-${m}`} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* MyBee Toggle */}
            <div className="transition-opacity duration-500 ease-in-out">
                <button
                    onClick={() => setIsMybExpanded(!isMybExpanded)}
                    className="w-full flex items-center justify-between p-6 bg-white border border-[#c4c4c4] hover:border-black transition-colors group"
                >
                    <h2 className="text-2xl font-bold text-black flex items-center gap-4">
                        마이비 품목별 분석
                        <span className="text-sm font-normal text-[#5d5d5d] ml-4">
                            {isMybExpanded ? "접기 ▲" : "펼쳐보기 ▼"}
                        </span>
                    </h2>
                </button>

                {isMybExpanded && (
                    <div className="mt-8 space-y-12 animate-in fade-in slide-in-from-top-4 duration-500">
                        {/* Overall MyBee */}
                        <DynamicAnalysisSection
                            title="마이비 전체"
                            emoji=""
                            dataOptions={{
                                total: data.total_myb,
                                ecommerce: data.ecommerce_myb,
                                offline: data.offline_myb,
                                coupang: data.coupang_myb,
                                major: data.main_myb
                            }}
                            startMonth={startMonth}
                            endMonth={endMonth}
                            defaultChannel={globalChannel}
                            key={`myb_overall-${globalChannel}`}
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
                    className="w-full flex items-center justify-between p-6 bg-white border border-[#c4c4c4] hover:border-black transition-colors group"
                >
                    <h2 className="text-2xl font-bold text-black flex items-center gap-4">
                        누비 품목별 분석
                        <span className="text-sm font-normal text-[#5d5d5d] ml-4">
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
                                offline: data.offline_nubi,
                                coupang: data.coupang_nubi,
                                major: data.main_nubi
                            }}
                            startMonth={startMonth}
                            endMonth={endMonth}
                            defaultChannel={globalChannel}
                            key={`nubi_overall-${globalChannel}`}
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
                    className="w-full flex items-center justify-between p-6 bg-white border border-[#c4c4c4] hover:border-black transition-colors group"
                >
                    <h2 className="text-2xl font-bold text-black flex items-center gap-4">
                        쏭레브 품목별 분석
                        <span className="text-sm font-normal text-[#5d5d5d] ml-4">
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
                                offline: data.offline_sonreve,
                                coupang: data.coupang_sonreve,
                                major: data.main_sonreve
                            }}
                            startMonth={startMonth}
                            endMonth={endMonth}
                            defaultChannel={globalChannel}
                            key={`sonreve_overall-${globalChannel}`}
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

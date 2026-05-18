"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import FileUpload from "@/components/FileUpload";
import { getLogs } from "@/lib/api";
import ChatInterface from "@/components/ChatInterface";
import FileSelector from "@/components/FileSelector";
import ChatHistoryList from "@/components/ChatHistoryList";
import SchemaAliasManager from "@/components/SchemaAliasManager";
import AIInstructionsManager from "@/components/AIInstructionsManager";
import SalesChartNew from "@/components/SalesChartNew";
import ChannelSalesChartNew from "@/components/ChannelSalesChartNew";
import ProductGroupChartNew from "@/components/ProductGroupChartNew";
import DetailedSalesChartNew from "@/components/DetailedSalesChartNew";
import ProductSearchChart from "@/components/ProductSearchChart";
import BrandAnalysisSection from "@/components/BrandAnalysisSection";
import SalesSummary from "@/components/SalesSummary";
import SalesAlerts from "@/components/SalesAlerts";
import {
    ArrowLeft,
    Settings,
    BookOpen,
    RotateCw,
    FileText,
    Bot,
    AlertTriangle,
} from "lucide-react";

const MUTED = "rgba(93, 93, 93, 0.64)";
const OUTLINE = "#c4c4c4";

const ghostButtonClass =
    "inline-flex items-center justify-center gap-2 bg-white text-black text-[14px] font-bold border border-solid h-[44px] px-4 transition-colors hover:border-black";

const ghostButtonStyle = { borderColor: OUTLINE, borderRadius: 4 };

export default function CustomDashboard() {
    const [data, setData] = useState<any>(null);
    const [filename, setFilename] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [showLogs, setShowLogs] = useState(false);
    const [logs, setLogs] = useState<any>(null);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [showAliasManager, setShowAliasManager] = useState(false);
    const [showInstructionsManager, setShowInstructionsManager] = useState(false);
    const [mounted, setMounted] = useState(false);

    const SELECTED_FILE_KEY = "avk_selected_file";

    useEffect(() => {
        setMounted(true);
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem(SELECTED_FILE_KEY);
            if (stored) {
                setSelectedFile(stored);
                setFilename(stored);
            }
        }
    }, []);

    const persistSelectedFile = (file: string | null) => {
        setSelectedFile(file);
        if (typeof window !== "undefined") {
            if (file) {
                localStorage.setItem(SELECTED_FILE_KEY, file);
            } else {
                localStorage.removeItem(SELECTED_FILE_KEY);
            }
        }
    };

    if (!mounted) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="h-10 w-10 border-2 border-black border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const handleUploadSuccess = (responseData: any) => {
        setData(responseData.data);
        const uploadedFilename = responseData.filename;
        setFilename(uploadedFilename);
        persistSelectedFile(uploadedFilename);
    };

    const handleShowLogs = async () => {
        setShowLogs(true);
        setIsLoadingLogs(true);
        try {
            const logData = await getLogs();
            setLogs(logData);
        } catch (error) {
            console.error("Failed to load logs:", error);
        } finally {
            setIsLoadingLogs(false);
        }
    };

    return (
        <div className="min-h-screen bg-white">
            <div className="container mx-auto px-5 md:px-12 py-10 max-w-7xl">
                <div className="mb-10 md:mb-16">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-[14px] font-normal text-black mb-8 hover:underline"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        뒤로 돌아가기
                    </Link>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h1 className="text-[30px] leading-[1.13] font-bold text-black tracking-normal">
                                Vibe Sales
                            </h1>
                            <p
                                className="mt-3 text-[15px] leading-[1.5] font-normal"
                                style={{ color: MUTED }}
                            >
                                Premium Analytics Dashboard
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 md:gap-3">
                            <button
                                onClick={() => window.location.reload()}
                                className={ghostButtonClass}
                                style={ghostButtonStyle}
                                title="페이지 새로고침"
                            >
                                <RotateCw className="w-4 h-4" />
                                새로고침
                            </button>
                            <button
                                onClick={() => setShowInstructionsManager(true)}
                                className={ghostButtonClass}
                                style={ghostButtonStyle}
                            >
                                <BookOpen className="w-4 h-4" />
                                AI 지침
                            </button>
                            <button
                                onClick={() => setShowAliasManager(true)}
                                className={ghostButtonClass}
                                style={ghostButtonStyle}
                            >
                                <Settings className="w-4 h-4" />
                                스키마 설정
                            </button>
                            <button
                                onClick={handleShowLogs}
                                className={ghostButtonClass}
                                style={ghostButtonStyle}
                            >
                                <FileText className="w-4 h-4" />
                                로그
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sales Summary Text - NEW */}
                <div className="mb-8">
                    <SalesSummary filename={selectedFile || filename} />
                </div>

                {/* Sales Alerts - NEW */}
                <div className="mb-8">
                    <SalesAlerts filename={selectedFile || filename} />
                </div>

                {/* Sales Chart - 채널별 */}
                <div className="mb-8">
                    <SalesChartNew filename={selectedFile || filename} />
                </div>

                {/* Channel Sales Chart - 상세 채널별 (Part > Channel > Account) - NEW */}
                <div className="mb-8">
                    <ChannelSalesChartNew filename={selectedFile || filename} />
                </div>

                {/* Product Group Chart - 품목그룹별 */}
                <div className="mb-8">
                    <ProductGroupChartNew filename={selectedFile || filename} />
                </div>

                {/* Detailed Sales Chart - 3단계 필터 */}
                <div className="mb-8">
                    <DetailedSalesChartNew filename={selectedFile || filename} />
                </div>

                {/* Product Search Chart - 상품명 검색 */}
                <div className="mb-8">
                    <ProductSearchChart filename={selectedFile || filename} />
                </div>

                {/* Brand Analysis Section - NEW */}
                <BrandAnalysisSection filename={selectedFile || filename} />

                {/* Chat Interface */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <div>
                        <FileUpload onUploadSuccess={handleUploadSuccess} />
                        <div className="mt-4">
                            <FileSelector
                                selectedFile={selectedFile}
                                onFileSelect={(file) => persistSelectedFile(file)}
                            />
                            <ChatHistoryList />
                        </div>
                    </div>
                    <div>
                        <ChatInterface filename={selectedFile || filename || ""} />
                    </div>
                </div>

                {/* AI Instructions Manager Modal */}
                <AIInstructionsManager
                    isOpen={showInstructionsManager}
                    onClose={() => setShowInstructionsManager(false)}
                />

                {/* Schema Alias Manager Modal */}
                <SchemaAliasManager
                    isOpen={showAliasManager}
                    onClose={() => setShowAliasManager(false)}
                />

                {showLogs && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                        <div
                            className="bg-white w-full max-w-4xl max-h-[80vh] flex flex-col border"
                            style={{ borderColor: OUTLINE, borderRadius: 2 }}
                        >
                            <div
                                className="flex justify-between items-center px-5 py-4 border-b"
                                style={{ borderColor: OUTLINE }}
                            >
                                <h3 className="text-[15px] font-bold text-black">
                                    시스템 로그
                                </h3>
                                <button
                                    onClick={() => setShowLogs(false)}
                                    className="text-2xl leading-none text-black hover:opacity-60"
                                    aria-label="닫기"
                                >
                                    &times;
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-4 bg-black text-[#22c55e] font-mono text-xs">
                                {isLoadingLogs ? (
                                    <div className="text-center p-10 text-white">
                                        로그를 불러오는 중...
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="text-white font-bold mb-2 border-b border-gray-700 pb-1 inline-flex items-center gap-2">
                                                <Bot className="w-4 h-4" />
                                                AI 디버그
                                            </h4>
                                            <pre className="whitespace-pre-wrap">
                                                {logs?.["chat_debug.log"] || "Empty"}
                                            </pre>
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold mb-2 border-b border-gray-700 pb-1 mt-6 inline-flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4" />
                                                시스템 에러
                                            </h4>
                                            <pre className="whitespace-pre-wrap text-red-300">
                                                {logs?.["error.log"] || "Empty"}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div
                                className="px-5 py-3 border-t bg-white flex justify-end"
                                style={{ borderColor: OUTLINE }}
                            >
                                <button
                                    onClick={() => setShowLogs(false)}
                                    className={ghostButtonClass}
                                    style={ghostButtonStyle}
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

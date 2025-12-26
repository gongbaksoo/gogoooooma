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
import SalesSummary from "@/components/SalesSummary";
import { ArrowLeft, Settings, BookOpen } from "lucide-react";

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

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>;
    }

    const handleUploadSuccess = (responseData: any) => {
        setData(responseData.data);
        const uploadedFilename = responseData.filename;
        setFilename(uploadedFilename);
        setSelectedFile(uploadedFilename);
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
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
            <div className="container mx-auto px-4 py-8 max-w-7xl">

                <div className="mb-6 md:mb-10">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6 transition font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        뒤로 돌아가기
                    </Link>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900">
                                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                    Vibe Sales
                                </span>
                                <span className="block text-slate-400 text-lg md:text-xl font-medium mt-2">Premium Analytics Dashboard</span>
                            </h1>
                        </div>
                        <div className="flex flex-wrap gap-2 md:gap-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="px-5 py-2.5 text-sm font-semibold bg-white text-blue-600 border border-blue-100 rounded-full hover:bg-blue-50 shadow-sm transition-all flex items-center gap-2"
                                title="페이지 새로고침"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="w-4 h-4"
                                >
                                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                                    <path d="M21 3v5h-5" />
                                </svg>
                                새로고침
                            </button>
                            <button
                                onClick={() => setShowInstructionsManager(true)}
                                className="px-5 py-2.5 text-sm font-semibold bg-white text-slate-700 border border-slate-200 rounded-full hover:bg-slate-50 shadow-sm transition-all flex items-center gap-2"
                            >
                                <BookOpen className="w-4 h-4 text-blue-500" />
                                AI 지침
                            </button>
                            <button
                                onClick={() => setShowAliasManager(true)}
                                className="px-5 py-2.5 text-sm font-semibold bg-white text-slate-700 border border-slate-200 rounded-full hover:bg-slate-50 shadow-sm transition-all flex items-center gap-2"
                            >
                                <Settings className="w-4 h-4 text-purple-500" />
                                스키마 설정
                            </button>
                            <button
                                onClick={handleShowLogs}
                                className="px-5 py-2.5 text-sm font-semibold bg-slate-900 text-white rounded-full hover:bg-slate-800 shadow-lg transition-all"
                            >
                                🛠️ 로그
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sales Summary Text - NEW */}
                <div className="mb-8">
                    <SalesSummary filename={selectedFile || filename} />
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

                {/* Chat Interface */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <div>
                        <FileUpload onUploadSuccess={handleUploadSuccess} />
                        <div className="mt-4">
                            <FileSelector
                                selectedFile={selectedFile}
                                onFileSelect={(file) => setSelectedFile(file)}
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
                            <div className="flex justify-between items-center p-4 border-b">
                                <h3 className="text-lg font-bold">시스템 로그</h3>
                                <button onClick={() => setShowLogs(false)} className="text-2xl">&times;</button>
                            </div>
                            <div className="flex-1 overflow-auto p-4 bg-gray-900 text-green-400 font-mono text-xs">
                                {isLoadingLogs ? (
                                    <div className="text-center p-10">로그를 불러오는 중...</div>
                                ) : (
                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="text-white font-bold mb-2 border-b border-gray-700 pb-1">🤖 AI 디버그</h4>
                                            <pre className="whitespace-pre-wrap">{logs?.["chat_debug.log"] || "Empty"}</pre>
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold mb-2 border-b border-gray-700 pb-1 mt-6">🚨 시스템 에러</h4>
                                            <pre className="whitespace-pre-wrap text-red-300">{logs?.["error.log"] || "Empty"}</pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-t bg-gray-50 flex justify-end">
                                <button onClick={() => setShowLogs(false)} className="px-4 py-2 bg-gray-200 rounded">닫기</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

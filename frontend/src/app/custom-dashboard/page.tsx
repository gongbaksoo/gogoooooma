"use client";

import { useState } from "react";
import Link from "next/link";
import FileUpload from "@/components/FileUpload";
import { getLogs } from "@/lib/api";
import ChatInterface from "@/components/ChatInterface";
import FileSelector from "@/components/FileSelector";
import SchemaAliasManager from "@/components/SchemaAliasManager";
import AIInstructionsManager from "@/components/AIInstructionsManager";
import SalesChart from "@/components/SalesChart";
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
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <nav className="border-b border-gray-200">
                <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-sm">홈으로</span>
                    </Link>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setShowInstructionsManager(true)}
                            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition"
                        >
                            <BookOpen className="w-4 h-4" />
                            AI 지침
                        </button>
                        <button
                            onClick={() => setShowAliasManager(true)}
                            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition"
                        >
                            <Settings className="w-4 h-4" />
                            스키마 설정
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="py-16 md:py-24">
                <div className="max-w-[1200px] mx-auto px-6">
                    <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-gray-900 mb-4">
                        매출 대시보드
                    </h1>
                    <p className="text-xl text-gray-600 font-light">
                        고급 스키마 전용 분석 및 시각화
                    </p>
                </div>
            </section>

            {/* Chart Section */}
            <section className="py-12 bg-gray-50">
                <div className="max-w-[1200px] mx-auto px-6">
                    <div className="mb-8">
                        <h2 className="text-3xl font-semibold text-gray-900 mb-2">
                            월별 매출 추이
                        </h2>
                        <p className="text-lg text-gray-600 font-light">
                            이커머스와 오프라인 채널별 매출 현황
                        </p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 p-8">
                        <SalesChart />
                    </div>
                </div>
            </section>

            {/* Upload & File Selector Section */}
            <section className="py-20">
                <div className="max-w-[1200px] mx-auto px-6">
                    <div className="grid md:grid-cols-2 gap-12">
                        {/* Upload */}
                        <div>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                                파일 업로드
                            </h2>
                            <FileUpload onUploadSuccess={handleUploadSuccess} />
                        </div>

                        {/* File Selector */}
                        <div>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                                저장된 파일
                            </h2>
                            <FileSelector selectedFile={selectedFile} onFileSelect={setSelectedFile} />
                        </div>
                    </div>
                </div>
            </section>

            {/* Chat Section */}
            {selectedFile && (
                <section className="py-20 bg-gray-50">
                    <div className="max-w-[1200px] mx-auto px-6">
                        <div className="mb-8">
                            <h2 className="text-3xl font-semibold text-gray-900 mb-2">
                                AI 분석
                            </h2>
                            <p className="text-lg text-gray-600 font-light">
                                {selectedFile}에 대해 질문하세요
                            </p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                            <ChatInterface filename={selectedFile} />
                        </div>
                    </div>
                </section>
            )}

            {/* Modals */}
            {showLogs && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b border-gray-200">
                            <h3 className="text-xl font-semibold text-gray-900">시스템 로그</h3>
                            <button
                                onClick={() => setShowLogs(false)}
                                className="text-gray-400 hover:text-gray-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6 bg-gray-900 text-green-400 font-mono text-xs">
                            {isLoadingLogs ? (
                                <div className="text-center p-10">로그를 불러오는 중...</div>
                            ) : (
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="text-white font-bold mb-2 border-b border-gray-700 pb-1">
                                            🤖 AI 디버그
                                        </h4>
                                        <pre className="whitespace-pre-wrap">{logs?.["chat_debug.log"] || "Empty"}</pre>
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold mb-2 border-b border-gray-700 pb-1 mt-6">
                                            🚨 시스템 에러
                                        </h4>
                                        <pre className="whitespace-pre-wrap text-red-300">{logs?.["error.log"] || "Empty"}</pre>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-gray-200 flex justify-end">
                            <button
                                onClick={() => setShowLogs(false)}
                                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-900 transition"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAliasManager && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
                            <h3 className="text-xl font-semibold text-gray-900">스키마 별칭 관리</h3>
                            <button
                                onClick={() => setShowAliasManager(false)}
                                className="text-gray-400 hover:text-gray-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-6">
                            <SchemaAliasManager />
                        </div>
                    </div>
                </div>
            )}

            {showInstructionsManager && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
                            <h3 className="text-xl font-semibold text-gray-900">AI 지침 관리</h3>
                            <button
                                onClick={() => setShowInstructionsManager(false)}
                                className="text-gray-400 hover:text-gray-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-6">
                            <AIInstructionsManager />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

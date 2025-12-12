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
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
            <div className="container mx-auto px-4 py-8 max-w-7xl">

                <div className="mb-8">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 transition"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        뒤로 돌아가기
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                                커스텀 매출 분석 대시보드
                            </h1>
                            <p className="text-gray-600 mt-2">고급 스키마 데이터 전용 분석 및 시각화</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowInstructionsManager(true)}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                            >
                                <BookOpen className="w-4 h-4" />
                                AI 지침
                            </button>
                            <button
                                onClick={() => setShowAliasManager(true)}
                                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                            >
                                <Settings className="w-4 h-4" />
                                스키마 설정
                            </button>
                            <button
                                onClick={handleShowLogs}
                                className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
                            >
                                🛠️ 개발자 로그
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sales Chart */}
                <div className="mb-8">
                    <SalesChart filename={selectedFile || filename} />
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

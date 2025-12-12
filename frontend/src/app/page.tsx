"use client";

import { useState } from "react";
import Link from "next/link";
import FileUpload from "@/components/FileUpload";
import { getLogs } from "@/lib/api";
import ChatInterface from "@/components/ChatInterface";
import FileSelector from "@/components/FileSelector";
import { ArrowRight } from "lucide-react";

export default function Home() {
    const [data, setData] = useState<any>(null);
    const [filename, setFilename] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [showLogs, setShowLogs] = useState(false);
    const [logs, setLogs] = useState<any>(null);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            <div className="container mx-auto px-4 py-8 max-w-7xl">

                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                매출 분석 대시보드
                            </h1>
                            <p className="text-gray-600 mt-2">엑셀 파일을 업로드하여 매출 현황을 분석하세요.</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleShowLogs}
                                className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
                            >
                                🛠️ 개발자 로그
                            </button>
                            <Link
                                href="/custom-dashboard"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition shadow-sm"
                            >
                                커스텀 대시보드
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </div>

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

                <div className="grid gap-8 md:grid-cols-2">
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <h3 className="text-lg font-semibold mb-4">파일 업로드</h3>
                        <FileUpload onUploadSuccess={handleUploadSuccess} />
                    </div>

                    <FileSelector selectedFile={selectedFile} onFileSelect={setSelectedFile} />
                </div>

                {selectedFile && (
                    <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border">
                        <h3 className="text-lg font-semibold mb-4">AI 분석 - {selectedFile}</h3>
                        <ChatInterface filename={selectedFile} />
                    </div>
                )}

                {data && (
                    <div className="mt-8 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border">
                            <h3 className="text-sm font-medium text-gray-500">총 데이터 행</h3>
                            <div className="text-2xl font-bold mt-2">{data.total_rows}</div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border">
                            <h3 className="text-lg font-semibold mb-4">데이터 미리보기</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            {data.columns?.slice(0, 8).map((col: string) => (
                                                <th key={col} className="px-4 py-3 text-left">{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.preview?.map((row: any, i: number) => (
                                            <tr key={i} className="border-b">
                                                {data.columns?.slice(0, 8).map((col: string) => (
                                                    <td key={col} className="px-4 py-3">{row[col]}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border">
                            <h3 className="text-lg font-semibold mb-4">기본 통계</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                {data.statistics && typeof data.statistics === 'object' ? (
                                    Object.entries(data.statistics).map(([key, stats]: [string, any]) => {
                                        if (!stats || typeof stats !== 'object') return null;
                                        return (
                                            <div key={key} className="border p-4 rounded-lg">
                                                <h4 className="font-medium text-blue-600 mb-2">{key}</h4>
                                                <ul className="space-y-1 text-sm text-gray-600">
                                                    <li>평균: {typeof stats.mean === 'number' ? stats.mean.toFixed(2) : '-'}</li>
                                                    <li>최소: {stats.min ?? '-'}</li>
                                                    <li>최대: {stats.max ?? '-'}</li>
                                                </ul>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-gray-500">통계 데이터가 없습니다.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

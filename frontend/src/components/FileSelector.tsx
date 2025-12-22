"use client";

import { useState, useEffect } from "react";
import { File, Trash2, RefreshCw } from "lucide-react";
import { getFileList, deleteFile } from "@/lib/api";

interface FileInfo {
    filename: string;
    size: number;
    modified: number;
}

interface FileSelectorProps {
    selectedFile: string | null;
    onFileSelect: (filename: string) => void;
}

export default function FileSelector({ selectedFile, onFileSelect }: FileSelectorProps) {
    const [files, setFiles] = useState<FileInfo[]>([]);
    const [fileCount, setFileCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadFiles = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getFileList();
            if (data && data.files) {
                setFiles(data.files);
                setFileCount(data.count);
            } else {
                setFiles([]);
                setFileCount(0);
            }
        } catch (error: any) {
            console.error("FileSelector: Failed to load files:", error);
            setError("파일 목록을 불러오지 못했습니다. (서버 연결 확인 필요)");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setMounted(true);
        loadFiles();
    }, []);

    if (!mounted) return <div className="p-6 border rounded-xl animate-pulse bg-gray-50 h-32" />;

    const handleDelete = async (filename: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent file selection when clicking delete

        if (!confirm(`"${filename}" 파일을 삭제하시겠습니까?`)) return;

        try {
            await deleteFile(filename);
            await loadFiles();

            // If deleted file was selected, clear selection
            if (selectedFile === filename) {
                onFileSelect("");
            }
        } catch (error: any) {
            alert("삭제 실패: " + (error.response?.data?.detail || error.message));
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 transition-all">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-3 text-slate-800 tracking-tight">
                    <File className="w-6 h-6 text-blue-500" />
                    저장된 파일
                    <span className="text-sm font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 ml-1">
                        {fileCount}/5
                    </span>
                </h3>
                <button
                    onClick={loadFiles}
                    disabled={isLoading}
                    className="p-2.5 text-slate-400 hover:text-blue-600 rounded-xl hover:bg-blue-50 transition-all border border-transparent hover:border-blue-100"
                    title="새로고침"
                >
                    <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-2xl flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    {error}
                </div>
            )}

            {files.length === 0 && !error ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 font-medium">
                    업로드된 파일이 없습니다.
                </div>
            ) : (
                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                    {files.map((file) => (
                        <div
                            key={file.filename}
                            onClick={() => onFileSelect(file.filename)}
                            className={`
                                p-4 rounded-2xl border cursor-pointer transition-all group
                                ${selectedFile === file.filename
                                    ? "bg-blue-50 border-blue-400 shadow-md shadow-blue-100/50 ring-4 ring-blue-500/5 translate-x-1"
                                    : "bg-white border-slate-100 hover:border-blue-200 hover:bg-slate-50 hover:shadow-lg hover:shadow-slate-100"
                                }
                            `}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl transition-colors ${selectedFile === file.filename ? 'bg-blue-500 text-white' : 'bg-slate-50 text-slate-500 group-hover:bg-white'}`}>
                                            <File className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`font-bold text-sm truncate ${selectedFile === file.filename ? 'text-blue-700' : 'text-slate-700'}`}>
                                                {file.filename}
                                            </p>
                                            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                                                {formatFileSize(file.size)} · {formatDate(file.modified)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => handleDelete(file.filename, e)}
                                    className="ml-3 p-2.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                                    title="삭제"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

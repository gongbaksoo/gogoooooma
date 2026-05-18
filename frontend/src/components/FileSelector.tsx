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

    if (!mounted) return <div className="p-6 border border-[#c4c4c4] animate-pulse bg-[#f5f5f5] h-32" />;

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
        <div className="bg-white p-6 md:p-8 border border-[#c4c4c4]">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-3 text-black tracking-tight">
                    <File className="w-6 h-6 text-black" />
                    저장된 파일
                    <span className="text-sm font-normal text-black border border-[#c4c4c4] px-2 py-0.5 rounded-sm ml-1">
                        {fileCount}/5
                    </span>
                </h3>
                <button
                    onClick={loadFiles}
                    disabled={isLoading}
                    className="p-2.5 text-black hover:opacity-60 transition-opacity border border-transparent"
                    title="새로고침"
                >
                    <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-white border border-[#ff0066] text-[#ff0066] text-xs font-semibold rounded-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff0066]" />
                    {error}
                </div>
            )}

            {files.length === 0 && !error ? (
                <div className="text-center py-12 bg-[#f5f5f5] rounded-sm border border-dashed border-[#c4c4c4] text-[#5d5d5d] font-normal">
                    업로드된 파일이 없습니다.
                </div>
            ) : (
                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                    {files.map((file) => (
                        <div
                            key={file.filename}
                            onClick={() => onFileSelect(file.filename)}
                            className={`
                                p-4 rounded-sm border cursor-pointer transition-colors group
                                ${selectedFile === file.filename
                                    ? "bg-[#f5f5f5] border-black"
                                    : "bg-white border-[#c4c4c4] hover:border-black"
                                }
                            `}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3">
                                        <File className={`w-4 h-4 ${selectedFile === file.filename ? 'text-black' : 'text-[#5d5d5d]'}`} />
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm truncate text-black">
                                                {file.filename}
                                            </p>
                                            <p className="text-[11px] font-normal text-[#5d5d5d] mt-0.5">
                                                {formatFileSize(file.size)} · {formatDate(file.modified)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => handleDelete(file.filename, e)}
                                    className="ml-3 p-2.5 text-[#c4c4c4] hover:text-[#ff0066] transition-colors border border-transparent"
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

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

    const loadFiles = async () => {
        setIsLoading(true);
        try {
            const data = await getFileList();
            setFiles(data.files);
            setFileCount(data.count);
        } catch (error) {
            console.error("Failed to load files:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadFiles();
    }, []);

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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <File className="w-5 h-5" />
                    저장된 파일 ({fileCount}/50)
                </h3>
                <button
                    onClick={loadFiles}
                    disabled={isLoading}
                    className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition"
                    title="새로고침"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </button>
            </div>

            {files.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                    업로드된 파일이 없습니다.
                </div>
            ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {files.map((file) => (
                        <div
                            key={file.filename}
                            onClick={() => onFileSelect(file.filename)}
                            className={`
                                p-3 rounded-lg border cursor-pointer transition
                                ${selectedFile === file.filename
                                    ? "bg-blue-50 border-blue-300 ring-2 ring-blue-200"
                                    : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                                }
                            `}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        {selectedFile === file.filename && (
                                            <span className="text-blue-600 font-bold">✓</span>
                                        )}
                                        <p className="font-medium text-sm truncate">
                                            {file.filename}
                                        </p>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {formatFileSize(file.size)} · {formatDate(file.modified)}
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => handleDelete(file.filename, e)}
                                    className="ml-2 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition"
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

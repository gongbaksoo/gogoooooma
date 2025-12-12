"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, AlertCircle, Settings, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import api, { getApiKeyStatus, saveApiKey } from "@/lib/api";

interface Message {
    role: "user" | "bot";
    content: string;
}

interface ChatInterfaceProps {
    filename: string;
}

export default function ChatInterface({ filename }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([
        { role: "bot", content: "안녕하세요! 업로드된 데이터에 대해 궁금한 점을 물어보세요." },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isServerKeySet, setIsServerKeySet] = useState(false);
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [adminKeyInput, setAdminKeyInput] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Check server key status on mount
    useEffect(() => {
        checkKeyStatus();
    }, []);

    const checkKeyStatus = async () => {
        try {
            const status = await getApiKeyStatus();
            setIsServerKeySet(status.is_set);
        } catch (e) {
            console.error("Failed to check key status", e);
        }
    };

    const handleAdminSaveKey = async () => {
        if (!adminKeyInput.trim()) return;
        try {
            await saveApiKey(adminKeyInput);
            await checkKeyStatus();
            setShowAdminModal(false);
            setAdminKeyInput("");
            alert("API Key가 저장되었습니다!");
        } catch (e: any) {
            alert("저장 실패: " + e.message);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        if (!isServerKeySet) {
            alert("먼저 관리자 설정에서 API Key를 등록해주세요.");
            return;
        }

        const userMessage = input;
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await api.post("/chat/", {
                filename,
                query: userMessage,
                api_key: "server_managed", // Signal backend to use stored key
                history: messages, // Send conversation history for context
            });

            const botResponse = response.data.response;
            setMessages((prev) => [...prev, { role: "bot", content: botResponse }]);
        } catch (error: any) {
            console.error("Chat error:", error);
            const errorMessage =
                error.response?.data?.detail || "죄송합니다. 오류가 발생했습니다.";
            setMessages((prev) => [
                ...prev,
                { role: "bot", content: `❌ 오류: ${errorMessage}` },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[600px] border rounded-xl overflow-hidden bg-white shadow-sm">
            {/* Header */}
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-700">AI 분석 챗봇</h3>
                </div>
                <div className="flex items-center gap-2">
                    {isServerKeySet ? (
                        <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>AI 준비완료</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-200">
                            <AlertCircle className="w-3 h-3" />
                            <span>키 미설정</span>
                        </div>
                    )}
                    <button
                        onClick={() => setShowAdminModal(true)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition"
                        title="관리자 설정"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                {messages.map((message, index) => (
                    <div
                        key={index}
                        className={cn(
                            "flex w-full items-start gap-2",
                            message.role === "user" ? "justify-end" : "justify-start"
                        )}
                    >
                        {message.role === "bot" && (
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                                <Bot className="w-5 h-5 text-blue-600" />
                            </div>
                        )}
                        <div
                            className={cn(
                                "max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                                message.role === "user"
                                    ? "bg-blue-600 text-white rounded-tr-none"
                                    : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"
                            )}
                        >
                            <div className="prose prose-sm max-w-none break-words dark:prose-invert">
                                <ReactMarkdown
                                    components={{
                                        // Style tables in markdown
                                        table: ({ node, ...props }) => (
                                            <table className="border-collapse border border-gray-300" {...props} />
                                        ),
                                        th: ({ node, ...props }) => (
                                            <th className="border border-gray-300 px-4 py-2 bg-gray-100" {...props} />
                                        ),
                                        td: ({ node, ...props }) => (
                                            <td className="border border-gray-300 px-4 py-2" {...props} />
                                        ),
                                    }}
                                >
                                    {message.content}
                                </ReactMarkdown>
                            </div>
                        </div>
                        {message.role === "user" && (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
                                <User className="w-5 h-5 text-gray-600" />
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                            <Bot className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                            <span className="text-sm text-gray-500">분석 중입니다...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t">
                {!isServerKeySet && (
                    <div className="mb-4 text-center p-3 bg-yellow-50 text-yellow-800 text-sm rounded-lg border border-yellow-200 flex flex-col items-center gap-2">
                        <p className="font-medium flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            AI 설정이 필요합니다.
                        </p>
                        <button
                            onClick={() => setShowAdminModal(true)}
                            className="text-xs bg-yellow-100 hover:bg-yellow-200 px-3 py-1.5 rounded-md transition font-semibold"
                        >
                            관리자 설정 열기
                        </button>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isServerKeySet ? "데이터에 대해 무엇이든 물어보세요..." : "관리자 설정이 완료되어야 채팅이 가능합니다."}
                        disabled={isLoading || !isServerKeySet}
                        className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim() || !isServerKeySet}
                        className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </form>
            </div>

            {/* Admin Modal */}
            {showAdminModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Settings className="w-5 h-5" />
                                관리자 설정
                            </h3>
                            <button onClick={() => setShowAdminModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Gemini API Key</label>
                                <input
                                    type="password"
                                    className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                                    placeholder="sk-..."
                                    value={adminKeyInput}
                                    onChange={(e) => setAdminKeyInput(e.target.value)}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    * 이 키는 서버에 안전하게 저장되며, 일반 사용자에게는 보이지 않습니다.<br />
                                    * 입력 후 [저장]을 누르면 즉시 적용됩니다.
                                </p>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    onClick={() => setShowAdminModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleAdminSaveKey}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                >
                                    저장 및 적용
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

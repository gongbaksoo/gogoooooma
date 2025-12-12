"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

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
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input;
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await api.post("/chat/", {
                filename,
                query: userMessage,
                api_key: "server_managed",
                history: messages,
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
        <div className="flex flex-col h-[700px]">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">AI 분석 챗봇</h3>
                        <p className="text-sm text-gray-600">데이터에 대해 무엇이든 물어보세요</p>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={cn(
                            "flex gap-4",
                            msg.role === "user" ? "justify-end" : "justify-start"
                        )}
                    >
                        {msg.role === "bot" && (
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-4 h-4 text-blue-600" />
                            </div>
                        )}
                        <div
                            className={cn(
                                "max-w-[70%] rounded-2xl px-6 py-4",
                                msg.role === "user"
                                    ? "bg-blue-600 text-white"
                                    : "bg-white border border-gray-200 text-gray-900"
                            )}
                        >
                            <ReactMarkdown
                                className={cn(
                                    "prose prose-sm max-w-none",
                                    msg.role === "user" ? "prose-invert" : ""
                                )}
                            >
                                {msg.content}
                            </ReactMarkdown>
                        </div>
                        {msg.role === "user" && (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-gray-600" />
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-4 justify-start">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-4">
                            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white border-t border-gray-200">
                <form onSubmit={handleSubmit} className="flex gap-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="데이터에 대해 무엇이든 물어보세요..."
                        disabled={isLoading}
                        className="flex-1 px-6 py-4 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 text-base"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="px-8 py-4 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm font-medium"
                    >
                        전송
                    </button>
                </form>
            </div>
        </div>
    );
}

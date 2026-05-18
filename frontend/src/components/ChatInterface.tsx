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
    const [chatId] = useState(() => `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const saveChatHistory = async (currentMessages: Message[]) => {
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

            // Generate title from first user message
            const firstUserMessage = currentMessages.find(m => m.role === "user");
            const title = firstUserMessage
                ? firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? "..." : "")
                : "새 대화";

            await fetch(`${API_URL}/chat/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: chatId,
                    filename: filename,
                    title: title,
                    messages: currentMessages,
                    created_at: Date.now() / 1000,
                    updated_at: Date.now() / 1000
                })
            });
        } catch (error) {
            console.error("Failed to save chat:", error);
        }
    };

    // API key is set in Railway environment variables
    // No need to check status on frontend

    // Admin key management removed - API key is set in Railway environment

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
                api_key: "server_managed", // Signal backend to use stored key
                history: messages, // Send conversation history for context
            });

            const botResponse = response.data.response;
            setMessages((prev) => {
                const updatedMessages: Message[] = [...prev, { role: "bot" as const, content: botResponse }];

                // Auto-save after AI response
                saveChatHistory(updatedMessages);

                return updatedMessages;
            });
        } catch (error: any) {
            console.error("Chat error:", error);
            const errorMessage =
                error.response?.data?.detail || "죄송합니다. 오류가 발생했습니다.";
            setMessages((prev) => [
                ...prev,
                { role: "bot", content: `오류: ${errorMessage}` },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[600px] bg-white border border-[#c4c4c4] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#c4c4c4] bg-white flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-sm border border-[#c4c4c4] flex items-center justify-center">
                        <Bot className="w-6 h-6 text-black" />
                    </div>
                    <div>
                        <h3 className="font-bold text-black tracking-tight leading-none">AI Insight Chat</h3>
                        <p className="text-[11px] font-bold text-black mt-1 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                            AI Online
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white custom-scrollbar">
                {messages.map((message, index) => (
                    <div
                        key={index}
                        className={cn(
                            "flex w-full items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
                            message.role === "user" ? "flex-row-reverse" : "flex-row"
                        )}
                    >
                        <div
                            className={cn(
                                "flex flex-col gap-1 tracking-tight",
                                message.role === "user" ? "items-end" : "items-start"
                            )}
                        >
                            <div
                                className={cn(
                                    "max-w-[85%] rounded-sm px-5 py-3.5 text-sm transition-colors",
                                    message.role === "user"
                                        ? "bg-black text-white"
                                        : "bg-[#f5f5f5] text-black border border-[#c4c4c4]"
                                )}
                            >
                                <div className="prose prose-sm max-w-none break-words leading-relaxed font-normal">
                                    <ReactMarkdown
                                        components={{
                                            table: ({ node, ...props }) => (
                                                <div className="overflow-x-auto my-4 border border-[#c4c4c4] bg-white font-sans">
                                                    <table className="w-full border-collapse" {...props} />
                                                </div>
                                            ),
                                            th: ({ node, ...props }) => (
                                                <th className="border-b border-[#c4c4c4] px-4 py-2 bg-[#f5f5f5] font-bold text-black text-[11px] uppercase tracking-wider text-left" {...props} />
                                            ),
                                            td: ({ node, ...props }) => (
                                                <td className="border-b border-[#e5e5e5] px-4 py-3 text-black font-normal" {...props} />
                                            ),
                                            p: ({ node, ...props }) => <p className="mb-0 last:mb-0" {...props} />,
                                        }}
                                    >
                                        {message.content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-[#5d5d5d] uppercase px-1">
                                {message.role === "user" ? "YOU" : "AI ANALYST"}
                            </span>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-start gap-4 animate-in fade-in duration-300">
                        <div className="flex flex-col gap-1 items-start">
                            <div className="bg-[#f5f5f5] px-5 py-4 rounded-sm border border-[#c4c4c4] flex items-center gap-3">
                                <span className="flex gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-bounce [animation-delay:-0.3s]" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-bounce [animation-delay:-0.15s]" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-bounce" />
                                </span>
                                <span className="text-xs font-bold text-black uppercase tracking-wider">Analyzing Data...</span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white border-t border-[#c4c4c4] sticky bottom-0">
                <form onSubmit={handleSubmit} className="flex gap-3 items-center">
                    <div className="flex-1 relative flex items-center">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask anything about your data..."
                            disabled={isLoading}
                            className="w-full pl-5 pr-12 py-3.5 bg-white border border-[#c4c4c4] rounded-sm focus:border-black outline-none transition-colors text-sm font-medium text-black placeholder:text-[#5d5d5d] disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="absolute right-2 p-2.5 bg-black text-white rounded-sm hover:bg-[#222] disabled:bg-[#c4c4c4] disabled:text-white transition-colors"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

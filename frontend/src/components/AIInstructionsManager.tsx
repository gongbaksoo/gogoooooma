import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, BookOpen } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

interface AIInstructionsManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

const AIInstructionsManager: React.FC<AIInstructionsManagerProps> = ({ isOpen, onClose }) => {
    const [instructions, setInstructions] = useState<string[]>([]);
    const [newInstruction, setNewInstruction] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchInstructions();
        }
    }, [isOpen]);

    const fetchInstructions = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`${API_BASE_URL}/custom/instructions/`);
            setInstructions(response.data.instructions || []);
        } catch (error) {
            console.error('지침 로드 실패:', error);
            setError('지침을 불러오는 데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const addInstruction = () => {
        const instruction = newInstruction.trim();
        if (!instruction) return;

        if (instructions.includes(instruction)) {
            alert('이미 존재하는 지침입니다');
            return;
        }

        const updatedInstructions = [...instructions, instruction];
        saveInstructions(updatedInstructions);
        setNewInstruction('');
    };

    const removeInstruction = (index: number) => {
        const updatedInstructions = instructions.filter((_, i) => i !== index);
        saveInstructions(updatedInstructions);
    };

    const saveInstructions = async (updatedInstructions: string[]) => {
        try {
            await axios.post(`${API_BASE_URL}/custom/instructions/`, {
                instructions: updatedInstructions
            });
            setInstructions(updatedInstructions);
        } catch (error) {
            console.error('지침 저장 실패:', error);
            alert('지침 저장에 실패했습니다');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <BookOpen className="w-6 h-6 text-blue-600" />
                            AI 지침 설정
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            AI가 데이터를 분석할 때 따라야 할 규칙과 우선순위를 설정하세요
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <div className="text-center py-10">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="mt-4 text-gray-500">로딩 중...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Add New Instruction */}
                            <div className="bg-blue-50 p-4 rounded-lg border-2 border-dashed border-blue-300">
                                <textarea
                                    value={newInstruction}
                                    onChange={(e) => setNewInstruction(e.target.value)}
                                    placeholder="새 지침을 입력하세요...&#10;예: 거래처 정보를 찾을 때는 항상 '거래처명' 컬럼을 우선적으로 확인하고, '거래처명'에 값이 없을 경우에만 '거래처' 컬럼을 확인하세요."
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    rows={3}
                                />
                                <button
                                    onClick={addInstruction}
                                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    지침 추가
                                </button>
                            </div>

                            {/* Existing Instructions */}
                            <div className="space-y-3">
                                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                                    📋 현재 지침 목록
                                    <span className="text-sm text-gray-500">({instructions.length}개)</span>
                                </h3>

                                {instructions.length === 0 ? (
                                    <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg">
                                        <p>설정된 지침이 없습니다.</p>
                                        <p className="text-sm mt-2">위의 입력창에서 지침을 추가해주세요.</p>
                                    </div>
                                ) : (
                                    instructions.map((instruction, index) => (
                                        <div
                                            key={index}
                                            className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1">
                                                    <div className="flex items-start gap-2">
                                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-sm font-semibold flex-shrink-0 mt-0.5">
                                                            {index + 1}
                                                        </span>
                                                        <p className="text-gray-800 leading-relaxed">{instruction}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeInstruction(index)}
                                                    className="text-red-500 hover:text-red-700 transition flex-shrink-0"
                                                    title="삭제"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-gray-50">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="text-2xl">💡</div>
                        <div className="flex-1 text-sm text-gray-600">
                            <p className="font-semibold mb-1">지침 작성 팁:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>구체적이고 명확하게 작성하세요</li>
                                <li>우선순위가 있는 경우 명시하세요 (예: "A를 먼저 확인, 없으면 B 확인")</li>
                                <li>데이터 처리 규칙을 포함하세요 (예: "NULL 값 제외")</li>
                            </ul>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIInstructionsManager;

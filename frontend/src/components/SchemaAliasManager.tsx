import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

interface SchemaAliasManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

const SchemaAliasManager: React.FC<SchemaAliasManagerProps> = ({ isOpen, onClose }) => {
    const [aliases, setAliases] = useState<{ [key: string]: string[] }>({});
    const [newColumn, setNewColumn] = useState('');
    const [newAlias, setNewAlias] = useState<{ [key: string]: string }>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchAliases();
        }
    }, [isOpen]);

    const fetchAliases = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`${API_BASE_URL}/custom/aliases/`);
            setAliases(response.data);
        } catch (error) {
            console.error('별칭 로드 실패:', error);
            setError('별칭 로드에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const addAlias = async (column: string) => {
        const alias = newAlias[column]?.trim();
        if (!alias) return;

        const currentAliases = aliases[column] || [];
        if (currentAliases.includes(alias)) {
            alert('이미 존재하는 별칭입니다');
            return;
        }

        const updatedAliases = [...currentAliases, alias];

        setLoading(true);
        setError(null);
        try {
            await axios.post(`${API_BASE_URL}/custom/aliases/`, {
                column,
                aliases: updatedAliases
            });

            setAliases({ ...aliases, [column]: updatedAliases });
            setNewAlias({ ...newAlias, [column]: '' });
        } catch (error) {
            console.error('별칭 추가 실패:', error);
            setError('별칭 추가에 실패했습니다.');
            alert('별칭 추가에 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    const removeAlias = async (column: string, alias: string) => {
        setLoading(true);
        setError(null);
        try {
            await axios.delete(`${API_BASE_URL}/custom/aliases/${encodeURIComponent(column)}/${encodeURIComponent(alias)}`);

            const updatedAliases = aliases[column].filter(a => a !== alias);
            if (updatedAliases.length === 0) {
                const newAliases = { ...aliases };
                delete newAliases[column];
                setAliases(newAliases);
            } else {
                setAliases({ ...aliases, [column]: updatedAliases });
            }
        } catch (error) {
            console.error('별칭 삭제 실패:', error);
            alert('별칭 삭제에 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    const addNewColumn = async () => {
        const column = newColumn.trim();
        if (!column) return;

        if (aliases[column]) {
            alert('이미 존재하는 컬럼입니다');
            return;
        }

        setAliases({ ...aliases, [column]: [] });
        setNewColumn('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">📋 스키마 별칭 설정</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            각 컬럼에 대한 별칭을 설정하여 AI가 다양한 용어로 질문에 답변할 수 있습니다
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
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                            <p className="mt-4 text-gray-500">로딩 중...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Add New Column */}
                            <div className="bg-purple-50 p-4 rounded-lg border-2 border-dashed border-purple-300">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newColumn}
                                        onChange={(e) => setNewColumn(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && addNewColumn()}
                                        placeholder="새 컬럼명 입력..."
                                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                    <button
                                        onClick={addNewColumn}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        컬럼 추가
                                    </button>
                                </div>
                            </div>

                            {/* Existing Columns */}
                            {Object.entries(aliases).map(([column, columnAliases]) => (
                                <div key={column} className="bg-white border rounded-lg p-4 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-semibold text-lg text-gray-900">{column}</h3>
                                        <span className="text-sm text-gray-500">
                                            {columnAliases.length}개 별칭
                                        </span>
                                    </div>

                                    {/* Alias List */}
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {columnAliases.map((alias) => (
                                            <div
                                                key={alias}
                                                className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                                            >
                                                <span>{alias}</span>
                                                <button
                                                    onClick={() => removeAlias(column, alias)}
                                                    className="hover:text-red-600 transition"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add Alias Input */}
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newAlias[column] || ''}
                                            onChange={(e) => setNewAlias({ ...newAlias, [column]: e.target.value })}
                                            onKeyPress={(e) => e.key === 'Enter' && addAlias(column)}
                                            placeholder="새 별칭 입력..."
                                            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <button
                                            onClick={() => addAlias(column)}
                                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm flex items-center gap-1"
                                        >
                                            <Plus className="w-4 h-4" />
                                            추가
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {Object.keys(aliases).length === 0 && (
                                <div className="text-center py-10 text-gray-500">
                                    <p>설정된 별칭이 없습니다.</p>
                                    <p className="text-sm mt-2">위의 입력창에서 컬럼을 추가해주세요.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                        💡 <strong>팁:</strong> "매출"을 "판매액"의 별칭으로 설정하면, AI가 "매출이 얼마야?"라는 질문에도 답변할 수 있습니다
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SchemaAliasManager;

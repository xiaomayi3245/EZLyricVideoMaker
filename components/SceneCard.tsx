import React from 'react';
import { ImageMarker } from '../types';

interface SceneCardProps {
    marker: ImageMarker;
    sceneNumber: number;
    onEdit: (marker: ImageMarker) => void;
    onDelete: (id: string) => void;
    onPromptChange: (id: string, prompt: string) => void;
    onRegenerate?: (id: string) => void;
}

export const SceneCard: React.FC<SceneCardProps> = ({
    marker,
    sceneNumber,
    onEdit,
    onDelete,
    onPromptChange,
    onRegenerate
}) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [customPrompt, setCustomPrompt] = React.useState(marker.customPrompt || '');

    const handleSavePrompt = () => {
        onPromptChange(marker.id, customPrompt);
        setIsEditing(false);
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                        {sceneNumber}
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-zinc-200">場景 {sceneNumber}</h4>
                        <p className="text-xs text-zinc-500">{formatTime(marker.timestamp)}</p>
                    </div>
                </div>

                {/* Status Badge */}
                {marker.isGenerating ? (
                    <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full flex items-center gap-1">
                        <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        生成中
                    </span>
                ) : marker.imageBase64 ? (
                    <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        已生成
                    </span>
                ) : (
                    <span className="text-xs px-2 py-1 bg-zinc-700 text-zinc-400 rounded-full">待生成</span>
                )}
            </div>

            {/* Lyrics Preview */}
            <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <p className="text-xs text-zinc-400 mb-1">歌詞片段:</p>
                <p className="text-sm text-zinc-300 line-clamp-2">{marker.lyrics}</p>
            </div>

            {/* Image Preview */}
            {marker.imageBase64 && (
                <div className="aspect-square w-full rounded-lg overflow-hidden border border-zinc-700">
                    <img
                        src={`data:${marker.imageMimeType};base64,${marker.imageBase64}`}
                        alt={`Scene ${sceneNumber}`}
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            {/* Custom Prompt */}
            {isEditing ? (
                <div className="space-y-2">
                    <label className="text-xs text-zinc-400">自訂提示詞 (可選):</label>
                    <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="留空將使用預設風格..."
                        className="w-full h-20 bg-zinc-900 border border-zinc-600 rounded-lg p-2 text-sm text-zinc-300 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleSavePrompt}
                            className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors"
                        >
                            儲存
                        </button>
                        <button
                            onClick={() => {
                                setCustomPrompt(marker.customPrompt || '');
                                setIsEditing(false);
                            }}
                            className="flex-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs rounded-lg transition-colors"
                        >
                            取消
                        </button>
                    </div>
                </div>
            ) : (
                marker.customPrompt && (
                    <div className="p-2 bg-zinc-900/50 rounded border border-zinc-800">
                        <p className="text-xs text-zinc-500">自訂提示詞:</p>
                        <p className="text-xs text-zinc-400 mt-1">{marker.customPrompt}</p>
                    </div>
                )
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-zinc-800">
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    編輯提示詞
                </button>
                {marker.imageBase64 && onRegenerate && (
                    <button
                        onClick={() => onRegenerate(marker.id)}
                        disabled={marker.isGenerating}
                        className="px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        重新生成
                    </button>
                )}
                <button
                    onClick={() => onDelete(marker.id)}
                    className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    刪除
                </button>
            </div>
        </div>
    );
};

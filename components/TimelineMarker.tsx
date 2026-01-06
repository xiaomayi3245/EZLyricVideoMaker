import React, { useState, useEffect } from 'react';
import { ImageMarker } from '../types';

interface SrtSubtitle {
    index: number;
    startTime: number;
    endTime: number;
    text: string;
}

interface TimelineMarkerProps {
    srtContent: string;
    markers: ImageMarker[];
    onMarkersChange: (markers: ImageMarker[]) => void;
    globalStyle: string;
    onGlobalStyleChange: (style: string) => void;
}

export const TimelineMarker: React.FC<TimelineMarkerProps> = ({
    srtContent,
    markers,
    onMarkersChange,
    globalStyle,
    onGlobalStyleChange,
}) => {
    const [subtitles, setSubtitles] = useState<SrtSubtitle[]>([]);
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

    // Parse SRT content
    useEffect(() => {
        const parsed = parseSrt(srtContent);
        setSubtitles(parsed);
    }, [srtContent]);

    const parseSrt = (srt: string): SrtSubtitle[] => {
        const blocks = srt.trim().split(/\n\s*\n/);
        const result: SrtSubtitle[] = [];

        for (const block of blocks) {
            const lines = block.split('\n');
            if (lines.length < 2) continue;

            let timingLine = '';
            let textStartIndex = 0;

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('-->')) {
                    timingLine = lines[i];
                    textStartIndex = i + 1;
                    break;
                }
            }

            if (!timingLine) continue;

            const parts = timingLine.split('-->').map(s => s.trim());
            if (parts.length !== 2) continue;

            const startTime = timeToSeconds(parts[0]);
            const endTime = timeToSeconds(parts[1]);

            if (startTime === null || endTime === null) continue;

            const text = lines.slice(textStartIndex).join(' ').trim();
            if (text) {
                result.push({
                    index: result.length,
                    startTime,
                    endTime,
                    text,
                });
            }
        }

        return result;
    };

    const timeToSeconds = (time: string): number | null => {
        time = time.trim();
        const parts = time.split(/[:,\.]/);

        let hours = 0, minutes = 0, seconds = 0, ms = 0;

        if (parts.length === 4) {
            hours = parseInt(parts[0], 10) || 0;
            minutes = parseInt(parts[1], 10) || 0;
            seconds = parseInt(parts[2], 10) || 0;
            ms = parseInt(parts[3], 10) || 0;
        } else if (parts.length === 3) {
            const p1 = parseInt(parts[0], 10) || 0;
            const p2 = parseInt(parts[1], 10) || 0;
            const p3 = parseInt(parts[2], 10) || 0;

            if (p3 > 59 || parts[2].length === 3) {
                minutes = p1;
                seconds = p2;
                ms = p3;
            } else {
                hours = p1;
                minutes = p2;
                seconds = p3;
            }
        } else {
            return null;
        }

        return hours * 3600 + minutes * 60 + seconds + ms / 1000;
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleToggleSubtitle = (index: number) => {
        const newSelected = new Set(selectedIndices);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedIndices(newSelected);
    };

    const handleCreateMarkers = () => {
        if (selectedIndices.size === 0) return;

        const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
        const newMarkers: ImageMarker[] = [];

        sortedIndices.forEach((idx, i) => {
            const subtitle = subtitles[idx];
            if (!subtitle) return;

            // 計算場景歌詞範圍
            const nextIdx: number | undefined = sortedIndices[i + 1];
            const endIdx: number = nextIdx !== undefined ? nextIdx : subtitles.length;
            const sceneLyrics = subtitles
                .slice(idx, endIdx)
                .map(s => s.text)
                .join(' ');

            const nextSubtitle = nextIdx !== undefined ? subtitles[nextIdx] : undefined;
            const endTime: number = nextSubtitle
                ? nextSubtitle.startTime
                : subtitles[subtitles.length - 1].endTime;

            newMarkers.push({
                id: `marker-${Date.now()}-${idx}`,
                timestamp: subtitle.startTime,
                endTimestamp: endTime,
                srtIndex: idx,
                lyrics: sceneLyrics,
            });
        });

        onMarkersChange(newMarkers);
        setSelectedIndices(new Set());
    };

    const isMarkerStart = (index: number): boolean => {
        return markers.some(m => m.srtIndex === index);
    };

    return (
        <div className="space-y-6">
            {/* Global Style Input */}
            <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                    全域圖片風格描述
                </label>
                <textarea
                    value={globalStyle}
                    onChange={(e) => onGlobalStyleChange(e.target.value)}
                    placeholder="例如: Cinematic, vibrant colors, anime style, consistent lighting..."
                    className="w-full h-20 bg-zinc-900 border border-zinc-600 rounded-lg p-3 text-sm text-zinc-300 placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
                <p className="text-xs text-zinc-500 mt-2">
                    此風格描述將應用於所有場景圖片，確保視覺一致性
                </p>
            </div>

            {/* Instructions */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm text-blue-300">
                        <p className="font-medium mb-1">如何標記場景：</p>
                        <ol className="list-decimal list-inside space-y-1 text-xs">
                            <li>點選字幕行來標記場景切換點</li>
                            <li>每個標記點代表新場景的開始</li>
                            <li>場景會延續到下一個標記點或影片結束</li>
                            <li>標記完成後點擊「創建場景標記」</li>
                        </ol>
                    </div>
                </div>
            </div>

            {/* Subtitle Timeline */}
            <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-zinc-300">字幕時間軸</h4>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">已選擇: {selectedIndices.size}</span>
                        {selectedIndices.size > 0 && (
                            <button
                                onClick={handleCreateMarkers}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors"
                            >
                                創建場景標記
                            </button>
                        )}
                    </div>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                    {subtitles.map((subtitle) => {
                        const isSelected = selectedIndices.has(subtitle.index);
                        const isMarker = isMarkerStart(subtitle.index);

                        return (
                            <div
                                key={subtitle.index}
                                onClick={() => handleToggleSubtitle(subtitle.index)}
                                className={`p-3 rounded-lg border cursor-pointer transition-all ${isSelected
                                    ? 'bg-blue-500/20 border-blue-500/50'
                                    : isMarker
                                        ? 'bg-purple-500/20 border-purple-500/50'
                                        : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-mono text-zinc-500">
                                                {formatTime(subtitle.startTime)} → {formatTime(subtitle.endTime)}
                                            </span>
                                            {isMarker && (
                                                <span className="text-xs px-2 py-0.5 bg-purple-500/30 text-purple-300 rounded-full">
                                                    場景標記
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-zinc-300">{subtitle.text}</p>
                                    </div>
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected
                                        ? 'bg-blue-500 border-blue-500'
                                        : 'border-zinc-600'
                                        }`}>
                                        {isSelected && (
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Summary */}
            {markers.length > 0 && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-sm text-green-300">
                        ✓ 已創建 {markers.length} 個場景標記
                    </p>
                </div>
            )}
        </div>
    );
};

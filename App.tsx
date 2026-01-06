import React, { useState, useRef, useEffect } from 'react';
import { AppStep, VideoData, ApiProvider, ApiConfig, ImageMarker } from './types';
import { StepIndicator } from './components/StepIndicator';
import { Button } from './components/Button';
import { TimelineMarker } from './components/TimelineMarker';
import { SceneCard } from './components/SceneCard';
import { generateSrtFromAudio, generateCoverImage, generateSceneImages, setApiConfig, getApiConfig, clearApiConfig } from './services/aiService';
import { videoService } from './services/ffmpegService';

export default function App() {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [data, setData] = useState<VideoData>({
    audioFile: null,
    srtContent: '',
    imageBase64: null,
    imageMimeType: null,
    generatedVideoUrl: null,
    subtitlePosition: 50,
    customImagePrompt: '',
    // 多場景功能
    useMultipleImages: false,
    imageMarkers: [],
    globalImageStyle: 'Cinematic, vibrant colors, cohesive visual narrative',
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ffmpegLogs, setFfmpegLogs] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [sceneGenerationProgress, setSceneGenerationProgress] = useState({
    current: 0,
    total: 0,
  });

  // API Config state
  const [apiConfig, setApiConfigState] = useState<ApiConfig | null>(null);
  const [apiKey, setApiKeyState] = useState<string>('');
  const [apiProvider, setApiProvider] = useState<ApiProvider>(ApiProvider.GOOGLE_GEMINI);
  const [hasApiKey, setHasApiKey] = useState(false);

  // Check for stored API Config on load
  useEffect(() => {
    const storedConfig = getApiConfig();
    if (storedConfig) {
      setApiConfigState(storedConfig);
      setApiKeyState(storedConfig.apiKey);
      setApiProvider(storedConfig.provider);
      setHasApiKey(true);
    }
  }, []);

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      const config: ApiConfig = {
        provider: apiProvider,
        apiKey: apiKey.trim(),
        geminiModel: apiProvider === ApiProvider.GOOGLE_GEMINI ? 'gemini-2.5-flash' : undefined,
        openaiModel: apiProvider === ApiProvider.OPENAI ? 'gpt-4o' : undefined,
      };
      setApiConfig(config);
      setApiConfigState(config);
      setHasApiKey(true);
      setError(null);
    } else {
      setError('請輸入有效的 API Key');
    }
  };

  const handleClearApiKey = () => {
    clearApiConfig();
    setApiConfigState(null);
    setApiKeyState('');
    setHasApiKey(false);
  };

  // Reset all data and start fresh
  const resetAndStartOver = () => {
    // Revoke old video URL to free memory
    if (data.generatedVideoUrl) {
      URL.revokeObjectURL(data.generatedVideoUrl);
    }
    // Reset all data
    setData({
      audioFile: null,
      srtContent: '',
      imageBase64: null,
      imageMimeType: null,
      generatedVideoUrl: null,
    });
    setError(null);
    setFfmpegLogs('');
    setProgress(0);
    setStep(AppStep.UPLOAD);
  };

  // -- Step 1: Upload --
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) { // 25MB limit suggestion
        setError("File too large. Please select a file under 25MB.");
        return;
      }
      setData(prev => ({ ...prev, audioFile: file }));
      setError(null);

      // Auto-start transcription
      setStep(AppStep.TRANSCRIBING);
      await processTranscription(file);
    }
  };

  // -- Step 2: Transcription --
  const processTranscription = async (file: File) => {
    setIsProcessing(true);
    try {
      const srt = await generateSrtFromAudio(file);
      setData(prev => ({ ...prev, srtContent: srt }));
      setStep(AppStep.EDIT_SRT);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Transcription failed. Please try again.");
      setStep(AppStep.UPLOAD);
    } finally {
      setIsProcessing(false);
    }
  };

  // -- Step 3: Edit SRT --
  const handleSrtChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setData(prev => ({ ...prev, srtContent: e.target.value }));
  };

  const confirmSrt = async () => {
    if (data.useMultipleImages) {
      // 進入場景標記步驟
      setStep(AppStep.MARK_SCENES);
    } else {
      // 原有流程：直接生成單張圖片
      setStep(AppStep.GENERATING_IMAGE);
      await processImageGeneration();
    }
  };

  // -- Step 4: Generate Image --
  const processImageGeneration = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const imageResult = await generateCoverImage(data.srtContent, data.customImagePrompt || undefined);
      setData(prev => ({
        ...prev,
        imageBase64: imageResult.data,
        imageMimeType: imageResult.mimeType
      }));
      setStep(AppStep.PREVIEW_DOWNLOAD);
    } catch (err: any) {
      setError(err.message || "Image generation failed.");
      // Allow retry or fallback? 
      // For now, let user try again or go back
      setStep(AppStep.EDIT_SRT);
    } finally {
      setIsProcessing(false);
    }
  };

  // -- Scene Handling Functions --
  const handleMarkersChange = (markers: ImageMarker[]) => {
    setData(prev => ({ ...prev, imageMarkers: markers }));
  };

  const handleGlobalStyleChange = (style: string) => {
    setData(prev => ({ ...prev, globalImageStyle: style }));
  };

  const handleMarkerPromptChange = (id: string, prompt: string) => {
    setData(prev => ({
      ...prev,
      imageMarkers: prev.imageMarkers.map(m =>
        m.id === id ? { ...m, customPrompt: prompt } : m
      ),
    }));
  };

  const handleDeleteMarker = (id: string) => {
    setData(prev => ({
      ...prev,
      imageMarkers: prev.imageMarkers.filter(m => m.id !== id),
    }));
  };

  const processSceneImages = async () => {
    if (data.imageMarkers.length === 0) {
      setError('請至少標記一個場景');
      return;
    }

    setIsProcessing(true);
    setStep(AppStep.GENERATING_IMAGE);
    setError(null);

    try {
      const updatedMarkers = await generateSceneImages(
        data.imageMarkers,
        data.globalImageStyle,
        (current, total, currentMarker) => {
          setSceneGenerationProgress({ current, total });
          // 即時更新已生成的圖片
          setData(prev => ({
            ...prev,
            imageMarkers: prev.imageMarkers.map(m =>
              m.id === currentMarker.id ? currentMarker : m
            ),
          }));
        }
      );

      setData(prev => ({ ...prev, imageMarkers: updatedMarkers }));
      setStep(AppStep.PREVIEW_DOWNLOAD);
    } catch (err: any) {
      setError(err.message || '場景圖片生成失敗');
      setStep(AppStep.MARK_SCENES);
    } finally {
      setIsProcessing(false);
      setSceneGenerationProgress({ current: 0, total: 0 });
    }
  };

  // -- Step 5: Video Generation (FFmpeg) --
  const generateVideo = async () => {
    if (!data.audioFile || !data.srtContent) return;

    // 檢查圖片
    if (data.useMultipleImages) {
      console.log('Multi-scene mode - validating images...');
      console.log('Total markers:', data.imageMarkers.length);
      console.log('Markers with images:', data.imageMarkers.filter(m => m.imageBase64).length);

      if (data.imageMarkers.length === 0) {
        setError('請先標記場景並生成圖片');
        return;
      }

      const missingImages = data.imageMarkers.filter(m => !m.imageBase64);
      if (missingImages.length > 0) {
        const sceneNumbers = missingImages.map((m, i) => {
          const index = data.imageMarkers.indexOf(m);
          return index + 1;
        }).join(', ');
        setError(`場景 ${sceneNumbers} 尚未生成圖片，請先生成所有場景圖片`);
        return;
      }
    } else {
      if (!data.imageBase64) {
        setError('請先生成封面圖片');
        return;
      }
    }

    setIsProcessing(true);
    setProgress(0);
    setFfmpegLogs("Initializing Video Engine...");

    try {
      // 1. Load FFmpeg
      await videoService.load((msg) => {
        setFfmpegLogs(prev => msg);
      });

      setFfmpegLogs("Engine Loaded. preparing assets...");

      let videoUrl: string;

      if (data.useMultipleImages) {
        // 多場景模式
        setFfmpegLogs("Rendering Multi-Scene Video... (This may take a moment)");
        videoUrl = await videoService.createVideoWithScenes(
          data.imageMarkers,
          data.audioFile,
          data.srtContent,
          data.subtitlePosition,
          (ratio) => setProgress(Math.round(ratio * 100))
        );
      } else {
        // 單圖片模式（原有邏輯）
        const byteCharacters = atob(data.imageBase64!);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const imageBlob = new Blob([byteArray], { type: data.imageMimeType || 'image/png' });

        setFfmpegLogs("Rendering Video... (This may take a moment)");
        videoUrl = await videoService.createVideo(
          imageBlob,
          data.audioFile,
          data.srtContent,
          data.subtitlePosition,
          (ratio) => setProgress(Math.round(ratio * 100))
        );
      }

      setData(prev => ({ ...prev, generatedVideoUrl: videoUrl }));
      setFfmpegLogs("Done!");

    } catch (err: any) {
      console.error(err);
      setError("Video generation failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // -- Render Helpers --

  // Download Helpers
  const downloadSrt = () => {
    const element = document.createElement("a");
    const file = new Blob([data.srtContent], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${data.audioFile?.name.split('.')[0] || 'subtitles'}.srt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadImage = () => {
    if (!data.imageBase64) return;
    const link = document.createElement('a');
    link.href = `data:${data.imageMimeType};base64,${data.imageBase64}`;
    link.download = 'cover_art.png';
    link.click();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center p-4 md:p-8">

      {/* Header */}
      <header className="mb-12 text-center max-w-2xl">
        <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 mb-4 tracking-tight">
          Gemini Lyric Maker
        </h1>
        <p className="text-zinc-400 text-lg">
          Transform your audio into a music video with AI-generated subtitles and art.
        </p>
      </header>

      <StepIndicator currentStep={step} />

      {/* Main Content Area */}
      <main className="w-full max-w-3xl bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-2xl p-6 md:p-10 shadow-2xl">

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-sm hover:underline">Dismiss</button>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === AppStep.UPLOAD && (
          <div className="space-y-6">
            {/* API Key Settings */}
            <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <h4 className="text-sm font-medium text-zinc-300">AI API 設定</h4>
                </div>
                {hasApiKey && (
                  <span className="text-xs text-green-400 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    已設定
                  </span>
                )}
              </div>

              {!hasApiKey ? (
                <div className="space-y-3">
                  {/* API Provider Selection */}
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-zinc-400">選擇 AI 服務:</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setApiProvider(ApiProvider.GOOGLE_GEMINI)}
                        className={`px-3 py-1 text-xs rounded-md border transition-colors ${apiProvider === ApiProvider.GOOGLE_GEMINI
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-zinc-800 border-zinc-600 text-zinc-400 hover:border-zinc-500'
                          }`}
                      >
                        Google Gemini
                      </button>
                      <button
                        onClick={() => setApiProvider(ApiProvider.OPENAI)}
                        className={`px-3 py-1 text-xs rounded-md border transition-colors ${apiProvider === ApiProvider.OPENAI
                          ? 'bg-green-600 border-green-500 text-white'
                          : 'bg-zinc-800 border-zinc-600 text-zinc-400 hover:border-zinc-500'
                          }`}
                      >
                        OpenAI
                      </button>
                    </div>
                  </div>

                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKeyState(e.target.value)}
                    placeholder={`輸入您的 ${apiProvider === ApiProvider.GOOGLE_GEMINI ? 'Gemini' : 'OpenAI'} API Key...`}
                    className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-600 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
                  />
                  <div className="flex items-center justify-between">
                    <a
                      href={apiProvider === ApiProvider.GOOGLE_GEMINI ? "https://aistudio.google.com/apikey" : "https://platform.openai.com/api-keys"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      取得 API Key
                    </a>
                    <Button onClick={handleSaveApiKey} className="!py-2 !px-4 text-sm">
                      儲存
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      {apiProvider === ApiProvider.GOOGLE_GEMINI ? 'Google Gemini' : 'OpenAI'}: {apiKey.slice(0, 8)}...{apiKey.slice(-4)}
                    </span>
                    <button
                      onClick={handleClearApiKey}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      清除
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Upload Area */}
            <div className={`text-center py-12 border-2 border-dashed rounded-xl transition-all group relative overflow-hidden ${hasApiKey
              ? 'border-zinc-700 hover:border-blue-500/50 hover:bg-zinc-800/30 cursor-pointer'
              : 'border-zinc-800 bg-zinc-900/50 opacity-60 cursor-not-allowed'
              }`}>
              <input
                type="file"
                accept="audio/mp3,audio/wav,audio/mpeg"
                onChange={handleFileUpload}
                disabled={!hasApiKey}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
              />
              <div className="flex flex-col items-center gap-4">
                <div className={`w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center transition-transform ${hasApiKey ? 'group-hover:scale-110' : ''}`}>
                  <svg className={`w-8 h-8 ${hasApiKey ? 'text-blue-400' : 'text-zinc-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <div>
                  <h3 className={`text-xl font-semibold mb-1 ${hasApiKey ? 'text-white' : 'text-zinc-500'}`}>
                    {hasApiKey ? 'Upload Song' : 'Set API Key First'}
                  </h3>
                  <p className="text-zinc-500">MP3 or WAV files, max 25MB</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Processing Transcription */}
        {step === AppStep.TRANSCRIBING && (
          <div className="text-center py-16 flex flex-col items-center gap-6">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-4 border-zinc-800"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Listening...</h3>
              <p className="text-zinc-400">Gemini is transcribing lyrics and timing.</p>
            </div>
          </div>
        )}

        {/* Step 3: Edit SRT */}
        {step === AppStep.EDIT_SRT && (
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">編輯字幕與設定</h3>
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">SRT 格式</span>
            </div>

            {/* 設定區域 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* 歌詞位置設定 */}
              <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  歌詞垂直位置: {data.subtitlePosition}%
                </label>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={data.subtitlePosition}
                  onChange={(e) => setData(prev => ({ ...prev, subtitlePosition: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-zinc-500 mt-1">
                  <span>上方</span>
                  <span>中間</span>
                  <span>下方</span>
                </div>
              </div>

              {/* 自訂圖像提示詞 */}
              <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  自訂封面提示詞 (可選)
                </label>
                <textarea
                  value={data.customImagePrompt}
                  onChange={(e) => setData(prev => ({ ...prev, customImagePrompt: e.target.value }))}
                  placeholder="留空將自動根據歌詞生成..."
                  className="w-full h-16 bg-zinc-900 border border-zinc-600 rounded-lg p-2 text-sm text-zinc-300 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              {/* 多場景模式切換 */}
              <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700 md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={data.useMultipleImages}
                    onChange={(e) => setData(prev => ({
                      ...prev,
                      useMultipleImages: e.target.checked
                    }))}
                    className="w-5 h-5 rounded border-zinc-600 bg-zinc-900 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-zinc-300">
                      啟用多場景模式
                    </span>
                    <p className="text-xs text-zinc-500 mt-1">
                      為不同歌詞段落生成不同的背景圖片，讓影片更加生動
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* SRT 編輯區域 */}
            <textarea
              value={data.srtContent}
              onChange={handleSrtChange}
              className="w-full h-64 bg-zinc-950 border border-zinc-700 rounded-lg p-4 font-mono text-sm text-zinc-300 focus:ring-2 focus:ring-blue-500 focus:outline-none mb-6 resize-none"
              placeholder="1
00:00:01,000 --> 00:00:04,000
歌詞將顯示在這裡..."
            />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={resetAndStartOver}>重新開始</Button>
              <Button onClick={confirmSrt}>生成圖像 &rarr;</Button>
            </div>
          </div>
        )}

        {/* Step 3.5: Mark Scenes */}
        {step === AppStep.MARK_SCENES && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">標記場景切換點</h3>
              <button
                onClick={() => setData(prev => ({ ...prev, useMultipleImages: false, imageMarkers: [] }))}
                className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
              >
                切換回單圖片模式
              </button>
            </div>

            {/* Timeline Marker */}
            <TimelineMarker
              srtContent={data.srtContent}
              markers={data.imageMarkers}
              onMarkersChange={handleMarkersChange}
              globalStyle={data.globalImageStyle}
              onGlobalStyleChange={handleGlobalStyleChange}
            />

            {/* Scene Cards */}
            {data.imageMarkers.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-zinc-300">
                  場景列表 ({data.imageMarkers.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.imageMarkers.map((marker, index) => (
                    <SceneCard
                      key={marker.id}
                      marker={marker}
                      sceneNumber={index + 1}
                      onEdit={(m) => console.log('Edit', m)}
                      onDelete={handleDeleteMarker}
                      onPromptChange={handleMarkerPromptChange}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
              <Button variant="secondary" onClick={() => setStep(AppStep.EDIT_SRT)}>
                上一步
              </Button>
              <Button
                onClick={processSceneImages}
                disabled={data.imageMarkers.length === 0}
              >
                生成場景圖片 ({data.imageMarkers.length}) &rarr;
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Generating Image */}
        {step === AppStep.GENERATING_IMAGE && (
          <div className="text-center py-16 flex flex-col items-center gap-6">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-4 border-zinc-800"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Imagining...</h3>
              {data.useMultipleImages && sceneGenerationProgress.total > 0 ? (
                <p className="text-zinc-400">
                  生成場景 {sceneGenerationProgress.current} / {sceneGenerationProgress.total}
                </p>
              ) : (
                <p className="text-zinc-400">Creating cover art based on your lyrics.</p>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Preview & Download */}
        {step === AppStep.PREVIEW_DOWNLOAD && (
          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Cover Art / Scene Images Preview */}
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium text-zinc-400">
                  {data.useMultipleImages ? `場景圖片 (${data.imageMarkers.length})` : 'Generated Cover Art'}
                </h4>

                {data.useMultipleImages ? (
                  // 多場景模式：顯示所有場景圖片
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {data.imageMarkers.map((marker, index) => (
                      <div key={marker.id} className="relative group">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-zinc-500">場景 {index + 1}</span>
                          {marker.imageBase64 ? (
                            <span className="text-xs text-green-500">✓</span>
                          ) : (
                            <span className="text-xs text-red-500">✗ 未生成</span>
                          )}
                        </div>
                        {marker.imageBase64 ? (
                          <div className="aspect-video w-full rounded-lg overflow-hidden border border-zinc-700">
                            <img
                              src={`data:${marker.imageMimeType};base64,${marker.imageBase64}`}
                              alt={`Scene ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="aspect-video w-full rounded-lg border border-zinc-700 bg-zinc-900 flex items-center justify-center">
                            <span className="text-xs text-zinc-600">圖片未生成</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  // 單圖片模式：顯示封面
                  <div className="aspect-square w-full rounded-xl overflow-hidden border border-zinc-700 relative group">
                    {data.imageBase64 && (
                      <img
                        src={`data:${data.imageMimeType};base64,${data.imageBase64}`}
                        alt="Generated Art"
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button onClick={downloadImage} className="text-white bg-black/50 p-2 rounded-full backdrop-blur hover:bg-white/20 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Video Action Area */}
              <div className="flex flex-col justify-between gap-4">
                <div>
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">Subtitles</h4>
                  <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 h-48 overflow-y-auto text-xs font-mono text-zinc-500">
                    <pre className="whitespace-pre-wrap">{data.srtContent}</pre>
                  </div>
                  <button onClick={downloadSrt} className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    Download .srt file
                  </button>
                </div>

                <div className="pt-4 border-t border-zinc-800">
                  {!data.generatedVideoUrl ? (
                    <div className="flex flex-col gap-3">
                      {!isProcessing ? (
                        <>
                          <Button
                            onClick={generateVideo}
                            className="w-full"
                          >
                            🎬 Create MP4 Video
                          </Button>
                          <p className="text-xs text-zinc-500 text-center">
                            Uses browser processing, may take a moment
                          </p>
                        </>
                      ) : (
                        <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700 space-y-4">
                          {/* Title and percentage */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                              <span className="text-sm font-medium text-zinc-200">Generating Video...</span>
                            </div>
                            <span className="text-2xl font-bold text-blue-400">{progress}%</span>
                          </div>

                          {/* Progress bar */}
                          <div className="relative">
                            <div className="h-3 w-full bg-zinc-900 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-600 to-purple-500 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* Status message */}
                          <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 bg-zinc-900/50 rounded-lg py-2 px-3">
                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="font-mono truncate">{ffmpegLogs || 'Preparing...'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 animate-fade-in">
                      <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm text-center">
                        Video Ready!
                      </div>
                      <a
                        href={data.generatedVideoUrl}
                        download="lyric_video.mp4"
                        className="w-full"
                      >
                        <Button className="w-full" variant="primary">
                          Download Video
                          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        </Button>
                      </a>
                      <Button onClick={resetAndStartOver} variant="secondary" className="w-full">
                        Make Another
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-12 text-zinc-600 text-sm">
        Powered by Gemini Flash 2.5 & FFmpeg.wasm
      </footer>
    </div>
  );
}
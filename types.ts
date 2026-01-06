export enum AppStep {
  UPLOAD = 0,
  TRANSCRIBING = 1,
  EDIT_SRT = 2,
  MARK_SCENES = 3,        // 新增：標記場景步驟
  GENERATING_IMAGE = 4,   // 更新索引
  PREVIEW_DOWNLOAD = 5,   // 更新索引
}

export enum ApiProvider {
  GOOGLE_GEMINI = 'google_gemini',
  OPENAI = 'openai',
}

export interface ImageMarker {
  id: string;                    // 唯一識別碼
  timestamp: number;              // 場景開始時間（秒）
  srtIndex: number;               // 對應的 SRT 字幕索引
  endTimestamp?: number;          // 場景結束時間（秒，可選）
  lyrics: string;                 // 此場景的歌詞內容
  imageBase64?: string;           // 生成的圖片（base64）
  imageMimeType?: string;         // 圖片 MIME 類型
  customPrompt?: string;          // 自訂提示詞
  isGenerating?: boolean;         // 是否正在生成中
}

export interface VideoData {
  audioFile: File | null;
  srtContent: string;
  imageBase64: string | null;
  imageMimeType: string | null;
  generatedVideoUrl: string | null;
  subtitlePosition: number;       // 0-100, 歌詞垂直位置百分比
  customImagePrompt: string;      // 自訂圖像提示詞
  // 多圖片場景功能
  useMultipleImages: boolean;     // 是否啟用多場景模式
  imageMarkers: ImageMarker[];    // 場景標記陣列
  globalImageStyle: string;       // 全域圖片風格描述
}

export interface FfmpegLog {
  type: string;
  message: string;
}

export interface ApiConfig {
  provider: ApiProvider;
  apiKey: string;
  geminiModel?: string;
  openaiModel?: string;
}
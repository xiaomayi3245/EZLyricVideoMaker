export enum AppStep {
  UPLOAD = 0,
  TRANSCRIBING = 1,
  EDIT_SRT = 2,
  GENERATING_IMAGE = 3,
  PREVIEW_DOWNLOAD = 4,
}

export enum ApiProvider {
  GOOGLE_GEMINI = 'google_gemini',
  OPENAI = 'openai',
}

export interface VideoData {
  audioFile: File | null;
  srtContent: string;
  imageBase64: string | null;
  imageMimeType: string | null;
  generatedVideoUrl: string | null;
  subtitlePosition: number; // 0-100, 歌詞垂直位置百分比
  customImagePrompt: string; // 自訂圖像提示詞
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
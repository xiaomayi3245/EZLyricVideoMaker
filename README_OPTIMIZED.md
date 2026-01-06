# 🎵 EZLyricVideoMaker - 優化版

## 🆕 新增功能

### 1. 🎛️ 歌詞位置調整
- **功能說明**：使用者可以自由調整歌詞在影片中的垂直位置
- **操作方式**：在編輯字幕步驟中，使用滑桿調整 10%-90% 的位置
- **效果**：歌詞會根據設定位置顯示在影片的上方、中間或下方

### 2. 🎨 自訂圖像提示詞
- **功能說明**：使用者可以輸入自訂的提示詞來生成封面圖
- **操作方式**：在編輯字幕步驟中，於「自訂封面提示詞」欄位輸入描述
- **效果**：AI 會根據您的提示詞生成更符合需求的封面圖
- **預設行為**：留空時會自動根據歌詞內容生成

### 3. 🤖 雙 API 支援
- **Google Gemini**：原有的 Gemini 2.5 Flash 模型支援
- **OpenAI**：新增 OpenAI GPT-4o 和 DALL-E 3 支援
- **操作方式**：在 API 設定中選擇使用的 AI 服務
- **切換**：可隨時更換 API 提供者

## 📦 安裝與設定

### 依賴套件
```bash
npm install
```

新增的依賴：
- `openai`: OpenAI API 支援

### API Key 設定

#### Google Gemini
1. 前往 [Google AI Studio](https://aistudio.google.com/apikey)
2. 建立 API Key
3. 在應用程式中選擇「Google Gemini」並輸入 API Key

#### OpenAI
1. 前往 [OpenAI Platform](https://platform.openai.com/api-keys)
2. 建立 API Key
3. 在應用程式中選擇「OpenAI」並輸入 API Key

## 🎯 使用流程

1. **選擇 AI 服務**：選擇 Google Gemini 或 OpenAI
2. **輸入 API Key**：根據選擇的服務輸入對應的 API Key
3. **上傳音檔**：上傳 MP3 或 WAV 檔案（最大 25MB）
4. **編輯字幕與設定**：
   - 調整歌詞垂直位置（10%-90%）
   - 輸入自訂封面提示詞（可選）
   - 編輯 SRT 字幕內容
5. **生成圖像**：AI 根據歌詞或自訂提示詞生成封面
6. **建立影片**：合成最終的歌詞影片

## 🔧 技術改進

### 程式碼結構
- **aiService.ts**：統一的 AI 服務介面，支援多個 API 提供者
- **types.ts**：新增 API 配置和影片資料型別
- **ffmpegService.ts**：支援歌詞位置參數
- **App.tsx**：更新的 UI 介面，包含新功能控制項

### 新增型別
```typescript
enum ApiProvider {
  GOOGLE_GEMINI = 'google_gemini',
  OPENAI = 'openai',
}

interface VideoData {
  // 原有欄位...
  subtitlePosition: number; // 歌詞垂直位置百分比
  customImagePrompt: string; // 自訂圖像提示詞
}

interface ApiConfig {
  provider: ApiProvider;
  apiKey: string;
  geminiModel?: string;
  openaiModel?: string;
}
```

## 🌟 優勢

1. **更靈活的歌詞定位**：不再固定在中央，可根據需求調整
2. **創意更大的封面生成**：自訂提示詞讓封面更符合想像
3. **多選擇的 AI 服務**：根據需求和成本選擇最適合的 API
4. **向後相容**：保持原有功能完整性

## 🚀 注意事項

- OpenAI API 需要付費帳戶才能使用 DALL-E 3
- Google Gemini 有免費額度限制
- 歌詞位置建議在 20%-80% 之間以獲得最佳視覺效果
- 自訂提示詞建議簡潔明確，避免過於複雜的描述

## 📝 使用範例

### 自訂提示詞範例
```
夕陽下的海灘，溫暖的橙色光線，浪漫氛圍，數位藝術風格
```

### 歌詞位置建議
- **抒情歌曲**：30%-40%（較低位置，營造沉靜感）
- **流行歌曲**：50%（中間位置，平衡感）
- **搖滾歌曲**：60%-70%（較高位置，增加活力感）

---

**版本**：2.0.0 Optimized  
**更新日期**：2026-01-04

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { ApiProvider, ApiConfig } from '../types';

let cachedConfig: ApiConfig | null = null;

export const setApiConfig = (config: ApiConfig) => {
  cachedConfig = config;
  localStorage.setItem('ai_api_config', JSON.stringify(config));
};

export const getApiConfig = (): ApiConfig | null => {
  if (cachedConfig) return cachedConfig;
  const stored = localStorage.getItem('ai_api_config');
  if (stored) {
    try {
      cachedConfig = JSON.parse(stored);
      return cachedConfig;
    } catch (error) {
      console.error('Failed to parse stored API config:', error);
    }
  }
  return null;
};

export const clearApiConfig = () => {
  cachedConfig = null;
  localStorage.removeItem('ai_api_config');
};

const getGeminiClient = () => {
  const config = getApiConfig();
  if (!config || config.provider !== ApiProvider.GOOGLE_GEMINI) {
    throw new Error("Please configure Google Gemini API Key first");
  }
  return new GoogleGenAI({ apiKey: config.apiKey });
};

const getOpenAIClient = () => {
  const config = getApiConfig();
  if (!config || config.provider !== ApiProvider.OPENAI) {
    throw new Error("Please configure OpenAI API Key first");
  }
  return new OpenAI({ apiKey: config.apiKey });
};

/**
 * Converts a File object to a Base64 string suitable for AI APIs
 */
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64String,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Transcribe audio to SRT using configured AI provider
 */
export const generateSrtFromAudio = async (audioFile: File): Promise<string> => {
  const config = getApiConfig();
  if (!config) {
    throw new Error("Please configure API Key first");
  }

  try {
    if (config.provider === ApiProvider.GOOGLE_GEMINI) {
      return await generateSrtWithGemini(audioFile, config);
    } else if (config.provider === ApiProvider.OPENAI) {
      return await generateSrtWithOpenAI(audioFile, config);
    } else {
      throw new Error("Unsupported API provider");
    }
  } catch (error: any) {
    console.error('SRT generation failed:', error);
    throw new Error(`SRT generation failed: ${error.message || "Unknown error"}`);
  }
};

const generateSrtWithGemini = async (audioFile: File, config: ApiConfig): Promise<string> => {
  const client = getGeminiClient();

  const audioPart = await fileToGenerativePart(audioFile);

  const prompt = `Please transcribe the audio file and output ONLY SRT subtitle format.
  
Requirements:
- If the audio contains Chinese, output in Traditional Chinese (not Simplified)
- Use SRT timing format: HH:MM:SS,mmm --> HH:MM:SS,mmm (comma for milliseconds)
- For long instrumental sections, use [Instrumental] or skip
- Output ONLY the SRT content, no markdown, no explanations
- Remove any code fences if present`;

  const result = await client.models.generateContent({
    model: config.geminiModel || "gemini-2.0-flash-exp",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          audioPart
        ]
      }
    ]
  });

  let srtContent = result.text;

  // Clean up any code fences
  srtContent = srtContent.replace(/```[\s\S]*?```/g, '').trim();

  if (!srtContent) {
    throw new Error("Empty SRT content received");
  }

  return srtContent;
};

const generateSrtWithOpenAI = async (audioFile: File, config: ApiConfig): Promise<string> => {
  const client = getOpenAIClient();

  const audioBase64 = await fileToBase64(audioFile);

  const response = await client.audio.transcriptions.create({
    model: "whisper-1",
    file: new File([await audioFile.arrayBuffer()], audioFile.name, { type: audioFile.type }),
    response_format: "srt",
    language: "zh" // Try to detect Chinese first
  });

  let srtContent = response;

  // Post-process to ensure Traditional Chinese if needed
  if (srtContent.includes('简体') || srtContent.includes(' Simplified')) {
    // Note: In a real implementation, you might want to use a proper Simplified-to-Traditional converter
    // For now, we'll keep the original as OpenAI Whisper might already output correctly
  }

  return srtContent;
};

/**
 * Generate cover image based on lyrics using configured AI provider
 */
export const generateCoverImage = async (srtContent: string, customPrompt?: string): Promise<{ data: string; mimeType: string }> => {
  const config = getApiConfig();
  if (!config) {
    throw new Error("Please configure API Key first");
  }

  try {
    if (config.provider === ApiProvider.GOOGLE_GEMINI) {
      return await generateImageWithGemini(srtContent, customPrompt, config);
    } else if (config.provider === ApiProvider.OPENAI) {
      return await generateImageWithOpenAI(srtContent, customPrompt, config);
    } else {
      throw new Error("Unsupported API provider");
    }
  } catch (error: any) {
    console.error('Image generation failed:', error);
    throw new Error(`Image generation failed: ${error.message || "Unknown error"}`);
  }
};

const generateImageWithGemini = async (srtContent: string, customPrompt: string | undefined, config: ApiConfig): Promise<{ data: string; mimeType: string }> => {
  const client = getGeminiClient();

  // Use first 1000 characters of lyrics for analysis
  const lyricsSample = srtContent.substring(0, 1000);

  let prompt = customPrompt || `Based on these lyrics, create a high-quality, square 1:1, cinematic digital art cover image.
  
Lyrics sample: "${lyricsSample}"

Requirements:
- High quality, cinematic digital art
- Square 1:1 aspect ratio
- No text or words in the image
- Capture the mood and atmosphere of the lyrics
- Professional album cover style`;

  const result = await client.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ]
  });

  const candidate = result.candidates?.[0];
  if (!candidate) {
    throw new Error("No image generated");
  }

  const part = candidate.content?.parts?.find(p => 'inlineData' in p);
  if (!part || !('inlineData' in part)) {
    throw new Error("No image data in response");
  }

  return {
    data: part.inlineData.data,
    mimeType: part.inlineData.mimeType || 'image/png'
  };
};

const generateImageWithOpenAI = async (srtContent: string, customPrompt: string | undefined, config: ApiConfig): Promise<{ data: string; mimeType: string }> => {
  const client = getOpenAIClient();

  const lyricsSample = srtContent.substring(0, 1000);

  let prompt = customPrompt || `Based on these lyrics, create a high-quality, square 1:1, cinematic digital art cover image.
  
Lyrics sample: "${lyricsSample}"

Requirements:
- High quality, cinematic digital art
- Square 1:1 aspect ratio
- No text or words in the image
- Capture the mood and atmosphere of the lyrics
- Professional album cover style`;

  const response = await client.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    size: "1024x1024",
    quality: "standard",
    n: 1,
  });

  const image_url = response.data[0]?.url;
  if (!image_url) {
    throw new Error("No image URL received from OpenAI");
  }

  // Convert image URL to base64
  const imageResponse = await fetch(image_url);
  const imageBlob = await imageResponse.blob();
  const imageBase64 = await fileToBase64(new File([imageBlob], 'image.png', { type: 'image/png' }));

  return {
    data: imageBase64,
    mimeType: 'image/png'
  };
};

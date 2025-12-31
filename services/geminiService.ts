
import { GoogleGenAI, Type, Modality, LiveServerMessage } from "@google/genai";
import { TranslationResult, RiskLevel, ElevenLabsVoice, SessionHistoryItem } from "../types";

const MASTER_SYSTEM_PROMPT = `
You are **SentinelVoice AI**, an advanced reasoning and multilingual communication guardian. 
Your core mission is semantic integrity, safety, and intent preservation.

ACT AS A REASONING BRIDGE:
1. **Adaptive Context-Awareness**: Use history to resolve references.
2. **Multi-Pass Semantic Verification**: Internally re-evaluate translations.
3. **Intent Consistency**: Identify and preserve emotional/functional intent.
4. **Ambiguity Resolution**: Clarify choices via 'semantic_explanation'.
5. **Explainability**: Generate 'reasoning_summary'.
6. **Hallucination Resistance**: Downgrade confidence for speculative translations.
`;

export class GeminiService {
  async processAudioInput(
    audioBase64: string, 
    mimeType: string, 
    targetLanguage: string,
    useGrounding: boolean = false,
    history: SessionHistoryItem[] = []
  ): Promise<TranslationResult> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const contextString = history.slice(0, 5).reverse().map(item => 
      `User (${item.result.detected_language}): ${item.userInput}\nSentinel (${targetLanguage}): ${item.result.translation.translated_text}`
    ).join('\n---\n');

    const promptText = `
    TARGET LANGUAGE: "${targetLanguage}"
    CONVERSATIONAL CONTEXT: ${contextString || "No history."}
    ${useGrounding ? "USE GOOGLE SEARCH to verify cultural idioms or facts." : ""}
    Output JSON.
    `;

    const config: any = {
      systemInstruction: MASTER_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detected_language: { type: Type.STRING },
          translation: {
            type: Type.OBJECT,
            properties: {
              translated_text: { type: Type.STRING },
              alternate_meanings: { type: Type.ARRAY, items: { type: Type.STRING } },
              ambiguity_detected: { type: Type.BOOLEAN },
              semantic_explanation: { type: Type.STRING }
            },
            required: ["translated_text", "alternate_meanings", "ambiguity_detected"]
          },
          evaluation: {
            type: Type.OBJECT,
            properties: {
              confidence_score: { type: Type.NUMBER },
              risk_level: { type: Type.STRING, enum: Object.values(RiskLevel) },
              risk_reason: { type: Type.STRING },
              potential_harm: { type: Type.STRING },
              reasoning_summary: { type: Type.STRING }
            },
            required: ["confidence_score", "risk_level", "risk_reason", "potential_harm", "reasoning_summary"]
          },
          intent_analysis: {
            type: Type.OBJECT,
            properties: {
              original_intent: { type: Type.STRING },
              emotional_tone: { type: Type.STRING },
              functional_goal: { type: Type.STRING },
              consistency_score: { type: Type.NUMBER }
            },
            required: ["original_intent", "emotional_tone", "functional_goal", "consistency_score"]
          },
          safety: {
            type: Type.OBJECT,
            properties: {
              should_warn_user: { type: Type.BOOLEAN },
              safety_message: { type: Type.STRING }
            },
            required: ["should_warn_user", "safety_message"]
          },
          voice_policy: {
            type: Type.OBJECT,
            properties: {
              voice_language: { type: Type.STRING },
              voice_tone: { type: Type.STRING },
              speaking_speed: { type: Type.STRING },
              emphasis: { type: Type.STRING }
            },
            required: ["voice_language", "voice_tone", "speaking_speed", "emphasis"]
          }
        },
        required: ["detected_language", "translation", "evaluation", "intent_analysis", "safety", "voice_policy"]
      }
    };

    if (useGrounding) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ inlineData: { data: audioBase64, mimeType } }, { text: promptText }] }],
      config
    });

    try {
      const result = JSON.parse(response.text || '{}') as TranslationResult;
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        result.grounding_info = {
          sources: groundingChunks.filter((c: any) => c.web).map((c: any) => ({
            title: c.web.title,
            uri: c.web.uri
          }))
        };
      }
      return result;
    } catch (e) {
      throw new Error("Invalid response format.");
    }
  }

  connectLive(targetLanguage: string, callbacks: {
    onAudio: (data: string) => void;
    onInterruption: () => void;
    onTranscription?: (text: string, isModel: boolean) => void;
  }) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => console.log("Live Connected"),
        onmessage: async (msg: LiveServerMessage) => {
          const audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (audio) callbacks.onAudio(audio);
          
          if (msg.serverContent?.interrupted) callbacks.onInterruption();
          
          if (callbacks.onTranscription) {
            if (msg.serverContent?.outputTranscription) {
              callbacks.onTranscription(msg.serverContent.outputTranscription.text, true);
            } else if (msg.serverContent?.inputTranscription) {
              callbacks.onTranscription(msg.serverContent.inputTranscription.text, false);
            }
          }
        },
        onerror: (e) => console.error("Live Error", e),
        onclose: () => console.log("Live Closed")
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        systemInstruction: `${MASTER_SYSTEM_PROMPT}\nTRANSLATE EVERYTHING TO ${targetLanguage} INSTANTLY.`,
        outputAudioTranscription: {},
        inputAudioTranscription: {}
      }
    });
  }

  async getVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
    if (!apiKey) return [];
    try {
      const response = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": apiKey } });
      const data = await response.json();
      return data.voices.map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
        preview_url: v.preview_url
      }));
    } catch (e) {
      return [];
    }
  }

  async speak(text: string, policy: TranslationResult['voice_policy'], engine: 'GEMINI' | 'ELEVEN_LABS', elKey?: string, elVoice?: string) {
    if (engine === 'ELEVEN_LABS' && elKey) {
      try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elVoice || '21m00Tcm4TlvDq8ikWAM'}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'xi-api-key': elKey },
          body: JSON.stringify({ text, model_id: "eleven_flash_v2_5" })
        });
        return { data: await response.arrayBuffer(), engineUsed: 'ELEVEN_LABS' as const };
      } catch (err) {
        console.warn("Falling back to Gemini");
      }
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say in ${policy.voice_language}: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    const audio = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return { data: this.decodeBase64(audio!), engineUsed: 'GEMINI' as const };
  }

  private decodeBase64(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
}

export const gemini = new GeminiService();


export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export enum TTSEngine {
  GEMINI = 'GEMINI',
  ELEVEN_LABS = 'ELEVEN_LABS'
}

export enum AppMode {
  SNAPSHOT = 'SNAPSHOT',
  LIVE = 'LIVE'
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  preview_url: string;
}

export interface TranslationResult {
  detected_language: string;
  translation: {
    translated_text: string;
    alternate_meanings: string[];
    ambiguity_detected: boolean;
    semantic_explanation?: string;
  };
  evaluation: {
    confidence_score: number;
    risk_level: RiskLevel;
    risk_reason: string;
    potential_harm: string;
    reasoning_summary: string;
  };
  intent_analysis: {
    original_intent: string;
    emotional_tone: string;
    functional_goal: string;
    consistency_score: number;
  };
  safety: {
    should_warn_user: boolean;
    safety_message: string;
  };
  voice_policy: {
    voice_language: string;
    voice_tone: string;
    speaking_speed: 'slow' | 'normal' | 'fast';
    emphasis: 'low' | 'medium' | 'high';
  };
  grounding_info?: {
    sources: { title: string; uri: string }[];
  };
}

export interface SessionHistoryItem {
  id: string;
  timestamp: Date;
  userInput: string;
  result: TranslationResult;
}

export const TARGET_LANGUAGES = [
  "English", "French", "German", "Spanish", "Hindi", "Marathi", "Gujarati", "Japanese", "Chinese"
];

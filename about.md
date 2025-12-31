# About SentinelVoice AI

## Inspiration
The inspiration for **SentinelVoice AI** (developed by Team **SilverFang**) came from a simple observation: words are easy to translate, but *meaning* is hard to preserve. Traditional translation tools often strip away the emotion, urgency, and subtle nuances that make human speech meaningful. We wanted to build a "Neural Bridge" that doesn't just swap words, but understands the *soul* of the conversation, ensuring that communication remains authentic across any language barrier.

## What it does
SentinelVoice AI is a real-time, multimodal reasoning bridge. It captures live audio, performs deep semantic analysis, and synthesizes speech in a target language while preserving the original intent. It features:
- **Live Neural Link**: Low-latency streaming translation for fluid conversations.
- **Intent Snapshot**: Multi-pass verification for high-stakes or complex expressions.
- **Safety Audit**: Real-time evaluation of risk, ambiguity, and potential harm.
- **Semantic Grounding**: Integration with Google Search to verify cultural references and facts.
- **Neural Synthesis**: Human-like voice output using Gemini TTS and ElevenLabs.

## How we built it
The project is built on a high-performance, modern tech stack:
- **Core AI**: Google Gemini 2.5 Flash (for speed) and Gemini 3 Pro Preview (for deep reasoning).
- **Backend API**: Integrated via `@google/genai` for seamless model orchestration.
- **Frontend**: A sleek, reactive UI built with **React 19** and **Vite**, featuring a custom-crafted glassmorphic design system.
- **Audio Pipeline**: Utilizes the **Web Audio API** and `MediaRecorder` for low-latency processing and real-time visualization.
- **Voice Engine**: A hybrid synthesis system combining Google's prebuilt voices with **ElevenLabs'** high-fidelity models.

## Challenges we ran into
- **Audio Latency**: Capturing, processing, and re-synthesizing voice in real-time without significant lag was our biggest hurdle. We solved this by optimizing PCM data conversion and leveraging Gemini's low-latency streaming modes.
- **Semantic Drift**: Preventing the loss of emotional tone during translation required fine-tuning the system instructions to prioritize "Intent Preservation" over literal word replacement.
- **State Management**: Handling interrupted audio streams and maintaining a coherent conversational context in a real-time environment required a robust custom event system.

## Accomplishments that we're proud of
- **True Intent Preservation**: Successfully building an engine that captures not just what is said, but the *way* it is said (emotional tone and functional goal).
- **Premium Aesthetics**: Creating a futuristic "Neural Interface" that feels alive and responsive, rather than just a functional tool.
- **Real-time Safety Integration**: Implementing a reasoning layer that audits every translation for risk before it reaches the listener.

## What we learned
- **Multimodal Potential**: We discovered the incredible power of Gemini's native audio capabilities, which significantly outperform traditional STT -> LLM -> TTS pipelines.
- **Context is King**: We learned that for meaningful translation, a history of the last 5-10 seconds is more valuable than a dictionary of a million words.
- **User Trust**: Providing "Internal Reasoning" summaries to the user builds immense trust in the AI's translation decisions.

## What's next for SentinelVoice AI
- **Multi-Speaker Support**: Identifying and separating different voices in a room to facilitate group discussions.
- **Expanded Grounding**: Connecting to more real-time data sources for specialized industries like medical or legal translation.
- **Mobile Integration**: Bringing the Ethereal Neural Bridge to mobile devices for on-the-go communication.
- **Custom Voice Cloning**: Allowing users to clone their own voice safely for personalized translations.

---
<div align="center">
  <p>Developed by **Team SilverFang** | Built with ❤️ by Shivam Raut and Meet Shah</p>
</div>

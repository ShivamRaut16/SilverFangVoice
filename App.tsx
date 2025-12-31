
import React, { useState, useEffect, useRef } from 'react';
import { gemini } from './services/geminiService';
import { TranslationResult, TARGET_LANGUAGES, SessionHistoryItem, RiskLevel, TTSEngine, AppMode } from './types';
import RiskBadge from './components/RiskBadge';
import SettingsPanel from './components/SettingsPanel';
import LiveMicIndicator from './components/LiveMicIndicator';
import NeuralVision from './components/NeuralVision';

const DEFAULT_EL_KEY = 'd36bddd90478f0db26ae13df021d95847027f971bfadeadc4032212b6ebe4123';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.SNAPSHOT);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetLang, setTargetLang] = useState('English');
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [useGrounding, setUseGrounding] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<{ text: string, isModel: boolean }[]>([]);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [ttsEngine, setTtsEngine] = useState<TTSEngine>(TTSEngine.GEMINI);
  const [elevenLabsKey, setElevenLabsKey] = useState(localStorage.getItem('sv_el_key') || DEFAULT_EL_KEY);
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState(localStorage.getItem('sv_el_voice') || '21m00Tcm4TlvDq8ikWAM');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const currentTone = history[0]?.result.intent_analysis.emotional_tone || 'Neutral';

  // Persist EL key if changed by user
  useEffect(() => {
    localStorage.setItem('sv_el_key', elevenLabsKey);
  }, [elevenLabsKey]);

  useEffect(() => {
    localStorage.setItem('sv_el_voice', elevenLabsVoiceId);
  }, [elevenLabsVoiceId]);

  // --- LIVE SESSION LOGIC ---
  const toggleLiveMode = async () => {
    if (isLiveActive) {
      if (liveSessionRef.current) {
        try { liveSessionRef.current.close(); } catch(e) {}
      }
      setIsLiveActive(false);
      setLiveTranscript([]);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      
      const sessionPromise = gemini.connectLive(targetLang, {
        onAudio: async (base64) => {
          if (!audioContextRef.current) return;
          const ctx = audioContextRef.current;
          
          if (ctx.state === 'suspended') await ctx.resume();
          
          nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
          const data = decodeBase64(base64);
          const audioBuffer = await decodeAudioData(data, ctx, 24000, 1);
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          
          source.onended = () => {
            sourcesRef.current.delete(source);
          };

          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += audioBuffer.duration;
          sourcesRef.current.add(source);
        },
        onInterruption: () => {
          sourcesRef.current.forEach(s => {
            try { s.stop(); } catch(e) {}
          });
          sourcesRef.current.clear();
          nextStartTimeRef.current = 0;
        },
        onTranscription: (text, isModel) => {
          setLiveTranscript(prev => {
            const last = prev[prev.length - 1];
            if (last && last.isModel === isModel) {
              return [...prev.slice(0, -1), { text: last.text + ' ' + text, isModel }];
            }
            return [...prev, { text, isModel }].slice(-5);
          });
        }
      });

      const session = await sessionPromise;
      liveSessionRef.current = session;

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        if (!liveSessionRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(inputData.length);
        for(let i=0; i<inputData.length; i++) pcm[i] = inputData[i] * 32767;
        
        session.sendRealtimeInput({ 
          media: { 
            data: encodeBase64(new Uint8Array(pcm.buffer)), 
            mimeType: 'audio/pcm;rate=16000' 
          }
        });
      };
      source.connect(processor);
      processor.connect(inputCtx.destination);
      
      setIsLiveActive(true);
    } catch (err) {
      console.error(err);
      setError("Failed to start Live Neural Bridge. Check microphone permissions.");
    }
  };

  const decodeBase64 = (b64: string) => {
    const bin = atob(b64);
    const res = new Uint8Array(bin.length);
    for(let i=0; i<bin.length; i++) res[i] = bin.charCodeAt(i);
    return res;
  };

  const encodeBase64 = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, rate: number, chans: number) => {
    const i16 = new Int16Array(data.buffer);
    const buf = ctx.createBuffer(chans, i16.length / chans, rate);
    for(let c=0; c<chans; c++) {
      const cd = buf.getChannelData(c);
      for(let i=0; i<buf.length; i++) cd[i] = i16[i * chans + c] / 32768.0;
    }
    return buf;
  };

  // --- SNAPSHOT LOGIC ---
  const startRecording = async () => {
    try {
      setIsRecording(true);
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          setIsProcessing(true);
          try {
            const b64 = (reader.result as string).split(',')[1];
            const result = await gemini.processAudioInput(b64, blob.type, targetLang, useGrounding, history);
            setHistory(prev => [{ id: Date.now().toString(), timestamp: new Date(), userInput: "[Spoken]", result }, ...prev]);
            await handleSpeak(result);
          } catch (e) { setError("Analysis failed."); }
          setIsProcessing(false);
        };
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (e) {
      setError("Could not access microphone.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    setIsRecording(false);
  };

  const handleSpeak = async (result: TranslationResult) => {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

    try {
      const { data, engineUsed } = await gemini.speak(result.translation.translated_text, result.voice_policy, ttsEngine, elevenLabsKey, elevenLabsVoiceId);
      let buf;
      if (engineUsed === 'ELEVEN_LABS') {
        buf = await audioContextRef.current.decodeAudioData(data);
      } else {
        buf = await decodeAudioData(new Uint8Array(data), audioContextRef.current, 24000, 1);
      }
      const src = audioContextRef.current.createBufferSource();
      src.buffer = buf;
      src.connect(audioContextRef.current.destination);
      src.start();
    } catch (err) {
      console.error("Speech playback error", err);
    }
  };

  const sendVisionFrame = (b64: string) => {
    if (isLiveActive && liveSessionRef.current) {
      liveSessionRef.current.sendRealtimeInput({ media: { data: b64, mimeType: 'image/jpeg' } });
    }
  };

  return (
    <div className="min-h-screen bg-[#050810] flex flex-col text-slate-200 font-sans selection:bg-indigo-500/30">
      <header className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <i className="fas fa-microchip text-white text-xl animate-pulse"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">SentinelVoice AI</h1>
            <p className="text-[10px] text-indigo-400/80 uppercase tracking-widest font-black">Ethereal Neural Bridge</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex bg-slate-900/50 p-1 rounded-xl border border-white/5">
            <button onClick={() => setMode(AppMode.SNAPSHOT)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === AppMode.SNAPSHOT ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Snapshot</button>
            <button onClick={() => setMode(AppMode.LIVE)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === AppMode.LIVE ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Live</button>
          </div>
          <select value={targetLang} onChange={e => setTargetLang(e.target.value)} className="bg-slate-900 border border-white/10 text-xs rounded-lg p-2 outline-none">
            {TARGET_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-slate-900 border border-white/10 rounded-lg text-slate-400 hover:text-indigo-400">
            <i className="fas fa-dna"></i>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl text-rose-300 text-sm flex items-center gap-3 animate-in fade-in zoom-in duration-300">
            <i className="fas fa-circle-exclamation"></i>
            {error}
            <button onClick={() => setError(null)} className="ml-auto opacity-50 hover:opacity-100">✕</button>
          </div>
        )}

        <section className="glass-panel rounded-[2.5rem] p-12 text-center flex flex-col items-center gap-8 relative overflow-hidden border-indigo-500/10 shadow-[0_0_100px_rgba(79,70,229,0.05)]">
          <NeuralVision isActive={isLiveActive || isRecording} onFrame={sendVisionFrame} />
          
          <div className="z-10 flex flex-col items-center">
            <h2 className="text-4xl font-black mb-2 tracking-tighter uppercase italic">
              {mode === AppMode.LIVE ? 'Live Neural Link' : 'Intent Snapshot'}
            </h2>
            <div className="flex items-center gap-4">
               {mode === AppMode.SNAPSHOT && (
                 <label className="flex items-center gap-2 cursor-pointer group">
                   <div className={`w-10 h-5 rounded-full relative transition-all ${useGrounding ? 'bg-emerald-600' : 'bg-slate-800'}`}>
                     <input type="checkbox" className="hidden" checked={useGrounding} onChange={() => setUseGrounding(!useGrounding)} />
                     <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${useGrounding ? 'left-6' : 'left-1'}`}></div>
                   </div>
                   <span className="text-[10px] font-bold text-slate-500 uppercase group-hover:text-emerald-400 transition-colors">Deep Grounding</span>
                 </label>
               )}
            </div>
          </div>

          <div className="relative flex items-center justify-center h-64 w-64">
            <div className={`absolute inset-0 rounded-full blur-[80px] transition-all duration-700 ${isLiveActive || isRecording ? 'bg-rose-600/20 scale-150' : 'bg-indigo-600/10'}`}></div>
            <LiveMicIndicator stream={streamRef.current} isActive={isRecording || isLiveActive} tone={currentTone} />
            <button
              onClick={mode === AppMode.LIVE ? toggleLiveMode : undefined}
              onMouseDown={mode === AppMode.SNAPSHOT ? startRecording : undefined}
              onMouseUp={mode === AppMode.SNAPSHOT ? stopRecording : undefined}
              className={`relative z-10 w-40 h-40 rounded-full flex flex-col items-center justify-center transition-all duration-500 border-4 ${
                isLiveActive || isRecording ? 'bg-rose-600 border-rose-400/20 scale-110 shadow-[0_0_50px_rgba(225,29,72,0.4)]' : 'bg-indigo-600 border-white/5 hover:scale-105'
              }`}
            >
              <i className={`fas ${isLiveActive ? 'fa-stop' : 'fa-bolt-lightning'} text-5xl mb-2`}></i>
              <span className="text-[10px] font-black uppercase tracking-widest">{isLiveActive ? 'Close Link' : (mode === AppMode.LIVE ? 'Establish Link' : 'Hold to Sync')}</span>
            </button>
          </div>

          {isLiveActive && (
            <div className="z-10 w-full max-w-xl text-left bg-black/40 p-6 rounded-3xl border border-white/5 backdrop-blur-md">
              <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                <span>Neural Data Stream</span>
                <span className="flex items-center gap-1.5 animate-pulse text-emerald-400">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                  Connected
                </span>
              </h4>
              <div className="space-y-3 min-h-[100px]">
                {liveTranscript.length === 0 ? (
                   <p className="text-slate-600 text-xs italic">Awaiting neural input signals...</p>
                ) : (
                  liveTranscript.map((t, i) => (
                    <div key={i} className={`text-sm flex gap-3 ${t.isModel ? 'text-indigo-200 italic' : 'text-slate-400'}`}>
                      <span className="text-[10px] font-black opacity-50 mt-1">{t.isModel ? 'AI:' : 'YOU:'}</span>
                      <p>{t.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2 text-indigo-400 animate-pulse">
              <i className="fas fa-brain"></i>
              <span className="text-xs font-bold uppercase tracking-widest">Synthesizing Intent...</span>
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-6 mb-32">
          {history.map((item) => (
            <div key={item.id} className="glass-panel rounded-3xl p-8 border-l-4 border-l-indigo-500 animate-in slide-in-from-bottom-8 duration-700">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-indigo-500/10 rounded-full text-[10px] font-black text-indigo-400 border border-indigo-500/20 uppercase">{item.result.detected_language} ➔ {targetLang}</span>
                  <RiskBadge level={item.result.evaluation.risk_level} />
                </div>
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => handleSpeak(item.result)}
                    className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors group"
                  >
                    <span className="text-[10px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">Replay Neural Sync</span>
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                      <i className="fas fa-play text-xs"></i>
                    </div>
                  </button>
                  <div className="text-right">
                     <div className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">Sync Integrity</div>
                     <div className="text-xl font-black text-emerald-400 italic">{(item.result.intent_analysis.consistency_score * 100).toFixed(0)}%</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-white/5 mb-6">
                <p className="text-3xl text-indigo-100 font-medium leading-tight mb-4">{item.result.translation.translated_text}</p>
                {item.result.translation.semantic_explanation && (
                  <p className="text-sm text-slate-400 italic border-l-2 border-indigo-500/30 pl-4">{item.result.translation.semantic_explanation}</p>
                )}
              </div>

              {item.result.grounding_info && (
                <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                   <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                     <i className="fas fa-earth-americas"></i> Neural Grounding References
                   </h4>
                   <div className="flex flex-wrap gap-2">
                     {item.result.grounding_info.sources.map((s, i) => (
                       <a key={i} href={s.uri} target="_blank" className="text-[10px] bg-slate-900 border border-white/5 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-all text-slate-400 hover:text-emerald-300">
                         {s.title} <i className="fas fa-external-link-alt ml-1 opacity-50"></i>
                       </a>
                     ))}
                   </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="p-5 bg-slate-950/50 rounded-2xl border border-white/5">
                   <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Internal Reasoning</h4>
                   <p className="text-xs text-slate-400 leading-relaxed italic">"{item.result.evaluation.reasoning_summary}"</p>
                 </div>
                 <div className="p-5 bg-slate-950/50 rounded-2xl border border-white/5">
                    <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Intent Preservation</h4>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="text-[10px] text-slate-500 uppercase mb-1">{item.result.intent_analysis.emotional_tone}</div>
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${item.result.intent_analysis.consistency_score * 100}%` }}></div>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <i className="fas fa-bullseye"></i>
                      </div>
                    </div>
                 </div>
              </div>
            </div>
          ))}
        </section>
      </main>

      <SettingsPanel 
        isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}
        ttsEngine={ttsEngine} onTtsEngineChange={setTtsEngine}
        elevenLabsKey={elevenLabsKey} onElevenLabsKeyChange={setElevenLabsKey}
        elevenLabsVoiceId={elevenLabsVoiceId} onElevenLabsVoiceIdChange={setElevenLabsVoiceId}
        availableVoices={[]} isFetchingVoices={false}
        sensitivity={50} onSensitivityChange={() => {}}
        selectedDeviceId="" onDeviceChange={() => {}}
      />
    </div>
  );
};

export default App;

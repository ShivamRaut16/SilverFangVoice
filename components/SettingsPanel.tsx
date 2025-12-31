
import React, { useEffect, useState, useMemo } from 'react';
import VolumeMeter from './VolumeMeter';
import { TTSEngine, ElevenLabsVoice } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDeviceId: string;
  onDeviceChange: (id: string) => void;
  sensitivity: number;
  onSensitivityChange: (val: number) => void;
  ttsEngine: TTSEngine;
  onTtsEngineChange: (engine: TTSEngine) => void;
  elevenLabsKey: string;
  onElevenLabsKeyChange: (key: string) => void;
  elevenLabsVoiceId: string;
  onElevenLabsVoiceIdChange: (id: string) => void;
  availableVoices: ElevenLabsVoice[];
  isFetchingVoices: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  isOpen, onClose, selectedDeviceId, onDeviceChange, sensitivity, onSensitivityChange,
  ttsEngine, onTtsEngineChange, elevenLabsKey, onElevenLabsKeyChange, elevenLabsVoiceId, onElevenLabsVoiceIdChange,
  availableVoices, isFetchingVoices
}) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  const refreshDevices = async () => {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const devList = await navigator.mediaDevices.enumerateDevices();
      setDevices(devList.filter(d => d.kind === 'audioinput'));
      tempStream.getTracks().forEach(t => t.stop());
    } catch (err) { console.error("Error accessing media devices.", err); }
  };

  useEffect(() => {
    if (isOpen) refreshDevices();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      if (stream) stream.getTracks().forEach(t => t.stop());
      setStream(null);
      if (previewAudio) previewAudio.pause();
      return;
    }
    const updatePreview = async () => {
      try {
        if (stream) stream.getTracks().forEach(t => t.stop());
        const newStream = await navigator.mediaDevices.getUserMedia({ 
          audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true 
        });
        setStream(newStream);
      } catch (err) { console.error(err); }
    };
    updatePreview();
  }, [selectedDeviceId, isOpen]);

  // Fix: Explicitly type the useMemo return to avoid inference issues with Object.entries
  const groupedVoices = useMemo<Record<string, ElevenLabsVoice[]>>(() => {
    const groups: Record<string, ElevenLabsVoice[]> = {};
    availableVoices.forEach(v => {
      const cat = v.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(v);
    });
    return groups;
  }, [availableVoices]);

  const handlePreviewVoice = (url: string) => {
    if (previewAudio) previewAudio.pause();
    const audio = new Audio(url);
    audio.play();
    setPreviewAudio(audio);
  };

  const selectedVoice = useMemo(() => 
    availableVoices.find(v => v.voice_id === elevenLabsVoiceId), 
    [availableVoices, elevenLabsVoiceId]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="relative w-full max-w-sm h-full glass-panel border-l border-slate-700/50 p-6 flex flex-col overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <i className="fas fa-sliders text-indigo-400"></i> Configuration
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="space-y-8 flex-1">
          {/* Microphones */}
          <section className="space-y-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1 flex items-center gap-2">
              <i className="fas fa-microphone"></i> Audio Input
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => onDeviceChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-xl p-3 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
            >
              {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'System Default'}</option>)}
            </select>
            <div className="px-1">
              <p className="text-[9px] text-slate-500 font-bold uppercase mb-2 flex justify-between">
                <span>Live Monitor</span>
                <span>Gain: {sensitivity}%</span>
              </p>
              <VolumeMeter stream={stream} sensitivity={sensitivity} />
              <input 
                type="range" min="0" max="100" value={sensitivity} 
                onChange={(e) => onSensitivityChange(parseInt(e.target.value))}
                className="w-full mt-4 accent-indigo-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer"
              />
            </div>
          </section>

          {/* TTS Engine */}
          <section className="space-y-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Speech Synthesis Engine</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => onTtsEngineChange(TTSEngine.GEMINI)}
                className={`p-3 rounded-xl border text-xs font-bold transition-all ${ttsEngine === TTSEngine.GEMINI ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-600/20' : 'bg-slate-900 border-slate-800 text-slate-500'}`}
              >
                Gemini Native
              </button>
              <button 
                onClick={() => onTtsEngineChange(TTSEngine.ELEVEN_LABS)}
                className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${ttsEngine === TTSEngine.ELEVEN_LABS ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-600/20' : 'bg-slate-900 border-slate-800 text-slate-500'}`}
              >
                ElevenLabs <span className="text-[8px] bg-slate-950 px-1 rounded border border-white/10">FLASH</span>
              </button>
            </div>
          </section>

          {/* ElevenLabs Specifics */}
          {ttsEngine === TTSEngine.ELEVEN_LABS && (
            <section className="space-y-4 p-5 bg-indigo-600/5 border border-indigo-500/10 rounded-2xl animate-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest flex items-center justify-between">
                  <span>XI-API-KEY</span>
                  {elevenLabsKey.length > 0 && (
                    <i className={`fas ${availableVoices.length > 0 ? 'fa-check-circle text-emerald-400' : 'fa-circle-notch fa-spin text-slate-600'}`}></i>
                  )}
                </label>
                <input 
                  type="password"
                  value={elevenLabsKey}
                  onChange={(e) => onElevenLabsKeyChange(e.target.value)}
                  placeholder="Paste Key"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Active Voice</label>
                  {selectedVoice?.preview_url && (
                    <button onClick={() => handlePreviewVoice(selectedVoice.preview_url)} className="text-[9px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                      <i className="fas fa-play-circle"></i> Preview
                    </button>
                  )}
                </div>
                <div className="relative">
                  <select 
                    value={elevenLabsVoiceId}
                    disabled={isFetchingVoices || availableVoices.length === 0}
                    onChange={(e) => onElevenLabsVoiceIdChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs outline-none focus:border-indigo-500 appearance-none disabled:opacity-50 transition-all font-medium"
                  >
                    {availableVoices.length === 0 ? (
                      <option value="">{isFetchingVoices ? 'Syncing...' : 'Awaiting Key...'}</option>
                    ) : (
                      // Fix: Cast the entries result to ensure the compiler recognizes the array structure and .map availability
                      (Object.entries(groupedVoices) as [string, ElevenLabsVoice[]][]).map(([category, voices]) => (
                        <optgroup label={category.toUpperCase()} key={category} className="bg-slate-950 text-slate-400">
                          {voices.map(v => (
                            <option key={v.voice_id} value={v.voice_id} className="text-slate-200">
                              {v.name}
                            </option>
                          ))}
                        </optgroup>
                      ))
                    )}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
                    <i className="fas fa-chevron-down text-[10px]"></i>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                <i className="fas fa-leaf text-emerald-400 text-xs mt-0.5"></i>
                <div className="space-y-1">
                  <p className="text-[9px] text-emerald-300 font-bold uppercase">Free Tier Optimized</p>
                  <p className="text-[9px] text-emerald-300/70 italic leading-tight">
                    Now using <strong>Flash v2.5</strong>. It's 3x faster and uses fewer character credits. If you run out, we'll auto-fallback to Gemini.
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="pt-6 border-t border-slate-800 mt-auto">
          <button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] py-4 rounded-xl font-bold shadow-xl shadow-indigo-600/20 transition-all text-sm uppercase tracking-widest">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;

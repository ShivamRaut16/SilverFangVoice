
import React, { useEffect, useRef, useState } from 'react';

interface MiniWaveformProps {
  stream: MediaStream | null;
  isActive: boolean;
}

const MiniWaveform: React.FC<MiniWaveformProps> = ({ stream, isActive }) => {
  const [levels, setLevels] = useState(new Array(9).fill(0));
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastLevelsRef = useRef<number[]>(new Array(9).fill(0));

  useEffect(() => {
    if (!isActive || !stream) {
      setLevels(new Array(9).fill(0));
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      return;
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 128;
    analyzer.smoothingTimeConstant = 0.5;
    source.connect(analyzer);
    analyzerRef.current = analyzer;

    const dataArray = new Uint8Array(analyzer.frequencyBinCount);

    const update = () => {
      if (!analyzerRef.current) return;
      analyzerRef.current.getByteFrequencyData(dataArray);
      
      // Symmetrical 9-bar mapping (Center is most active)
      // Mapping frequencies to bars: 4-3-2-1-0-1-2-3-4
      const freqIndices = [20, 15, 10, 5, 2, 5, 10, 15, 20];

      const newLevels = freqIndices.map((idx, i) => {
        const val = dataArray[idx] / 255;
        const prev = lastLevelsRef.current[i];
        const result = Math.max(val, prev * 0.85);
        lastLevelsRef.current[i] = result;
        return result;
      });
      
      setLevels(newLevels);
      animationFrameRef.current = requestAnimationFrame(update);
    };

    update();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [stream, isActive]);

  if (!isActive) return null;

  return (
    <div className="flex items-center gap-[2px] h-5 w-12 px-1">
      {levels.map((lvl, i) => {
        // Higher bars in the center for a classic waveform look
        const centerFactor = 1 - (Math.abs(4 - i) / 5);
        
        return (
          <div 
            key={i}
            className="w-[3px] rounded-full transition-all duration-75 ease-out"
            style={{ 
              height: `${15 + (lvl * 85 * centerFactor)}%`,
              opacity: 0.4 + lvl * 0.6,
              background: i === 4 
                ? 'linear-gradient(to top, #f43f5e, #e11d48)' 
                : 'linear-gradient(to top, #6366f1, #818cf8)',
              boxShadow: lvl > 0.7 ? `0 0 5px rgba(225, 29, 72, ${lvl * 0.4})` : 'none'
            }}
          />
        );
      })}
    </div>
  );
};

export default MiniWaveform;

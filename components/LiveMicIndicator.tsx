
import React, { useEffect, useRef, useState } from 'react';

interface LiveMicIndicatorProps {
  stream: MediaStream | null;
  isActive: boolean;
  tone?: string;
}

const LiveMicIndicator: React.FC<LiveMicIndicatorProps> = ({ stream, isActive, tone = 'Neutral' }) => {
  const [frequencyData, setFrequencyData] = useState<number[]>(new Array(9).fill(0));
  const [bassEnergy, setBassEnergy] = useState(0);
  const [peak, setPeak] = useState(0);
  
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastFrequenciesRef = useRef<number[]>(new Array(9).fill(0));

  // Determine Galaxy colors based on semantic intent (tone)
  const getToneColor = () => {
    const t = tone.toLowerCase();
    if (t.includes('angry') || t.includes('urgent')) return { primary: '225, 29, 72', secondary: '244, 63, 94', glow: 'rgba(225, 29, 72, 0.4)' }; // Red
    if (t.includes('calm') || t.includes('peace')) return { primary: '16, 185, 129', secondary: '52, 211, 153', glow: 'rgba(16, 185, 129, 0.4)' }; // Emerald
    if (t.includes('sad') || t.includes('serious')) return { primary: '79, 70, 229', secondary: '99, 102, 241', glow: 'rgba(79, 70, 229, 0.4)' }; // Indigo
    if (t.includes('happy') || t.includes('joy')) return { primary: '234, 179, 8', secondary: '250, 204, 21', glow: 'rgba(234, 179, 8, 0.4)' }; // Yellow
    if (t.includes('fear') || t.includes('danger')) return { primary: '147, 51, 234', secondary: '168, 85, 247', glow: 'rgba(147, 51, 234, 0.4)' }; // Purple
    return { primary: '99, 102, 241', secondary: '225, 29, 72', glow: 'rgba(99, 102, 241, 0.4)' }; // Default Galaxy Mix
  };

  const colors = getToneColor();

  useEffect(() => {
    if (!isActive || !stream) {
      setFrequencyData(new Array(9).fill(0));
      setPeak(0);
      setBassEnergy(0);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      return;
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 512; 
    analyzer.smoothingTimeConstant = 0.3;
    source.connect(analyzer);
    analyzerRef.current = analyzer;

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const update = () => {
      if (!analyzerRef.current) return;
      analyzerRef.current.getByteFrequencyData(dataArray);
      
      const bands = [
        { start: 1, end: 2 }, { start: 3, end: 6 }, { start: 7, end: 12 },
        { start: 13, end: 25 }, { start: 26, end: 50 }, { start: 51, end: 80 },
        { start: 81, end: 120 }, { start: 121, end: 180 }, { start: 181, end: 250 }
      ];

      const newFrequencies = bands.map((band, i) => {
        let sum = 0;
        for (let j = band.start; j <= band.end; j++) sum += dataArray[j];
        const avg = sum / (band.end - band.start + 1) / 255;
        const prev = lastFrequenciesRef.current[i];
        const result = Math.max(avg, prev * 0.88);
        lastFrequenciesRef.current[i] = result;
        return result;
      });

      setFrequencyData(newFrequencies);
      setBassEnergy((newFrequencies[0] + newFrequencies[1]) / 2);
      setPeak(Math.max(...newFrequencies));
      
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
    <>
      {/* Intent Galaxy Glow */}
      <div 
        className="absolute inset-0 rounded-full transition-all duration-300 pointer-events-none z-0"
        style={{ 
          background: `radial-gradient(circle, rgba(${colors.primary}, ${0.1 + peak * 0.4}) 0%, transparent 70%)`,
          boxShadow: `0 0 ${60 + peak * 140}px rgba(${colors.secondary}, ${0.1 + peak * 0.8}), 0 0 ${30 + peak * 80}px rgba(${colors.primary}, ${0.05 + peak * 0.5})`,
          transform: `scale(${1 + bassEnergy * 0.4})`,
          opacity: 0.3 + peak * 0.7
        }}
      />
      
      {/* Orbiting Neural Particles */}
      <div 
        className="absolute inset-0 rounded-full border border-white/5 transition-transform duration-300 ease-out"
        style={{ 
          transform: `scale(${1.15 + peak * 0.5}) rotate(${peak * 120}deg)`,
          boxShadow: `inset 0 0 20px rgba(${colors.primary}, ${peak * 0.3})`
        }}
      >
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full blur-[2px] shadow-lg animate-pulse"
          style={{ backgroundColor: `rgb(${colors.secondary})`, boxShadow: `0 0 15px rgb(${colors.secondary})` }}
        />
        <div 
          className="absolute bottom-1/4 left-4 w-1.5 h-1.5 rounded-full blur-[1px] opacity-60"
          style={{ backgroundColor: `rgb(${colors.primary})` }}
        />
      </div>
      
      {/* Semantic Spectrum Bars */}
      <div className="absolute -bottom-20 flex items-end justify-center gap-1.5 h-20 w-64 pointer-events-none">
        {frequencyData.map((val, i) => {
          const intensity = 40 + (val * 60);
          return (
            <div 
              key={i}
              className="w-2.5 rounded-full transition-all duration-75 ease-out backdrop-blur-sm border border-white/5"
              style={{ 
                height: `${20 + val * 80}%`,
                opacity: 0.3 + val * 0.7,
                background: `linear-gradient(to top, rgba(${colors.primary}, 1), rgba(${colors.secondary}, ${intensity / 100}))`,
                boxShadow: val > 0.5 ? `0 0 15px rgba(${colors.secondary}, ${val * 0.5})` : 'none',
                transform: `translateY(${val * -5}px)`
              }}
            />
          );
        })}
      </div>

      {/* Tone Label */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 text-white italic">{tone}</span>
      </div>
    </>
  );
};

export default LiveMicIndicator;

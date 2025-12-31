
import React, { useEffect, useRef } from 'react';

interface NeuralVisionProps {
  isActive: boolean;
  onFrame?: (base64: string) => void;
}

const NeuralVision: React.FC<NeuralVisionProps> = ({ isActive, onFrame }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<number>(null);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      return;
    }

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } });
        if (videoRef.current) videoRef.current.srcObject = stream;
        
        intervalRef.current = window.setInterval(() => {
          if (videoRef.current && canvasRef.current && onFrame) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.drawImage(videoRef.current, 0, 0, 320, 240);
            const base64 = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
            onFrame(base64);
          }
        }, 1500); // Send frame every 1.5s for visual context
      } catch (err) {
        console.error("Camera access denied", err);
      }
    };

    startCamera();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [isActive, onFrame]);

  if (!isActive) return null;

  return (
    <div className="absolute top-4 right-4 w-32 h-32 rounded-3xl overflow-hidden border-2 border-indigo-500/30 shadow-2xl z-40 bg-slate-900 group">
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale brightness-75 group-hover:grayscale-0 transition-all" />
      <canvas ref={canvasRef} width="320" height="240" className="hidden" />
      <div className="absolute inset-0 pointer-events-none border-t border-indigo-400/50 animate-[scan_3s_linear_infinite]"></div>
      <div className="absolute bottom-1 right-1 px-1.5 bg-rose-600 rounded text-[8px] font-bold text-white animate-pulse">VISION</div>
      <style>{`
        @keyframes scan {
          from { transform: translateY(-100%); }
          to { transform: translateY(100%); }
        }
      `}</style>
    </div>
  );
};

export default NeuralVision;

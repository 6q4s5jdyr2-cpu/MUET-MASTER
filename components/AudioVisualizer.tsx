import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isSimulated?: boolean;
  className?: string;
  width?: number;
  height?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ stream, isSimulated = false, className = '', width = 300, height = 80 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isSimulated) {
      // Draw a simulated pulsating wave
      const drawSimulated = () => {
        if (!ctx || !canvas) return;
        requestRef.current = requestAnimationFrame(drawSimulated);

        ctx.clearRect(0, 0, width, height);

        const barCount = 32;
        const barWidth = (width / barCount);
        const time = Date.now() * 0.004;

        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#818cf8'); // indigo-400
        gradient.addColorStop(0.5, '#a78bfa'); // violet-400
        gradient.addColorStop(1, '#f472b6'); // pink-400

        for (let i = 0; i < barCount; i++) {
          // Generate a wave-like structure that fluctuates over time
          const baseNoise = Math.sin(i * 0.2 + time) * Math.cos(i * 0.05 - time * 0.5);
          const secondaryNoise = Math.sin(time * 2.5 + i * 0.5) * 0.3;
          let percent = (baseNoise + 1) / 2 * 0.7 + secondaryNoise;
          if (percent < 0.05) percent = 0.05;
          if (percent > 0.95) percent = 0.95;

          const barHeight = percent * height;

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(i * barWidth, height - barHeight - 4, barWidth - 2, barHeight + 4, 4);
          ctx.fill();
        }
      };

      drawSimulated();
      return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
      };
    }

    if (!stream) return;

    // Use standard AudioContext, fallback to webkit
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    // Create new audio context
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128; // lower size for chunkier bars

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      if (!ctx || !canvas) return;
      
      requestRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);

      const barCount = Math.floor(dataArray.length * 0.75);
      const barWidth = width / barCount;
      let x = 0;

      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#818cf8'); // indigo-400
      gradient.addColorStop(0.5, '#a78bfa'); // violet-400
      gradient.addColorStop(1, '#f472b6'); // pink-400

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i];
        const percent = value / 255;
        const barHeight = percent * height;

        ctx.fillStyle = value > 5 ? gradient : '#cbd5e1'; // slate-300
        
        ctx.beginPath();
        ctx.roundRect(x, height - barHeight - 4, barWidth - 2, barHeight + 4, 4);
        ctx.fill();

        x += barWidth;
      }
    };

    draw();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (audioCtxRef.current?.state !== 'closed') {
        audioCtxRef.current?.close().catch((err: any) => console.warn('AudioContext close error:', err));
      }
    };
  }, [stream, isSimulated, width, height]);

  if (!stream && !isSimulated) return null;

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      className={`rounded-xl bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur border border-slate-200 dark:border-slate-800 shadow-inner p-2 w-full ${className}`}
      style={{ maxWidth: `${width}px`, height: `${height}px` }}
    />
  );
};

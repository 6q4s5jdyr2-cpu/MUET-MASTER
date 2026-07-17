import React from 'react';

const AnimatedBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-20 bg-slate-50 dark:bg-slate-950 transition-colors duration-700">
      {/* Blurred background blobs for color */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-200/40 dark:bg-indigo-900/30 mix-blend-multiply dark:mix-blend-screen filter blur-[80px] animate-blob1"></div>
      <div className="absolute top-[20%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-amber-200/40 dark:bg-amber-900/20 mix-blend-multiply dark:mix-blend-screen filter blur-[80px] animate-blob2"></div>
      <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-sky-200/40 dark:bg-sky-900/20 mix-blend-multiply dark:mix-blend-screen filter blur-[80px] animate-blob3"></div>
      
      {/* Cute floating shapes */}
      {/* Star */}
      <div className="absolute top-[15%] left-[10%] text-amber-400 opacity-60 animate-blob2" style={{ animationDelay: '1s' }}>
         <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
      </div>
      
      {/* Circle */}
      <div className="absolute top-[25%] right-[15%] text-indigo-400 opacity-60 animate-blob1" style={{ animationDelay: '3s' }}>
         <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
      </div>

      {/* Triangle */}
      <div className="absolute bottom-[30%] left-[20%] text-emerald-400 opacity-60 animate-blob4" style={{ animationDelay: '2s' }}>
         <svg width="50" height="50" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21z"/></svg>
      </div>

      {/* Squiggle / Wave */}
      <div className="absolute top-[40%] left-[5%] text-rose-400 opacity-60 animate-blob5" style={{ animationDelay: '4s' }}>
         <svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12c2-4 6-4 8 0s6 4 8 0"/></svg>
      </div>

      {/* Square */}
      <div className="absolute bottom-[15%] right-[25%] text-sky-400 opacity-60 animate-blob3" style={{ animationDelay: '1.5s' }}>
         <svg width="45" height="45" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="4"/></svg>
      </div>

      {/* Hexagon */}
      <div className="absolute top-[10%] right-[35%] text-purple-400 opacity-60 animate-blob4" style={{ animationDelay: '5s' }}>
         <svg width="55" height="55" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L22 7l-4 10H6L2 7l10-5z"/></svg>
      </div>

      {/* Heart */}
      <div className="absolute bottom-[40%] right-[10%] text-pink-400 opacity-60 animate-blob2" style={{ animationDelay: '0.5s' }}>
         <svg width="50" height="50" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
      </div>
      
      {/* Cloud */}
      <div className="absolute top-[60%] left-[30%] text-blue-300 opacity-60 animate-blob1" style={{ animationDelay: '2.5s' }}>
         <svg width="65" height="65" viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
      </div>
      
      {/* Plus */}
      <div className="absolute bottom-[10%] left-[45%] text-orange-400 opacity-60 animate-blob5" style={{ animationDelay: '3.5s' }}>
         <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </div>
    </div>
  );
};

export default AnimatedBackground;

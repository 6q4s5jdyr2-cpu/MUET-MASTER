
import React from 'react';
import { MUETQuestion } from '../types';

interface QuestionCardProps {
  question: MUETQuestion;
  index: number;
  blind?: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ question, index, blind = false }) => {
  if (blind) {
    // Reverted to clean Indigo "Blind" state
    return (
      <div 
        className="relative h-full aspect-[3/4.2] w-full min-w-[200px] bg-indigo-950 rounded-[2.5rem] shadow-2xl border-2 border-amber-600/30 flex flex-col items-center justify-center p-6 group transition-all duration-500 overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10 group-hover:scale-110 transition-transform duration-700">
           <svg className="w-full h-full text-white" viewBox="0 0 100 100">
             <path fill="currentColor" d="M50 50c10-20 30-20 40 0s0 30-20 40-30 0-40-20c-10 20-30 20-40 0s0-30 20-40 30 0 40 20z"/>
           </svg>
        </div>
        
        <div className="relative z-10 flex flex-col items-center gap-6">
           <div className="w-24 h-24 bg-amber-500 rounded-full flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
              <svg className="w-12 h-12 text-indigo-950" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
              </svg>
           </div>
           <div className="text-center">
              <span className="text-amber-400 font-black uppercase tracking-widest text-[10px] block mb-2">TOPIC UNKNOWN</span>
              <h3 className="text-white text-4xl font-serif font-black">SET {index + 1}</h3>
           </div>
        </div>

        <div className="absolute bottom-6 flex items-center gap-2">
           <div className="h-px w-8 bg-amber-500/30"></div>
           <span className="text-[9px] font-black text-amber-500/60 uppercase tracking-widest">PRACTICE POOL</span>
           <div className="h-px w-8 bg-amber-500/30"></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="bg-white rounded-[2.5rem] shadow-2xl border border-indigo-50 overflow-hidden flex flex-col h-full animate-flip"
    >
      <div className="bg-indigo-950 p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2 opacity-10">
           <svg className="w-16 h-16 text-amber-400" viewBox="0 0 100 100" fill="currentColor"><path d="M50 0C55 20 75 25 100 25C80 30 75 50 75 75C70 55 50 50 25 50C45 45 50 25 50 0Z"/></svg>
        </div>
        <div className="flex justify-between items-center relative z-10">
          <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">{question.category}</span>
          <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
             <svg className="w-4 h-4 text-indigo-950" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          </div>
        </div>
      </div>
      
      <div className="p-8 flex-grow flex flex-col gap-6">
        <div className="space-y-2">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Situation</p>
          <p className="text-base font-medium text-slate-700 leading-relaxed italic border-l-4 border-amber-100 pl-4">
            "{question.situation}"
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Task</p>
          <h3 className="text-2xl font-serif font-black text-indigo-950 leading-tight">
            {question.topic}
          </h3>
        </div>

        {question.points.length > 0 && (
          <div className="space-y-3 mt-2">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Points to Discuss</p>
            <div className="flex flex-wrap gap-2">
              {question.points.map((p, i) => (
                <span key={i} className="px-4 py-2 bg-indigo-50 text-indigo-900 text-[11px] font-bold rounded-xl border border-indigo-100">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="px-8 py-5 bg-slate-50 border-t border-slate-100">
        <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">MUET PART {question.points.length > 0 ? '2' : '1'}</span>
      </div>
    </div>
  );
};

export default QuestionCard;


import React, { useState, useEffect, useRef } from 'react';
import { View, MUETQuestion, MUETFeedback } from './types';
import { INDIVIDUAL_SAMPLE_QUESTIONS, GROUP_SAMPLE_QUESTIONS } from './constants';
import { analyzeAudioResponse, generateMUETCards } from './services/geminiService';
import QuestionCard from './components/QuestionCard';

type GenerationMode = 'AI' | 'SAMPLE' | null;

const App: React.FC = () => {
  const [view, setView] = useState<View>('HOME');
  const [selectedQuestion, setSelectedQuestion] = useState<MUETQuestion | null>(null);
  const [isOpening, setIsOpening] = useState<boolean>(false);
  const [isSelectingCard, setIsSelectingCard] = useState<boolean>(false);
  const [isLoadingCards, setIsLoadingCards] = useState<boolean>(false);
  const [pendingView, setPendingView] = useState<View | null>(null);
  const [genMode, setGenMode] = useState<GenerationMode>(null);
  const [showPhaseAlert, setShowPhaseAlert] = useState<string | null>(null);
  
  const [usedPoints, setUsedPoints] = useState<number[]>([]);
  const [sessionCards, setSessionCards] = useState<MUETQuestion[]>([]);
  const [pickedCardIds, setPickedCardIds] = useState<Set<string>>(new Set());
  
  const [timer, setTimer] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [phase, setPhase] = useState<'PREP' | 'SPEAK' | 'PROCESSING'>('PREP');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<MUETFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopTimer();
      stopMicrophone();
    };
  }, []);

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const stopMicrophone = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("Could not stop MediaRecorder safely:", e);
      }
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const startTimer = (duration: number, onComplete: () => void) => {
    stopTimer();
    setTimer(duration);
    timerIntervalRef.current = window.setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          stopTimer();
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const triggerPhaseAlert = (msg: string) => {
    setShowPhaseAlert(msg);
    setTimeout(() => setShowPhaseAlert(null), 3000);
  };

  const initiateSelection = async (targetView: View, mode: GenerationMode) => {
    setError(null);
    setIsLoadingCards(true);
    setPendingView(targetView);
    setGenMode(mode);
    
    try {
      let cards: MUETQuestion[] = [];
      if (mode === 'AI') {
        cards = await generateMUETCards(targetView === 'GROUP');
      } else {
        const source = targetView === 'GROUP' ? [...GROUP_SAMPLE_QUESTIONS] : [...INDIVIDUAL_SAMPLE_QUESTIONS];
        cards = [...source];
      }
      
      if (cards.length > 0) {
        setSessionCards(cards);
        setIsSelectingCard(true);
      } else {
        throw new Error("No cards found");
      }
    } catch (err) {
      setError("Failed to fetch topics. Please check your internet connection.");
    } finally {
      setIsLoadingCards(false);
    }
  };

  const handleCardClick = (card: MUETQuestion) => {
    if (!pendingView) return;
    
    setIsOpening(true);
    setPickedCardIds(prev => new Set(prev).add(card.id));

    setTimeout(() => {
      setSelectedQuestion(card);
      setUsedPoints([]);
      setView('PRACTICE');
      setPhase('PREP');
      setIsSelectingCard(false);
      setIsOpening(false);
      triggerPhaseAlert("Topic Revealed!");
      
      const duration = pendingView === 'INDIVIDUAL' ? 120 : 180;
      startTimer(duration, startSpeakingPhase);
    }, 600);
  };

  const handleResetCards = () => {
    setPickedCardIds(new Set());
    triggerPhaseAlert("Done!");
  };

  const togglePoint = (index: number) => {
    setUsedPoints((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const startSpeakingPhase = async () => {
    stopTimer();
    setPhase('SPEAK');
    setStartTime(Date.now());
    triggerPhaseAlert("Speak Now!");
    const duration = pendingView === 'INDIVIDUAL' ? 120 : 720;
    startTimer(duration, stopRecordingAndAnalyze);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const options = { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm' };
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
      setError("Could not access microphone. Please ensure permissions are granted.");
      setPhase('PREP');
    }
  };

  const stopRecordingAndAnalyze = async () => {
    stopTimer();
    const durationSpoken = (Date.now() - startTime) / 1000;

    if (!mediaRecorderRef.current) {
        if (phase === 'SPEAK') setPhase('PREP');
        return;
    }
    
    setPhase('PROCESSING');
    
    const waitForRecording = new Promise<void>((resolve) => {
      if (!mediaRecorderRef.current) return resolve();
      mediaRecorderRef.current.onstop = () => resolve();
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else {
        resolve();
      }
    });

    await waitForRecording;
    stopMicrophone();

    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

    if (audioChunksRef.current.length === 0 || durationSpoken < 2 || audioBlob.size < 2000) {
      setError("The recording was too short or silent. Please speak clearly for at least a few seconds.");
      setPhase('SPEAK');
      return;
    }
    
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      const base64Audio = (reader.result as string).split(',')[1];
      try {
        const result = await analyzeAudioResponse(base64Audio, mimeType, selectedQuestion?.topic || '');
        setFeedback(result);
        setView('RESULT');
      } catch (err) {
        console.error("AI Analysis error:", err);
        setError("AI analysis failed. Please try again with a clearer recording.");
        setPhase('SPEAK');
      }
    };
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleNav = (targetView: View) => {
    stopTimer();
    stopMicrophone();
    setView(targetView);
    if (targetView === 'HOME') {
      setSelectedQuestion(null);
      setUsedPoints([]);
      setIsSelectingCard(false);
      setIsLoadingCards(false);
      setPendingView(null);
      setGenMode(null);
      setFeedback(null);
      setError(null);
      setSessionCards([]);
    }
  };

  const renderAnnotatedTranscript = (text: string) => {
    if (!text || text === "No speech detected.") return <span className="text-slate-400 italic">No intelligible speech was detected in this performance.</span>;
    const parts = text.split(/(\[TICK\]|\[CROSS\])/g);
    return parts.map((part, i) => {
      if (part === '[TICK]') {
        return (
          <span key={i} className="inline-flex items-center justify-center bg-emerald-100 text-emerald-600 rounded-full w-[16px] h-[16px] md:w-[20px] md:h-[20px] mx-1 align-middle translate-y-[-1px] shadow-sm">
            <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </span>
        );
      }
      if (part === '[CROSS]') {
        return (
          <span key={i} className="inline-flex items-center justify-center bg-red-100 text-red-600 rounded-full w-[16px] h-[16px] md:w-[20px] md:h-[20px] mx-1 align-middle translate-y-[-1px] shadow-sm">
            <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const availableCards = sessionCards.filter(c => !pickedCardIds.has(c.id));

  return (
    <div className={`h-screen w-full flex flex-col relative z-10 transition-all duration-700 pb-safe ${isOpening ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
      
      {/* FUN ANIMATED BACKGROUND */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-20">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-200/40 mix-blend-multiply filter blur-[80px] animate-blob1"></div>
        <div className="absolute top-[20%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-amber-200/40 mix-blend-multiply filter blur-[80px] animate-blob2"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-sky-200/40 mix-blend-multiply filter blur-[80px] animate-blob3"></div>
        
        {/* Subtle floating educational graphics */}
        <div className="absolute top-[15%] left-[10%] text-indigo-900/[0.03] opacity-10 animate-blob2" style={{ animationDelay: '1s' }}>
           <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-5.5l6-4.5-6-4.5v9z"/></svg>
        </div>
        <div className="absolute bottom-[20%] right-[10%] text-amber-500/[0.03] opacity-10 animate-blob1" style={{ animationDelay: '3s' }}>
           <svg width="150" height="150" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
        </div>
        <div className="absolute top-[40%] right-[30%] text-sky-500/[0.03] opacity-10 animate-blob3" style={{ animationDelay: '2s' }}>
           <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
        </div>
      </div>

      {showPhaseAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-950/60 backdrop-blur-sm animate-in fade-in duration-300 px-4">
          <div className="bg-white px-8 py-10 rounded-[3rem] shadow-2xl scale-110 animate-in zoom-in-95 duration-300 border-b-8 border-amber-400 w-full max-w-sm text-center">
            <h3 className="text-2xl md:text-3xl font-black text-indigo-900 uppercase tracking-tighter">
              {showPhaseAlert}
            </h3>
          </div>
        </div>
      )}

      {/* FIXED NAV BAR */}
      <nav className="shrink-0 bg-white/60 backdrop-blur-xl border-b border-white/20 z-50 pt-safe">
        <div className="max-w-7xl mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => handleNav('HOME')}>
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-b from-blue-400 to-purple-600 rounded-xl md:rounded-2xl flex items-center justify-center shadow-batik group-hover:rotate-12 transition-transform p-1.5 md:p-2">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <path d="M21 11.5C21 16.1944 17.1944 20 12.5 20C11.0574 20 9.69788 19.641 8.5 19.0068L4 20L4.99324 15.5C4.35899 14.3021 4 12.9426 4 11.5C4 6.80558 7.80558 3 12.5 3C17.1944 3 21 6.80558 21 11.5Z" fill="white"/>
                <path d="M12.5 14C11.1193 14 10 12.8807 10 11.5V8.5C10 7.11929 11.1193 6 12.5 6C13.8807 6 15 7.11929 15 8.5V11.5C15 12.8807 13.8807 14 12.5 14Z" fill="#3b82f6"/>
                <path d="M8 11.5C8 13.9853 10.0147 16 12.5 16C14.9853 16 17 13.9853 17 11.5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M12.5 16V18" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M10.5 18H14.5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M6 10.5V12.5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M19 10.5V12.5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-lg md:text-xl font-serif font-black text-indigo-950 truncate">
              MUET <span className="text-amber-600">Master</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {view === 'HOME' && !isSelectingCard && (
              <button onClick={() => setShowAbout(true)} className="px-4 py-1.5 md:px-5 md:py-2 bg-white/80 text-indigo-900 hover:bg-indigo-50 rounded-xl transition-all font-black text-[10px] md:text-xs uppercase tracking-widest border border-white/40 shadow-sm backdrop-blur-sm">
                ABOUT
              </button>
            )}
            {(view !== 'HOME' || isSelectingCard) && (
              <button onClick={() => handleNav('HOME')} className="px-4 py-1.5 md:px-5 md:py-2 bg-white/80 text-indigo-900 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all font-black text-[10px] md:text-xs uppercase tracking-widest border border-white/40 shadow-sm backdrop-blur-sm">
                QUIT
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ABOUT MODAL */}
      {showAbout && (
        <div className="fixed inset-0 z-[200] bg-indigo-950/40 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300 px-4">
          <div className="bg-white/95 backdrop-blur-xl p-8 md:p-12 card-batik rounded-[2.5rem] border border-white/60 max-w-2xl w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-500">
            
            {/* Decorative background elements */}
            <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-amber-200/40 rounded-full mix-blend-multiply filter blur-3xl animate-blob1"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-48 h-48 bg-indigo-200/40 rounded-full mix-blend-multiply filter blur-3xl animate-blob2"></div>

            <button onClick={() => setShowAbout(false)} className="absolute top-6 right-6 text-indigo-900/40 hover:text-indigo-900 bg-slate-100/50 hover:bg-slate-100 rounded-full p-2 transition-all z-10">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            
            <div className="relative z-10 flex flex-col items-center text-center space-y-6">
              
              {/* Graphic / Icon */}
              <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-indigo-100 to-amber-50 rounded-3xl flex items-center justify-center shadow-inner border border-white animate-in slide-in-from-bottom-4 fade-in duration-700 delay-100 fill-mode-both">
                <svg className="w-10 h-10 md:w-12 md:h-12 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>

              <div className="space-y-4">
                <h2 className="text-3xl md:text-5xl font-serif font-black text-indigo-950 tracking-tight leading-tight animate-in slide-in-from-bottom-4 fade-in duration-700 delay-200 fill-mode-both">
                  Fluency.<br/>
                  <span className="text-amber-600">Without the fear.</span>
                </h2>
                
                <p className="text-sm md:text-base font-medium text-slate-600 max-w-lg mx-auto leading-relaxed animate-in slide-in-from-bottom-4 fade-in duration-700 delay-300 fill-mode-both">
                  We built MUET Master to give every student a tireless, objective speaking partner. Practice anytime, get instant AI feedback, and master your English proficiency.
                </p>
              </div>

              <div className="pt-4 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-500 fill-mode-both">
                <button onClick={() => setShowAbout(false)} className="px-8 py-3 btn-batik text-amber-400 font-black rounded-full shadow-lg hover:scale-105 transition-transform text-xs tracking-widest uppercase">
                  Let's Practice
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA - Strict boundaries to prevent body scroll */}
      <main className={`flex-1 min-h-0 relative w-full mx-auto flex flex-col px-4 pb-2 md:pb-4 ${isSelectingCard ? 'overflow-y-auto' : 'overflow-hidden'}`}>
        
        {/* GLOBAL ERROR */}
        {error && (
          <div className="absolute top-4 left-4 right-4 z-50 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 text-sm shadow-md">
            <svg className="w-5 h-5 flex-shrink-0" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="flex-grow font-medium text-xs md:text-sm">{error}</p>
            <button onClick={() => setError(null)} className="font-black text-[10px] md:text-xs uppercase hover:bg-red-100 px-3 py-1 rounded-lg transition-colors">Dismiss</button>
          </div>
        )}

        {isLoadingCards ? (
          <div className="flex flex-col flex-1 items-center justify-center h-full">
             <div className="relative mb-6">
                <div className="w-16 h-16 border-8 border-amber-100 border-t-amber-500 rounded-full animate-spin shadow-lg"></div>
             </div>
             <p className="text-2xl font-serif font-black text-indigo-950 text-center">Preparing topics...</p>
             <p className="text-slate-600 font-medium text-center text-sm mt-2">Shuffling new challenges for you.</p>
          </div>
        ) : isSelectingCard ? (
          <div className="text-center space-y-6 md:space-y-8 animate-in fade-in zoom-in duration-500 py-4 md:py-6">
            <div className="space-y-3">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-black text-indigo-950 drop-shadow-sm">Pick Your Blind Card</h2>
              <div className="flex flex-col items-center gap-3 bg-white/60 p-4 rounded-3xl border border-white backdrop-blur-md max-w-xl mx-auto shadow-sm">
                 <p className="text-slate-600 font-medium text-xs leading-relaxed">
                    Once a card is picked, it is removed from the pool for this session.
                 </p>
                 <button 
                  onClick={handleResetCards}
                  className="flex items-center gap-2 px-6 py-2 bg-white text-indigo-900 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-amber-400 hover:text-indigo-950 transition-all border border-indigo-100 shadow-sm"
                 >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Restore Cards
                 </button>
              </div>
            </div>
            
            {availableCards.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 max-w-6xl mx-auto pb-12">
                {availableCards.map((card, i) => (
                  <div 
                    key={card.id} 
                    onClick={() => handleCardClick(card)} 
                    className="cursor-pointer hover:scale-105 transition-all duration-300 active:scale-95"
                  >
                    <QuestionCard question={card} index={sessionCards.indexOf(card)} blind={true} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center gap-6 bg-white/40 backdrop-blur-sm rounded-[2rem] p-8 max-w-md mx-auto border border-white">
                 <div className="w-24 h-24 text-indigo-200 relative">
                    <svg fill="currentColor" viewBox="0 0 24 24" className="w-full h-full"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>
                 </div>
                 <p className="text-indigo-950 font-black uppercase tracking-widest text-base">All topics cleared!</p>
                 <button onClick={handleResetCards} className="px-8 py-3 btn-batik text-amber-400 font-black rounded-full shadow-xl hover:scale-105 transition-transform text-xs">RESTORE CARDS</button>
              </div>
            )}
            
            <button onClick={() => handleNav('HOME')} className="text-slate-500 hover:text-indigo-900 font-black text-[10px] uppercase tracking-widest transition-colors mt-4 bg-white/50 px-6 py-2 rounded-full backdrop-blur-sm inline-block">
              Back to Main Menu
            </button>
          </div>
        ) : view === 'HOME' ? (
          <div className="w-full max-w-4xl mx-auto flex flex-col flex-1 items-center justify-center gap-6 md:gap-8 animate-in fade-in duration-1000 py-4 min-h-0">
             <div className="shrink-0 space-y-2 md:space-y-3 text-center">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif font-black text-indigo-950 leading-tight drop-shadow-sm">
                MUET <span className="text-amber-600 block">Speaking</span>
              </h1>
              <p className="text-xs md:text-sm text-slate-700 max-w-xl mx-auto font-medium px-2">
                Master your English proficiency with tradition and technology.
              </p>
            </div>

            <div className="shrink-0 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full max-w-2xl">
              <div className="bg-white/90 backdrop-blur-md p-5 md:p-6 card-batik hover:-translate-y-1 transition-transform duration-500 flex flex-col items-center group rounded-[2rem] border border-white/50">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-amber-50 text-amber-600 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4 shadow-inner">
                   <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <h2 className="text-xl md:text-2xl font-serif font-black mb-1 text-indigo-950">Part 1</h2>
                <p className="text-amber-600 font-black text-[8px] md:text-[9px] uppercase tracking-widest mb-4 md:mb-5 text-center">Individual Presentation</p>
                
                <div className="grid grid-cols-1 gap-2 w-full">
                   <button onClick={() => initiateSelection('INDIVIDUAL', 'SAMPLE')} className="py-2.5 px-3 rounded-lg bg-white border border-indigo-100 text-indigo-900 font-black hover:bg-indigo-50 transition-all text-[9px] md:text-[10px] uppercase shadow-sm">SAMPLE TOPICS</button>
                   <button onClick={() => initiateSelection('INDIVIDUAL', 'AI')} className="py-2.5 px-3 rounded-lg btn-batik text-amber-400 font-black hover:opacity-90 transition-all text-[9px] md:text-[10px] uppercase shadow-md">AI GENERATE</button>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-md p-5 md:p-6 card-batik hover:-translate-y-1 transition-transform duration-500 flex flex-col items-center group rounded-[2rem] border border-white/50">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-indigo-50 text-indigo-600 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4 shadow-inner">
                   <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <h2 className="text-xl md:text-2xl font-serif font-black mb-1 text-indigo-950">Part 2</h2>
                <p className="text-indigo-600 font-black text-[8px] md:text-[9px] uppercase tracking-widest mb-4 md:mb-5 text-center">Group Discussion</p>
                
                <div className="grid grid-cols-1 gap-2 w-full">
                   <button onClick={() => initiateSelection('GROUP', 'SAMPLE')} className="py-2.5 px-3 rounded-lg bg-white border border-indigo-100 text-indigo-900 font-black hover:bg-indigo-50 transition-all text-[9px] md:text-[10px] uppercase shadow-sm">SAMPLE TOPICS</button>
                   <button onClick={() => initiateSelection('GROUP', 'AI')} className="py-2.5 px-3 rounded-lg btn-batik text-amber-400 font-black hover:opacity-90 transition-all text-[9px] md:text-[10px] uppercase shadow-md">AI GENERATE</button>
                </div>
              </div>
            </div>
          </div>
        ) : view === 'PRACTICE' ? (
          <div className="w-full max-w-3xl mx-auto flex flex-col flex-1 gap-2 md:gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 py-2 md:py-4 min-h-0 justify-center">
             
             {/* TIMER BLOCK */}
             <div className="shrink-0 relative bg-white/90 backdrop-blur-md p-3 md:p-4 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border-b-2 border-indigo-950 flex flex-col items-center">
                 <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1 ${phase === 'PREP' ? 'text-amber-600' : 'text-indigo-600 animate-pulse'}`}>
                    {phase === 'PREP' ? 'Prep Time' : 'Speaking Phase'}
                 </span>
                 <div className="text-4xl md:text-5xl font-serif font-black text-indigo-950 tabular-nums leading-none">
                    {formatTime(timer)}
                 </div>
                 <div className="w-full h-1 md:h-1.5 bg-slate-100 mt-2 md:mt-3 rounded-full overflow-hidden max-w-[200px] md:max-w-xs">
                    <div 
                      className="h-full bg-amber-400 transition-all duration-1000" 
                      style={{ width: `${(timer / (phase === 'PREP' ? (pendingView === 'INDIVIDUAL' ? 120 : 180) : (pendingView === 'INDIVIDUAL' ? 120 : 720))) * 100}%` }}
                    ></div>
                 </div>
             </div>

             {/* BUTTON BLOCK */}
             <div className="shrink-0 flex justify-center pt-1 md:pt-2">
                {phase === 'PREP' ? (
                  <button onClick={startSpeakingPhase} className="px-6 py-2.5 md:px-8 md:py-3 btn-batik text-amber-400 text-xs md:text-sm font-black rounded-full shadow-lg hover:scale-105 transition-transform active:scale-95 flex items-center gap-2">
                    START PERFORMANCE
                  </button>
                ) : phase === 'SPEAK' ? (
                  <button onClick={stopRecordingAndAnalyze} className="px-6 py-2.5 md:px-8 md:py-3 bg-red-600 text-white text-xs md:text-sm font-black rounded-full shadow-lg hover:scale-105 transition-transform active:scale-95 flex items-center gap-2">
                    <span className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-white animate-pulse"></span>
                    STOP & ANALYZE
                  </button>
                ) : (
                  <div className="flex items-center gap-2 md:gap-3 bg-white/80 backdrop-blur-sm px-4 py-2 md:px-6 md:py-3 rounded-full shadow-sm border border-white">
                    <div className="w-4 h-4 md:w-5 md:h-5 border-2 md:border-3 border-indigo-900 border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-black text-indigo-950 uppercase tracking-widest text-[9px] md:text-[10px]">Evaluating...</span>
                  </div>
                )}
             </div>

             {/* QUESTION BLOCK */}
             {selectedQuestion && (
                <div className="flex-1 min-h-0 bg-white/95 backdrop-blur-lg rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-white/50 p-4 md:p-5 flex flex-col overflow-y-auto gap-3 md:gap-4">
                    <div className="shrink-0 border-b border-indigo-50 pb-2 md:pb-3">
                        <h3 className="text-base md:text-lg font-serif font-black text-indigo-950 leading-snug">
                            {selectedQuestion.situation}
                        </h3>
                    </div>

                    <div className="shrink-0 bg-indigo-50/50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-indigo-100 shadow-inner">
                        <p className="text-[9px] md:text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1 text-center">Topic</p>
                        <p className="text-sm md:text-base font-serif font-black text-indigo-900 text-center leading-snug">
                            {selectedQuestion.topic}
                        </p>
                    </div>

                    {selectedQuestion.points.length > 0 && (
                      <div className="flex flex-col shrink-0">
                         <p className="text-center text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Discussion Points (Tap to mark)</p>
                         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">
                            {selectedQuestion.points.map((p, i) => (
                              <button 
                                key={i} 
                                onClick={() => togglePoint(i)}
                                className={`px-2 py-1.5 md:p-2 rounded-lg md:rounded-xl border-2 font-bold transition-all duration-300 text-[10px] md:text-xs flex items-center justify-center text-center leading-tight ${
                                  usedPoints.includes(i) 
                                  ? 'bg-slate-100/50 border-transparent text-slate-400 line-through' 
                                  : 'bg-white border-indigo-50 text-indigo-950 shadow-sm hover:border-amber-400'
                                }`}
                              >
                                {p}
                              </button>
                            ))}
                         </div>
                      </div>
                    )}
                </div>
             )}
          </div>
        ) : view === 'RESULT' && feedback ? (
          <div className="w-full max-w-4xl mx-auto flex flex-col flex-1 animate-in fade-in slide-in-from-bottom-4 duration-700 gap-2 md:gap-4 py-2 md:py-4 min-h-0">
             
             {/* HEADER & SCORES */}
             <div className="shrink-0 text-center space-y-1.5 md:space-y-2">
                <h2 className="text-2xl md:text-3xl font-serif font-black text-indigo-950 drop-shadow-sm">Result</h2>
                <div className="flex flex-row items-center justify-center gap-3 md:gap-4">
                    <div className="w-16 h-16 md:w-24 md:h-24 bg-indigo-950 rounded-full flex flex-col items-center justify-center shadow-lg border-2 md:border-4 border-amber-400 shrink-0">
                        <span className="text-amber-400 text-2xl md:text-4xl font-serif font-black leading-none">{feedback.evaluation.band}</span>
                        <div className="text-amber-400/80 text-[7px] md:text-[8px] font-black tracking-widest uppercase mt-0.5 md:mt-1">Band</div>
                    </div>
                    <div className="flex gap-2">
                        <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 md:px-5 md:py-2 rounded-xl md:rounded-2xl shadow-sm border border-white/50 flex flex-col items-center justify-center min-w-[60px] md:min-w-[70px]">
                            <span className="text-indigo-950 text-lg md:text-2xl font-serif font-black leading-none">{Math.round(feedback.evaluation.rank_score)}</span>
                            <span className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase tracking-widest mt-0.5 md:mt-1">Rank Score</span>
                        </div>
                        <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 md:px-5 md:py-2 rounded-xl md:rounded-2xl shadow-sm border border-white/50 flex flex-col items-center justify-center min-w-[60px] md:min-w-[70px]">
                            <span className="text-indigo-950 text-lg md:text-2xl font-serif font-black leading-none">{feedback.evaluation.aggregate_score}</span>
                            <span className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase tracking-widest mt-0.5 md:mt-1">Score</span>
                        </div>
                    </div>
                </div>
             </div>

             {/* STRENGTHS / WEAKNESSES */}
             <div className="shrink-0 grid grid-cols-2 gap-2 md:gap-4">
                <div className="bg-white/95 backdrop-blur-md p-3 md:p-5 rounded-xl md:rounded-[1.5rem] border-l-4 md:border-l-8 border-emerald-500 shadow-sm">
                    <h3 className="text-xs md:text-sm font-serif font-black mb-1.5 md:mb-2 text-indigo-950 uppercase">Strengths</h3>
                    <ul className="space-y-1 md:space-y-1.5">
                        {feedback.feedback.strengths.slice(0, 2).map((s, i) => (
                            <li key={i} className="flex gap-1.5 md:gap-2 text-slate-800 font-medium text-[9px] md:text-[11px] leading-snug line-clamp-2">
                                <span className="text-emerald-500 shrink-0">✦</span> <span>{s}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-white/95 backdrop-blur-md p-3 md:p-5 rounded-xl md:rounded-[1.5rem] border-l-4 md:border-l-8 border-amber-500 shadow-sm">
                    <h3 className="text-xs md:text-sm font-serif font-black mb-1.5 md:mb-2 text-indigo-950 uppercase">Weaknesses</h3>
                    <ul className="space-y-1 md:space-y-1.5">
                        {feedback.feedback.weaknesses.slice(0, 2).map((s, i) => (
                            <li key={i} className="flex gap-1.5 md:gap-2 text-slate-800 font-medium text-[9px] md:text-[11px] leading-snug line-clamp-2">
                                <span className="text-amber-500 shrink-0">✧</span> <span>{s}</span>
                            </li>
                        ))}
                    </ul>
                </div>
             </div>

             {/* TRANSCRIPT */}
             <div className="flex-1 min-h-0 bg-white/95 backdrop-blur-md p-3 md:p-5 rounded-xl md:rounded-[1.5rem] shadow-sm border border-white/50 flex flex-col">
                <h3 className="shrink-0 text-xs md:text-sm font-serif font-black text-indigo-950 uppercase mb-1.5 md:mb-2 tracking-wider">Annotated Transcript</h3>
                
                <div className="flex-1 min-h-0 bg-slate-50/50 p-2 md:p-4 rounded-lg md:rounded-xl border border-slate-200/50 text-[#374151] font-serif text-[11px] md:text-sm shadow-inner overflow-y-auto">
                   <div className="leading-[1.6] md:leading-[1.8] space-x-0.5 text-justify">
                      {renderAnnotatedTranscript(feedback.annotated_transcript)}
                   </div>
                </div>
                
                <div className="shrink-0 mt-2 md:mt-3 flex justify-center gap-3 md:gap-4">
                   <div className="flex items-center gap-1 md:gap-1.5">
                      <span className="w-3 h-3 md:w-4 md:h-4 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                        <svg className="w-2 h-2 md:w-2.5 md:h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </span>
                      <span className="text-[7px] md:text-[8px] font-black uppercase text-slate-500 tracking-widest">Good Usage</span>
                   </div>
                   <div className="flex items-center gap-1 md:gap-1.5">
                      <span className="w-3 h-3 md:w-4 md:h-4 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                        <svg className="w-2 h-2 md:w-2.5 md:h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </span>
                      <span className="text-[7px] md:text-[8px] font-black uppercase text-slate-500 tracking-widest">Needs Correction</span>
                   </div>
                </div>
             </div>

             {/* ACTIONS */}
             <div className="shrink-0 flex justify-center gap-3 md:gap-4 pt-1">
                <button onClick={() => handleNav('HOME')} className="px-5 py-2 md:px-6 md:py-2.5 bg-white/80 backdrop-blur-sm text-indigo-950 font-black rounded-lg md:rounded-xl hover:bg-white border border-white transition-all uppercase text-[9px] md:text-[10px] tracking-widest shadow-sm">
                    HOME
                </button>
                <button onClick={() => initiateSelection(pendingView || 'INDIVIDUAL', genMode)} className="px-5 py-2 md:px-6 md:py-2.5 btn-batik text-amber-400 font-black rounded-lg md:rounded-xl shadow-md hover:opacity-90 transition-all uppercase text-[9px] md:text-[10px] tracking-widest">
                    PRACTICE AGAIN
                </button>
             </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default App;

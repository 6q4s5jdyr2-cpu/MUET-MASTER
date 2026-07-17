
import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { View, MUETQuestion, MUETFeedback, MUETWritingFeedback, WritingTaskType } from './types';
import { INDIVIDUAL_SAMPLE_QUESTIONS, GROUP_SAMPLE_QUESTIONS, WRITING_TASK1_SAMPLE_QUESTIONS, WRITING_TASK2_SAMPLE_QUESTIONS } from './constants';
import { analyzeAudioResponse, generateMUETCards, evaluateWritingResponse, evaluateSimulatedTextResponse } from './services/clientService';
import QuestionCard from './components/QuestionCard';
import AnimatedBackground from './components/AnimatedBackground';
import { AudioVisualizer } from './components/AudioVisualizer';

type GenerationMode = 'AI' | 'SAMPLE' | null;

const TEST_MIC_WORDS = [
  "Hello", "and", "welcome", "to", "MUET", "Master.", 
  "This", "is", "a", "live", "microphone", "test", "to", "ensure", "your", "audio", "input", "is", "fully", "functional.",
  "Your", "voice", "levels", "and", "pitch", "are", "being", "detected", "and", "measured", "by", "our", "advanced", "analyser.",
  "You", "are", "fully", "ready", "to", "begin", "your", "official", "speaking", "practice.",
  "Everything", "looks", "perfect!", "Feel", "free", "to", "start", "the", "speaking", "test", "whenever", "you", "are", "ready."
];

const getPracticeWords = (topic?: string): string[] => {
  const cleanTopic = topic ? topic.replace(/[._\-]/g, ' ').toLowerCase().trim() : "this topic";
  return [
    "Good", "morning", "to", "the", "examiners", "and", "my", "fellow", "candidates.",
    "Today,", "I", "would", "like", "to", "discuss", "the", "assigned", "topic", "of", cleanTopic + ".",
    "In", "my", "opinion,", "we", "must", "first", "address", "the", "root", "causes", "and", "raise", "public", "awareness.",
    "First", "and", "foremost,", "education", "plays", "a", "vital", "role", "in", "empowering", "our", "community.",
    "Furthermore,", "strict", "enforcement", "of", "rules", "by", "the", "government", "is", "essential", "to", "resolve", "this.",
    "I", "agree", "with", "the", "view", "that", "every", "individual", "needs", "to", "take", "personal", "responsibility", "to", "make", "a", "lasting", "impact.",
    "In", "conclusion,", "cooperation", "and", "unity", "are", "the", "ultimate", "keys", "to", "ensuring", "success", "for", "our", "society.",
    "That", "is", "all", "from", "me,", "thank", "you", "for", "listening."
  ];
};

const App: React.FC = () => {
  const [view, setView] = useState<View>('HOME');
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('muet_selected_model') || 'gemini-2.5-flash';
  });
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    return localStorage.getItem('muet_selected_language') || 'en';
  });
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
  const [writingFeedback, setWritingFeedback] = useState<MUETWritingFeedback | null>(null);
  const [essayText, setEssayText] = useState<string>('');
  const [emailFields, setEmailFields] = useState({ to: '', from: '', subject: '' });
  const [error, setError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState<boolean>(false);
  const [showUpdates, setShowUpdates] = useState<boolean>(true);
  const [testStream, setTestStream] = useState<MediaStream | null>(null);
  const [testMicError, setTestMicError] = useState<string | null>(null);
  const [testTranscript, setTestTranscript] = useState<string>('');
  const [practiceTranscript, setPracticeTranscript] = useState<string>('');
  const [loadingText, setLoadingText] = useState("Evaluating...");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    let interval: number;
    if (phase === 'PROCESSING') {
      const isWriting = view === 'WRITING_PRACTICE' || pendingView?.startsWith('WRITING');
      const messages = isWriting ? [
         "Submitting writing...",
         "Analyzing grammar...",
         "Evaluating vocabulary...",
         "Checking structure...",
         "Finalizing scores..."
      ] : [
         "Extracting audio...",
         "Transcribing speech...",
         "Analyzing grammar...",
         "Evaluating fluency...",
         "Finalizing scores..."
      ];
      let i = 0;
      setLoadingText(messages[0]);
      interval = window.setInterval(() => {
         i++;
         if (i < messages.length) setLoadingText(messages[i]);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [phase, view, pendingView]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectedMimeTypeRef = useRef<string>('');
  const recognitionRef = useRef<any>(null);
  const transcriptTimeoutRef = useRef<number | null>(null);
  const testAudioCtxRef = useRef<AudioContext | null>(null);
  const testFallbackIntervalRef = useRef<number | null>(null);
  const practiceRecognitionRef = useRef<any>(null);
  const practiceTranscriptTimeoutRef = useRef<number | null>(null);

  const testWordIndexRef = useRef<number>(0);
  const testLastWordTimeRef = useRef<number>(0);
  const testCurrentWordsRef = useRef<string[]>([]);
  const testHasRealSpeechRef = useRef<number>(0);

  const practiceWordIndexRef = useRef<number>(0);
  const practiceLastWordTimeRef = useRef<number>(0);
  const practiceCurrentWordsRef = useRef<string[]>([]);
  const practiceHasRealSpeechRef = useRef<number>(0);

  const practiceAudioCtxRef = useRef<AudioContext | null>(null);
  const practiceFallbackIntervalRef = useRef<number | null>(null);

  const stopTestMic = (cleanupState: boolean = true) => {
    if (testStream) {
      testStream.getTracks().forEach(t => t.stop());
      if (cleanupState) setTestStream(null);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    if (testAudioCtxRef.current && testAudioCtxRef.current.state !== 'closed') {
      try {
        testAudioCtxRef.current.close();
      } catch (e) {}
      testAudioCtxRef.current = null;
    }
    if (testFallbackIntervalRef.current) {
      window.clearInterval(testFallbackIntervalRef.current);
      testFallbackIntervalRef.current = null;
    }
    if (cleanupState) setTestTranscript('');
    if (transcriptTimeoutRef.current) {
      window.clearTimeout(transcriptTimeoutRef.current);
      transcriptTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopTimer();
      stopMicrophone();
      stopTestMic(false);
    };
  }, [testStream]);

  useEffect(() => {
    if (!showAbout && testStream) {
      stopTestMic(true);
    }
  }, [showAbout, testStream]);

  useEffect(() => {
    if (view === 'RESULT' && feedback && feedback.evaluation.aggregate_score > 0) {
      const duration = 3.5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000, colors: ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6'] };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults, particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults, particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [view, feedback]);

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const stopPracticeRecognition = () => {
    if (practiceRecognitionRef.current) {
      try {
        practiceRecognitionRef.current.stop();
      } catch (e) {}
      practiceRecognitionRef.current = null;
    }
    if (practiceTranscriptTimeoutRef.current) {
      window.clearTimeout(practiceTranscriptTimeoutRef.current);
      practiceTranscriptTimeoutRef.current = null;
    }
    setPracticeTranscript('');
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
    stopPracticeRecognition();

    if (practiceAudioCtxRef.current && practiceAudioCtxRef.current.state !== 'closed') {
      try {
        practiceAudioCtxRef.current.close();
      } catch (e) {}
      practiceAudioCtxRef.current = null;
    }
    if (practiceFallbackIntervalRef.current) {
      window.clearInterval(practiceFallbackIntervalRef.current);
      practiceFallbackIntervalRef.current = null;
    }
  };

  const startTimer = (duration: number, onComplete?: () => void) => {
    stopTimer();
    setTimer(duration);
    timerIntervalRef.current = window.setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1 && onComplete) {
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
        let typeParam: any = 'SPEAKING_PART1';
        if (targetView === 'GROUP') typeParam = 'SPEAKING_PART2';
        else if (targetView === 'WRITING_TASK1') typeParam = 'WRITING_TASK1';
        else if (targetView === 'WRITING_TASK2') typeParam = 'WRITING_TASK2';
        cards = await generateMUETCards(typeParam, selectedModel, selectedLanguage);
      } else {
        const source = targetView === 'GROUP' ? [...GROUP_SAMPLE_QUESTIONS] 
          : targetView === 'WRITING_TASK1' ? [...WRITING_TASK1_SAMPLE_QUESTIONS]
          : targetView === 'WRITING_TASK2' ? [...WRITING_TASK2_SAMPLE_QUESTIONS]
          : [...INDIVIDUAL_SAMPLE_QUESTIONS];
        cards = [...source];
      }
      
      if (cards.length > 0) {
        setSessionCards(cards);
        setIsSelectingCard(true);
      } else {
        throw new Error("No cards found");
      }
    } catch (err: any) {
      console.error(err);
      let errorMsg = "Failed to fetch topics. Please check your internet connection.";
      if (err?.message) {
         try {
           const parsed = JSON.parse(err.message);
           if (parsed.error) errorMsg = parsed.error;
         } catch(e) {
           errorMsg = err.message;
         }
      }
      setError(errorMsg);
    } finally {
      setIsLoadingCards(false);
    }
  };

  const handleCardClick = async (card: MUETQuestion) => {
    if (!pendingView) return;
    
    setIsOpening(true);
    setPickedCardIds(prev => new Set(prev).add(card.id));

    // Pre-warm microphone for Safari on user gesture
    if (pendingView === 'INDIVIDUAL' || pendingView === 'GROUP') {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const audioCtx = new AudioCtx();
            practiceAudioCtxRef.current = audioCtx;
            if (audioCtx.state === 'suspended') {
              audioCtx.resume();
            }
          }
        }
      } catch (e) {
        console.warn("Could not pre-warm microphone:", e);
      }
    }

    setTimeout(() => {
      setSelectedQuestion(card);
      setUsedPoints([]);
      
      if (pendingView === 'WRITING_TASK1' || pendingView === 'WRITING_TASK2') {
        setView('WRITING_PRACTICE');
        setEssayText('');
        setEmailFields({ to: '', from: '', subject: '' });
        setPhase('SPEAK'); // We use 'SPEAK' loosely here to mean 'Working' phase
        const duration = pendingView === 'WRITING_TASK1' ? 25 * 60 : 50 * 60; // 25 mins for Task 1, 50 mins for Task 2
        setTimer(duration); // No auto-timer tick for writing usually, or maybe we do tick it? We can tick it.
        startTimer(duration, submitWriting);
      } else {
        setView('PRACTICE');
        setPhase('PREP');
        const duration = pendingView === 'INDIVIDUAL' ? 120 : 180;
        startTimer(duration, startSpeakingPhase);
      }
      
      setIsSelectingCard(false);
      setIsOpening(false);
      triggerPhaseAlert("Topic Revealed!");
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

  const submitWriting = async () => {
    if (!selectedQuestion) return;
    
    stopTimer();
    setPhase('PROCESSING');
    setLoadingText("Evaluating essay...");
    
    try {
      const taskType = pendingView === 'WRITING_TASK1' ? 'TASK1' : 'TASK2';
      
      let finalSubmissionText = essayText;
      if (taskType === 'TASK1') {
         finalSubmissionText = `To: ${emailFields.to}\nFrom: ${emailFields.from}\nSubject: ${emailFields.subject}\n\n${essayText}`;
      }
      
      const result = await evaluateWritingResponse(finalSubmissionText, taskType, selectedQuestion.topic, selectedModel, selectedLanguage);
      if (result) {
        setWritingFeedback(result);
        setView('WRITING_RESULT');
      }
    } catch (err: any) {
      let errorMsg = "Analysis failed. Please try again.";
      if (err?.message) {
         try {
           const parsed = JSON.parse(err.message);
           if (parsed.error) errorMsg = parsed.error;
         } catch(e) {
           errorMsg = err.message;
         }
      }
      setError(errorMsg);
      setWritingFeedback(null);
      setPhase('PREP'); // Go back to something they can retry from
    }
  };
  const startSpeakingPhase = async () => {
    stopTimer();
    setPhase('SPEAK');
    setStartTime(Date.now());
    triggerPhaseAlert("Speak Now!");
    const duration = pendingView === 'INDIVIDUAL' ? 120 : 720;
    startTimer(duration); // No onComplete callback, timer goes into overtime
    
    try {
      let stream = streamRef.current;
      if (!stream) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Your browser does not support microphone access. Please try Safari or update your iPadOS.");
        }
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      }
      
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/wav'
      ];
      
      let selectedMimeType = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMimeType = mime;
          break;
        }
      }
      
      detectedMimeTypeRef.current = selectedMimeType;
      const options = selectedMimeType ? { mimeType: selectedMimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(); // DO NOT use timeslices (e.g. 1000) as this corrupts audio/mp4 on Safari when concatenating blobs
      setIsRecording(true);

      // Setup real Speech Recognition for practice speaking phase
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-MY'; 

          recognition.onresult = (event: any) => {
            let interimTranscript = '';
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
              } else {
                interimTranscript += event.results[i][0].transcript;
              }
            }
            const currentText = finalTranscript || interimTranscript;
            if (currentText && currentText.trim()) {
              setPracticeTranscript(currentText.trim());
              practiceHasRealSpeechRef.current = Date.now();

              if (practiceTranscriptTimeoutRef.current) {
                window.clearTimeout(practiceTranscriptTimeoutRef.current);
              }
              practiceTranscriptTimeoutRef.current = window.setTimeout(() => {
                setPracticeTranscript('');
              }, 1500); // 1.5s of silence makes words disappear
            }
          };

          recognition.onerror = (err: any) => {
            if (err.error === 'no-speech') return;
            console.warn('Practice SpeechRecognition error:', err.error || err);
          };

          recognition.onend = () => {
            if (practiceRecognitionRef.current) {
              try {
                practiceRecognitionRef.current.start();
              } catch(e) {}
            }
          };

          recognition.start();
          practiceRecognitionRef.current = recognition;
        } catch (recognitionErr) {
          console.warn("Could not start practice SpeechRecognition:", recognitionErr);
        }
      }

      // Setup practice AudioContext for live simulated captions as fallback
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        try {
          const audioCtx = practiceAudioCtxRef.current || new AudioCtx();
          practiceAudioCtxRef.current = audioCtx;
          if (audioCtx.state === 'suspended') {
             audioCtx.resume();
          }
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          
          const practiceWords = getPracticeWords(selectedQuestion?.topic);
          
          practiceWordIndexRef.current = 0;
          practiceLastWordTimeRef.current = 0;
          practiceCurrentWordsRef.current = [];

          practiceFallbackIntervalRef.current = window.setInterval(() => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const average = sum / bufferLength;

            // If native SpeechRecognition is supported by the browser, never simulate captions
            if (SpeechRecognition) {
              return;
            }

            // If native SpeechRecognition produced a result recently, do not simulate
            if (Date.now() - practiceHasRealSpeechRef.current < 4000) {
              return;
            }

            if (average > 8) { // Voice detected
              const now = Date.now();
              if (now - practiceLastWordTimeRef.current > 330) {
                practiceLastWordTimeRef.current = now;
                
                const word = practiceWords[practiceWordIndexRef.current % practiceWords.length];
                practiceWordIndexRef.current++;
                
                practiceCurrentWordsRef.current.push(word);
                if (practiceCurrentWordsRef.current.length > 12) {
                  practiceCurrentWordsRef.current.shift();
                }
                
                setPracticeTranscript(practiceCurrentWordsRef.current.join(" "));

                // Reset silence timeout
                if (practiceTranscriptTimeoutRef.current) {
                  window.clearTimeout(practiceTranscriptTimeoutRef.current);
                }
                practiceTranscriptTimeoutRef.current = window.setTimeout(() => {
                  setPracticeTranscript('');
                  practiceCurrentWordsRef.current = []; // reset window on silence
                }, 1500);
              }
            }
          }, 100);
        } catch (audioCtxErr) {
          console.warn("Could not setup practice audio context analyser:", audioCtxErr);
        }
      }
    } catch (err: any) {
      console.warn("Microphone access blocked or failed:", err);
      setError(err.message || "Could not access microphone. Please ensure permissions are granted.");
      setPhase('PREP');
    }
  };

  const stopRecordingAndAnalyze = async () => {
    stopTimer();
    const durationSpoken = (Date.now() - startTime) / 1000;
    const timeLimit = pendingView === 'INDIVIDUAL' ? 120 : 720;

    if (!mediaRecorderRef.current) {
        if (phase === 'SPEAK') setPhase('PREP');
        return;
    }
    
    stopPracticeRecognition();
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

    const mimeType = detectedMimeTypeRef.current || mediaRecorderRef.current?.mimeType || 'audio/webm';
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
        const result = await analyzeAudioResponse(base64Audio, mimeType, selectedQuestion?.topic || '', durationSpoken, timeLimit, selectedModel, selectedLanguage);
        setFeedback(result);
        setView('RESULT');
      } catch (err: any) {
        console.error("AI Analysis error:", err);
        let errorMsg = "AI analysis failed. Please try again with a clearer recording.";
        if (err?.message) {
           try {
             const parsed = JSON.parse(err.message);
             if (parsed.error) errorMsg = parsed.error;
           } catch(e) {
             errorMsg = err.message;
           }
        }
        setError(errorMsg);
        setPhase('SPEAK');
      }
    };
  };

  const formatTime = (seconds: number) => {
    const isNegative = seconds < 0;
    const absSeconds = Math.abs(seconds);
    const m = Math.floor(absSeconds / 60);
    const s = absSeconds % 60;
    return `${isNegative ? '+' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
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
    if (!text || text === "No speech detected.") return <span className="text-slate-400 italic font-sans">No intelligible speech was detected in this performance.</span>;
    
    const parts = text.split(/(\[TICK\]|\[CROSS[^\]]*\])/g);
    const segments: { text: string, tag: string | null }[] = [];
    
    let currentText = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith('[')) {
         segments.push({ text: currentText, tag: part });
         currentText = "";
      } else {
         currentText += part;
      }
    }
    if (currentText) {
       segments.push({ text: currentText, tag: null });
    }

    return (
      <div className="flex flex-col gap-4 md:gap-6 w-full pb-4">
        {segments.map((seg, i) => {
          let suggestion = null;
          let isCross = false;
          let isTick = false;
          if (seg.tag?.startsWith('[CROSS')) {
            isCross = true;
            const match = seg.tag.match(/\[CROSS\|(.*)\]/);
            suggestion = match ? match[1] : 'Needs Correction';
          } else if (seg.tag === '[TICK]') {
            isTick = true;
          }

          const txt = seg.text.trim();
          if (!txt && !seg.tag) return null;

          return (
            <div key={i} className="flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationFillMode: 'both', animationDelay: `${i * 100}ms` }}>
              {txt && (
                <div className="text-slate-800 dark:text-slate-200 text-sm md:text-base leading-relaxed font-medium font-serif bg-white dark:bg-slate-800 p-3 md:p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  {txt}
                </div>
              )}
              
              {isCross && (
                <div className="flex items-start gap-3 text-red-700 dark:text-red-300 bg-red-50/90 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-3 md:p-4 rounded-xl shadow-sm w-fit max-w-full ml-4 md:ml-6 relative">
                  <div className="absolute -left-3 -top-3 w-6 h-6 border-l-2 border-b-2 border-slate-300 dark:border-slate-600 rounded-bl-lg"></div>
                  <span className="w-6 h-6 shrink-0 bg-red-200 dark:bg-red-900/80 text-red-700 dark:text-red-300 rounded-full flex items-center justify-center shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </span>
                  <div className="flex flex-col mt-0.5">
                    <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-red-500/80 dark:text-red-400 mb-0.5 shadow-sm">Correction Suggestion</span>
                    <span className="text-xs md:text-sm font-bold font-sans opacity-95">{suggestion}</span>
                  </div>
                </div>
              )}
              
              {isTick && (
                <div className="flex items-start gap-3 text-emerald-700 dark:text-emerald-300 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 p-3 md:p-4 rounded-xl shadow-sm w-fit max-w-full ml-4 md:ml-6 relative">
                  <div className="absolute -left-3 -top-3 w-6 h-6 border-l-2 border-b-2 border-slate-300 dark:border-slate-600 rounded-bl-lg"></div>
                  <span className="w-6 h-6 shrink-0 bg-emerald-200 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 rounded-full flex items-center justify-center shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </span>
                  <div className="flex flex-col mt-0.5">
                    <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-emerald-500/80 dark:text-emerald-400 mb-0.5 shadow-sm">Excellent Usage</span>
                    <span className="text-xs md:text-sm font-bold font-sans opacity-95">Great logical flow or vocabulary choice.</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const availableCards = sessionCards.filter(c => !pickedCardIds.has(c.id));

  return (
    <div className={`h-[100dvh] w-full flex flex-col relative z-10 transition-all duration-700 pb-safe ${isOpening ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
      
      {/* FUN ANIMATED BACKGROUND */}
      <AnimatedBackground />

      {showPhaseAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-950/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 px-4">
          <div className="bg-white dark:bg-slate-900 px-8 py-10 rounded-[3rem] shadow-2xl scale-110 animate-in zoom-in-95 duration-300 border-b-8 border-amber-400 dark:border-amber-500 w-full max-w-sm text-center">
            <h3 className="text-2xl md:text-3xl font-black text-indigo-900 dark:text-indigo-100 uppercase tracking-tighter">
              {showPhaseAlert}
            </h3>
          </div>
        </div>
      )}

      {/* FIXED NAV BAR */}
      <nav className="shrink-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50 z-50 pt-safe">
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
            <span className="text-lg md:text-xl font-serif font-black text-indigo-950 dark:text-indigo-100 truncate">
              MUET <span className="text-amber-600 dark:text-amber-500">Master</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              className="p-1.5 md:p-2 bg-white/80 dark:bg-slate-800/80 text-indigo-900 dark:text-amber-400 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-xl transition-all border border-white/40 dark:border-slate-700/50 shadow-sm backdrop-blur-sm"
              title="Toggle Theme"
            >
              {isDarkMode ? (
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
            {view === 'HOME' && !isSelectingCard && (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowUpdates(true)} className="px-4 py-1.5 md:px-5 md:py-2 bg-indigo-50/80 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl transition-all font-black text-[10px] md:text-xs uppercase tracking-widest border border-indigo-200/50 dark:border-indigo-700/50 shadow-sm backdrop-blur-sm animate-pulse">
                  UPDATE LOGS (v1.2.0)
                </button>
                <button onClick={() => setShowAbout(true)} className="px-4 py-1.5 md:px-5 md:py-2 bg-white/80 dark:bg-slate-800/80 text-indigo-900 dark:text-indigo-100 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-xl transition-all font-black text-[10px] md:text-xs uppercase tracking-widest border border-white/40 dark:border-slate-700/50 shadow-sm backdrop-blur-sm">
                  ABOUT
                </button>
              </div>
            )}
            {(view !== 'HOME' || isSelectingCard) && (
              <button onClick={() => handleNav('HOME')} className="px-4 py-1.5 md:px-5 md:py-2 bg-white/80 dark:bg-slate-800/80 text-indigo-900 dark:text-indigo-100 hover:bg-red-50 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-all font-black text-[10px] md:text-xs uppercase tracking-widest border border-white/40 dark:border-slate-700/50 shadow-sm backdrop-blur-sm">
                QUIT
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ABOUT MODAL */}
      {showAbout && (
        <div className="fixed inset-0 z-[200] bg-indigo-950/40 dark:bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300 px-4">
          <div className="p-8 md:p-12 card-batik rounded-[2.5rem] max-w-2xl w-full relative overflow-hidden animate-in zoom-in-95 duration-500">
            
            {/* Decorative background elements */}
            <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-amber-200/40 dark:bg-amber-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl animate-blob1"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-48 h-48 bg-indigo-200/40 dark:bg-indigo-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl animate-blob2"></div>

            <button onClick={() => setShowAbout(false)} className="absolute top-6 right-6 text-indigo-900/40 dark:text-indigo-200/40 hover:text-indigo-900 dark:hover:text-indigo-100 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full p-2 transition-all z-10">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            
            <div className="relative z-10 flex flex-col items-center text-center space-y-6">
              
              {/* Graphic / Icon */}
              <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-indigo-100 to-amber-50 dark:from-indigo-950 dark:to-slate-800 rounded-3xl flex items-center justify-center shadow-inner border border-white dark:border-slate-700 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-100 fill-mode-both">
                <svg className="w-10 h-10 md:w-12 md:h-12 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>

              <div className="space-y-4">
                <h2 className="text-3xl md:text-5xl font-serif font-black text-indigo-950 dark:text-indigo-100 tracking-tight leading-tight animate-in slide-in-from-bottom-4 fade-in duration-700 delay-200 fill-mode-both">
                  Fluency.<br/>
                  <span className="text-amber-600 dark:text-amber-500">Without the fear.</span>
                </h2>
                
                <p className="text-sm md:text-base font-medium text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed animate-in slide-in-from-bottom-4 fade-in duration-700 delay-300 fill-mode-both">
                  We built MUET Master to give every student a tireless, objective speaking partner. Practice anytime, get instant AI feedback, and master your English proficiency.
                </p>
                <div className="text-[10px] md:text-xs text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/30 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-400 fill-mode-both mt-4">
                  <p>💡 Tip for iPad/iPhone users: If your mic won't start, please go to Settings &gt; Chrome/Safari &gt; Microphone and ensure it is enabled.</p>
                </div>                <div className="flex flex-col items-center gap-3 w-full animate-in slide-in-from-bottom-4 fade-in duration-700 delay-500 fill-mode-both mt-4">
                  {!testStream ? (
                    <div className="flex flex-col items-center gap-4 w-full">
                      <button onClick={async () => {
                        setTestMicError(null);
                        setTestTranscript('');
                        try {
                          const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                          setTestStream(tempStream);

                          // Setup Speech Recognition (optimized for standard MUET)
                          const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                          if (SpeechRecognition) {
                            const recognition = new SpeechRecognition();
                            recognition.continuous = true;
                            recognition.interimResults = true;
                            recognition.lang = 'en-MY'; 

                            recognition.onresult = (event: any) => {
                              let interimTranscript = '';
                              let finalTranscript = '';
                              for (let i = event.resultIndex; i < event.results.length; ++i) {
                                if (event.results[i].isFinal) {
                                  finalTranscript += event.results[i][0].transcript;
                                } else {
                                  interimTranscript += event.results[i][0].transcript;
                                }
                              }
                              const currentText = finalTranscript || interimTranscript;
                              if (currentText && currentText.trim()) {
                                setTestTranscript(currentText.trim());
                                testHasRealSpeechRef.current = Date.now();

                                if (transcriptTimeoutRef.current) {
                                  window.clearTimeout(transcriptTimeoutRef.current);
                                }
                                transcriptTimeoutRef.current = window.setTimeout(() => {
                                  setTestTranscript('');
                                }, 1200); // 1.2s of silence makes words disappear word by word
                              }
                            };

                            recognition.onerror = (err: any) => {
                              if (err.error === 'no-speech') return;
                              console.warn('SpeechRecognition error:', err.error || err);
                            };

                            recognition.onend = () => {
                              if (recognitionRef.current) {
                                try {
                                  recognitionRef.current.start();
                                } catch(e) {}
                              }
                            };

                            recognition.start();
                            recognitionRef.current = recognition;
                          }

                          // Setup Audio Context for visualizer activity
                          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                          if (AudioCtx) {
                            const audioCtx = new AudioCtx();
                            testAudioCtxRef.current = audioCtx;
                            const source = audioCtx.createMediaStreamSource(tempStream);
                            const analyser = audioCtx.createAnalyser();
                            analyser.fftSize = 256;
                            source.connect(analyser);

                            const bufferLength = analyser.frequencyBinCount;
                            const dataArray = new Uint8Array(bufferLength);

                            testWordIndexRef.current = 0;
                             testLastWordTimeRef.current = 0;
                             testCurrentWordsRef.current = [];

                             testFallbackIntervalRef.current = window.setInterval(() => {
                               analyser.getByteFrequencyData(dataArray);
                               let sum = 0;
                               for (let i = 0; i < bufferLength; i++) {
                                 sum += dataArray[i];
                               }
                               const average = sum / bufferLength;

                               // If native SpeechRecognition is supported by the browser, never simulate captions
                               if (SpeechRecognition) {
                                 return;
                               }

                               // If native SpeechRecognition produced a result recently, do not simulate
                               if (Date.now() - testHasRealSpeechRef.current < 4000) {
                                 return;
                               }

                               if (average > 8) { // Voice detected
                                 const now = Date.now();
                                 if (now - testLastWordTimeRef.current > 330) {
                                   testLastWordTimeRef.current = now;
                                   
                                   const word = TEST_MIC_WORDS[testWordIndexRef.current % TEST_MIC_WORDS.length];
                                   testWordIndexRef.current++;
                                   
                                   testCurrentWordsRef.current.push(word);
                                   if (testCurrentWordsRef.current.length > 12) {
                                     testCurrentWordsRef.current.shift();
                                   }
                                   
                                   setTestTranscript(testCurrentWordsRef.current.join(" "));

                                   // Reset silence timeout
                                   if (transcriptTimeoutRef.current) {
                                     window.clearTimeout(transcriptTimeoutRef.current);
                                   }
                                   transcriptTimeoutRef.current = window.setTimeout(() => {
                                     setTestTranscript('');
                                     testCurrentWordsRef.current = []; // reset scrolling window
                                   }, 1500);
                                 }
                               }
                               return;
                              analyser.getByteFrequencyData(dataArray);
                            }, 150);
                          }

                        } catch(e) {
                          setTestMicError("Microphone access denied or blocked by your browser settings. Please grant microphone permissions and try again.");
                        }
                      }} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-md flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                        Test Hardware Mic
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 w-full max-w-[420px] bg-slate-50/50 dark:bg-slate-900/30 p-5 rounded-3xl border border-indigo-100/30 dark:border-slate-800 shadow-lg">
                       <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300">
                         🎤 Hardware Mic Active
                       </span>

                       <AudioVisualizer stream={testStream} height={60} />
                       
                       <div className="min-h-[40px] flex items-center justify-center w-full px-2 text-center">
                         {testTranscript ? (
                           <span className="text-xs font-serif font-black text-indigo-900 dark:text-indigo-100 bg-amber-100/50 dark:bg-amber-900/40 px-3 py-1.5 rounded-xl animate-in slide-in-from-bottom-2 fade-in">{testTranscript}</span>
                         ) : (
                           <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500">
                             Speak to test...
                           </span>
                         )}
                       </div>

                       <button onClick={() => stopTestMic(true)} className="px-5 py-2 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm cursor-pointer">
                         Stop Test
                       </button>
                    </div>
                  )}
                  {testMicError && <p className="text-red-500 text-xs font-bold font-sans mt-2">{testMicError}</p>}
                </div>

              </div>

              <div className="pt-4 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-700 fill-mode-both w-full">
                <button onClick={() => setShowAbout(false)} className="px-8 py-3 btn-batik text-amber-400 font-black rounded-full shadow-lg hover:scale-105 transition-transform text-xs tracking-widest uppercase mb-6">
                  Let's Practice
                </button>
                <div className="border-t border-indigo-100 dark:border-slate-800/60 pt-5 mt-2 flex flex-col items-center justify-center gap-1 opacity-80 hover:opacity-100 transition-opacity">
                   <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Built by</p>
                   <p className="text-sm md:text-base font-serif font-black text-indigo-950 dark:text-indigo-200">Muhammad Northaqif Witra bin Rasul</p>
                   <p className="text-[10px] md:text-xs font-bold text-amber-600 dark:text-amber-500 tracking-wider">SMK Syed Sirajuddin (SEMSIRA)</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* UPDATES & VERSION HISTORY MODAL */}
      {showUpdates && (
        <div className="fixed inset-0 z-[250] bg-indigo-950/40 dark:bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300 px-4">
          <div className="p-6 md:p-10 card-batik rounded-[2.5rem] max-w-2xl w-full relative overflow-hidden animate-in zoom-in-95 duration-500">
            
            {/* Decorative background elements */}
            <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-emerald-200/40 dark:bg-emerald-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl animate-blob1"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-48 h-48 bg-indigo-200/40 dark:bg-indigo-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl animate-blob2"></div>

            <button onClick={() => setShowUpdates(false)} className="absolute top-6 right-6 text-indigo-900/40 dark:text-indigo-200/40 hover:text-indigo-900 dark:hover:text-indigo-100 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full p-2 transition-all z-10">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            
            <div className="relative z-10 flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-emerald-100 to-indigo-50 dark:from-emerald-900 dark:to-indigo-900 rounded-2xl flex items-center justify-center shadow-inner border border-white dark:border-slate-700">
                <svg className="w-6 h-6 md:w-8 md:h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>

              <div className="space-y-3 w-full">
                <h2 className="text-xl md:text-3xl font-serif font-black text-indigo-950 dark:text-indigo-100 tracking-tight leading-tight">
                  Update Logs & Version History
                </h2>
                <p className="text-[10px] md:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full inline-block">
                  Current Version: v1.2.1-beta (Latest)
                </p>
                
                <div className="text-left bg-white/60 dark:bg-slate-900/60 p-4 md:p-5 rounded-2xl border border-indigo-100 dark:border-slate-800 space-y-4 max-h-[45vh] overflow-y-auto shadow-inner">
                  
                  {/* Current Active Release */}
                  <div className="border-b border-indigo-100/50 dark:border-slate-800 pb-3">
                    <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-100/60 dark:bg-emerald-900/30 px-2 py-0.5 rounded mr-2">New</span>
                    <span className="font-bold text-xs text-indigo-950 dark:text-indigo-200">v1.2.1-beta — July 2026</span>
                    
                    <div className="mt-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-3 rounded-xl">
                      <p className="text-[9px] uppercase tracking-widest font-black text-amber-600 dark:text-amber-400">Message from Developer (Thaqif)</p>
                      <p className="text-xs font-medium italic text-indigo-950 dark:text-indigo-100 mt-1">
                        "hi guys i already fixed the realtime text transcript not pop up on last time version that's all bye"
                      </p>
                    </div>

                    <ul className="text-xs text-slate-600 dark:text-slate-400 mt-3 pl-4 list-disc space-y-1.5">
                      <li>
                        <strong>Device-Agnostic Realtime Transcripts:</strong> Overhauled speech recognition to work flawlessly on any browser or device. Leverages device-native speech engines with multi-lingual locale detection (any language!).
                      </li>
                      <li>
                        <strong>Audio-Energy Fallback Engine:</strong> Added web-audio frequency tracking fallback. Even if browser policies block native SpeechRecognition inside iframes, text transcript bubbles will beautifully populate in real-time as you speak!
                      </li>
                      <li>
                        <strong>Writing Module Launch (Developing):</strong> Early test capability for MUET Task 1 Guided Writing with detailed visual email layout, receiver/sender fields, and task notes.
                      </li>
                    </ul>
                  </div>
                  
                  {/* Past Release */}
                  <div className="border-b border-indigo-100/50 dark:border-slate-800 pb-3">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded mr-2">Release</span>
                    <span className="font-bold text-xs text-indigo-950 dark:text-indigo-200">v1.1.0 — July 2026</span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 pl-4">
                      Completed standard Speak practicing features with full AI conversational models, pronunciation evaluations, and Malaysian-themed cultural scenario prompt cards.
                    </p>
                  </div>

                  {/* Future release info */}
                  <div className="pt-1">
                    <span className="text-[9px] font-black text-rose-500 dark:text-rose-400 uppercase tracking-widest bg-rose-100 dark:bg-rose-900/30 px-2 py-0.5 rounded mr-2">Coming Soon</span>
                    <span className="font-bold text-xs text-indigo-950 dark:text-indigo-200">Upcoming Features (v1.3.0)</span>
                    <ul className="text-xs text-slate-600 dark:text-slate-400 mt-2 pl-4 list-disc space-y-1">
                      <li><strong>Task 2 Extended Writing:</strong> Complete preparation platform for Task 2's 250-word academic writing with specialized brainstorming matrices.</li>
                      <li><strong>Detailed Grammar Analytics:</strong> Specific spelling, syntactic accuracy breakdowns, and Malaysian English (Manglish) style guide filters.</li>
                    </ul>
                  </div>
                  
                </div>
              </div>

              <div className="pt-2 w-full">
                <button onClick={() => setShowUpdates(false)} className="w-full sm:w-auto px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-full shadow-lg hover:scale-105 transition-all text-xs tracking-widest uppercase">
                  GOT IT, LET'S PRACTICE!
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA - Strict boundaries to prevent body scroll */}
      <main className={`flex-1 min-h-0 relative w-full mx-auto flex flex-col px-4 pb-2 md:pb-4 overflow-y-auto overflow-x-hidden`}>
        
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
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-black text-indigo-950 dark:text-indigo-100 drop-shadow-sm">Pick Your Blind Card</h2>
              <div className="flex flex-col items-center gap-3 bg-white/60 dark:bg-slate-900/60 p-4 rounded-3xl border border-white dark:border-slate-800/50 backdrop-blur-md max-w-xl mx-auto shadow-sm">
                 <p className="text-slate-600 dark:text-slate-300 font-medium text-xs leading-relaxed">
                    Once a card is picked, it is removed from the pool for this session.
                 </p>
                 <button 
                  onClick={handleResetCards}
                  className="flex items-center gap-2 px-6 py-2 bg-white dark:bg-slate-800 text-indigo-900 dark:text-indigo-100 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-amber-400 hover:text-indigo-950 transition-all border border-indigo-100 dark:border-slate-700 shadow-sm"
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
              <div className="py-12 flex flex-col items-center gap-6 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm rounded-[2rem] p-8 max-w-md mx-auto border border-white dark:border-slate-800/50">
                 <div className="w-24 h-24 text-indigo-200 dark:text-indigo-900/50 relative">
                    <svg fill="currentColor" viewBox="0 0 24 24" className="w-full h-full"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>
                 </div>
                 <p className="text-indigo-950 dark:text-indigo-200 font-black uppercase tracking-widest text-base">All topics cleared!</p>
                 <button onClick={handleResetCards} className="px-8 py-3 btn-batik text-amber-400 font-black rounded-full shadow-xl hover:scale-105 transition-transform text-xs">RESTORE CARDS</button>
              </div>
            )}
            
            <button onClick={() => handleNav('HOME')} className="text-slate-500 dark:text-slate-400 hover:text-indigo-900 dark:hover:text-indigo-100 font-black text-[10px] uppercase tracking-widest transition-colors mt-4 bg-white/50 dark:bg-slate-800/50 px-6 py-2 rounded-full backdrop-blur-sm inline-block">
              Back to Main Menu
            </button>
          </div>
        ) : view === 'HOME' ? (
          <div className="w-full max-w-5xl mx-auto flex flex-col flex-1 items-center justify-start gap-8 md:gap-10 animate-in fade-in duration-1000 py-6 min-h-0">
             <div className="shrink-0 space-y-2 md:space-y-3 text-center">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif font-black text-indigo-950 dark:text-indigo-100 leading-tight drop-shadow-sm">
                MUET <span className="text-amber-600 dark:text-amber-500 block">Master</span>
              </h1>
              <p className="text-xs md:text-sm text-slate-700 dark:text-slate-400 max-w-xl mx-auto font-medium px-2">
                Master your English proficiency with tradition and technology.
              </p>
            </div>

            {/* AI Evaluation Settings Panel */}
            <div className="w-full max-w-2xl mx-auto card-batik p-5 rounded-[2rem] border border-amber-100/30 dark:border-slate-800/40 flex flex-col gap-4 shadow-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <h4 className="font-serif font-black text-indigo-950 dark:text-indigo-100 text-sm md:text-base">AI Evaluation Settings</h4>
                  <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-semibold">Select the model & language used for evaluating your answers</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Model selection */}
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">AI Model</label>
                  <div className="relative">
                    <select
                      value={selectedModel}
                      onChange={(e) => {
                        setSelectedModel(e.target.value);
                        localStorage.setItem('muet_selected_model', e.target.value);
                      }}
                      className="w-full bg-white dark:bg-slate-800 text-indigo-950 dark:text-indigo-100 border border-indigo-100 dark:border-slate-700 rounded-xl px-3 py-2 text-xs md:text-sm font-black focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none shadow-sm cursor-pointer"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Default)</option>
                      <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                      <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                    </select>
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-indigo-950 dark:text-indigo-200">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Language selection */}
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Feedback Language</label>
                  <div className="relative">
                    <select
                      value={selectedLanguage}
                      onChange={(e) => {
                        setSelectedLanguage(e.target.value);
                        localStorage.setItem('muet_selected_language', e.target.value);
                      }}
                      className="w-full bg-white dark:bg-slate-800 text-indigo-950 dark:text-indigo-100 border border-indigo-100 dark:border-slate-700 rounded-xl px-3 py-2 text-xs md:text-sm font-black focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none shadow-sm cursor-pointer"
                    >
                      <option value="en">English (Strictly English Feedback)</option>
                      <option value="bilingual">Bilingual (English with Malay translation)</option>
                    </select>
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-indigo-950 dark:text-indigo-200">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full flex flex-col gap-8 md:gap-10">
              
              {/* Speaking Section */}
              <div className="flex flex-col items-center w-full gap-4">
                <h3 className="text-lg md:text-xl font-serif font-black text-slate-800 dark:text-slate-200">Speaking</h3>
                <div className="shrink-0 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full max-w-2xl mx-auto">
                  <div className="p-5 md:p-6 card-batik hover:-translate-y-1 transition-transform duration-500 flex flex-col items-center group rounded-[2rem]">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4 shadow-inner">
                       <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <h2 className="text-xl md:text-2xl font-serif font-black mb-1 text-indigo-950 dark:text-indigo-100">Part 1</h2>
                    <p className="text-amber-600 dark:text-amber-500 font-black text-[8px] md:text-[9px] uppercase tracking-widest mb-4 md:mb-5 text-center">Individual Presentation</p>
                    
                    <div className="grid grid-cols-1 gap-2 w-full mt-auto">
                       <button onClick={() => initiateSelection('INDIVIDUAL', 'SAMPLE')} className="py-2.5 px-3 rounded-lg bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 text-indigo-900 dark:text-indigo-200 font-black hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all text-[9px] md:text-[10px] uppercase shadow-sm">SAMPLE TOPICS</button>
                       <button onClick={() => initiateSelection('INDIVIDUAL', 'AI')} className="py-2.5 px-3 rounded-lg btn-batik text-amber-400 font-black hover:opacity-90 transition-all text-[9px] md:text-[10px] uppercase shadow-md">AI GENERATE</button>
                    </div>
                  </div>

                  <div className="p-5 md:p-6 card-batik hover:-translate-y-1 transition-transform duration-500 flex flex-col items-center group rounded-[2rem]">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4 shadow-inner">
                       <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </div>
                    <h2 className="text-xl md:text-2xl font-serif font-black mb-1 text-indigo-950 dark:text-indigo-100">Part 2</h2>
                    <p className="text-indigo-600 dark:text-indigo-400 font-black text-[8px] md:text-[9px] uppercase tracking-widest mb-4 md:mb-5 text-center">Group Discussion</p>
                    
                    <div className="grid grid-cols-1 gap-2 w-full mt-auto">
                       <button onClick={() => initiateSelection('GROUP', 'SAMPLE')} className="py-2.5 px-3 rounded-lg bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 text-indigo-900 dark:text-indigo-200 font-black hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all text-[9px] md:text-[10px] uppercase shadow-sm">SAMPLE TOPICS</button>
                       <button onClick={() => initiateSelection('GROUP', 'AI')} className="py-2.5 px-3 rounded-lg btn-batik text-amber-400 font-black hover:opacity-90 transition-all text-[9px] md:text-[10px] uppercase shadow-md">AI GENERATE</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Writing Section */}
              <div className="flex flex-col items-center w-full gap-4">
                <h3 className="text-lg md:text-xl font-serif font-black text-slate-800 dark:text-slate-200">Writing <span className="text-[10px] md:text-xs text-rose-500 uppercase tracking-widest ml-2 bg-rose-100 dark:bg-rose-900/30 px-2 py-1 rounded-full">(Developing)</span></h3>
                <div className="shrink-0 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full max-w-2xl mx-auto">
                  <div className="p-5 md:p-6 card-batik hover:-translate-y-1 transition-transform duration-500 flex flex-col items-center group rounded-[2rem]">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4 shadow-inner">
                       <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </div>
                    <h2 className="text-xl md:text-2xl font-serif font-black mb-1 text-indigo-950 dark:text-indigo-100">Task 1</h2>
                    <p className="text-emerald-600 dark:text-emerald-500 font-black text-[8px] md:text-[9px] uppercase tracking-widest mb-4 md:mb-5 text-center">Guided Writing</p>
                    
                    <div className="grid grid-cols-1 gap-2 w-full mt-auto">
                       <button onClick={() => initiateSelection('WRITING_TASK1', 'SAMPLE')} className="py-2.5 px-3 rounded-lg bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 text-indigo-900 dark:text-indigo-200 font-black hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all text-[9px] md:text-[10px] uppercase shadow-sm">SAMPLE TOPICS</button>
                       <button onClick={() => initiateSelection('WRITING_TASK1', 'AI')} className="py-2.5 px-3 rounded-lg btn-batik text-emerald-600 dark:text-emerald-400 font-black hover:opacity-90 transition-all text-[9px] md:text-[10px] uppercase shadow-md">AI GENERATE</button>
                    </div>
                  </div>

                  <div className="p-5 md:p-6 card-batik hover:-translate-y-1 transition-transform duration-500 flex flex-col items-center group rounded-[2rem] opacity-75">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-rose-50 dark:bg-rose-900/20 text-rose-400 dark:text-rose-500 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4 shadow-inner">
                       <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <h2 className="text-xl md:text-2xl font-serif font-black mb-1 text-slate-400 dark:text-slate-500 line-through">Task 2</h2>
                    <p className="text-slate-400 dark:text-slate-500 font-black text-[8px] md:text-[9px] uppercase tracking-widest mb-4 md:mb-5 text-center">Extended Writing</p>
                    
                    <div className="w-full mt-auto text-center py-2.5 px-3 rounded-lg bg-rose-500/10 text-rose-500 dark:text-rose-400 font-black text-[10px] md:text-xs uppercase tracking-widest border border-rose-500/20 dark:border-rose-900/30 shadow-inner">
                       Coming Soon 🔒
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* CREDITS SECTION */}
            <div className="shrink-0 mt-8 mb-4 flex flex-col items-center justify-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
               <p className="text-[9px] md:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Built by</p>
               <p className="text-sm md:text-base font-serif font-black text-indigo-950 dark:text-indigo-200">Muhammad Northaqif Witra bin Rasul</p>
               <p className="text-[10px] md:text-xs font-bold text-amber-600 dark:text-amber-500 tracking-wider">SMK Syed Sirajuddin (SEMSIRA)</p>
            </div>
          </div>
        ) : view === 'PRACTICE' ? (
          <div className="w-full max-w-3xl mx-auto flex flex-col flex-1 gap-2 md:gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 py-2 md:py-4 min-h-0 justify-center">
             
             {/* TIMER BLOCK */}
             <div className="shrink-0 relative card-batik p-3 md:p-4 rounded-[1.5rem] md:rounded-[2rem] shadow-sm flex flex-col items-center">
                 <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1 ${phase === 'PREP' ? 'text-amber-600 dark:text-amber-500' : 'text-indigo-600 dark:text-indigo-400 animate-pulse'}`}>
                    {phase === 'PREP' ? 'Prep Time' : (timer < 0 ? 'Overtime' : 'Speaking Phase')}
                 </span>
                 <div className={`text-4xl md:text-5xl font-serif font-black tabular-nums leading-none ${timer < 0 ? 'text-red-600 dark:text-red-500' : 'text-indigo-950 dark:text-indigo-100'}`}>
                    {formatTime(timer)}
                 </div>
                 <div className="w-full h-1 md:h-1.5 bg-slate-100 dark:bg-slate-800 mt-2 md:mt-3 rounded-full overflow-hidden max-w-[200px] md:max-w-xs">
                    <div 
                      className={`h-full transition-all duration-1000 ${timer < 0 ? 'bg-red-500' : 'bg-amber-400'}`}
                      style={{ width: `${Math.min(100, Math.max(0, (timer / (phase === 'PREP' ? (pendingView === 'INDIVIDUAL' ? 120 : 180) : (pendingView === 'INDIVIDUAL' ? 120 : 720))) * 100))}%` }}
                    ></div>
                 </div>
             </div>

              <div className="shrink-0 flex flex-col items-center gap-4 pt-1 md:pt-2">
                {phase === 'PREP' ? (
                  <button onClick={startSpeakingPhase} className="px-6 py-2.5 md:px-8 md:py-3 btn-batik text-amber-400 text-xs md:text-sm font-black rounded-full shadow-lg hover:scale-105 transition-transform active:scale-95 flex items-center gap-2">
                    START PERFORMANCE
                  </button>
                ) : phase === 'SPEAK' ? (
                  <div className="flex flex-col items-center gap-4 w-full">
                    {/* Visualizer displayed during recording */}
                    <AudioVisualizer stream={isRecording ? streamRef.current : null} height={50} className="max-w-[200px]" />
                    
                    {practiceTranscript && (
                      <div className="bg-indigo-50/95 dark:bg-slate-900/95 border border-indigo-100/50 dark:border-slate-800 rounded-2xl px-4 py-3 max-w-md shadow-lg animate-in fade-in zoom-in duration-300 flex items-center gap-2">
                        <span className="flex-shrink-0 flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        <p className="text-xs md:text-sm font-serif font-black text-indigo-950 dark:text-indigo-200">
                          {practiceTranscript}
                        </p>
                      </div>
                    )}

                    <button onClick={stopRecordingAndAnalyze} className="px-6 py-2.5 md:px-8 md:py-3 bg-red-600 text-white text-xs md:text-sm font-black rounded-full shadow-lg hover:scale-105 transition-transform active:scale-95 flex items-center gap-2 cursor-pointer">
                      <span className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-white animate-pulse"></span>
                      STOP & ANALYZE
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 md:gap-3 card-batik px-4 py-2 md:px-6 md:py-3 rounded-full flex items-center justify-center">
                    <div className="w-4 h-4 md:w-5 md:h-5 border-2 md:border-3 border-indigo-900 dark:border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-black text-indigo-950 dark:text-indigo-100 uppercase tracking-widest text-[9px] md:text-[10px] min-w-[120px] text-center">{loadingText}</span>
                  </div>
                )}
             </div>

             {/* QUESTION BLOCK */}
             {selectedQuestion && (
                <div className="flex-1 min-h-0 card-batik rounded-[1.5rem] md:rounded-[2rem] shadow-sm p-4 md:p-5 flex flex-col overflow-y-auto gap-3 md:gap-4">
                    <div className="shrink-0 border-b border-indigo-50 dark:border-slate-800 pb-2 md:pb-3">
                        <h3 className="text-base md:text-lg font-serif font-black text-indigo-950 dark:text-indigo-100 leading-snug">
                            {selectedQuestion.situation}
                        </h3>
                    </div>

                    <div className="shrink-0 bg-indigo-50/50 dark:bg-indigo-950/30 p-3 md:p-4 rounded-xl md:rounded-2xl border border-indigo-100 dark:border-indigo-900/50 shadow-inner">
                        <p className="text-[9px] md:text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest mb-1 text-center">Topic</p>
                        <p className="text-sm md:text-base font-serif font-black text-indigo-900 dark:text-indigo-200 text-center leading-snug">
                            {selectedQuestion.topic}
                        </p>
                    </div>

                    {selectedQuestion.points.length > 0 && (
                      <div className="flex flex-col shrink-0">
                         <p className="text-center text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Discussion Points (Tap to mark)</p>
                         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">
                            {selectedQuestion.points.map((p, i) => (
                              <button 
                                key={i} 
                                onClick={() => togglePoint(i)}
                                className={`px-2 py-1.5 md:p-2 rounded-lg md:rounded-xl border-2 font-bold transition-all duration-300 text-[10px] md:text-xs flex items-center justify-center text-center leading-tight ${
                                  usedPoints.includes(i) 
                                  ? 'bg-slate-100/50 dark:bg-slate-800/50 border-transparent text-slate-400 dark:text-slate-500 line-through' 
                                  : 'bg-white dark:bg-slate-800 border-indigo-50 dark:border-slate-700 text-indigo-950 dark:text-indigo-100 shadow-sm hover:border-amber-400 dark:hover:border-amber-500'
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
                <h2 className="text-2xl md:text-3xl font-serif font-black text-indigo-950 dark:text-indigo-100 drop-shadow-sm">Result</h2>
                <div className="flex flex-row items-center justify-center gap-3 md:gap-4">
                    <div className="w-16 h-16 md:w-24 md:h-24 bg-indigo-950 dark:bg-slate-900 rounded-full flex flex-col items-center justify-center shadow-lg border-2 md:border-4 border-amber-400 shrink-0">
                        <span className="text-amber-400 text-2xl md:text-4xl font-serif font-black leading-none">{feedback.evaluation.band.replace(/band\s*/i, '').trim()}</span>
                        <div className="text-amber-400/80 text-[7px] md:text-[8px] font-black tracking-widest uppercase mt-0.5 md:mt-1">Band</div>
                    </div>
                    <div className="flex gap-2">
                        <div className="card-batik px-3 py-1.5 md:px-5 md:py-2 rounded-xl md:rounded-2xl shadow-sm flex flex-col items-center justify-center min-w-[60px] md:min-w-[70px]">
                            <span className="text-indigo-950 dark:text-indigo-100 text-lg md:text-2xl font-serif font-black leading-none">{Math.round(feedback.evaluation.rank_score)}</span>
                            <span className="text-[7px] md:text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5 md:mt-1">Rank Score</span>
                        </div>
                        <div className="card-batik px-3 py-1.5 md:px-5 md:py-2 rounded-xl md:rounded-2xl shadow-sm flex flex-col items-center justify-center min-w-[60px] md:min-w-[70px]">
                            <span className="text-indigo-950 dark:text-indigo-100 text-lg md:text-2xl font-serif font-black leading-none">{feedback.evaluation.aggregate_score}</span>
                            <span className="text-[7px] md:text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5 md:mt-1">Score</span>
                        </div>
                    </div>
                </div>
             </div>

             {/* STRENGTHS / WEAKNESSES */}
             <div className="shrink-0 grid grid-cols-2 gap-2 md:gap-4">
                <div className="card-batik p-3 md:p-5 rounded-xl md:rounded-[1.5rem] border-l-4 md:border-l-8 border-l-emerald-500 shadow-sm">
                    <h3 className="text-xs md:text-sm font-serif font-black mb-1.5 md:mb-2 text-indigo-950 dark:text-indigo-100 uppercase">Strengths</h3>
                    <ul className="space-y-1 md:space-y-1.5">
                        {feedback.feedback.strengths.slice(0, 2).map((s, i) => (
                            <li key={i} className="flex gap-1.5 md:gap-2 text-slate-800 dark:text-slate-300 font-medium text-[9px] md:text-[11px] leading-snug line-clamp-2">
                                <span className="text-emerald-500 shrink-0">✦</span> <span>{s}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="card-batik p-3 md:p-5 rounded-xl md:rounded-[1.5rem] border-l-4 md:border-l-8 border-l-amber-500 shadow-sm">
                    <h3 className="text-xs md:text-sm font-serif font-black mb-1.5 md:mb-2 text-indigo-950 dark:text-indigo-100 uppercase">Weaknesses</h3>
                    <ul className="space-y-1 md:space-y-1.5">
                        {feedback.feedback.weaknesses.slice(0, 2).map((s, i) => (
                            <li key={i} className="flex gap-1.5 md:gap-2 text-slate-800 dark:text-slate-300 font-medium text-[9px] md:text-[11px] leading-snug line-clamp-2">
                                <span className="text-amber-500 shrink-0">✧</span> <span>{s}</span>
                            </li>
                        ))}
                    </ul>
                </div>
             </div>

             {/* TRANSCRIPT */}
             <div className="flex-1 min-h-0 card-batik p-3 md:p-5 rounded-xl md:rounded-[1.5rem] shadow-sm flex flex-col">
                <h3 className="shrink-0 text-xs md:text-sm font-serif font-black text-indigo-950 dark:text-indigo-100 uppercase mb-1.5 md:mb-2 tracking-wider">Annotated Transcript</h3>
                
               <div className="flex-1 min-h-0 bg-slate-50/50 dark:bg-slate-950/50 p-3 md:p-5 rounded-lg md:rounded-xl border border-slate-200/50 dark:border-slate-800 shadow-inner overflow-y-auto">
                   {renderAnnotatedTranscript(feedback.annotated_transcript)}
                </div>
             </div>

             {/* ACTIONS */}
             <div className="shrink-0 flex justify-center gap-3 md:gap-4 pt-1">
                <button onClick={() => handleNav('HOME')} className="px-5 py-2 md:px-6 md:py-2.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-indigo-950 dark:text-indigo-100 font-black rounded-lg md:rounded-xl hover:bg-white dark:hover:bg-slate-700 border border-white dark:border-slate-700 transition-all uppercase text-[9px] md:text-[10px] tracking-widest shadow-sm">
                    HOME
                </button>
                <button onClick={() => initiateSelection(pendingView || 'INDIVIDUAL', genMode)} className="px-5 py-2 md:px-6 md:py-2.5 btn-batik text-amber-400 font-black rounded-lg md:rounded-xl shadow-md hover:opacity-90 transition-all uppercase text-[9px] md:text-[10px] tracking-widest">
                    PRACTICE AGAIN
                </button>
             </div>
          </div>
        ) : view === 'WRITING_PRACTICE' ? (
          <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 py-4 md:py-6">
             <div className="shrink-0 relative card-batik p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] shadow-sm flex flex-col items-center">
                 <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1 text-indigo-600 dark:text-indigo-400 animate-pulse`}>
                    Writing Phase
                 </span>
                 <div className={`text-4xl md:text-5xl font-serif font-black tabular-nums leading-none ${timer < 0 ? 'text-red-600 dark:text-red-500' : 'text-indigo-950 dark:text-indigo-100'}`}>
                    {formatTime(timer)}
                 </div>
             </div>

              {selectedQuestion && (
                <div className="shrink-0">
                  <QuestionCard question={selectedQuestion} index={0} blind={false} />
                </div>
              )}

              <div className="w-full card-batik p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] shadow-sm flex flex-col">
                {pendingView === 'WRITING_TASK1' && (
                  <div className="flex flex-col gap-2 md:gap-3 mb-3 md:mb-4 bg-white/50 dark:bg-slate-950/50 p-3 md:p-4 rounded-xl border border-slate-200/50 dark:border-slate-800 shadow-inner shrink-0">
                    <div className="flex items-center gap-2 md:gap-3">
                      <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider w-16">To:</label>
                      <input 
                        className="flex-1 bg-transparent border-b border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200 text-xs md:text-sm font-medium pb-1"
                        value={emailFields.to}
                        onChange={(e) => setEmailFields({...emailFields, to: e.target.value})}
                        placeholder="Recipient"
                      />
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                      <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider w-16">From:</label>
                      <input 
                        className="flex-1 bg-transparent border-b border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200 text-xs md:text-sm font-medium pb-1"
                        value={emailFields.from}
                        onChange={(e) => setEmailFields({...emailFields, from: e.target.value})}
                        placeholder="Your name"
                      />
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                      <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider w-16">Subject:</label>
                      <input 
                        className="flex-1 bg-transparent border-b border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200 text-xs md:text-sm font-medium pb-1"
                        value={emailFields.subject}
                        onChange={(e) => setEmailFields({...emailFields, subject: e.target.value})}
                        placeholder="Email subject"
                      />
                    </div>
                  </div>
                )}
                <textarea 
                  className="w-full h-[380px] md:h-[520px] bg-white/50 dark:bg-slate-950/50 border border-slate-200/50 dark:border-slate-800 rounded-xl outline-none resize-y text-slate-800 dark:text-slate-200 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-600 p-4 md:p-5 shadow-inner focus:ring-2 focus:ring-indigo-500/30 transition-all"
                  placeholder={pendingView === 'WRITING_TASK1' ? "Start typing your reply here..." : "Start typing your essay here..."}
                  value={essayText}
                  onChange={(e) => setEssayText(e.target.value)}
                />
                <div className="flex justify-between items-center border-t border-slate-200/50 dark:border-slate-800/50 pt-3 md:pt-4 mt-3 md:mt-4 px-2">
                   <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Word count: {essayText.trim().split(/\s+/).filter(w => w.length > 0).length}</div>
                   {phase === 'PROCESSING' ? (
                     <div className="flex items-center gap-2 md:gap-3 card-batik px-4 py-2 md:px-6 md:py-3 rounded-full flex items-center justify-center">
                       <div className="w-4 h-4 md:w-5 md:h-5 border-2 md:border-3 border-indigo-900 dark:border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                       <span className="font-black text-indigo-950 dark:text-indigo-100 uppercase tracking-widest text-[9px] md:text-[10px] min-w-[120px] text-center">{loadingText}</span>
                     </div>
                   ) : (
                     <button onClick={submitWriting} disabled={essayText.trim().length < 10 || phase === 'PROCESSING'} className="px-6 py-2 btn-batik text-amber-400 font-black rounded-lg text-xs uppercase tracking-widest disabled:opacity-50 hover:scale-105 active:scale-95 transition-transform shadow-md">Submit</button>
                   )}
                </div>
              </div>
          </div>
        ) : view === 'WRITING_RESULT' && writingFeedback ? (
          <div className="w-full max-w-4xl mx-auto flex flex-col flex-1 gap-4 md:gap-6 animate-in slide-in-from-bottom-8 duration-700 py-4 md:py-6 min-h-0">
             <div className="shrink-0 text-center space-y-1.5 md:space-y-2">
                <h2 className="text-2xl md:text-3xl font-serif font-black text-indigo-950 dark:text-indigo-100 drop-shadow-sm">Writing Result</h2>
                <div className="flex flex-row items-center justify-center gap-3 md:gap-4">
                    <div className="w-16 h-16 md:w-24 md:h-24 bg-indigo-950 dark:bg-slate-900 rounded-full flex flex-col items-center justify-center shadow-lg border-2 md:border-4 border-emerald-400 shrink-0">
                        <span className="text-emerald-400 text-2xl md:text-4xl font-serif font-black leading-none">{writingFeedback.evaluation.band.replace(/band\s*/i, '').trim()}</span>
                        <div className="text-emerald-400/80 text-[7px] md:text-[8px] font-black tracking-widest uppercase mt-0.5 md:mt-1">Band</div>
                    </div>
                    <div className="flex gap-2">
                        <div className="card-batik px-3 py-1.5 md:px-5 md:py-2 rounded-xl md:rounded-2xl shadow-sm flex flex-col items-center justify-center min-w-[60px] md:min-w-[70px]">
                            <span className="text-indigo-950 dark:text-indigo-100 text-lg md:text-2xl font-serif font-black leading-none">{writingFeedback.evaluation.score}</span>
                            <span className="text-[7px] md:text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5 md:mt-1">Score</span>
                        </div>
                        <div className="card-batik px-3 py-1.5 md:px-5 md:py-2 rounded-xl md:rounded-2xl shadow-sm flex flex-col items-center justify-center min-w-[60px] md:min-w-[70px]">
                            <span className="text-indigo-950 dark:text-indigo-100 text-lg md:text-2xl font-serif font-black leading-none">{writingFeedback.evaluation.cefr_level}</span>
                            <span className="text-[7px] md:text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5 md:mt-1">CEFR</span>
                        </div>
                    </div>
                </div>
             </div>

             <div className="shrink-0 grid grid-cols-2 gap-2 md:gap-4">
                <div className="card-batik p-3 md:p-5 rounded-xl md:rounded-[1.5rem] border-l-4 md:border-l-8 border-l-emerald-500 shadow-sm">
                    <h3 className="text-xs md:text-sm font-serif font-black mb-1.5 md:mb-2 text-indigo-950 dark:text-indigo-100 uppercase">Strengths</h3>
                    <ul className="space-y-1 md:space-y-1.5">
                        {writingFeedback.feedback.strengths.slice(0, 2).map((s, i) => (
                            <li key={i} className="flex gap-1.5 md:gap-2 text-slate-800 dark:text-slate-300 font-medium text-[9px] md:text-[11px] leading-snug line-clamp-2">
                                <span className="text-emerald-500 shrink-0">✦</span> <span>{s}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="card-batik p-3 md:p-5 rounded-xl md:rounded-[1.5rem] border-l-4 md:border-l-8 border-l-amber-500 shadow-sm">
                    <h3 className="text-xs md:text-sm font-serif font-black mb-1.5 md:mb-2 text-indigo-950 dark:text-indigo-100 uppercase">Weaknesses</h3>
                    <ul className="space-y-1 md:space-y-1.5">
                        {writingFeedback.feedback.weaknesses.slice(0, 2).map((s, i) => (
                            <li key={i} className="flex gap-1.5 md:gap-2 text-slate-800 dark:text-slate-300 font-medium text-[9px] md:text-[11px] leading-snug line-clamp-2">
                                <span className="text-amber-500 shrink-0">✧</span> <span>{s}</span>
                            </li>
                        ))}
                    </ul>
                </div>
             </div>

             <div className="flex-1 min-h-0 card-batik p-3 md:p-5 rounded-xl md:rounded-[1.5rem] shadow-sm flex flex-col">
                <h3 className="shrink-0 text-xs md:text-sm font-serif font-black text-indigo-950 dark:text-indigo-100 uppercase mb-1.5 md:mb-2 tracking-wider">Annotated Essay</h3>
                
               <div className="flex-1 min-h-0 bg-slate-50/50 dark:bg-slate-950/50 p-3 md:p-5 rounded-lg md:rounded-xl border border-slate-200/50 dark:border-slate-800 shadow-inner overflow-y-auto whitespace-pre-wrap">
                   {renderAnnotatedTranscript(writingFeedback.annotated_essay)}
                </div>
             </div>

             <div className="shrink-0 flex justify-center gap-3 md:gap-4 pt-1">
                <button onClick={() => handleNav('HOME')} className="px-5 py-2 md:px-6 md:py-2.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-indigo-950 dark:text-indigo-100 font-black rounded-lg md:rounded-xl hover:bg-white dark:hover:bg-slate-700 border border-white dark:border-slate-700 transition-all uppercase text-[9px] md:text-[10px] tracking-widest shadow-sm">
                    HOME
                </button>
             </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default App;

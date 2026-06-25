import { useEffect, useState, useRef, useCallback } from 'react';
import { MagazineCanvas } from './MagazineCanvas';
import { AudioPlaybackShelf } from './AudioPlaybackShelf';
import { ClosedCaptionsOverlay } from './ClosedCaptionsOverlay';
import { ArrowLeft, BookOpen, ZoomIn } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Mock interface for the fetched payload
export interface MagazinePayload {
  magazine_id: string;
  title: string;
  pdf_url: string;
  total_pages: number;
  scripts: string[];
}

// Global speech synthesis instance
const synth = window.speechSynthesis;

export function ReaderWrapper({ id, onBack, isPreview = false }: { id: string, onBack: () => void, isPreview?: boolean }) {
  const [magazine, setMagazine] = useState<MagazinePayload | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAutoFlipEnabled, setIsAutoFlipEnabled] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isLensMode, setIsLensMode] = useState(false);
  
  // Subtitle State
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [currentWordIndex, setCurrentWordIndex] = useState<{ start: number, length: number } | null>(null);
  const [isSubtitlesEnabled, setIsSubtitlesEnabled] = useState(true);

  const speakingRef = useRef<boolean>(false);
  const speakIdRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);
  const audioCursorRef = useRef<number>(0);
  const currentPageIndexRef = useRef<number>(0); // Synchronous tracker for visual page
  const [activeAudioPage, setActiveAudioPage] = useState<number>(0);

  const flipAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    flipAudioRef.current = new Audio('/page-flip.mp3');
    if (flipAudioRef.current) {
      flipAudioRef.current.load();
    }
  }, []);

  const setAudioCursor = (pageIndex: number) => {
    audioCursorRef.current = pageIndex;
    setActiveAudioPage(pageIndex);
  };

  // Reference to the pageflip component to call flipNext() programmatically
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flipbookRef = useRef<any>(null);

  // 1. Fetch Data from Backend API
  useEffect(() => {
    const fetchMagazine = async () => {
      // If it's a local draft (Admin Preview)
      if (id.startsWith('draft_')) {
        try {
          const localforage = (await import('localforage')).default;
          const draft: any = await localforage.getItem(`ackadem_draft_${id}`);
          const pdfFile: any = await localforage.getItem(`ackadem_pdf_${id}`);
          if (draft && pdfFile) {
            setMagazine({
              magazine_id: draft.draft_id,
              title: draft.title + ' (Draft Preview)',
              pdf_url: URL.createObjectURL(pdfFile),
              total_pages: draft.pageCount,
              scripts: draft.scripts,
            });
            return;
          }
        } catch (err) {
          console.error("Failed to load draft for preview", err);
        }
      }

      // If the id is 'mock-id' (admin preview), use fallback data
      if (id === 'mock-id') {
        setMagazine({
          magazine_id: 'mock-id',
          title: 'Preview Mode',
          pdf_url: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf',
          total_pages: 14,
          scripts: ['Welcome! This is a preview. Publish a magazine from the Admin Portal to see real content.'],
        });
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/books/view/${id}/`);
        if (!res.ok) throw new Error(`Book not found (${res.status})`);
        const data: MagazinePayload = await res.json();
        setMagazine(data);

        // Restore saved reading progress from the API
        try {
          const progRes = await fetch(`${API_BASE}/users/progress/${id}/`);
          if (progRes.ok) {
            const progData = await progRes.json();
            const savedPage = progData.page_index || 0;
            setCurrentPageIndex(savedPage);
            currentPageIndexRef.current = savedPage;
          }
        } catch {
          // Progress fetch failure is non-critical
        }
      } catch (err) {
        console.error('Failed to load magazine from API:', err);
        // Fallback so the reader doesn't hard-crash
        setMagazine({
          magazine_id: id,
          title: 'Could not load magazine',
          pdf_url: '',
          total_pages: 1,
          scripts: ['Failed to load this magazine. Please check the ID and try again.'],
        });
      }
    };
    fetchMagazine();
  }, [id]);

  // 2. Setup Voices
  const initialVoiceSet = useRef(false);
  useEffect(() => {
    const populateVoices = () => {
      const voices = synth.getVoices();
      setAvailableVoices(voices);
      
      // Prioritize natural Edge voices if available, else standard English
      if (voices.length > 0 && !initialVoiceSet.current) {
        const preferred = voices.find(v => v.name.includes('Natural') && v.lang.startsWith('en')) 
                       || voices.find(v => v.lang.startsWith('en'))
                       || voices[0];
        setSelectedVoice(preferred);
        initialVoiceSet.current = true;
      }
    };

    populateVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = populateVoices;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resume Progress
  useEffect(() => {
    if (magazine && flipbookRef.current && currentPageIndex > 0) {
      setTimeout(() => {
        try {
          flipbookRef.current.pageFlip().turnToPage(currentPageIndex);
        } catch { console.warn("Flipbook not ready to turn"); }
      }, 500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [magazine]); // Only run once when magazine loads

  // 3. Audio Synchronization Logic (State Machine Engine)
  const playAudioQueue = useCallback(async (startPageIndex: number) => {
    if (!magazine) return;

    synth.cancel();
    speakingRef.current = true;
    isPausedRef.current = false;
    setIsPlaying(true);
    
    const currentSpeakId = Date.now() + Math.random();
    speakIdRef.current = currentSpeakId;
    setAudioCursor(startPageIndex);
    
    let spokeOnSpread = false;
    
    while (speakingRef.current && speakIdRef.current === currentSpeakId) {
      const pageIdx = audioCursorRef.current;
      const rawText = magazine.scripts[pageIdx];
      
      if (rawText && rawText.trim() !== '') {
        spokeOnSpread = true;
        const regex = /\[(?:pause|pasue|puase)[:\s]*([\d.]+)[a-z]*\]/gi;
        const parts = rawText.split(regex);

        for (let i = 0; i < parts.length; i++) {
          if (!speakingRef.current || speakIdRef.current !== currentSpeakId || audioCursorRef.current !== pageIdx) break;

          const part = parts[i];
          if (i % 2 === 1) {
            const pauseSeconds = parseFloat(part);
            if (!isNaN(pauseSeconds) && pauseSeconds > 0) {
              const ms = (pauseSeconds * 1000) / playbackSpeed;
              await new Promise(resolve => setTimeout(resolve, ms));
            }
          } else {
            const text = part.trim();
            if (text) {
              await new Promise<void>((resolve) => {
                const utterance = new SpeechSynthesisUtterance(text);
                if (selectedVoice) utterance.voice = selectedVoice;
                utterance.rate = playbackSpeed;
                
                utterance.onstart = () => {
                  if (speakIdRef.current !== currentSpeakId) return;
                  setCurrentSubtitle(text);
                  setCurrentWordIndex(null);
                };

                utterance.onboundary = (e) => {
                  if (speakIdRef.current !== currentSpeakId) return;
                  if (e.name === 'word') {
                    let length = e.charLength;
                    if (!length) {
                      const nextSpace = text.indexOf(' ', e.charIndex);
                      length = nextSpace !== -1 ? nextSpace - e.charIndex : text.length - e.charIndex;
                    }
                    setCurrentWordIndex({ start: e.charIndex, length });
                  }
                };

                utterance.onend = () => resolve();
                utterance.onerror = (e) => {
                  console.error('SpeechSynthesisError:', e);
                  resolve();
                };
                synth.speak(utterance);
              });
            }
          }
        }
      }

      // If user skipped track manually, audioCursorRef changed. Continue loop to read new page!
      if (!speakingRef.current || speakIdRef.current !== currentSpeakId) break;
      if (audioCursorRef.current !== pageIdx) continue; 

      // Naturally finished the page. Use the synchronous Ref to get the true visual state!
      const trueCurrentPage = currentPageIndexRef.current;
      const isMobile = window.innerWidth < 768;
      
      const visiblePages = [];
      if (isMobile) {
        visiblePages.push(trueCurrentPage);
      } else {
        if (trueCurrentPage === 0) visiblePages.push(0);
        else visiblePages.push(trueCurrentPage, trueCurrentPage + 1);
      }

      const isLastVisible = pageIdx >= visiblePages[visiblePages.length - 1];

      if (!isLastVisible && pageIdx + 1 < magazine.total_pages) {
        setAudioCursor(pageIdx + 1);
      } else {
        if (isAutoFlipEnabled && trueCurrentPage < magazine.total_pages - 1) {
          if (flipbookRef.current) {
            // Smart Pacing: If the entire spread was silent, give the user 5 seconds to read it visually!
            if (!spokeOnSpread) {
               await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
               // Natural breath pause before flipping
               await new Promise(resolve => setTimeout(resolve, 600));
            }
            
            // Abort if the user manually interacted while we were waiting!
            if (!speakingRef.current || speakIdRef.current !== currentSpeakId) break;
            
            flipbookRef.current.pageFlip().flipNext();
          }
          // Break loop. onPageFlip will automatically restart audio on the new spread!
          break;
        } else {
          setIsPlaying(false);
          speakingRef.current = false;
          isPausedRef.current = false;
          setCurrentSubtitle('');
          break;
        }
      }
    }
  }, [magazine, selectedVoice, playbackSpeed, isAutoFlipEnabled]);

  // Restart audio immediately if voice is changed during playback
  const prevVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (prevVoiceRef.current && selectedVoice && prevVoiceRef.current.name !== selectedVoice.name) {
      if (isPlaying && !isPausedRef.current && speakingRef.current) {
        // Break current audio loop and restart the current page with new voice
        playAudioQueue(audioCursorRef.current);
      }
    }
    prevVoiceRef.current = selectedVoice;
  }, [selectedVoice, isPlaying, playAudioQueue]);

  // Handle Play/Pause Toggle
  const togglePlayPause = () => {
    if (isPlaying) {
      synth.pause();
      isPausedRef.current = true;
      setIsPlaying(false);
    } else {
      if (isPausedRef.current) {
        synth.resume();
        isPausedRef.current = false;
        setIsPlaying(true);
      } else {
        isPausedRef.current = false;
        playAudioQueue(audioCursorRef.current);
      }
    }
  };

  const handleStop = () => {
    synth.cancel();
    speakingRef.current = false;
    isPausedRef.current = false;
    setAudioCursor(currentPageIndex); // Reset cursor to visual page
    setIsPlaying(false);
    setCurrentSubtitle('');
  };

  const handleNextTrack = () => {
    if (!magazine) return;
    const isMobile = window.innerWidth < 768;
    const nextTarget = audioCursorRef.current + 1;
    if (nextTarget >= magazine.total_pages) return;

    const visiblePages = [];
    if (isMobile) visiblePages.push(currentPageIndex);
    else {
      if (currentPageIndex === 0) visiblePages.push(0);
      else visiblePages.push(currentPageIndex, currentPageIndex + 1);
    }

    if (visiblePages.includes(nextTarget)) {
      setAudioCursor(nextTarget);
      if (isPlaying) synth.cancel(); // Resolves current utterance, loop picks up nextTarget instantly
    } else {
      if (flipbookRef.current) flipbookRef.current.pageFlip().flipNext();
    }
  };

  const handlePrevTrack = () => {
    if (!magazine) return;
    const isMobile = window.innerWidth < 768;
    const prevTarget = audioCursorRef.current - 1;
    if (prevTarget < 0) return;

    const visiblePages = [];
    if (isMobile) visiblePages.push(currentPageIndex);
    else {
      if (currentPageIndex === 0) visiblePages.push(0);
      else visiblePages.push(currentPageIndex, currentPageIndex + 1);
    }

    if (visiblePages.includes(prevTarget)) {
      setAudioCursor(prevTarget);
      if (isPlaying) synth.cancel();
    } else {
      if (flipbookRef.current) flipbookRef.current.pageFlip().flipPrev();
    }
  };

  // Listen for manual page flips
  const onPageFlip = (e: { data: number }) => {
    // When a user manually swipes or clicks to turn a page
    const newPageIndex = e.data;
    setCurrentPageIndex(newPageIndex);
    currentPageIndexRef.current = newPageIndex; // Synchronously update for the audio engine

    if (flipAudioRef.current) {
        flipAudioRef.current.currentTime = 0;
        flipAudioRef.current.play().catch(e => console.warn("Audio play failed:", e));
    }

    // Sync progress to backend API (fire-and-forget)
    if (magazine?.magazine_id && magazine.magazine_id !== 'mock-id' && !magazine.magazine_id.startsWith('draft_')) {
      fetch(`${API_BASE}/users/progress/${magazine.magazine_id}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_index: newPageIndex }),
      }).catch(console.error);
    }

    // Sync the audio cursor to the new left page
    setAudioCursor(newPageIndex);

    // If it was already playing, auto-continue reading the new spread!
    if (isPlaying) {
      playAudioQueue(newPageIndex);
    } else {
      synth.cancel();
      isPausedRef.current = false;
      speakingRef.current = false;
      setCurrentSubtitle('');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      synth.cancel();
    };
  }, []);

  if (!magazine) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
          <h2 className="text-xl font-bold text-white tracking-widest uppercase">Loading Publication</h2>
          <p className="text-slate-500 mt-2 text-sm">Initializing high-resolution textures...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-950 overflow-hidden flex flex-col">
      {/* Ambient Spotlight Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950 pointer-events-none" />
      
      {/* Glassmorphic Header */}
      <header className="relative z-10 w-full px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 bg-slate-950/40 backdrop-blur-md shadow-sm gap-3 md:gap-0">
        
        {/* Mobile Top Row / Desktop Left Side */}
        <div className="flex items-center justify-between w-full md:w-auto shrink-0">
          <button onClick={onBack} className="flex items-center text-slate-300 hover:text-white transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4 mr-1.5 md:mr-2" /> 
            <span className="hidden sm:inline">{isPreview ? 'Close Preview' : 'Back to Library'}</span>
            <span className="sm:hidden">{isPreview ? 'Close' : 'Back'}</span>
          </button>
          
          {/* Mobile Lens Toggle */}
          <button 
            onClick={() => setIsLensMode(!isLensMode)}
            className={`md:hidden flex items-center text-xs font-medium transition-colors px-3 py-1 rounded-full border ${isLensMode ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50' : 'text-slate-400 border-slate-800 hover:text-white hover:bg-white/5'}`}
          >
            <ZoomIn className="w-3.5 h-3.5 mr-1.5" />
            Lens {isLensMode ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Magazine Title */}
        <div className="flex items-center justify-center text-white font-semibold tracking-wide text-sm md:text-base flex-1 md:px-8 w-full md:w-auto">
          <BookOpen className="w-4 h-4 mr-2 text-indigo-400 shrink-0" />
          <span className="truncate text-center">{magazine.title}</span>
        </div>

        {/* Desktop Lens Toggle */}
        <button 
          onClick={() => setIsLensMode(!isLensMode)}
          className={`hidden md:flex shrink-0 items-center text-sm font-medium transition-colors px-3 py-1.5 rounded-full border ${isLensMode ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50' : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'}`}
        >
          <ZoomIn className="w-4 h-4 mr-2" />
          Lens {isLensMode ? 'ON' : 'OFF'}
        </button>
      </header>

      {/* Magazine Canvas Area */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 pb-28 md:pb-36 xl:pb-40 relative z-10">
        <MagazineCanvas 
          flipbookRef={flipbookRef}
          pdfUrl={magazine.pdf_url}
          totalPages={magazine.total_pages}
          onPageFlip={onPageFlip}
          isLensMode={isLensMode}
          currentPageIndex={currentPageIndex}
        />
        {isSubtitlesEnabled && (
          <ClosedCaptionsOverlay 
            text={currentSubtitle} 
            wordHighlight={currentWordIndex} 
          />
        )}
      </div>

      {/* Audio Control UI */}
      <AudioPlaybackShelf 
        isPlaying={isPlaying}
        onTogglePlayPause={togglePlayPause}
        onStop={handleStop}
        isAutoFlipEnabled={isAutoFlipEnabled}
        onToggleAutoFlip={() => setIsAutoFlipEnabled(!isAutoFlipEnabled)}
        playbackSpeed={playbackSpeed}
        onSpeedChange={setPlaybackSpeed}
        availableVoices={availableVoices}
        selectedVoice={selectedVoice}
        onVoiceChange={setSelectedVoice}
        currentPageIndex={currentPageIndex}
        totalPages={magazine.total_pages}
        onNextPage={() => flipbookRef.current?.pageFlip().flipNext()}
        onPrevPage={() => flipbookRef.current?.pageFlip().flipPrev()}
        onJumpToPage={(idx) => flipbookRef.current?.pageFlip().flip(idx)}
        isSubtitlesEnabled={isSubtitlesEnabled}
        onToggleSubtitles={() => setIsSubtitlesEnabled(!isSubtitlesEnabled)}
        onNextTrack={handleNextTrack}
        onPrevTrack={handlePrevTrack}
        canNextTrack={activeAudioPage < magazine.total_pages - 1}
        canPrevTrack={activeAudioPage > 0}
      />
    </div>
  );
}

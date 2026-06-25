import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CheckCircle2, Circle, Play, Square, FileText, Mic, Loader2, Undo2, Redo2, Trash, ZoomIn } from 'lucide-react';
import { Button } from '../shared/Elements';

interface ScriptFieldGridProps {
  pageCount: number;
  scripts: string[];
  onChange: (index: number, value: string) => void;
  onClearAll?: () => void;
  onUpdateAll?: (newScripts: string[]) => void;
  file: File | null;
}

export function ScriptFieldGrid({ pageCount, scripts, onChange, onClearAll, onUpdateAll, file }: ScriptFieldGridProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // OCR State
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExtractingAll, setIsExtractingAll] = useState(false);

  // Audio State
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(() => {
    return localStorage.getItem('ackadem_admin_voice_uri') || '';
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(() => {
    const saved = localStorage.getItem('ackadem_admin_playback_rate');
    return saved ? parseFloat(saved) : 1;
  });
  const [customPause, setCustomPause] = useState<string>('1.5');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const playStateRef = useRef({ shouldCancel: false });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // History State (Max 20 states)
  const [history, setHistory] = useState<{ past: string[], future: string[] }>({ past: [], future: [] });
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Magnifier State
  const [isMagnifierEnabled, setIsMagnifierEnabled] = useState(() => {
    return localStorage.getItem('ackadem_admin_magnifier') === 'true';
  });
  const [lensPos, setLensPos] = useState<{ x: number, y: number } | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // Mobile Tab State
  const [activeTab, setActiveTab] = useState<'preview' | 'script'>('script');

  useEffect(() => {
    localStorage.setItem('ackadem_admin_magnifier', isMagnifierEnabled.toString());
  }, [isMagnifierEnabled]);

  useEffect(() => {
    setHistory({ past: [], future: [] });
  }, [currentPageIndex]);

  const pushHistory = (specificValue?: string) => {
    setHistory(prev => {
      const valToSave = specificValue !== undefined ? specificValue : (scripts[currentPageIndex] || '');
      const newPast = [...prev.past, valToSave];
      if (newPast.length > 20) newPast.shift(); // Cap at 20
      return { past: newPast, future: [] };
    });
  };

  const handleUndo = () => {
    if (history.past.length === 0) return;
    const newPast = [...history.past];
    const previousState = newPast.pop()!;
    setHistory(prev => ({ past: newPast, future: [scripts[currentPageIndex] || '', ...prev.future] }));
    onChange(currentPageIndex, previousState);
  };

  const handleRedo = () => {
    if (history.future.length === 0) return;
    const newFuture = [...history.future];
    const nextState = newFuture.shift()!;
    setHistory(prev => ({ past: [...prev.past, scripts[currentPageIndex] || ''], future: newFuture }));
    onChange(currentPageIndex, nextState);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    
    // Group rapid typing into a single history state using a 1-second debounce
    if (!typingTimeoutRef.current) {
      pushHistory();
    }
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 1000);
    
    onChange(currentPageIndex, val);
  };

  const handleClearPage = () => {
    pushHistory();
    onChange(currentPageIndex, '');
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear the narration scripts for ALL pages? This cannot be undone.")) {
      if (onClearAll) {
        onClearAll();
      } else {
        // Fallback for isolated component testing
        for (let i = 0; i < pageCount; i++) {
          setTimeout(() => onChange(i, ''), i * 10);
        }
      }
    }
  };

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem('ackadem_admin_playback_rate', playbackRate.toString());
  }, [playbackRate]);

  useEffect(() => {
    if (selectedVoiceURI) {
      localStorage.setItem('ackadem_admin_voice_uri', selectedVoiceURI);
    }
  }, [selectedVoiceURI]);

  const handleScrollPagination = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -200 : 200,
        behavior: 'smooth'
      });
    }
  };

  // Auto-scroll the pagination bar when the currentPageIndex changes (e.g. from jump or next/prev)
  useEffect(() => {
    const container = scrollContainerRef.current;
    const btn = document.getElementById(`page-btn-${currentPageIndex}`);
    if (container && btn) {
      const scrollLeft = btn.offsetLeft - container.clientWidth / 2 + btn.clientWidth / 2 - container.offsetLeft;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [currentPageIndex]);

  // Convert File object to a local blob URL for react-pdf to render safely
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  // Load Voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Guarantee that the selected voice exists. If a headset is unplugged or a saved voice is missing, fallback instantly.
  const safeVoiceURI = voices.some(v => v.voiceURI === selectedVoiceURI)
    ? selectedVoiceURI
    : voices.find(v => v.lang.startsWith('en'))?.voiceURI || voices[0]?.voiceURI || '';

  // Stop audio if page changes
  useEffect(() => {
    playStateRef.current.shouldCancel = true;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    utteranceRef.current = null;
  }, [currentPageIndex]);

  const handleExtractText = async () => {
    if (!fileUrl) return;
    
    if (scripts[currentPageIndex]?.trim()) {
      if (!window.confirm("This page already has a script. Are you sure you want to extract text and overwrite it?")) {
        return;
      }
    }

    setIsExtracting(true);
    try {
      const loadingTask = pdfjs.getDocument(fileUrl);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(currentPageIndex + 1);
      const textContent = await page.getTextContent();
      const textStrings = textContent.items.map((item: any) => item.str);
      const fullText = textStrings.join(' ');
      
      if (fullText.trim()) {
        pushHistory();
        onChange(currentPageIndex, fullText);
      }
    } catch (error) {
      console.error("Failed to extract text", error);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleExtractAllText = async () => {
    if (!file || !onUpdateAll) return;
    
    const hasAnyText = scripts.some(script => script?.trim());
    if (hasAnyText) {
      if (!window.confirm("Some pages already have scripts. We will only extract text for empty pages. Proceed?")) {
        return;
      }
    }

    setIsExtractingAll(true);
    const fileUrl = URL.createObjectURL(file);
    try {
      const loadingTask = pdfjs.getDocument(fileUrl);
      const pdf = await loadingTask.promise;
      const newScripts = [...scripts];

      for (let i = 0; i < pageCount; i++) {
        if (scripts[i]?.trim()) continue; // Skip if already has text
        try {
          const page = await pdf.getPage(i + 1);
          const textContent = await page.getTextContent();
          const textStrings = textContent.items.map((item: any) => item.str);
          const fullText = textStrings.join(' ');
          
          if (fullText.trim()) {
            newScripts[i] = fullText;
          } else {
            newScripts[i] = '';
          }
        } catch (err) {
          console.error(`Failed to extract text for page ${i + 1}`, err);
        }
      }
      
      onUpdateAll(newScripts);
    } catch (error) {
      console.error("Failed to batch extract text", error);
    } finally {
      URL.revokeObjectURL(fileUrl);
      setIsExtractingAll(false);
    }
  };

  const playSequence = async () => {
    playStateRef.current.shouldCancel = false;
    setIsPlaying(true);
    
    const text = scripts[currentPageIndex];
    if (!text || !text.trim()) {
      setIsPlaying(false);
      return;
    }

    // Parse out [pause: X] tags
    const regex = /\[pause:\s*(\d+(?:\.\d+)?)\s*\]/gi;
    const parts = text.split(regex);
    
    for (let i = 0; i < parts.length; i++) {
      if (playStateRef.current.shouldCancel) break;
      
      if (i % 2 === 0) {
        // Text chunk
        const chunk = parts[i].trim();
        if (chunk) {
          await new Promise<void>((resolve) => {
            const utterance = new SpeechSynthesisUtterance(chunk);
            utteranceRef.current = utterance;
            utterance.rate = playbackRate;
            const selectedVoice = voices.find(v => v.voiceURI === safeVoiceURI);
            if (selectedVoice) utterance.voice = selectedVoice;

            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            window.speechSynthesis.speak(utterance);
          });
        }
      } else {
        // Pause duration
        const seconds = parseFloat(parts[i]);
        if (!isNaN(seconds)) {
          let elapsed = 0;
          await new Promise<void>(resolve => {
            const interval = setInterval(() => {
              elapsed += 100;
              if (playStateRef.current.shouldCancel || elapsed >= seconds * 1000) {
                clearInterval(interval);
                resolve();
              }
            }, 100);
          });
        }
      }
    }
    
    setIsPlaying(false);
    utteranceRef.current = null;
  };

  const handlePlayAudio = () => {
    if (isPlaying) {
      playStateRef.current.shouldCancel = true;
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      utteranceRef.current = null;
      return;
    }
    playSequence();
  };

  const handleInsertPause = (seconds: number) => {
    pushHistory();
    const dur = seconds.toString();
    
    const textarea = textareaRef.current;
    const currentText = scripts[currentPageIndex] || '';
    
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = currentText.substring(0, start);
      const after = currentText.substring(end);
      const insertStr = ` [pause: ${dur}] `;
      
      onChange(currentPageIndex, before + insertStr + after);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + insertStr.length, start + insertStr.length);
      }, 0);
    } else {
      onChange(currentPageIndex, currentText + ` [pause: ${dur}] `);
    }
  };

  const handleNext = () => {
    if (currentPageIndex < pageCount - 1) {
      setCurrentPageIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(prev => prev - 1);
    }
  };

  if (!fileUrl) return null;

  const currentScript = scripts[currentPageIndex] || '';

  return (
    <div className="flex flex-col h-full md:h-auto">
      {/* Mobile Tabs */}
      <div className="md:hidden flex border border-slate-200 bg-white rounded-t-xl overflow-hidden mb-[-1px] relative z-10">
        <button 
          onClick={() => setActiveTab('preview')}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'preview' ? 'border-brand-dark text-brand-dark bg-slate-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
        >
          Document Preview
        </button>
        <button 
          onClick={() => setActiveTab('script')}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'script' ? 'border-brand-dark text-brand-dark bg-slate-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
        >
          Narrator Script
        </button>
      </div>

      <div className="bg-white rounded-b-xl md:rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[700px] md:min-h-[650px] shrink-0">
        
        {/* Content Split Area */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
      
      {/* LEFT PANEL: Live PDF Preview */}
      <div className={`flex-1 md:w-1/2 bg-slate-100 border-r border-slate-200 flex-col relative ${activeTab === 'preview' ? 'flex' : 'hidden md:flex'}`}>
        <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center z-10 shadow-sm">
          <div className="flex items-center space-x-3">
            <span className="hidden md:inline font-semibold text-slate-700">Document Preview</span>
            <button 
              onClick={() => setIsMagnifierEnabled(!isMagnifierEnabled)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                isMagnifierEnabled 
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
              }`}
              title={isMagnifierEnabled ? "Disable Magnifier" : "Enable Magnifier"}
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span>Lens {isMagnifierEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>
          <span className="text-sm font-medium text-brand-dark bg-brand-dark/10 px-3 py-1 rounded-full whitespace-nowrap">
            Page {currentPageIndex + 1} of {pageCount}
          </span>
        </div>
        
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 relative">
          <div 
            ref={pdfContainerRef}
            className={`shadow-lg rounded-md overflow-hidden transition-all duration-300 relative ${isMagnifierEnabled ? 'cursor-crosshair' : ''}`}
            onMouseMove={(e) => {
              if (!isMagnifierEnabled || !pdfContainerRef.current) return;
              const rect = pdfContainerRef.current.getBoundingClientRect();
              setLensPos({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
              });
            }}
            onMouseLeave={() => setLensPos(null)}
          >
            <Document 
              file={fileUrl} 
              loading={<div className="text-slate-400 p-8">Loading PDF rendering engine...</div>}
              className="flex justify-center"
            >
              <Page 
                pageNumber={currentPageIndex + 1} 
                loading={
                  <div className="bg-slate-200 w-[400px] h-[565px] animate-pulse flex items-center justify-center text-slate-400 font-medium">
                    Rendering page {currentPageIndex + 1}...
                  </div>
                }
                renderTextLayer={false} 
                renderAnnotationLayer={false}
                width={400} // Scale down so it fits nicely
                className="bg-white"
              />
            </Document>

            {/* The Floating Magnifying Lens */}
            {isMagnifierEnabled && (
              <div 
                className="absolute border-[3px] border-indigo-500 rounded-full overflow-hidden shadow-2xl z-50 bg-white pointer-events-none transition-opacity duration-75"
                style={{
                  width: 300,
                  height: 300,
                  left: (lensPos?.x ?? 0) - 150,
                  top: (lensPos?.y ?? 0) - 150,
                  opacity: lensPos ? 1 : 0,
                  visibility: lensPos ? 'visible' : 'hidden'
                }}
              >
                <div 
                  className="absolute"
                  style={{
                    left: -(lensPos?.x ?? 0) * 2.5 + 150,
                    top: -(lensPos?.y ?? 0) * 2.5 + 150,
                  }}
                >
                  <Document file={fileUrl}>
                    <Page 
                      pageNumber={currentPageIndex + 1} 
                      width={1000} // 400 * 2.5
                      renderTextLayer={false} 
                      renderAnnotationLayer={false} 
                      className="bg-white"
                    />
                  </Document>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Script Workspace */}
      <div className={`flex-1 md:w-1/2 flex-col bg-white relative ${activeTab === 'script' ? 'flex' : 'hidden md:flex'}`}>
        {/* 1. Header & Audio Tool */}
        <div className="p-6 pb-4 border-b border-slate-100 flex flex-col gap-4 bg-white z-10 shadow-sm">
          <div className="flex justify-between items-center">
            <h3 className="text-lg md:text-xl font-bold text-slate-800">
              <span className="hidden md:inline">Narrator Script </span>
              <span className="text-slate-400 font-normal md:border-l md:border-slate-300 md:pl-2 md:ml-1">Page {currentPageIndex + 1}</span>
            </h3>
            {currentScript.trim().length > 0 ? (
              <span className="flex items-center text-sm font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Logged
              </span>
            ) : (
              <span className="flex items-center text-sm font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
                <Circle className="w-4 h-4 mr-1.5" /> Empty
              </span>
            )}
          </div>
          
          {/* Standalone Full-Width Audio Player */}
          <div className="flex items-center w-full bg-white rounded-lg border border-slate-200 p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-brand-dark focus-within:border-brand-dark transition-all">
            <Mic className="w-4 h-4 text-slate-400 ml-2 mr-3 shrink-0" />
            <div className="flex-1 min-w-0 relative">
              <select 
                value={safeVoiceURI} 
                onChange={(e) => setSelectedVoiceURI(e.target.value)}
                className="w-full text-sm bg-transparent border-none outline-none text-slate-700 font-medium cursor-pointer focus:ring-0 truncate pr-4"
              >
                {voices.map(v => (
                  <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
                ))}
              </select>
            </div>
            
            <div className="w-px h-5 bg-slate-200 mx-3 shrink-0"></div>
            
            <select
              value={playbackRate}
              onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
              className="text-sm bg-transparent border-none outline-none text-slate-600 w-16 cursor-pointer focus:ring-0 shrink-0"
              title="Playback Speed"
            >
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1.0x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2.0x</option>
            </select>
            
            <button 
              onClick={handlePlayAudio}
              disabled={!scripts[currentPageIndex]?.trim()}
              className={`w-8 h-8 ml-1 rounded-md flex shrink-0 items-center justify-center transition-colors ${
                !scripts[currentPageIndex]?.trim() 
                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                  : isPlaying 
                    ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' 
                    : 'bg-brand-dark text-white hover:bg-brand-hover'
              }`}
              title={isPlaying ? "Stop Audio" : "Play Audio"}
            >
              {isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
            </button>
          </div>
        </div>

        {/* 2. Text Editor Workspace */}
        <div className="flex-1 p-6 pt-4 flex flex-col bg-slate-50/50 min-h-0">
          <div className="flex-1 relative min-h-0 flex flex-col border border-slate-300 rounded-lg shadow-sm bg-white overflow-hidden focus-within:ring-2 focus-within:ring-brand-dark focus-within:border-brand-dark transition-shadow">
            <div className="flex-1 relative min-h-0">
              {isPlaying ? (
                <div className="absolute inset-0 w-full p-5 bg-slate-50 text-slate-700 leading-relaxed overflow-y-auto font-sans whitespace-pre-wrap cursor-not-allowed border-none">
                  {currentScript}
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={currentScript}
                  onChange={handleTextChange}
                  placeholder={`Type or paste the spoken narrative for page ${currentPageIndex + 1} here...\n\nExample: "Welcome to the magazine." [pause: 2] "Let's begin."`}
                  className="absolute inset-0 w-full p-5 resize-none outline-none text-slate-700 leading-relaxed border-none focus:ring-0"
                />
              )}
            </div>
            
            {/* Unified Formatting Footer (Ultra Compact) */}
            <div className="bg-slate-50 border-t border-slate-200 flex flex-col">
              
              {/* Line 1: Actions (Undo/Redo, Pause) */}
              <div className="flex items-center justify-between p-2 border-b border-slate-200">
                <div className="flex items-center space-x-1">
                  <button onClick={handleUndo} disabled={isPlaying || history.past.length === 0} className="p-1 text-slate-500 hover:text-brand-dark hover:bg-slate-200 rounded transition-colors disabled:opacity-30" title="Undo">
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button onClick={handleRedo} disabled={isPlaying || history.future.length === 0} className="p-1 text-slate-500 hover:text-brand-dark hover:bg-slate-200 rounded transition-colors disabled:opacity-30" title="Redo">
                    <Redo2 className="w-4 h-4" />
                  </button>
                  
                  <div className="w-px h-4 bg-slate-300 mx-2"></div>
                  
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline-block">Insert Pause:</span>
                  <button onClick={() => handleInsertPause(1)} disabled={isPlaying} className="text-[11px] bg-white border border-slate-200 hover:border-brand-dark hover:text-brand-dark text-slate-600 px-2 py-0.5 rounded transition-colors disabled:opacity-50 font-medium">1s</button>
                  <button onClick={() => handleInsertPause(2)} disabled={isPlaying} className="text-[11px] bg-white border border-slate-200 hover:border-brand-dark hover:text-brand-dark text-slate-600 px-2 py-0.5 rounded transition-colors disabled:opacity-50 font-medium">2s</button>
                  <button onClick={() => handleInsertPause(3)} disabled={isPlaying} className="text-[11px] bg-white border border-slate-200 hover:border-brand-dark hover:text-brand-dark text-slate-600 px-2 py-0.5 rounded transition-colors disabled:opacity-50 font-medium">3s</button>
                  
                  <div className="flex items-center ml-1 bg-white border border-slate-200 rounded overflow-hidden focus-within:border-brand-dark focus-within:ring-1 focus-within:ring-brand-dark transition-all h-6">
                    <input 
                      type="number" 
                      step="0.1" 
                      min="0.1" 
                      value={customPause} 
                      onChange={(e) => setCustomPause(e.target.value)}
                      disabled={isPlaying}
                      className="w-10 text-[11px] p-0 border-none outline-none text-center focus:ring-0 disabled:opacity-50"
                      placeholder="sec"
                    />
                    <button 
                      onClick={() => handleInsertPause(parseFloat(customPause) || 1.5)} 
                      disabled={isPlaying || isNaN(parseFloat(customPause))} 
                      className="text-[11px] bg-slate-100 hover:bg-brand-dark hover:text-white text-slate-600 px-2 h-full transition-colors disabled:opacity-50 font-medium border-l border-slate-200"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Page Automation (OCR & Clear) */}
              <div className="flex flex-col bg-white">
                
                {/* OCR Group */}
                <div className="flex items-center p-2 border-b border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-28 flex items-center shrink-0">
                    {isExtracting || isExtractingAll ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-indigo-400" /> : <FileText className="w-3.5 h-3.5 mr-1.5" />} 
                    Extract Text:
                  </span>
                  <div className="flex space-x-1">
                    <button onClick={handleExtractText} disabled={isExtracting || isExtractingAll} className="w-24 text-[11px] font-medium py-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30">
                      Current Page
                    </button>
                    <button onClick={handleExtractAllText} disabled={isExtracting || isExtractingAll} className="w-24 text-[11px] font-medium py-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30">
                      All Pages
                    </button>
                  </div>
                </div>

                {/* Clear Group */}
                <div className="flex items-center p-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-28 flex items-center shrink-0">
                    <Trash className="w-3.5 h-3.5 mr-1.5" /> Clear Text:
                  </span>
                  <div className="flex space-x-1">
                    <button onClick={handleClearPage} disabled={isPlaying || !scripts[currentPageIndex]?.trim()} className="w-24 text-[11px] font-medium py-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-30">
                      Current Page
                    </button>
                    <button onClick={handleClearAll} disabled={isPlaying} className="w-24 text-[11px] font-medium py-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors disabled:opacity-30">
                      All Pages
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
        
        </div>
        </div>

        {/* 3. Unified Navigation Bar */}
        <div className="border-t border-slate-200 bg-white flex flex-col md:flex-row md:items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 md:p-1">
          
          {/* Desktop Left (Previous) */}
          <div className="hidden md:flex p-2 pr-0 space-x-2 shrink-0">
            <Button variant="ghost" onClick={() => setCurrentPageIndex(0)} disabled={currentPageIndex === 0} className="text-slate-500 hover:bg-slate-100 px-3" title="First Page">
              <ChevronsLeft className="w-5 h-5" />
            </Button>
            <Button variant="ghost" onClick={handlePrev} disabled={currentPageIndex === 0} className="text-slate-600 hover:bg-slate-100">
              <ChevronLeft className="w-5 h-5 mr-1" /> Previous
            </Button>
          </div>

          {/* Pagination Circle Scroller */}
          <div className="flex items-center justify-between bg-slate-50 md:bg-transparent border-b md:border-none border-slate-100 flex-1 overflow-hidden min-w-0">
            <button 
              onClick={() => handleScrollPagination('left')}
              className="p-3 text-slate-400 hover:text-brand-dark hover:bg-slate-200 transition-colors shrink-0"
              title="Scroll Left"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div 
              ref={scrollContainerRef}
              className="flex items-center space-x-2 overflow-x-auto flex-1 px-2 py-2.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {Array.from({ length: pageCount }).map((_, idx) => {
                const hasText = scripts[idx]?.trim().length > 0;
                const isSelected = idx === currentPageIndex;
                return (
                  <button
                    key={idx}
                    id={`page-btn-${idx}`}
                    onClick={() => setCurrentPageIndex(idx)}
                    title={`Go to Page ${idx + 1}`}
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                      ${isSelected ? 'ring-2 ring-brand-dark ring-offset-1 bg-brand-dark text-white' : 
                        hasText ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}
                    `}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            
            <button 
              onClick={() => handleScrollPagination('right')}
              className="p-3 text-slate-400 hover:text-brand-dark hover:bg-slate-200 transition-colors shrink-0 border-r border-slate-200"
              title="Scroll Right"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2 px-4 shrink-0 bg-slate-50 md:bg-transparent">
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap hidden sm:inline-block">Jump:</span>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const pageNum = parseInt(fd.get('jump') as string, 10);
                  if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= pageCount) {
                    setCurrentPageIndex(pageNum - 1);
                    (e.currentTarget.elements.namedItem('jump') as HTMLInputElement).value = '';
                  }
                }}
                className="flex"
              >
                <input 
                  type="number" 
                  name="jump"
                  min={1} 
                  max={pageCount}
                  placeholder="Pg" 
                  className="w-12 px-1.5 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-brand-dark focus:border-brand-dark outline-none text-center"
                />
              </form>
            </div>
          </div>

          {/* Desktop Right (Next) */}
          <div className="hidden md:flex p-2 pl-0 space-x-2 shrink-0">
            <Button onClick={handleNext} disabled={currentPageIndex === pageCount - 1} className="bg-brand-dark hover:bg-brand-hover text-white shadow-md px-6">
              Next Page <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
            <Button variant="ghost" onClick={() => setCurrentPageIndex(pageCount - 1)} disabled={currentPageIndex === pageCount - 1} className="text-slate-500 hover:bg-slate-100 px-3" title="Last Page">
              <ChevronsRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Mobile Previous / Next Actions */}
          <div className="md:hidden p-4 flex justify-between items-center bg-white">
            <div className="flex space-x-2">
              <Button variant="ghost" onClick={() => setCurrentPageIndex(0)} disabled={currentPageIndex === 0} className="text-slate-500 hover:bg-slate-100 px-3" title="First Page">
                <ChevronsLeft className="w-5 h-5" />
              </Button>
              <Button variant="ghost" onClick={handlePrev} disabled={currentPageIndex === 0} className="text-slate-600 hover:bg-slate-100">
                <ChevronLeft className="w-5 h-5 mr-1" /> Previous
              </Button>
            </div>
            
            <div className="flex space-x-2">
              <Button onClick={handleNext} disabled={currentPageIndex === pageCount - 1} className="bg-brand-dark hover:bg-brand-hover text-white shadow-md px-6">
                Next Page <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
              <Button variant="ghost" onClick={() => setCurrentPageIndex(pageCount - 1)} disabled={currentPageIndex === pageCount - 1} className="text-slate-500 hover:bg-slate-100 px-3" title="Last Page">
                <ChevronsRight className="w-5 h-5" />
              </Button>
            </div>
          </div>

        </div>
      </div>
      
    </div>
  );
}

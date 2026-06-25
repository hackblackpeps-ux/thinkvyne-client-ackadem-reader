import { useState, useEffect } from 'react';
import { Play, Pause, Square, Volume2, ChevronLeft, ChevronRight, ChevronUp, Maximize, Minimize, SkipForward, SkipBack } from 'lucide-react';

interface AudioPlaybackShelfProps {
  isPlaying: boolean;
  onTogglePlayPause: () => void;
  onStop: () => void;
  isAutoFlipEnabled: boolean;
  onToggleAutoFlip: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  availableVoices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  onVoiceChange: (voice: SpeechSynthesisVoice) => void;
  currentPageIndex: number;
  totalPages: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  onJumpToPage: (pageIndex: number) => void;
  isSubtitlesEnabled: boolean;
  onToggleSubtitles: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  canNextTrack: boolean;
  canPrevTrack: boolean;
}

export function AudioPlaybackShelf({
  isPlaying,
  onTogglePlayPause,
  onStop,
  isAutoFlipEnabled,
  onToggleAutoFlip,
  playbackSpeed,
  onSpeedChange,
  availableVoices,
  selectedVoice,
  onVoiceChange,
  currentPageIndex,
  totalPages,
  onNextPage,
  onPrevPage,
  onJumpToPage,
  isSubtitlesEnabled,
  onToggleSubtitles,
  onNextTrack,
  onPrevTrack,
  canNextTrack,
  canPrevTrack
}: AudioPlaybackShelfProps) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Custom Jumper State
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState('');

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const isMobile = windowWidth < 768;

  if (isMobile) {
    return (
      <>
        {/* FAB for Mobile */}
        {/* Mini-Player for Mobile */}
        {!isMobileDrawerOpen && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-5 py-3 flex items-center justify-between pb-safe">
            
            {/* Quick Controls */}
            <div className="flex items-center space-x-2">
              <button 
                onClick={onPrevTrack} 
                disabled={!canPrevTrack} 
                className="p-2.5 text-slate-600 hover:text-indigo-900 disabled:opacity-30 disabled:hover:text-slate-600 transition-colors"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              
              <button 
                onClick={onTogglePlayPause} 
                className="w-12 h-12 rounded-full bg-indigo-900 text-white flex items-center justify-center shadow-md active:scale-95 transition-transform"
              >
                {isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5 ml-1" fill="currentColor" />}
              </button>
              
              <button 
                onClick={onNextTrack} 
                disabled={!canNextTrack} 
                className="p-2.5 text-slate-600 hover:text-indigo-900 disabled:opacity-30 disabled:hover:text-slate-600 transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </button>

              <button 
                onClick={onStop} 
                className="p-2.5 text-slate-500 hover:text-rose-600 transition-colors hidden sm:block"
              >
                <Square className="w-4 h-4" fill="currentColor" />
              </button>
            </div>

            {/* Expand Drawer Button */}
            <button 
              onClick={() => setIsMobileDrawerOpen(true)}
              className="px-3 py-2 flex items-center text-indigo-700 bg-indigo-50/80 rounded-full font-semibold text-xs hover:bg-indigo-100 transition-colors border border-indigo-100"
            >
               Settings <ChevronUp className="w-4 h-4 ml-1" />
            </button>
          </div>
        )}

        {/* Mobile Drawer */}
        {isMobileDrawerOpen && (
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white/90 backdrop-blur-md border-t border-slate-200 shadow-2xl p-6 rounded-t-3xl animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-slate-800 flex items-center">
                <Volume2 className="w-5 h-5 mr-2 text-indigo-600" /> 
                Audio Narration
              </h3>
              <button 
                onClick={() => setIsMobileDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-medium text-sm"
              >
                Close
              </button>
            </div>
                        <div className="flex justify-center space-x-4 mb-8">
                <button 
                  onClick={onPrevTrack}
                  disabled={!canPrevTrack}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-sm ${canPrevTrack ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-indigo-600' : 'bg-slate-50 text-slate-300 opacity-50 cursor-not-allowed'}`}
                >
                  <SkipBack className="w-5 h-5 ml-[-2px]" />
                </button>
                <button 
                  onClick={onTogglePlayPause}
                  className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-[0_8px_30px_rgba(79,70,229,0.4)] active:scale-95 transition-transform"
                >
                  {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
                </button>
                <button 
                  onClick={onNextTrack}
                  disabled={!canNextTrack}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-sm ${canNextTrack ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-indigo-600' : 'bg-slate-50 text-slate-300 opacity-50 cursor-not-allowed'}`}
                >
                  <SkipForward className="w-5 h-5 ml-[2px]" />
                </button>
                <button 
                  onClick={onStop}
                  className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors shadow-sm"
                >
                  <Square className="w-4 h-4" />
                </button>
              </div>

            <div className="flex flex-col space-y-4 px-2 text-sm text-slate-600">
              
              {/* Page Navigation */}
              <div className="flex items-center justify-between bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                <button 
                  onClick={onPrevPage} 
                  disabled={currentPageIndex === 0}
                  className="p-2.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg disabled:opacity-30 transition-colors shadow-sm bg-white border border-slate-200/60"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="flex flex-col items-center justify-center min-w-[100px]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Page</span>
                  {isEditingPage ? (
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        const pageNum = parseInt(jumpPageInput, 10);
                        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                          onJumpToPage(pageNum - 1);
                        }
                        setIsEditingPage(false);
                      }}
                      className="flex items-center justify-center"
                    >
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={jumpPageInput}
                        onChange={(e) => setJumpPageInput(e.target.value)}
                        onBlur={() => setIsEditingPage(false)}
                        autoFocus
                        className="w-12 text-center text-sm font-semibold text-indigo-700 bg-white border-b-2 border-indigo-500 outline-none p-0 focus:ring-0"
                      />
                      <span className="text-sm font-semibold text-slate-400 ml-1">/ {totalPages}</span>
                    </form>
                  ) : (
                    <button 
                      onClick={() => {
                        setJumpPageInput((currentPageIndex + 1).toString());
                        setIsEditingPage(true);
                      }}
                      className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 transition-colors group px-2 py-0.5 rounded-md hover:bg-slate-200/50"
                      title="Tap to jump to page"
                    >
                      {isMobile || currentPageIndex === 0 ? currentPageIndex + 1 : `${currentPageIndex + 1}-${Math.min(currentPageIndex + 2, totalPages)}`} <span className="text-slate-400 group-hover:text-slate-500">/ {totalPages}</span>
                    </button>
                  )}
                </div>

                <button 
                  onClick={onNextPage} 
                  disabled={currentPageIndex >= totalPages - 1}
                  className="p-2.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg disabled:opacity-30 transition-colors shadow-sm bg-white border border-slate-200/60"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Voice Selection */}
              <div className="flex flex-col space-y-2">
                <span className="text-sm font-semibold text-slate-700">Narrator Voice</span>
                <select
                  value={selectedVoice?.name || ''}
                  onChange={(e) => {
                    const voice = availableVoices.find(v => v.name === e.target.value);
                    if (voice) onVoiceChange(voice);
                  }}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer font-medium"
                >
                  {availableVoices.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name.replace(/Microsoft |English \(United States\)/gi, '').trim() || voice.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reading Speed */}
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Reading Speed</span>
                  <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{playbackSpeed}x</span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="2" 
                  step="0.1" 
                  value={playbackSpeed}
                  onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Auto-Flip Pages</span>
                <button 
                  onClick={onToggleAutoFlip}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${isAutoFlipEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}
                >
                  <div className={`absolute left-[2px] bg-white w-5 h-5 rounded-full shadow-sm transition-transform duration-300 ${isAutoFlipEnabled ? 'translate-x-[24px]' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Closed Captions</span>
                <button 
                  onClick={onToggleSubtitles}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${isSubtitlesEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}
                >
                  <div className={`absolute left-[2px] bg-white w-5 h-5 rounded-full shadow-sm transition-transform duration-300 ${isSubtitlesEnabled ? 'translate-x-[24px]' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop/Tablet Bottom Bar
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 pb-4 md:pb-6 pointer-events-none flex justify-center">
      <div className="pointer-events-auto bg-white/85 backdrop-blur-2xl border border-white/60 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] rounded-3xl md:rounded-[2rem] max-w-[1400px] w-[96%] mx-auto transition-all duration-300">
        <div className="px-4 md:px-5 xl:px-8 py-3 md:py-4 flex items-center justify-start lg:justify-between overflow-x-auto hide-scrollbar gap-4 lg:gap-0">
        
        {/* Section 1: Playback Controls */}
        <div className="flex items-center space-x-2 xl:space-x-3 flex-shrink-0">
          <button 
            onClick={onPrevTrack}
            disabled={!canPrevTrack}
            className={`w-10 h-10 xl:w-12 xl:h-12 rounded-full flex items-center justify-center transition-colors shadow-sm border border-slate-200 active:scale-95 ${canPrevTrack ? 'bg-white text-slate-600 hover:bg-slate-50 hover:text-indigo-600' : 'bg-slate-50 text-slate-300 cursor-not-allowed opacity-50'}`}
            title="Previous Page Audio"
          >
            <SkipBack className="w-4 h-4 xl:w-5 xl:h-5 ml-[-2px]" />
          </button>
          
          <button 
            onClick={onTogglePlayPause}
            className={`w-12 h-12 xl:w-14 xl:h-14 rounded-full flex items-center justify-center text-white transition-all active:scale-95 shadow-md ${isPlaying ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'}`}
          >
            {isPlaying ? <Pause className="w-5 h-5 xl:w-6 xl:h-6" /> : <Play className="w-5 h-5 xl:w-6 xl:h-6 ml-1" />}
          </button>

          <button 
            onClick={onNextTrack}
            disabled={!canNextTrack}
            className={`w-10 h-10 xl:w-12 xl:h-12 rounded-full flex items-center justify-center transition-colors shadow-sm border border-slate-200 active:scale-95 ${canNextTrack ? 'bg-white text-slate-600 hover:bg-slate-50 hover:text-indigo-600' : 'bg-slate-50 text-slate-300 cursor-not-allowed opacity-50'}`}
            title="Next Page Audio"
          >
            <SkipForward className="w-4 h-4 xl:w-5 xl:h-5 ml-[2px]" />
          </button>
          
          <button 
            onClick={onStop}
            className="w-8 h-8 xl:w-10 xl:h-10 ml-1 xl:ml-2 rounded-full bg-white flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm border border-slate-200 active:scale-95"
            title="Stop & Reset"
          >
            <Square className="w-3 h-3 xl:w-3.5 xl:h-3.5 fill-current" />
          </button>
        </div>

        <div className="w-px h-10 xl:h-12 bg-slate-200 mx-4 xl:mx-6 flex-shrink-0" />

        {/* Section 2: Pacing & Speed */}
        <div className="flex flex-col w-32 xl:w-48 flex-shrink-0">
          <div className="flex justify-between items-center text-[9px] xl:text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">
            <span className="hidden xl:inline">Reading Speed</span>
            <span className="xl:hidden">Speed</span>
            <span className="text-indigo-600 bg-indigo-50 px-1.5 xl:px-2 py-0.5 rounded-full min-w-[36px] text-center">{playbackSpeed}x</span>
          </div>
          <input 
            type="range" 
            min="0.5" 
            max="2" 
            step="0.1" 
            value={playbackSpeed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
          />
        </div>

        <div className="w-px h-10 xl:h-12 bg-slate-200 mx-4 xl:mx-6 flex-shrink-0" />

        {/* Section 3: Pagination Engine */}
        <div className="flex items-center space-x-2 xl:space-x-4 bg-slate-50 rounded-2xl p-1 xl:p-1.5 border border-slate-100 shadow-inner">
          <button 
            onClick={onPrevPage} 
            disabled={currentPageIndex === 0}
            className="p-2 xl:p-2.5 rounded-xl bg-white text-slate-500 hover:text-indigo-600 hover:shadow-sm disabled:opacity-40 disabled:hover:shadow-none transition-all"
          >
            <ChevronLeft className="w-4 h-4 xl:w-5 xl:h-5" />
          </button>
          
          {isEditingPage ? (
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const pageNum = parseInt(jumpPageInput);
                if (!isNaN(pageNum) && pageNum > 0 && pageNum <= totalPages) {
                  onJumpToPage(pageNum - 1);
                }
                setIsEditingPage(false);
              }}
              className="flex flex-col items-center min-w-[60px] xl:min-w-[70px]"
            >
              <span className="text-[8px] xl:text-[9px] font-bold text-indigo-500 uppercase tracking-widest mb-0.5">Jump</span>
              <input 
                type="number" 
                autoFocus
                min={1}
                max={totalPages}
                value={jumpPageInput}
                onChange={(e) => setJumpPageInput(e.target.value)}
                onBlur={() => setIsEditingPage(false)}
                className="w-10 xl:w-12 text-center text-xs xl:text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </form>
          ) : (
            <div 
              className="flex flex-col items-center min-w-[60px] xl:min-w-[70px] cursor-pointer group px-2 py-1 rounded hover:bg-slate-100 transition-colors"
              onClick={() => {
                setJumpPageInput((currentPageIndex + 1).toString());
                setIsEditingPage(true);
              }}
              title="Click to jump to page"
            >
              <span className="text-[8px] xl:text-[9px] font-bold text-slate-400 group-hover:text-indigo-500 transition-colors uppercase tracking-widest mb-0.5">Page</span>
              <span className="text-xs xl:text-sm font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">
                {isMobile || currentPageIndex === 0 ? currentPageIndex + 1 : `${currentPageIndex + 1}-${Math.min(currentPageIndex + 2, totalPages)}`} <span className="text-slate-400 font-medium text-[10px] xl:text-xs">/ {totalPages}</span>
              </span>
            </div>
          )}

          <button 
            onClick={onNextPage}
            disabled={currentPageIndex === totalPages - 1}
            className="p-2 xl:p-2.5 rounded-xl bg-white text-slate-500 hover:text-indigo-600 hover:shadow-sm disabled:opacity-40 disabled:hover:shadow-none transition-all"
          >
            <ChevronRight className="w-4 h-4 xl:w-5 xl:h-5" />
          </button>
        </div>

        <div className="w-px h-10 xl:h-12 bg-slate-200 mx-4 xl:mx-6 flex-shrink-0" />

        {/* Section 4: Advanced Settings */}
        <div className="flex items-center space-x-4 xl:space-x-6 flex-shrink-0">
          
          <div className="flex flex-col">
            <span className="text-[9px] xl:text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">
              <span className="hidden xl:inline">Narrator </span>Voice
            </span>
            <select
              value={selectedVoice?.name || ''}
              onChange={(e) => {
                const voice = availableVoices.find(v => v.name === e.target.value);
                if (voice) onVoiceChange(voice);
              }}
              className="bg-slate-50 text-xs xl:text-sm border border-slate-200 rounded-xl py-1.5 xl:py-2 px-2 xl:px-3 text-slate-700 font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-32 xl:w-auto max-w-[150px] truncate shadow-sm cursor-pointer hover:bg-white transition-colors outline-none"
            >
              {availableVoices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="w-px h-6 xl:h-8 bg-slate-200" />

          <div className="flex flex-col items-center justify-center">
            <span className="text-[9px] xl:text-[10px] font-bold text-slate-400 mb-1.5 xl:mb-2 uppercase tracking-widest">Auto-Flip</span>
            <button 
              onClick={onToggleAutoFlip}
              className={`w-10 xl:w-12 h-5 xl:h-6 rounded-full transition-colors relative flex items-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-inner border border-black/5 ${isAutoFlipEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}
            >
              <div 
                className={`absolute left-[2px] bg-white w-4 h-4 xl:w-5 xl:h-5 rounded-full shadow-md transition-transform duration-300 ease-in-out ${isAutoFlipEnabled ? 'translate-x-[20px] xl:translate-x-[24px]' : 'translate-x-0'}`} 
              />
            </button>
          </div>

          <div className="w-px h-6 xl:h-8 bg-slate-200" />

          <div className="flex flex-col items-center justify-center">
            <span className="text-[9px] xl:text-[10px] font-bold text-slate-400 mb-1.5 xl:mb-2 uppercase tracking-widest">Captions</span>
            <button 
              onClick={onToggleSubtitles}
              className={`w-10 xl:w-12 h-5 xl:h-6 rounded-full transition-colors relative flex items-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-inner border border-black/5 ${isSubtitlesEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}
            >
              <div 
                className={`absolute left-[2px] bg-white w-4 h-4 xl:w-5 xl:h-5 rounded-full shadow-md transition-transform duration-300 ease-in-out ${isSubtitlesEnabled ? 'translate-x-[20px] xl:translate-x-[24px]' : 'translate-x-0'}`} 
              />
            </button>
          </div>

          <div className="w-px h-6 xl:h-8 bg-slate-200" />

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 xl:p-3 rounded-xl xl:rounded-2xl bg-slate-50 border border-slate-100 text-slate-500 hover:text-indigo-600 hover:bg-white hover:shadow-md transition-all active:scale-95 group flex-shrink-0"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize className="w-4 h-4 xl:w-5 xl:h-5 group-hover:scale-110 transition-transform" /> : <Maximize className="w-4 h-4 xl:w-5 xl:h-5 group-hover:scale-110 transition-transform" />}
          </button>
        </div>

        </div>
      </div>
    </div>
  );
}

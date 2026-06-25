import { useMemo } from 'react';

interface ClosedCaptionsOverlayProps {
  text: string;
  wordHighlight: { start: number; length: number } | null;
}

export function ClosedCaptionsOverlay({ text, wordHighlight }: ClosedCaptionsOverlayProps) {
  // Tokenize the text into stable sentence chunks to completely prevent visual jitter
  const chunks = useMemo(() => {
    if (!text) return [];
    if (text.length <= 150) {
      return [{ text: text.trim(), start: 0, end: text.length, trimOffset: text.length - text.trimStart().length }];
    }

    const result: { text: string; start: number; end: number; trimOffset: number }[] = [];
    // Match sentences (ending in .?! and spaces/newlines, or just newlines)
    const regex = /[^.?!]+[.?!]+(?:\s+|$)|[\n\r]+|[^.?!]+$/g;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
      const rawText = match[0];
      const start = match.index;
      const end = start + rawText.length;
      const trimmed = rawText.trim();
      
      if (!trimmed) continue;

      // Handle massive run-on sentences
      if (trimmed.length > 150) {
        const subRegex = /[^,;]+[,;]+(?:\s+|$)|[^,;]+$/g;
        let subMatch;
        while ((subMatch = subRegex.exec(rawText)) !== null) {
          const subRaw = subMatch[0];
          const subStart = start + subMatch.index;
          const subEnd = subStart + subRaw.length;
          const subTrimmed = subRaw.trim();
          if (subTrimmed) {
            result.push({
              text: subTrimmed,
              start: subStart,
              end: subEnd,
              trimOffset: subRaw.length - subRaw.trimStart().length
            });
          }
        }
      } else {
        result.push({
          text: trimmed,
          start,
          end,
          trimOffset: rawText.length - rawText.trimStart().length
        });
      }
    }
    return result;
  }, [text]);

  if (!text || chunks.length === 0) return null;

  // Find the active chunk based on the current word highlight
  let activeChunk = chunks[0];
  if (wordHighlight) {
    activeChunk = chunks.find(c => wordHighlight.start >= c.start && wordHighlight.start <= c.end) || activeChunk;
  }

  // Calculate the local highlight offset within the active chunk
  let activeHighlight = null;
  if (wordHighlight) {
    activeHighlight = {
      start: wordHighlight.start - activeChunk.start - activeChunk.trimOffset,
      length: wordHighlight.length
    };
  }

  return (
    <div className="absolute bottom-28 md:bottom-32 xl:bottom-36 inset-x-0 z-30 pointer-events-none flex justify-center px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-slate-900/85 backdrop-blur-md px-6 py-3 rounded-2xl max-w-2xl w-full border border-indigo-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <p className="text-white md:text-lg lg:text-xl font-medium text-center leading-relaxed font-sans tracking-wide line-clamp-2 md:line-clamp-3">
          {activeHighlight && activeHighlight.start >= 0 && activeHighlight.start + activeHighlight.length <= activeChunk.text.length ? (
            <>
              <span className="opacity-50">{activeChunk.text.substring(0, activeHighlight.start)}</span>
              <span className="text-yellow-300 font-bold bg-yellow-500/20 px-1 mx-[1px] rounded-md transition-colors">{activeChunk.text.substring(activeHighlight.start, activeHighlight.start + activeHighlight.length)}</span>
              <span className="opacity-50">{activeChunk.text.substring(activeHighlight.start + activeHighlight.length)}</span>
            </>
          ) : (
            <span className="opacity-90">{activeChunk.text}</span>
          )}
        </p>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import HTMLFlipBook from 'react-pageflip';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface MagazineCanvasProps {
  flipbookRef: React.MutableRefObject<any>;
  pdfUrl: string;
  totalPages: number;
  onPageFlip: (e: { data: number }) => void;
  isLensMode: boolean;
  currentPageIndex: number;
}

const LoadingSkeleton = () => (
  <div className="absolute inset-0 w-full h-full bg-white flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-indigo-100 border-t-indigo-500 rounded-full animate-spin"></div>
  </div>
);

// A wrapper component required by HTMLFlipBook to pass refs correctly to children
const PageContainer = React.forwardRef<HTMLDivElement, { pageNumber: number, pdfUrl: string, isMobile: boolean, isLensMode: boolean, currentPageIndex: number }>(
  ({ pageNumber, pdfUrl, isMobile, isLensMode, currentPageIndex }, ref) => {
    const isLeftPage = !isMobile && pageNumber > 0 && pageNumber % 2 !== 0;
    
    // Lens state
    const [isHovering, setIsHovering] = useState(false);
    const [lensPos, setLensPos] = useState<{x: number, y: number} | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const isPageVisible = Math.abs(pageNumber - currentPageIndex) <= (isMobile ? 2 : 3);

    // Native Event Interceptor & Lens Handler
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const blockAndHandle = (e: Event) => {
        if (!isLensMode) return;

        // 1. Destroy the event so react-pageflip NEVER sees it!
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (e.cancelable) e.preventDefault();

        // 2. Manually drive the Lens state since React Synthetic Events are now blocked
        const rect = el.getBoundingClientRect();
        
        if (e.type.startsWith('touch')) {
          const touchEvent = e as TouchEvent;
          if (e.type === 'touchend' || e.type === 'touchcancel') {
            setIsHovering(false);
            setLensPos(null);
          } else if (touchEvent.touches.length > 0) {
            setIsHovering(true);
            setLensPos({
              x: touchEvent.touches[0].clientX - rect.left,
              y: touchEvent.touches[0].clientY - rect.top
            });
          }
        } else {
          // Pointer or Mouse events
          const mouseEvent = e as MouseEvent;
          if (e.type === 'mouseleave' || e.type === 'pointerout' || e.type === 'pointerup' || e.type === 'pointercancel') {
            setIsHovering(false);
            setLensPos(null);
          } else if (e.type === 'mouseenter' || e.type === 'mousemove' || e.type === 'pointermove' || e.type === 'pointerdown') {
            setIsHovering(true);
            setLensPos({
              x: mouseEvent.clientX - rect.left,
              y: mouseEvent.clientY - rect.top
            });
          }
        }
      };

      const events = [
        'touchstart', 'touchmove', 'touchend', 'touchcancel',
        'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerout',
        'mousedown', 'mousemove', 'mouseup', 'mouseenter', 'mouseleave',
        'click'
      ];
      
      events.forEach(ev => el.addEventListener(ev, blockAndHandle, { passive: false }));

      return () => {
        events.forEach(ev => el.removeEventListener(ev, blockAndHandle));
      };
    }, [isLensMode]);

    return (
      <div 
        ref={ref} 
        className="bg-white shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden h-full relative group rounded-sm"
      >
        <div 
          ref={containerRef}
          className={`w-full h-full relative ${isLensMode ? 'cursor-crosshair' : ''} touch-none`}
        >
          {isPageVisible ? (
            <Document 
              file={pdfUrl} 
              loading={<LoadingSkeleton />} 
              className="absolute inset-0 w-full h-full"
            >
              <Page 
                pageNumber={pageNumber + 1} 
                renderTextLayer={false} 
                renderAnnotationLayer={false}
                loading={<LoadingSkeleton />}
                className="!absolute !inset-0 !w-full !h-full [&_.react-pdf__Page__canvas]:!w-full [&_.react-pdf__Page__canvas]:!h-full [&_canvas]:!w-full [&_canvas]:!h-full"
              />
              
              {/* The Floating Magnifying Lens */}
              {isLensMode && isHovering && lensPos && (
                <div 
                  className="absolute border-[3px] border-indigo-500 rounded-full overflow-hidden shadow-2xl z-50 bg-white pointer-events-none transition-opacity duration-75"
                  style={{
                    width: 300,
                    height: 300,
                    left: lensPos.x - 150,
                    top: lensPos.y - 150,
                  }}
                >
                  <div 
                    className="absolute"
                    style={{
                      left: -(lensPos.x) * 2.5 + 150,
                      top: -(lensPos.y) * 2.5 + 150,
                    }}
                  >
                    <Page 
                      pageNumber={pageNumber + 1} 
                      renderTextLayer={false} 
                      renderAnnotationLayer={false}
                      width={1000} // 400 * 2.5
                    />
                  </div>
                </div>
              )}
            </Document>
          ) : (
            <LoadingSkeleton />
          )}

          {/* Photorealistic Spine Shadow Overlay */}
          {!isMobile && (
            <div 
              className={`absolute inset-y-0 w-12 pointer-events-none mix-blend-multiply opacity-50 z-10 
              ${isLeftPage 
                ? 'right-0 bg-gradient-to-l from-black/80 via-black/20 to-transparent' 
                : 'left-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent'}`} 
            />
          )}

          {/* Subdued page edge highlight */}
          {!isMobile && (
            <div 
              className={`absolute inset-y-0 w-1 pointer-events-none z-20 opacity-40 mix-blend-overlay
              ${isLeftPage ? 'left-0 bg-gradient-to-r from-white to-transparent' : 'right-0 bg-gradient-to-l from-white to-transparent'}`}
            />
          )}
        </div>
      </div>
    );
  }
);
PageContainer.displayName = 'PageContainer';

export function MagazineCanvas({ flipbookRef, pdfUrl, totalPages, onPageFlip, isLensMode, currentPageIndex }: MagazineCanvasProps) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  return (
    <div className="w-full max-w-5xl flex justify-center perspective-1000">
      {/* @ts-ignore missing optional props */}
      <HTMLFlipBook
        width={400}
        height={516}
        size="stretch"
        minWidth={300}
        maxWidth={600}
        minHeight={400}
        maxHeight={800}
        maxShadowOpacity={0.5}
        showCover={true}
        mobileScrollSupport={true}
        onFlip={onPageFlip}
        className="magazine-flipbook mx-auto"
        ref={flipbookRef}
        usePortrait={isMobile} // Single page on mobile, dual page on desktop
        swipeDistance={30}
        clickEventForward={!isLensMode}
        useMouseEvents={!isLensMode}
      >
        {Array.from(new Array(totalPages), (_, index) => (
          <PageContainer key={`page_${index}`} pageNumber={index} pdfUrl={pdfUrl} isMobile={isMobile} isLensMode={isLensMode} currentPageIndex={currentPageIndex} />
        ))}
      </HTMLFlipBook>
    </div>
  );
}

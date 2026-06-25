import { useState } from 'react';
import { AlertTriangle, X, Check, Search } from 'lucide-react';
import { Button } from '../shared/Elements';

interface OCRConfirmationModalProps {
  isOpen: boolean;
  emptyIndices: number[];
  onProceedBlank: () => void;
  onRunOCR: () => Promise<void> | void;
  onCancel: () => void;
}

export function OCRConfirmationModal({
  isOpen,
  emptyIndices,
  onProceedBlank,
  onRunOCR,
  onCancel
}: OCRConfirmationModalProps) {
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);

  if (!isOpen) return null;

  const handleRunOCR = async () => {
    setIsProcessingOCR(true);
    await onRunOCR();
    setIsProcessingOCR(false);
  };

  const formatMissingPages = (indices: number[]) => {
    const pages = indices.map(i => i + 1);
    if (pages.length <= 10) return pages.join(', ');
    const firstFew = pages.slice(0, 5).join(', ');
    return `${firstFew}... and ${pages.length - 5} more`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-amber-500 p-6 flex flex-col items-center text-center">
          <div className="bg-white/20 p-3 rounded-full mb-3">
            <AlertTriangle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Missing Narration Scripts</h2>
          <p className="text-amber-50 text-sm">
            {emptyIndices.length} page{emptyIndices.length > 1 ? 's' : ''} currently {emptyIndices.length > 1 ? 'have' : 'has'} blank narration fields.
          </p>
        </div>
        
        <div className="p-6">
          <p className="text-slate-600 text-sm mb-4 text-center">
            Pages {formatMissingPages(emptyIndices)} will be silent during playback. How would you like to proceed?
          </p>

          <div className="space-y-3 mt-6">
            <Button 
              variant="primary" 
              fullWidth 
              onClick={handleRunOCR}
              disabled={isProcessingOCR}
              className="bg-indigo-900 hover:bg-indigo-800"
            >
              {isProcessingOCR ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Extracting Text...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Auto-Extract Missing Text
                </>
              )}
            </Button>
            
            <Button 
              variant="secondary" 
              fullWidth 
              onClick={onProceedBlank}
              disabled={isProcessingOCR}
              className="bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-200"
            >
              <Check className="w-4 h-4 mr-2" />
              Publish with Silent Pages
            </Button>

            <Button 
              variant="ghost" 
              fullWidth 
              onClick={onCancel}
              disabled={isProcessingOCR}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel and Edit Manually
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

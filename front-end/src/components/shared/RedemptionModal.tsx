import React, { useState } from 'react';
import { X, Unlock, Loader2 } from 'lucide-react';
import { Button } from './Elements';

const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000/api`;

interface RedemptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  magazineId: string;
  magazineTitle: string;
  onSuccess: () => void;
  customTitle?: string;
  customMessage?: React.ReactNode;
}

export function RedemptionModal({ isOpen, onClose, magazineId, magazineTitle, onSuccess, customTitle, customMessage }: RedemptionModalProps) {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.trim().length !== 6) {
      setError('Please enter a valid 6-character code.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/codes/redeem/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: code.trim().toUpperCase(),
          series_id: magazineId
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        onSuccess();
      } else {
        setError(data.error || 'Invalid code. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="relative p-6 sm:p-8 text-center">
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 bg-brand-dark/10 text-brand-dark rounded-full flex items-center justify-center mx-auto mb-6">
            <Unlock className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">{customTitle || "Unlock Magazine"}</h2>
          
          {customMessage ? (
            <div className="text-slate-500 mb-8 leading-relaxed">
              {customMessage}
            </div>
          ) : (
            <p className="text-slate-500 mb-8 leading-relaxed">
              Enter your 6-digit access code to unlock <br />
              <span className="font-semibold text-slate-800">"{magazineTitle}"</span>
            </p>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <input
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="6-DIGIT PIN"
                className="w-full text-center text-3xl tracking-[0.5em] font-mono font-bold py-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-brand-dark focus:ring-4 focus:ring-brand-dark/10 transition-all outline-none"
              />
              {error && <p className="text-red-500 text-sm font-medium mt-3 animate-in slide-in-from-top-1">{error}</p>}
            </div>

            <Button 
              type="submit" 
              disabled={isSubmitting || code.length !== 6}
              fullWidth
              className="bg-brand-dark hover:bg-brand-dark/90 text-white py-4 shadow-lg shadow-brand-dark/30 text-lg"
            >
              {isSubmitting ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verifying...</>
              ) : (
                'Unlock Now'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

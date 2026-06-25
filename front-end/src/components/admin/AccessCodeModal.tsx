import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Key, Download } from 'lucide-react';
import { Button } from '../shared/Elements';

const API_BASE = 'http://localhost:8000/api';

interface AccessCode {
  code: string;
  status: string;
  generated_at: string;
}

interface AccessCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  magazineId: string;
  magazineTitle: string;
}

export function AccessCodeModal({ isOpen, onClose, magazineId, magazineTitle }: AccessCodeModalProps) {
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isOpen && magazineId) {
      fetchCodes();
    }
  }, [isOpen, magazineId]);

  const fetchCodes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/magazines/${magazineId}/codes/`);
      if (res.ok) {
        const data = await res.json();
        setCodes(data.codes || []);
      }
    } catch (err) {
      console.error('Failed to fetch codes', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/magazines/${magazineId}/generate_codes/`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchCodes();
      } else {
        alert('Failed to generate codes.');
      }
    } catch (err) {
      console.error('Failed to generate codes', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadCsv = () => {
    if (codes.length === 0) return;
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Code,Status,Generated At\n"
      + codes.map(c => `${c.code},${c.status},${new Date(c.generated_at).toLocaleString()}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Access_Codes_${magazineTitle.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-brand-dark" />
              Manage Access Codes
            </h3>
            <p className="text-sm text-slate-500 mt-1">Magazine: <span className="font-semibold text-slate-700">{magazineTitle}</span></p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            Total Codes: <span className="font-bold text-slate-900">{codes.length}</span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {codes.length > 0 && (
              <Button variant="outline" onClick={handleDownloadCsv} className="flex-1 sm:flex-none">
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
            )}
            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating}
              className="flex-1 sm:flex-none bg-brand-dark hover:bg-brand-dark/90 text-white shadow-md shadow-brand-dark/20"
            >
              {isGenerating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
              {isGenerating ? 'Generating...' : 'Generate 500 Codes'}
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50/30">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Loading codes...
            </div>
          ) : codes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Key className="w-12 h-12 text-slate-200 mb-3" />
              <p className="text-slate-500 font-medium">No access codes generated yet.</p>
              <p className="text-sm text-slate-400 mt-1">Click the button above to generate a batch of 500 codes.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-6 py-3">PIN Code</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Generated Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {codes.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 font-mono font-bold text-slate-800 tracking-widest">{c.code}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                          c.status === 'Active' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-500">{new Date(c.generated_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

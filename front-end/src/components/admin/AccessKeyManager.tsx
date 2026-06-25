import React, { useState, useEffect } from 'react';
import { Key, RefreshCw, XCircle, ChevronLeft, ChevronRight, Download, Copy, Check, Settings, Trash2 } from 'lucide-react';
import { Button } from '../shared/Elements';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

interface AccessKey {
  id: number;
  code: string;
  status: string;
  generated_at: string;
  user_name: string | null;
  user_email: string | null;
  magazine_id: string | null;
  expires_at: string | null;
}

export function AccessKeyManager() {
  const [keys, setKeys] = useState<AccessKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalKeys, setTotalKeys] = useState(0);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [editingKey, setEditingKey] = useState<AccessKey | null>(null);
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [isLifetime, setIsLifetime] = useState(false);

  useEffect(() => {
    fetchKeys(currentPage);
  }, [currentPage]);

  const fetchKeys = async (page: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/codes/?page=${page}`);
      if (res.ok) {
        const data = await res.json();
        setKeys(data.codes || []);
        setTotalPages(data.total_pages || 1);
        setCurrentPage(data.current_page || 1);
        setTotalKeys(data.total_codes || 0);
      }
    } catch (err) {
      console.error('Failed to fetch access keys', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async (months: number = 6) => {
    setIsGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/codes/generate/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 5, duration_months: months })
      });
      if (res.ok) {
        // Jump to page 1 to see new keys
        if (currentPage === 1) {
          await fetchKeys(1);
        } else {
          setCurrentPage(1);
        }
      } else {
        alert('Failed to generate keys.');
      }
    } catch (err) {
      console.error('Failed to generate keys', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Are you sure you want to delete ALL generated keys? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API_BASE}/codes/`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchKeys(1);
      } else {
        alert('Failed to delete all keys.');
      }
    } catch (err) {
      console.error('Failed to delete all keys', err);
    }
  };

  const handleRevoke = async (id: number) => {
    if (!window.confirm('Are you sure you want to revoke this key?')) return;
    try {
      const res = await fetch(`${API_BASE}/codes/${id}/revoke/`, {
        method: 'PATCH',
      });
      if (res.ok) {
        await fetchKeys(currentPage);
      } else {
        alert('Failed to revoke key.');
      }
    } catch (err) {
      console.error('Failed to revoke key', err);
    }
  };

  const handleUpdateExpiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKey) return;
    try {
      const res = await fetch(`${API_BASE}/codes/${editingKey.id}/expiry/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_at: isLifetime ? null : (newExpiryDate || null) }),
      });
      if (res.ok) {
        setEditingKey(null);
        await fetchKeys(currentPage);
      } else {
        alert('Failed to update expiry date.');
      }
    } catch (err) {
      console.error('Failed to update expiry', err);
    }
  };

  const handleCopy = (id: number, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getLocalISOString = (date: Date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Redeemed</span>;
      case 'Revoked':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Revoked</span>;
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">Inactive</span>;
    }
  };

  if (import.meta.env.VITE_ENVIRONMENT === 'production') return null;

  return (
    <div className="bg-white border-2 border-red-200 border-dashed rounded-xl overflow-hidden shadow-sm mt-12 opacity-80 hover:opacity-100 transition-opacity duration-300">
      <div className="p-6 border-b border-red-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-red-50">
        <div>
          <h3 className="text-xl font-bold text-red-700 flex items-center gap-2">
            <Key className="w-5 h-5 text-red-600" />
            DEV Testing: Access Keys
          </h3>
          <p className="text-sm text-red-500 mt-1">This panel is strictly visible for dev testing only. Total keys: <span className="font-semibold text-red-700">{totalKeys}</span></p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button 
            onClick={handleDeleteAll} 
            variant="outline"
            className="flex-1 sm:flex-none border-red-300 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete All
          </Button>
          <Button 
            onClick={() => handleGenerate(5)} 
            disabled={isGenerating}
            className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20"
          >
            {isGenerating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
            Generate 5 (5 Months)
          </Button>
          <Button 
            onClick={() => handleGenerate(11)} 
            disabled={isGenerating}
            className="flex-1 sm:flex-none bg-red-800 hover:bg-red-900 text-white shadow-md shadow-red-800/20"
          >
            {isGenerating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
            Generate 5 (11 Months)
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
            <tr>
              <th className="px-6 py-3">PIN Code</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">User Details</th>
              <th className="px-6 py-3">Magazine ID</th>
              <th className="px-6 py-3">Generated Date</th>
              <th className="px-6 py-3">Expiry Date</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading keys...
                </td>
              </tr>
            ) : keys.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Key className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-medium">No keys found.</p>
                  <p className="text-sm text-slate-400 mt-1">Generate your first batch of wildcard keys above.</p>
                </td>
              </tr>
            ) : (
              keys.map((k) => (
                <tr key={k.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-800 tracking-widest">{k.code}</span>
                      <button 
                        onClick={() => handleCopy(k.id, k.code)}
                        className="text-slate-400 hover:text-brand-dark transition-colors p-1"
                        title="Copy Key"
                      >
                        {copiedId === k.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(k.status)}</td>
                  <td className="px-6 py-4">
                    {k.status === 'Active' ? (
                      <div>
                        <div className="font-semibold text-slate-800">{k.user_name}</div>
                        <div className="text-xs text-slate-500">{k.user_email}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {k.magazine_id ? (
                      <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">{k.magazine_id.split('-')[0]}...</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">{new Date(k.generated_at).toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs">
                    {k.status === 'Active' ? (
                      k.expires_at ? (
                        new Date(k.expires_at) < new Date() ? (
                          <span className="text-red-500 font-semibold">Expired {new Date(k.expires_at).toLocaleString()}</span>
                        ) : (
                          <span className="text-emerald-600 font-medium">{new Date(k.expires_at).toLocaleString()}</span>
                        )
                      ) : (
                        <span className="text-slate-400">Never</span>
                      )
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {k.status === 'Active' && (
                        <button 
                          onClick={() => {
                            setEditingKey(k);
                            if (k.expires_at) {
                              setNewExpiryDate(getLocalISOString(new Date(k.expires_at)));
                              setIsLifetime(false);
                            } else {
                              setNewExpiryDate('');
                              setIsLifetime(true);
                            }
                          }}
                          className="text-slate-400 hover:text-brand-dark hover:bg-slate-100 p-2 rounded-lg transition-colors"
                          title="Change Expiry"
                        >
                          <Settings className="w-5 h-5" />
                        </button>
                      )}
                      {k.status !== 'Revoked' && (
                        <button 
                          onClick={() => handleRevoke(k.id)}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                          title="Revoke Key"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {!isLoading && totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Page <span className="font-semibold text-slate-700">{currentPage}</span> of <span className="font-semibold text-slate-700">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Expiry Settings Modal */}
      {editingKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <form onSubmit={handleUpdateExpiry} className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Set Expiry Date</h3>
              <p className="text-sm text-slate-500 mb-6">Modify access duration for key <span className="font-mono text-slate-800 font-bold">{editingKey.code}</span></p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Expiration Date & Time</label>
                  <input 
                    type="datetime-local" 
                    value={newExpiryDate}
                    onChange={(e) => setNewExpiryDate(e.target.value)}
                    disabled={isLifetime}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isLifetime}
                    onChange={(e) => setIsLifetime(e.target.checked)}
                    className="w-4 h-4 text-brand-dark rounded border-slate-300 focus:ring-brand-dark"
                  />
                  <span className="text-sm font-medium text-slate-700">Grant Life-time validity</span>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setEditingKey(null)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-brand-dark hover:bg-brand-dark/90 text-white"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

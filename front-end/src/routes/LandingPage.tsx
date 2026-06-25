import { Button } from '../components/shared/Elements';
import { BookOpen, Trash2 } from 'lucide-react';
import localforage from 'localforage';
import { AccessKeyManager } from '../components/admin/AccessKeyManager';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export function LandingPage() {
  const handleClearDatabase = async () => {
    if (!window.confirm('Are you sure you want to completely wipe the database (books, keys, and reading progress) and clear local drafts? This action cannot be undone.')) {
      return;
    }
    try {
      localStorage.removeItem('ackadem_unlocked_mags');
      await localforage.clear();
      const res = await fetch(`${API_BASE}/debug/clear-all/`, { method: 'DELETE' });
      if (res.ok) {
        alert('Environment reset successfully.');
        window.location.reload();
      } else {
        alert('Failed to reset backend database.');
      }
    } catch (err) {
      console.error(err);
      alert('Error clearing environment.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-brand-dark/10 rounded-3xl mx-auto flex items-center justify-center mb-8 shadow-sm">
          <BookOpen className="w-10 h-10 text-brand-dark" />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">Ackadem Digital Library</h1>
        <p className="text-lg text-slate-500 mb-10">
          Welcome to the future of digital reading. Access your interactive magazines and audiobooks.
        </p>
        
        <div className="space-y-4">
          <Button fullWidth size="lg" onClick={() => window.open('/library', '_blank')} className="shadow-md">
            Go to My Library
          </Button>
          <Button fullWidth variant="ghost" className="text-slate-500 hover:text-slate-800" onClick={() => window.open('/admin/upload', '_blank')}>
            Admin Portal
          </Button>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-200">
          <p className="text-sm text-slate-400 mb-4">Development Tools</p>
          <Button 
            fullWidth 
            variant="ghost" 
            className="text-red-500 hover:bg-red-50 hover:text-red-600" 
            onClick={handleClearDatabase}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Reset Environment
          </Button>
        </div>
      </div>

      <div className="max-w-4xl w-full mt-8">
        <AccessKeyManager />
      </div>
    </div>
  );
}

import React, { useState } from 'react';

import localforage from 'localforage';
import { DropzoneUploader } from '../components/admin/DropzoneUploader';
import { ScriptFieldGrid } from '../components/admin/ScriptFieldGrid';
import { OCRConfirmationModal } from '../components/admin/OCRConfirmationModal';
import { BookOpen, X, FileText, CheckCircle, Play, History, Trash2, ArrowLeft, Send, Settings } from 'lucide-react';
import { Card, Button } from '../components/shared/Elements';
import { AdminLayout } from '../components/admin/AdminLayout';
import { pdfjs, Document, Page } from 'react-pdf';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// ── IndexedDB keys ─────────────────────────────────────────────────────────────
// All draft data lives in the browser's IndexedDB (via localforage).
// Nothing is sent to the server until the admin clicks "Publish Magazine Issue".
//
// Storage layout:
//   ackadem_drafts          → DraftMeta[]   (list of recent draft summaries)
//   ackadem_draft_<id>      → DraftData     (full scripts + title for one draft)
//   ackadem_pdf_<id>        → File (Blob)   (the PDF binary for one draft)

const DRAFTS_LIST_KEY = 'ackadem_drafts';

interface DraftMeta {
  draft_id: string;
  fileName: string;
  title: string;
  pageCount: number;
  updatedAt: string;
  publishDate?: string;
}

interface DraftData {
  draft_id: string;
  title: string;
  fileName: string;
  pageCount: number;
  scripts: string[];
  publishDate?: string;
}

interface PublishedBook {
  magazine_id: string;
  series_id: string;
  title: string;
  total_pages: number;
  created_at: string;
  updated_at: string;
  publish_date?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function saveDraftToIDB(draft: DraftData, file: File | null) {
  // 1. Save scripts/title
  await localforage.setItem(`ackadem_draft_${draft.draft_id}`, draft);

  // 2. Save PDF binary (only on first save or if file changed)
  if (file) {
    await localforage.setItem(`ackadem_pdf_${draft.draft_id}`, file);
  }

  // 3. Update the drafts index list
  const list: DraftMeta[] = (await localforage.getItem(DRAFTS_LIST_KEY)) || [];
  const meta: DraftMeta = {
    draft_id: draft.draft_id,
    fileName: draft.fileName,
    title: draft.title,
    pageCount: draft.pageCount,
    updatedAt: new Date().toISOString(),
    publishDate: draft.publishDate,
  };
  const existingIdx = list.findIndex((d) => d.draft_id === draft.draft_id);
  if (existingIdx >= 0) {
    list[existingIdx] = meta;
  } else {
    list.unshift(meta);
  }
  // Keep only 10 most recent
  await localforage.setItem(DRAFTS_LIST_KEY, list.slice(0, 10));
}

async function deleteDraftFromIDB(draft_id: string) {
  await localforage.removeItem(`ackadem_draft_${draft_id}`);
  await localforage.removeItem(`ackadem_pdf_${draft_id}`);
  const list: DraftMeta[] = (await localforage.getItem(DRAFTS_LIST_KEY)) || [];
  const newList = list.filter(d => d.draft_id !== draft_id);
  await localforage.setItem(DRAFTS_LIST_KEY, newList);
  return newList;
}

// ── Components ─────────────────────────────────────────────────────────────────

function PdfThumbnail({ draftId, magazineId }: { draftId?: string, magazineId?: string }) {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    if (draftId) {
      localforage.getItem(`ackadem_pdf_${draftId}`).then((file: any) => {
        if (active && file) {
          createdUrl = URL.createObjectURL(file);
          setUrl(createdUrl);
        }
      });
    } else if (magazineId) {
      fetch(`${API_BASE}/books/view/${magazineId}/`)
        .then(res => res.json())
        .then(data => {
          if (active && data.pdf_url) setUrl(data.pdf_url);
        }).catch(err => console.error("Failed to load thumbnail URL", err));
    }

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [draftId, magazineId]);

  if (!url) return <BookOpen className="w-16 h-16 text-slate-300 group-hover:scale-110 transition-transform duration-500" />;

  return (
    <div className="w-full h-full relative flex items-center justify-center bg-slate-200">
      <div className="w-full h-full absolute inset-0 overflow-hidden flex items-center justify-center">
        <Document file={url} loading={<BookOpen className="w-16 h-16 text-slate-300 animate-pulse" />}>
          <Page 
            pageNumber={1} 
            width={320} 
            renderTextLayer={false} 
            renderAnnotationLayer={false}
            className="shadow-md"
          />
        </Document>
      </div>
      {/* Dark gradient overlay for hover effects */}
      <div className="absolute inset-0 bg-black/5 mix-blend-multiply pointer-events-none group-hover:bg-black/0 transition-colors duration-500"></div>
    </div>
  );
}

export function AdminPortalPage() {

  const [file, setFile] = useState<File | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [scripts, setScripts] = useState<string[]>([]);

  // Modal & validation state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [emptyIndices, setEmptyIndices] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [recentDrafts, setRecentDrafts] = useState<DraftMeta[]>([]);
  const [publishedBooks, setPublishedBooks] = useState<PublishedBook[]>([]);

  const [seriesList, setSeriesList] = useState<any[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);
  const [newSeriesTitle, setNewSeriesTitle] = useState('');
  const [newSeriesDesc, setNewSeriesDesc] = useState('');

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [notificationTime, setNotificationTime] = useState('08:00');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  React.useEffect(() => {
    fetch(`${API_BASE}/settings/`)
      .then(res => res.json())
      .then(data => {
        if (data.notification_time) {
          setNotificationTime(data.notification_time);
        }
      }).catch(err => console.error(err));
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch(`${API_BASE}/settings/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_time: notificationTime })
      });
      if (res.ok) {
        setIsSettingsModalOpen(false);
      } else {
        alert("Failed to save settings");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCreateSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/series/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newSeriesTitle, description: newSeriesDesc })
      });
      if (res.ok) {
        const data = await res.json();
        setSeriesList([...seriesList, data]);
        setSelectedSeriesId(data.id);
        setIsSeriesModalOpen(false);
        setNewSeriesTitle('');
        setNewSeriesDesc('');
      } else {
        alert("Failed to create series");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ── Load recent drafts from IndexedDB on mount ─────────────────────────────
  React.useEffect(() => {
    const loadDrafts = async () => {
      const list: DraftMeta[] | null = await localforage.getItem(DRAFTS_LIST_KEY);
      setRecentDrafts(list || []);
    };
    loadDrafts();

    const fetchPublishedBooks = async () => {
      try {
        const res = await fetch(`${API_BASE}/books/`, {
          headers: { 'X-Admin-Request': 'true' }
        });
        if (res.ok) {
          const data = await res.json();
          setPublishedBooks(data.books || []);
        }
      } catch (err) {
        console.error('Failed to fetch published books', err);
      }
    };
    fetchPublishedBooks();

    const fetchSeries = async () => {
      try {
        const res = await fetch(`${API_BASE}/series/`);
        if (res.ok) {
          const data = await res.json();
          setSeriesList(data.series || []);
          if (data.series.length > 0) setSelectedSeriesId(data.series[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch series', err);
      }
    };
    fetchSeries();
  }, []);

  // ── Auto-save to IndexedDB (debounced, 1.5 s) ─────────────────────────────
  // Runs whenever title or scripts change while a draft is active.
  // No network request is made here — purely local.
  React.useEffect(() => {
    if (!draftId || !file) return;

    const handler = setTimeout(async () => {
      await saveDraftToIDB(
        { draft_id: draftId, title, fileName: file.name, pageCount, scripts },
        null, // PDF already saved on initial drop — no need to re-save binary every keystroke
      );
    }, 1500);

    return () => clearTimeout(handler);
  }, [title, scripts, draftId, file, pageCount]);

  // ── Handle PDF drop: create a new draft in IndexedDB ─────────────────────
  const handleUploadComplete = async (uploadedFile: File, pages: number) => {
    const id = generateId();
    const defaultTitle = uploadedFile.name.replace(/\.[^/.]+$/, '');
    const emptyScripts = Array(pages).fill('');

    setFile(uploadedFile);
    setDraftId(id);
    setTitle(defaultTitle);
    setPublishDate('');
    setPageCount(pages);
    setScripts(emptyScripts);

    // Persist immediately to IndexedDB (includes PDF binary)
    await saveDraftToIDB(
      { draft_id: id, title: defaultTitle, fileName: uploadedFile.name, pageCount: pages, scripts: emptyScripts, publishDate: '' },
      uploadedFile,
    );

    // Refresh recent list in UI
    const list: DraftMeta[] | null = await localforage.getItem(DRAFTS_LIST_KEY);
    setRecentDrafts(list || []);
  };

  // ── Resume a saved draft from IndexedDB ───────────────────────────────────
  const handleResumeDraft = async (meta: DraftMeta) => {
    try {
      const data: DraftData | null = await localforage.getItem(`ackadem_draft_${meta.draft_id}`);
      const savedFile: File | null = await localforage.getItem(`ackadem_pdf_${meta.draft_id}`);

      if (!data || !savedFile) {
        alert('Draft data not found in browser storage. It may have been cleared.');
        return;
      }

      setFile(savedFile);
      setDraftId(data.draft_id);
      setTitle(data.title);
      setPublishDate(data.publishDate || '');
      setPageCount(data.pageCount);
      setScripts(data.scripts);
    } catch (err) {
      console.error('Failed to load draft', err);
    }
  };

  const handleUnpublish = async (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    setIsSubmitting(true);
    try {
      // 1. Fetch full details from backend
      const res = await fetch(`${API_BASE}/books/view/${bookId}/`);
      if (!res.ok) throw new Error("Failed to fetch book details");
      const data = await res.json();
      
      // 2. Fetch the actual PDF Blob
      const pdfRes = await fetch(data.pdf_url);
      if (!pdfRes.ok) {
        if (window.confirm("The original PDF file is missing or corrupted on the server. Do you want to permanently delete this book without recovering it to your drafts?")) {
          await fetch(`${API_BASE}/books/view/${bookId}/`, { method: 'DELETE' });
          setPublishedBooks(prev => prev.filter(b => b.magazine_id !== bookId));
        }
        return;
      }
      const pdfBlob = await pdfRes.blob();
      
      // 3. Safely save as a Draft in local IndexedDB. 
      // We PRESERVE the original server UUID so if they re-publish, existing buyers get the update!
      const newDraftId = bookId; 
      const fileName = data.pdf_url.split('/').pop() || 'Unpublished_Document.pdf';
      const fileObj = new File([pdfBlob], fileName, { type: 'application/pdf' });
      
      const newDraft = {
        draft_id: newDraftId,
        title: data.title,
        fileName: fileObj.name,
        pageCount: data.total_pages,
        lastModified: Date.now(),
        publishDate: data.publish_date || ''
      };
      
      await localforage.setItem(`ackadem_pdf_${newDraftId}`, fileObj);
      await localforage.setItem(`ackadem_draft_${newDraftId}`, {
        ...newDraft,
        scripts: data.scripts
      });
      
      const existingDrafts = await localforage.getItem<any[]>('ackadem_drafts') || [];
      await localforage.setItem('ackadem_drafts', [newDraft, ...existingDrafts]);
      
      // 4. Delete the published book from the backend server
      await fetch(`${API_BASE}/books/view/${bookId}/`, { method: 'DELETE' });
      
      // 5. Instantly refresh the UI
      setRecentDrafts([newDraft, ...existingDrafts]);
      setPublishedBooks(prev => prev.filter(b => b.magazine_id !== bookId));
      
    } catch (err) {
      console.error("Unpublish failed", err);
      alert("Failed to unpublish. Check console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDraft = async (e: React.MouseEvent, draft_id: string) => {
    e.stopPropagation();
    const newList = await deleteDraftFromIDB(draft_id);
    setRecentDrafts(newList);
  };

  const handleDiscard = () => {
    setFile(null);
    setDraftId(null);
    setPageCount(0);
    setTitle('');
    setScripts([]);
  };

  const handleScriptChange = (index: number, value: string) => {
    const newScripts = [...scripts];
    newScripts[index] = value;
    setScripts(newScripts);
  };

  const validateAndSubmit = () => {
    if (!selectedSeriesId) {
      alert("Please select or create a Series before publishing.");
      return;
    }
    
    if (!publishDate) {
      alert("Publish Date is mandatory. Please pick a date before publishing.");
      return;
    }

    const empty = scripts
      .map((script, index) => (script.trim() === '' ? index : -1))
      .filter((index) => index !== -1);

    if (empty.length > 0) {
      setEmptyIndices(empty);
      setIsModalOpen(true);
    } else {
      executeSubmission();
    }
  };

  // ── Publish: first API call — uploads everything to Django backend ─────────
  const executeSubmission = async () => {
    setIsModalOpen(false);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      if (file) formData.append('pdf_file', file);
      formData.append('title', title);
      formData.append('scripts', JSON.stringify(scripts));
      if (selectedSeriesId) formData.append('series_id', selectedSeriesId);
      if (publishDate) formData.append('publish_date', publishDate);
      
      // If we are editing an unpublished draft that originally came from the server (UUID format)
      if (draftId && draftId.length > 30) {
        formData.append('magazine_id', draftId);
      }

      const res = await fetch(`${API_BASE}/books/upload/`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(JSON.stringify(errData));
      }

      // Clean up the draft from IndexedDB now that it's published
      if (draftId) {
        await localforage.removeItem(`ackadem_draft_${draftId}`);
        await localforage.removeItem(`ackadem_pdf_${draftId}`);
        const list: DraftMeta[] | null = await localforage.getItem(DRAFTS_LIST_KEY);
        if (list) {
          await localforage.setItem(DRAFTS_LIST_KEY, list.filter((d) => d.draft_id !== draftId));
        }
      }

      setIsSuccess(true);
    } catch (error) {
      console.error('Submission failed', error);
      alert('Failed to publish. Please check the console for details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── OCR: extract text from empty pages using pdf.js ──────────────────────
  const handleRunOCR = async () => {
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    const newScripts = [...scripts];

    try {
      const loadingTask = pdfjs.getDocument(fileUrl);
      const pdf = await loadingTask.promise;

      for (const idx of emptyIndices) {
        try {
          const page = await pdf.getPage(idx + 1);
          const textContent = await page.getTextContent();
          const textStrings = textContent.items.map((item: any) => item.str);
          const fullText = textStrings.join(' ');

          newScripts[idx] = fullText.trim() ? fullText : '[No text detected on this page]';
        } catch (err) {
          console.error(`Failed to extract text for page ${idx + 1}`, err);
          newScripts[idx] = '[Extraction failed]';
        }
      }

      setScripts(newScripts);
      setIsModalOpen(false);
      setEmptyIndices([]);
    } catch (err) {
      console.error('Failed to load PDF for extraction batch', err);
    } finally {
      URL.revokeObjectURL(fileUrl);
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-accent p-8 flex items-center justify-center">
        <Card className="max-w-md w-full p-8 text-center border-green-200 bg-green-50">
          <div className="mx-auto bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-900 mb-2">Magazine Published!</h2>
          <p className="text-green-700 mb-8">The digital flipbook and native TTS scripts have been successfully deployed.</p>
          <Button onClick={() => window.location.reload()} fullWidth className="bg-green-700 hover:bg-green-800">
            Upload Another Issue
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">New Digital Publication</h2>
              <p className="text-slate-500 mt-2 text-base sm:text-lg">Upload the magazine and configure narration scripts.</p>
            </div>
            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2.5 bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-brand-dark hover:border-brand-dark hover:shadow transition-all rounded-xl ml-4"
              title="Notification Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
          {file && (
            <button 
              onClick={handleDiscard} 
              className="flex items-center px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 rounded-lg shadow-sm transition-all"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> 
              Back to Library
            </button>
          )}
      </div>

      <div className="space-y-8">
          {/* Step 1: Upload */}
          <section>
            <div className="flex items-center mb-4">
              <div className="bg-brand-dark/10 text-brand-dark rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3">1</div>
              <h3 className="text-xl font-semibold text-slate-800">Source Document</h3>
            </div>
            <div className={`transition-all duration-500 ${file ? 'flex flex-col gap-6' : ''}`}>
              {file && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 md:p-6 relative overflow-hidden group hover:border-brand-dark/30 transition-colors">
                    {/* Decorative accent line */}
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-dark rounded-l-xl"></div>
                    
                    <div className="flex flex-col gap-6 pl-2">
                      
                      {/* Left: File Info & Title Input */}
                      <div className="flex items-start gap-4 w-full">
                        <div className="hidden md:flex w-14 h-14 bg-brand-dark/5 rounded-xl border border-brand-dark/10 items-center justify-center shrink-0 mt-1">
                          <FileText className="w-7 h-7 text-brand-dark" />
                        </div>
                        <div className="flex-1 w-full space-y-4">
                          
                          <div className="w-full">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Publication Title</label>
                            <input
                              type="text"
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                              placeholder="e.g. Tell Me More - May 2026"
                              className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border-transparent focus:border-brand-dark focus:ring-2 focus:ring-brand-dark/20 rounded-lg px-3 py-2 text-lg font-bold text-slate-800 transition-all outline-none"
                            />
                          </div>

                          <div className="flex flex-col lg:flex-row gap-4">
                            <div className="flex-1">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex justify-between">
                                <span>Series</span>
                                <button onClick={() => setIsSeriesModalOpen(true)} className="text-brand-dark hover:underline">New</button>
                              </label>
                              <select 
                                value={selectedSeriesId}
                                onChange={(e) => setSelectedSeriesId(e.target.value)}
                                className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border-transparent focus:border-brand-dark focus:ring-2 focus:ring-brand-dark/20 rounded-lg px-3 py-[0.6rem] text-base font-bold text-slate-800 transition-all outline-none"
                              >
                                {seriesList.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                              </select>
                            </div>

                            <div className="w-full lg:w-1/4">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Publish Date <span className="text-red-500">*</span></label>
                              <input
                                type="date"
                                value={publishDate}
                                onChange={(e) => setPublishDate(e.target.value)}
                                className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border-transparent focus:border-brand-dark focus:ring-2 focus:ring-brand-dark/20 rounded-lg px-3 py-2 text-base font-bold text-slate-800 transition-all outline-none h-[44px]"
                              />
                            </div>

                            {/* Actions right next to the date on large screens */}
                            <div className="flex items-end gap-3 w-full lg:w-auto shrink-0 lg:pt-0">
                              <Button variant="secondary" onClick={() => window.open(`/reader/${draftId}?preview=true`, '_blank')} className="border-slate-200 shadow-sm hover:border-slate-300 h-[44px]">
                                Preview
                              </Button>
                              <Button 
                                onClick={validateAndSubmit} 
                                disabled={isSubmitting} 
                                className="bg-brand-dark hover:bg-brand-dark/90 shadow-sm hover:shadow h-[44px]"
                              >
                                {isSubmitting ? (
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                ) : (
                                  <Send className="w-4 h-4 mr-2" />
                                )}
                                {isSubmitting ? 'Publishing...' : 'Publish'}
                              </Button>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 px-1 pt-1">
                            <span className="flex items-center text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                              <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                              {pageCount} Pages Extracted
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-sm text-slate-500 font-medium truncate" title={file.name}>{file.name}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-sm text-slate-500 font-medium whitespace-nowrap">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className={file ? "hidden" : "w-full"}>
                <DropzoneUploader
                  file={file}
                  pageCount={pageCount}
                  onUploadSuccess={handleUploadComplete}
                  onClear={handleDiscard}
                />
              </div>
            </div>

            {!file && (
              <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center mb-4">
                  <History className="w-5 h-5 text-slate-400 mr-2" />
                  <h4 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Recent Sessions</h4>
                </div>
                
                {recentDrafts.length > 0 ? (
                  <div className="flex overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar">
                    {recentDrafts.map(draft => (
                      <div
                        key={draft.draft_id}
                        onClick={() => handleResumeDraft(draft)}
                        className="min-w-[280px] snap-center shrink-0 bg-white border border-slate-200 rounded-xl p-4 hover:border-brand-dark hover:shadow-md cursor-pointer transition-all group flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <h5 className="font-semibold text-slate-800 truncate pr-2 group-hover:text-brand-dark transition-colors" title={draft.title}>{draft.title}</h5>
                            <button 
                              onClick={(e) => handleDeleteDraft(e, draft.draft_id)}
                              className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete Draft"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-slate-400 truncate mb-4" title={draft.fileName}>{draft.fileName}</p>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                          <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{draft.pageCount} Pages</span>
                          <div className="flex items-center text-xs text-brand-dark font-semibold opacity-0 group-hover:opacity-100 transition-opacity translate-y-1 group-hover:translate-y-0 duration-200">
                            <Play className="w-3.5 h-3.5 mr-1" /> Resume
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                      <FileText className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">No sessions available</p>
                    <p className="text-sm text-slate-400 mt-1 max-w-sm">Upload a new document above to start an editing session. Your drafts will automatically save here.</p>
                  </div>
                )}
              </div>
            )}

            {!file && (
              <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mr-2">
                      <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Published Series & Issues</h4>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => setIsSeriesModalOpen(true)}
                    className="bg-brand-dark hover:bg-brand-dark/90 text-white shadow-sm"
                  >
                    + Create New Series
                  </Button>
                </div>
                
                {seriesList.length > 0 ? (
                  <div className="space-y-8">
                    {seriesList.map(series => {
                      const seriesBooks = publishedBooks.filter(b => b.series_id === series.id);
                      return (
                        <div key={series.id} className="bg-slate-50 rounded-xl p-4 md:p-6 border border-slate-200">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h5 className="font-bold text-lg text-slate-800">{series.title}</h5>
                              <p className="text-sm text-slate-500">{series.description}</p>
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={async () => {
                                if (window.confirm(`Are you sure you want to delete the series "${series.title}"? This will also delete all issues within it.`)) {
                                  try {
                                    const res = await fetch(`${API_BASE}/series/${series.id}/`, { method: 'DELETE' });
                                    if (res.ok) {
                                      setSeriesList(seriesList.filter(s => s.id !== series.id));
                                      setPublishedBooks(publishedBooks.filter(b => b.series_id !== series.id));
                                    }
                                  } catch (e) {
                                    console.error(e);
                                  }
                                }
                              }}
                              className="text-red-500 hover:bg-red-50 hover:text-red-600 border-red-100"
                            >
                              Delete Series
                            </Button>
                          </div>
                          
                          {seriesBooks.length > 0 ? (
                            <div className="flex overflow-x-auto gap-4 pb-2 snap-x hide-scrollbar">
                              {seriesBooks.map(book => (
                                <div key={book.magazine_id} className="w-[200px] md:w-[240px] shrink-0 snap-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group">
                                  <div className="aspect-[3/4] bg-slate-100 border-b border-slate-200 flex items-center justify-center relative overflow-hidden">
                                    <PdfThumbnail magazineId={book.magazine_id} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-end p-4 gap-2">
                                      <Button size="sm" fullWidth onClick={() => window.open(`/reader/${book.magazine_id}?preview=true`, '_blank')} className="bg-white text-slate-900 hover:bg-slate-100 border-transparent shadow-sm hover:shadow">
                                        Preview
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        fullWidth 
                                        onClick={(e) => handleUnpublish(e, book.magazine_id)} 
                                        disabled={isSubmitting}
                                        className="bg-slate-800 text-red-400 hover:bg-red-500 hover:text-white border-transparent transition-colors"
                                      >
                                        Unpublish
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="p-3 flex-1 flex flex-col justify-between">
                                    <div>
                                      <h5 className="font-semibold text-sm text-slate-800 line-clamp-2" title={book.title}>{book.title}</h5>
                                    </div>
                                    <div className="flex flex-col gap-1 mt-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-slate-500 font-medium">Pub: {book.publish_date ? new Date(book.publish_date).toLocaleDateString() : 'N/A'}</span>
                                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{book.total_pages} Pages</span>
                                      </div>
                                      <span className="text-[10px] text-slate-400">Upd: {new Date(book.updated_at || book.created_at).toLocaleDateString()}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="bg-white border border-dashed border-slate-200 rounded-lg p-6 text-center">
                              <p className="text-sm text-slate-400 italic">No issues published in this series yet.</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                      <BookOpen className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">No series created yet</p>
                    <p className="text-sm text-slate-400 mt-1 max-w-sm">Upload a new document above and create your first series.</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Step 2: Scripts (Only visible if file uploaded) */}
          {file && pageCount > 0 && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center mb-4">
                <div className="bg-brand-dark/10 text-brand-dark rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3">2</div>
                <h3 className="text-xl font-semibold text-slate-800">Page Automation Scripts</h3>
              </div>

              <ScriptFieldGrid
                pageCount={pageCount}
                scripts={scripts}
                onChange={handleScriptChange}
                onClearAll={() => setScripts(Array(pageCount).fill(''))}
                onUpdateAll={(newScripts) => setScripts(newScripts)}
                file={file}
              />
            </section>
          )}
        </div>
      {isSeriesModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100">
            <form onSubmit={handleCreateSeries} className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Create Series</h3>
              <p className="text-sm text-slate-500 mb-6">Add a new magazine series collection.</p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Title</label>
                  <input 
                    required
                    type="text" 
                    value={newSeriesTitle}
                    onChange={(e) => setNewSeriesTitle(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
                  <textarea 
                    value={newSeriesDesc}
                    onChange={(e) => setNewSeriesDesc(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark resize-none"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setIsSeriesModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-brand-dark hover:bg-brand-dark/90 text-white"
                >
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center">
                <Settings className="w-4 h-4 mr-2 text-brand-dark" />
                System Settings
              </h3>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveSettings} className="p-6">
              <p className="text-sm text-slate-500 mb-6">Configure the default time of day that users are notified about newly scheduled magazines.</p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Notification Time (Local)</label>
                  <input 
                    required
                    type="time" 
                    value={notificationTime}
                    onChange={(e) => setNotificationTime(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setIsSettingsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSavingSettings}
                  className="flex-1 bg-brand-dark hover:bg-brand-dark/90 text-white"
                >
                  {isSavingSettings ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      <OCRConfirmationModal
        isOpen={isModalOpen}
        emptyIndices={emptyIndices}
        onProceedBlank={executeSubmission}
        onRunOCR={handleRunOCR}
        onCancel={() => setIsModalOpen(false)}
      />
    </AdminLayout>
  );
}


import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../components/shared/Elements';
import { BookOpen, Play, Calendar, Lock, Search, Bell, Layers, Library, ChevronRight, CheckCircle, ArrowLeft } from 'lucide-react';
import { RedemptionModal } from '../components/shared/RedemptionModal';
import { Document, Page } from 'react-pdf';

const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000/api`;

interface Series {
  id: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  created_at: string;
}

interface PublishedBook {
  magazine_id: string;
  series_id: string;
  title: string;
  total_pages: number;
  publish_date: string;
  created_at: string;
  updated_at: string;
}

interface ReadingProgress {
  [magazine_id: string]: number;
}

interface InAppNotification {
  id: string;
  series: string;
  book: string;
  message: string;
  created_at: string;
}

function PdfThumbnail({ magazineId }: { magazineId: string }) {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/books/view/${magazineId}/`)
      .then(res => res.json())
      .then(data => {
        if (active && data.pdf_url) setUrl(data.pdf_url);
      }).catch(err => console.error("Failed to load thumbnail URL", err));

    return () => { active = false; };
  }, [magazineId]);

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
      <div className="absolute inset-0 bg-black/5 mix-blend-multiply pointer-events-none group-hover:bg-black/0 transition-colors duration-500"></div>
    </div>
  );
}

export function ClientLibraryPage() {
  const navigate = useNavigate();
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [books, setBooks] = useState<PublishedBook[]>([]);
  const [progress, setProgress] = useState<ReadingProgress>({});
  const [unlockedSeries, setUnlockedSeries] = useState<string[]>([]);
  const [subscriptions, setSubscriptions] = useState<Record<string, string>>({});
  
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCheckingAccess, setIsCheckingAccess] = useState<string | null>(null);

  // Redemption Modal State
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [redeemModalTitle, setRedeemModalTitle] = useState<string | undefined>(undefined);
  const [redeemModalMessage, setRedeemModalMessage] = useState<React.ReactNode | undefined>(undefined);

  useEffect(() => {
    const saved = localStorage.getItem('ackadem_unlocked_series');
    if (saved) {
      try {
        setUnlockedSeries(JSON.parse(saved));
      } catch (e) {}
    }
    
    const fetchAllData = async () => {
      try {
        const [booksRes, seriesRes, notifRes] = await Promise.all([
          fetch(`${API_BASE}/books/`),
          fetch(`${API_BASE}/series/`),
          fetch(`${API_BASE}/notifications/`)
        ]);

        let fetchedBooks = [];
        if (booksRes.ok) {
          const data = await booksRes.json();
          fetchedBooks = data.books || [];
          setBooks(fetchedBooks);
        }
        
        if (seriesRes.ok) {
           const data = await seriesRes.json();
           setSeriesList(data.series);
        }
        
        if (notifRes.ok) {
           const data = await notifRes.json();
           setNotifications(data.notifications);
        }
        
        // Fetch progress
        if (fetchedBooks.length > 0) {
            const progressMap: ReadingProgress = {};
            await Promise.all(
              fetchedBooks.map(async (book: PublishedBook) => {
                try {
                  const progRes = await fetch(`${API_BASE}/users/progress/${book.magazine_id}/`);
                  if (progRes.ok) {
                    const progData = await progRes.json();
                    progressMap[book.magazine_id] = progData.page_index || 0;
                  }
                } catch {
                  // ignore
                }
              })
            );
            setProgress(progressMap);
        }
        
        // Fetch subscriptions
        try {
          const isDev = import.meta.env.VITE_ENVIRONMENT === 'development';
          const subsRes = await fetch(`${API_BASE}/codes/subscriptions/${isDev ? '?user_email=anonymous@example.com' : ''}`);
          if (subsRes.ok) {
             const subsData = await subsRes.json();
             setSubscriptions(subsData);
          }
        } catch(e) { console.error(e) }
        
      } catch (err) {
        console.error('Failed to fetch data', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, []);

  // ── Browser Notification Setup & Polling ──────────────────────────────────
  useEffect(() => {
    // 1. Request Permission if not already asked
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // 2. Polling function
    const pollNotifications = async () => {
      try {
        const res = await fetch(`${API_BASE}/notifications/`);
        if (res.ok) {
          const data = await res.json();
          const fetchedNotifs: InAppNotification[] = data.notifications || [];
          
          setNotifications(fetchedNotifs);

          const seenIdsStr = localStorage.getItem('ackadem_seen_notifs');
          if (!seenIdsStr) {
            // First time loading: mark all existing as seen silently to avoid spam
            const allIds = fetchedNotifs.map(n => n.id);
            localStorage.setItem('ackadem_seen_notifs', JSON.stringify(allIds));
            return;
          }

          let seenIds: string[] = [];
          try { seenIds = JSON.parse(seenIdsStr); } catch(e) {}

          // Fetch current subscriptions to check if user owns the series before pushing OS notification
          let currentSubs: Record<string, string> = {};
          try {
            const isDev = import.meta.env.VITE_ENVIRONMENT === 'development';
            const subsRes = await fetch(`${API_BASE}/codes/subscriptions/${isDev ? '?user_email=anonymous@example.com' : ''}`);
            if (subsRes.ok) currentSubs = await subsRes.json();
          } catch(e) {}

          let shouldRefetch = false;
          fetchedNotifs.forEach(n => {
            if (!seenIds.includes(n.id)) {
              shouldRefetch = true;
              seenIds.push(n.id);
              
              // Only trigger a desktop push notification if the user is subscribed to this specific series
              if (currentSubs[n.series]) {
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification('Ackadem Library', {
                    body: n.message,
                  });
                }
              }
            }
          });

          if (shouldRefetch) {
            localStorage.setItem('ackadem_seen_notifs', JSON.stringify(seenIds));
            
            // Refetch books so the newly released issue instantly appears in the UI!
            try {
              const booksRes = await fetch(`${API_BASE}/books/`);
              if (booksRes.ok) {
                const bData = await booksRes.json();
                setBooks(bData.books || []);
              }
            } catch (e) {
              console.error('Failed to refetch books', e);
            }
          }
        }
      } catch (err) {
        console.error('Notification polling failed', err);
      }
    };

    // Run once after 5 seconds to catch any immediately new ones, then every 60s
    const initialTimeout = setTimeout(pollNotifications, 5000);
    const intervalId = setInterval(pollNotifications, 60000);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center">
           <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-dark rounded-full animate-spin mb-4" />
           <p className="text-slate-500 font-medium">Loading your library...</p>
        </div>
      </div>
    );
  }

  const handleStartReading = async (magazineId: string) => {
    setIsCheckingAccess(magazineId);
    try {
      const isDev = import.meta.env.VITE_ENVIRONMENT === 'development';
      const bodyPayload: any = { series_id: selectedSeriesId, magazine_id: magazineId };
      if (isDev) {
        bodyPayload.user_email = 'anonymous@example.com';
      }

      const res = await fetch(`${API_BASE}/codes/check/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(bodyPayload)
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.is_expired) {
          setRedeemModalTitle("Subscription Expired");
          setRedeemModalMessage(
            <p>
              Your subscription to this series has expired. Please enter a new code to renew your access, or wait for the admin to extend it.
            </p>
          );
          setIsRedeemModalOpen(true);
          return;
        } else if (data.has_access === false) {
          setRedeemModalTitle("Access Denied");
          setRedeemModalMessage(
            <p>
              {data.message || "Your access to this series could not be verified or was revoked. Please enter a new code below."}
            </p>
          );
          setIsRedeemModalOpen(true);
          return;
        }
      } else {
         alert('Unable to verify your access at this time. Please try again or log in again.');
         return;
      }
      
      navigate(`/reader/${magazineId}`);
    } catch (err) {
      console.error("Failed to check access", err);
      alert('Network error: Failed to verify access.');
    } finally {
      setIsCheckingAccess(null);
    }
  };

  const selectedSeries = seriesList.find(s => s.id === selectedSeriesId);
  const seriesBooks = books.filter(b => b.series_id === selectedSeriesId);
  const filteredBooks = seriesBooks.filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const isSeriesUnlocked = selectedSeriesId && unlockedSeries.includes(selectedSeriesId);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center">
            <Library className="w-6 h-6 text-brand-dark mr-2" />
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Ackadem Library</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-slate-500 hover:text-brand-dark hover:bg-slate-100 rounded-full transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-3 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-sm font-semibold text-slate-700">Notifications</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-sm text-slate-500 text-center">No new notifications.</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className="p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <p className="text-sm text-slate-700 font-medium">{n.message}</p>
                        <p className="text-xs text-slate-400 mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Series List */}
        <div className="w-64 lg:w-80 bg-white border-r border-slate-200 overflow-y-auto shrink-0 hidden md:block">
          <div className="p-4 border-b border-slate-100 bg-white sticky top-0 z-10">
            <button 
              onClick={() => setSelectedSeriesId(null)}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border font-bold transition-all ${
                selectedSeriesId === null 
                  ? 'bg-brand-dark text-white border-brand-dark shadow-md' 
                  : 'bg-white text-slate-600 border-slate-200 hover:border-brand-dark hover:text-brand-dark hover:bg-slate-50'
              }`}
            >
              <Library className="w-4 h-4" /> All Series
            </button>
          </div>

          <div className="p-3">
            {/* Subscribed Series */}
            {(() => {
              const subscribedSeries = seriesList.filter(s => unlockedSeries.includes(s.id));
              if (subscribedSeries.length === 0) return null;
              return (
                <div className="mb-6 animate-in fade-in slide-in-from-left-2 duration-300">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-600 flex items-center mb-3 px-2">
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Subscribed
                  </h3>
                  <div className="space-y-1">
                    {subscribedSeries.map(series => (
                      <button
                        key={series.id}
                        onClick={() => setSelectedSeriesId(series.id)}
                        className={`w-full text-left px-3 py-3 rounded-lg flex items-center justify-between transition-all ${
                          selectedSeriesId === series.id 
                            ? 'bg-emerald-50 border border-emerald-100 shadow-sm' 
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <div className="flex-1 pr-2">
                          <h3 className={`font-bold text-sm line-clamp-1 ${selectedSeriesId === series.id ? 'text-emerald-900' : 'text-slate-700'}`}>
                            {series.title}
                          </h3>
                        </div>
                        {selectedSeriesId === series.id && <ChevronRight className="w-4 h-4 text-emerald-500 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Unsubscribed Series */}
            {(() => {
              const unsubscribedSeries = seriesList.filter(s => !unlockedSeries.includes(s.id));
              if (unsubscribedSeries.length === 0) return null;
              return (
                <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center mb-3 px-2">
                    <Lock className="w-3.5 h-3.5 mr-1.5" /> Available to Buy
                  </h3>
                  <div className="space-y-1">
                    {unsubscribedSeries.map(series => (
                      <button
                        key={series.id}
                        onClick={() => setSelectedSeriesId(series.id)}
                        className={`w-full text-left px-3 py-3 rounded-lg flex items-center justify-between transition-all ${
                          selectedSeriesId === series.id 
                            ? 'bg-indigo-50 border border-indigo-100 shadow-sm' 
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <div className="flex-1 pr-2">
                          <h3 className={`font-bold text-sm line-clamp-1 ${selectedSeriesId === series.id ? 'text-indigo-900' : 'text-slate-600'}`}>
                            {series.title}
                          </h3>
                        </div>
                        {selectedSeriesId === series.id && <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            
            {seriesList.length === 0 && (
              <div className="p-4 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl m-2">
                No series available yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Magazines within Series */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8 relative">
          {selectedSeries ? (
            <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Back Button */}
              <button 
                onClick={() => setSelectedSeriesId(null)}
                className="mb-6 inline-flex items-center text-sm font-semibold text-slate-600 hover:text-brand-dark transition-colors bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm hover:shadow hover:border-slate-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to All Series
              </button>

              {/* Series Header */}
              <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50 to-white rounded-full -mr-20 -mt-20 opacity-50"></div>
                <div className="relative z-10">
                  <span className="text-xs font-bold tracking-wider text-indigo-500 uppercase mb-2 block">Series Overview</span>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">{selectedSeries.title}</h2>
                  <p className="text-slate-500 mt-2 max-w-2xl text-sm leading-relaxed">{selectedSeries.description}</p>
                </div>
                <div className="relative z-10 shrink-0 w-full md:w-auto">
                  {!isSeriesUnlocked ? (
                    <Button 
                      onClick={() => {
                        setRedeemModalTitle(`Unlock ${selectedSeries.title}`);
                        setRedeemModalMessage(undefined);
                        setIsRedeemModalOpen(true);
                      }}
                      className="bg-slate-900 hover:bg-black text-white w-full md:w-auto shadow-md"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Redeem Access Code
                    </Button>
                  ) : (
                    <div className="inline-flex items-center px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-semibold">
                      <Lock className="w-4 h-4 mr-2" /> Subscription Active
                    </div>
                  )}
                </div>
              </div>

              {/* Filter */}
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">Issues in this Series</h3>
                <div className="relative w-full max-w-xs hidden sm:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search issues..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-dark focus:border-brand-dark text-sm"
                  />
                </div>
              </div>

              {/* Issues Grid */}
              {(() => {
                const now = new Date();
                const visibleBooks = filteredBooks.filter(book => {
                  const pubDate = new Date(book.publish_date);

                  const subStartDateStr = subscriptions[selectedSeries.id];
                  if (isSeriesUnlocked && subStartDateStr) {
                    const subStartDate = new Date(subStartDateStr);
                    pubDate.setDate(1); // trunc to month start
                    if (pubDate < subStartDate) return false; // hide older issues
                  } else if (!isSeriesUnlocked) {
                    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    pubDate.setDate(1);
                    if (pubDate < currentMonthStart) return false; // hide past issues from unsubscribed users
                  }
                  return true;
                });

                if (visibleBooks.length === 0) {
                  return (
                    <Card className="text-center p-12 border-dashed border-2">
                      <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-slate-700">No issues found</h3>
                      <p className="text-sm text-slate-500 mt-1">Check back later for new releases in this series.</p>
                    </Card>
                  );
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {visibleBooks.map((book) => {
                      const currentPage = progress[book.magazine_id] || 0;
                      const hasStarted = currentPage > 0;
                      const progressPercentage = Math.round((currentPage / Math.max(1, book.total_pages - 1)) * 100);

                      return (
                        <Card key={book.magazine_id} className="flex flex-col hover:shadow-lg transition-all border-slate-200 group bg-white hover:-translate-y-1 duration-300">
                          <div className="aspect-[3/4] bg-slate-100 flex items-center justify-center border-b border-slate-200 relative overflow-hidden">
                            <PdfThumbnail magazineId={book.magazine_id} />
                            
                            {!isSeriesUnlocked && (
                              <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center transition-all group-hover:bg-slate-900/60">
                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                                  <Lock className="w-5 h-5 text-slate-800" />
                                </div>
                              </div>
                            )}

                            {isSeriesUnlocked && hasStarted && (
                              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-200">
                                <div 
                                  className="h-full bg-brand-dark transition-all duration-500" 
                                  style={{ width: `${Math.min(100, progressPercentage)}%` }} 
                                />
                              </div>
                            )}
                          </div>
                          <div className="p-4 flex-1 flex flex-col">
                            <h4 className="font-bold text-slate-800 line-clamp-2 mb-1" title={book.title}>{book.title}</h4>
                            <div className="flex items-center text-[11px] font-medium text-slate-400 mb-4">
                              <Calendar className="w-3 h-3 mr-1" />
                              {book.publish_date ? new Date(book.publish_date).toLocaleDateString() : new Date(book.created_at).toLocaleDateString()}
                            </div>
                            <div className="mt-auto">
                              {isSeriesUnlocked ? (
                                <Button 
                                  fullWidth 
                                  size="sm"
                                  onClick={() => handleStartReading(book.magazine_id)}
                                  variant={hasStarted ? 'secondary' : 'primary'}
                                  disabled={isCheckingAccess === book.magazine_id}
                                  className={hasStarted ? 'border-brand-dark text-brand-dark hover:bg-brand-dark hover:text-white' : 'bg-brand-dark text-white'}
                                >
                                  {isCheckingAccess === book.magazine_id ? (
                                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5 mr-1.5" />
                                  )}
                                  {isCheckingAccess === book.magazine_id ? 'Checking...' : (hasStarted ? `Resume Pg ${currentPage}` : 'Read Issue')}
                                </Button>
                              ) : (
                                <Button 
                                  fullWidth 
                                  size="sm"
                                  onClick={() => {
                                    setRedeemModalTitle(`Unlock ${selectedSeries.title}`);
                                    setRedeemModalMessage(undefined);
                                    setIsRedeemModalOpen(true);
                                  }}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700"
                                >
                                  Subscribe to Series
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2">Library Overview</h2>
                <p className="text-slate-500">Explore all available series. Click on a series to view its published magazines.</p>
              </div>

              {seriesList.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <Layers className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-slate-400">No series available yet.</h2>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {seriesList.map((series) => {
                    const isUnlocked = unlockedSeries.includes(series.id);
                    const seriesBooksCount = books.filter(b => b.series_id === series.id).length;

                    return (
                      <Card 
                        key={series.id} 
                        className="flex flex-col hover:shadow-xl transition-all border-slate-200 group bg-white hover:-translate-y-1 duration-300 overflow-hidden relative cursor-pointer"
                        onClick={() => setSelectedSeriesId(series.id)}
                      >
                        <div className="p-6 flex-1 flex flex-col">
                          <div className="flex justify-between items-start mb-4">
                            <div className="bg-brand-dark/5 p-3 rounded-xl border border-brand-dark/10 group-hover:scale-110 group-hover:bg-brand-dark/10 transition-all">
                              <Layers className="w-6 h-6 text-brand-dark" />
                            </div>
                            {isUnlocked ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">
                                <CheckCircle className="w-3 h-3 mr-1" /> Subscribed
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                                <Lock className="w-3 h-3 mr-1" /> Available
                              </span>
                            )}
                          </div>
                          
                          <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-brand-dark transition-colors">{series.title}</h3>
                          <p className="text-sm text-slate-500 line-clamp-3 flex-1 mb-6 leading-relaxed">
                            {series.description || 'No description available for this series.'}
                          </p>

                          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-auto">
                            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md">
                              {seriesBooksCount} {seriesBooksCount === 1 ? 'Issue' : 'Issues'}
                            </span>
                            <div className="flex items-center text-sm font-semibold text-brand-dark group-hover:translate-x-1 transition-transform">
                              View Series <ChevronRight className="w-4 h-4 ml-1" />
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <RedemptionModal 
        isOpen={isRedeemModalOpen}
        onClose={() => setIsRedeemModalOpen(false)}
        magazineId={selectedSeriesId || ''} 
        magazineTitle={selectedSeries?.title || ''}
        customTitle={redeemModalTitle}
        customMessage={redeemModalMessage}
        onSuccess={async () => {
          setIsRedeemModalOpen(false);
          if (selectedSeriesId) {
             const updated = [...unlockedSeries, selectedSeriesId];
             setUnlockedSeries(updated);
             localStorage.setItem('ackadem_unlocked_series', JSON.stringify(updated));
             
             try {
               const isDev = import.meta.env.VITE_ENVIRONMENT === 'development';
               const subsRes = await fetch(`${API_BASE}/codes/subscriptions/${isDev ? '?user_email=anonymous@example.com' : ''}`);
               if (subsRes.ok) {
                 const subsData = await subsRes.json();
                 setSubscriptions(subsData);
               }
             } catch(e) { console.error(e) }

             // Don't auto-navigate to reader, let them pick an issue from the unlocked series!
             alert(`Successfully unlocked ${selectedSeries?.title}! You can now read any issues available in your subscription window.`);
          }
        }}
      />
    </div>
  );
}

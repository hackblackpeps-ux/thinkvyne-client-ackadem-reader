import { useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export function BrowserNotificationWrapper() {
  const seenIdsRef = useRef<Set<number>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    // Only ask for permission if not already denied or granted
    if ("Notification" in window && Notification.permission !== "denied" && Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    const checkForNotifications = async () => {
      try {
        const res = await fetch(`${API_BASE}/notifications/`);
        if (!res.ok) return;
        const data = await res.json();
        const notifs = data.notifications || [];

        // On very first load, we don't want to spam the user with old notifications.
        // We just mark everything currently in the database as "seen".
        if (!initializedRef.current) {
          notifs.forEach((n: any) => seenIdsRef.current.add(n.id));
          initializedRef.current = true;
          return;
        }

        // For subsequent polls, if we see a new ID, we fire a push notification
        notifs.forEach((n: any) => {
          if (!seenIdsRef.current.has(n.id)) {
            seenIdsRef.current.add(n.id);
            
            if ("Notification" in window && Notification.permission === "granted") {
              const notification = new Notification("Ackadem Digital Library", {
                body: n.message,
                icon: "/vite.svg", // Fallback icon
              });
              
              notification.onclick = () => {
                window.focus();
                // Optionally navigate to library when clicked
                if (window.location.pathname !== '/library') {
                    window.location.href = '/library';
                }
              };
            }
          }
        });
      } catch (err) {
        console.error("Failed to check notifications:", err);
      }
    };

    // Check immediately, then poll every 10 seconds
    checkForNotifications();
    const interval = setInterval(checkForNotifications, 10000);

    return () => clearInterval(interval);
  }, []);

  return null; // Logic-only component
}

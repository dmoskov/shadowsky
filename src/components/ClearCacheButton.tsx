import { useState } from "react";

export function ClearCacheButton() {
  const [clearing, setClearing] = useState(false);

  const clearAllCaches = async () => {
    if (clearing) return;

    const confirmed = window.confirm(
      "This will clear all caches and reload the app. Continue?",
    );

    if (!confirmed) return;

    setClearing(true);

    try {
      // 1. Unregister all service workers
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }

      // 2. Clear all caches
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // 3. Clear storage
      localStorage.clear();
      sessionStorage.clear();

      // 4. Clear IndexedDB
      if ("indexedDB" in window) {
        const databases = await indexedDB.databases();
        databases.forEach((db) => {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        });
      }

      // 5. Reload with cache bypass
      window.location.href = window.location.href + "?nocache=" + Date.now();
    } catch (error) {
      console.error("Error clearing caches:", error);
      alert("Error clearing caches. Please try a hard refresh instead.");
      setClearing(false);
    }
  };

  return (
    <button
      onClick={clearAllCaches}
      disabled={clearing}
      className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 9999,
      }}
    >
      {clearing ? "Clearing..." : "🔄 Clear All Caches"}
    </button>
  );
}

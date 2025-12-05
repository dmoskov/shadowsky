import { disableDebug, enableDebug } from "@bsky/shared";

// Export functions to global window object for easy console access
if (typeof window !== "undefined") {
  // @ts-expect-error - Adding to window for console access
  window.enableDebug = () => {
    enableDebug();
    console.log("✅ Debug mode enabled. Refresh the page to see debug logs.");
  };

  // @ts-expect-error - Adding to window for console access
  window.disableDebug = () => {
    disableDebug();
    console.log("❌ Debug mode disabled. Refresh the page to hide debug logs.");
  };

  // @ts-expect-error - Adding to window for console access
  window.toggleDebug = () => {
    const currentState = localStorage.getItem("debug") === "true";
    if (currentState) {
      disableDebug();
      console.log(
        "❌ Debug mode disabled. Refresh the page to hide debug logs.",
      );
    } else {
      enableDebug();
      console.log("✅ Debug mode enabled. Refresh the page to see debug logs.");
    }
  };

  // Performance overlay controls (dev only)
  // @ts-expect-error - Adding to window for console access
  window.enablePerfOverlay = () => {
    localStorage.setItem("showPerfOverlay", "true");
    console.log("📊 Performance overlay enabled. Refresh the page to see it.");
  };

  // @ts-expect-error - Adding to window for console access
  window.disablePerfOverlay = () => {
    localStorage.setItem("showPerfOverlay", "false");
    console.log(
      "📊 Performance overlay disabled. Refresh the page to hide it.",
    );
  };

  // @ts-expect-error - Adding to window for console access
  window.togglePerfOverlay = () => {
    const currentState = localStorage.getItem("showPerfOverlay") === "true";
    localStorage.setItem("showPerfOverlay", (!currentState).toString());
    console.log(
      currentState
        ? "📊 Performance overlay disabled. Refresh the page."
        : "📊 Performance overlay enabled. Refresh the page.",
    );
  };

  // Log instructions on load
  if (localStorage.getItem("debug") === "true") {
    console.log("🐛 Debug mode is currently ENABLED");
    console.log("   To disable: window.disableDebug()");
  } else {
    console.log("🔇 Debug mode is currently DISABLED");
    console.log("   To enable: window.enableDebug()");
  }
  console.log("   To toggle: window.toggleDebug()");
  console.log(
    "📊 Performance overlay: window.togglePerfOverlay() or add ?perf to URL",
  );
}

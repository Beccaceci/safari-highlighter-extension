// Safari Web Annotator - Content Script Orchestrator
// Connects Storage, Highlighter, Canvas Drawer, and Floating Dock.

(function () {
  // Prevent duplicate injection
  if (window.__safariAnnotatorLoaded) return;
  window.__safariAnnotatorLoaded = true;

  let highlighter = null;
  let drawer = null;
  let dock = null;

  function initAnnotator() {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", initAnnotator);
      return;
    }

    try {
      // Initialize engines
      highlighter = new window.SafariAnnotatorHighlighter();
      drawer = new window.SafariAnnotatorDrawer(highlighter);

      // Create and inject toolbar dock directly to root to ensure position:fixed is rock-solid across page scrolling
      dock = document.createElement("safari-annotator-dock");
      const rootContainer = document.documentElement || document.body;
      rootContainer.appendChild(dock);
      dock.setEngines(drawer, highlighter);

      // Rehydrate saved content
      highlighter.restoreSavedHighlights();
      drawer.loadSavedDrawing();

      // Listen for runtime messages from background service worker
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          handleAction(message.action);
          sendResponse({ status: "ok" });
        });
      }
    } catch (err) {
      console.error("Safari Web Annotator initialization error:", err);
    }
  }

  function handleAction(action) {
    if (!dock) return;

    if (action === "toggle-toolbar") {
      dock.style.display = "block";
      if (dock.isMinimized) {
        dock.enlargeDock();
      } else {
        dock.minimizeDock();
      }
    } else if (action === "toggle-drawing") {
      dock.style.display = "block";
      if (dock.isMinimized) dock.enlargeDock();
      const penBtn = dock.shadowRoot.querySelector('.tool-btn[data-tool="pen"]');
      if (penBtn) penBtn.click();
    } else if (action === "toggle-highlighter") {
      dock.style.display = "block";
      if (dock.isMinimized) dock.enlargeDock();
      const hlBtn = dock.shadowRoot.querySelector('.tool-btn[data-tool="highlight"]');
      if (hlBtn) hlBtn.click();
    } else if (action === "toggle-laser") {
      dock.style.display = "block";
      if (dock.isMinimized) dock.enlargeDock();
      const laserBtn = dock.shadowRoot.querySelector('.tool-btn[data-tool="laser"]');
      if (laserBtn) laserBtn.click();
    } else if (action === "clear-page") {
      dock.clearWholePage();
    } else if (action === "save-page") {
      dock.savePageAnnotations();
    } else if (action === "export-snapshot") {
      dock.exportSnapshot();
    }
  }

  // Initialize once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAnnotator);
  } else {
    initAnnotator();
  }
})();

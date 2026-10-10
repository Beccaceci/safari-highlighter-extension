// Safari Web Annotator - Storage Manager
// Handles saving/loading highlights, canvas vector strokes, and user preferences.

(function () {
  const isExtensionStorage = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

  function getPageKey() {
    return window.location.origin + window.location.pathname;
  }

  const Storage = {
    getPageKey,

    // --- Highlights Persistence ---
    async getHighlights() {
      const key = `highlights:${getPageKey()}`;
      try {
        if (isExtensionStorage) {
          const result = await chrome.storage.local.get([key]);
          return result[key] || [];
        } else {
          const raw = localStorage.getItem(key);
          return raw ? JSON.parse(raw) : [];
        }
      } catch (err) {
        console.error("Annotator: Failed to get highlights:", err);
        return [];
      }
    },

    async saveHighlights(highlights) {
      const key = `highlights:${getPageKey()}`;
      try {
        if (isExtensionStorage) {
          await chrome.storage.local.set({ [key]: highlights });
        } else {
          localStorage.setItem(key, JSON.stringify(highlights));
        }
      } catch (err) {
        console.error("Annotator: Failed to save highlights:", err);
      }
    },

    async clearHighlights() {
      const key = `highlights:${getPageKey()}`;
      try {
        if (isExtensionStorage) {
          await chrome.storage.local.remove(key);
        } else {
          localStorage.removeItem(key);
        }
      } catch (err) {
        console.error("Annotator: Failed to clear highlights:", err);
      }
    },

    // --- Drawing Persistence (User explicitly requested "Save drawing" option) ---
    async getDrawing() {
      const key = `drawing:${getPageKey()}`;
      try {
        if (isExtensionStorage) {
          const result = await chrome.storage.local.get([key]);
          return result[key] || null;
        } else {
          const raw = localStorage.getItem(key);
          return raw ? JSON.parse(raw) : null;
        }
      } catch (err) {
        console.error("Annotator: Failed to get drawing:", err);
        return null;
      }
    },

    async saveDrawing(strokes) {
      const key = `drawing:${getPageKey()}`;
      try {
        if (isExtensionStorage) {
          await chrome.storage.local.set({ [key]: strokes });
        } else {
          localStorage.setItem(key, JSON.stringify(strokes));
        }
      } catch (err) {
        console.error("Annotator: Failed to save drawing:", err);
      }
    },

    async clearDrawing() {
      const key = `drawing:${getPageKey()}`;
      try {
        if (isExtensionStorage) {
          await chrome.storage.local.remove(key);
        } else {
          localStorage.removeItem(key);
        }
      } catch (err) {
        console.error("Annotator: Failed to clear drawing:", err);
      }
    },

    // --- User Preferences (Active color, dock position, stroke size) ---
    async getPreferences() {
      const key = "annotator_preferences";
      const defaults = {
        tool: "browse", // 'browse', 'highlight', 'pen', 'marker', 'rect', 'arrow', 'eraser'
        penColor: "#ff3b30",
        highlightColor: "#ffe066",
        strokeWidth: 4,
        dockPosition: null, // { top, left }
        isDockVisible: true
      };

      try {
        if (isExtensionStorage) {
          const result = await chrome.storage.local.get([key]);
          return { ...defaults, ...(result[key] || {}) };
        } else {
          const raw = localStorage.getItem(key);
          return { ...defaults, ...(raw ? JSON.parse(raw) : {}) };
        }
      } catch (err) {
        console.error("Annotator: Failed to get preferences:", err);
        return defaults;
      }
    },

    async savePreferences(prefs) {
      const key = "annotator_preferences";
      try {
        const current = await this.getPreferences();
        const merged = { ...current, ...prefs };
        if (isExtensionStorage) {
          await chrome.storage.local.set({ [key]: merged });
        } else {
          localStorage.setItem(key, JSON.stringify(merged));
        }
      } catch (err) {
        console.error("Annotator: Failed to save preferences:", err);
      }
    }
  };

  window.SafariAnnotatorStorage = Storage;
})();

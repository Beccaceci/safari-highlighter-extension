// Safari Web Annotator - Highlighter Engine
// Handles robust text selection, DOM range wrapping, serialization, persistence, and de-highlighting.

(function () {
  const PRESET_COLORS = {
    yellow: "#ffec8b",
    green: "#bbf7d0",
    blue: "#bae6fd",
    pink: "#fbcfe8",
    orange: "#fed7aa",
    purple: "#e9d5ff"
  };

  class HighlighterEngine {
    constructor() {
      this.activeColor = PRESET_COLORS.yellow;
      this.isHighlightMode = false;
      this.highlights = new Map(); // id -> highlight object
      this.undoStack = [];
      this.redoStack = [];
      this.popoverEl = null;
      this.quickHighlightBtn = null;

      this.init();
    }

    init() {
      this.createPopover();
      this.createQuickHighlightButton();
      this.attachListeners();
      this.injectStyles();
      this.updateCursorStyle();
    }

    injectStyles() {
      if (document.getElementById("safari-annotator-hl-styles")) return;
      const style = document.createElement("style");
      style.id = "safari-annotator-hl-styles";
      style.textContent = `
        mark.safari-annotator-hl {
          background-color: var(--hl-color, #ffec8b);
          color: inherit;
          padding: 0 1px;
          margin: 0;
          border-radius: 2px;
          cursor: pointer;
          transition: filter 0.15s ease, box-shadow 0.15s ease;
          display: inline;
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
        }
        mark.safari-annotator-hl:hover {
          filter: brightness(0.92);
          box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.25);
        }
        mark.safari-annotator-hl.safari-annotator-hl-erase-candidate {
          outline: 2px dashed #ef4444 !important;
          outline-offset: 2px;
          filter: opacity(0.5) !important;
          transition: outline 0.1s ease, filter 0.1s ease;
        }
        /* Active Highlighter Mode Cursors and Text Feedback */
        html.safari-annotator-hl-mode,
        html.safari-annotator-hl-mode * {
          cursor: var(--safari-hl-cursor, text) !important;
        }
        html.safari-annotator-hl-mode ::selection {
          background-color: var(--safari-active-hl-color, #ffec8b) !important;
          color: #000000 !important;
        }
        .safari-annotator-hl-btn {
          position: absolute;
          z-index: 2147483647;
          display: none;
          background: #1e293b;
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          border-radius: 20px;
          padding: 6px 12px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          align-items: center;
          gap: 6px;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }
        .safari-annotator-hl-btn:hover {
          background: #334155;
          transform: translateY(-1px);
        }
        .safari-annotator-hl-popover {
          position: absolute;
          z-index: 2147483647;
          display: none;
          background: #ffffff;
          color: #1e293b;
          border: 1px solid rgba(0, 0, 0, 0.12);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
          border-radius: 12px;
          padding: 8px 10px;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          align-items: center;
          gap: 8px;
        }
        .safari-annotator-hl-popover .color-dot {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .safari-annotator-hl-popover .color-dot:hover {
          transform: scale(1.15);
        }
        .safari-annotator-hl-popover .delete-btn {
          background: #fee2e2;
          color: #ef4444;
          border: none;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .safari-annotator-hl-popover .delete-btn:hover {
          background: #fecaca;
        }
      `;
      document.head.appendChild(style);
    }

    createQuickHighlightButton() {
      const btn = document.createElement("button");
      btn.className = "safari-annotator-hl-btn";
      btn.innerHTML = `<span>🖍️</span><span>Highlight</span>`;
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.highlightSelection();
        this.hideQuickHighlightButton();
      });
      document.body.appendChild(btn);
      this.quickHighlightBtn = btn;
    }

    createPopover() {
      const popover = document.createElement("div");
      popover.className = "safari-annotator-hl-popover";

      // Color swatches
      Object.entries(PRESET_COLORS).forEach(([name, hex]) => {
        const dot = document.createElement("div");
        dot.className = "color-dot";
        dot.style.backgroundColor = hex;
        dot.title = name;
        dot.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this.currentPopoverHlId) {
            this.updateHighlightColor(this.currentPopoverHlId, hex);
          }
          this.hidePopover();
        });
        popover.appendChild(dot);
      });

      // Delete button
      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.innerHTML = `🗑️ Remove`;
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.currentPopoverHlId) {
          this.removeHighlight(this.currentPopoverHlId);
        }
        this.hidePopover();
      });
      popover.appendChild(delBtn);

      document.body.appendChild(popover);
      this.popoverEl = popover;
    }

    attachListeners() {
      document.addEventListener("mouseup", (e) => {
        // Ignore clicks inside our popover or toolbar
        if (e.target.closest(".safari-annotator-hl-popover") || 
            e.target.closest("safari-annotator-dock") || 
            e.target.closest(".safari-annotator-hl-btn")) {
          return;
        }

        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) {
          this.hideQuickHighlightButton();
          return;
        }

        // If in highlight mode, highlight instantly
        if (this.isHighlightMode) {
          this.highlightSelection();
          setTimeout(() => {
            const sel = window.getSelection();
            if (sel) sel.removeAllRanges();
          }, 15);
          this.hideQuickHighlightButton();
          return;
        }

        // Otherwise show quick highlight bubble near selection
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect && rect.width > 0) {
          this.showQuickHighlightButton(rect);
        }
      });

      // Handle clicking an existing highlight
      document.addEventListener("click", (e) => {
        const mark = e.target.closest("mark.safari-annotator-hl");
        if (mark) {
          const id = mark.getAttribute("data-hl-id");
          if (id) {
            this.showPopover(id, mark.getBoundingClientRect());
            return;
          }
        }
        this.hidePopover();
      });

      // Hide popover and quick button on scroll/resize
      window.addEventListener("scroll", () => {
        this.hidePopover();
        this.hideQuickHighlightButton();
      }, { passive: true });
    }

    showQuickHighlightButton(rect) {
      this.quickHighlightBtn.style.top = `${window.scrollY + rect.top - 42}px`;
      this.quickHighlightBtn.style.left = `${window.scrollX + rect.left + rect.width / 2 - 45}px`;
      this.quickHighlightBtn.style.display = "flex";
    }

    hideQuickHighlightButton() {
      if (this.quickHighlightBtn) {
        this.quickHighlightBtn.style.display = "none";
      }
    }

    showPopover(hlId, rect) {
      this.currentPopoverHlId = hlId;
      this.popoverEl.style.top = `${window.scrollY + rect.bottom + 8}px`;
      this.popoverEl.style.left = `${Math.max(10, window.scrollX + rect.left)}px`;
      this.popoverEl.style.display = "flex";
    }

    hidePopover() {
      if (this.popoverEl) {
        this.popoverEl.style.display = "none";
        this.currentPopoverHlId = null;
      }
    }

    getHighlighterCursorSvg(color) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <defs>
          <filter id="cursor-glow" x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.45)"/>
          </filter>
        </defs>
        <g filter="url(#cursor-glow)">
          <!-- Precision I-Beam for pixel-perfect character alignment -->
          <line x1="7" y1="3" x2="7" y2="21" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
          <line x1="4" y1="3" x2="10" y2="3" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
          <line x1="4" y1="21" x2="10" y2="21" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>

          <line x1="7" y1="3" x2="7" y2="21" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="4" y1="3" x2="10" y2="3" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="4" y1="21" x2="10" y2="21" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round"/>

          <!-- Attached Highlighter Pen Badge in active color -->
          <g transform="translate(3, -2)">
            <path d="M16 14 L24 22 C25 23 27 23 28 22 C29 21 29 19 28 18 L20 10 Z" fill="#1e293b" stroke="#ffffff" stroke-width="1.2"/>
            <line x1="20" y1="16" x2="26" y2="22" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M12 10 L16 14 L20 10 L16 6 Z" fill="#64748b" stroke="#ffffff" stroke-width="0.8"/>
            <polygon points="9,7 13,7 9,11" fill="${color}" stroke="#ffffff" stroke-width="1"/>
            <circle cx="10" cy="8" r="1.5" fill="#ffffff"/>
          </g>
        </g>
      </svg>`;
      return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 7 12, text`;
    }

    updateCursorStyle() {
      document.documentElement.style.setProperty("--safari-active-hl-color", this.activeColor);
      document.documentElement.style.setProperty("--safari-hl-cursor", this.getHighlighterCursorSvg(this.activeColor));
    }

    setColor(color) {
      this.activeColor = color;
      this.updateCursorStyle();
    }

    setHighlightMode(enabled) {
      this.isHighlightMode = enabled;
      if (enabled) {
        document.documentElement.classList.add("safari-annotator-hl-mode");
        this.updateCursorStyle();
      } else {
        document.documentElement.classList.remove("safari-annotator-hl-mode");
        this.hideQuickHighlightButton();
      }
    }

    // Wrap the selected range in <mark> elements
    highlightSelection() {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const text = selection.toString();
      if (!text || !text.trim()) return;

      const hlId = "hl_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
      const color = this.activeColor;

      // Extract text nodes in range
      const textNodes = this.getTextNodesInRange(range);
      if (textNodes.length === 0) return;

      // Accurately resolve start and end TextNodes & character offsets
      let startTextNode = null;
      let startOffset = 0;
      if (range.startContainer.nodeType === Node.TEXT_NODE) {
        startTextNode = range.startContainer;
        startOffset = range.startOffset;
      } else {
        startTextNode = textNodes[0];
        startOffset = 0;
      }

      let endTextNode = null;
      let endOffset = 0;
      if (range.endContainer.nodeType === Node.TEXT_NODE) {
        endTextNode = range.endContainer;
        endOffset = range.endOffset;
      } else {
        endTextNode = textNodes[textNodes.length - 1];
        endOffset = endTextNode ? endTextNode.textContent.length : 0;
      }

      const marks = [];

      textNodes.forEach((node) => {
        const isStart = node === startTextNode;
        const isEnd = node === endTextNode;

        let nodeStart = isStart ? startOffset : 0;
        let nodeEnd = isEnd ? endOffset : node.textContent.length;

        nodeStart = Math.max(0, Math.min(nodeStart, node.textContent.length));
        nodeEnd = Math.max(nodeStart, Math.min(nodeEnd, node.textContent.length));

        if (nodeStart >= nodeEnd) return;

        // Skip pure whitespace-only empty slices
        const sliceText = node.textContent.substring(nodeStart, nodeEnd);
        if (!sliceText) return;

        // Split text node
        let targetNode = node;
        if (nodeStart > 0) {
          targetNode = node.splitText(nodeStart);
          nodeEnd -= nodeStart;
        }
        if (nodeEnd < targetNode.textContent.length) {
          targetNode.splitText(nodeEnd);
        }

        // If targetNode is already inside an existing highlight mark, update its color
        if (targetNode.parentElement && targetNode.parentElement.classList.contains("safari-annotator-hl")) {
          targetNode.parentElement.style.setProperty("--hl-color", color);
          targetNode.parentElement.style.backgroundColor = color;
          targetNode.parentElement.setAttribute("data-hl-id", hlId);
          marks.push(targetNode.parentElement);
          return;
        }

        const mark = document.createElement("mark");
        mark.className = "safari-annotator-hl";
        mark.setAttribute("data-hl-id", hlId);
        mark.style.setProperty("--hl-color", color);
        mark.style.backgroundColor = color;

        targetNode.parentNode.insertBefore(mark, targetNode);
        mark.appendChild(targetNode);
        marks.push(mark);
      });

      // Save to memory and storage
      const record = {
        id: hlId,
        text: text.trim(),
        color,
        createdAt: Date.now(),
        anchor: this.createAnchor(range.commonAncestorContainer, text.trim())
      };

      this.highlights.set(hlId, record);
      this.undoStack.push({ type: "add", record });
      this.redoStack = [];
      this.persistHighlights();
    }

    getTextNodesInRange(range) {
      const root = range.commonAncestorContainer;
      const textNodes = [];

      if (root.nodeType === Node.TEXT_NODE) {
        return [root];
      }

      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const tag = parent.tagName.toLowerCase();
            if (tag === "script" || tag === "style" || tag === "noscript" || 
                tag.startsWith("safari-annotator")) {
              return NodeFilter.FILTER_REJECT;
            }
            if (range.intersectsNode(node) && node.textContent.length > 0) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
          }
        }
      );

      let current = walker.nextNode();
      while (current) {
        textNodes.push(current);
        current = walker.nextNode();
      }

      return textNodes;
    }

    createAnchor(container, text) {
      const element = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
      const xpath = this.getElementXPath(element);
      const containerText = element ? element.textContent : "";
      const textOffset = containerText.indexOf(text);

      let prefix = "";
      let suffix = "";
      if (textOffset !== -1) {
        prefix = containerText.substring(Math.max(0, textOffset - 25), textOffset);
        suffix = containerText.substring(textOffset + text.length, textOffset + text.length + 25);
      }

      return { xpath, textOffset, prefix, suffix };
    }

    getElementXPath(element) {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) return "";
      if (element.id) {
        return `//*[@id="${element.id}"]`;
      }
      const parts = [];
      let current = element;
      while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.documentElement) {
        let index = 1;
        let sibling = current.previousElementSibling;
        while (sibling) {
          if (sibling.nodeName === current.nodeName) index++;
          sibling = sibling.previousElementSibling;
        }
        parts.unshift(`${current.nodeName.toLowerCase()}[${index}]`);
        current = current.parentNode;
      }
      return `/${parts.join("/")}`;
    }

    updateHighlightColor(hlId, newColor) {
      const marks = document.querySelectorAll(`mark.safari-annotator-hl[data-hl-id="${hlId}"]`);
      marks.forEach(m => {
        m.style.setProperty("--hl-color", newColor);
        m.style.backgroundColor = newColor;
      });

      const record = this.highlights.get(hlId);
      if (record) {
        record.color = newColor;
        this.persistHighlights();
      }
    }

    removeHighlight(hlId, skipHistory = false) {
      const record = this.highlights.get(hlId);
      if (record && !skipHistory) {
        this.undoStack.push({ type: "remove", record: { ...record } });
        this.redoStack = [];
      }

      const marks = document.querySelectorAll(`mark.safari-annotator-hl[data-hl-id="${hlId}"]`);
      const parents = new Set();

      marks.forEach(mark => {
        const parent = mark.parentNode;
        parents.add(parent);
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
      });

      // Normalize parents to merge split text nodes back together
      parents.forEach(p => p.normalize());

      this.highlights.delete(hlId);
      this.persistHighlights();
    }

    canUndo() {
      return this.undoStack.length > 0;
    }

    canRedo() {
      return this.redoStack.length > 0;
    }

    undo() {
      if (this.undoStack.length === 0) return false;
      const action = this.undoStack.pop();
      if (action.type === "add") {
        this.removeHighlight(action.record.id, true);
        this.redoStack.push(action);
      } else if (action.type === "remove") {
        this.highlights.set(action.record.id, action.record);
        this.renderStoredHighlight(action.record);
        this.persistHighlights();
        this.redoStack.push(action);
      }
      return true;
    }

    redo() {
      if (this.redoStack.length === 0) return false;
      const action = this.redoStack.pop();
      if (action.type === "add") {
        this.highlights.set(action.record.id, action.record);
        this.renderStoredHighlight(action.record);
        this.persistHighlights();
        this.undoStack.push(action);
      } else if (action.type === "remove") {
        this.removeHighlight(action.record.id, true);
        this.undoStack.push(action);
      }
      return true;
    }

    clearAllHighlights() {
      const marks = document.querySelectorAll("mark.safari-annotator-hl");
      const parents = new Set();
      marks.forEach(mark => {
        const parent = mark.parentNode;
        parents.add(parent);
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
      });
      parents.forEach(p => p.normalize());
      this.highlights.clear();
      this.persistHighlights();
    }

    async persistHighlights() {
      if (window.SafariAnnotatorStorage) {
        const list = Array.from(this.highlights.values());
        await window.SafariAnnotatorStorage.saveHighlights(list);
      }
    }

    async restoreSavedHighlights() {
      if (!window.SafariAnnotatorStorage) return;
      const saved = await window.SafariAnnotatorStorage.getHighlights();
      if (!Array.isArray(saved) || saved.length === 0) return;

      saved.forEach(item => {
        this.highlights.set(item.id, item);
        this.renderStoredHighlight(item);
      });
    }

    renderStoredHighlight(item) {
      let container = null;
      if (item.anchor && item.anchor.xpath) {
        try {
          const result = document.evaluate(
            item.anchor.xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          container = result.singleNodeValue;
        } catch (e) {
          // Fallback if XPath fails
        }
      }

      if (!container) {
        // Fallback: search within body
        container = document.body;
      }

      // Search container for matching text + context
      const targetText = item.text;
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      let node = walker.nextNode();

      while (node) {
        const idx = node.textContent.indexOf(targetText);
        if (idx !== -1) {
          // Check parent isn't already a highlight
          if (node.parentElement && node.parentElement.classList.contains("safari-annotator-hl")) {
            node = walker.nextNode();
            continue;
          }

          let targetNode = node;
          if (idx > 0) {
            targetNode = node.splitText(idx);
          }
          if (targetText.length < targetNode.textContent.length) {
            targetNode.splitText(targetText.length);
          }

          const mark = document.createElement("mark");
          mark.className = "safari-annotator-hl";
          mark.setAttribute("data-hl-id", item.id);
          mark.style.setProperty("--hl-color", item.color);
          mark.style.backgroundColor = item.color;

          targetNode.parentNode.insertBefore(mark, targetNode);
          mark.appendChild(targetNode);
          break;
        }
        node = walker.nextNode();
      }
    }
  }

  window.SafariAnnotatorHighlighter = HighlighterEngine;
})();

// Safari Web Annotator - Floating On-Page Toolbar (Shadow DOM)
// Defaults to a sleek, compact square in the top right corner on page load,
// which enlarges into the full horizontal/vertical dock with forms picker and full controls.

(function () {
  const PRESET_COLORS = [
    { name: "Yellow", hex: "#fde047" },
    { name: "Orange", hex: "#fb923c" },
    { name: "Red", hex: "#f87171" },
    { name: "Pink", hex: "#f472b6" },
    { name: "Blue", hex: "#60a5fa" },
    { name: "Green", hex: "#4ade80" },
    { name: "Charcoal", hex: "#1e293b" }
  ];

  const SIZES = [
    { label: "S", value: 3 },
    { label: "M", value: 6 },
    { label: "L", value: 12 },
    { label: "XL", value: 22 }
  ];

  const SHAPES_CONFIG = [
    { id: "rect", label: "Rectangle", icon: "🔲", desc: "Drag to draw rectangle" },
    { id: "circle", label: "Circle / Oval", icon: "⭕", desc: "Drag to draw oval or circle" },
    { id: "triangle", label: "Triangle", icon: "🔺", desc: "Drag to draw triangle" },
    { id: "diamond", label: "Diamond", icon: "🔷", desc: "Drag to draw rhombus" },
    { id: "pentagon", label: "Pentagon", icon: "⬠", desc: "5-sided regular polygon" },
    { id: "hexagon", label: "Hexagon", icon: "⬡", desc: "6-sided regular polygon" },
    { id: "star", label: "Star", icon: "⭐", desc: "5-pointed star" },
    { id: "arrow", label: "Arrow", icon: "↗️", desc: "Drag to point arrow" },
    { id: "line", label: "Line", icon: "➖", desc: "Straight line segment" },
    { id: "polygon", label: "Custom Polygon", icon: "📐", desc: "Click vertices, close at start point" }
  ];

  class AnnotatorDock extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.activeTool = "browse";
      this.activeShape = "rect";
      this.isShapePopoverOpen = false;
      this.activeColor = PRESET_COLORS[0].hex;
      this.activeSize = 6;
      this.isMinimized = true; // Default: starts minimized as a little square in top right corner
      this.orientation = "horizontal"; // 'horizontal' or 'vertical'
      this.drawer = null;
      this.highlighter = null;
    }

    connectedCallback() {
      this.render();
      this.setupDraggable();
      this.setupKeyShortcuts();
      this.setupScrollAndResizeAnchoring();
      this.restoreSavedPosition();
    }

    setEngines(drawer, highlighter) {
      this.drawer = drawer;
      this.highlighter = highlighter;
      this.syncToolState();
    }

    render() {
      const style = document.createElement("style");
      style.textContent = `
        :host {
          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
          position: fixed !important;
          top: 16px;
          right: 16px;
          z-index: 2147483647 !important;
          user-select: none;
          -webkit-user-select: none;
          display: block !important;
          pointer-events: auto;
        }

        /* Top Right Corner Little Square (Default Initial State) */
        .dock-square {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: rgba(30, 41, 59, 0.94);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.22);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.2);
          border-radius: 12px;
          color: #f8fafc;
          font-size: 20px;
          cursor: pointer;
          transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), background 0.15s ease, box-shadow 0.15s ease;
          box-sizing: border-box;
          animation: squareFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .dock-square:hover {
          transform: scale(1.08);
          background: rgba(51, 65, 85, 0.98);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45), 0 0 0 2px rgba(59, 130, 246, 0.5);
        }

        .dock-square:active {
          transform: scale(0.95);
        }

        @keyframes squareFadeIn {
          from {
            opacity: 0;
            transform: scale(0.85);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Full Dock Container */
        .dock-container {
          background: rgba(30, 41, 59, 0.94);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.25);
          border-radius: 18px;
          padding: 8px 12px;
          display: none; /* Hidden by default until enlarged */
          align-items: center;
          gap: 8px;
          color: #f8fafc;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, width 0.2s ease, height 0.2s ease;
          box-sizing: border-box;
          position: relative;
          animation: dockFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes dockFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Group containers */
        .header-group,
        .tools-group,
        .actions-group,
        .controls-group {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .drag-handle {
          cursor: grab;
          padding: 4px 6px;
          color: #94a3b8;
          font-size: 14px;
          display: flex;
          align-items: center;
          border-radius: 6px;
        }
        .drag-handle:active {
          cursor: grabbing;
        }

        .divider {
          width: 1px;
          height: 24px;
          background: rgba(255, 255, 255, 0.15);
          margin: 0 2px;
          flex-shrink: 0;
        }

        .tool-btn {
          background: transparent;
          border: none;
          color: #cbd5e1;
          border-radius: 10px;
          padding: 6px 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
          box-sizing: border-box;
        }
        .tool-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }
        .tool-btn.active {
          background: #3b82f6;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
        }
        .tool-btn:active {
          transform: scale(0.96);
        }

        /* Forms & Polygons Picker */
        .shape-picker-wrapper {
          position: relative;
          display: inline-flex;
          align-items: center;
        }

        .shape-trigger-btn {
          display: flex;
          align-items: center;
          gap: 3px;
          padding: 6px 8px;
        }

        .shape-caret {
          font-size: 8px;
          color: #94a3b8;
          margin-left: 2px;
          transition: transform 0.15s ease;
        }
        .shape-picker-wrapper.open .shape-caret {
          transform: rotate(180deg);
        }

        .shapes-popover {
          position: absolute;
          top: calc(100% + 10px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(24, 32, 47, 0.96);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 16px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5), 0 2px 10px rgba(0, 0, 0, 0.3);
          padding: 10px;
          display: none;
          flex-direction: column;
          gap: 8px;
          z-index: 2147483647;
          width: 260px;
          box-sizing: border-box;
        }

        .shapes-popover.open {
          display: flex;
          animation: popoverFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes popoverFadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .shapes-popover-header {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #94a3b8;
          padding-bottom: 4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .shapes-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 5px;
        }

        .shape-option-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #e2e8f0;
          border-radius: 8px;
          padding: 6px 8px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 7px;
          text-align: left;
          transition: all 0.12s ease;
          box-sizing: border-box;
        }
        .shape-option-btn:hover {
          background: rgba(255, 255, 255, 0.14);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.25);
        }
        .shape-option-btn.active {
          background: #2563eb;
          color: #ffffff;
          border-color: #60a5fa;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
        }
        .shape-option-btn:active {
          transform: scale(0.97);
        }

        .shape-opt-icon {
          font-size: 14px;
          line-height: 1;
        }
        .shape-opt-label {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .shapes-popover-tip {
          font-size: 10px;
          color: #94a3b8;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 6px;
          padding: 5px 8px;
          line-height: 1.35;
        }

        .palette {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .color-swatch {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid transparent;
          transition: transform 0.15s ease, border-color 0.15s ease;
          box-sizing: border-box;
        }
        .color-swatch:hover {
          transform: scale(1.2);
        }
        .color-swatch.active {
          border-color: #ffffff;
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.4);
          transform: scale(1.15);
        }

        .size-group {
          display: flex;
          align-items: center;
          gap: 3px;
        }
        .size-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          border-radius: 6px;
          padding: 4px 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }
        .size-btn:hover {
          color: #ffffff;
        }
        .size-btn.active {
          background: rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }

        .action-btn {
          background: transparent;
          border: none;
          color: #cbd5e1;
          border-radius: 8px;
          padding: 6px 8px;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .action-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
        }
        .action-btn.action-danger:hover {
          background: rgba(239, 68, 68, 0.25);
          color: #fca5a5;
        }

        .toast-msg {
          position: absolute;
          top: calc(100% + 12px);
          left: 50%;
          transform: translateX(-50%);
          background: #10b981;
          color: white;
          font-size: 12px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 20px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          display: none;
          white-space: nowrap;
          pointer-events: none;
          z-index: 2147483647;
        }

        .dock-tooltip {
          position: fixed;
          background: rgba(15, 23, 42, 0.96);
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.2px;
          padding: 4px 8px;
          border-radius: 7px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45), 0 1px 4px rgba(0, 0, 0, 0.25);
          pointer-events: none;
          opacity: 0;
          visibility: hidden;
          transform: scale(0.92);
          transition: opacity 0.12s ease, transform 0.12s cubic-bezier(0.16, 1, 0.3, 1);
          white-space: nowrap;
          z-index: 2147483647;
          display: flex;
          align-items: center;
          gap: 5px;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .dock-tooltip.visible {
          opacity: 1;
          visibility: visible;
          transform: scale(1);
        }

        /* ========================================================
           VERTICAL ORIENTATION STYLES
           ======================================================== */
        .dock-container.vertical {
          flex-direction: column;
          padding: 10px 6px;
          gap: 6px;
          width: 52px;
          max-height: 92vh;
          border-radius: 22px;
        }

        .dock-container.vertical .header-group,
        .dock-container.vertical .tools-group,
        .dock-container.vertical .actions-group,
        .dock-container.vertical .controls-group {
          flex-direction: column;
          gap: 4px;
          width: 100%;
          align-items: center;
        }

        .dock-container.vertical .drag-handle {
          padding: 2px 0;
          font-size: 13px;
        }

        .dock-container.vertical .divider {
          width: 28px;
          height: 1px;
          margin: 3px auto;
        }

        .dock-container.vertical .tool-btn,
        .dock-container.vertical .action-btn {
          width: 34px;
          height: 34px;
          padding: 0;
          justify-content: center;
          font-size: 15px;
        }

        .dock-container.vertical .shape-picker-wrapper {
          width: 100%;
          justify-content: center;
        }
        .dock-container.vertical .shape-trigger-btn {
          width: 34px;
          height: 34px;
          padding: 0;
          justify-content: center;
          gap: 1px;
        }
        .dock-container.vertical .shapes-popover {
          top: 50%;
          left: auto;
          right: calc(100% + 12px);
          transform: translateY(-50%);
        }
        .dock-container.vertical .shapes-popover.open {
          animation: popoverFadeInVertical 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes popoverFadeInVertical {
          from {
            opacity: 0;
            transform: translateY(-50%) translateX(6px);
          }
          to {
            opacity: 1;
            transform: translateY(-50%) translateX(0);
          }
        }

        .dock-container.vertical .palette {
          display: grid;
          grid-template-columns: repeat(2, 16px);
          gap: 5px;
          justify-content: center;
          padding: 2px 0;
        }
        .dock-container.vertical .color-swatch {
          width: 16px;
          height: 16px;
        }

        .square-toggle-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.22);
          color: #cbd5e1;
          border-radius: 9px;
          width: 32px;
          height: 32px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.15s ease;
          box-sizing: border-box;
          flex-shrink: 0;
        }
        .square-toggle-btn:hover {
          background: rgba(59, 130, 246, 0.35);
          border-color: #60a5fa;
          color: #ffffff;
          transform: scale(1.08);
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.4);
        }
        .square-toggle-btn:active {
          transform: scale(0.94);
        }

        .dock-container.vertical .square-toggle-btn {
          width: 34px;
          height: 34px;
        }

        .dock-container.vertical .size-group {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 2px;
          width: 36px;
        }
        .dock-container.vertical .size-btn {
          padding: 2px;
          font-size: 10px;
        }
      `;

      const wrapper = document.createElement("div");
      wrapper.innerHTML = `
        <div class="toast-msg" id="toast"></div>
        <div class="dock-tooltip" id="dock-tooltip"></div>

        <!-- Default: Small square button in top right corner -->
        <div class="dock-square" id="dock-square" title="Open Annotator (🖍️)">
          <span>🖍️</span>
        </div>

        <!-- Full dock: Expands when clicking the square -->
        <div class="dock-container" id="dock-main">
          <!-- Header: Return to Square, Drag Handle & Orientation Toggle -->
          <div class="header-group">
            <button class="square-toggle-btn" id="btn-return-square" title="Collapse to Square (🔲)">🔲</button>
            <div class="drag-handle" title="Drag Toolbar (⋮⋮)">⋮⋮</div>
            <button class="action-btn" id="btn-orientation" title="Switch to Vertical Layout (⇅)">⇅</button>
          </div>

          <div class="divider"></div>

          <!-- Tools Group -->
          <div class="tools-group">
            <button class="tool-btn active" data-tool="browse" title="Select & Browse (🖐️)">🖐️</button>
            <button class="tool-btn" data-tool="highlight" title="Text Highlighter (🖍️)">🖍️</button>
            <button class="tool-btn" data-tool="pen" title="Freehand Pen (✏️)">✏️</button>
            <button class="tool-btn" data-tool="marker" title="Highlighter Brush (🖌️)">🖌️</button>
            <button class="tool-btn" data-tool="laser" title="Laser Pointer (🔦)">🔦</button>

            <!-- Shapes & Polygons Popover Picker -->
            <div class="shape-picker-wrapper" id="shape-picker-wrapper">
              <button class="tool-btn shape-trigger-btn" id="btn-shape-trigger" data-tool="shape" title="Shapes & Polygons (🔲▾)">
                <span class="shape-active-icon" id="shape-active-icon">🔲</span>
                <span class="shape-caret">▾</span>
              </button>

              <div class="shapes-popover" id="shapes-popover">
                <div class="shapes-popover-header">Shapes & Polygons</div>
                <div class="shapes-grid">
                  ${SHAPES_CONFIG.map(
                    (s) => `
                    <button class="shape-option-btn ${s.id === "rect" ? "active" : ""}" data-shape="${s.id}" title="${s.desc}">
                      <span class="shape-opt-icon">${s.icon}</span>
                      <span class="shape-opt-label">${s.label}</span>
                    </button>
                  `
                  ).join("")}
                </div>
                <div class="shapes-popover-tip">
                  💡 <strong>Polygon:</strong> Click points on page; click start point (or double-click) to close shape.
                </div>
              </div>
            </div>

            <button class="tool-btn" data-tool="eraser" title="Eraser (🧹)">🧹</button>
          </div>

          <div class="divider"></div>

          <!-- Colors Palette -->
          <div class="palette" id="palette">
            ${PRESET_COLORS.map(
              (c, i) => `
              <div class="color-swatch ${i === 0 ? "active" : ""}" 
                   data-color="${c.hex}" 
                   style="background: ${c.hex}" 
                   title="${c.name}"></div>
            `
            ).join("")}
          </div>

          <div class="divider"></div>

          <!-- Stroke Size -->
          <div class="size-group">
            ${SIZES.map(
              (s, i) => `
              <button class="size-btn ${i === 1 ? "active" : ""}" data-size="${s.value}" title="Size ${s.label} (${s.value}px)">${s.label}</button>
            `
            ).join("")}
          </div>

          <div class="divider"></div>

          <!-- Actions Group -->
          <div class="actions-group">
            <button class="action-btn" id="btn-undo" title="Undo (Cmd+Z)">↩️</button>
            <button class="action-btn" id="btn-redo" title="Redo (Cmd+Y)">↪️</button>
            <button class="action-btn action-danger" id="btn-clear-all" title="Clear Whole Page (Cmd+Shift+X)">🗑️</button>
          </div>

          <div class="divider"></div>

          <!-- Controls Group -->
          <div class="controls-group">
            <button class="action-btn" id="btn-minimize" title="Collapse to Square (🗗)">🗗</button>
            <button class="action-btn" id="btn-close" title="Collapse to Square (✕)">✕</button>
          </div>
        </div>
      `;

      this.shadowRoot.appendChild(style);
      this.shadowRoot.appendChild(wrapper);

      this.attachDockEvents();
      this.setupTooltips();
    }

    attachDockEvents() {
      const root = this.shadowRoot;

      // Little square trigger: click to enlarge (only on direct click, not after drag)
      const dockSquare = root.getElementById("dock-square");
      dockSquare.addEventListener("click", (e) => {
        if (this._squareDragged) {
          this._squareDragged = false;
          return;
        }
        this.enlargeDock();
      });

      // Return to corner square button in header
      const returnSquareBtn = root.getElementById("btn-return-square");
      if (returnSquareBtn) {
        returnSquareBtn.addEventListener("click", () => {
          this.minimizeDock();
        });
      }

      // Tool switching for standard tools
      root.querySelectorAll(".tool-btn:not(.shape-trigger-btn)").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.closeShapePopover();
          root.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          this.activeTool = btn.dataset.tool;
          this.syncToolState();
        });
      });

      // Shape popover trigger button
      const shapeTrigger = root.getElementById("btn-shape-trigger");
      const shapePopover = root.getElementById("shapes-popover");

      shapeTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleShapePopover();
      });

      // Shape option selection inside popover
      root.querySelectorAll(".shape-option-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const shapeId = btn.dataset.shape;
          this.selectShape(shapeId);
        });
      });

      // Click outside popover closes it
      window.addEventListener("click", (e) => {
        if (this.isShapePopoverOpen) {
          const path = e.composedPath ? e.composedPath() : [];
          if (!path.includes(shapeTrigger) && !path.includes(shapePopover)) {
            this.closeShapePopover();
          }
        }
      });

      // Color switching
      root.querySelectorAll(".color-swatch").forEach((swatch) => {
        swatch.addEventListener("click", () => {
          root.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("active"));
          swatch.classList.add("active");
          this.activeColor = swatch.dataset.color;
          this.syncColorState();
        });
      });

      // Size switching
      root.querySelectorAll(".size-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          root.querySelectorAll(".size-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          this.activeSize = Number(btn.dataset.size);
          this.syncSizeState();
        });
      });

      // Orientation toggle button
      root.getElementById("btn-orientation").addEventListener("click", () => {
        this.toggleOrientation();
      });

      // Actions
      root.getElementById("btn-undo").addEventListener("click", () => {
        this.performUndo();
      });

      root.getElementById("btn-redo").addEventListener("click", () => {
        this.performRedo();
      });

      // Completely Clear Whole Page button
      root.getElementById("btn-clear-all").addEventListener("click", () => {
        this.clearWholePage();
      });

      // Minimize button (➖): collapses to the little square
      root.getElementById("btn-minimize").addEventListener("click", () => {
        this.minimizeDock();
      });

      // Close button (✕): also collapses to the little square
      root.getElementById("btn-close").addEventListener("click", () => {
        this.minimizeDock();
        if (this.drawer) this.drawer.setTool("browse");
        if (this.highlighter) this.highlighter.setHighlightMode(false);
      });
    }

    enlargeDock() {
      this.isMinimized = false;
      const dockSquare = this.shadowRoot.getElementById("dock-square");
      const dockMain = this.shadowRoot.getElementById("dock-main");
      if (dockSquare) dockSquare.style.display = "none";
      if (dockMain) {
        dockMain.style.display = "flex";
      }

      // Ensure expanding from a custom square position doesn't overflow screen
      requestAnimationFrame(() => {
        const rect = this.getBoundingClientRect();
        if (rect.right > window.innerWidth - 8) {
          const newLeft = Math.max(8, window.innerWidth - rect.width - 12);
          this.style.setProperty("left", `${newLeft}px`, "important");
          this.style.setProperty("right", "auto", "important");
        }
        if (rect.bottom > window.innerHeight - 8) {
          const newTop = Math.max(8, window.innerHeight - rect.height - 12);
          this.style.setProperty("top", `${newTop}px`, "important");
          this.style.setProperty("bottom", "auto", "important");
        }
      });
    }

    minimizeDock() {
      this.isMinimized = true;
      this.closeShapePopover();
      const dockSquare = this.shadowRoot.getElementById("dock-square");
      const dockMain = this.shadowRoot.getElementById("dock-main");
      if (dockMain) dockMain.style.display = "none";
      if (dockSquare) {
        dockSquare.style.display = "flex";
      }

      // Snap host back to top-right corner cleanly
      this.style.setProperty("position", "fixed", "important");
      this.style.setProperty("top", "16px", "important");
      this.style.setProperty("right", "16px", "important");
      this.style.setProperty("left", "auto", "important");
      this.style.setProperty("bottom", "auto", "important");
      this.style.setProperty("transform", "none", "important");

      this.showToast("Returned to corner square");
    }

    toggleShapePopover() {
      if (this.isShapePopoverOpen) {
        this.closeShapePopover();
      } else {
        this.openShapePopover();
      }
    }

    openShapePopover() {
      const root = this.shadowRoot;
      const popover = root.getElementById("shapes-popover");
      const wrapper = root.getElementById("shape-picker-wrapper");
      const triggerBtn = root.getElementById("btn-shape-trigger");
      if (!popover) return;

      const rect = this.getBoundingClientRect();

      // Adjust popover side when in vertical orientation
      if (this.orientation === "vertical") {
        if (rect.left < 290) {
          popover.style.right = "auto";
          popover.style.left = "calc(100% + 12px)";
        } else {
          popover.style.left = "auto";
          popover.style.right = "calc(100% + 12px)";
        }
        popover.style.top = "50%";
        popover.style.bottom = "auto";
        popover.style.transform = "translateY(-50%)";
      } else {
        // Horizontal orientation: open downward if dock is in upper half of viewport
        popover.style.left = "50%";
        popover.style.right = "auto";
        popover.style.transform = "translateX(-50%)";

        if (rect.top < 340) {
          popover.style.top = "calc(100% + 10px)";
          popover.style.bottom = "auto";
        } else {
          popover.style.bottom = "calc(100% + 10px)";
          popover.style.top = "auto";
        }
      }

      this.isShapePopoverOpen = true;
      popover.classList.add("open");
      if (wrapper) wrapper.classList.add("open");

      // Keep popover inside horizontal screen bounds
      requestAnimationFrame(() => {
        const pRect = popover.getBoundingClientRect();
        if (pRect.right > window.innerWidth - 10) {
          popover.style.left = "auto";
          popover.style.right = "0";
          popover.style.transform = "none";
        }
        if (pRect.left < 10) {
          popover.style.left = "0";
          popover.style.right = "auto";
          popover.style.transform = "none";
        }
      });

      // Activate shapes tool
      root.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
      if (triggerBtn) triggerBtn.classList.add("active");
      this.activeTool = "shape";
      this.syncToolState();
    }

    closeShapePopover() {
      this.isShapePopoverOpen = false;
      const popover = this.shadowRoot.getElementById("shapes-popover");
      const wrapper = this.shadowRoot.getElementById("shape-picker-wrapper");
      if (popover) popover.classList.remove("open");
      if (wrapper) wrapper.classList.remove("open");
    }

    selectShape(shapeId) {
      this.activeShape = shapeId;
      const root = this.shadowRoot;

      // Update active shape in grid
      root.querySelectorAll(".shape-option-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.shape === shapeId);
      });

      // Update trigger icon
      const cfg = SHAPES_CONFIG.find((s) => s.id === shapeId);
      const iconSpan = root.getElementById("shape-active-icon");
      if (iconSpan && cfg) {
        iconSpan.textContent = cfg.icon;
      }

      // Close popover
      this.closeShapePopover();

      // Ensure shape tool is active
      root.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
      const triggerBtn = root.getElementById("btn-shape-trigger");
      if (triggerBtn) triggerBtn.classList.add("active");
      this.activeTool = "shape";

      this.syncToolState();

      if (shapeId === "polygon") {
        this.showToast("📐 Custom Polygon: Click points, close at start point or double-click");
      } else {
        this.showToast(`Form: ${cfg ? cfg.label : shapeId}`);
      }
    }

    clearWholePage() {
      const confirmClear = confirm(
        "Are you sure you want to completely clear the whole page?\n\nThis will remove all drawings, text highlights, and delete saved annotations for this URL."
      );
      if (!confirmClear) return;

      if (this.drawer) {
        this.drawer.clear();
      }
      if (this.highlighter) {
        this.highlighter.clearAllHighlights();
      }
      if (window.SafariAnnotatorStorage) {
        window.SafariAnnotatorStorage.clearDrawing();
        window.SafariAnnotatorStorage.clearHighlights();
      }
      this.showToast("🧹 Whole page completely cleared!");
    }

    async savePageAnnotations() {
      if (this.drawer) {
        await this.drawer.saveDrawing();
      }
      if (this.highlighter) {
        await this.highlighter.persistHighlights();
      }
      this.showToast("💾 Annotations saved for this page!");
    }

    exportSnapshot() {
      if (this.drawer) {
        this.drawer.exportSnapshot();
        this.showToast("📷 Exported snapshot!");
      }
    }

    toggleOrientation() {
      const newOrientation = this.orientation === "horizontal" ? "vertical" : "horizontal";
      this.setOrientation(newOrientation, true);
    }

    setOrientation(orientation, isUserToggle = false) {
      this.orientation = orientation;
      const dockMain = this.shadowRoot.getElementById("dock-main");
      const orientBtn = this.shadowRoot.getElementById("btn-orientation");

      if (orientation === "vertical") {
        dockMain.classList.add("vertical");
        orientBtn.setAttribute("data-tooltip", "Switch to Horizontal Layout (⇄)");
        orientBtn.removeAttribute("title");
        orientBtn.textContent = "⇄";

        if (isUserToggle) {
          this.showToast("Vertical Layout");
        }
      } else {
        dockMain.classList.remove("vertical");
        orientBtn.setAttribute("data-tooltip", "Switch to Vertical Layout (⇅)");
        orientBtn.removeAttribute("title");
        orientBtn.textContent = "⇅";

        if (isUserToggle) {
          this.showToast("Horizontal Layout");
        }
      }

      // If shape popover is currently open, reposition it
      if (this.isShapePopoverOpen) {
        this.openShapePopover();
      }

      // Persist orientation preference
      if (window.SafariAnnotatorStorage) {
        window.SafariAnnotatorStorage.savePreferences({
          orientation: this.orientation
        });
      }
    }

    showToast(message) {
      const toast = this.shadowRoot.getElementById("toast");
      if (!toast) return;

      const rect = this.getBoundingClientRect();
      if (rect.top < 60) {
        toast.style.top = "calc(100% + 12px)";
        toast.style.bottom = "auto";
      } else {
        toast.style.top = "-42px";
        toast.style.bottom = "auto";
      }

      toast.textContent = message;
      toast.style.display = "block";
      setTimeout(() => {
        toast.style.display = "none";
      }, 2400);
    }

    syncToolState() {
      if (this.drawer) {
        if (this.activeTool === "shape") {
          this.drawer.setShapeType(this.activeShape || "rect");
          this.drawer.setTool("shape");
        } else {
          this.drawer.setTool(this.activeTool);
        }
      }
      if (this.highlighter) {
        this.highlighter.setHighlightMode(this.activeTool === "highlight");
      }
    }

    syncColorState() {
      if (this.drawer) this.drawer.setColor(this.activeColor);
      if (this.highlighter) this.highlighter.setColor(this.activeColor);
    }

    syncSizeState() {
      if (this.drawer) this.drawer.setSize(this.activeSize);
    }

    performUndo() {
      let didUndo = false;
      const hlHasUndo = this.highlighter && this.highlighter.canUndo();
      const drHasUndo = this.drawer && this.drawer.strokes.length > 0;

      if (hlHasUndo && !drHasUndo) {
        this.highlighter.undo();
        didUndo = true;
      } else if (drHasUndo && !hlHasUndo) {
        this.drawer.undo();
        didUndo = true;
      } else if (hlHasUndo && drHasUndo) {
        const hlLast = this.highlighter.undoStack[this.highlighter.undoStack.length - 1];
        const drLast = this.drawer.strokes[this.drawer.strokes.length - 1];
        const hlTime = (hlLast && hlLast.record && hlLast.record.createdAt) || 0;
        const drTime = drLast && drLast.id ? parseInt(drLast.id.split("_")[1]) || 0 : 0;

        if (hlTime > drTime) {
          this.highlighter.undo();
        } else {
          this.drawer.undo();
        }
        didUndo = true;
      }

      if (didUndo) {
        this.showToast("↩️ Undo");
      }
    }

    performRedo() {
      let didRedo = false;
      const hlHasRedo = this.highlighter && this.highlighter.canRedo();
      const drHasRedo = this.drawer && this.drawer.redoStack.length > 0;

      if (hlHasRedo && !drHasRedo) {
        this.highlighter.redo();
        didRedo = true;
      } else if (drHasRedo && !hlHasRedo) {
        this.drawer.redo();
        didRedo = true;
      } else if (hlHasRedo && drHasRedo) {
        this.drawer.redo();
        didRedo = true;
      }

      if (didRedo) {
        this.showToast("↪️ Redo");
      }
    }

    setupKeyShortcuts() {
      window.addEventListener("keydown", (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) {
          return;
        }

        const isCtrlOrCmd = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();

        // Undo: Ctrl+Z or Cmd+Z (without shift)
        if (isCtrlOrCmd && !e.shiftKey && key === "z") {
          e.preventDefault();
          this.performUndo();
        }

        // Redo: Ctrl+Y or Cmd+Y, or Ctrl+Shift+Z or Cmd+Shift+Z
        if ((isCtrlOrCmd && key === "y") || (isCtrlOrCmd && e.shiftKey && key === "z")) {
          e.preventDefault();
          this.performRedo();
        }

        // Completely Clear Whole Page: Ctrl+Shift+X or Cmd+Shift+X, or Alt+Shift+X
        if ((isCtrlOrCmd || e.altKey) && e.shiftKey && key === "x") {
          e.preventDefault();
          this.clearWholePage();
        }

        // Save Page Annotations: Ctrl+S / Cmd+S or Alt+Shift+S
        if ((isCtrlOrCmd && key === "s") || (e.altKey && e.shiftKey && key === "s")) {
          e.preventDefault();
          this.savePageAnnotations();
        }

        // Export Snapshot: Ctrl+Shift+E / Cmd+Shift+E, or Alt+Shift+P
        if (((isCtrlOrCmd || e.altKey) && e.shiftKey && key === "e") ||
            ((isCtrlOrCmd || e.altKey) && e.shiftKey && key === "p")) {
          e.preventDefault();
          this.exportSnapshot();
        }

        // Escape returns to corner square if navbar is open
        if (key === "escape" && !this.isMinimized) {
          if (!this.drawer || !this.drawer.activePolygonStroke) {
            this.minimizeDock();
          }
        }
      });
    }

    setupTooltips() {
      const root = this.shadowRoot;
      const tooltip = root.getElementById("dock-tooltip");
      if (!tooltip) return;

      const showTip = (el) => {
        const text = el.getAttribute("data-tooltip") || el.getAttribute("title");
        if (!text) return;

        if (el.getAttribute("title")) {
          el.setAttribute("data-tooltip", el.getAttribute("title"));
          el.removeAttribute("title");
        }

        const label = el.getAttribute("data-tooltip");
        if (!label) return;

        tooltip.textContent = label;
        tooltip.classList.add("visible");

        // Force browser layout calculation for tooltip bounds
        const tipRect = tooltip.getBoundingClientRect();
        const rect = el.getBoundingClientRect();

        let top, left;

        if (this.orientation === "vertical") {
          // Vertical layout: dock is a sidebar
          if (rect.left > window.innerWidth / 2) {
            // Near right edge of viewport -> tooltip to the left
            left = rect.left - tipRect.width - 10;
          } else {
            // Near left edge of viewport -> tooltip to the right
            left = rect.right + 10;
          }
          top = rect.top + (rect.height - tipRect.height) / 2;
        } else {
          // Horizontal layout: dock is a horizontal bar
          if (rect.top > window.innerHeight / 2) {
            // In lower half of screen -> tooltip above
            top = rect.top - tipRect.height - 8;
          } else {
            // In upper half of screen -> tooltip below
            top = rect.bottom + 8;
          }
          left = rect.left + (rect.width - tipRect.width) / 2;
        }

        // Clamp safely within viewport
        left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
        top = Math.max(8, Math.min(top, window.innerHeight - tipRect.height - 8));

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      };

      const hideTip = () => {
        tooltip.classList.remove("visible");
      };

      const elements = root.querySelectorAll(
        "button, .drag-handle, .color-swatch, .dock-square, .shape-option-btn"
      );

      elements.forEach((el) => {
        const title = el.getAttribute("title");
        if (title) {
          el.setAttribute("data-tooltip", title);
          el.removeAttribute("title");
        }

        el.addEventListener("mouseenter", () => showTip(el));
        el.addEventListener("mouseleave", hideTip);
        el.addEventListener("mousedown", hideTip);
      });

      window.addEventListener("scroll", hideTip, { passive: true });
    }

    setupScrollAndResizeAnchoring() {
      window.addEventListener("resize", () => {
        const rect = this.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
          this.style.setProperty("left", `${Math.max(10, window.innerWidth - rect.width - 15)}px`, "important");
          this.style.setProperty("right", "auto", "important");
        }
        if (rect.bottom > window.innerHeight) {
          this.style.setProperty("top", `${Math.max(10, window.innerHeight - rect.height - 15)}px`, "important");
          this.style.setProperty("bottom", "auto", "important");
        }
      });
    }

    setupDraggable() {
      // Allow dragging both via the dock handle and the minimized square
      const handle = this.shadowRoot.querySelector(".drag-handle");
      const dockSquare = this.shadowRoot.getElementById("dock-square");

      const attachDrag = (element, isSquare = false) => {
        let isDragging = false;
        let startX, startY;
        let initialLeft, initialTop;
        let hasMoved = false;

        element.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();

          isDragging = true;
          hasMoved = false;
          startX = e.clientX;
          startY = e.clientY;

          const rect = this.getBoundingClientRect();
          initialLeft = rect.left;
          initialTop = rect.top;

          // Switch from right-anchoring to left/top inline styles immediately
          this.style.setProperty("position", "fixed", "important");
          this.style.setProperty("left", `${initialLeft}px`, "important");
          this.style.setProperty("top", `${initialTop}px`, "important");
          this.style.setProperty("right", "auto", "important");
          this.style.setProperty("bottom", "auto", "important");
          this.style.setProperty("transform", "none", "important");

          if (isSquare) {
            document.body.style.cursor = "grabbing";
          }

          const onMouseMove = (ev) => {
            if (!isDragging) return;
            ev.preventDefault();

            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
              hasMoved = true;
            }

            const currentRect = this.getBoundingClientRect();
            const elemWidth = currentRect.width || (this.isMinimized ? 40 : 450);
            const elemHeight = currentRect.height || (this.isMinimized ? 40 : 48);

            const newLeft = Math.max(10, Math.min(window.innerWidth - elemWidth - 10, initialLeft + dx));
            const newTop = Math.max(10, Math.min(window.innerHeight - elemHeight - 10, initialTop + dy));

            this.style.setProperty("position", "fixed", "important");
            this.style.setProperty("left", `${newLeft}px`, "important");
            this.style.setProperty("top", `${newTop}px`, "important");
            this.style.setProperty("right", "auto", "important");
            this.style.setProperty("bottom", "auto", "important");
            this.style.setProperty("transform", "none", "important");
          };

          const onMouseUp = () => {
            if (isDragging) {
              isDragging = false;
              window.removeEventListener("mousemove", onMouseMove);
              window.removeEventListener("mouseup", onMouseUp);

              if (isSquare) {
                document.body.style.cursor = "";
                if (hasMoved) {
                  this._squareDragged = true;
                  const captureClick = (cEv) => {
                    cEv.stopPropagation();
                    cEv.preventDefault();
                    window.removeEventListener("click", captureClick, true);
                  };
                  window.addEventListener("click", captureClick, true);
                  setTimeout(() => {
                    window.removeEventListener("click", captureClick, true);
                    this._squareDragged = false;
                  }, 250);
                }
              }
            }
          };

          window.addEventListener("mousemove", onMouseMove);
          window.addEventListener("mouseup", onMouseUp);
        });
      };

      if (handle) attachDrag(handle, false);
      if (dockSquare) attachDrag(dockSquare, true);
    }

    async restoreSavedPosition() {
      // By explicit default, every newly loaded or searched page starts minimized
      // as a small square placed at the top right corner (top: 16px, right: 16px).
      if (window.SafariAnnotatorStorage) {
        const prefs = await window.SafariAnnotatorStorage.getPreferences();
        if (prefs && prefs.orientation) {
          this.setOrientation(prefs.orientation, false);
        }
      }
    }
  }

  customElements.define("safari-annotator-dock", AnnotatorDock);
  window.SafariAnnotatorDock = AnnotatorDock;
})();

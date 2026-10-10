// Safari Web Annotator - Drawing Canvas Engine
// Provides full-page scroll-synchronized vector canvas, smooth Bézier curves, shapes, highlighter brush, and undo/redo.

(function () {
  class DrawerEngine {
    constructor(highlighter = null) {
      this.highlighter = highlighter;
      this.canvas = null;
      this.ctx = null;
      this.tool = "browse"; // 'browse', 'pen', 'marker', 'laser', 'shape', 'eraser'
      this.shapeType = "rect"; // 'rect', 'circle', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'arrow', 'line', 'polygon'
      this.activePolygonStroke = null;
      this.currentPolygonMousePos = null;
      this.laserTrail = [];
      this.laserAnimId = null;
      this.laserMousePos = null;
      this.color = "#ff3b30";
      this.size = 4;
      this.strokes = [];
      this.redoStack = [];
      this.isDrawing = false;
      this.currentStroke = null;

      this.init();
    }

    setHighlighter(highlighter) {
      this.highlighter = highlighter;
    }

    setShapeType(shapeType) {
      this.shapeType = shapeType;
      if (this.activePolygonStroke) {
        this.activePolygonStroke = null;
        this.currentPolygonMousePos = null;
        this.redraw();
      }
    }

    init() {
      this.createCanvas();
      this.attachEvents();
      this.syncDimensions();

      // Observe page size changes (dynamic content, lazy loading)
      const resizeObserver = new ResizeObserver(() => this.syncDimensions());
      if (document.body) {
        resizeObserver.observe(document.body);
      }
      window.addEventListener("resize", () => this.syncDimensions());
    }

    createCanvas() {
      const canvas = document.createElement("canvas");
      canvas.id = "safari-annotator-canvas";
      canvas.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        z-index: 2147483640;
        pointer-events: none;
        background: transparent;
      `;
      document.body.appendChild(canvas);
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
    }

    syncDimensions() {
      if (!this.canvas) return;
      const width = Math.max(
        document.documentElement.scrollWidth,
        document.body ? document.body.scrollWidth : 0,
        window.innerWidth
      );
      const height = Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0,
        window.innerHeight
      );

      // Only resize if dimensions actually changed
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = width + "px";
        this.canvas.style.height = height + "px";
        this.redraw();
      }
    }

    getEraserCursorSvg() {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <defs>
          <filter id="er-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="1" dy="1.5" stdDeviation="1" flood-color="rgba(0,0,0,0.35)"/>
          </filter>
        </defs>
        <g filter="url(#er-shadow)" transform="rotate(-20 16 16)">
          <rect x="7" y="6" width="18" height="10" rx="3" fill="#fb7185" stroke="#ffffff" stroke-width="1.2"/>
          <rect x="7" y="16" width="18" height="9" rx="2" fill="#f1f5f9" stroke="#ffffff" stroke-width="1.2"/>
          <line x1="7" y1="16" x2="25" y2="16" stroke="#cbd5e1" stroke-width="1"/>
        </g>
      </svg>`;
      return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 4 24, crosshair`;
    }

    getMarkerCursorSvg() {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <defs>
          <filter id="m-glow" x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="1" dy="1.5" stdDeviation="1" flood-color="rgba(0,0,0,0.4)"/>
          </filter>
        </defs>
        <g filter="url(#m-glow)" transform="rotate(-30 16 16)">
          <path d="M11 6 L21 6 L21 22 L11 22 Z" fill="#1e293b" stroke="#ffffff" stroke-width="1.2"/>
          <line x1="11" y1="12" x2="21" y2="12" stroke="${this.color}" stroke-width="3"/>
          <polygon points="11,22 21,22 17,29 13,29" fill="${this.color}" stroke="#ffffff" stroke-width="1"/>
        </g>
      </svg>`;
      return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 16 29, crosshair`;
    }

    getLaserCursorSvg() {
      const laserColor = this.color || "#ff0033";
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <defs>
          <filter id="laser-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2"/>
          </filter>
        </defs>
        <circle cx="16" cy="16" r="7" fill="${laserColor}" opacity="0.45" filter="url(#laser-glow)"/>
        <circle cx="16" cy="16" r="4.5" fill="${laserColor}"/>
        <circle cx="16" cy="16" r="1.8" fill="#ffffff"/>
        <line x1="16" y1="5" x2="16" y2="10" stroke="${laserColor}" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="16" y1="22" x2="16" y2="27" stroke="${laserColor}" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="5" y1="16" x2="10" y2="16" stroke="${laserColor}" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="22" y1="16" x2="27" y2="16" stroke="${laserColor}" stroke-width="1.8" stroke-linecap="round"/>
      </svg>`;
      return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 16 16, crosshair`;
    }

    setTool(tool) {
      this.tool = tool;
      if (!this.canvas) return;

      this.clearEraseCandidateHighlight();

      if (tool !== "shape" && this.activePolygonStroke) {
        this.activePolygonStroke = null;
        this.currentPolygonMousePos = null;
        this.redraw();
      }

      if (tool === "browse" || tool === "highlight") {
        this.canvas.style.pointerEvents = "none";
        this.canvas.style.cursor = "default";
      } else if (tool === "laser") {
        this.canvas.style.pointerEvents = "auto";
        this.canvas.style.cursor = this.getLaserCursorSvg();
        this.startLaserAnimation();
      } else if (tool === "eraser") {
        this.canvas.style.pointerEvents = "auto";
        this.canvas.style.cursor = this.getEraserCursorSvg();
      } else if (tool === "marker") {
        this.canvas.style.pointerEvents = "auto";
        this.canvas.style.cursor = this.getMarkerCursorSvg();
      } else {
        this.canvas.style.pointerEvents = "auto";
        this.canvas.style.cursor = "crosshair";
      }
    }

    setColor(color) {
      this.color = color;
    }

    setSize(size) {
      this.size = Number(size);
    }

    attachEvents() {
      const getPos = (e) => ({
        x: e.pageX,
        y: e.pageY
      });

      this.canvas.addEventListener("mousedown", (e) => {
        if (this.tool === "browse" || this.tool === "highlight" || e.button !== 0) return;
        const pos = getPos(e);

        if (this.tool === "laser") {
          this.isDrawing = true;
          this.laserTrail.push({ x: pos.x, y: pos.y, time: Date.now() });
          this.startLaserAnimation();
          return;
        }

        if (this.tool === "eraser") {
          this.isDrawing = true;
          this.eraseAt(pos, e.clientX, e.clientY);
          return;
        }

        // Freeform Custom Polygon (Click vertices)
        if (this.tool === "shape" && this.shapeType === "polygon") {
          if (!this.activePolygonStroke) {
            this.activePolygonStroke = {
              id: "stroke_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
              tool: "polygon",
              color: this.color,
              size: this.size,
              points: [pos],
              closed: false
            };
            this.currentPolygonMousePos = pos;
            this.redraw();
          } else {
            const startP = this.activePolygonStroke.points[0];
            const dist = Math.hypot(pos.x - startP.x, pos.y - startP.y);
            // Click near first point closes polygon
            if (dist < 18 && this.activePolygonStroke.points.length >= 3) {
              this.activePolygonStroke.closed = true;
              this.strokes.push(this.activePolygonStroke);
              this.redoStack = [];
              this.activePolygonStroke = null;
              this.currentPolygonMousePos = null;
              this.redraw();
            } else {
              this.activePolygonStroke.points.push(pos);
              this.currentPolygonMousePos = pos;
              this.redraw();
            }
          }
          return;
        }

        this.isDrawing = true;
        const toolType = this.tool === "shape" ? this.shapeType : this.tool;

        this.currentStroke = {
          id: "stroke_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          tool: toolType,
          color: this.color,
          size: this.size,
          points: [pos],
          start: pos,
          end: pos
        };
      });

      window.addEventListener("mousemove", (e) => {
        const pos = getPos(e);

        if (this.tool === "laser") {
          this.laserMousePos = pos;
          if (this.isDrawing) {
            this.laserTrail.push({ x: pos.x, y: pos.y, time: Date.now() });
          }
          this.startLaserAnimation();
          return;
        }

        if (this.tool === "eraser") {
          if (this.isDrawing) {
            this.eraseAt(pos, e.clientX, e.clientY);
          } else {
            this.previewEraserHover(e.clientX, e.clientY);
          }
          return;
        }

        // Polygon rubber band preview
        if (this.tool === "shape" && this.shapeType === "polygon") {
          if (this.activePolygonStroke) {
            this.currentPolygonMousePos = pos;
            this.redraw();
          }
          return;
        }

        if (!this.isDrawing) return;
        if (!this.currentStroke) return;

        if (this.currentStroke.tool === "pen" || this.currentStroke.tool === "marker") {
          this.currentStroke.points.push(pos);
          this.redraw();
          this.drawStroke(this.currentStroke, true);
        } else {
          // All drag shapes (rect, circle, triangle, diamond, pentagon, hexagon, star, arrow, line)
          this.currentStroke.end = pos;
          this.redraw();
          this.drawStroke(this.currentStroke, true);
        }
      });

      this.canvas.addEventListener("mouseleave", () => {
        if (this.tool === "laser") {
          this.laserMousePos = null;
          this.redraw();
        }
      });

      window.addEventListener("mouseup", () => {
        if (this.tool === "laser") {
          this.isDrawing = false;
          return;
        }

        if (this.tool === "shape" && this.shapeType === "polygon") {
          return;
        }

        if (!this.isDrawing) return;
        this.isDrawing = false;

        if (this.currentStroke) {
          const isFreehand = this.currentStroke.tool === "pen" || this.currentStroke.tool === "marker";
          if (isFreehand) {
            if (this.currentStroke.points && this.currentStroke.points.length > 0) {
              this.strokes.push(this.currentStroke);
              this.redoStack = [];
            }
          } else {
            if (this.currentStroke.start && this.currentStroke.end) {
              const dx = Math.abs(this.currentStroke.end.x - this.currentStroke.start.x);
              const dy = Math.abs(this.currentStroke.end.y - this.currentStroke.start.y);
              if (dx > 3 || dy > 3) {
                this.strokes.push(this.currentStroke);
                this.redoStack = [];
              }
            }
          }
          this.currentStroke = null;
          this.redraw();
        }
      });

      // Double-click to close custom polygon
      this.canvas.addEventListener("dblclick", () => {
        if (this.tool === "shape" && this.shapeType === "polygon" && this.activePolygonStroke) {
          if (this.activePolygonStroke.points.length >= 3) {
            this.activePolygonStroke.closed = true;
            this.strokes.push(this.activePolygonStroke);
            this.redoStack = [];
          }
          this.activePolygonStroke = null;
          this.currentPolygonMousePos = null;
          this.redraw();
        }
      });

      // Escape to cancel in-progress polygon
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.activePolygonStroke) {
          this.activePolygonStroke = null;
          this.currentPolygonMousePos = null;
          this.redraw();
        }
      });
    }

    drawStroke(stroke, isCurrent = false) {
      const ctx = this.ctx;
      ctx.save();

      const tool = stroke.tool;
      const color = stroke.color;
      const size = stroke.size;

      if (tool === "marker") {
        ctx.globalAlpha = 0.45;
        ctx.globalCompositeOperation = "multiply";
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(14, size * 2.8);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }

      if (tool === "pen" || tool === "marker") {
        const points = stroke.points;
        if (!points || points.length === 0) {
          ctx.restore();
          return;
        }

        if (points.length === 1) {
          ctx.beginPath();
          ctx.arc(points[0].x, points[0].y, size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);

          // Quadratic curve smoothing
          for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
          }
          ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
          ctx.stroke();
        }
      } else if (tool === "rect") {
        const x = Math.min(stroke.start.x, stroke.end.x);
        const y = Math.min(stroke.start.y, stroke.end.y);
        const w = Math.abs(stroke.end.x - stroke.start.x);
        const h = Math.abs(stroke.end.y - stroke.start.y);

        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.stroke();
      } else if (tool === "circle") {
        const cx = (stroke.start.x + stroke.end.x) / 2;
        const cy = (stroke.start.y + stroke.end.y) / 2;
        const rx = Math.abs(stroke.end.x - stroke.start.x) / 2;
        const ry = Math.abs(stroke.end.y - stroke.start.y) / 2;

        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tool === "triangle") {
        const apexX = (stroke.start.x + stroke.end.x) / 2;
        const apexY = stroke.start.y;
        ctx.beginPath();
        ctx.moveTo(apexX, apexY);
        ctx.lineTo(stroke.start.x, stroke.end.y);
        ctx.lineTo(stroke.end.x, stroke.end.y);
        ctx.closePath();
        ctx.stroke();
      } else if (tool === "diamond") {
        const cx = (stroke.start.x + stroke.end.x) / 2;
        const cy = (stroke.start.y + stroke.end.y) / 2;
        ctx.beginPath();
        ctx.moveTo(cx, stroke.start.y);
        ctx.lineTo(stroke.end.x, cy);
        ctx.lineTo(cx, stroke.end.y);
        ctx.lineTo(stroke.start.x, cy);
        ctx.closePath();
        ctx.stroke();
      } else if (tool === "pentagon") {
        this.drawRegularPolygon(ctx, stroke.start, stroke.end, 5);
      } else if (tool === "hexagon") {
        this.drawRegularPolygon(ctx, stroke.start, stroke.end, 6);
      } else if (tool === "star") {
        this.drawStar(ctx, stroke.start, stroke.end, 5);
      } else if (tool === "line") {
        ctx.beginPath();
        ctx.moveTo(stroke.start.x, stroke.start.y);
        ctx.lineTo(stroke.end.x, stroke.end.y);
        ctx.stroke();
      } else if (tool === "arrow") {
        this.drawArrow(ctx, stroke.start.x, stroke.start.y, stroke.end.x, stroke.end.y, size);
      } else if (tool === "polygon") {
        if (stroke.points && stroke.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          if (stroke.closed) {
            ctx.closePath();
          }
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    drawRegularPolygon(ctx, start, end, sides) {
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      if (rx <= 0 || ry <= 0) return;

      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
        const x = cx + rx * Math.cos(angle);
        const y = cy + ry * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    drawStar(ctx, start, end, points = 5) {
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const outerR = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) / 2;
      const innerR = outerR * 0.45;
      if (outerR <= 0) return;

      ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI) / points - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    drawInProgressPolygon() {
      if (!this.activePolygonStroke || this.activePolygonStroke.points.length === 0) return;
      const ctx = this.ctx;
      const pts = this.activePolygonStroke.points;
      const mouse = this.currentPolygonMousePos;

      ctx.save();
      ctx.strokeStyle = this.activePolygonStroke.color;
      ctx.fillStyle = this.activePolygonStroke.color;
      ctx.lineWidth = this.activePolygonStroke.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Draw lines between existing vertices
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      if (mouse) {
        ctx.lineTo(mouse.x, mouse.y);
      }
      ctx.stroke();

      // Draw vertex handles
      pts.forEach((p, idx) => {
        ctx.beginPath();
        const r = idx === 0 ? 6 : 4;
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = idx === 0 ? "#10b981" : "#ffffff"; // Green start vertex
        ctx.fill();
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // If hovering near start point, highlight it
      if (mouse && pts.length >= 3) {
        const startP = pts[0];
        const dist = Math.hypot(mouse.x - startP.x, mouse.y - startP.y);
        if (dist < 18) {
          ctx.beginPath();
          ctx.arc(startP.x, startP.y, 10, 0, Math.PI * 2);
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    drawArrow(ctx, fromX, fromY, toX, toY, size) {
      const headLength = Math.max(12, size * 2.5);
      const angle = Math.atan2(toY - fromY, toX - fromX);

      // Shaft
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

      // Arrow head
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(
        toX - headLength * Math.cos(angle - Math.PI / 6),
        toY - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        toX - headLength * Math.cos(angle + Math.PI / 6),
        toY - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    }

    eraseAt(pos, clientX, clientY) {
      const radius = Math.max(15, this.size * 2);
      const prevCount = this.strokes.length;

      // Smart stroke eraser: remove strokes that are within radius of pos
      this.strokes = this.strokes.filter((stroke) => {
        if (stroke.points) {
          return !stroke.points.some((p) => {
            const dx = p.x - pos.x;
            const dy = p.y - pos.y;
            return dx * dx + dy * dy <= radius * radius;
          });
        } else if (stroke.start && stroke.end) {
          // Check midpoint or endpoints for shapes
          const midX = (stroke.start.x + stroke.end.x) / 2;
          const midY = (stroke.start.y + stroke.end.y) / 2;
          const d1 = (stroke.start.x - pos.x) ** 2 + (stroke.start.y - pos.y) ** 2;
          const d2 = (stroke.end.x - pos.x) ** 2 + (stroke.end.y - pos.y) ** 2;
          const d3 = (midX - pos.x) ** 2 + (midY - pos.y) ** 2;
          return d1 > radius * radius && d2 > radius * radius && d3 > radius * radius;
        }
        return true;
      });

      if (this.strokes.length !== prevCount) {
        this.redraw();
      }

      // Also erase highlighted text if eraser touches any <mark>
      if (typeof clientX === "number" && typeof clientY === "number") {
        this.eraseHighlightsAt(clientX, clientY);
      }
    }

    eraseHighlightsAt(clientX, clientY) {
      if (!this.highlighter) return;
      const radius = Math.max(16, this.size * 2.5);
      const marks = document.querySelectorAll("mark.safari-annotator-hl");
      const toRemove = new Set();

      marks.forEach((mark) => {
        const rect = mark.getBoundingClientRect();
        const intersects = (
          clientX >= rect.left - radius &&
          clientX <= rect.right + radius &&
          clientY >= rect.top - radius &&
          clientY <= rect.bottom + radius
        );
        if (intersects) {
          const hlId = mark.getAttribute("data-hl-id");
          if (hlId) {
            toRemove.add(hlId);
          }
        }
      });

      toRemove.forEach((hlId) => {
        this.highlighter.removeHighlight(hlId);
      });
      this.clearEraseCandidateHighlight();
    }

    previewEraserHover(clientX, clientY) {
      const radius = Math.max(16, this.size * 2.5);
      const marks = document.querySelectorAll("mark.safari-annotator-hl");
      let foundCandidate = false;

      marks.forEach((mark) => {
        const rect = mark.getBoundingClientRect();
        const intersects = (
          clientX >= rect.left - radius &&
          clientX <= rect.right + radius &&
          clientY >= rect.top - radius &&
          clientY <= rect.bottom + radius
        );
        if (intersects) {
          mark.classList.add("safari-annotator-hl-erase-candidate");
          foundCandidate = true;
        } else {
          mark.classList.remove("safari-annotator-hl-erase-candidate");
        }
      });

      if (!foundCandidate) {
        this.clearEraseCandidateHighlight();
      }
    }

    clearEraseCandidateHighlight() {
      document.querySelectorAll("mark.safari-annotator-hl-erase-candidate").forEach((m) => {
        m.classList.remove("safari-annotator-hl-erase-candidate");
      });
    }

    startLaserAnimation() {
      if (this.laserAnimId) return;
      const tick = () => {
        const now = Date.now();
        const maxAge = 1200;

        // Filter expired trail points
        this.laserTrail = this.laserTrail.filter((p) => now - p.time < maxAge);

        this.redraw();

        if (this.laserTrail.length > 0 || (this.tool === "laser" && this.laserMousePos)) {
          this.laserAnimId = requestAnimationFrame(tick);
        } else {
          this.laserAnimId = null;
          this.redraw();
        }
      };
      this.laserAnimId = requestAnimationFrame(tick);
    }

    drawLaser() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const now = Date.now();
      const maxAge = 1200;
      const trail = this.laserTrail;
      const laserColor = this.color || "#ff0033";

      // 1. Draw glowing fading laser trail
      if (trail && trail.length > 1) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        for (let i = 0; i < trail.length - 1; i++) {
          const p1 = trail[i];
          const p2 = trail[i + 1];
          const age = now - p2.time;
          const life = Math.max(0, 1 - age / maxAge); // 1.0 down to 0.0

          const baseSize = Math.max(6, this.size * 1.6);
          const width = baseSize * life;
          const alpha = life;

          // Outer glowing beam
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = laserColor;
          ctx.lineWidth = width * 2;
          ctx.globalAlpha = alpha * 0.4;
          ctx.shadowColor = laserColor;
          ctx.shadowBlur = 12 * life;
          ctx.stroke();

          // Intense core beam
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = Math.max(1.5, width * 0.5);
          ctx.globalAlpha = alpha * 0.95;
          ctx.shadowBlur = 0;
          ctx.stroke();
        }
        ctx.restore();
      }

      // 2. Draw glowing laser pointer dot at current mouse position
      if (this.tool === "laser" && this.laserMousePos) {
        ctx.save();
        const pos = this.laserMousePos;

        // Subtle pulsing halo
        const pulse = 1 + 0.15 * Math.sin(now / 140);
        const r = Math.max(7, this.size * 1.5) * pulse;

        // Outer glow
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 1.8, 0, Math.PI * 2);
        ctx.fillStyle = laserColor;
        ctx.globalAlpha = 0.35;
        ctx.shadowColor = laserColor;
        ctx.shadowBlur = 16;
        ctx.fill();

        // Inner beam dot
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = laserColor;
        ctx.globalAlpha = 0.9;
        ctx.fill();

        // Hot center
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
        ctx.fill();

        ctx.restore();
      }
    }

    redraw() {
      if (!this.ctx || !this.canvas) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      for (const stroke of this.strokes) {
        this.drawStroke(stroke);
      }

      if (this.currentStroke) {
        this.drawStroke(this.currentStroke, true);
      }

      if (this.activePolygonStroke) {
        this.drawInProgressPolygon();
      }

      this.drawLaser();
    }

    undo() {
      if (this.strokes.length === 0) return;
      const stroke = this.strokes.pop();
      this.redoStack.push(stroke);
      this.redraw();
    }

    redo() {
      if (this.redoStack.length === 0) return;
      const stroke = this.redoStack.pop();
      this.strokes.push(stroke);
      this.redraw();
    }

    clear() {
      if (this.strokes.length === 0) return;
      this.strokes = [];
      this.redoStack = [];
      this.redraw();
    }

    // --- Persistence (Save drawing explicitly as requested) ---
    async saveDrawing() {
      if (window.SafariAnnotatorStorage) {
        await window.SafariAnnotatorStorage.saveDrawing(this.strokes);
      }
    }

    async loadSavedDrawing() {
      if (!window.SafariAnnotatorStorage) return;
      const saved = await window.SafariAnnotatorStorage.getDrawing();
      if (Array.isArray(saved) && saved.length > 0) {
        this.strokes = saved;
        this.redraw();
      }
    }

    async clearSavedDrawing() {
      if (window.SafariAnnotatorStorage) {
        await window.SafariAnnotatorStorage.clearDrawing();
      }
      this.clear();
    }

    // --- Export Snapshot as PNG ---
    exportSnapshot() {
      // Find bounding box of drawings or visible viewport
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = viewW;
      exportCanvas.height = viewH;
      const expCtx = exportCanvas.getContext("2d");

      // Draw light background or transparent
      expCtx.fillStyle = "#ffffff";
      expCtx.fillRect(0, 0, viewW, viewH);

      // Crop the relevant region from our master canvas
      expCtx.drawImage(
        this.canvas,
        scrollX, scrollY, viewW, viewH,
        0, 0, viewW, viewH
      );

      // Create download trigger
      const link = document.createElement("a");
      link.download = `annotation-${document.title.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 30)}-${Date.now()}.png`;
      link.href = exportCanvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  window.SafariAnnotatorDrawer = DrawerEngine;
})();

/* ═══════════════════════════════════════════════════
   SKRIBBL CLIENT — CANVAS DRAWING ENGINE
   ═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Canvas Setup ──────────────────────────────────
  const canvas = document.getElementById('drawing-canvas');
  const ctx = canvas.getContext('2d');
  const wrapper = canvas.parentElement; // .canvas-wrapper

  // Canvas dimensions (fixed internal resolution)
  const CANVAS_W = 800;
  const CANVAS_H = 600;

  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  // ─── State ─────────────────────────────────────────
  let drawingEnabled = false;
  let isDrawingStroke = false; // mouse/touch is down
  let currentTool = 'pen';    // pen | eraser | fill
  let currentColor = '#000000';
  let currentSize = 4;
  let lastX = 0;
  let lastY = 0;

  // Undo history: array of ImageData snapshots
  let undoStack = [];
  const MAX_UNDO = 30;

  // ─── DOM Elements ──────────────────────────────────
  const swatches = document.querySelectorAll('.swatch');
  const sizeBtns = document.querySelectorAll('.size-btn');
  const toolBtns = document.querySelectorAll('.tool-btn[data-tool]');
  const undoBtn = document.getElementById('undo-btn');
  const clearBtn = document.getElementById('clear-btn');

  // ─── Cursor Preview ────────────────────────────────
  const cursorPreview = document.createElement('div');
  cursorPreview.className = 'cursor-preview';
  document.body.appendChild(cursorPreview);

  function updateCursorPreview(e) {
    if (!drawingEnabled || currentTool === 'fill') {
      cursorPreview.classList.remove('active');
      return;
    }
    cursorPreview.classList.add('active');
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / CANVAS_W;
    const displaySize = Math.max(currentSize * scaleX, 4);
    cursorPreview.style.width = displaySize + 'px';
    cursorPreview.style.height = displaySize + 'px';
    cursorPreview.style.left = e.clientX + 'px';
    cursorPreview.style.top = e.clientY + 'px';
    cursorPreview.style.borderColor = currentTool === 'eraser'
      ? 'rgba(150, 150, 150, 0.7)'
      : currentColor === '#ffffff'
        ? 'rgba(0,0,0,0.3)'
        : currentColor;
  }

  canvas.addEventListener('mousemove', updateCursorPreview);
  canvas.addEventListener('mouseenter', updateCursorPreview);
  canvas.addEventListener('mouseleave', () => {
    cursorPreview.classList.remove('active');
  });

  // ─── Socket reference ──────────────────────────────
  function getSocket() {
    return window.SkribblApp ? window.SkribblApp.socket : null;
  }

  // ─── Canvas Coordinate Helpers ─────────────────────
  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;

    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  // ─── Resize canvas to fit wrapper ──────────────────
  function resizeCanvas() {
    const wrapperRect = wrapper.getBoundingClientRect();
    const padding = 0;
    const maxW = wrapperRect.width - padding;
    const maxH = wrapperRect.height - padding;

    const ratio = CANVAS_W / CANVAS_H;
    let displayW = maxW;
    let displayH = maxW / ratio;

    if (displayH > maxH) {
      displayH = maxH;
      displayW = maxH * ratio;
    }

    canvas.style.width = Math.floor(displayW) + 'px';
    canvas.style.height = Math.floor(displayH) + 'px';
  }

  window.addEventListener('resize', resizeCanvas);
  // Initial resize after a short delay (DOM needs to settle)
  setTimeout(resizeCanvas, 100);

  // ─── Initialize Canvas ─────────────────────────────
  function initCanvas() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    canvas.style.touchAction = 'none'; // Prevent scrolling while drawing
    undoStack = [];
  }
  initCanvas();

  // ─── Undo Snapshot ─────────────────────────────────
  function pushUndo() {
    if (undoStack.length >= MAX_UNDO) {
      undoStack.shift();
    }
    undoStack.push(ctx.getImageData(0, 0, CANVAS_W, CANVAS_H));
  }

  // ─── Drawing Functions ─────────────────────────────

  function beginStroke(x, y, color, size, tool) {
    ctx.beginPath();
    ctx.moveTo(x, y);

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }
    ctx.lineWidth = size;

    // Draw a dot for single clicks
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  }

  function continueStroke(x, y) {
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function endStroke() {
    ctx.closePath();
    ctx.globalCompositeOperation = 'source-over';
  }

  // ─── Flood Fill Algorithm ──────────────────────────
  function floodFill(startX, startY, fillColor) {
    const sx = Math.round(startX);
    const sy = Math.round(startY);
    if (sx < 0 || sx >= CANVAS_W || sy < 0 || sy >= CANVAS_H) return;

    const imageData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    const data = imageData.data;
    const targetIdx = (sy * CANVAS_W + sx) * 4;
    const targetR = data[targetIdx];
    const targetG = data[targetIdx + 1];
    const targetB = data[targetIdx + 2];
    const targetA = data[targetIdx + 3];

    // Parse fill color
    const fill = hexToRgb(fillColor);
    if (!fill) return;

    // Don't fill if already the same color
    if (targetR === fill.r && targetG === fill.g && targetB === fill.b && targetA === 255) return;

    const tolerance = 32;
    const stack = [[sx, sy]];
    const visited = new Uint8Array(CANVAS_W * CANVAS_H);

    function matches(idx) {
      return (
        Math.abs(data[idx] - targetR) <= tolerance &&
        Math.abs(data[idx + 1] - targetG) <= tolerance &&
        Math.abs(data[idx + 2] - targetB) <= tolerance &&
        Math.abs(data[idx + 3] - targetA) <= tolerance
      );
    }

    while (stack.length > 0) {
      const [cx, cy] = stack.pop();
      const pixelIdx = cy * CANVAS_W + cx;

      if (cx < 0 || cx >= CANVAS_W || cy < 0 || cy >= CANVAS_H) continue;
      if (visited[pixelIdx]) continue;

      const dataIdx = pixelIdx * 4;
      if (!matches(dataIdx)) continue;

      visited[pixelIdx] = 1;
      data[dataIdx] = fill.r;
      data[dataIdx + 1] = fill.g;
      data[dataIdx + 2] = fill.b;
      data[dataIdx + 3] = 255;

      stack.push([cx + 1, cy]);
      stack.push([cx - 1, cy]);
      stack.push([cx, cy + 1]);
      stack.push([cx, cy - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : null;
  }

  // ─── Mouse Events ─────────────────────────────────
  canvas.addEventListener('mousedown', (e) => {
    if (!drawingEnabled) return;
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);

    if (currentTool === 'fill') {
      pushUndo();
      floodFill(x, y, currentColor);
      const socket = getSocket();
      if (socket) {
        socket.emit('fill', { x, y, color: currentColor });
      }
      return;
    }

    isDrawingStroke = true;
    lastX = x;
    lastY = y;
    pushUndo();
    beginStroke(x, y, currentColor, currentSize, currentTool);

    const socket = getSocket();
    if (socket) {
      socket.emit('draw', {
        type: 'begin',
        x, y,
        color: currentColor,
        size: currentSize,
        tool: currentTool,
      });
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!drawingEnabled || !isDrawingStroke) return;
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);

    continueStroke(x, y);
    lastX = x;
    lastY = y;

    const socket = getSocket();
    if (socket) {
      socket.emit('draw', { type: 'move', x, y });
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    if (!isDrawingStroke) return;
    isDrawingStroke = false;
    endStroke();

    const socket = getSocket();
    if (socket) {
      socket.emit('draw', { type: 'end' });
    }
  });

  canvas.addEventListener('mouseleave', (e) => {
    if (!isDrawingStroke) return;
    isDrawingStroke = false;
    endStroke();

    const socket = getSocket();
    if (socket) {
      socket.emit('draw', { type: 'end' });
    }
  });

  // ─── Touch Events ─────────────────────────────────
  canvas.addEventListener('touchstart', (e) => {
    if (!drawingEnabled) return;
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);

    if (currentTool === 'fill') {
      pushUndo();
      floodFill(x, y, currentColor);
      const socket = getSocket();
      if (socket) {
        socket.emit('fill', { x, y, color: currentColor });
      }
      return;
    }

    isDrawingStroke = true;
    lastX = x;
    lastY = y;
    pushUndo();
    beginStroke(x, y, currentColor, currentSize, currentTool);

    const socket = getSocket();
    if (socket) {
      socket.emit('draw', {
        type: 'begin',
        x, y,
        color: currentColor,
        size: currentSize,
        tool: currentTool,
      });
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (!drawingEnabled || !isDrawingStroke) return;
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);

    continueStroke(x, y);
    lastX = x;
    lastY = y;

    const socket = getSocket();
    if (socket) {
      socket.emit('draw', { type: 'move', x, y });
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (!isDrawingStroke) return;
    e.preventDefault();
    isDrawingStroke = false;
    endStroke();

    const socket = getSocket();
    if (socket) {
      socket.emit('draw', { type: 'end' });
    }
  });

  canvas.addEventListener('touchcancel', (e) => {
    if (!isDrawingStroke) return;
    isDrawingStroke = false;
    endStroke();

    const socket = getSocket();
    if (socket) {
      socket.emit('draw', { type: 'end' });
    }
  });

  // ─── Remote Draw (from other players) ──────────────
  let remoteState = {}; // track remote draw context

  function drawRemote(data) {
    switch (data.type) {
      case 'begin':
        remoteState.tool = data.tool;
        beginStroke(data.x, data.y, data.color, data.size, data.tool);
        break;
      case 'move':
        continueStroke(data.x, data.y);
        break;
      case 'end':
        endStroke();
        break;
    }
  }

  function fillRemote(data) {
    floodFill(data.x, data.y, data.color);
  }

  // ─── Replay Strokes (after undo broadcast) ─────────
  function replayStrokes(drawingData) {
    // Clear and redraw everything
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    drawingData.forEach(data => {
      if (data.type === 'fill') {
        floodFill(data.x, data.y, data.color);
      } else {
        drawRemote(data);
      }
    });
  }

  // ─── Clear Canvas ──────────────────────────────────
  function clearLocal() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    undoStack = [];
  }

  // ─── Color Swatches ────────────────────────────────
  function setActiveColor(color) {
    currentColor = color;
    swatches.forEach(s => {
      s.classList.toggle('active', s.dataset.color === color);
    });
    // If eraser is selected and user picks a color, switch to pen
    if (currentTool === 'eraser') {
      setActiveTool('pen');
    }
  }

  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      setActiveColor(swatch.dataset.color);
    });
  });

  // Set black as default active
  setActiveColor('#000000');

  // ─── Brush Sizes ───────────────────────────────────
  sizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentSize = parseInt(btn.dataset.size, 10);
      sizeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // ─── Tool Buttons ──────────────────────────────────
  function setActiveTool(tool) {
    currentTool = tool;
    toolBtns.forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Update cursor
    canvas.style.cursor = 'none';
    if (tool === 'fill') {
      canvas.style.cursor = 'crosshair';
      cursorPreview.classList.remove('active');
    }
  }

  toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveTool(btn.dataset.tool);
    });
  });

  // ─── Undo ──────────────────────────────────────────
  undoBtn.addEventListener('click', () => {
    if (!drawingEnabled) return;
    if (undoStack.length > 0) {
      const prevState = undoStack.pop();
      ctx.putImageData(prevState, 0, 0);

      const socket = getSocket();
      if (socket) {
        socket.emit('undoStroke');
      }
    }
  });

  // ─── Clear ─────────────────────────────────────────
  clearBtn.addEventListener('click', () => {
    if (!drawingEnabled) return;
    pushUndo();
    clearLocal();

    const socket = getSocket();
    if (socket) {
      socket.emit('clearCanvas');
    }
  });

  // ─── Keyboard Shortcuts ────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (!drawingEnabled) return;
    // Only when not typing in chat
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undoBtn.click();
    }
  });

  // ─── Enable/Disable Drawing ────────────────────────
  function setDrawingEnabled(enabled) {
    drawingEnabled = enabled;
    if (enabled) {
      canvas.style.cursor = 'none';
      resizeCanvas();
    } else {
      canvas.style.cursor = 'default';
      cursorPreview.classList.remove('active');
    }
  }

  // ─── Expose API for app.js ─────────────────────────
  window.SkribblCanvas = {
    setDrawingEnabled,
    clearLocal,
    drawRemote,
    fillRemote,
    replayStrokes,
    resizeCanvas,
  };

  // ─── Observer: resize canvas when game screen becomes visible ──
  const gameScreen = document.getElementById('game-screen');
  const observer = new MutationObserver(() => {
    if (gameScreen.classList.contains('active')) {
      setTimeout(resizeCanvas, 50);
    }
  });
  observer.observe(gameScreen, { attributes: true, attributeFilter: ['class'] });

  console.log('🖌️ Skribbl canvas engine loaded!');

})();

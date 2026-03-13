const ContextMenu = require('../components/ContextMenu.js')

function initSelectTool(state, ctx, canvas, helpers) {
  const {
    getElementBounds,
    hitTest,
    findElementAt,
    redrawCanvas,
    updateSelectionOnly,
    saveState,
    playSound,
    getToolbarPositionManager,
  } = helpers;
  const HANDLE_SIZE = 8;
  const PADDING = 4;
  const SELECTION_COLOR = "#3b82f6";
  const HANDLE_ANGLES = [
    { angle: 0, type: "e" },
    { angle: Math.PI / 4, type: "se" },
    { angle: Math.PI / 2, type: "s" },
    { angle: (3 * Math.PI) / 4, type: "sw" },
    { angle: Math.PI, type: "w" },
    { angle: (5 * Math.PI) / 4, type: "nw" },
    { angle: (3 * Math.PI) / 2, type: "n" },
    { angle: (7 * Math.PI) / 4, type: "ne" },
  ];
  const CURSOR_MAP = {
    nw: "nw-resize",
    n: "n-resize",
    ne: "ne-resize",
    e: "e-resize",
    se: "se-resize",
    s: "s-resize",
    sw: "sw-resize",
    w: "w-resize",
    rotation: "crosshair",
  };

  let activeGuides = [];
  const SNAP_THRESHOLD = 5;

  const updateSelection = () =>
    updateSelectionOnly ? updateSelectionOnly() : redrawCanvas();

  const getElement = (id) => state.elements.find((e) => e.id === id);

  const getSelectedElements = () =>
    state.selectedElements.map((id) => getElement(id)).filter(Boolean);

  function getCombinedBounds() {
    const elements = getSelectedElements();
    if (elements.length === 0) return null;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const element of elements) {
      const bounds = getElementBounds(element);
      if (bounds) {
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.width);
        maxY = Math.max(maxY, bounds.y + bounds.height);
      }
    }

    if (minX === Infinity) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }
  function selectElement(elementId, addToSelection = false) {
    if (!addToSelection) state.selectedElements = [];
    if (!state.selectedElements.includes(elementId)) {
      state.selectedElements.push(elementId);
    }
    updateSelection();
  }

  function deselectElement(elementId) {
    state.selectedElements = state.selectedElements.filter(
      (id) => id !== elementId
    );
    if (state.hoveredElementId === elementId) state.hoveredElementId = null;
    updateSelection();
  }

  function clearSelection() {
    state.selectedElements = [];
    state.hoveredElementId = null;
    updateSelection();
  }

  function selectAllElements() {
    if (state.elements.length === 0) return;
    state.selectedElements = state.elements.map((e) => e.id);
    updateSelection();
    playSound("selectAll");
  }

  function deleteSelectedElements() {
    if (state.selectedElements.length === 0) return;
    hideContextMenu();
    const selectedSet = new Set(state.selectedElements);
    state.elements = state.elements.filter((e) => !selectedSet.has(e.id));
    state.selectedElements = [];
    redrawCanvas();
    saveState();
    playSound("trash");
  }

  function storeInitialState(element) {
    if (element.type === "stroke" && element.points) {
      element._initialPoints = element.points.map((p) => ({ x: p.x, y: p.y }));
      const bounds = getElementBounds(element);
      if (bounds) element._initialBounds = { ...bounds };
    } else if (element.type === "shape") {
      element._initialStart = { x: element.start.x, y: element.start.y };
      element._initialEnd = { x: element.end.x, y: element.end.y };
    } else if (element.type === "text") {
      element._initialPos = { x: element.x, y: element.y };
      element._initialFontSize =
        element.fontSize || Math.max(12, element.strokeSize * 4);
      const bounds = getElementBounds(element);
      element._initialBounds = { ...bounds };
    } else if (element.type === "stickyNote") {
      element._initialPos = { x: element.x, y: element.y };
      element._initialSize = { width: element.width || 280, height: element.height || 280 };
    }
  }

  function cleanupTempState(element) {
    delete element._initialPoints;
    delete element._initialStart;
    delete element._initialEnd;
    delete element._initialPos;
    delete element._initialFontSize;
    delete element._initialBounds;
    delete element._initialSize;
  }

  function moveSelectedElements(totalDeltaX, totalDeltaY) {
    let hasChanges = false;
    for (const elementId of state.selectedElements) {
      const element = getElement(elementId);
      if (!element) continue;
      element._dirty = true;

      if (element.type === "stroke" && element._initialPoints) {
        element.points.forEach((p, i) => {
          if (element._initialPoints[i]) {
            const newX = element._initialPoints[i].x + totalDeltaX;
            const newY = element._initialPoints[i].y + totalDeltaY;
            if (p.x !== newX || p.y !== newY) {
              p.x = newX;
              p.y = newY;
              hasChanges = true;
            }
          }
        });
      } else if (
        element.type === "shape" &&
        element._initialStart &&
        element._initialEnd
      ) {
        const newStartX = element._initialStart.x + totalDeltaX;
        const newStartY = element._initialStart.y + totalDeltaY;
        const newEndX = element._initialEnd.x + totalDeltaX;
        const newEndY = element._initialEnd.y + totalDeltaY;
        if (
          element.start.x !== newStartX ||
          element.start.y !== newStartY ||
          element.end.x !== newEndX ||
          element.end.y !== newEndY
        ) {
          element.start.x = newStartX;
          element.start.y = newStartY;
          element.end.x = newEndX;
          element.end.y = newEndY;
          hasChanges = true;
        }
      } else if (element.type === "text" && element._initialPos) {
        const newX = element._initialPos.x + totalDeltaX;
        const newY = element._initialPos.y + totalDeltaY;
        if (element.x !== newX || element.y !== newY) {
          element.x = newX;
          element.y = newY;
          hasChanges = true;
        }
      } else if (element.type === "stickyNote" && element._initialPos) {
        const newX = element._initialPos.x + totalDeltaX;
        const newY = element._initialPos.y + totalDeltaY;
        if (element.x !== newX || element.y !== newY) {
          element.x = newX;
          element.y = newY;
          hasChanges = true;
        }
      }
    }
    if (hasChanges) redrawCanvas();
  }

  function getResizeHandleAt(x, y) {
    if (state.selectedElements.length === 0) return null;

    if (state.selectedElements.length === 1) {
      const element = getElement(state.selectedElements[0]);
      if (
        element &&
        element.type === "shape" &&
        element.shapeType === "circle"
      ) {
        const w = Math.abs(element.end.x - element.start.x);
        const h = Math.abs(element.end.y - element.start.y);
        const centerX = (element.start.x + element.end.x) / 2;
        const centerY = (element.start.y + element.end.y) / 2;
        const radius = Math.sqrt(w * w + h * h) / 2;
        const handleRadius = radius + PADDING;

        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (Math.abs(distance - handleRadius) <= HANDLE_SIZE / 2) {
          const angle = Math.atan2(dy, dx);
          const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;

          let closestHandle = HANDLE_ANGLES[0];
          let minDiff = Math.abs(normalizedAngle - HANDLE_ANGLES[0].angle);
          for (const handle of HANDLE_ANGLES) {
            let diff = Math.abs(normalizedAngle - handle.angle);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;
            if (diff < minDiff) {
              minDiff = diff;
              closestHandle = handle;
            }
          }
          return minDiff < Math.PI / 8 ? closestHandle.type : null;
        }
        return null;
      }

      if (element) {
        const rotation = element.rotation || 0;
        const unrotatedBounds = getElementBounds(element, true);
        if (unrotatedBounds) {
          const centerX = unrotatedBounds.x + unrotatedBounds.width / 2;
          const centerY = unrotatedBounds.y + unrotatedBounds.height / 2;
          
          const cos = Math.cos(-rotation);
          const sin = Math.sin(-rotation);
          const dx = x - centerX;
          const dy = y - centerY;
          const tx = centerX + (dx * cos - dy * sin);
          const ty = centerY + (dx * sin + dy * cos);

          const borderX = unrotatedBounds.x - PADDING;
          const borderY = unrotatedBounds.y - PADDING;
          const borderW = unrotatedBounds.width + PADDING * 2;
          const borderH = unrotatedBounds.height + PADDING * 2;
          const halfHandle = HANDLE_SIZE / 2;

          const handles = [
            { x: borderX + halfHandle, y: borderY + halfHandle, type: "nw" },
            { x: borderX + borderW / 2, y: borderY + halfHandle, type: "n" },
            { x: borderX + borderW - halfHandle, y: borderY + halfHandle, type: "ne" },
            { x: borderX + borderW - halfHandle, y: borderY + borderH / 2, type: "e" },
            { x: borderX + borderW - halfHandle, y: borderY + borderH - halfHandle, type: "se" },
            { x: borderX + borderW / 2, y: borderY + borderH - halfHandle, type: "s" },
            { x: borderX + halfHandle, y: borderY + borderH - halfHandle, type: "sw" },
            { x: borderX + halfHandle, y: borderY + borderH / 2, type: "w" },
            { x: borderX + borderW / 2, y: borderY - 25, type: "rotation" }
          ];

          for (const handle of handles) {
            const hdx = tx - handle.x;
            const hdy = ty - handle.y;
            const hitRadius = handle.type === 'rotation' ? (HANDLE_SIZE / 2 + 5) : (HANDLE_SIZE / 2 + 2);
            if (hdx * hdx + hdy * hdy <= hitRadius ** 2) return handle.type;
          }
          return null;
        }
      }
    }

    const bounds = getCombinedBounds();
    if (!bounds) return null;

    const borderX = bounds.x - PADDING;
    const borderY = bounds.y - PADDING;
    const borderW = bounds.width + PADDING * 2;
    const borderH = bounds.height + PADDING * 2;
    const halfHandle = HANDLE_SIZE / 2;

    const handles = [
      {
        x: Math.round(borderX + halfHandle),
        y: Math.round(borderY + halfHandle),
        type: "nw",
      },
      {
        x: Math.round(borderX + borderW / 2),
        y: Math.round(borderY + halfHandle),
        type: "n",
      },
      {
        x: Math.round(borderX + borderW - halfHandle),
        y: Math.round(borderY + halfHandle),
        type: "ne",
      },
      {
        x: Math.round(borderX + borderW - halfHandle),
        y: Math.round(borderY + borderH / 2),
        type: "e",
      },
      {
        x: Math.round(borderX + borderW - halfHandle),
        y: Math.round(borderY + borderH - halfHandle),
        type: "se",
      },
      {
        x: Math.round(borderX + borderW / 2),
        y: Math.round(borderY + borderH - halfHandle),
        type: "s",
      },
      {
        x: Math.round(borderX + halfHandle),
        y: Math.round(borderY + borderH - halfHandle),
        type: "sw",
      },
      {
        x: Math.round(borderX + halfHandle),
        y: Math.round(borderY + borderH / 2),
        type: "w",
      },
    ];

    for (const handle of handles) {
      const dx = x - handle.x;
      const dy = y - handle.y;
      if (dx * dx + dy * dy <= (HANDLE_SIZE / 2 + 2) ** 2) {
        return handle.type;
      }
    }
    return null;
  }

  function resizeSelectedElement(handle, totalDeltaX, totalDeltaY) {
    if (state.selectedElements.length === 0 || !state.resizeStartBounds) return;

    const calcBounds = state.resizeStartBounds;
    let newX = calcBounds.x,
      newY = calcBounds.y,
      newWidth = calcBounds.width,
      newHeight = calcBounds.height;

    if (handle.includes("e")) newWidth = calcBounds.width + totalDeltaX;
    if (handle.includes("w")) {
      newX = calcBounds.x + totalDeltaX;
      newWidth = calcBounds.width - totalDeltaX;
    }
    if (handle.includes("s")) newHeight = calcBounds.height + totalDeltaY;
    if (handle.includes("n")) {
      newY = calcBounds.y + totalDeltaY;
      newHeight = calcBounds.height - totalDeltaY;
    }

    const isSingleSticky = state.selectedElements.length === 1 && getElement(state.selectedElements[0])?.type === 'stickyNote';
    const MIN_W = isSingleSticky ? 300 : 10;
    const MIN_H = isSingleSticky ? 300 : 10;
    const MAX_W = Infinity;
    const MAX_H = Infinity;

    if (newWidth < MIN_W) {
      newWidth = MIN_W;
      if (handle.includes("w")) newX = calcBounds.x + calcBounds.width - MIN_W;
    } else if (newWidth > MAX_W) {
      newWidth = MAX_W;
      if (handle.includes("w")) newX = calcBounds.x + calcBounds.width - MAX_W;
    }

    if (newHeight < MIN_H) {
      newHeight = MIN_H;
      if (handle.includes("n")) newY = calcBounds.y + calcBounds.height - MIN_H;
    } else if (newHeight > MAX_H) {
      newHeight = MAX_H;
      if (handle.includes("n")) newY = calcBounds.y + calcBounds.height - MAX_H;
    }

    const scaleX = newWidth / calcBounds.width;
    const scaleY = newHeight / calcBounds.height;
    const offsetX = newX - calcBounds.x;
    const offsetY = newY - calcBounds.y;

    let corrX = 0;
    let corrY = 0;
    
    if (state.selectedElements.length === 1) {
      const element = getElement(state.selectedElements[0]);
      if (element && element.rotation) {
        const cx = calcBounds.x + calcBounds.width / 2;
        const cy = calcBounds.y + calcBounds.height / 2;
        const ncx = newX + newWidth / 2;
        const ncy = newY + newHeight / 2;
        
        const dcx = ncx - cx;
        const dcy = ncy - cy;
        
        const cos = Math.cos(element.rotation);
        const sin = Math.sin(element.rotation);
        
        corrX = (dcx * cos - dcy * sin) - dcx;
        corrY = (dcx * sin + dcy * cos) - dcy;
      }
    }

    for (const elementId of state.selectedElements) {
      const element = getElement(elementId);
      if (!element) continue;
      element._dirty = true;

      if (
        element.type === "shape" &&
        element._initialStart &&
        element._initialEnd
      ) {
        const relStartX = element._initialStart.x - calcBounds.x;
        const relStartY = element._initialStart.y - calcBounds.y;
        const relEndX = element._initialEnd.x - calcBounds.x;
        const relEndY = element._initialEnd.y - calcBounds.y;

        element.start.x = calcBounds.x + offsetX + relStartX * scaleX + corrX;
        element.start.y = calcBounds.y + offsetY + relStartY * scaleY + corrY;
        element.end.x = calcBounds.x + offsetX + relEndX * scaleX + corrX;
        element.end.y = calcBounds.y + offsetY + relEndY * scaleY + corrY;
      } else if (
        element.type === "text" &&
        element._initialPos &&
        element._initialFontSize &&
        element._initialBounds
      ) {
        const scale = Math.min(scaleX, scaleY);
        element.fontSize = element._initialFontSize * scale;
        element.strokeSize = Math.max(1, Math.floor(element.fontSize / 4));

        const relX = element._initialPos.x - calcBounds.x;
        const relY = element._initialPos.y - calcBounds.y;
        element.x = calcBounds.x + offsetX + relX * scaleX + corrX;
        element.y = calcBounds.y + offsetY + relY * scaleY + corrY;
      } else if (
        element.type === "stroke" &&
        element._initialPoints &&
        element._initialBounds
      ) {
        element.points.forEach((p, i) => {
          if (element._initialPoints[i]) {
            const relX = element._initialPoints[i].x - calcBounds.x;
            const relY = element._initialPoints[i].y - calcBounds.y;
            p.x = calcBounds.x + offsetX + relX * scaleX + corrX;
            p.y = calcBounds.y + offsetY + relY * scaleY + corrY;
          }
        });
      } else if (element.type === "stickyNote" && element._initialPos && element._initialSize) {
        const relX = element._initialPos.x - calcBounds.x;
        const relY = element._initialPos.y - calcBounds.y;
        
        element.x = calcBounds.x + offsetX + relX * scaleX + corrX;
        element.y = calcBounds.y + offsetY + relY * scaleY + corrY;
        element.width = element._initialSize.width * scaleX;
        element.height = element._initialSize.height * scaleY;
      }
    }

    redrawCanvas();
  }

  function drawHandle(overlayCtx, x, y, color = SELECTION_COLOR) {
    overlayCtx.save();
    overlayCtx.fillStyle = color;
    overlayCtx.strokeStyle = "#ffffff";
    overlayCtx.lineWidth = 2;
    overlayCtx.globalAlpha = 1.0;
    const handleX = Math.round(x - HANDLE_SIZE / 2);
    const handleY = Math.round(y - HANDLE_SIZE / 2);
    overlayCtx.beginPath();
    overlayCtx.rect(handleX, handleY, HANDLE_SIZE, HANDLE_SIZE);
    overlayCtx.fill();
    overlayCtx.stroke();
    overlayCtx.restore();
  }

  function drawSelectionBorder(
    overlayCtx,
    x,
    y,
    w,
    h,
    color = SELECTION_COLOR
  ) {
    overlayCtx.save();
    overlayCtx.strokeStyle = color;
    overlayCtx.lineWidth = 2;
    overlayCtx.setLineDash([5, 5]);
    overlayCtx.globalAlpha = 1.0;
    overlayCtx.beginPath();
    overlayCtx.rect(x, y, w, h);
    overlayCtx.stroke();
    overlayCtx.restore();
  }

  function drawAlignmentGuides(overlayCtx) {
    if (activeGuides.length === 0) return;

    overlayCtx.save();
    overlayCtx.strokeStyle = "#d946ef";
    overlayCtx.lineWidth = 1;
    overlayCtx.setLineDash([4, 4]);
    overlayCtx.globalAlpha = 0.6;
    overlayCtx.beginPath();

    activeGuides.forEach((guide) => {
      if (guide.type === "x") {
        overlayCtx.moveTo(guide.pos, 0);
        overlayCtx.lineTo(guide.pos, overlayCtx.canvas.height);
      } else {
        overlayCtx.moveTo(0, guide.pos);
        overlayCtx.lineTo(overlayCtx.canvas.width, guide.pos);
      }
    });

    overlayCtx.stroke();
    overlayCtx.restore();
  }

  function drawRotationHandle(overlayCtx, x, y, color = "#10b981") {
    overlayCtx.save();
    
    overlayCtx.strokeStyle = color;
    overlayCtx.lineWidth = 1.5;
    overlayCtx.setLineDash([2, 2]);
    overlayCtx.beginPath();
    overlayCtx.moveTo(x, y + 25);
    overlayCtx.lineTo(x, y);
    overlayCtx.stroke();
    
    overlayCtx.fillStyle = color;
    overlayCtx.strokeStyle = "#ffffff";
    overlayCtx.lineWidth = 2;
    overlayCtx.setLineDash([]);
    overlayCtx.beginPath();
    overlayCtx.arc(x, y, HANDLE_SIZE / 2 + 1, 0, Math.PI * 2);
    overlayCtx.fill();
    overlayCtx.stroke();
    
    overlayCtx.restore();
  }

  function drawSelectionIndicators(overlayCtx = ctx) {
    drawAlignmentGuides(overlayCtx);
    if (state.selectedElements.length === 0) return;

    overlayCtx.save();
    overlayCtx.globalCompositeOperation = "source-over";
    overlayCtx.setLineDash([]);
    overlayCtx.globalAlpha = 1.0;

    if (state.selectedElements.length === 1) {
      const element = getElement(state.selectedElements[0]);
      if (!element) {
        overlayCtx.restore();
        return;
      }

      const isEditing = element.id === state.editingElementId;
      const rotation = isEditing ? 0 : (element.rotation || 0);
      const unrotatedBounds = getElementBounds(element, true);
      if (!unrotatedBounds) {
        overlayCtx.restore();
        return;
      }

      const centerX = unrotatedBounds.x + unrotatedBounds.width / 2;
      const centerY = unrotatedBounds.y + unrotatedBounds.height / 2;

      overlayCtx.save();
      overlayCtx.translate(centerX, centerY);
      overlayCtx.rotate(rotation);
      overlayCtx.translate(-centerX, -centerY);

      const borderX = unrotatedBounds.x - PADDING;
      const borderY = unrotatedBounds.y - PADDING;
      const borderW = unrotatedBounds.width + PADDING * 2;
      const borderH = unrotatedBounds.height + PADDING * 2;

      if (element.type === "shape" && element.shapeType === "circle") {
         const radius = Math.sqrt(Math.pow(element.end.x - element.start.x, 2) + Math.pow(element.end.y - element.start.y, 2)) / 2;
         overlayCtx.save();
         overlayCtx.strokeStyle = SELECTION_COLOR;
         overlayCtx.lineWidth = 2;
         overlayCtx.setLineDash([5, 5]);
         overlayCtx.beginPath();
         overlayCtx.arc(centerX, centerY, radius + PADDING, 0, Math.PI * 2);
         overlayCtx.stroke();
         overlayCtx.restore();

         if (!state.editingElementId) {
           const handleRadius = radius + PADDING;
           HANDLE_ANGLES.forEach((handle) => {
             const hX = Math.round(centerX + Math.cos(handle.angle) * handleRadius);
             const hY = Math.round(centerY + Math.sin(handle.angle) * handleRadius);
             drawHandle(overlayCtx, hX, hY);
           });
           drawRotationHandle(overlayCtx, centerX, centerY - handleRadius - 25);
         }
      } else {
        drawSelectionBorder(overlayCtx, borderX, borderY, borderW, borderH);
        
        if (!state.editingElementId) {
          const halfHandle = HANDLE_SIZE / 2;
          const handles = [
            { x: borderX + halfHandle, y: borderY + halfHandle },
            { x: borderX + borderW / 2, y: borderY + halfHandle },
            { x: borderX + borderW - halfHandle, y: borderY + halfHandle },
            { x: borderX + borderW - halfHandle, y: borderY + borderH / 2 },
            { x: borderX + borderW - halfHandle, y: borderY + borderH - halfHandle },
            { x: borderX + borderW / 2, y: borderY + borderH - halfHandle },
            { x: borderX + halfHandle, y: borderY + borderH - halfHandle },
            { x: borderX + halfHandle, y: borderY + borderH / 2 },
          ];
          handles.forEach(h => drawHandle(overlayCtx, h.x, h.y));
          drawRotationHandle(overlayCtx, borderX + borderW / 2, borderY - 25);
        }
      }

      if (state.isRotating) {
        const degrees = Math.round((rotation * 180) / Math.PI) % 360;
        
        const unrotatedLabelX = borderX + borderW / 2;
        const unrotatedLabelY = borderY - 55;
        
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const dx = unrotatedLabelX - centerX;
        const dy = unrotatedLabelY - centerY;
        const screenX = (centerX + (dx * cos - dy * sin)) + state.panX;
        const screenY = (centerY + (dx * sin + dy * cos)) + state.panY;

        overlayCtx.save();
        overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
        overlayCtx.setLineDash([]);
        overlayCtx.fillStyle = "rgba(0, 0, 0, 0.85)";
        overlayCtx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        
        const text = `${degrees}°`;
        const metrics = overlayCtx.measureText(text);
        const padding = 8;
        const labelW = metrics.width + padding * 2;
        const labelH = 22;
        const lx = screenX - labelW / 2;
        const ly = screenY - labelH / 2;
        
        overlayCtx.beginPath();
        overlayCtx.roundRect(lx, ly, labelW, labelH, 6);
        overlayCtx.fill();
        
        overlayCtx.fillStyle = "white";
        overlayCtx.textAlign = "center";
        overlayCtx.textBaseline = "middle";
        overlayCtx.fillText(text, lx + labelW / 2, ly + labelH / 2);
        overlayCtx.restore();
      }

      overlayCtx.restore();
    } else if (state.selectedElements.length > 1) {
      const combinedBounds = getCombinedBounds();
      if (combinedBounds) {
        const borderX = combinedBounds.x - PADDING;
        const borderY = combinedBounds.y - PADDING;
        const borderW = combinedBounds.width + PADDING * 2;
        const borderH = combinedBounds.height + PADDING * 2;

        overlayCtx.save();
        overlayCtx.strokeStyle = SELECTION_COLOR;
        overlayCtx.lineWidth = 2;
        overlayCtx.setLineDash([8, 4]);
        overlayCtx.globalAlpha = 0.8;
        overlayCtx.beginPath();
        overlayCtx.rect(borderX - 2, borderY - 2, borderW + 4, borderH + 4);
        overlayCtx.stroke();
        overlayCtx.restore();

        if (!state.editingElementId) {
          const halfHandle = HANDLE_SIZE / 2;
          const handles = [
            { x: borderX + halfHandle, y: borderY + halfHandle },
            { x: borderX + borderW / 2, y: borderY + halfHandle },
            { x: borderX + borderW - halfHandle, y: borderY + halfHandle },
            { x: borderX + borderW - halfHandle, y: borderY + borderH / 2 },
            { x: borderX + borderW - halfHandle, y: borderY + borderH - halfHandle },
            { x: borderX + borderW / 2, y: borderY + borderH - halfHandle },
            { x: borderX + halfHandle, y: borderY + borderH - halfHandle },
            { x: borderX + halfHandle, y: borderY + borderH / 2 }
          ];
          handles.forEach(h => drawHandle(overlayCtx, h.x, h.y));
        }
      }
    }

    overlayCtx.restore();
  }

  function drawSelectionBox(overlayCtx = ctx) {
    if (!state.selectionStart || !state.selectionEnd) return;

    const x = Math.min(state.selectionStart.x, state.selectionEnd.x);
    const y = Math.min(state.selectionStart.y, state.selectionEnd.y);
    const w = Math.abs(state.selectionEnd.x - state.selectionStart.x);
    const h = Math.abs(state.selectionEnd.y - state.selectionStart.y);

    overlayCtx.save();
    overlayCtx.strokeStyle = SELECTION_COLOR;
    overlayCtx.lineWidth = 2;
    overlayCtx.setLineDash([5, 5]);
    overlayCtx.globalAlpha = 1.0;
    overlayCtx.globalCompositeOperation = "source-over";
    overlayCtx.beginPath();
    overlayCtx.rect(x, y, w, h);
    overlayCtx.stroke();
    overlayCtx.restore();
  }

  function selectElementsInBox() {
    if (!state.selectionStart || !state.selectionEnd) return;

    const x = Math.min(state.selectionStart.x, state.selectionEnd.x);
    const y = Math.min(state.selectionStart.y, state.selectionEnd.y);
    const w = Math.abs(state.selectionEnd.x - state.selectionStart.x);
    const h = Math.abs(state.selectionEnd.y - state.selectionStart.y);

    const selectedInBox = [];
    for (const element of state.elements) {
      const bounds = getElementBounds(element);
      if (bounds) {
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;
        if (
          centerX >= x &&
          centerX <= x + w &&
          centerY >= y &&
          centerY <= y + h
        ) {
          selectedInBox.push(element.id);
        }
      }
    }

    if (selectedInBox.length > 0) {
      state.selectedElements = [
        ...new Set([...state.selectedElements, ...selectedInBox]),
      ];
    }
  }

  function handleSelectStart(e, coords) {
    if (e.button === 2) {
      const clickedElement = findElementAt(coords.x, coords.y);
      if (clickedElement) {
        e.preventDefault();
        showContextMenu(e, clickedElement);
        return true;
      }
      return false;
    }

    const resizeHandle = getResizeHandleAt(coords.x, coords.y);
    if (resizeHandle && state.selectedElements.length > 0) {
      if (resizeHandle === 'rotation' && state.selectedElements.length === 1) {
        state.isRotating = true;
        const element = getElement(state.selectedElements[0]);
        state.resizeStartBounds = getElementBounds(element, true);
        state.initialRotation = element.rotation || 0;
        
        const center = {
          x: state.resizeStartBounds.x + state.resizeStartBounds.width / 2,
          y: state.resizeStartBounds.y + state.resizeStartBounds.height / 2
        };
        state.rotationStartAngle = Math.atan2(coords.y - center.y, coords.x - center.x);
        
        getSelectedElements().forEach(el => {
          el._baseRotation = el.rotation || 0;
        });
        
        return true;
      }

      state.isResizing = true;
      state.resizeHandle = resizeHandle;
      state.resizeStartBounds = getCombinedBounds();
      if (state.selectedElements.length === 1) {
        const element = getElement(state.selectedElements[0]);
        if (element && element.rotation) {
          state.resizeStartBounds = getElementBounds(element, true);
        }
      }
      getSelectedElements().forEach((element) => storeInitialState(element));
      state.dragOffset = coords;
      return true;
    }

    state.dragStartBounds = getCombinedBounds();

    const clickedElement = findElementAt(coords.x, coords.y);
    if (clickedElement) {
      const isSelected = state.selectedElements.includes(clickedElement.id);
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        if (isSelected) {
          deselectElement(clickedElement.id);
        } else {
          selectElement(clickedElement.id, true);
        }
      } else {
        if (!isSelected) {
          clearSelection();
          selectElement(clickedElement.id);
        }
        state.isDraggingSelection = true;
        state.dragOffset = coords;
        getSelectedElements().forEach((element) => storeInitialState(element));
      }
      return true;
    } else {
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) clearSelection();
      state.isSelecting = true;
      state.selectionStart = coords;
      state.selectionEnd = coords;
      return true;
    }
  }

  function handleSelectDraw(coords) {
    if (state.isResizing) {
      if (
        state.selectedElements.length > 0 &&
        state.resizeHandle &&
        state.dragOffset &&
        state.resizeStartBounds
      ) {
        let totalDeltaX = coords.x - state.dragOffset.x;
        let totalDeltaY = coords.y - state.dragOffset.y;
        
        if (state.selectedElements.length === 1) {
          const element = getElement(state.selectedElements[0]);
          if (element && element.rotation) {
            const cos = Math.cos(-element.rotation);
            const sin = Math.sin(-element.rotation);
            const localDx = totalDeltaX * cos - totalDeltaY * sin;
            const localDy = totalDeltaX * sin + totalDeltaY * cos;
            totalDeltaX = localDx;
            totalDeltaY = localDy;
          }
        }

        if (Math.abs(totalDeltaX) > 0.5 || Math.abs(totalDeltaY) > 0.5) {
          resizeSelectedElement(state.resizeHandle, totalDeltaX, totalDeltaY);
        }
      }
      return true;
    }

    if (state.isRotating && state.resizeStartBounds) {
      const center = {
        x: state.resizeStartBounds.x + state.resizeStartBounds.width / 2,
        y: state.resizeStartBounds.y + state.resizeStartBounds.height / 2
      };
      const currentMouseAngle = Math.atan2(coords.y - center.y, coords.x - center.x);
      const deltaRotation = currentMouseAngle - state.rotationStartAngle;
      
      getSelectedElements().forEach(el => {
        el.rotation = (el._baseRotation || 0) + deltaRotation;
        el._dirty = true;
      });
      
      redrawCanvas();
      return true;
    }

    if (state.isDraggingSelection) {
      if (
        state.selectedElements.length > 0 &&
        state.dragOffset &&
        state.dragStartBounds
      ) {
        let totalDeltaX = coords.x - state.dragOffset.x;
        let totalDeltaY = coords.y - state.dragOffset.y;

        activeGuides = [];
        if (state.snapToObjectsEnabled) {
          const dragBounds = state.dragStartBounds;

          let proposedX = dragBounds.x + totalDeltaX;
          let proposedY = dragBounds.y + totalDeltaY;

          let minDiffX = SNAP_THRESHOLD;
          let minDiffY = SNAP_THRESHOLD;
          let snapX = null;
          let snapY = null;

          const myPointsX = [
            proposedX,
            proposedX + dragBounds.width / 2,
            proposedX + dragBounds.width,
          ];
          const myPointsY = [
            proposedY,
            proposedY + dragBounds.height / 2,
            proposedY + dragBounds.height,
          ];

          state.elements.forEach((el) => {
            if (state.selectedElements.includes(el.id)) return;
            const b = getElementBounds(el);
            if (!b) return;

            const targetX = [b.x, b.x + b.width / 2, b.x + b.width];
            const targetY = [b.y, b.y + b.height / 2, b.y + b.height];

            myPointsX.forEach((mx, i) => {
              targetX.forEach((tx) => {
                const diff = Math.abs(mx - tx);
                if (diff < minDiffX) {
                  minDiffX = diff;
                  const origPoint =
                    i === 0
                      ? dragBounds.x
                      : i === 1
                        ? dragBounds.x + dragBounds.width / 2
                        : dragBounds.x + dragBounds.width;
                  snapX = tx - origPoint;
                }
              });
            });

            myPointsY.forEach((my, i) => {
              targetY.forEach((ty) => {
                const diff = Math.abs(my - ty);
                if (diff < minDiffY) {
                  minDiffY = diff;
                  const origPoint =
                    i === 0
                      ? dragBounds.y
                      : i === 1
                        ? dragBounds.y + dragBounds.height / 2
                        : dragBounds.y + dragBounds.height;
                  snapY = ty - origPoint;
                }
              });
            });
          });

          if (snapX !== null) {
            totalDeltaX = snapX;
            const newX = dragBounds.x + snapX;
            const pX = [
              newX,
              newX + dragBounds.width / 2,
              newX + dragBounds.width,
            ];

            state.elements.forEach((el) => {
              if (state.selectedElements.includes(el.id)) return;
              const b = getElementBounds(el);
              if (!b) return;
              const tX = [b.x, b.x + b.width / 2, b.x + b.width];
              pX.forEach((px) => {
                tX.forEach((tx) => {
                  if (Math.abs(px - tx) < 1)
                    activeGuides.push({ type: "x", pos: tx });
                });
              });
            });
          }

          if (snapY !== null) {
            totalDeltaY = snapY;
            const newY = dragBounds.y + snapY;
            const pY = [
              newY,
              newY + dragBounds.height / 2,
              newY + dragBounds.height,
            ];
            state.elements.forEach((el) => {
              if (state.selectedElements.includes(el.id)) return;
              const b = getElementBounds(el);
              if (!b) return;
              const tY = [b.y, b.y + b.height / 2, b.y + b.height];
              pY.forEach((py) => {
                tY.forEach((ty) => {
                  if (Math.abs(py - ty) < 1)
                    activeGuides.push({ type: "y", pos: ty });
                });
              });
            });
          }
        }

        activeGuides = activeGuides.filter(
          (v, i, a) =>
            a.findIndex((t) => t.type === v.type && t.pos === v.pos) === i
        );

        moveSelectedElements(totalDeltaX, totalDeltaY);
      }
      return true;
    }

    if (state.isSelecting) {
      state.selectionEnd = coords;
      updateSelection();
      return true;
    }

    return false;
  }

  function handleSelectStop() {
    if (state.isResizing) {
      state.isResizing = false;
      state.resizeHandle = null;
      state.resizeStartBounds = null;
      state.dragOffset = null;
      getSelectedElements().forEach((element) => cleanupTempState(element));
      saveState();
    }
    if (state.isDraggingSelection) {
      state.isDraggingSelection = false;
      state.dragOffset = null;
      state.dragStartBounds = null;
      activeGuides = [];
      getSelectedElements().forEach((element) => cleanupTempState(element));
      saveState();
    }
    if (state.isSelecting) {
      selectElementsInBox();
      state.isSelecting = false;
      state.selectionStart = null;
      state.selectionEnd = null;
      updateSelection();
    }
    
    if (state.isRotating) {
      state.isRotating = false;
      state.resizeStartBounds = null;
      getSelectedElements().forEach(el => delete el._baseRotation);
      saveState();
    }
  }

  function getCursorForSelect(coords) {
    if (state.isRotating) return CURSOR_MAP.rotation;
    if (state.isDraggingSelection || state.isResizing || state.isSelecting)
      return null;
    const resizeHandle = getResizeHandleAt(coords.x, coords.y);
    return resizeHandle ? CURSOR_MAP[resizeHandle] || "default" : "default";
  }

  function showContextMenu(e, element) {
    hideContextMenu();
    
    const items = [
      {
        label: 'Delete',
        icon: 'delete',
        shortcut: 'Backspace',
        action: 'delete',
        className: 'delete-item'
      },
      {
        label: 'Transform',
        icon: 'transform',
        submenu: [
          { label: 'Center', icon: 'center_focus_strong', action: 'center' },
          { label: 'Center Left', icon: 'align_horizontal_left', action: 'center-left' },
          { label: 'Center Right', icon: 'align_horizontal_right', action: 'center-right' }
        ]
      },
      { type: 'separator' },
      { label: 'Bring to Front', icon: 'layers', action: 'bring-front' },
      { label: 'Send to Back', icon: 'layers_clear', action: 'send-back' }
    ];

    ContextMenu.show(e, items, (action) => {
      handleContextMenuAction(action, element);
    });
    
    state.contextMenuTarget = element;
  }
  
  function hideContextMenu() {
    ContextMenu.hide();
    state.contextMenuElement = null;
    state.contextMenuTarget = null;
  }
  
  async function handleContextMenuAction(action, element) {
    switch (action) {
      case 'delete':
        if (!state.selectedElements.includes(element.id)) {
          clearSelection();
          selectElement(element.id);
        }
        deleteSelectedElements();
        break;
      case 'center':
        if (!state.selectedElements.includes(element.id)) {
          clearSelection();
          selectElement(element.id);
        }
        centerSelectedElements();
        break;
      case 'center-left':
        if (!state.selectedElements.includes(element.id)) {
          clearSelection();
          selectElement(element.id);
        }
        await alignSelectedElements('left');
        break;
      case 'center-right':
        if (!state.selectedElements.includes(element.id)) {
          clearSelection();
          selectElement(element.id);
        }
        await alignSelectedElements('right');
        break;
      case 'bring-front':
        bringToFront(element);
        break;
      case 'send-back':
        sendToBack(element);
        break;
    }
  }
  
  function checkToolbarCollision(element) {
    const bounds = getElementBounds(element);
    if (!bounds) return { hasCollision: false };
    
    const toolbar = document.getElementById('main-toolbar');
    if (!toolbar) return { hasCollision: false };
    
    const toolbarRect = toolbar.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    
    const toolbarInCanvas = {
      left: toolbarRect.left - canvasRect.left,
      right: toolbarRect.right - canvasRect.left,
      top: toolbarRect.top - canvasRect.top,
      bottom: toolbarRect.bottom - canvasRect.top
    };
    
    const overlap = !(
      bounds.x + bounds.width < toolbarInCanvas.left ||
      bounds.x > toolbarInCanvas.right ||
      bounds.y + bounds.height < toolbarInCanvas.top ||
      bounds.y > toolbarInCanvas.bottom
    );
    
    if (overlap && toolbar.classList.contains('toolbar-vertical')) {
      const toolbarLeft = toolbarInCanvas.left < canvas.width / 2;
      const elementLeft = bounds.x < canvas.width / 2;
      
      if (toolbarLeft && elementLeft) {
        return { hasCollision: true, toolbarSide: 'left' };
      } else if (!toolbarLeft && !elementLeft) {
        return { hasCollision: true, toolbarSide: 'right' };
      }
    }
    
    return { hasCollision: false };
  }
  
  function showToolbarRepositionDialog(toolbarSide) {
    const { ipcRenderer } = require('electron');
    
    return ipcRenderer.invoke('show-toolbar-reposition-dialog', toolbarSide);
  }
  
  async function moveToolbarToRight() {
    const manager = getToolbarPositionManager ? getToolbarPositionManager() : null;
    if (manager) {
      manager.setLayout('vertical');
      manager.setVerticalPosition('right');
      playSound('move');
      return;
    }

    const toolbar = document.getElementById('main-toolbar');
    if (!toolbar) return;
    
    toolbar.classList.remove('toolbar-vertical');
    toolbar.classList.add('toolbar-vertical', 'toolbar-right-side');
    
    const toolbarWidth = toolbar.offsetWidth;
    const margin = 20;
    const centerX = window.innerWidth - margin - toolbarWidth / 2;
    
    toolbar.style.left = centerX + 'px';
    toolbar.style.top = '50%';
    toolbar.style.transform = 'translate(-50%, -50%)';
    toolbar.style.right = 'auto';
    toolbar.style.bottom = 'auto';
    
    playSound('move');
  }
  
  async function moveToolbarToLeft() {
    const manager = getToolbarPositionManager ? getToolbarPositionManager() : null;
    if (manager) {
      manager.setLayout('vertical');
      manager.setVerticalPosition('left');
      playSound('move');
      return;
    }

    const toolbar = document.getElementById('main-toolbar');
    if (!toolbar) return;
    
    toolbar.classList.remove('toolbar-right-side');
    toolbar.classList.add('toolbar-vertical');
    
    const toolbarWidth = toolbar.offsetWidth;
    const margin = 20;
    const centerX = margin + toolbarWidth / 2;
    
    toolbar.style.left = centerX + 'px';
    toolbar.style.top = '50%';
    toolbar.style.transform = 'translate(-50%, -50%)';
    toolbar.style.right = 'auto';
    toolbar.style.bottom = 'auto';
    
    playSound('move');
  }
  
  function copySelectedElements() {
    const selected = getSelectedElements();
    if (selected.length === 0) return;
    
    state.clipboard = selected.map(el => ({ ...el, id: undefined }));
    playSound('copy');
  }
  
  function cutSelectedElements() {
    copySelectedElements();
    deleteSelectedElements();
  }
  
  function duplicateSelectedElements() {
    const selected = getSelectedElements();
    if (selected.length === 0) return;
    
    const offset = 20;
    const newElements = [];
    
    selected.forEach(element => {
      const newElement = { ...element, id: undefined };
      
      if (newElement.type === 'stroke' && newElement.points) {
        newElement.points = newElement.points.map(p => ({ 
          x: p.x + offset, 
          y: p.y + offset 
        }));
      } else if (newElement.type === 'shape') {
        newElement.start = { 
          x: newElement.start.x + offset, 
          y: newElement.start.y + offset 
        };
        newElement.end = { 
          x: newElement.end.x + offset, 
          y: newElement.end.y + offset 
        };
      } else if (newElement.type === 'text') {
        newElement.x += offset;
        newElement.y += offset;
      } else if (newElement.type === 'stickyNote') {
        newElement.x += offset;
        newElement.y += offset;
      }
      
      const newEl = createElement(newElement);
      newElements.push(newEl);
    });
    
    clearSelection();
    newElements.forEach(el => selectElement(el.id));
    redrawCanvas();
    saveState();
    playSound('paste');
  }
  
  function bringToFront(element) {
    const index = state.elements.findIndex(el => el.id === element.id);
    if (index !== -1 && index < state.elements.length - 1) {
      state.elements.splice(index, 1);
      state.elements.push(element);
      redrawCanvas();
      saveState();
    }
    playSound('layerUp');
  }
  
  function sendToBack(element) {
    const index = state.elements.findIndex(el => el.id === element.id);
    if (index > 0) {
      state.elements.splice(index, 1);
      state.elements.unshift(element);
      redrawCanvas();
      saveState();
    }
    playSound('layerDown');
  }
  
  async function alignSelectedElements(alignment) {
    const selected = getSelectedElements();
    if (selected.length === 0) return;
    
    const backup = selected.map(el => {
      const b = { type: el.type };
      if (el.type === 'stroke' && el.points) b.points = el.points.map(p => ({ x: p.x, y: p.y }));
      else if (el.type === 'shape') { b.start = { ...el.start }; b.end = { ...el.end }; }
      else if (el.type === 'text') { b.x = el.x; b.y = el.y; }
      else if (el.type === 'stickyNote') { b.x = el.x; b.y = el.y; }
      return b;
    });
    
    let shouldCheckCollision = false;
    
    const toolbar = document.getElementById('main-toolbar');
    const toolbarWidth = toolbar ? toolbar.offsetWidth : 80;
    const toolbarRight = toolbar ? toolbar.classList.contains('toolbar-right-side') : false;
    
    selected.forEach(element => {
      const bounds = getElementBounds(element);
      if (!bounds) return;
      
      let deltaX = 0;
      let deltaY = 0;
      
      if (alignment === 'left') {
        deltaX = (toolbarRight ? 20 : 20 + toolbarWidth / 2) - bounds.x;
        shouldCheckCollision = true;
      } else if (alignment === 'right') {
        deltaX = (canvas.width - (toolbarRight ? toolbarWidth + 20 : 20)) - (bounds.x + bounds.width);
        shouldCheckCollision = true;
      } else if (alignment === 'top') {
        deltaY = 50 - bounds.y;
      } else if (alignment === 'bottom') {
        deltaY = (canvas.height - 50) - (bounds.y + bounds.height);
      }
      
      if (element.type === 'stroke' && element.points) {
        element.points.forEach(point => {
          point.x += deltaX;
          point.y += deltaY;
        });
      } else if (element.type === 'shape') {
        element.start.x += deltaX;
        element.start.y += deltaY;
        element.end.x += deltaX;
        element.end.y += deltaY;
      } else if (element.type === 'text') {
        element.x += deltaX;
        element.y += deltaY;
      } else if (element.type === 'stickyNote') {
        element.x += deltaX;
        element.y += deltaY;
      }
    });
    
    if (shouldCheckCollision) {
      for (const element of selected) {
        const collision = checkToolbarCollision(element);
        if (collision.hasCollision) {
          const shouldMove = await showToolbarRepositionDialog(collision.toolbarSide);
          if (shouldMove) {
            if (collision.toolbarSide === 'left') {
              await moveToolbarToRight();
            } else {
              await moveToolbarToLeft();
            }
          } else {
            selected.forEach((el, index) => {
              const b = backup[index];
              if (el.type === 'stroke' && b.points) {
                el.points = b.points;
              } else if (el.type === 'shape' && b.start && b.end) {
                el.start = b.start;
                el.end = b.end;
              } else if (el.type === 'text') {
                el.x = b.x;
                el.y = b.y;
              } else if (el.type === 'stickyNote') {
                el.x = b.x;
                el.y = b.y;
              }
            });
            redrawCanvas();
            return;
          }
          break;
        }
      }
    }
    
    redrawCanvas();
    saveState();
    playSound('move');
  }
  
  function distributeSelectedElements(direction) {
    const selected = getSelectedElements();
    if (selected.length < 2) return;
    
    const elementBounds = selected.map(el => getElementBounds(el)).filter(Boolean);
    if (elementBounds.length < 2) return;
    
    if (direction === 'horizontal') {
      elementBounds.sort((a, b) => a.x - b.x);
      
      const totalWidth = elementBounds[elementBounds.length - 1].x + elementBounds[elementBounds.length - 1].width - elementBounds[0].x;
      const totalElementWidth = elementBounds.reduce((sum, bounds) => sum + bounds.width, 0);
      const totalSpacing = totalWidth - totalElementWidth;
      const spacing = totalSpacing / (elementBounds.length - 1);
      
      let currentX = elementBounds[0].x;
      elementBounds.forEach((bounds, index) => {
        const element = selected[index];
        const deltaX = currentX - bounds.x;
        
        if (element.type === 'stroke' && element.points) {
          element.points.forEach(point => {
            point.x += deltaX;
          });
        } else if (element.type === 'shape') {
          element.start.x += deltaX;
          element.end.x += deltaX;
        } else if (element.type === 'text') {
          element.x += deltaX;
        } else if (element.type === 'stickyNote') {
          element.x += deltaX;
        }
        
        currentX += bounds.width + spacing;
      });
    } else if (direction === 'vertical') {
      elementBounds.sort((a, b) => a.y - b.y);
      
      const totalHeight = elementBounds[elementBounds.length - 1].y + elementBounds[elementBounds.length - 1].height - elementBounds[0].y;
      const totalElementHeight = elementBounds.reduce((sum, bounds) => sum + bounds.height, 0);
      const totalSpacing = totalHeight - totalElementHeight;
      const spacing = totalSpacing / (elementBounds.length - 1);
      
      let currentY = elementBounds[0].y;
      elementBounds.forEach((bounds, index) => {
        const element = selected[index];
        const deltaY = currentY - bounds.y;
        
        if (element.type === 'stroke' && element.points) {
          element.points.forEach(point => {
            point.y += deltaY;
          });
        } else if (element.type === 'shape') {
          element.start.y += deltaY;
          element.end.y += deltaY;
        } else if (element.type === 'text') {
          element.y += deltaY;
        } else if (element.type === 'stickyNote') {
          element.y += deltaY;
        }
        
        currentY += bounds.height + spacing;
      });
    }
    
    redrawCanvas();
    saveState();
    playSound('move');
  }
  
  function centerSelectedElements() {
    const selected = getSelectedElements();
    if (selected.length === 0) return;
    
    const canvasCenterX = canvas.width / 2;
    const canvasCenterY = canvas.height / 2;
    
    selected.forEach(element => {
      const bounds = getElementBounds(element);
      if (!bounds) return;
      
      const elementCenterX = bounds.x + bounds.width / 2;
      const elementCenterY = bounds.y + bounds.height / 2;
      
      const deltaX = canvasCenterX - elementCenterX;
      const deltaY = canvasCenterY - elementCenterY;
      
      if (element.type === 'stroke' && element.points) {
        element.points.forEach(point => {
          point.x += deltaX;
          point.y += deltaY;
        });
      } else if (element.type === 'shape') {
        element.start.x += deltaX;
        element.start.y += deltaY;
        element.end.x += deltaX;
        element.end.y += deltaY;
      } else if (element.type === 'text') {
        element.x += deltaX;
        element.y += deltaY;
      } else if (element.type === 'stickyNote') {
        element.x += deltaX;
        element.y += deltaY;
      }
    });
    
    redrawCanvas();
    saveState();
    playSound('move');
  }

  function updateSelectedColor(color, save = true) {
    if (state.selectedElements.length === 0) return;
    getSelectedElements().forEach((element) => {
      element.color = color;
      if (element.type === "text" && element.segments) {
        element.segments.forEach((segment) => {
          if (segment.formatting) {
            segment.formatting.color = color;
          }
        });
      }
    });
    redrawCanvas();
    if (save) saveState();
  }

  function updateSelectedStrokeSize(size) {
    if (state.selectedElements.length === 0) return;
    getSelectedElements().forEach((element) => {
      element.strokeSize = size;
      if (element.type === "text") element.fontSize = Math.max(12, size * 4);
    });
    redrawCanvas();
    saveState();
  }

  function resetRotation() {
    if (state.selectedElements.length === 0) return;
    getSelectedElements().forEach(el => {
      el.rotation = 0;
    });
    redrawCanvas();
    saveState();
    playSound('reset');
  }

  return {
    selectElement,
    deselectElement,
    clearSelection,
    selectAllElements,
    deleteSelectedElements,
    drawSelectionIndicators,
    getResizeHandleAt,
    handleSelectStart,
    handleSelectDraw,
    handleSelectStop,
    getCursorForSelect,
    updateSelectedColor,
    updateSelectedStrokeSize,
    drawSelectionBox,
    showContextMenu,
    hideContextMenu,
    isContextMenuVisible: () => ContextMenu.isVisible(),
    resetRotation,
    cancelDrag,
  };

  function cancelDrag() {
    const isDoingSomething = state.isDraggingSelection || state.isResizing || state.isRotating || state.isSelecting;
    if (!isDoingSomething) return false;

    if (state.isDraggingSelection || state.isResizing || state.isRotating) {
      getSelectedElements().forEach((element) => {
        if (element.type === "stroke" && element._initialPoints) {
          element.points = element._initialPoints.map((p) => ({ ...p }));
        } else if (element.type === "shape" && element._initialStart && element._initialEnd) {
          element.start = { ...element._initialStart };
          element.end = { ...element._initialEnd };
        } else if (element.type === "text" && element._initialPos) {
          element.x = element._initialPos.x;
          element.y = element._initialPos.y;
          if (element._initialFontSize) {
            element.fontSize = element._initialFontSize;
            element.strokeSize = Math.max(1, Math.floor(element.fontSize / 4));
          }
        } else if (element.type === "stickyNote" && element._initialPos) {
          element.x = element._initialPos.x;
          element.y = element._initialPos.y;
          if (element._initialSize) {
            element.width = element._initialSize.width;
            element.height = element._initialSize.height;
          }
        }

        if (state.isRotating && element._baseRotation !== undefined) {
          element.rotation = element._baseRotation;
        }

        cleanupTempState(element);
      });
    }

    state.isDraggingSelection = false;
    state.isResizing = false;
    state.isRotating = false;
    state.isSelecting = false;
    state.dragOffset = null;
    state.dragStartBounds = null;
    state.resizeHandle = null;
    state.resizeStartBounds = null;
    state.selectionStart = null;
    state.selectionEnd = null;
    activeGuides = [];

    redrawCanvas();
    return true;
  }
}

module.exports = { initSelectTool };
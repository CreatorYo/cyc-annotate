const CanvasManager = require('./CanvasManager.js')
const { state } = require('./AppState.js')

const isWhiteboard = window.location.pathname.includes('whiteboard.html')

const TWO_PI = Math.PI * 2
const PI_DIV_3 = Math.PI / 3
const TAN_30 = 0.57735
const SQRT_3 = Math.sqrt(3)

function drawGrid(targetCtx) {
  const ctx = targetCtx || CanvasManager.getCtx()
  const canvas = CanvasManager.getCanvas()
  const gridMode = isWhiteboard ? state.whiteboardGridMode : (state.gridEnabled ? 'grid' : 'none');
  if (gridMode === 'none') return;
  
  ctx.save();
  
  const isDark = isWhiteboard ? (state.whiteboardPageColor === '#1a1a1a') : (document.body.getAttribute('data-theme') === 'dark');
  const customGridColor = isWhiteboard && state.whiteboardGridColor && state.whiteboardGridColor !== 'default' ? state.whiteboardGridColor : null;
  const gridKey = `${gridMode}-${state.gridSize}-${isDark}-${customGridColor}`;
  const cache = CanvasManager.getGridCache();
  
  let pattern = cache.get(gridKey);
  
  if (!pattern) {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    const size = state.gridSize;
    
    let strokeStyle, fillStyle;
    if (customGridColor) {
      strokeStyle = customGridColor + '40';
      fillStyle = customGridColor + '60';
    } else {
      strokeStyle = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.15)';
      fillStyle = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
    }

    if (gridMode === 'dotted') {
      tempCanvas.width = size;
      tempCanvas.height = size;
      tempCtx.fillStyle = fillStyle;
      tempCtx.beginPath();
      tempCtx.arc(size/2, size/2, 2, 0, TWO_PI);
      tempCtx.fill();
    } else if (gridMode === 'graph') {
      tempCanvas.width = size;
      tempCanvas.height = size;
      tempCtx.strokeStyle = strokeStyle;
      
      const minorSpacing = size / 5;
      tempCtx.lineWidth = 1;
      tempCtx.globalAlpha = 0.4;
      tempCtx.beginPath();
      for (let i = 1; i < 5; i++) {
        const p = i * minorSpacing;
        tempCtx.moveTo(p, 0); tempCtx.lineTo(p, size);
        tempCtx.moveTo(0, p); tempCtx.lineTo(size, p);
      }
      tempCtx.stroke();
      
      tempCtx.lineWidth = 1.5;
      tempCtx.globalAlpha = 1.0;
      tempCtx.beginPath();
      tempCtx.moveTo(0, 0); tempCtx.lineTo(size, 0);
      tempCtx.moveTo(0, 0); tempCtx.lineTo(0, size);
      tempCtx.stroke();
    } else if (gridMode === 'grid' || gridMode === 'lines') {
      tempCanvas.width = size;
      tempCanvas.height = size;
      tempCtx.strokeStyle = strokeStyle;
      tempCtx.lineWidth = 1;
      tempCtx.beginPath();
      tempCtx.moveTo(0, 0); tempCtx.lineTo(size, 0);
      if (gridMode === 'grid') {
        tempCtx.moveTo(0, 0); tempCtx.lineTo(0, size);
      }
      tempCtx.stroke();
    } else if (gridMode === 'hexagonal') {
      const s = size / 1.5;
      const h = s * SQRT_3;
      tempCanvas.width = s * 3;
      tempCanvas.height = h;
      tempCtx.strokeStyle = strokeStyle;
      tempCtx.lineWidth = 1;
      
      const drawHex = (cx, cy) => {
        tempCtx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = i * PI_DIV_3;
          const px = cx + s * Math.cos(angle);
          const py = cy + s * Math.sin(angle);
          if (i === 0) tempCtx.moveTo(px, py);
          else tempCtx.lineTo(px, py);
        }
        tempCtx.closePath();
        tempCtx.stroke();
      };

      drawHex(0, 0);
      drawHex(s * 1.5, h / 2);
      drawHex(s * 3, 0);
      drawHex(0, h);
      drawHex(s * 3, h);
    } else if (gridMode === 'isometric') {
      ctx.restore();
      return drawIsometricGrid(ctx, isDark, customGridColor);
    }
    
    if (tempCanvas.width > 0) {
      pattern = ctx.createPattern(tempCanvas, 'repeat');
      cache.set(gridKey, pattern);
    }
  }

  if (pattern) {
    const matrix = new DOMMatrix().translate(state.panX, state.panY);
    pattern.setTransform(matrix);
    ctx.fillStyle = pattern;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  ctx.restore();
}

function drawIsometricGrid(targetCtx, isDark, customGridColor) {
  const canvas = CanvasManager.getCanvas()
  const spacing = state.gridSize;
  const verticalSpacing = spacing * 0.866 * 2;
  const viewportX = -state.panX;
  const viewportY = -state.panY;
  const viewportWidth = canvas.width;
  const viewportHeight = canvas.height;

  targetCtx.save();
  if (customGridColor) {
    targetCtx.strokeStyle = customGridColor + '40';
  } else {
    targetCtx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.15)';
  }
  targetCtx.lineWidth = 1;
  targetCtx.beginPath();
  
  const startX = Math.floor(viewportX / verticalSpacing) * verticalSpacing;
  const endX = Math.ceil((viewportX + viewportWidth) / verticalSpacing) * verticalSpacing;
  for (let x = startX; x <= endX; x += verticalSpacing) {
    targetCtx.moveTo(x, viewportY); targetCtx.lineTo(x, viewportY + viewportHeight);
  }
  
  const slantSpacing = spacing;
  const c1_min = viewportY - (viewportX + viewportWidth) * TAN_30;
  const c1_max = viewportY + viewportHeight - viewportX * TAN_30;
  const startY1 = Math.floor(c1_min / slantSpacing) * slantSpacing;
  const endY1 = Math.ceil(c1_max / slantSpacing) * slantSpacing;
  for (let y = startY1; y <= endY1; y += slantSpacing) {
    targetCtx.moveTo(viewportX, y + viewportX * TAN_30);
    targetCtx.lineTo(viewportX + viewportWidth, y + (viewportX + viewportWidth) * TAN_30);
  }
  
  const c2_min = viewportY + viewportX * TAN_30;
  const c2_max = viewportY + viewportHeight + (viewportX + viewportWidth) * TAN_30;
  const startY2 = Math.floor(c2_min / slantSpacing) * slantSpacing;
  const endY2 = Math.ceil(c2_max / slantSpacing) * slantSpacing;
  for (let y = startY2; y <= endY2; y += slantSpacing) {
    targetCtx.moveTo(viewportX, y - viewportX * TAN_30);
    targetCtx.lineTo(viewportX + viewportWidth, y - (viewportX + viewportWidth) * TAN_30);
  }
  targetCtx.stroke();
  targetCtx.restore();
}

module.exports = {
  drawGrid,
  drawIsometricGrid
}

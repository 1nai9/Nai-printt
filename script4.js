/* ====== PART 1 / 3 ====== (CORE + DOM + LAYERS) */

function saveDrawing(){
  const rect = wrap.getBoundingClientRect();
  const tmp = document.createElement('canvas');
  tmp.width = Math.round(rect.width * devicePixelRatioVal);
  tmp.height = Math.round(rect.height * devicePixelRatioVal);
  tmp.style.width = rect.width+'px';
  tmp.style.height = rect.height+'px';
  const tctx = tmp.getContext('2d');
  tctx.setTransform(devicePixelRatioVal,0,0,devicePixelRatioVal,0,0);
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0,0,rect.width,rect.height);

  layers.forEach(l=>{
    if (!l.visible) return;
    tctx.globalAlpha = l.opacity || 1;
    tctx.drawImage(l.canvas,0,0,rect.width,rect.height);
  });

  tmp.toBlob(blob=>{
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'drawing.png';
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png');
}

/* ====== عناصر DOM ====== */
const wrap = document.getElementById('canvasWrap');
const shapePreview = document.getElementById('shapePreview');

const brushBtn = document.getElementById('brushBtn');
const eraserBtn = document.getElementById('eraserBtn');
const bucketBtn = document.getElementById('bucketBtn'); // زر الدلو الجديد
const colorPicker = document.getElementById('colorPicker');
const sizeRange = document.getElementById('sizeRange');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');

const shapesTopBtn = document.getElementById('shapesTopBtn');
const layersToggle = document.getElementById('layersToggle');

const layersFlyout = document.getElementById('layersFlyout');
const layersList = document.getElementById('layersList');
const addLayerBtn = document.getElementById('addLayerBtn');
const closeLayersBtn = document.getElementById('closeLayersBtn');
const raiseBtn = document.getElementById('raiseBtn');
const lowerBtn = document.getElementById('lowerBtn');
const deleteBtn = document.getElementById('deleteBtn');

let devicePixelRatioVal = window.devicePixelRatio || 1;

/* ====== بيانات الطبقات ====== */
let layers = []; // [{id, canvas, ctx, name, visible, opacity}]
let activeLayerId = null;
const history = {};
const MAX_HISTORY = 30;

/* أدوات وأشكال */
let currentTool = 'brush'; // brush | eraser | shape | fill
let currentShape = null; // rect|circle|line|arrow
let drawing = false;
let lastPoint = null;
let shapeStart = null;

/* ====== أدوات مساعدة ====== */
function uid(){ return 'L'+Math.random().toString(36).slice(2,9); }
function getLayerById(id){ return layers.find(l=>l.id===id) || null; }
function getActiveLayer(){ return getLayerById(activeLayerId); }

/* إضافة طبقة */
function createLayer(name='طبقة'){
  const id = uid();
  const canvas = document.createElement('canvas');
  canvas.className = 'layer-canvas';
  canvas.dataset.layerId = id;
  wrap.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha:true });
  const layer = { id, canvas, ctx, name, visible:true, opacity:1 };
  layers.push(layer);
  history[id] = {undo:[], redo:[]};
  setActiveLayer(id);
  resizeAllCanvases();
  pushHistory(id);
  refreshLayersUI();
  return layer;
}

/* حذف طبقة */
function removeLayer(id){
  if (layers.length <= 1) { alert('لا يمكن حذف الطبقة الأخيرة.'); return; }
  const idx = layers.findIndex(l=>l.id===id);
  if (idx===-1) return;
  const layer = layers[idx];
  wrap.removeChild(layer.canvas);
  delete history[id];
  layers.splice(idx,1);
  setActiveLayer(layers[layers.length-1].id);
  refreshLayersUI();
}

/* تعيين طبقة نشطة */
function setActiveLayer(id){
  activeLayerId = id;
  refreshLayersUI();
}

/* رفع/خفض طبقة في المصفوفة (والـ DOM) */
function raiseLayer(id){
  const idx = layers.findIndex(l=>l.id===id);
  if (idx <= 0) return;
  [layers[idx-1], layers[idx]] = [layers[idx], layers[idx-1]];
  reorderCanvases();
  refreshLayersUI();
}
function lowerLayer(id){
  const idx = layers.findIndex(l=>l.id===id);
  if (idx === -1 || idx === layers.length-1) return;
  [layers[idx], layers[idx+1]] = [layers[idx+1], layers[idx]];
  reorderCanvases();
  refreshLayersUI();
}
function reorderCanvases(){
  layers.forEach(l => wrap.appendChild(l.canvas));
}

/* ====== تغيير مقاس الكانفاسات مع الحفاظ على المحتوى ====== */
function resizeAllCanvases(){
  const rect = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  devicePixelRatioVal = dpr;
  layers.forEach(l=>{
    // copy previous content
    const tmp = document.createElement('canvas');
    tmp.width = l.canvas.width;
    tmp.height = l.canvas.height;
    tmp.getContext('2d').drawImage(l.canvas,0,0);

    l.canvas.width = Math.floor(rect.width * dpr);
    l.canvas.height = Math.floor(rect.height * dpr);
    l.canvas.style.width = rect.width + 'px';
    l.canvas.style.height = rect.height + 'px';
    l.ctx.setTransform(dpr,0,0,dpr,0,0);

    if (tmp.width && tmp.height) l.ctx.drawImage(tmp,0,0,rect.width,rect.height);
    l.canvas.style.opacity = l.opacity || 1;
    l.canvas.style.display = l.visible ? 'block' : 'none';
  });

  // shape preview size
  shapePreview.width = Math.floor(rect.width * dpr);
  shapePreview.height = Math.floor(rect.height * dpr);
  shapePreview.style.width = rect.width + 'px';
  shapePreview.style.height = rect.height + 'px';
  shapePreview.getContext('2d').setTransform(dpr,0,0,dpr,0,0);
}

/* ====== أدوات الرسم: تحديد الأداة ====== */
function setTool(t){
  currentTool = t;
  brushBtn.setAttribute('aria-pressed', t==='brush');
  eraserBtn.setAttribute('aria-pressed', t==='eraser');
  if (bucketBtn) bucketBtn.setAttribute('aria-pressed', t==='fill');
}
brushBtn.addEventListener('click', ()=> setTool('brush'));
eraserBtn.addEventListener('click', ()=> setTool('eraser'));
if (bucketBtn){
  bucketBtn.addEventListener('click', ()=> setTool('fill'));
}

/* hex color إلى rgba (alpha default 255) */
function hexToRgba(hex, alpha=255){
  const c = hex.replace('#','');
  return [
    parseInt(c.substring(0,2),16),
    parseInt(c.substring(2,4),16),
    parseInt(c.substring(4,6),16),
    alpha
  ];
}

/* ====== واجهة الطبقات ====== */
function refreshLayersUI(){
  layersList.innerHTML = '';
  for (let i=layers.length-1;i>=0;i--){
    const l = layers[i];
    const item = document.createElement('div');
    item.className = 'layer-item' + (l.id===activeLayerId ? ' active' : '');
    item.dataset.id = l.id;

    const thumb = document.createElement('canvas'); thumb.className='layer-thumb';
    thumb.width = 88; thumb.height = 60;
    const tctx = thumb.getContext('2d');
    tctx.fillStyle = '#fff'; tctx.fillRect(0,0,thumb.width,thumb.height);
    if (l.canvas.width && l.canvas.height) tctx.drawImage(l.canvas,0,0,thumb.width,thumb.height);

    const nameDiv = document.createElement('div'); nameDiv.className='layer-name'; nameDiv.textContent = l.name;

    item.appendChild(thumb);
    item.appendChild(nameDiv);

    item.addEventListener('click', (e)=>{
      setActiveLayer(l.id);
      e.stopPropagation();
    });

    layersList.appendChild(item);
  }
}
/* ====== PART 2 / 3 ====== (HISTORY, POINTER, DRAW, FILL) */

/* ====== history per layer (undo/redo) ====== */
function pushHistory(layerId){
  if (!layerId) return;
  try {
    const l = getLayerById(layerId);
    const snap = l.canvas.toDataURL();
    const h = history[layerId];
    h.undo.push(snap);
    if (h.undo.length > MAX_HISTORY) h.undo.shift();
    h.redo = [];
    updateUndoRedo();
  } catch(e){ console.warn(e) }
}
function undo(layerId){
  const h = history[layerId];
  if (!h || h.undo.length===0) return;
  const last = h.undo.pop();
  h.redo.push(getLayerById(layerId).canvas.toDataURL());
  restoreLayerFromDataURL(layerId, last);
  updateUndoRedo();
}
function redo(layerId){
  const h = history[layerId];
  if (!h || h.redo.length===0) return;
  const next = h.redo.pop();
  h.undo.push(getLayerById(layerId).canvas.toDataURL());
  restoreLayerFromDataURL(layerId, next);
  updateUndoRedo();
}
function updateUndoRedo(){
  undoBtn.disabled = !(activeLayerId && history[activeLayerId] && history[activeLayerId].undo.length>0);
  redoBtn.disabled = !(activeLayerId && history[activeLayerId] && history[activeLayerId].redo.length>0);
}
function restoreLayerFromDataURL(layerId, dataURL){
  return new Promise((res,rej)=>{
    const img = new Image();
    img.onload = () => {
      const l = getLayerById(layerId);
      if (!l) return res();
      const rect = wrap.getBoundingClientRect();
      l.ctx.clearRect(0,0,rect.width,rect.height);
      l.ctx.drawImage(img,0,0,rect.width,rect.height);
      refreshLayersUI();
      res();
    };
    img.onerror = rej;
    img.src = dataURL;
  });
}

/* ====== أدوات الرسم و الأحداث ====== */
function pointerPosFromEvent(e){
  const rect = wrap.getBoundingClientRect();
  const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
  const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function drawLineOnCtx(ctx, from, to, width, color, erase=false){
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  if (erase){
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
  }
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = erase ? 1 : parseFloat(document.getElementById('brushAlpha') ? document.getElementById('brushAlpha').value || 1 : 1);
}

/* attach pointer events to wrap and draw on active layer */
function attachPointerEvents(){
  wrap.onpointerdown = (ev)=>{
    ev.preventDefault();
    const layer = getActiveLayer(); if (!layer) return;
    drawing = true;
    lastPoint = pointerPosFromEvent(ev);
    shapeStart = pointerPosFromEvent(ev);

    // ensure history for fill too (push before change)
    if (currentTool === 'brush' || currentTool === 'eraser' || currentTool === 'shape' || currentTool === 'fill') pushHistory(layer.id);

    if (currentTool === 'fill'){
      // perform fill (use colorPicker.value)
      fillLayer(layer, lastPoint.x, lastPoint.y, colorPicker.value);
      drawing = false; lastPoint = null; shapeStart = null;
      updateUndoRedo();
    }
  };
  wrap.onpointermove = (ev)=>{
    const pos = pointerPosFromEvent(ev);
    const layer = getActiveLayer(); if (!layer) return;
    if (!drawing) return;
    if (currentTool === 'brush' || currentTool === 'eraser'){
      drawLineOnCtx(layer.ctx, lastPoint, pos, parseInt(sizeRange.value,10), colorPicker.value, currentTool==='eraser');
      lastPoint = pos;
    } else if (currentTool === 'shape' && currentShape){
      drawShapePreview(shapeStart, pos, currentShape, colorPicker.value, parseInt(sizeRange.value,10));
    }
  };
  wrap.onpointerup = (ev)=>{
    const pos = pointerPosFromEvent(ev);
    const layer = getActiveLayer(); if (!layer) return;
    if (!drawing) return;
    if (currentTool === 'shape' && currentShape){
      commitShapeToLayer(layer, shapeStart, pos, currentShape, colorPicker.value, parseInt(sizeRange.value,10));
      clearPreview();
    }
    drawing = false; lastPoint = null; shapeStart = null;
    updateUndoRedo();
  };
  wrap.onpointercancel = ()=> { drawing=false; clearPreview(); lastPoint=null; shapeStart=null; };
}
attachPointerEvents();

/* ====== fill tool (bucket) - Flood Fill (scanline) ====== */
/*
  fillLayer(layer, xCss, yCss, colorHex)
  xCss,yCss are coordinates in CSS pixels (as returned by pointerPosFromEvent)
*/
function fillLayer(layer, xCss, yCss, fillColorHex){
  if (!layer) return;
  const canvas = layer.canvas;
  const ctx = layer.ctx;

  const dpr = devicePixelRatioVal || 1;

  // convert CSS coords to canvas pixel coords
  const startX = Math.floor(xCss * dpr);
  const startY = Math.floor(yCss * dpr);

  const width = canvas.width;
  const height = canvas.height;

  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

  let imageData;
  try {
    imageData = ctx.getImageData(0,0,width,height);
  } catch(e){
    console.warn('getImageData failed', e);
    return;
  }
  const data = imageData.data;

  const startPos = (startY * width + startX) * 4;
  const sr = data[startPos], sg = data[startPos+1], sb = data[startPos+2], sa = data[startPos+3];

  const fillArr = hexToRgba(fillColorHex, 255);

  // if starting color already equals fill color, nothing to do
  if (sr === fillArr[0] && sg === fillArr[1] && sb === fillArr[2] && sa === fillArr[3]) {
    return;
  }

  // helper: compare color at pixel index
  function matchAt(idx){
    return data[idx] === sr && data[idx+1] === sg && data[idx+2] === sb && data[idx+3] === sa;
  }
  // helper: set color at pixel index
  function setAt(idx){
    data[idx]   = fillArr[0];
    data[idx+1] = fillArr[1];
    data[idx+2] = fillArr[2];
    data[idx+3] = fillArr[3];
  }

  // Scanline flood fill (stack-based)
  const stack = [];
  stack.push({x:startX, y:startY});

  while(stack.length){
    const {x,y} = stack.pop();
    let nx = x;
    let idx = (y * width + nx) * 4;

    // move left until color differs
    while(nx >= 0 && matchAt((y * width + nx) * 4)) nx--;
    nx++;
    let spanUp = false;
    let spanDown = false;
    for (let px = nx; px < width && matchAt((y * width + px) *4); px++){
      const curIdx = (y * width + px) * 4;
      setAt(curIdx);

      // up
      if (y > 0){
        const upIdx = ((y-1) * width + px) * 4;
        if (matchAt(upIdx) && !spanUp){
          stack.push({x:px, y:y-1});
          spanUp = true;
        } else if (!matchAt(upIdx)) {
          spanUp = false;
        }
      }

      // down
      if (y < height-1){
        const downIdx = ((y+1) * width + px) * 4;
        if (matchAt(downIdx) && !spanDown){
          stack.push({x:px, y:y+1});
          spanDown = true;
        } else if (!matchAt(downIdx)) {
          spanDown = false;
        }
      }
    }
  }

  // put data back
  ctx.putImageData(imageData, 0, 0);

  // record history already pushed before calling fill (pointerdown pushes it), but ensure we push if called externally
  // (pushHistory is already called in pointerdown before fill)
  // pushHistory(layer.id); // not necessary here if caller already pushed

  refreshLayersUI();
}

/* shape preview */
function clearPreview(){ 
  const ctx = shapePreview.getContext('2d'); 
  const rect = wrap.getBoundingClientRect(); 
  ctx.clearRect(0,0,rect.width,rect.height); 
}

function drawShapePreview(from, to, shape, color, lineWidth){
  const ctx = shapePreview.getContext('2d');
  const rect = wrap.getBoundingClientRect();
  ctx.clearRect(0,0,rect.width,rect.height);
  ctx.save();
  ctx.lineWidth = lineWidth; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap='round'; ctx.lineJoin='round';
  if (shape === 'rect'){
    const x = Math.min(from.x,to.x), y = Math.min(from.y,to.y), w = Math.abs(to.x-from.x), h = Math.abs(to.y-from.y);
    ctx.strokeRect(x,y,w,h);
  } else if (shape === 'circle'){
    const cx=(from.x+to.x)/2, cy=(from.y+to.y)/2, rx=Math.abs(to.x-from.x)/2, ry=Math.abs(to.y-from.y)/2;
    ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.stroke();
  } else if (shape === 'line'){
    ctx.beginPath(); ctx.moveTo(from.x,from.y); ctx.lineTo(to.x,to.y); ctx.stroke();
  } else if (shape === 'arrow'){
    drawArrowOnCtx(ctx, from, to, lineWidth);
  }
  ctx.restore();
}

function drawArrowOnCtx(ctx, from, to, lineWidth){
  ctx.beginPath(); ctx.moveTo(from.x,from.y); ctx.lineTo(to.x,to.y); ctx.stroke();
  const angle = Math.atan2(to.y-from.y,to.x-from.x);
  const headlen = Math.max(8, lineWidth*1.5);
  ctx.beginPath();
  ctx.moveTo(to.x,to.y);
  ctx.lineTo(to.x - headlen*Math.cos(angle - Math.PI/6), to.y - headlen*Math.sin(angle - Math.PI/6));
  ctx.lineTo(to.x - headlen*Math.cos(angle + Math.PI/6), to.y - headlen*Math.sin(angle + Math.PI/6));
  ctx.lineTo(to.x,to.y);
  ctx.fill();
}

function commitShapeToLayer(layer, from, to, shape, color, lineWidth){
  const ctx = layer.ctx;
  ctx.save();
  ctx.lineWidth = lineWidth; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap='round'; ctx.lineJoin='round';
  if (shape === 'rect'){
    const x = Math.min(from.x,to.x), y = Math.min(from.y,to.y), w = Math.abs(to.x-from.x), h = Math.abs(to.y-from.y);
    ctx.strokeRect(x,y,w,h);
  } else if (shape === 'circle'){
    const cx=(from.x+to.x)/2, cy=(from.y+to.y)/2, rx=Math.abs(to.x-from.x)/2, ry=Math.abs(to.y-from.y)/2;
    ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.stroke();
  } else if (shape === 'line'){
    ctx.beginPath(); ctx.moveTo(from.x,from.y); ctx.lineTo(to.x,to.y); ctx.stroke();
  } else if (shape === 'arrow'){
    drawArrowOnCtx(ctx, from, to, lineWidth);
  }
  ctx.restore();
}
/* ====== PART 3 / 3 ====== (UI CONTROLS, SHAPES, LAYERS FLYOUT, INIT) */

/* ====== تحكم بالأزرار ====== */
let shapesMenu = null;
shapesTopBtn.addEventListener('click', (e)=>{
  if (shapesMenu && document.body.contains(shapesMenu)){ shapesMenu.remove(); shapesMenu=null; return; }
  shapesMenu = document.createElement('div');
  shapesMenu.style.position='absolute';
  shapesMenu.style.top = (shapesTopBtn.getBoundingClientRect().bottom + 8) + 'px';
  shapesMenu.style.right = (window.innerWidth - shapesTopBtn.getBoundingClientRect().right) + 'px';
  shapesMenu.style.background = 'white';
  shapesMenu.style.borderRadius='8px';
  shapesMenu.style.boxShadow='0 8px 20px rgba(0,0,0,0.15)';
  shapesMenu.style.padding='8px';
  shapesMenu.style.zIndex = 1300;
  shapesMenu.innerHTML = `
    <div style="font-weight:700;margin-bottom:10px;text-align:right">أدوات</div>
    <div style="margin-top:6px;border-top:1px solid #ddd;padding-top:6px">
      <button data-shape="rect" style="display:block;width:100%;margin-bottom:1px">مربع</button>
      <button data-shape="circle" style="display:block;width:100%;margin-bottom:1px">دائرة</button>
      <button data-shape="line" style="display:block;width:100%;margin-bottom:6px">خط</button>
      <div style="margin-top:6px;border-top:1px solid #ddd;padding-top:6px">
        <button id="importBtn" style="display:block;width:100%;margin-bottom:6px">استيراد</button>
        <button id="saveInsideBtn" style="display:block;width:100%">حفظ</button>
      </div>
    </div>
  `;
  document.body.appendChild(shapesMenu);

  shapesMenu.querySelectorAll('button[data-shape]').forEach(b=>{
    b.addEventListener('click', ()=>{
      currentTool = 'shape';
      currentShape = b.dataset.shape;
      shapesMenu.remove(); shapesMenu = null;
    });
  });

  document.getElementById('saveInsideBtn').addEventListener('click', ()=>{
    saveDrawing();
    shapesMenu.remove();
    shapesMenu = null;
  });

  document.getElementById('importBtn').addEventListener('click', ()=>{
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e)=>{
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(ev){
        const img = new Image();
        img.onload = function(){
          const layer = getActiveLayer();
          if (!layer) return;
          const rect = wrap.getBoundingClientRect();
          // draw to full rect (css units) — context already scaled for DPR in resizeAllCanvases
          layer.ctx.drawImage(img, 0, 0, rect.width, rect.height);
          pushHistory(layer.id);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
    shapesMenu.remove(); shapesMenu = null;
  });

  document.addEventListener('click', function onDocClick(evt){
    if (!shapesMenu) return;
    if (!shapesMenu.contains(evt.target) && evt.target !== shapesTopBtn) {
      shapesMenu.remove(); shapesMenu=null;
      document.removeEventListener('click', onDocClick);
    }
  });
});

/* layers toggle */
layersToggle.addEventListener('click', (e)=>{
  layersFlyout.classList.toggle('open');
  layersFlyout.setAttribute('aria-hidden', !layersFlyout.classList.contains('open'));
});
closeLayersBtn.addEventListener('click', ()=> { layersFlyout.classList.remove('open'); layersFlyout.setAttribute('aria-hidden','true'); });
document.addEventListener('click', (e)=>{
  if (!layersFlyout.classList.contains('open')) return;
  const isInside = layersFlyout.contains(e.target) || layersToggle.contains(e.target);
  if (!isInside) { layersFlyout.classList.remove('open'); layersFlyout.setAttribute('aria-hidden','true'); }
});

/* add layer */
addLayerBtn.addEventListener('click', ()=> createLayer('طبقة ' + (layers.length + 1)));
raiseBtn.addEventListener('click', ()=> { if (!activeLayerId) return; raiseLayer(activeLayerId); });
lowerBtn.addEventListener('click', ()=> { if (!activeLayerId) return; lowerLayer(activeLayerId); });
deleteBtn.addEventListener('click', ()=> { if (!activeLayerId) return; const ok = confirm('حذف الطبقة المحددة؟'); if (ok) removeLayer(activeLayerId); });

/* undo/redo/clear/save */
undoBtn.addEventListener('click', ()=> { if (activeLayerId) undo(activeLayerId); });
redoBtn.addEventListener('click', ()=> { if (activeLayerId) redo(activeLayerId); });
clearBtn.addEventListener('click', ()=> {
  if (!activeLayerId) return;
  const layer = getActiveLayer(); if (!layer) return;
  pushHistory(layer.id);
  const rect = wrap.getBoundingClientRect();
  layer.ctx.clearRect(0,0,rect.width,rect.height);
});
saveBtn.addEventListener('click', ()=> saveDrawing());

/* keyboard shortcuts */
window.addEventListener('keydown', (e)=>{
  if (e.ctrlKey || e.metaKey){
    if (e.key === 'z') { if (activeLayerId) undo(activeLayerId); e.preventDefault(); }
    if (e.key === 'y') { if (activeLayerId) redo(activeLayerId); e.preventDefault(); }
  }
  if (e.key === 'b') setTool('brush');
  if (e.key === 'e') setTool('eraser');
});

/* prevent scroll while drawing */
document.body.addEventListener('touchstart', (e)=>{ if (e.target.closest('.canvas-wrap')) e.preventDefault(); }, {passive:false});
document.body.addEventListener('touchmove', (e)=>{ if (e.target.closest('.canvas-wrap')) e.preventDefault(); }, {passive:false});

/* resize and restore */
let resizeTimer = null;
window.addEventListener('resize', ()=>{
  if (resizeTimer) clearTimeout(resizeTimer);
  const snaps = {};
  layers.forEach(l => { snaps[l.id] = l.canvas.toDataURL(); });
  resizeTimer = setTimeout(async ()=>{
    resizeAllCanvases();
    for (const id in snaps) await restoreLayerFromDataURL(id, snaps[id]);
    resizeTimer = null;
  }, 140);
});

/* initialize التطبيق */
function init(){
  // if no canvasWrap children, create starters
  if (!wrap) return;
  createLayer('خلفية');
  createLayer('الطبقة 1');
  resizeAllCanvases();
  setActiveLayer(layers[layers.length-1].id);
  refreshLayersUI();
  updateUndoRedo();

  const rect = wrap.getBoundingClientRect();
  shapePreview.style.left='0'; shapePreview.style.top='0';
  shapePreview.style.width = rect.width + 'px';
  shapePreview.style.height = rect.height + 'px';

  const layerAlphaInput = document.getElementById('layerAlpha');
  if (layerAlphaInput){
    layerAlphaInput.addEventListener('input', ()=>{
      const layer = getActiveLayer();
      if(!layer) return;
      layer.opacity = parseFloat(layerAlphaInput.value);
      layer.canvas.style.opacity = layer.opacity;
    });
  }
}
window.addEventListener('DOMContentLoaded', () => { init(); });
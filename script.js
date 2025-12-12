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
/* ====== PART 2 / 3 ====== (DRAWING, HISTORY, FILL TOOL) */

/* ====== history ====== */
function pushHistory(id){
  const layer = getLayerById(id);
  if (!layer) return;
  const h = history[id];
  if (!h) return;
  if (h.undo.length >= MAX_HISTORY) h.undo.shift();
  h.undo.push(layer.canvas.toDataURL());
  h.redo = [];
  updateUndoRedo();
}
function undo(id){
  const layer = getLayerById(id);
  if (!layer) return;
  const h = history[id];
  if (!h || h.undo.length === 0) return;
  const snap = h.undo.pop();
  h.redo.push(layer.canvas.toDataURL());
  restoreLayerFromDataURL(id, snap);
  updateUndoRedo();
}
function redo(id){
  const layer = getLayerById(id);
  if (!layer) return;
  const h = history[id];
  if (!h || h.redo.length === 0) return;
  const snap = h.redo.pop();
  h.undo.push(layer.canvas.toDataURL());
  restoreLayerFromDataURL(id, snap);
  updateUndoRedo();
}
function updateUndoRedo(){
  if (!activeLayerId) return;
  const h = history[activeLayerId];
  undoBtn.disabled = !(h && h.undo.length>0);
  redoBtn.disabled = !(h && h.redo.length>0);
}
function restoreLayerFromDataURL(id,dataURL){
  return new Promise(resolve=>{
    const layer = getLayerById(id);
    if (!layer) return resolve();
    const img = new Image();
    img.onload = ()=>{
      const rect = wrap.getBoundingClientRect();
      layer.ctx.clearRect(0,0,rect.width,rect.height);
      layer.ctx.drawImage(img,0,0,rect.width,rect.height);
      resolve();
    };
    img.src = dataURL;
  });
}

/* ====== flood-fill (NO BORDER ARTIFACT) ====== */
function floodFill(layer, startX, startY, fillColor){
  const ctx = layer.ctx;
  const rect = wrap.getBoundingClientRect();
  const w = Math.floor(rect.width);
  const h = Math.floor(rect.height);

  const imgData = ctx.getImageData(0,0,w,h);
  const data = imgData.data;

  const startPos = (startY * w + startX) * 4;
  const startColor = [
    data[startPos],
    data[startPos+1],
    data[startPos+2],
    data[startPos+3]
  ];

  const isSame = (p)=>{
    return data[p]   === startColor[0] &&
           data[p+1] === startColor[1] &&
           data[p+2] === startColor[2] &&
           data[p+3] === startColor[3];
  };

  if (isSame(startPos)) {
    // إذا اللون نفس لون التعبئة، ما نعمل شيء
    const fc = hexToRgba(colorPicker.value,255);
    if (startColor[0]===fc[0] &&
        startColor[1]===fc[1] &&
        startColor[2]===fc[2] &&
        startColor[3]===fc[3]) return;
  }

  const stack = [[startX,startY]];
  const [r,g,b,a] = fillColor;

  while (stack.length){
    const [x,y] = stack.pop();
    let p = (y*w + x)*4;

    if (!isSame(p)) continue;

    // امسح السطر الحالي
    let left = x;
    while (left >= 0 && isSame((y*w + left)*4)) left--;
    left++;

    let right = x;
    while (right < w && isSame((y*w + right)*4)) right++;
    right--;

    for (let i=left; i<=right; i++){
      let pi = (y*w + i)*4;
      data[pi] = r;
      data[pi+1] = g;
      data[pi+2] = b;
      data[pi+3] = a;
    }

    // نقاط فوق وتحت
    if (y > 0){
      for (let i=left; i<=right; i++){
        let p2 = ((y-1)*w + i)*4;
        if (isSame(p2)) stack.push([i,y-1]);
      }
    }
    if (y < h-1){
      for (let i=left; i<=right; i++){
        let p2 = ((y+1)*w + i)*4;
        if (isSame(p2)) stack.push([i,y+1]);
      }
    }
  }

  ctx.putImageData(imgData,0,0);
}

/* ====== EVENTS FOR DRAWING ====== */
wrap.addEventListener('mousedown', startDraw);
wrap.addEventListener('touchstart', startDraw,{passive:false});
wrap.addEventListener('mousemove', moveDraw);
wrap.addEventListener('touchmove', moveDraw,{passive:false});
wrap.addEventListener('mouseup', endDraw);
wrap.addEventListener('mouseleave', endDraw);
wrap.addEventListener('touchend', endDraw);

function getXY(e){
  const rect = wrap.getBoundingClientRect();
  if (e.touches) e = e.touches[0];
  return {
    x: Math.floor(e.clientX - rect.left),
    y: Math.floor(e.clientY - rect.top)
  };
}

function startDraw(e){
  const {x,y} = getXY(e);
  const layer = getActiveLayer();
  if (!layer) return;

  if (currentTool === 'fill'){
    pushHistory(layer.id);

    const fillCol = hexToRgba(colorPicker.value,255);
    floodFill(layer, x, y, fillCol);

    return;
  }

  if (currentTool === 'shape'){
    shapeStart = {x,y};
    shapePreview.getContext('2d').clearRect(0,0,shapePreview.width,shapePreview.height);
    drawing = true;
    return;
  }

  drawing = true;
  lastPoint = {x,y};
  pushHistory(layer.id);
}

function moveDraw(e){
  if (!drawing) return;
  const {x,y} = getXY(e);
  const layer = getActiveLayer();
  if (!layer) return;

  if (currentTool === 'brush'){
    layer.ctx.lineCap = 'round';
    layer.ctx.lineJoin = 'round';
    layer.ctx.strokeStyle = colorPicker.value;
    layer.ctx.lineWidth = sizeRange.value;
    layer.ctx.beginPath();
    layer.ctx.moveTo(lastPoint.x, lastPoint.y);
    layer.ctx.lineTo(x, y);
    layer.ctx.stroke();
    lastPoint = {x,y};
  }
  else if (currentTool === 'eraser'){
    layer.ctx.globalCompositeOperation = 'destination-out';
    layer.ctx.lineCap = 'round';
    layer.ctx.lineJoin = 'round';
    layer.ctx.lineWidth = sizeRange.value;
    layer.ctx.beginPath();
    layer.ctx.moveTo(lastPoint.x,lastPoint.y);
    layer.ctx.lineTo(x,y);
    layer.ctx.stroke();
    layer.ctx.globalCompositeOperation = 'source-over';
    lastPoint = {x,y};
  }
  else if (currentTool === 'shape'){
    const ctxp = shapePreview.getContext('2d');
    const rect = wrap.getBoundingClientRect();
    ctxp.clearRect(0,0,rect.width,rect.height);

    const dx = x - shapeStart.x;
    const dy = y - shapeStart.y;

    ctxp.strokeStyle = colorPicker.value;
    ctxp.lineWidth = sizeRange.value;

    if (currentShape === 'rect'){
      ctxp.strokeRect(shapeStart.x,shapeStart.y,dx,dy);
    }
    else if (currentShape === 'circle'){
      const r = Math.sqrt(dx*dx + dy*dy);
      ctxp.beginPath(); ctxp.arc(shapeStart.x,shapeStart.y,r,0,Math.PI*2); ctxp.stroke();
    }
    else if (currentShape === 'line'){
      ctxp.beginPath(); ctxp.moveTo(shapeStart.x,shapeStart.y); ctxp.lineTo(x,y); ctxp.stroke();
    }
  }
}

function endDraw(){
  if (!drawing) return;
  drawing = false;

  if (currentTool === 'shape' && shapeStart){
    const layer = getActiveLayer();
    if (!layer) return;
    pushHistory(layer.id);

    const ctx = layer.ctx;
    const ctxp = shapePreview.getContext('2d');
    const rect = wrap.getBoundingClientRect();

    const img = ctxp.getImageData(0,0,rect.width,rect.height);
    ctx.putImageData(img,0,0);

    ctxp.clearRect(0,0,rect.width,rect.height);
    shapeStart = null;
  }
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
window.addEventListener('load', ()=>{
  const dataURL = localStorage.getItem('autosave_canvas');
  if(dataURL){
    const canvas = document.getElementById('myCanvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = dataURL;
    img.onload = ()=> ctx.drawImage(img, 0, 0);
  }
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
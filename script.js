const ratioMap = {
  '1:1': [1080, 1080],
  '4:5': [1080, 1350],
  '9:16': [1080, 1920]
};

const els = {
  canvas: document.getElementById('canvas'),
  imageInput: document.getElementById('imageInput'),
  fileMeta: document.getElementById('fileMeta'),
  textInput: document.getElementById('textInput'),
  fontSizeInput: document.getElementById('fontSizeInput'),
  fontSizeValue: document.getElementById('fontSizeValue'),
  colorInput: document.getElementById('colorInput'),
  xInput: document.getElementById('xInput'),
  xValue: document.getElementById('xValue'),
  yInput: document.getElementById('yInput'),
  yValue: document.getElementById('yValue'),
  fitSelect: document.getElementById('fitSelect'),
  formatSelect: document.getElementById('formatSelect'),
  imagePosXInput: document.getElementById('imagePosXInput'),
  imagePosXValue: document.getElementById('imagePosXValue'),
  imagePosYInput: document.getElementById('imagePosYInput'),
  imagePosYValue: document.getElementById('imagePosYValue'),
  resetImagePositionBtn: document.getElementById('resetImagePositionBtn'),
  previewLabel: document.getElementById('previewLabel'),
  message: document.getElementById('message'),
  downloadBtn: document.getElementById('downloadBtn'),
  resetBtn: document.getElementById('resetBtn'),
  templateNameInput: document.getElementById('templateNameInput'),
  saveTemplateBtn: document.getElementById('saveTemplateBtn'),
  updateTemplateBtn: document.getElementById('updateTemplateBtn'),
  templateList: document.getElementById('templateList'),
  templateCount: document.getElementById('templateCount'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  jsonInput: document.getElementById('jsonInput'),
  safeGuideToggle: document.getElementById('safeGuideToggle'),
  fontFamilySelect: document.getElementById('fontFamilySelect'),
  fontWeightSelect: document.getElementById('fontWeightSelect'),
  strokeWidthInput: document.getElementById('strokeWidthInput'),
  strokeWidthValue: document.getElementById('strokeWidthValue'),
  strokeColorInput: document.getElementById('strokeColorInput'),
  shadowToggle: document.getElementById('shadowToggle'),
  shadowBlurInput: document.getElementById('shadowBlurInput'),
  shadowBlurValue: document.getElementById('shadowBlurValue'),
  shadowOffsetInput: document.getElementById('shadowOffsetInput'),
  shadowOffsetValue: document.getElementById('shadowOffsetValue')
};

const ctx = els.canvas.getContext('2d');
const STORAGE_KEY = 't03_templates_v3';

let state = makeDefaultState();
let imageObj = null;
let templates = loadTemplates();
let selectedTemplateId = null;
let backgroundLayout = null;
let textBoxes = [];
let imageRequestId = 0;
const graphemes = value => typeof Intl.Segmenter === 'function'
  ? Array.from(new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(value), item => item.segment)
  : Array.from(value);
let dragState = {
  active: false,
  pointerId: null,
  startClientX: 0,
  startClientY: 0,
  startImagePosX: 50,
  startImagePosY: 50
};
let showSafeGuide = false;

function makeDefaultState() {
  return {
    ratio: '1:1',
    text: '오늘도 살아남았다',
    fontSize: 56,
    color: '#ffffff',
    x: 50,
    y: 78,
    fit: 'cover',
    fontFamily: 'system',
    fontWeight: 900,
    textAlign: 'center',
    strokeWidth: 8,
    strokeColor: '#000000',
    shadowEnabled: true,
    shadowBlur: 12,
    shadowOffset: 4,
    imagePosX: 50,
    imagePosY: 50,
    imageDataUrl: null,
    imageName: null
  };
}

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `template-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function clamp(num, min, max) {
  return Math.min(max, Math.max(min, num));
}

function showMessage(text, type = '') {
  els.message.textContent = text;
  els.message.className = `message ${type}`.trim();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;'
  }[c]));
}

function setCanvasSize() {
  const [w, h] = ratioMap[state.ratio];
  els.canvas.width = w;
  els.canvas.height = h;
  els.previewLabel.textContent = `${state.ratio} · ${w} × ${h}`;
}

function updateFileMeta() {
  const imageLabel = state.imageName ? state.imageName : '기본 배경 사용 중';
  els.fileMeta.textContent = `현재 배경: ${imageLabel} · 배경 위치 X ${state.imagePosX}% / Y ${state.imagePosY}%`;
}

function updateImagePositionInputs() {
  els.imagePosXInput.value = String(state.imagePosX);
  els.imagePosYInput.value = String(state.imagePosY);
  els.imagePosXValue.textContent = state.imagePosX;
  els.imagePosYValue.textContent = state.imagePosY;
}

function drawDefaultBackground() {
  const { width: cw, height: ch } = els.canvas;
  const grad = ctx.createLinearGradient(0, 0, cw, ch);
  grad.addColorStop(0, '#5b63f6');
  grad.addColorStop(1, '#272e49');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.beginPath();
  ctx.arc(cw * .82, ch * .18, Math.min(cw, ch) * .18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,.09)';
  ctx.fillRect(cw * 0.08, ch * 0.7, cw * 0.3, ch * 0.12);
}

function getBackgroundLayout() {
  if (!imageObj) return null;
  const cw = els.canvas.width;
  const ch = els.canvas.height;
  const iw = imageObj.naturalWidth || imageObj.width;
  const ih = imageObj.naturalHeight || imageObj.height;
  const scale = state.fit === 'contain'
    ? Math.min(cw / iw, ch / ih)
    : Math.max(cw / iw, ch / ih);
  const dw = iw * scale;
  const dh = ih * scale;

  const minDx = Math.min(0, cw - dw);
  const maxDx = Math.max(0, cw - dw);
  const minDy = Math.min(0, ch - dh);
  const maxDy = Math.max(0, ch - dh);

  const dxRange = maxDx - minDx;
  const dyRange = maxDy - minDy;

  const dx = dxRange === 0 ? minDx : minDx + (state.imagePosX / 100) * dxRange;
  const dy = dyRange === 0 ? minDy : minDy + (state.imagePosY / 100) * dyRange;

  return { cw, ch, iw, ih, dw, dh, dx, dy, minDx, maxDx, minDy, maxDy, dxRange, dyRange };
}

function drawBackground() {
  if (!imageObj) {
    backgroundLayout = null;
    drawDefaultBackground();
    return;
  }

  backgroundLayout = getBackgroundLayout();
  const { cw, ch, dx, dy, dw, dh } = backgroundLayout;
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(imageObj, dx, dy, dw, dh);
}

function splitLongToken(token, maxWidth) {
  const pieces = [];
  let part = '';
  for (const ch of graphemes(token)) {
    const test = part + ch;
    if (ctx.measureText(test).width > maxWidth && part) {
      pieces.push(part);
      part = ch;
    } else {
      part = test;
    }
  }
  if (part) pieces.push(part);
  return pieces;
}

function wrapParagraph(paragraph, maxWidth) {
  if (paragraph === '') return [''];
  const hasSpaces = /\s/.test(paragraph);
  const tokens = hasSpaces
    ? paragraph.split(/(\s+)/).filter(Boolean)
    : graphemes(paragraph);

  const lines = [];
  let current = '';

  for (const token of tokens) {
    const test = current + token;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
      continue;
    }

    if (current.trim() !== '') {
      lines.push(current.trimEnd());
      current = '';
    }

    if (ctx.measureText(token).width > maxWidth) {
      const pieces = splitLongToken(token, maxWidth);
      lines.push(...pieces.slice(0, -1));
      current = pieces.at(-1) || '';
    } else {
      current = token.trimStart();
    }
  }

  if (current !== '' || !lines.length) {
    lines.push(current.trimEnd());
  }
  return lines;
}

function drawText() {
  const text = state.text;
  textBoxes = [];
  if (!text) return;

  const scale = els.canvas.width / 1080;
  let fontSize = state.fontSize * scale;
  const maxWidth = els.canvas.width * 0.82;
  const padding = Math.max(16, state.strokeWidth / 2 + (state.shadowEnabled ? state.shadowBlur + state.shadowOffset : 0) + 8) * scale;

  ctx.save();
  const fontMap = {
    system: 'Pretendard, "Noto Sans KR", Arial, sans-serif',
    malgun: '"Malgun Gothic", "맑은 고딕", sans-serif',
    arial: 'Arial, sans-serif',
    impact: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
    georgia: 'Georgia, "Times New Roman", serif',
    courier: '"Courier New", Courier, monospace'
  };
  const family = fontMap[state.fontFamily] || fontMap.system;
  ctx.font = `${state.fontWeight} ${fontSize}px ${family}`;
  ctx.textAlign = state.textAlign;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = state.strokeColor;
  ctx.lineWidth = state.strokeWidth * scale;
  ctx.fillStyle = state.color;
  if (state.shadowEnabled) {
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = state.shadowBlur * scale;
    ctx.shadowOffsetX = state.shadowOffset * scale;
    ctx.shadowOffsetY = state.shadowOffset * scale;
  }

  let allLines;
  // Fit all lines before drawing; preserve explicit newlines and whole emoji clusters.
  for (let attempt = 0; attempt < 100; attempt++) {
    ctx.font = `${state.fontWeight} ${fontSize}px ${family}`;
    allLines = String(text).split('\n').flatMap(paragraph => wrapParagraph(paragraph, maxWidth));
    if (allLines.length * fontSize * 1.4 <= els.canvas.height - padding * 2) break;
    fontSize *= 0.9;
  }
  const lineHeight = fontSize * 1.4;
  const widest = Math.max(...allLines.map(line => ctx.measureText(line).width), 0);
  const leftExtent = state.textAlign === 'left' ? 0 : state.textAlign === 'right' ? widest : widest / 2;
  const rightExtent = widest - leftExtent;
  const halfHeight = allLines.length * lineHeight / 2;
  state.x = clamp(Math.round(state.x * 10) / 10,
    Math.ceil((padding + leftExtent) / els.canvas.width * 1000) / 10,
    Math.floor((els.canvas.width - padding - rightExtent) / els.canvas.width * 1000) / 10);
  state.y = clamp(Math.round(state.y * 10) / 10,
    Math.ceil((padding + halfHeight) / els.canvas.height * 1000) / 10,
    Math.floor((els.canvas.height - padding - halfHeight) / els.canvas.height * 1000) / 10);
  const x = els.canvas.width * state.x / 100;
  const y = els.canvas.height * state.y / 100;
  const totalHeight = lineHeight * Math.max(allLines.length - 1, 0);
  allLines.forEach((line, index) => {
    const lineY = y - totalHeight / 2 + index * lineHeight;
    if (line !== '') {
      const metrics = ctx.measureText(line);
      const left = x - (state.textAlign === 'left' ? 0 : state.textAlign === 'right' ? metrics.width : metrics.width / 2);
      textBoxes.push({ left: left - 12 * scale, top: lineY - lineHeight / 2,
        right: left + metrics.width + 12 * scale, bottom: lineY + lineHeight / 2 });
      if (state.strokeWidth > 0) ctx.strokeText(line, x, lineY, maxWidth);
      ctx.fillText(line, x, lineY, maxWidth);
    }
  });
  ctx.restore();
}

function drawSafeGuide() {
  if (!showSafeGuide) return;
  const marginX = els.canvas.width * 0.08;
  const marginY = els.canvas.height * 0.08;
  ctx.save();
  ctx.strokeStyle = 'rgba(216,255,98,.95)';
  ctx.lineWidth = Math.max(2, els.canvas.width / 540);
  ctx.setLineDash([14, 10]);
  ctx.strokeRect(marginX, marginY, els.canvas.width - marginX * 2, els.canvas.height - marginY * 2);
  ctx.restore();
}

function render(includeGuide = true) {
  setCanvasSize();
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  drawBackground();
  drawText();
  if (includeGuide) drawSafeGuide();
  updateImagePositionInputs();
  updateFileMeta();
  els.xInput.value = String(state.x);
  els.yInput.value = String(state.y);
  els.xValue.textContent = state.x;
  els.yValue.textContent = state.y;
  els.canvas.classList.toggle('is-draggable', Boolean(imageObj || textBoxes.length));
}

function syncStateFromInputs() {
  if (els.textInput.value.length > 2000) {
    els.textInput.value = state.text;
    showMessage('문구는 2,000자까지 입력할 수 있습니다. 기존 작업은 유지됩니다.', 'error');
    return;
  }
  state.text = els.textInput.value;
  state.fontSize = Number(els.fontSizeInput.value);
  state.color = els.colorInput.value;
  state.x = Number(els.xInput.value);
  state.y = Number(els.yInput.value);
  state.fit = els.fitSelect.value;
  state.fontFamily = els.fontFamilySelect.value;
  state.fontWeight = Number(els.fontWeightSelect.value);
  state.strokeWidth = Number(els.strokeWidthInput.value);
  state.strokeColor = els.strokeColorInput.value;
  state.shadowEnabled = els.shadowToggle.checked;
  state.shadowBlur = Number(els.shadowBlurInput.value);
  state.shadowOffset = Number(els.shadowOffsetInput.value);
  state.imagePosX = Number(els.imagePosXInput.value);
  state.imagePosY = Number(els.imagePosYInput.value);

  els.fontSizeValue.textContent = state.fontSize;
  els.xValue.textContent = state.x;
  els.yValue.textContent = state.y;
  els.imagePosXValue.textContent = state.imagePosX;
  els.imagePosYValue.textContent = state.imagePosY;
  els.strokeWidthValue.textContent = state.strokeWidth;
  els.shadowBlurValue.textContent = state.shadowBlur;
  els.shadowOffsetValue.textContent = state.shadowOffset;
  render();
}

['input', 'change'].forEach(eventName => {
  [
    els.textInput,
    els.fontSizeInput,
    els.colorInput,
    els.xInput,
    els.yInput,
    els.fitSelect,
    els.imagePosXInput,
    els.imagePosYInput,
    els.fontFamilySelect,
    els.fontWeightSelect,
    els.strokeWidthInput,
    els.strokeColorInput,
    els.shadowToggle,
    els.shadowBlurInput,
    els.shadowOffsetInput
  ].forEach(el => {
    el.addEventListener(eventName, syncStateFromInputs);
  });
});

document.querySelectorAll('.align-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.textAlign = btn.dataset.align;
    document.querySelectorAll('.align-btn').forEach(target => {
      target.classList.toggle('active', target === btn);
    });
    render();
  });
});

document.querySelectorAll('.ratio-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.ratio = btn.dataset.ratio;
    document.querySelectorAll('.ratio-btn').forEach(target => {
      target.classList.toggle('active', target === btn);
    });
    render();
  });
});

els.resetImagePositionBtn.addEventListener('click', () => {
  state.imagePosX = 50;
  state.imagePosY = 50;
  updateImagePositionInputs();
  render();
  showMessage('이미지 위치를 가운데로 되돌렸습니다.', 'success');
});

els.imageInput.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;

  const allowedTypes = ['image/png', 'image/jpeg'];
  if (!allowedTypes.includes(file.type)) {
    showMessage('지원하지 않는 파일입니다. PNG 또는 JPEG만 업로드할 수 있습니다. 기존 작업은 유지됩니다.', 'error');
    event.target.value = '';
    return;
  }

  try {
    if (file.size > 15 * 1024 * 1024) throw new Error('image size');
    const requestId = ++imageRequestId;
    const dataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(dataUrl);
    const cleanDataUrl = cleanImage(img);
    const cleanImg = await loadImage(cleanDataUrl);
    if (requestId !== imageRequestId) return;
    state.imageDataUrl = cleanDataUrl;
    state.imageName = file.name;
    state.imagePosX = 50;
    state.imagePosY = 50;
    imageObj = cleanImg;
    render();
    showMessage(`${file.name} 이미지를 불러왔습니다. 미리보기에서 드래그해 위치를 조정할 수 있습니다.`, 'success');
  } catch (error) {
    showMessage('이미지를 읽지 못했습니다. 정상 PNG/JPEG(15MB 이하)를 선택해주세요. 기존 작업은 유지됩니다.', 'error');
  } finally {
    event.target.value = '';
  }
});

function cleanImage(img) {
  const surface = document.createElement('canvas');
  const factor = Math.min(1, 2160 / Math.max(img.naturalWidth, img.naturalHeight));
  surface.width = Math.max(1, Math.round(img.naturalWidth * factor));
  surface.height = Math.max(1, Math.round(img.naturalHeight * factor));
  surface.getContext('2d').drawImage(img, 0, 0, surface.width, surface.height);
  return surface.toDataURL('image/png');
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function makeDownloadName() {
  const safeRatio = state.ratio.replace(':', 'x');
  const time = new Date().toISOString().replace(/[:.]/g, '-');
  return `card-${safeRatio}-${time}`;
}

els.downloadBtn.addEventListener('click', () => {
  render(false);
  const format = els.formatSelect.value;
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  const quality = format === 'jpeg' ? 0.92 : undefined;
  const link = document.createElement('a');
  link.download = `${makeDownloadName()}.${ext}`;
  link.href = els.canvas.toDataURL(mime, quality);
  link.click();
  render(true);
  showMessage('미리보기와 같은 Canvas 결과를 파일로 저장했습니다.', 'success');
});

els.resetBtn.addEventListener('click', () => {
  imageRequestId++;
  state = makeDefaultState();
  imageObj = null;
  selectedTemplateId = null;
  dragState.active = false;
  els.textInput.value = state.text;
  els.fontSizeInput.value = state.fontSize;
  els.colorInput.value = state.color;
  els.xInput.value = state.x;
  els.yInput.value = state.y;
  els.fitSelect.value = state.fit;
  els.fontFamilySelect.value = state.fontFamily;
  els.fontWeightSelect.value = String(state.fontWeight);
  els.strokeWidthInput.value = String(state.strokeWidth);
  els.strokeColorInput.value = state.strokeColor;
  els.shadowToggle.checked = state.shadowEnabled;
  els.shadowBlurInput.value = String(state.shadowBlur);
  els.shadowOffsetInput.value = String(state.shadowOffset);
  document.querySelectorAll('.align-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.align === state.textAlign));
  els.templateNameInput.value = '';
  els.updateTemplateBtn.disabled = true;
  if (els.safeGuideToggle) els.safeGuideToggle.checked = false;
  showSafeGuide = false;
  document.querySelectorAll('.ratio-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ratio === state.ratio);
  });
  updateImagePositionInputs();
  syncStateFromInputs();
  renderTemplates();
  showMessage('편집 화면을 초기화했습니다.');
});

function loadTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('t03_templates_v2') || localStorage.getItem('t03_templates_v1');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isValidTemplate).map(normalizeTemplate) : [];
  } catch {
    return [];
  }
}

function persistTemplates(nextTemplates) {
  // Commit to storage first: quota/security failures must preserve the current list.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTemplates));
    templates = nextTemplates;
    return true;
  } catch {
    showMessage('저장 공간이 부족하거나 브라우저 저장이 차단되어 있습니다. 기존 템플릿은 유지됩니다. JSON 백업 후 용량을 확보해주세요.', 'error');
    return false;
  }
}

function normalizeTemplate(template) {
  return {
    ...template,
    fontFamily: typeof template.fontFamily === 'string' ? template.fontFamily : 'system',
    fontWeight: typeof template.fontWeight === 'number' ? template.fontWeight : 900,
    textAlign: ['left','center','right'].includes(template.textAlign) ? template.textAlign : 'center',
    strokeWidth: typeof template.strokeWidth === 'number' ? template.strokeWidth : 8,
    strokeColor: typeof template.strokeColor === 'string' ? template.strokeColor : '#000000',
    shadowEnabled: typeof template.shadowEnabled === 'boolean' ? template.shadowEnabled : true,
    shadowBlur: typeof template.shadowBlur === 'number' ? template.shadowBlur : 12,
    shadowOffset: typeof template.shadowOffset === 'number' ? template.shadowOffset : 4,
    imagePosX: typeof template.imagePosX === 'number' ? clamp(template.imagePosX, 0, 100) : 50,
    imagePosY: typeof template.imagePosY === 'number' ? clamp(template.imagePosY, 0, 100) : 50,
    imageDataUrl: template.imageDataUrl ?? null,
    imageName: template.imageName ?? null
  };
}

function makeTemplate(name, id = makeId()) {
  return {
    id,
    name,
    ratio: state.ratio,
    text: state.text,
    fontSize: state.fontSize,
    color: state.color,
    x: state.x,
    y: state.y,
    fit: state.fit,
    fontFamily: state.fontFamily,
    fontWeight: state.fontWeight,
    textAlign: state.textAlign,
    strokeWidth: state.strokeWidth,
    strokeColor: state.strokeColor,
    shadowEnabled: state.shadowEnabled,
    shadowBlur: state.shadowBlur,
    shadowOffset: state.shadowOffset,
    imagePosX: state.imagePosX,
    imagePosY: state.imagePosY,
    imageDataUrl: state.imageDataUrl,
    imageName: state.imageName,
    updatedAt: new Date().toISOString()
  };
}

function isValidTemplate(template) {
  const required = ['id', 'name', 'ratio', 'text', 'fontSize', 'color', 'x', 'y', 'fit', 'updatedAt'];
  if (!template || typeof template !== 'object') return false;
  if (!required.every(key => Object.prototype.hasOwnProperty.call(template, key))) return false;
  if (!Object.prototype.hasOwnProperty.call(ratioMap, template.ratio)) return false;
  if (typeof template.id !== 'string' || typeof template.name !== 'string' || typeof template.text !== 'string') return false;
  if (!template.id.trim() || !template.name.trim() || template.name.length > 40 || template.text.length > 2000) return false;
  if (!Number.isFinite(template.fontSize) || template.fontSize < 18 || template.fontSize > 120) return false;
  if (!Number.isFinite(template.x) || template.x < 0 || template.x > 100) return false;
  if (!Number.isFinite(template.y) || template.y < 0 || template.y > 100) return false;
  if (!/^#[0-9a-f]{6}$/i.test(template.color)) return false;
  if (typeof template.updatedAt !== 'string' || !Number.isFinite(Date.parse(template.updatedAt))) return false;
  if (!['cover', 'contain'].includes(template.fit)) return false;
  if (template.imageDataUrl != null && (typeof template.imageDataUrl !== 'string' || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(template.imageDataUrl))) return false;
  if (template.imageName != null && typeof template.imageName !== 'string') return false;
  if (template.imagePosX != null && (typeof template.imagePosX !== 'number' || Number.isNaN(template.imagePosX))) return false;
  if (template.imagePosY != null && (typeof template.imagePosY !== 'number' || Number.isNaN(template.imagePosY))) return false;
  for (const [key, max] of [['strokeWidth',24],['shadowBlur',30],['shadowOffset',20],['imagePosX',100],['imagePosY',100]]) {
    if (key in template && (!Number.isFinite(template[key]) || template[key] < 0 || template[key] > max)) return false;
  }
  if ('fontFamily' in template && !['system','malgun','arial','impact','georgia','courier'].includes(template.fontFamily)) return false;
  if ('fontWeight' in template && ![400,700,900].includes(template.fontWeight)) return false;
  if ('textAlign' in template && !['left','center','right'].includes(template.textAlign)) return false;
  if ('strokeColor' in template && !/^#[0-9a-f]{6}$/i.test(template.strokeColor)) return false;
  if ('shadowEnabled' in template && typeof template.shadowEnabled !== 'boolean') return false;
  return true;
}

els.saveTemplateBtn.addEventListener('click', () => {
  const name = els.templateNameInput.value.trim();
  if (!name) {
    showMessage('템플릿 이름을 입력해주세요.', 'error');
    return;
  }
  if (templates.length >= 50) { showMessage('템플릿은 최대 50개까지 저장할 수 있습니다.', 'error'); return; }
  if (!persistTemplates([makeTemplate(name), ...templates])) return;
  els.templateNameInput.value = '';
  renderTemplates();
  showMessage(`'${name}' 템플릿을 저장했습니다.`, 'success');
});

els.updateTemplateBtn.addEventListener('click', () => {
  const target = templates.find(template => template.id === selectedTemplateId);
  if (!target) {
    showMessage('수정할 템플릿을 먼저 선택해주세요.', 'error');
    return;
  }
  const name = els.templateNameInput.value.trim() || target.name;
  const updated = makeTemplate(name, target.id);
  if (!persistTemplates(templates.map(template => template.id === target.id ? updated : template))) return;
  renderTemplates();
  showMessage(`'${name}' 템플릿을 수정했습니다.`, 'success');
});

async function applyTemplate(template) {
  const normalized = normalizeTemplate(template);
  const requestId = ++imageRequestId;
  let nextImage;
  try { nextImage = normalized.imageDataUrl ? await loadImage(normalized.imageDataUrl) : null; }
  catch { showMessage('템플릿 이미지를 읽지 못했습니다. 기존 작업은 유지됩니다.', 'error'); return false; }
  if (requestId !== imageRequestId) return false;
  selectedTemplateId = normalized.id;
  state = {
    ratio: normalized.ratio,
    text: normalized.text,
    fontSize: normalized.fontSize,
    color: normalized.color,
    x: normalized.x,
    y: normalized.y,
    fit: normalized.fit,
    fontFamily: normalized.fontFamily,
    fontWeight: normalized.fontWeight,
    textAlign: normalized.textAlign,
    strokeWidth: normalized.strokeWidth,
    strokeColor: normalized.strokeColor,
    shadowEnabled: normalized.shadowEnabled,
    shadowBlur: normalized.shadowBlur,
    shadowOffset: normalized.shadowOffset,
    imagePosX: normalized.imagePosX,
    imagePosY: normalized.imagePosY,
    imageDataUrl: normalized.imageDataUrl,
    imageName: normalized.imageName
  };
  imageObj = nextImage;
  els.textInput.value = state.text;
  els.fontSizeInput.value = String(state.fontSize);
  els.colorInput.value = state.color;
  els.xInput.value = String(state.x);
  els.yInput.value = String(state.y);
  els.fitSelect.value = state.fit;
  els.fontFamilySelect.value = state.fontFamily;
  els.fontWeightSelect.value = String(state.fontWeight);
  els.strokeWidthInput.value = String(state.strokeWidth);
  els.strokeColorInput.value = state.strokeColor;
  els.shadowToggle.checked = state.shadowEnabled;
  els.shadowBlurInput.value = String(state.shadowBlur);
  els.shadowOffsetInput.value = String(state.shadowOffset);
  document.querySelectorAll('.align-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.align === state.textAlign));
  els.templateNameInput.value = normalized.name;
  els.updateTemplateBtn.disabled = false;
  document.querySelectorAll('.ratio-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ratio === state.ratio);
  });
  updateImagePositionInputs();
  syncStateFromInputs();
  renderTemplates();
  return true;
}

function renderTemplates() {
  els.templateCount.textContent = `${templates.length}개`;
  if (!templates.length) {
    els.templateList.innerHTML = '<div class="empty-state">아직 저장된 템플릿이 없습니다.\n현재 편집 상태를 이름 붙여 저장해보세요.</div>';
    return;
  }

  els.templateList.innerHTML = templates.map(template => {
    const normalized = normalizeTemplate(template);
    return `
      <article class="template-card ${normalized.id === selectedTemplateId ? 'selected' : ''}">
        <div class="template-card-top">
          <h4>${escapeHtml(normalized.name)}</h4>
          <span class="count-badge">${normalized.ratio}</span>
        </div>
        <div class="template-meta">
          문구: ${escapeHtml((normalized.text || '(빈 문구)').slice(0, 40))}<br>
          배경: ${escapeHtml(normalized.imageName || '기본 배경')}<br>
          이미지 위치: X ${normalized.imagePosX}% / Y ${normalized.imagePosY}%
        </div>
        <div class="template-buttons">
          <button type="button" data-action="load" data-id="${escapeHtml(normalized.id)}">불러오기</button>
          <button type="button" class="delete-btn" data-action="delete" data-id="${escapeHtml(normalized.id)}">삭제</button>
        </div>
      </article>
    `;
  }).join('');

  els.templateList.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', async () => {
      const template = templates.find(item => item.id === button.dataset.id);
      if (!template) return;

      if (button.dataset.action === 'load') {
        if (await applyTemplate(template)) showMessage(`'${template.name}' 템플릿을 불러왔습니다.`, 'success');
      }

      if (button.dataset.action === 'delete') {
        if (!persistTemplates(templates.filter(item => item.id !== template.id))) return;
        if (selectedTemplateId === template.id) {
          selectedTemplateId = null;
          els.updateTemplateBtn.disabled = true;
          els.templateNameInput.value = '';
        }
        renderTemplates();
        showMessage(`'${template.name}' 템플릿을 삭제했습니다.`);
      }
    });
  });
}

els.exportJsonBtn.addEventListener('click', () => {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    templates: templates.map(normalizeTemplate)
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'card-studio-templates.json';
  link.click();
  URL.revokeObjectURL(url);
  showMessage('템플릿 JSON을 내보냈습니다.', 'success');
});

els.jsonInput.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('JSON 파일은 20MB 이하여야 합니다.');
    const text = await readFileAsText(file);
    const parsed = JSON.parse(text);

    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.templates)) {
      throw new Error('필수 구조(version, templates)가 없습니다.');
    }

    if (!parsed.templates.every(isValidTemplate)) {
      throw new Error('필수 항목이 빠지거나 형식이 잘못된 템플릿이 있습니다.');
    }
    if (parsed.templates.length > 50 || new Set(parsed.templates.map(item => item.id)).size !== parsed.templates.length) {
      throw new Error('템플릿이 50개를 초과하거나 ID가 중복됩니다.');
    }

    const nextTemplates = parsed.templates.map(item => normalizeTemplate({ ...item }));
    for (const item of nextTemplates) {
      if (item.imageDataUrl) item.imageDataUrl = cleanImage(await loadImage(item.imageDataUrl));
    }
    if (!persistTemplates(nextTemplates)) return;
    selectedTemplateId = null;
    els.updateTemplateBtn.disabled = true;
    els.templateNameInput.value = '';
    renderTemplates();
    showMessage(`${templates.length}개의 템플릿을 안전하게 복원했습니다.`, 'success');
  } catch (error) {
    showMessage(`JSON을 가져오지 않았습니다: ${error.message} 기존 템플릿은 유지됩니다.`, 'error');
  } finally {
    event.target.value = '';
  }
});

function initializeInputs() {
  els.textInput.value = state.text;
  els.fontSizeInput.value = state.fontSize;
  els.colorInput.value = state.color;
  els.xInput.value = state.x;
  els.yInput.value = state.y;
  els.fitSelect.value = state.fit;
  els.fontFamilySelect.value = state.fontFamily;
  els.fontWeightSelect.value = String(state.fontWeight);
  els.strokeWidthInput.value = String(state.strokeWidth);
  els.strokeColorInput.value = state.strokeColor;
  els.shadowToggle.checked = state.shadowEnabled;
  els.shadowBlurInput.value = String(state.shadowBlur);
  els.shadowOffsetInput.value = String(state.shadowOffset);
  document.querySelectorAll('.align-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.align === state.textAlign));
  updateImagePositionInputs();
  document.querySelectorAll('.ratio-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ratio === state.ratio);
  });
  updateFileMeta();
  if (els.safeGuideToggle) els.safeGuideToggle.checked = showSafeGuide;
}

function getCanvasScaleInfo() {
  const rect = els.canvas.getBoundingClientRect();
  return {
    rect,
    scaleX: rect.width ? els.canvas.width / rect.width : 1,
    scaleY: rect.height ? els.canvas.height / rect.height : 1
  };
}

function onPointerDown(event) {
  if (event.button > 0 || dragState.active) return;
  const { rect, scaleX, scaleY } = getCanvasScaleInfo();
  const px = (event.clientX - rect.left) * scaleX;
  const py = (event.clientY - rect.top) * scaleY;
  const hitText = textBoxes.some(box => px >= box.left && px <= box.right && py >= box.top && py <= box.bottom);
  if (!hitText && !imageObj) return;
  dragState.target = hitText ? 'text' : 'image';
  dragState.startX = state.x;
  dragState.startY = state.y;
  dragState.active = true;
  dragState.pointerId = event.pointerId;
  dragState.startClientX = event.clientX;
  dragState.startClientY = event.clientY;
  dragState.startImagePosX = state.imagePosX;
  dragState.startImagePosY = state.imagePosY;
  els.canvas.classList.add('is-dragging');
  els.canvas.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function onPointerMove(event) {
  if (!dragState.active || dragState.pointerId !== event.pointerId) return;
  if (dragState.target === 'text') {
    const { rect } = getCanvasScaleInfo();
    if (!rect.width || !rect.height) return;
    state.x = clamp(dragState.startX + (event.clientX - dragState.startClientX) / rect.width * 100, 0, 100);
    state.y = clamp(dragState.startY + (event.clientY - dragState.startClientY) / rect.height * 100, 0, 100);
    render();
    event.preventDefault();
    return;
  }
  const layout = backgroundLayout || getBackgroundLayout();
  if (!layout) return;

  const { rect } = getCanvasScaleInfo();
  if (!rect.width || !rect.height) return;
  const deltaClientX = event.clientX - dragState.startClientX;
  const deltaClientY = event.clientY - dragState.startClientY;
  const deltaCanvasX = deltaClientX * (els.canvas.width / rect.width);
  const deltaCanvasY = deltaClientY * (els.canvas.height / rect.height);

  const nextX = layout.dxRange === 0
    ? 50
    : dragState.startImagePosX + (deltaCanvasX / layout.dxRange) * 100;
  const nextY = layout.dyRange === 0
    ? 50
    : dragState.startImagePosY + (deltaCanvasY / layout.dyRange) * 100;

  state.imagePosX = Math.round(clamp(nextX, 0, 100));
  state.imagePosY = Math.round(clamp(nextY, 0, 100));
  render();
}

function endDrag(event) {
  if (dragState.pointerId != null && event.pointerId != null && dragState.pointerId !== event.pointerId) return;
  if (dragState.pointerId !== null && els.canvas.hasPointerCapture?.(dragState.pointerId)) els.canvas.releasePointerCapture(dragState.pointerId);
  dragState.active = false;
  dragState.pointerId = null;
  els.canvas.classList.remove('is-dragging');
}

els.canvas.addEventListener('pointerdown', onPointerDown);
els.canvas.addEventListener('pointermove', onPointerMove);
els.canvas.addEventListener('pointerup', endDrag);
els.canvas.addEventListener('pointercancel', endDrag);
els.canvas.addEventListener('lostpointercapture', endDrag);
els.canvas.addEventListener('pointerleave', event => {
  if (dragState.active) return;
  els.canvas.classList.remove('is-dragging');
});



const presetMap = {
  meme: { ratio: '1:1', fontSize: 56, x: 50, y: 78 },
  feed: { ratio: '4:5', fontSize: 50, x: 50, y: 62 },
  story: { ratio: '9:16', fontSize: 52, x: 50, y: 74 }
};

document.querySelectorAll('.preset-btn').forEach(button => {
  button.addEventListener('click', () => {
    const preset = presetMap[button.dataset.preset];
    if (!preset) return;
    state.ratio = preset.ratio;
    state.fontSize = preset.fontSize;
    state.x = preset.x;
    state.y = preset.y;
    els.fontSizeInput.value = String(state.fontSize);
    els.xInput.value = String(state.x);
    els.yInput.value = String(state.y);
    document.querySelectorAll('.ratio-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ratio === state.ratio);
    });
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.toggle('active', btn === button));
    syncStateFromInputs();
    showMessage(`${button.querySelector('b').textContent} 레이아웃을 적용했습니다.`, 'success');
  });
});

els.safeGuideToggle.addEventListener('change', () => {
  showSafeGuide = els.safeGuideToggle.checked;
  render(true);
});

initializeInputs();
renderTemplates();
syncStateFromInputs();

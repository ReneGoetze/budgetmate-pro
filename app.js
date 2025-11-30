// BudgetMate Pro v12 - Filters popup + PDF export + CSV/PDF import + camera OCR
// IMPORTANT: set your PDF backend URL here (Node server):
// e.g. const PDF_WORKER_URL = 'https://budgetmate-pdf.onrender.com/pdf-to-csv';
const PDF_WORKER_URL = 'https://budgetmate-pdf.YOUR_BACKEND_HOST/pdf-to-csv';

const STORAGE_KEY = 'bm_expenses';
const CATEGORY_KEY = 'bm_categories';
const SETTINGS_KEY = 'bm_settings';

const COLOR_GREEN = 'rgba(34,197,94,0.8)';
const COLOR_RED   = 'rgba(239,68,68,0.8)';
const COLOR_NEUTRAL = 'rgba(59,130,246,0.5)';

// Current filter: period + category
let currentFilter = {
  period: 'all',   // 'all' | 'day' | 'week' | 'month'
  category: 'all'  // 'all' | category name
};

function loadJSON(key, fallback){
  const raw = localStorage.getItem(key);
  if(!raw) return fallback;
  try { return JSON.parse(raw); } catch(e){ return fallback; }
}
function saveJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function loadExpenses(){ return loadJSON(STORAGE_KEY, []); }
function saveExpenses(expenses){ saveJSON(STORAGE_KEY, expenses); }

function loadCategories(){ return loadJSON(CATEGORY_KEY, []); }
function saveCategories(cats){ saveJSON(CATEGORY_KEY, cats); }

function loadSettings(){
  return loadJSON(SETTINGS_KEY, {
    dailyBudget: null,
    monthlyBudget: null,
    darkMode: false
  });
}
function saveSettings(s){ saveJSON(SETTINGS_KEY, s); }

function addExpense(date, amount, category, note){
  const expenses = loadExpenses();
  const id = Date.now() + Math.random();
  expenses.push({ id, date, amount, category, note: note || '' });
  saveExpenses(expenses);

  const cats = loadCategories();
  const cTrim = (category || '').trim();
  if(cTrim && !cats.includes(cTrim)){
    cats.push(cTrim);
    saveCategories(cats);
  }
}

function deleteExpense(id){
  let expenses = loadExpenses();
  expenses = expenses.filter(e => e.id !== id);
  saveExpenses(expenses);
}

function todayDate(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}
function getCurrentMonthKey(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
}
function getCurrentWeekRange(){
  const d = new Date();
  const day = d.getDay();
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
}
function filterCurrentMonth(expenses){
  const mk = getCurrentMonthKey();
  return expenses.filter(e => (e.date || '').startsWith(mk));
}
function filterCurrentDay(expenses){
  const t = todayDate();
  return expenses.filter(e => e.date === t);
}
function filterCurrentWeek(expenses){
  const { start, end } = getCurrentWeekRange();
  return expenses.filter(e => {
    if(!e.date) return false;
    const d = new Date(e.date);
    return d >= start && d <= end;
  });
}

// Apply currentFilter to all expenses
function getFilteredExpenses(){
  let expenses = loadExpenses();

  // Period filter
  switch(currentFilter.period){
    case 'day':
      expenses = filterCurrentDay(expenses);
      break;
    case 'week':
      expenses = filterCurrentWeek(expenses);
      break;
    case 'month':
      expenses = filterCurrentMonth(expenses);
      break;
    case 'all':
    default:
      break;
  }

  // Category filter
  if(currentFilter.category !== 'all'){
    const cat = currentFilter.category;
    expenses = expenses.filter(e => (e.category || '') === cat);
  }
  return expenses;
}

function buildMonthlyData(expenses){
  const map = {};
  expenses.forEach(e=>{
    if(!e.date) return;
    const day = e.date.slice(8,10);
    map[day] = (map[day] || 0) + Number(e.amount||0);
  });
  const days = Object.keys(map).sort();
  return { days, values: days.map(d=>map[d]) };
}
function buildCategoryData(expenses){
  const map = {};
  expenses.forEach(e=>{
    const cat = e.category && e.category.trim() ? e.category.trim() : 'Uncategorized';
    map[cat] = (map[cat] || 0) + Number(e.amount||0);
  });
  const labels = Object.keys(map);
  return { labels, values: labels.map(l=>map[l]) };
}
function buildTrendData(expenses){
  const map = {};
  expenses.forEach(e=>{
    if(!e.date) return;
    const key = e.date.slice(0,7);
    map[key] = (map[key] || 0) + Number(e.amount||0);
  });
  const keys = Object.keys(map).sort().slice(-6);
  return { labels: keys, values: keys.map(k=>map[k]) };
}
function currentMonthTotal(expenses){
  return filterCurrentMonth(expenses).reduce((s,e)=>s+Number(e.amount||0),0);
}

let monthlyChart, catMonthChart, catWeekChart, catDayChart, trendChart;

function renderCategoryList(){
  const cats = loadCategories().slice().sort((a,b)=>a.localeCompare(b));
  const dl = document.getElementById('categoryList');
  if(!dl) return;
  dl.innerHTML = '';
  cats.forEach(c=>{
    const opt = document.createElement('option');
    opt.value = c;
    dl.appendChild(opt);
  });
}

function renderCategoryManager(){
  const cont = document.getElementById('categoryManager');
  if(!cont) return;
  const cats = loadCategories().slice().sort((a,b)=>a.localeCompare(b));
  if(!cats.length){
    cont.textContent = 'No saved categories yet. They will appear here once you use them.';
    return;
  }
  cont.innerHTML = '';
  cats.forEach(cat=>{
    const row = document.createElement('div');
    row.className = 'cat-item';
    const span = document.createElement('span');
    span.textContent = cat;
    const buttons = document.createElement('div');
    buttons.className = 'cat-item-buttons';
    const renameBtn = document.createElement('button');
    renameBtn.textContent = 'Rename';
    renameBtn.className = 'cat-item-btn';
    renameBtn.addEventListener('click', ()=>{
      const neu = prompt('New name for category:', cat);
      if(!neu) return;
      const trimmed = neu.trim();
      if(!trimmed) return;
      const all = loadCategories();
      const idx = all.indexOf(cat);
      if(idx>=0) all[idx] = trimmed;
      saveCategories(all);
      const expenses = loadExpenses();
      expenses.forEach(e=>{
        if((e.category||'').trim()===cat) e.category = trimmed;
      });
      saveExpenses(expenses);
      renderCategoryList();
      renderCategoryManager();
      renderCharts();
      renderExpenseTable();
    });
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.className = 'cat-item-btn';
    delBtn.addEventListener('click', ()=>{
      if(!confirm('Delete this category from suggestions? Existing expenses keep their category.')) return;
      const all = loadCategories().filter(c=>c!==cat);
      saveCategories(all);
      renderCategoryList();
      renderCategoryManager();
    });
    buttons.appendChild(renameBtn);
    buttons.appendChild(delBtn);
    row.appendChild(span);
    row.appendChild(buttons);
    cont.appendChild(row);
  });
}

function renderCharts(){
  const expenses = getFilteredExpenses();
  const allExpenses = loadExpenses();
  const cm = filterCurrentMonth(expenses);
  const cw = filterCurrentWeek(expenses);
  const cd = filterCurrentDay(expenses);

  const m = buildMonthlyData(expenses);
  const cMonth = buildCategoryData(cm);
  const cWeek = buildCategoryData(cw);
  const cDay = buildCategoryData(cd);
  const t = buildTrendData(expenses.length ? expenses : allExpenses);
  const s = loadSettings();

  const mCtx = document.getElementById('monthlyChart');
  const cMonthCtx = document.getElementById('catMonthChart');
  const cWeekCtx = document.getElementById('catWeekChart');
  const cDayCtx = document.getElementById('catDayChart');
  const tCtx = document.getElementById('trendChart');
  if(!mCtx || !cMonthCtx || !cWeekCtx || !cDayCtx || !tCtx || typeof Chart === 'undefined') return;

  if(monthlyChart) monthlyChart.destroy();
  if(catMonthChart) catMonthChart.destroy();
  if(catWeekChart) catWeekChart.destroy();
  if(catDayChart) catDayChart.destroy();
  if(trendChart) trendChart.destroy();

  let barColors = m.values.map(()=>COLOR_NEUTRAL);
  if(s.dailyBudget){
    const db = Number(s.dailyBudget);
    barColors = m.values.map(v => v <= db ? COLOR_GREEN : COLOR_RED);
  }

  monthlyChart = new Chart(mCtx, {
    type:'bar',
    data:{ labels:m.days, datasets:[{ label:'Daily Spending (€)', data:m.values, backgroundColor:barColors }] }
  });

  catMonthChart = new Chart(cMonthCtx, {
    type:'doughnut',
    data:{ labels:cMonth.labels, datasets:[{ data:cMonth.values }] }
  });
  catWeekChart = new Chart(cWeekCtx, {
    type:'doughnut',
    data:{ labels:cWeek.labels, datasets:[{ data:cWeek.values }] }
  });
  catDayChart = new Chart(cDayCtx, {
    type:'doughnut',
    data:{ labels:cDay.labels, datasets:[{ data:cDay.values }] }
  });

  const cmTotal = currentMonthTotal(expenses.length ? expenses : allExpenses);
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
  let limit = null;
  if(s.monthlyBudget) limit = Number(s.monthlyBudget);
  else if(s.dailyBudget) limit = Number(s.dailyBudget) * daysInMonth;
  let lineColor = COLOR_NEUTRAL;
  if(limit != null) lineColor = cmTotal <= limit ? COLOR_GREEN : COLOR_RED;

  trendChart = new Chart(tCtx, {
    type:'line',
    data:{ labels:t.labels, datasets:[{ label:'Monthly Total (€)', data:t.values, borderColor:lineColor, backgroundColor:lineColor, tension:0.2 }] }
  });
}

function renderExpenseTable(){
  const tbody = document.querySelector('#expenseTable tbody');
  const bar = document.getElementById('summaryBar');
  if(!tbody || !bar) return;
  const s = loadSettings();
  const expenses = getFilteredExpenses();

  tbody.innerHTML = '';
  let total = 0;
  expenses.sort((a,b)=> (a.date||'').localeCompare(b.date||''));
  expenses.forEach(e=>{
    total += Number(e.amount||0);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${e.date || ''}</td>
      <td>${e.category || ''}</td>
      <td>${Number(e.amount||0).toFixed(2)}</td>
      <td><button class="del-btn" data-id="${e.id}">Del</button></td>`;
    tbody.appendChild(tr);
  });

  let periodLabel = 'All data';
  if(currentFilter.period==='day') periodLabel = 'Today';
  else if(currentFilter.period==='week') periodLabel = 'This week';
  else if(currentFilter.period==='month') periodLabel = 'This month';

  let catLabel = '';
  if(currentFilter.category !== 'all'){
    catLabel = `, category: ${currentFilter.category}`;
  }

  let txt = `Filter: ${periodLabel}${catLabel} • Total: ${total.toFixed(2)} €`;
  let cls = 'summary-ok';

  if(currentFilter.period === 'month' && s.monthlyBudget){
    const mb = Number(s.monthlyBudget);
    const diff = mb - total;
    if(diff >= 0){
      txt += ` • ${diff.toFixed(2)} € under monthly budget`;
      cls = 'summary-ok';
    }else{
      txt += ` • ${Math.abs(diff).toFixed(2)} € OVER monthly budget`;
      cls = 'summary-warn';
    }
  }
  bar.textContent = txt;
  bar.className = 'summary-bar ' + cls;
}

function renderBudgetInfo(){
  const info = document.getElementById('budgetInfo');
  if(!info) return;
  const s = loadSettings();
  const expenses = loadExpenses();
  const total = currentMonthTotal(expenses);
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const remainingDays = Math.max(0, daysInMonth - today.getDate() + 1);

  let methodText = '';
  let remaining = null;
  if(s.monthlyBudget){
    remaining = Number(s.monthlyBudget) - total;
    methodText = 'based on monthly budget';
  }else if(s.dailyBudget){
    const remainingBudget = Number(s.dailyBudget) * remainingDays;
    remaining = remainingBudget - total;
    methodText = 'based on projected daily budget';
  }

  let parts = [];
  if(s.dailyBudget) parts.push(`Daily: ${Number(s.dailyBudget).toFixed(2)} €`);
  if(s.monthlyBudget) parts.push(`Monthly: ${Number(s.monthlyBudget).toFixed(2)} €`);
  if(remaining != null){
    parts.push(`Remaining this month: ${remaining.toFixed(2)} € (${methodText})`);
  }
  info.textContent = parts.join(' • ');
}

// CSV export
function buildCsvString(){
  const expenses = loadExpenses();
  if(!expenses.length) return '';
  const header = ['date','category','amount','note'];
  const rows = [header.join(',')];
  expenses.forEach(e=>{
    const line = [
      e.date || '',
      (e.category || '').replace(/,/g,' '),
      Number(e.amount||0).toFixed(2),
      (e.note || '').replace(/,/g,' ')
    ].join(',');
    rows.push(line);
  });
  return rows.join('\n');
}

function exportDownload(){
  const csv = buildCsvString();
  if(!csv){
    alert('No expenses to export.');
    return;
  }
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'budgetmate_export.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCopy(){
  const csv = buildCsvString();
  if(!csv){
    alert('No expenses to export.');
    return;
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(csv).then(()=>alert('CSV copied to clipboard.'),()=>alert('Could not copy to clipboard.'));
  }else{
    alert('Clipboard API not available.');
  }
}

function exportOpen(){
  const csv = buildCsvString();
  if(!csv){
    alert('No expenses to export.');
    return;
  }
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

function exportEmail(){
  const csv = buildCsvString();
  if(!csv){
    alert('No expenses to export.');
    return;
  }
  const mailto = 'mailto:?subject=' + encodeURIComponent('BudgetMate Export') +
                 '&body=' + encodeURIComponent(csv);
  window.location.href = mailto;
}

// CSV import
function importCsvFromText(text, mode){
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0);
  if(lines.length < 2){
    alert('CSV file has no data rows.');
    return false;
  }
  const header = lines[0].toLowerCase();
  if(header !== 'date,category,amount,note'){
    alert('Invalid CSV header. Expected: date,category,amount,note');
    return false;
  }
  const imported = [];
  for(let i=1;i<lines.length;i++){
    const parts = lines[i].split(',');
    if(parts.length < 3){
      alert('Invalid CSV structure in line ' + (i+1));
      return false;
    }
    const date = parts[0].trim();
    const category = (parts[1] || '').trim();
    const amountStr = (parts[2] || '').trim();
    const note = (parts[3] || '').trim();
    const amount = parseFloat(amountStr.replace(',','.'));
    if(!isFinite(amount)){
      alert('Invalid amount in line ' + (i+1));
      return false;
    }
    const id = Date.now() + Math.random();
    imported.push({ id, date, amount, category, note });
  }
  let finalExpenses = [];
  if(mode === 'append'){
    finalExpenses = loadExpenses().concat(imported);
  }else{
    finalExpenses = imported;
  }
  saveExpenses(finalExpenses);
  const cats = [...new Set(finalExpenses.map(e=>(e.category||'').trim()).filter(Boolean))];
  saveCategories(cats);
  renderCategoryList();
  renderCategoryManager();
  renderCharts();
  renderExpenseTable();
  renderBudgetInfo();
  alert('Data imported successfully (' + mode + ').');
  return true;
}

function handleImportCsvFile(file, mode){
  if(!file){
    alert('No file selected.');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => importCsvFromText(e.target.result, mode);
  reader.readAsText(file);
}

// PDF import via backend
async function importPdfViaBackend(file, mode){
  if(!PDF_WORKER_URL || PDF_WORKER_URL.includes('YOUR_BACKEND_HOST')){
    alert('Please configure PDF_WORKER_URL in app.js with your real backend URL.');
    return;
  }
  try{
    if(!file){
      alert('No PDF file selected.');
      return;
    }
    alert('Uploading PDF…');
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(PDF_WORKER_URL, {
      method:'POST',
      body:formData
    });
    if(!res.ok){
      alert('Backend error: ' + res.status);
      return;
    }
    const csv = await res.text();
    alert('PDF parsed. Importing CSV…');
    importCsvFromText(csv, mode);
  }catch(e){
    console.error(e);
    alert('Error while importing PDF: ' + e.message);
  }
}

// PDF export (PRINT button)
async function printReport(){
  const main = document.querySelector('.container');
  if(!main){
    alert('Nothing to print.');
    return;
  }
  if(!window.html2canvas || !window.jspdf){
    alert('Print libraries not available. Please ensure html2canvas & jsPDF are loaded.');
    return;
  }
  try{
    const canvas = await html2canvas(main, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p','mm','a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = canvas.height * pageWidth / canvas.width;

    if(imgHeight <= pageHeight){
      pdf.addImage(imgData,'PNG',0,0,imgWidth,imgHeight);
    }else{
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData,'PNG',0,position,imgWidth,imgHeight);
      heightLeft -= pageHeight;
      while(heightLeft > 0){
        pdf.addPage();
        position = position - pageHeight;
        pdf.addImage(imgData,'PNG',0,position,imgWidth,imgHeight);
        heightLeft -= pageHeight;
      }
    }
    const dateStr = new Date().toISOString().slice(0,10);
    pdf.save('BudgetMate_Report_' + dateStr + '.pdf');
  }catch(e){
    console.error(e);
    alert('Error while generating PDF: ' + e.message);
  }
}

// OCR helpers
let ocrImage = null;
let ocrCanvas, ocrCtx;
let ocrScale = 1;
let ocrMode = null;
let isDrawing = false;
let startX = 0, startY = 0;
let amountRect = null;
let dateRect = null;

function setOcrStatus(msg){
  const el = document.getElementById('ocrStatus');
  if(!el) return;
  el.textContent = msg || '';
}

function normalizeRect(r){
  if(!r) return null;
  let {x,y,w,h} = r;
  if(w<0){ x = x+w; w = -w; }
  if(h<0){ y = y+h; h = -h; }
  return {x,y,w,h};
}

function drawOcrCanvas(){
  if(!ocrCanvas || !ocrCtx || !ocrImage) return;
  const w = ocrCanvas.width;
  const h = ocrCanvas.height;
  ocrCtx.clearRect(0,0,w,h);
  ocrCtx.drawImage(ocrImage, 0,0,w,h);
  ocrCtx.lineWidth = 3;
  if(amountRect){
    const r = normalizeRect(amountRect);
    ocrCtx.strokeStyle = 'rgba(34,197,94,0.95)';
    ocrCtx.fillStyle = 'rgba(34,197,94,0.12)';
    ocrCtx.strokeRect(r.x, r.y, r.w, r.h);
    ocrCtx.fillRect(r.x, r.y, r.w, r.h);
  }
  if(dateRect){
    const r = normalizeRect(dateRect);
    ocrCtx.strokeStyle = 'rgba(59,130,246,0.95)';
    ocrCtx.fillStyle = 'rgba(59,130,246,0.12)';
    ocrCtx.strokeRect(r.x, r.y, r.w, r.h);
    ocrCtx.fillRect(r.x, r.y, r.w, r.h);
  }
}

function setupOcrFromDataUrl(dataUrl){
  const tools = document.getElementById('receiptTools');
  const canvas = document.getElementById('receiptCanvas');
  if(!canvas || !tools) return;
  ocrCanvas = canvas;
  ocrCtx = canvas.getContext('2d');
  amountRect = null;
  dateRect = null;
  ocrImage = new Image();
  ocrImage.onload = ()=>{
    const maxWidth = canvas.parentElement.clientWidth || 320;
    const ratio = ocrImage.width/ocrImage.height;
    const cw = Math.min(maxWidth, ocrImage.width);
    const ch = cw/ratio;
    canvas.width = cw;
    canvas.height = ch;
    ocrScale = ocrImage.width / cw;
    drawOcrCanvas();
    tools.style.display = 'block';
    setOcrStatus('Image loaded. Mark amount area, then date area.');
  };
  ocrImage.src = dataUrl;
}

function initOcrFromFile(file){
  const reader = new FileReader();
  reader.onload = e => setupOcrFromDataUrl(e.target.result);
  reader.readAsDataURL(file);
}

function attachOcrCanvasPointerEvents(){
  const canvas = document.getElementById('receiptCanvas');
  if(!canvas) return;
  const getPos = evt => {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if(evt.touches && evt.touches.length){
      clientX = evt.touches[0].clientX;
      clientY = evt.touches[0].clientY;
    }else{
      clientX = evt.clientX;
      clientY = evt.clientY;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = evt => {
    if(!ocrMode || !ocrCanvas) return;
    evt.preventDefault();
    const p = getPos(evt);
    startX = p.x;
    startY = p.y;
    isDrawing = true;
  };
  const move = evt => {
    if(!isDrawing || !ocrMode || !ocrCanvas) return;
    evt.preventDefault();
    const p = getPos(evt);
    const w = p.x - startX;
    const h = p.y - startY;
    if(ocrMode === 'amount'){
      amountRect = {x:startX, y:startY, w, h};
    }else if(ocrMode === 'date'){
      dateRect = {x:startX, y:startY, w, h};
    }
    drawOcrCanvas();
  };
  const end = evt => {
    if(isDrawing){
      isDrawing = false;
      if(ocrMode === 'amount' && amountRect){
        setOcrStatus('Amount area marked. Now mark date area or run OCR.');
      }
      if(ocrMode === 'date' && dateRect){
        setOcrStatus('Date area marked. You can now run OCR.');
      }
    }
  };

  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
}

function parseAmountAndDate(text){
  if(!text) return {amount:null,date:null};
  const nums = text.match(/\d+[\.,]\d{2}/g) || [];
  let amount = null;
  if(nums.length){
    amount = nums.map(n=>parseFloat(n.replace(',','.'))).sort((a,b)=>b-a)[0];
  }
  let date = null;
  const match = text.match(/(\d{2}[\.\/-]\d{2}[\.\/-]\d{2,4}|\d{4}-\d{2}-\d{2})/);
  if(match){
    const raw = match[1];
    if(raw.includes('-') && raw.indexOf('-')===4){
      date = raw;
    }else{
      const parts = raw.split(/[\.\/-]/);
      const d = parts[0].padStart(2,'0');
      const m = parts[1].padStart(2,'0');
      let y = new Date().getFullYear();
      if(parts[2]){
        let yy = parts[2];
        if(yy.length===2) y = 2000 + parseInt(yy,10);
        else if(yy.length===4) y = parseInt(yy,10);
      }
      date = `${y}-${m}-${d}`;
    }
  }
  return {amount,date};
}

async function runOcrOnSelection(){
  if(!ocrCanvas || !ocrCtx || !ocrImage){
    setOcrStatus('No image loaded.');
    return;
  }
  if(!window.Tesseract){
    setOcrStatus('Tesseract not available. Please open the app once with internet to load OCR.');
    return;
  }
  const rects = [];
  const normAmount = normalizeRect(amountRect);
  const normDate = normalizeRect(dateRect);
  if(normAmount) rects.push({name:'amount', rect:normAmount});
  if(normDate) rects.push({name:'date', rect:normDate});
  if(!rects.length){
    setOcrStatus('No areas marked. Please mark amount and/or date area first.');
    return;
  }
  setOcrStatus('OCR analyzing selected areas…');
  const {Tesseract} = window;
  const updates = [];
  for(const r of rects){
    const off = document.createElement('canvas');
    off.width = r.rect.w;
    off.height = r.rect.h;
    const offCtx = off.getContext('2d');
    const sx = r.rect.x * ocrScale;
    const sy = r.rect.y * ocrScale;
    const sw = r.rect.w * ocrScale;
    const sh = r.rect.h * ocrScale;
    offCtx.drawImage(ocrImage, sx, sy, sw, sh, 0,0,off.width,off.height);
    const blob = await new Promise(res=>off.toBlob(res,'image/png'));
    if(!blob) continue;
    try{
      const result = await Tesseract.recognize(blob,'eng');
      const text = result.data && result.data.text ? result.data.text : '';
      if(!text) continue;
      const {amount,date} = parseAmountAndDate(text);
      if(r.name==='amount' && amount!=null){
        const amtInput = document.getElementById('amount');
        if(amtInput){
          amtInput.value = amount.toFixed(2);
          updates.push(`amount ${amount.toFixed(2)}`);
        }
      }
      if(r.name==='date' && date){
        const dateInput = document.getElementById('date');
        if(dateInput){
          dateInput.value = date;
          updates.push(`date ${date}`);
        }
      }
    }catch(e){
      console.error('OCR error', e);
    }
  }
  if(updates.length){
    setOcrStatus('OCR updated: ' + updates.join(', '));
  }else{
    setOcrStatus('OCR finished, but no amount/date found in marked areas.');
  }
}

// Camera
let cameraStream = null;
async function openCamera(){
  const container = document.getElementById('cameraContainer');
  const video = document.getElementById('cameraPreview');
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    alert('Camera API not available in this browser.');
    return;
  }
  try{
    cameraStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    video.srcObject = cameraStream;
    container.style.display = 'block';
  }catch(e){
    console.error(e);
    alert('Could not access camera.');
  }
}
function closeCamera(){
  const container = document.getElementById('cameraContainer');
  const video = document.getElementById('cameraPreview');
  if(cameraStream){
    cameraStream.getTracks().forEach(t=>t.stop());
    cameraStream = null;
  }
  video.srcObject = null;
  container.style.display = 'none';
}
function captureFromCamera(){
  const video = document.getElementById('cameraPreview');
  if(!video || !video.videoWidth){
    alert('Camera not ready.');
    return;
  }
  const temp = document.createElement('canvas');
  const maxWidth = 1024;
  let w = video.videoWidth;
  let h = video.videoHeight;
  if(w > maxWidth){
    const ratio = maxWidth / w;
    w = maxWidth;
    h = Math.round(h * ratio);
  }
  temp.width = w;
  temp.height = h;
  const ctx = temp.getContext('2d');
  ctx.drawImage(video, 0,0,w,h);
  const dataUrl = temp.toDataURL('image/png');
  setupOcrFromDataUrl(dataUrl);
}

// Filter modal helpers
function openFilterModal(){
  const modal = document.getElementById('filterModal');
  const periodSel = document.getElementById('filterPeriod');
  const catSel = document.getElementById('filterCategory');
  if(!modal || !periodSel || !catSel) return;

  // Period select
  periodSel.value = currentFilter.period;

  // Category options based on ALL historical expenses
  const allExpenses = loadExpenses();
  const usedCats = [
    ...new Set(allExpenses.map(e => (e.category || '').trim()).filter(Boolean))
  ].sort((a,b)=>a.localeCompare(b));

  catSel.innerHTML = '';
  const optAll = document.createElement('option');
  optAll.value = 'all';
  optAll.textContent = 'All categories';
  catSel.appendChild(optAll);
  usedCats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    catSel.appendChild(opt);
  });
  catSel.value = currentFilter.category === 'all' ? 'all' : currentFilter.category;

  modal.classList.remove('hidden');
}
function closeFilterModal(){
  const modal = document.getElementById('filterModal');
  if(modal) modal.classList.add('hidden');
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('expenseForm');
  const dateInput = document.getElementById('date');
  if(dateInput) dateInput.value = todayDate();

  const s = loadSettings();
  document.body.classList.toggle('dark', !!s.darkMode);
  const dailyInput = document.getElementById('dailyBudget');
  const monthlyInput = document.getElementById('monthlyBudget');
  if(dailyInput) dailyInput.value = s.dailyBudget != null ? s.dailyBudget : '';
  if(monthlyInput) monthlyInput.value = s.monthlyBudget != null ? s.monthlyBudget : '';
  const toggle = document.getElementById('darkToggle');
  if(toggle) toggle.textContent = s.darkMode ? 'Light mode' : 'Dark mode';

  renderBudgetInfo();
  renderCategoryList();
  renderCategoryManager();
  renderCharts();
  renderExpenseTable();

  document.querySelectorAll('.cat-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const cat = btn.getAttribute('data-cat');
      const input = document.getElementById('category');
      if(input) input.value = cat;
    });
  });

  if(toggle){
    toggle.addEventListener('click', ()=>{
      const s2 = loadSettings();
      s2.darkMode = !s2.darkMode;
      saveSettings(s2);
      document.body.classList.toggle('dark', !!s2.darkMode);
      toggle.textContent = s2.darkMode ? 'Light mode' : 'Dark mode';
    });
  }

  const saveBudgetBtn = document.getElementById('saveBudget');
  if(saveBudgetBtn){
    saveBudgetBtn.addEventListener('click', ()=>{
      const s2 = loadSettings();
      const dVal = document.getElementById('dailyBudget').value;
      const mVal = document.getElementById('monthlyBudget').value;
      s2.dailyBudget = dVal ? parseFloat(dVal) : null;
      s2.monthlyBudget = mVal ? parseFloat(mVal) : null;
      saveSettings(s2);
      renderBudgetInfo();
      renderExpenseTable();
      renderCharts();
      alert('Budget saved.');
    });
  }

  const exportDownloadBtn = document.getElementById('exportDownload');
  const exportCopyBtn = document.getElementById('exportCopy');
  const exportOpenBtn = document.getElementById('exportOpen');
  const exportEmailBtn = document.getElementById('exportEmail');
  if(exportDownloadBtn) exportDownloadBtn.addEventListener('click', exportDownload);
  if(exportCopyBtn) exportCopyBtn.addEventListener('click', exportCopy);
  if(exportOpenBtn) exportOpenBtn.addEventListener('click', exportOpen);
  if(exportEmailBtn) exportEmailBtn.addEventListener('click', exportEmail);

  const importCsvBtn = document.getElementById('importCsvBtn');
  const importPdfBtn = document.getElementById('importPdfBtn');
  const importFileCsv = document.getElementById('importFileCsv');
  const importFilePdf = document.getElementById('importFilePdf');

  if(importCsvBtn && importFileCsv){
    importCsvBtn.addEventListener('click', ()=>{
      const mode = prompt('Import CSV mode:\n1 = overwrite existing data\n2 = append to existing data\n\nEnter 1 or 2:');
      if(!mode) return;
      let modeKey = null;
      if(mode === '1') modeKey = 'overwrite';
      else if(mode === '2') modeKey = 'append';
      else{
        alert('Unknown option.');
        return;
      }
      if(!confirm('Import will ' + modeKey + ' data. Continue?')) return;
      importFileCsv.value = '';
      importFileCsv.onchange = ()=>{
        const file = importFileCsv.files && importFileCsv.files[0];
        handleImportCsvFile(file, modeKey);
      };
      importFileCsv.click();
    });
  }

  if(importPdfBtn && importFilePdf){
    importPdfBtn.addEventListener('click', ()=>{
      const mode = prompt('Import PDF mode:\n1 = overwrite existing data\n2 = append to existing data\n\nEnter 1 or 2:');
      if(!mode) return;
      let modeKey = null;
      if(mode === '1') modeKey = 'overwrite';
      else if(mode === '2') modeKey = 'append';
      else{
        alert('Unknown option.');
        return;
      }
      if(!confirm('Import from PDF will ' + modeKey + ' data. Continue?')) return;
      importFilePdf.value = '';
      importFilePdf.onchange = ()=>{
        const file = importFilePdf.files && importFilePdf.files[0];
        importPdfViaBackend(file, modeKey);
      };
      importFilePdf.click();
    });
  }

  const receiptInput = document.getElementById('receipt');
  if(receiptInput){
    receiptInput.addEventListener('change', ()=>{
      const file = receiptInput.files && receiptInput.files[0];
      if(file){
        initOcrFromFile(file);
      }else{
        setOcrStatus('');
      }
    });
  }
  attachOcrCanvasPointerEvents();

  const openCamBtn = document.getElementById('openCamera');
  const captureBtn = document.getElementById('capturePhoto');
  const closeCamBtn = document.getElementById('closeCamera');
  if(openCamBtn) openCamBtn.addEventListener('click', openCamera);
  if(closeCamBtn) closeCamBtn.addEventListener('click', closeCamera);
  if(captureBtn) captureBtn.addEventListener('click', captureFromCamera);

  const markAmountBtn = document.getElementById('markAmount');
  const markDateBtn = document.getElementById('markDate');
  const clearMarksBtn = document.getElementById('clearMarks');
  const runOcrBtn = document.getElementById('runOcr');
  if(markAmountBtn){
    markAmountBtn.addEventListener('click', ()=>{
      ocrMode = 'amount';
      setOcrStatus('Mark the AMOUNT area by dragging with mouse or finger.');
    });
  }
  if(markDateBtn){
    markDateBtn.addEventListener('click', ()=>{
      ocrMode = 'date';
      setOcrStatus('Mark the DATE area by dragging with mouse or finger.');
    });
  }
  if(clearMarksBtn){
    clearMarksBtn.addEventListener('click', ()=>{
      amountRect = null;
      dateRect = null;
      ocrMode = null;
      drawOcrCanvas();
      setOcrStatus('Marks cleared. Select amount/date area again if needed.');
    });
  }
  if(runOcrBtn){
    runOcrBtn.addEventListener('click', ()=>{
      runOcrOnSelection();
    });
  }

  const tbody = document.querySelector('#expenseTable tbody');
  if(tbody){
    tbody.addEventListener('click', e=>{
      const target = e.target;
      if(target && target.classList.contains('del-btn')){
        const idStr = target.getAttribute('data-id');
        if(!idStr) return;
        const msg = 'Do you really want to delete?\n\nYes = delete this single expense.\nNo = keep it.';
        if(!confirm(msg)) return;
        const idNum = Number(idStr);
        deleteExpense(idNum);
        renderCharts();
        renderExpenseTable();
        renderBudgetInfo();
      }
    });
  }

  const deleteAllBtn = document.getElementById('deleteAll');
  if(deleteAllBtn){
    deleteAllBtn.addEventListener('click', ()=>{
      const msg = 'DELETE ALL EXPENSE DATA\n\nThis will delete:\n• all saved expenses\n• all saved categories\n\nBudgets & settings will stay.\n\nAre you sure?\nYes = delete all\nNo = cancel';
      if(!confirm(msg)) return;
      saveExpenses([]);
      saveCategories([]);
      renderCategoryList();
      renderCategoryManager();
      renderCharts();
      renderExpenseTable();
      renderBudgetInfo();
    });
  }

  const newRulesBtn = document.getElementById('newRules');
  if(newRulesBtn){
    newRulesBtn.addEventListener('click', ()=>{
      if(!confirm('Do you really want to change the rules?')) return;
      const rulesCard = document.getElementById('rulesCard');
      if(rulesCard) rulesCard.scrollIntoView({behavior:'smooth'});
      alert('You can now adjust categories in the "Rules & Settings" section. Budgets can be changed in the Budget section at the top.');
    });
  }

  const printBtn = document.getElementById('printReport');
  if(printBtn){
    printBtn.addEventListener('click', ()=>{
      printReport();
    });
  }

  const thDate = document.getElementById('thDate');
  const thCategory = document.getElementById('thCategory');
  if(thDate) thDate.addEventListener('click', openFilterModal);
  if(thCategory) thCategory.addEventListener('click', openFilterModal);

  const modal = document.getElementById('filterModal');
  const closeFilterBtn = document.getElementById('closeFilter');
  const applyFilterBtn = document.getElementById('applyFilter');
  const clearFilterBtn = document.getElementById('clearFilter');
  const periodSel = document.getElementById('filterPeriod');
  const catSel = document.getElementById('filterCategory');

  if(closeFilterBtn){
    closeFilterBtn.addEventListener('click', ()=>{
      closeFilterModal();
    });
  }
  if(modal){
    const backdrop = modal.querySelector('.modal-backdrop');
    if(backdrop){
      backdrop.addEventListener('click', ()=>{
        closeFilterModal();
      });
    }
  }
  if(applyFilterBtn){
    applyFilterBtn.addEventListener('click', ()=>{
      if(periodSel) currentFilter.period = periodSel.value;
      if(catSel) currentFilter.category = catSel.value;
      closeFilterModal();
      renderCharts();
      renderExpenseTable();
    });
  }
  if(clearFilterBtn){
    clearFilterBtn.addEventListener('click', ()=>{
      currentFilter = { period:'all', category:'all' };
      closeFilterModal();
      renderCharts();
      renderExpenseTable();
    });
  }

  if(form){
    form.addEventListener('submit', e=>{
      e.preventDefault();
      const date = dateInput.value;
      const amountVal = document.getElementById('amount').value;
      const category = document.getElementById('category').value;
      const note = document.getElementById('note').value;
      if(!date || !amountVal || !category){
        alert('Please fill in date, amount and category.');
        return;
      }
      const amount = parseFloat(amountVal);
      if(!isFinite(amount) || amount <= 0){
        alert('Amount must be a positive number.');
        return;
      }
      addExpense(date, amount, category, note);
      form.reset();
      dateInput.value = todayDate();
      const receiptInputLocal = document.getElementById('receipt');
      if(receiptInputLocal) receiptInputLocal.value = '';
      setOcrStatus('');
      renderCategoryList();
      renderCategoryManager();
      renderCharts();
      renderExpenseTable();
      renderBudgetInfo();
    });
  }
});

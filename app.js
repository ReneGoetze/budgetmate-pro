// BudgetMate Pro v6

// === Config ===
const STORAGE_KEY = 'bm_expenses';
const CATEGORY_KEY = 'bm_categories';
const SETTINGS_KEY = 'bm_settings';

// Optional OCR.space API key (if you want to use OCR.space in addition to Tesseract)
const OCRSPACE_API_KEY = ''; // <- if you get a key from ocr.space, put it here

// Colors
const COLOR_GREEN = 'rgba(34,197,94,0.8)';  // green-500
const COLOR_RED   = 'rgba(239,68,68,0.8)';  // red-500
const COLOR_NEUTRAL = 'rgba(59,130,246,0.5)'; // blue-500

// === Generic storage helpers ===
function loadJSON(key, fallback){
  const raw = localStorage.getItem(key);
  if(!raw) return fallback;
  try { return JSON.parse(raw); } catch(e){ return fallback; }
}
function saveJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

// === Data models ===
function loadExpenses(){ return loadJSON(STORAGE_KEY, []); }
function saveExpenses(expenses){ saveJSON(STORAGE_KEY, expenses); }

function loadCategories(){ return loadJSON(CATEGORY_KEY, []); }
function saveCategories(cats){ saveJSON(CATEGORY_KEY, cats); }

function loadSettings(){
  return loadJSON(SETTINGS_KEY, {
    dailyBudget: null,
    monthlyBudget: null,
    darkMode: false,
    ocrMethod: 'tesseract' // 'tesseract' or 'tesseract_ocrspace'
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

function clearAllDataAndSettings(){
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CATEGORY_KEY);
  localStorage.removeItem(SETTINGS_KEY);
}

// === Date helpers ===
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
  const day = d.getDay(); // 0=Sun
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
}

function filterCurrentMonth(expenses){
  const monthKey = getCurrentMonthKey();
  return expenses.filter(e => (e.date || '').startsWith(monthKey));
}
function filterCurrentDay(expenses){
  const tk = todayDate();
  return expenses.filter(e => e.date === tk);
}
function filterCurrentWeek(expenses){
  const { start, end } = getCurrentWeekRange();
  return expenses.filter(e => {
    if(!e.date) return false;
    const d = new Date(e.date);
    return d >= start && d <= end;
  });
}

// Aggregations
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

// Charts
let monthlyChart, catMonthChart, catWeekChart, catDayChart, trendChart;

function renderCategoryList(){
  const cats = loadCategories();
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
  const cats = loadCategories();
  if(!cats.length){
    cont.textContent = 'No saved categories yet. They appear here once you use them.';
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
      // update existing expenses categories
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
  const expenses = loadExpenses();
  const currentMonthExpenses = filterCurrentMonth(expenses);
  const currentWeekExpenses = filterCurrentWeek(expenses);
  const currentDayExpenses = filterCurrentDay(expenses);

  const m = buildMonthlyData(currentMonthExpenses);
  const cMonth = buildCategoryData(currentMonthExpenses);
  const cWeek = buildCategoryData(currentWeekExpenses);
  const cDay = buildCategoryData(currentDayExpenses);
  const t = buildTrendData(expenses);

  const settings = loadSettings();

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

  // Monthly bars colored by daily budget
  let barColors = m.values.map(()=>COLOR_NEUTRAL);
  if(settings.dailyBudget){
    const db = Number(settings.dailyBudget);
    barColors = m.values.map(v => v <= db ? COLOR_GREEN : COLOR_RED);
  }

  monthlyChart = new Chart(mCtx, {
    type: 'bar',
    data: { labels: m.days, datasets: [{ label: 'Daily Spending (€)', data: m.values, backgroundColor: barColors }] }
  });

  catMonthChart = new Chart(cMonthCtx, {
    type: 'doughnut',
    data: { labels: cMonth.labels, datasets: [{ data: cMonth.values }] }
  });
  catWeekChart = new Chart(cWeekCtx, {
    type: 'doughnut',
    data: { labels: cWeek.labels, datasets: [{ data: cWeek.values }] }
  });
  catDayChart = new Chart(cDayCtx, {
    type: 'doughnut',
    data: { labels: cDay.labels, datasets: [{ data: cDay.values }] }
  });

  // Trend line colored by overall month vs budget
  const cmTotal = currentMonthTotal(expenses);
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
  let limit = null;
  if(settings.monthlyBudget){
    limit = Number(settings.monthlyBudget);
  }else if(settings.dailyBudget){
    limit = Number(settings.dailyBudget) * daysInMonth;
  }
  let lineColor = COLOR_NEUTRAL;
  if(limit != null){
    lineColor = cmTotal <= limit ? COLOR_GREEN : COLOR_RED;
  }

  trendChart = new Chart(tCtx, {
    type: 'line',
    data: { labels: t.labels, datasets: [{ label: 'Monthly Total (€)', data: t.values, borderColor: lineColor, backgroundColor: lineColor, tension:0.2 }] }
  });
}

// Expense table & summary
function renderExpenseTable(){
  const tbody = document.querySelector('#expenseTable tbody');
  const bar = document.getElementById('summaryBar');
  if(!tbody || !bar) return;

  const settings = loadSettings();
  const expenses = loadExpenses();
  const current = filterCurrentMonth(expenses);

  tbody.innerHTML = '';
  let total = 0;
  current.sort((a,b)=> (a.date||'').localeCompare(b.date||''));
  current.forEach(e=>{
    total += Number(e.amount||0);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${e.date || ''}</td>
      <td>${e.category || ''}</td>
      <td>${Number(e.amount||0).toFixed(2)}</td>
      <td><button class="del-btn" data-id="${e.id}">Del</button></td>`;
    tbody.appendChild(tr);
  });

  let txt = `Current month total: ${total.toFixed(2)} €`;
  let cls = 'summary-ok';
  if(settings.monthlyBudget){
    const mb = Number(settings.monthlyBudget);
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

// Budget info
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

// === CSV export/import ===
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

function exportInteractive(){
  const csv = buildCsvString();
  if(!csv){
    alert('No expenses to export.');
    return;
  }
  const choice = prompt('Export options:\\n1 = Download file\\n2 = Copy to clipboard\\n3 = Open in new tab\\n4 = Prepare email\\n\\nEnter 1, 2, 3 or 4:');
  if(!choice) return;
  if(choice === '1'){
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budgetmate_export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }else if(choice === '2'){
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(csv).then(()=>{
        alert('CSV copied to clipboard.');
      },()=>{
        alert('Could not copy to clipboard.');
      });
    }else{
      alert('Clipboard API not available. You can copy from a text editor after opening CSV.');
    }
  }else if(choice === '3'){
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // URL will be revoked when tab is closed, or we could revoke after timeout.
  }else if(choice === '4'){
    const mailto = 'mailto:?subject=' + encodeURIComponent('BudgetMate Export') +
                   '&body=' + encodeURIComponent(csv);
    window.location.href = mailto;
  }else{
    alert('Unknown option.');
  }
}

function importCsvFromText(text){
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
  const newExpenses = [];
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
    newExpenses.push({ id, date, amount, category, note });
  }

  saveExpenses(newExpenses);
  const cats = [...new Set(newExpenses.map(e=>(e.category||'').trim()).filter(Boolean))];
  saveCategories(cats);
  renderCategoryList();
  renderCategoryManager();
  renderCharts();
  renderExpenseTable();
  renderBudgetInfo();
  alert('Data imported successfully.');
  return true;
}

// === OCR helpers ===
function setOcrStatus(msg){
  const el = document.getElementById('ocrStatus');
  if(!el) return;
  el.textContent = msg || '';
}

async function ocrSpaceRecognize(file){
  if(!OCRSPACE_API_KEY){
    return null;
  }
  try{
    const form = new FormData();
    form.append('file', file);
    form.append('apikey', OCRSPACE_API_KEY);
    form.append('language', 'eng');
    const res = await fetch('https://api.ocr.space/parse/image', {
      method:'POST',
      body: form
    });
    const data = await res.json();
    if(data && data.ParsedResults && data.ParsedResults[0] && data.ParsedResults[0].ParsedText){
      return data.ParsedResults[0].ParsedText;
    }
    return null;
  }catch(e){
    console.error('OCR.space error', e);
    return null;
  }
}

function parseTextForAmountAndDate(text){
  if(!text) return {amount:null, date:null};
  const numMatches = text.match(/\d+[\.,]\d{2}/g) || [];
  let amount = null;
  if(numMatches.length){
    amount = numMatches.map(n=>parseFloat(n.replace(',','.'))).sort((a,b)=>b-a)[0];
  }

  let date = null;
  const dateMatch = text.match(/(\d{2}[\.\/]\d{2}[\.\/]\d{2,4}|\d{4}-\d{2}-\d{2})/);
  if(dateMatch){
    const raw = dateMatch[1];
    if(raw.includes('-')){
      date = raw;
    }else{
      const parts = raw.split(/[\.\/]/);
      if(parts.length>=2){
        const d = parts[0].padStart(2,'0');
        const m = parts[1].padStart(2,'0');
        let y = new Date().getFullYear();
        if(parts[2]){
          let yy = parts[2];
          if(yy.length===2){
            const base = 2000;
            y = base + parseInt(yy,10);
          }else if(yy.length===4){
            y = parseInt(yy,10);
          }
        }
        date = `${y}-${m}-${d}`;
      }
    }
  }
  return {amount, date};
}

async function tryOcrOnReceipt(file){
  if(!file){
    setOcrStatus('');
    return;
  }
  const settings = loadSettings();
  const method = settings.ocrMethod || 'tesseract';
  setOcrStatus('OCR analyzing…');
  let text = null;

  try{
    if(method === 'tesseract_ocrspace' && OCRSPACE_API_KEY){
      text = await ocrSpaceRecognize(file);
      if(!text){
        // fallback to Tesseract
        if(window.Tesseract){
          const { Tesseract } = window;
          const result = await Tesseract.recognize(file, 'eng');
          text = result.data && result.data.text ? result.data.text : '';
        }
      }
    }else{
      if(window.Tesseract){
        const { Tesseract } = window;
        const result = await Tesseract.recognize(file, 'eng');
        text = result.data && result.data.text ? result.data.text : '';
      }
    }
  }catch(e){
    console.error('OCR error', e);
  }

  if(!text){
    setOcrStatus('OCR: no text detected.');
    return;
  }
  const {amount, date} = parseTextForAmountAndDate(text);
  const updates = [];
  if(amount != null){
    const amountInput = document.getElementById('amount');
    if(amountInput){
      amountInput.value = amount.toFixed(2);
      updates.push('amount ' + amount.toFixed(2));
    }
  }
  if(date){
    const dateInput = document.getElementById('date');
    if(dateInput){
      dateInput.value = date;
      updates.push('date ' + date);
    }
  }
  if(updates.length){
    setOcrStatus('OCR updated: ' + updates.join(', '));
  }else{
    setOcrStatus('OCR finished, but no amount/date found.');
  }
}

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('expenseForm');
  const dateInput = document.getElementById('date');
  if(dateInput) dateInput.value = todayDate();

  const settings = loadSettings();
  document.body.classList.toggle('dark', !!settings.darkMode);
  const dailyInput = document.getElementById('dailyBudget');
  const monthlyInput = document.getElementById('monthlyBudget');
  if(dailyInput) dailyInput.value = settings.dailyBudget != null ? settings.dailyBudget : '';
  if(monthlyInput) monthlyInput.value = settings.monthlyBudget != null ? settings.monthlyBudget : '';
  const toggle = document.getElementById('darkToggle');
  if(toggle) toggle.textContent = settings.darkMode ? 'Light mode' : 'Dark mode';

  const ocrSelect = document.getElementById('ocrMethod');
  if(ocrSelect) ocrSelect.value = settings.ocrMethod || 'tesseract';

  renderBudgetInfo();
  renderCategoryList();
  renderCategoryManager();
  renderCharts();
  renderExpenseTable();

  // Category quick buttons
  document.querySelectorAll('.cat-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const cat = btn.getAttribute('data-cat');
      const input = document.getElementById('category');
      if(input) input.value = cat;
    });
  });

  // Dark mode toggle
  if(toggle){
    toggle.addEventListener('click', ()=>{
      const s = loadSettings();
      s.darkMode = !s.darkMode;
      saveSettings(s);
      document.body.classList.toggle('dark', !!s.darkMode);
      toggle.textContent = s.darkMode ? 'Light mode' : 'Dark mode';
    });
  }

  // Save budget
  const saveBudgetBtn = document.getElementById('saveBudget');
  if(saveBudgetBtn){
    saveBudgetBtn.addEventListener('click', ()=>{
      const s = loadSettings();
      const dVal = document.getElementById('dailyBudget').value;
      const mVal = document.getElementById('monthlyBudget').value;
      s.dailyBudget = dVal ? parseFloat(dVal) : null;
      s.monthlyBudget = mVal ? parseFloat(mVal) : null;
      if(ocrSelect) s.ocrMethod = ocrSelect.value || 'tesseract';
      saveSettings(s);
      renderBudgetInfo();
      renderExpenseTable();
      renderCharts();
      alert('Budget and rules saved.');
    });
  }

  // OCR method select
  if(ocrSelect){
    ocrSelect.addEventListener('change', ()=>{
      const s = loadSettings();
      s.ocrMethod = ocrSelect.value || 'tesseract';
      saveSettings(s);
    });
  }

  // Export
  const exportBtn = document.getElementById('exportCsv');
  if(exportBtn){
    exportBtn.addEventListener('click', exportInteractive);
  }

  // Import
  const importBtn = document.getElementById('importCsv');
  const importFile = document.getElementById('importFile');
  if(importBtn && importFile){
    importBtn.addEventListener('click', ()=>{
      const mode = prompt('Import from:\\n1 = CSV file\\n2 = Paste CSV text\\n\\nEnter 1 or 2:');
      if(!mode) return;
      if(mode === '1'){
        if(!confirm('Do you really want to overwrite all datas?')) return;
        importFile.value = '';
        importFile.click();
      }else if(mode === '2'){
        if(!confirm('Do you really want to overwrite all datas?')) return;
        const text = prompt('Paste CSV content here:');
        if(!text) return;
        importCsvFromText(text);
      }else{
        alert('Unknown option.');
      }
    });
    importFile.addEventListener('change', ()=>{
      const file = importFile.files && importFile.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        const text = e.target.result;
        importCsvFromText(text);
      };
      reader.readAsText(file);
    });
  }

  // Receipt OCR
  const receiptInput = document.getElementById('receipt');
  if(receiptInput){
    receiptInput.addEventListener('change', ()=>{
      const file = receiptInput.files && receiptInput.files[0];
      if(file){
        tryOcrOnReceipt(file);
      }else{
        setOcrStatus('');
      }
    });
  }

  // Delete single expense via table (event delegation)
  const tbody = document.querySelector('#expenseTable tbody');
  if(tbody){
    tbody.addEventListener('click', (e)=>{
      const target = e.target;
      if(target && target.classList.contains('del-btn')){
        const idStr = target.getAttribute('data-id');
        if(!idStr) return;
        if(!confirm('Do you really want to delete?')) return;
        const idNum = Number(idStr);
        deleteExpense(idNum);
        renderCharts();
        renderExpenseTable();
        renderBudgetInfo();
      }
    });
  }

  // DELETE ALL (only data, not settings)
  const deleteAllBtn = document.getElementById('deleteAll');
  if(deleteAllBtn){
    deleteAllBtn.addEventListener('click', ()=>{
      if(!confirm('Do you really want to delete ALL data?')) return;
      saveExpenses([]);
      saveCategories([]);
      renderCategoryList();
      renderCategoryManager();
      renderCharts();
      renderExpenseTable();
      renderBudgetInfo();
    });
  }

  // NEW RULES -> scroll to rules section
  const newRulesBtn = document.getElementById('newRules');
  if(newRulesBtn){
    newRulesBtn.addEventListener('click', ()=>{
      if(!confirm('Do you really want to change the rules?')) return;
      const rulesCard = document.getElementById('rulesCard');
      if(rulesCard){
        rulesCard.scrollIntoView({behavior:'smooth'});
      }
      alert('You can now adjust rules, OCR and categories in the "Rules & Settings" section.');
    });
  }

  // RESET (top) -> delete everything
  const resetAllBtn = document.getElementById('resetAllApp');
  if(resetAllBtn){
    resetAllBtn.addEventListener('click', ()=>{
      if(!confirm('Do you really want to reset ALL data and settings?')) return;
      clearAllDataAndSettings();
      // reload page to get a clean state
      location.reload();
    });
  }

  // Form submit
  if(form){
    form.addEventListener('submit', (e)=>{
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

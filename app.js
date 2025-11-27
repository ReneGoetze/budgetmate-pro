// Storage keys
const STORAGE_KEY = 'bm_expenses';
const CATEGORY_KEY = 'bm_categories';
const SETTINGS_KEY = 'bm_settings';

// Colors
const COLOR_GREEN = 'rgba(34,197,94,0.8)';  // green-500
const COLOR_RED   = 'rgba(239,68,68,0.8)';  // red-500
const COLOR_NEUTRAL = 'rgba(59,130,246,0.5)'; // blue-500

// Load & save helpers
function loadJSON(key, fallback){
  const raw = localStorage.getItem(key);
  if(!raw) return fallback;
  try { return JSON.parse(raw); } catch(e){ return fallback; }
}
function saveJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

// Expenses
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

function clearAllData(){
  saveExpenses([]);
  saveCategories([]);
}

// Helpers
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
  const monthKey = getCurrentMonthKey(); // YYYY-MM
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
    const day = e.date.slice(8,10); // DD
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
    const key = e.date.slice(0,7); // YYYY-MM
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

  // Monthly bar colors: green if <= dailyBudget, red if > dailyBudget
  let barColors = m.values.map(()=>COLOR_NEUTRAL);
  if(settings.dailyBudget){
    const db = Number(settings.dailyBudget);
    barColors = m.values.map(v => v <= db ? COLOR_GREEN : COLOR_RED);
  }

  monthlyChart = new Chart(mCtx, {
    type: 'bar',
    data: {
      labels: m.days,
      datasets: [{
        label: 'Daily Spending (€)',
        data: m.values,
        backgroundColor: barColors
      }]
    }
  });

  catMonthChart = new Chart(cMonthCtx, {
    type: 'doughnut',
    data: {
      labels: cMonth.labels,
      datasets: [{ data: cMonth.values }]
    }
  });

  catWeekChart = new Chart(cWeekCtx, {
    type: 'doughnut',
    data: {
      labels: cWeek.labels,
      datasets: [{ data: cWeek.values }]
    }
  });

  catDayChart = new Chart(cDayCtx, {
    type: 'doughnut',
    data: {
      labels: cDay.labels,
      datasets: [{ data: cDay.values }]
    }
  });

  // Trend color: green if current month sum <= budget, else red
  const cmTotal = currentMonthTotal(expenses);
  let limit = null;
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
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
    data: {
      labels: t.labels,
      datasets: [{
        label: 'Monthly Total (€)',
        data: t.values,
        borderColor: lineColor,
        backgroundColor: lineColor,
        tension: 0.2
      }]
    }
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

// Budget info / remaining
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

// CSV export/import
function exportCsv(){
  const expenses = loadExpenses();
  if(!expenses.length){
    alert('No expenses to export.');
    return;
  }
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
  const blob = new Blob([rows.join('\n')], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'budgetmate_export.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

  // If we reach here, data is valid -> overwrite
  saveExpenses(newExpenses);
  const cats = [...new Set(newExpenses.map(e=>(e.category||'').trim()).filter(Boolean))];
  saveCategories(cats);
  renderCategoryList();
  renderCharts();
  renderExpenseTable();
  renderBudgetInfo();
  alert('Data imported successfully.');
  return true;
}

// OCR helpers
async function tryOcrOnReceipt(file){
  if(!window.Tesseract || !file) return;
  try{
    const { Tesseract } = window;
    const result = await Tesseract.recognize(file, 'eng');
    const text = result.data && result.data.text ? result.data.text : '';
    if(!text) return;

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

    if(amount != null){
      const amountInput = document.getElementById('amount');
      if(amountInput) amountInput.value = amount.toFixed(2);
    }
    if(date){
      const dateInput = document.getElementById('date');
      if(dateInput) dateInput.value = date;
    }
  }catch(e){
    console.error('OCR error', e);
  }
}

// Init
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

  renderBudgetInfo();
  renderCategoryList();
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
      const s = loadSettings();
      s.darkMode = !s.darkMode;
      saveSettings(s);
      document.body.classList.toggle('dark', !!s.darkMode);
      toggle.textContent = s.darkMode ? 'Light mode' : 'Dark mode';
    });
  }

  const saveBudgetBtn = document.getElementById('saveBudget');
  if(saveBudgetBtn){
    saveBudgetBtn.addEventListener('click', ()=>{
      const s = loadSettings();
      const dVal = document.getElementById('dailyBudget').value;
      const mVal = document.getElementById('monthlyBudget').value;
      s.dailyBudget = dVal ? parseFloat(dVal) : null;
      s.monthlyBudget = mVal ? parseFloat(mVal) : null;
      saveSettings(s);
      renderBudgetInfo();
      renderExpenseTable();
      renderCharts();
      alert('Budget saved.');
    });
  }

  const exportBtn = document.getElementById('exportCsv');
  if(exportBtn){
    exportBtn.addEventListener('click', exportCsv);
  }

  const importBtn = document.getElementById('importCsv');
  const importFile = document.getElementById('importFile');
  if(importBtn && importFile){
    importBtn.addEventListener('click', ()=>{
      if(!confirm('Do you really want to overwrite all datas?')) return;
      importFile.value = '';
      importFile.click();
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

  const receiptInput = document.getElementById('receipt');
  if(receiptInput){
    receiptInput.addEventListener('change', ()=>{
      const file = receiptInput.files && receiptInput.files[0];
      if(file){
        tryOcrOnReceipt(file);
      }
    });
  }

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

  const deleteAllBtn = document.getElementById('deleteAll');
  if(deleteAllBtn){
    deleteAllBtn.addEventListener('click', ()=>{
      if(!confirm('Do you really want to delete ALL data?')) return;
      clearAllData();
      renderCategoryList();
      renderCharts();
      renderExpenseTable();
      renderBudgetInfo();
    });
  }

  const newRulesBtn = document.getElementById('newRules');
  if(newRulesBtn){
    newRulesBtn.addEventListener('click', ()=>{
      if(!confirm('Do you really want to change the rules?')) return;
      saveSettings({ dailyBudget:null, monthlyBudget:null, darkMode:false });
      const dIn = document.getElementById('dailyBudget');
      const mIn = document.getElementById('monthlyBudget');
      if(dIn) dIn.value = '';
      if(mIn) mIn.value = '';
      document.body.classList.remove('dark');
      const tgl = document.getElementById('darkToggle');
      if(tgl) tgl.textContent = 'Dark mode';
      renderBudgetInfo();
      alert('Rules reset. You can now define new budgets and preferences above.');
    });
  }

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

      renderCategoryList();
      renderCharts();
      renderExpenseTable();
      renderBudgetInfo();
    });
  }
});

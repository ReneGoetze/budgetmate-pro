// Storage keys
const STORAGE_KEY = 'bm_expenses';
const CATEGORY_KEY = 'bm_categories';
const SETTINGS_KEY = 'bm_settings';

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
  const id = Date.now();
  expenses.push({ id, date, amount, category, note: note || '' });
  saveExpenses(expenses);

  const cats = loadCategories();
  const cTrim = (category || '').trim();
  if(cTrim && !cats.includes(cTrim)){
    cats.push(cTrim);
    saveCategories(cats);
  }
}

// Helpers
function getCurrentMonthKey(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
}
function filterCurrentMonth(expenses){
  const monthKey = getCurrentMonthKey(); // YYYY-MM
  return expenses.filter(e => (e.date || '').startsWith(monthKey));
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

// Charts
let monthlyChart, categoryChart, trendChart;

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
  const m = buildMonthlyData(currentMonthExpenses);
  const c = buildCategoryData(currentMonthExpenses);
  const t = buildTrendData(expenses);

  const mCtx = document.getElementById('monthlyChart');
  const cCtx = document.getElementById('categoryChart');
  const tCtx = document.getElementById('trendChart');
  if(!mCtx || !cCtx || !tCtx || typeof Chart === 'undefined') return;

  if(monthlyChart) monthlyChart.destroy();
  if(categoryChart) categoryChart.destroy();
  if(trendChart) trendChart.destroy();

  monthlyChart = new Chart(mCtx, {
    type: 'bar',
    data: {
      labels: m.days,
      datasets: [{ label: 'Daily Spending (€)', data: m.values }]
    }
  });

  categoryChart = new Chart(cCtx, {
    type: 'doughnut',
    data: {
      labels: c.labels,
      datasets: [{ data: c.values }]
    }
  });

  trendChart = new Chart(tCtx, {
    type: 'line',
    data: {
      labels: t.labels,
      datasets: [{ label: 'Monthly Total (€)', data: t.values }]
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
      <td>${e.note || ''}</td>`;
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

// Budget handling
function applySettingsToUI(){
  const s = loadSettings();
  const dailyInput = document.getElementById('dailyBudget');
  const monthlyInput = document.getElementById('monthlyBudget');
  if(dailyInput) dailyInput.value = s.dailyBudget != null ? s.dailyBudget : '';
  if(monthlyInput) monthlyInput.value = s.monthlyBudget != null ? s.monthlyBudget : '';
  document.body.classList.toggle('dark', !!s.darkMode);
  const toggle = document.getElementById('darkToggle');
  if(toggle) toggle.textContent = s.darkMode ? 'Light mode' : 'Dark mode';

  const info = document.getElementById('budgetInfo');
  if(info){
    let parts = [];
    if(s.dailyBudget) parts.push(`Daily: ${Number(s.dailyBudget).toFixed(2)} €`);
    if(s.monthlyBudget) parts.push(`Monthly: ${Number(s.monthlyBudget).toFixed(2)} €`);
    info.textContent = parts.join(' • ');
  }
}

// CSV export
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

// OCR helpers
async function tryOcrOnReceipt(file){
  if(!window.Tesseract || !file) return;
  try{
    const { Tesseract } = window;
    const result = await Tesseract.recognize(file, 'eng');
    const text = result.data && result.data.text ? result.data.text : '';
    if(!text) return;

    // Very simple heuristics: take the largest number with decimal as amount
    const numMatches = text.match(/\\d+[\\.,]\\d{2}/g) || [];
    let amount = null;
    if(numMatches.length){
      // choose the maximum
      amount = numMatches.map(n=>parseFloat(n.replace(',','.'))).sort((a,b)=>b-a)[0];
    }

    // Simple date pattern: DD.MM or YYYY-MM-DD
    let date = null;
    const dateMatch = text.match(/(\\d{2}[\\.\\/]\\d{2}[\\.\\/]\\d{2,4}|\\d{4}-\\d{2}-\\d{2})/);
    if(dateMatch){
      const raw = dateMatch[1];
      if(raw.includes('-')){
        date = raw; // assume YYYY-MM-DD
      }else{
        // DD.MM.YYYY or DD.MM.YY -> convert to YYYY-MM-DD with current year fallback
        const parts = raw.split(/[\\.\\/]/);
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
  const today = new Date();
  if(dateInput) dateInput.value = today.toISOString().slice(0,10);

  applySettingsToUI();
  renderCategoryList();
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
  const toggle = document.getElementById('darkToggle');
  if(toggle){
    toggle.addEventListener('click', ()=>{
      const s = loadSettings();
      s.darkMode = !s.darkMode;
      saveSettings(s);
      applySettingsToUI();
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
      saveSettings(s);
      applySettingsToUI();
      renderExpenseTable();
      alert('Budget saved.');
    });
  }

  // Export CSV
  const exportBtn = document.getElementById('exportCsv');
  if(exportBtn){
    exportBtn.addEventListener('click', exportCsv);
  }

  // Receipt OCR on change
  const receiptInput = document.getElementById('receipt');
  if(receiptInput){
    receiptInput.addEventListener('change', ()=>{
      const file = receiptInput.files && receiptInput.files[0];
      if(file){
        tryOcrOnReceipt(file);
      }
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
      dateInput.value = today.toISOString().slice(0,10);
      const receiptInputLocal = document.getElementById('receipt');
      if(receiptInputLocal) receiptInputLocal.value = '';

      renderCategoryList();
      renderCharts();
      renderExpenseTable();
    });
  }
});

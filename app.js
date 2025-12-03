// BudgetMate Pro v13 - clean version (no OCR/import/export)
// Local storage keys
const STORAGE_KEY = 'bm_expenses';
const CATEGORY_KEY = 'bm_categories';
const SETTINGS_KEY = 'bm_settings';

const COLOR_GREEN = 'rgba(34,197,94,0.8)';
const COLOR_RED   = 'rgba(239,68,68,0.8)';
const COLOR_NEUTRAL = 'rgba(59,130,246,0.5)';

// Current filter
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

// PRINT -> PDF of whole app
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

// Filter modal helpers
function openFilterModal(){
  const modal = document.getElementById('filterModal');
  const periodSel = document.getElementById('filterPeriod');
  const catSel = document.getElementById('filterCategory');
  if(!modal || !periodSel || !catSel) return;

  periodSel.value = currentFilter.period;

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
      renderCategoryList();
      renderCategoryManager();
      renderCharts();
      renderExpenseTable();
      renderBudgetInfo();
    });
  }
});

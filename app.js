const STORAGE_KEY = 'bm_expenses';
const CATEGORY_KEY = 'bm_categories';

function loadExpenses(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return [];
  try { return JSON.parse(raw) || []; } catch(e){ return []; }
}
function saveExpenses(expenses){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function loadCategories(){
  const raw = localStorage.getItem(CATEGORY_KEY);
  if(!raw) return [];
  try { return JSON.parse(raw) || []; } catch(e){ return []; }
}
function saveCategories(cats){
  localStorage.setItem(CATEGORY_KEY, JSON.stringify(cats));
}

function addExpense(date, amount, category){
  const expenses = loadExpenses();
  expenses.push({ date, amount, category });
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

// Form handling
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('expenseForm');
  const dateInput = document.getElementById('date');
  const today = new Date();
  dateInput.value = today.toISOString().slice(0,10);

  renderCategoryList();
  renderCharts();

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const date = dateInput.value;
    const amount = document.getElementById('amount').value;
    const category = document.getElementById('category').value;

    if(!date || !amount || !category){
      alert('Please fill in all fields.');
      return;
    }
    addExpense(date, parseFloat(amount), category);
    form.reset();
    dateInput.value = today.toISOString().slice(0,10);
    renderCategoryList();
    renderCharts();
  });
});

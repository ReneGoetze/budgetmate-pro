// storage.js

const STORAGE_KEY = 'bm_expenses';
const CATEGORY_KEY = 'bm_categories';
const SETTINGS_KEY = 'bm_settings';

const COLOR_GREEN   = 'rgba(34,197,94,0.8)';
const COLOR_RED     = 'rgba(239,68,68,0.8)';
const COLOR_NEUTRAL = 'rgba(59,130,246,0.5)';
const COLOR_LIGHT_BLUE = 'rgba(147,197,253,0.9)';

const CATEGORY_COLORS = [
  '#3B82F6','#EC4899','#10B981','#F59E0B','#8B5CF6',
  '#F97316','#22C55E','#E11D48','#6366F1','#0EA5E9',
  '#14B8A6','#FACC15','#4B5563'
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

let monthOffset = 0;

let currentFilter = {
  period: 'all',
  category: 'all',
  from: null,
  to: null
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
function saveExpenses(exp){ saveJSON(STORAGE_KEY, exp); }

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

function normalizeCategoryName(name){
  if(!name) return '';
  return name.trim();
}

function addExpense(date, amount, category, note){
  let cats = loadCategories();
  let rawCat = normalizeCategoryName(category);
  if(!rawCat) rawCat = 'Uncategorized';

  // Merge categories case-insensitively
  let canonical = rawCat;
  const idx = cats.findIndex(c => c.toLowerCase() === rawCat.toLowerCase());
  if(idx >= 0){
    canonical = cats[idx];
  }else{
    cats.push(rawCat);
    cats.sort((a,b)=>a.localeCompare(b));
    saveCategories(cats);
    canonical = rawCat;
  }

  const exp = loadExpenses();
  const id  = Date.now() + Math.random();
  exp.push({ id, date, amount, category: canonical, note: note || '' });
  saveExpenses(exp);
}

function deleteExpense(id){
  let exp = loadExpenses();
  exp = exp.filter(e => e.id !== id);
  saveExpenses(exp);
}

function pad2(n){ return String(n).padStart(2,'0'); }

function todayDate(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}

function getSelectedMonthDate(){
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + monthOffset);
  return d;
}
function getSelectedMonthKey(){
  const d = getSelectedMonthDate();
  return d.getFullYear() + '-' + pad2(d.getMonth()+1);
}
function getSelectedMonthLabel(){
  const d = getSelectedMonthDate();
  const m = MONTHS[d.getMonth()];
  return m + ' ' + d.getFullYear();
}

function getCurrentMonthKey(){
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth()+1);
}

function getCurrentWeekRange(){
  const d = new Date();
  const day = d.getDay();
  const diffToMon = day===0 ? -6 : 1-day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: mon, end: sun };
}

function filterSelectedMonth(expenses){
  const mk = getSelectedMonthKey();
  return expenses.filter(e => (e.date||'').startsWith(mk));
}
function filterCurrentDay(expenses){
  const t = todayDate();
  return expenses.filter(e => e.date === t);
}
function filterCurrentWeek(expenses){
  const {start,end} = getCurrentWeekRange();
  return expenses.filter(e => {
    if(!e.date) return false;
    const d = new Date(e.date);
    return d>=start && d<=end;
  });
}

function getMondayOfDate(d){
  const day = d.getDay();
  const diffToMon = day===0 ? -6 : 1-day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon);
  mon.setHours(0,0,0,0);
  return mon;
}

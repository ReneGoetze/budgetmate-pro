// storage.js
const STORAGE_KEY='bm_expenses';
const CATEGORY_KEY='bm_categories';
const SETTINGS_KEY='bm_settings';

const COLOR_GREEN   ='rgba(34,197,94,0.8)';
const COLOR_RED     ='rgba(239,68,68,0.8)';
const COLOR_NEUTRAL ='rgba(59,130,246,0.5)';
const COLOR_LIGHT_BLUE='rgba(147,197,253,0.9)';

const CATEGORY_COLORS=[
 '#3B82F6','#EC4899','#10B981','#F59E0B','#8B5CF6',
 '#F97316','#22C55E','#E11D48','#6366F1','#0EA5E9',
 '#14B8A6','#FACC15','#4B5563'
];

const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

let monthOffset=0;

let currentFilter={period:'all',category:'all',from:null,to:null};

function loadJSON(k,f){const r=localStorage.getItem(k);if(!r)return f;try{return JSON.parse(r);}catch(e){return f;}}
function saveJSON(k,v){localStorage.setItem(k,JSON.stringify(v));}

function loadExpenses(){return loadJSON(STORAGE_KEY,[]);}
function saveExpenses(e){saveJSON(STORAGE_KEY,e);}
function loadCategories(){return loadJSON(CATEGORY_KEY,[]);}
function saveCategories(c){saveJSON(CATEGORY_KEY,c);}
function loadSettings(){return loadJSON(SETTINGS_KEY,{dailyBudget:null,monthlyBudget:null,darkMode:false});}
function saveSettings(s){saveJSON(SETTINGS_KEY,s);}

function normalizeCategoryName(n){return n?n.trim():'';}

function getCategoryColorMap(){
  const cats=loadCategories().slice().sort((a,b)=>a.localeCompare(b));
  const map={};
  cats.forEach((c,i)=>{map[c]=CATEGORY_COLORS[i%CATEGORY_COLORS.length];});
  return map;
}

function addExpense(date,amount,category,note){
  let cats=loadCategories();
  let raw=normalizeCategoryName(category);
  if(!raw)raw='Uncategorized';
  let canonical=raw;
  const idx=cats.findIndex(c=>c.toLowerCase()===raw.toLowerCase());
  if(idx>=0)canonical=cats[idx];
  else{cats.push(raw);cats.sort((a,b)=>a.localeCompare(b));saveCategories(cats);}
  const exp=loadExpenses();
  const id=Date.now()+Math.random();
  exp.push({id,date,amount,category:canonical,note:note||''});
  saveExpenses(exp);
}

function deleteExpense(id){
  let exp=loadExpenses();
  exp=exp.filter(e=>e.id!==id);
  saveExpenses(exp);
}

function pad2(n){return String(n).padStart(2,'0');}
function todayDate(){return new Date().toISOString().slice(0,10);}

function getSelectedMonthDate(){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+monthOffset);return d;}
function getSelectedMonthKey(){const d=getSelectedMonthDate();return d.getFullYear()+'-'+pad2(d.getMonth()+1);}
function getSelectedMonthLabel(){const d=getSelectedMonthDate();return MONTHS[d.getMonth()]+' '+d.getFullYear();}
function getCurrentMonthKey(){const d=new Date();return d.getFullYear()+'-'+pad2(d.getMonth()+1);}

function getCurrentWeekRange(){
  const d=new Date();
  const day=d.getDay();
  const diff=day===0?-6:1-day;
  const mon=new Date(d);mon.setDate(d.getDate()+diff);
  const sun=new Date(mon);sun.setDate(mon.getDate()+6);
  return{start:mon,end:sun};
}

function filterSelectedMonth(exp){const mk=getSelectedMonthKey();return exp.filter(e=>(e.date||'').startsWith(mk));}
function filterCurrentDay(exp){const t=todayDate();return exp.filter(e=>e.date===t);}
function filterCurrentWeek(exp){
  const{start,end}=getCurrentWeekRange();
  return exp.filter(e=>{
    if(!e.date)return false;
    const d=new Date(e.date);return d>=start&&d<=end;
  });
}

function getMondayOfDate(d){
  const day=d.getDay();
  const diff=day===0?-6:1-day;
  const mon=new Date(d);mon.setDate(d.getDate()+diff);mon.setHours(0,0,0,0);
  return mon;
}

// filters.js

function getFilteredExpenses(){
  let exp = loadExpenses();
  if(currentFilter.period==='day'){
    exp = filterCurrentDay(exp);
  }else if(currentFilter.period==='week'){
    exp = filterCurrentWeek(exp);
  }else if(currentFilter.period==='month'){
    exp = filterSelectedMonth(exp);
  }else if(currentFilter.period==='range' && (currentFilter.from || currentFilter.to)){
    const from=currentFilter.from?new Date(currentFilter.from):null;
    const to=currentFilter.to?new Date(currentFilter.to):null;
    exp = exp.filter(e=>{
      if(!e.date) return false;
      const d=new Date(e.date);
      if(from && d<from) return false;
      if(to){
        const d2=new Date(to);
        d2.setHours(23,59,59,999);
        if(d>d2) return false;
      }
      return true;
    });
  }
  if(currentFilter.category!=='all'){
    exp = exp.filter(e=>(e.category||'')===currentFilter.category);
  }
  return exp;
}

function renderExpenseTable(){
  const tbody=document.querySelector('#expenseTable tbody');
  const bar=document.getElementById('summaryBar');
  if(!tbody||!bar) return;
  const s=loadSettings();
  const exp=getFilteredExpenses();

  tbody.innerHTML='';
  let total=0;
  exp.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  exp.forEach(e=>{
    total+=Number(e.amount||0);
    const tr=document.createElement('tr');
    const dTd=document.createElement('td');
    dTd.textContent=e.date||'-';
    const cTd=document.createElement('td');
    cTd.textContent=e.category||'-';
    const aTd=document.createElement('td');
    aTd.textContent=Number(e.amount||0).toFixed(2);
    const delTd=document.createElement('td');
    const btn=document.createElement('button');
    btn.type='button';
    btn.textContent='Del';
    btn.className='del-btn';
    btn.addEventListener('click',()=>{
      if(!confirm('Do you really want to delete?')) return;
      deleteExpense(e.id);
      renderExpenseTable();
      renderCharts();
      renderBudgetInfo();
    });
    delTd.appendChild(btn);
    tr.appendChild(dTd);
    tr.appendChild(cTd);
    tr.appendChild(aTd);
    tr.appendChild(delTd);
    tbody.appendChild(tr);
  });

  if(!exp.length){
    bar.textContent='No expenses for this selection.';
    bar.className='summary-bar';
    return;
  }

  let budget=null;
  const sel=getSelectedMonthDate();
  const year=sel.getFullYear();
  const month=sel.getMonth();
  const daysInMonth=new Date(year,month+1,0).getDate();
  if(currentFilter.period==='month'){
    if(s.monthlyBudget) budget=Number(s.monthlyBudget);
    else if(s.dailyBudget) budget=Number(s.dailyBudget)*daysInMonth;
  }else if(currentFilter.period==='day'){
    if(s.dailyBudget) budget=Number(s.dailyBudget);
  }else if(currentFilter.period==='week'){
    if(s.dailyBudget) budget=Number(s.dailyBudget)*7;
  }
  let txt='Entries: ' + exp.length + ' • Sum: ' + total.toFixed(2) + ' €';
  if(budget!=null){
    const diff=budget-total;
    if(diff>=0){
      txt+=' • Budget: ' + budget.toFixed(2) + ' € (under by ' + diff.toFixed(2) + ' €)';
      bar.className='summary-bar summary-ok';
    }else{
      txt+=' • Budget: ' + budget.toFixed(2) + ' € (OVER by ' + Math.abs(diff).toFixed(2) + ' €)';
      bar.className='summary-bar summary-warn';
    }
  }else{
    bar.className='summary-bar';
  }
  bar.textContent=txt;
}

function openFilterModal(){
  const modal=document.getElementById('filterModal');
  if(!modal) return;
  modal.classList.remove('hidden');

  const pSel=document.getElementById('filterPeriod');
  const cSel=document.getElementById('filterCategory');
  const fInput=document.getElementById('filterFrom');
  const tInput=document.getElementById('filterTo');

  if(pSel) pSel.value=currentFilter.period;
  if(fInput) fInput.value=currentFilter.from||'';
  if(tInput) tInput.value=currentFilter.to||'';

  if(cSel){
    const allExp=loadExpenses();
    const catsSet=new Set();
    allExp.forEach(e=>{
      const cat=(e.category||'').trim();
      if(cat) catsSet.add(cat);
    });
    const cats=Array.from(catsSet).sort((a,b)=>a.localeCompare(b));
    cSel.innerHTML='<option value="all">All categories</option>';
    cats.forEach(cat=>{
      const opt=document.createElement('option');
      opt.value=cat;
      opt.textContent=cat;
      cSel.appendChild(opt);
    });
    cSel.value=currentFilter.category;
  }
}

function applyFilterFromModal(){
  const pSel=document.getElementById('filterPeriod');
  const cSel=document.getElementById('filterCategory');
  const fInput=document.getElementById('filterFrom');
  const tInput=document.getElementById('filterTo');
  currentFilter.period=pSel?pSel.value:'all';
  currentFilter.category=cSel?cSel.value:'all';
  currentFilter.from=fInput?fInput.value||null:null;
  currentFilter.to=tInput?tInput.value||null:null;
  renderExpenseTable();
  const modal=document.getElementById('filterModal');
  if(modal) modal.classList.add('hidden');
}

function clearFilter(){
  currentFilter={period:'all',category:'all',from:null,to:null};
  renderExpenseTable();
}

function closeFilterModal(){
  const modal=document.getElementById('filterModal');
  if(!modal) return;
  modal.classList.add('hidden');
}

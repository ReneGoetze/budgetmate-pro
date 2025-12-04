// filters.js – getFilteredExpenses + table + filter modal

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
    tr.innerHTML=`<td>${e.date||''}</td>
      <td>${e.category||''}</td>
      <td>${Number(e.amount||0).toFixed(2)}</td>
      <td><button class="del-btn" data-id="${e.id}">Del</button></td>`;
    tbody.appendChild(tr);
  });

  let periodLabel='All data';
  if(currentFilter.period==='day') periodLabel='Today';
  else if(currentFilter.period==='week') periodLabel='This week';
  else if(currentFilter.period==='month') periodLabel='This month';
  else if(currentFilter.period==='range') periodLabel='Custom range';

  let catLabel='';
  if(currentFilter.category!=='all') catLabel=`, category: ${currentFilter.category}`;

  let txt=`Filter: ${periodLabel}${catLabel} • Total: ${total.toFixed(2)} €`;
  let cls='summary-ok';
  if(currentFilter.period==='month' && s.monthlyBudget){
    const mb=Number(s.monthlyBudget);
    const diff=mb-total;
    if(diff>=0){
      txt+=` • ${diff.toFixed(2)} € under monthly budget`;
      cls='summary-ok';
    }else{
      txt+=` • ${Math.abs(diff).toFixed(2)} € OVER monthly budget`;
      cls='summary-warn';
    }
  }
  bar.textContent=txt;
  bar.className='summary-bar '+cls;
}

function openFilterModal(){
  const modal=document.getElementById('filterModal');
  const periodSel=document.getElementById('filterPeriod');
  const catSel=document.getElementById('filterCategory');
  const fromInput=document.getElementById('filterFrom');
  const toInput=document.getElementById('filterTo');
  if(!modal||!periodSel||!catSel||!fromInput||!toInput) return;

  periodSel.value=currentFilter.period;
  fromInput.value=currentFilter.from||'';
  toInput.value=currentFilter.to||'';

  const all=loadExpenses();
  const used=[...new Set(all.map(e=>(e.category||'').trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b));
  catSel.innerHTML='';
  const optAll=document.createElement('option');
  optAll.value='all'; optAll.textContent='All categories';
  catSel.appendChild(optAll);
  used.forEach(c=>{
    const opt=document.createElement('option');
    opt.value=c; opt.textContent=c;
    catSel.appendChild(opt);
  });
  catSel.value=currentFilter.category==='all'?'all':currentFilter.category;

  modal.classList.remove('hidden');
}
function closeFilterModal(){
  const modal=document.getElementById('filterModal');
  if(modal) modal.classList.add('hidden');
}

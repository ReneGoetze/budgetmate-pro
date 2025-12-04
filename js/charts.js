// charts.js – build data + render charts + yearly/weekly + month summary

let monthlyChart, catMonthChart, catWeekChart, catDayChart, trendChart, yearlyChart, weeklyChart;

function buildMonthlyData(exp){
  const map={};
  exp.forEach(e=>{
    if(!e.date) return;
    const d = e.date.slice(8,10);
    map[d]=(map[d]||0)+Number(e.amount||0);
  });
  const days = Object.keys(map).sort();
  return {days, values: days.map(d=>map[d])};
}
function buildCategoryData(exp){
  const map={};
  exp.forEach(e=>{
    const cat = e.category && e.category.trim()? e.category.trim():'Uncategorized';
    map[cat]=(map[cat]||0)+Number(e.amount||0);
  });
  const labels = Object.keys(map);
  return {labels, values: labels.map(l=>map[l])};
}
function buildTrendData(exp){
  const map={};
  exp.forEach(e=>{
    if(!e.date) return;
    const key = e.date.slice(0,7);
    map[key]=(map[key]||0)+Number(e.amount||0);
  });
  const keys = Object.keys(map).sort().slice(-6);
  return {labels:keys, values:keys.map(k=>map[k])};
}
function currentMonthTotal(exp){
  return filterSelectedMonth(exp).reduce((s,e)=>s+Number(e.amount||0),0);
}
function buildYearlyData(expenses, year, settings){
  const labels=[],values=[],colors=[],budgets=[],diffs=[];
  let totalYear=0,maxVal=-Infinity,minVal=Infinity,maxM=null,minM=null;
  for(let m=0;m<12;m++){
    const ym = year+'-'+pad2(m+1);
    const sum = expenses.filter(e=>(e.date||'').startsWith(ym))
      .reduce((s,e)=>s+Number(e.amount||0),0);
    labels.push(new Date(year,m,1).toLocaleString(undefined,{month:'short'}));
    values.push(sum);
    totalYear+=sum;
    if(sum>maxVal){maxVal=sum;maxM=m;}
    if(sum<minVal){minVal=sum;minM=m;}
    const daysInMonth = new Date(year,m+1,0).getDate();
    let limit=null;
    if(settings.monthlyBudget) limit=Number(settings.monthlyBudget);
    else if(settings.dailyBudget) limit=Number(settings.dailyBudget)*daysInMonth;
    budgets.push(limit);
    if(limit!=null){
      const d=sum-limit;
      diffs.push(d);
      colors.push(sum<=limit?COLOR_GREEN:COLOR_RED);
    }else{
      diffs.push(null);
      colors.push(COLOR_NEUTRAL);
    }
  }
  if(!isFinite(maxVal)) maxVal=0;
  if(!isFinite(minVal)) minVal=0;
  return {
    labels,values,colors,budgets,diffs,
    totalYear,
    avgMonth: totalYear/12,
    maxVal,minVal,
    maxMonthLabel: maxM!=null?new Date(year,maxM,1).toLocaleString(undefined,{month:'long'}):'-',
    minMonthLabel: minM!=null?new Date(year,minM,1).toLocaleString(undefined,{month:'long'}):'-'
  };
}
function buildWeeklyData(expenses){
  const today = new Date();
  const currentMonday = getMondayOfDate(today);
  const labels=[],values=[];
  let total=0,maxVal=-Infinity,minVal=Infinity,bestIdx=null,worstIdx=null;
  for(let i=11;i>=0;i--){
    const start=new Date(currentMonday);
    start.setDate(start.getDate()-i*7);
    const end=new Date(start);
    end.setDate(start.getDate()+6);
    const sum=expenses.filter(e=>{
      if(!e.date) return false;
      const d=new Date(e.date);
      return d>=start && d<=end;
    }).reduce((s,e)=>s+Number(e.amount||0),0);
    const label=start.toLocaleDateString(undefined,{day:'2-digit',month:'2-digit'})+
      ' - '+end.toLocaleDateString(undefined,{day:'2-digit',month:'2-digit'});
    labels.push(label);
    values.push(sum);
    total+=sum;
    if(sum>maxVal){maxVal=sum;worstIdx=labels.length-1;}
    if(sum<minVal){minVal=sum;bestIdx=labels.length-1;}
  }
  if(!isFinite(maxVal)) maxVal=0;
  if(!isFinite(minVal)) minVal=0;
  return {
    labels,values,total,
    avgWeek: total/12,
    bestLabel: bestIdx!=null?labels[bestIdx]:'-',
    worstLabel: worstIdx!=null?labels[worstIdx]:'-',
    bestVal:minVal,
    worstVal:maxVal
  };
}

function renderMonthLabel(){
  const labelEl=document.getElementById('monthLabel');
  const prevBtn=document.getElementById('prevMonth');
  const nextBtn=document.getElementById('nextMonth');
  if(labelEl) labelEl.textContent=getSelectedMonthLabel();
  if(nextBtn) nextBtn.disabled=monthOffset>=0;
  if(prevBtn) prevBtn.disabled=false;
  syncMonthYearSelectors();
}

function updateMonthSummary(monthExp, settings){
  const el=document.getElementById('monthSummary');
  if(!el) return;
  const sel=getSelectedMonthDate();
  const now=new Date();
  const ySel=sel.getFullYear(), mSel=sel.getMonth();
  const yNow=now.getFullYear(), mNow=now.getMonth();
  const daysInMonth=new Date(ySel,mSel+1,0).getDate();
  let daysCount;
  if(ySel<yNow || (ySel===yNow && mSel<mNow)) daysCount=daysInMonth;
  else if(ySel===yNow && mSel===mNow) daysCount=now.getDate();
  else daysCount=daysInMonth;
  const sum=monthExp.reduce((s,e)=>s+Number(e.amount||0),0);
  let budget=null;
  if(settings.monthlyBudget) budget=Number(settings.monthlyBudget);
  else if(settings.dailyBudget) budget=Number(settings.dailyBudget)*daysCount;
  let txt=`Sum: ${sum.toFixed(2)} € • Days: ${daysCount}`;
  if(budget!=null){
    txt+=` • Budget: ${budget.toFixed(2)} €`;
    if(sum<=budget){txt+=' • Under budget';el.className='hint summary-ok';}
    else{txt+=' • OVER budget';el.className='hint summary-warn';}
  }else el.className='hint';
  el.textContent=txt;
}

function updateMonthChangeAndProjection(monthExp, settings){
  const changeEl=document.getElementById('monthChange');
  const projEl=document.getElementById('monthProjection');
  if(changeEl){changeEl.textContent='';changeEl.className='hint';}
  if(projEl){projEl.textContent='';projEl.className='hint';}
  const all=loadExpenses();

  if(changeEl){
    const sel=getSelectedMonthDate();
    const prev=new Date(sel); prev.setMonth(prev.getMonth()-1);
    const prevKey=prev.getFullYear()+'-'+pad2(prev.getMonth()+1);
    const selKey=getSelectedMonthKey();
    const selSum=all.filter(e=>(e.date||'').startsWith(selKey))
      .reduce((s,e)=>s+Number(e.amount||0),0);
    const prevSum=all.filter(e=>(e.date||'').startsWith(prevKey))
      .reduce((s,e)=>s+Number(e.amount||0),0);
    if(prevSum===0){
      changeEl.textContent='Change vs previous month: no previous month data.';
      changeEl.className='hint';
    }else{
      const diff=selSum-prevSum;
      const arrow=diff>0?'↑':(diff<0?'↓':'→');
      const abs=Math.abs(diff).toFixed(2);
      if(diff>0){changeEl.textContent=`Change vs previous month: +${abs} € (${arrow})`;changeEl.className='hint summary-warn';}
      else if(diff<0){changeEl.textContent=`Change vs previous month: -${abs} € (${arrow})`;changeEl.className='hint summary-ok';}
      else{changeEl.textContent=`Change vs previous month: 0.00 € (${arrow})`;changeEl.className='hint';}
    }
  }

  if(projEl){
    const now=new Date();
    const sel=getSelectedMonthDate();
    if(sel.getFullYear()===now.getFullYear() && sel.getMonth()===now.getMonth()){
      const daysInMonth=new Date(sel.getFullYear(),sel.getMonth()+1,0).getDate();
      const day=now.getDate();
      if(day>0){
        const sumSoFar=monthExp.filter(e=>{
          if(!e.date) return false;
          const d=parseInt(e.date.slice(8,10),10);
          return d<=day;
        }).reduce((s,e)=>s+Number(e.amount||0),0);
        const avg=sumSoFar/day;
        const projected=avg*daysInMonth;
        let limit=null;
        if(settings.monthlyBudget) limit=Number(settings.monthlyBudget);
        else if(settings.dailyBudget) limit=Number(settings.dailyBudget)*daysInMonth;
        let txt=`Projected total for this month: ${projected.toFixed(2)} € (based on average daily spending)`;
        if(limit!=null){
          if(projected<=limit){txt+=` • within budget (${limit.toFixed(2)} €)`;projEl.className='hint summary-ok';}
          else{txt+=` • would OVER budget (${limit.toFixed(2)} €)`;projEl.className='hint summary-warn';}
        }else projEl.className='hint';
        projEl.textContent=txt;
      }
    }else{
      projEl.textContent='Projection is only available for the current month.';
      projEl.className='hint';
    }
  }
}

function populateMonthYearSelectors(){
  const mSel=document.getElementById('monthSelect');
  const ySel=document.getElementById('yearSelect');
  if(!mSel || !ySel) return;
  const months=[];
  for(let m=0;m<12;m++){
    months.push(new Date(2000,m,1).toLocaleString(undefined,{month:'short'}));
  }
  mSel.innerHTML='';
  months.forEach((name,idx)=>{
    const opt=document.createElement('option');
    opt.value=idx; opt.textContent=name;
    mSel.appendChild(opt);
  });
  const now=new Date(), yNow=now.getFullYear(), start=yNow-10;
  ySel.innerHTML='';
  for(let y=yNow; y>=start; y--){
    const opt=document.createElement('option');
    opt.value=y; opt.textContent=y;
    ySel.appendChild(opt);
  }
  syncMonthYearSelectors();
}
function syncMonthYearSelectors(){
  const mSel=document.getElementById('monthSelect');
  const ySel=document.getElementById('yearSelect');
  if(!mSel || !ySel) return;
  const d=getSelectedMonthDate();
  mSel.value=d.getMonth();
  ySel.value=d.getFullYear();
}
function setMonthYearFromSelectors(){
  const mSel=document.getElementById('monthSelect');
  const ySel=document.getElementById('yearSelect');
  if(!mSel || !ySel) return;
  const m=parseInt(mSel.value,10);
  const y=parseInt(ySel.value,10);
  if(!isFinite(m)||!isFinite(y)) return;
  const now=new Date(), yNow=now.getFullYear(), mNow=now.getMonth();
  const diff=(y-yNow)*12 + (m-mNow);
  monthOffset=diff;
  renderCharts();
  renderExpenseTable();
}

function renderCharts(){
  const all=loadExpenses();
  const monthExp=filterSelectedMonth(all);
  const weekExp=filterCurrentWeek(all);
  const dayExp=filterCurrentDay(all);
  const m=buildMonthlyData(monthExp);
  const cMonth=buildCategoryData(monthExp);
  const cWeek=buildCategoryData(weekExp);
  const cDay=buildCategoryData(dayExp);
  const trend=buildTrendData(all);
  const s=loadSettings();

  const mCtx=document.getElementById('monthlyChart');
  const cMonthCtx=document.getElementById('catMonthChart');
  const cWeekCtx=document.getElementById('catWeekChart');
  const cDayCtx=document.getElementById('catDayChart');
  const tCtx=document.getElementById('trendChart');
  const yCtx=document.getElementById('yearlyChart');
  const wCtx=document.getElementById('weeklyChart');
  if(!mCtx||!cMonthCtx||!cWeekCtx||!cDayCtx||!tCtx||!yCtx||!wCtx||typeof Chart==='undefined') return;

  if(monthlyChart) monthlyChart.destroy();
  if(catMonthChart) catMonthChart.destroy();
  if(catWeekChart) catWeekChart.destroy();
  if(catDayChart) catDayChart.destroy();
  if(trendChart) trendChart.destroy();
  if(yearlyChart) yearlyChart.destroy();
  if(weeklyChart) weeklyChart.destroy();

  let barColors=m.values.map(()=>COLOR_NEUTRAL);
  if(s.dailyBudget){
    const db=Number(s.dailyBudget);
    barColors=m.values.map(v=>v<=db?COLOR_GREEN:COLOR_RED);
  }

  monthlyChart=new Chart(mCtx,{
    type:'bar',
    data:{labels:m.days,datasets:[{label:'Daily Spending (€)',data:m.values,backgroundColor:barColors}]}
  });

  catMonthChart=new Chart(cMonthCtx,{
    type:'doughnut',
    data:{labels:cMonth.labels,datasets:[{data:cMonth.values}]}
  });
  catWeekChart=new Chart(cWeekCtx,{
    type:'doughnut',
    data:{labels:cWeek.labels,datasets:[{data:cWeek.values}]}
  });
  catDayChart=new Chart(cDayCtx,{
    type:'doughnut',
    data:{labels:cDay.labels,datasets:[{data:cDay.values}]}
  });

  const cmTotal=currentMonthTotal(all);
  const selDate=getSelectedMonthDate();
  const daysInMonth=new Date(selDate.getFullYear(),selDate.getMonth()+1,0).getDate();
  let limit=null;
  if(s.monthlyBudget) limit=Number(s.monthlyBudget);
  else if(s.dailyBudget) limit=Number(s.dailyBudget)*daysInMonth;
  let lineColor=COLOR_NEUTRAL;
  if(limit!=null) lineColor=cmTotal<=limit?COLOR_GREEN:COLOR_RED;

  trendChart=new Chart(tCtx,{
    type:'line',
    data:{labels:trend.labels,datasets:[{label:'Monthly Total (€)',data:trend.values,borderColor:lineColor,backgroundColor:lineColor,tension:0.2}]}
  });

  renderMonthLabel();
  updateMonthSummary(monthExp,s);
  updateMonthChangeAndProjection(monthExp,s);

  const year=selDate.getFullYear();
  const yData=buildYearlyData(all,year,s);
  yearlyChart=new Chart(yCtx,{
    type:'bar',
    data:{labels:yData.labels,datasets:[{label:'Monthly total (€)',data:yData.values,backgroundColor:yData.colors}]}
  });
  const yearSumEl=document.getElementById('yearSummary');
  if(yearSumEl){
    yearSumEl.textContent=
      `Year ${year}: Total ${yData.totalYear.toFixed(2)} € • Avg/month ${yData.avgMonth.toFixed(2)} € • `+
      `Highest: ${yData.maxMonthLabel} (${yData.maxVal.toFixed(2)} €) • `+
      `Lowest: ${yData.minMonthLabel} (${yData.minVal.toFixed(2)} €)`;
  }
  const yearTableEl=document.getElementById('yearTable');
  if(yearTableEl){
    let html='<table><thead><tr><th>Month</th><th>Sum (€)</th><th>Budget (€)</th><th>Diff (€)</th><th>Status</th></tr></thead><tbody>';
    for(let i=0;i<12;i++){
      const label=yData.labels[i];
      const sum=yData.values[i];
      const budget=yData.budgets[i];
      const diff=yData.diffs[i];
      let status='-',cls='';
      if(budget!=null && diff!=null){
        if(diff<=0){status='Under';cls='status-ok';}
        else{status='Over';cls='status-warn';}
      }
      html+=`<tr>
        <td>${label}</td>
        <td>${sum.toFixed(2)}</td>
        <td>${budget!=null?budget.toFixed(2):'-'}</td>
        <td>${diff!=null?diff.toFixed(2):'-'}</td>
        <td class="${cls}">${status}</td>
      </tr>`;
    }
    html+='</tbody></table>';
    yearTableEl.innerHTML=html;
  }

  const wData=buildWeeklyData(all);
  weeklyChart=new Chart(wCtx,{
    type:'bar',
    data:{labels:wData.labels,datasets:[{label:'Weekly total (€)',data:wData.values,backgroundColor:COLOR_NEUTRAL}]}
  });
  const weekSummaryEl=document.getElementById('weekSummary');
  if(weekSummaryEl){
    weekSummaryEl.textContent=
      `Last 12 weeks: Total ${wData.total.toFixed(2)} € • Avg/week ${wData.avgWeek.toFixed(2)} € • `+
      `Best (lowest): ${wData.bestLabel} (${wData.bestVal.toFixed(2)} €) • `+
      `Worst (highest): ${wData.worstLabel} (${wData.worstVal.toFixed(2)} €)`;
  }

  renderFavoriteCategories();
}

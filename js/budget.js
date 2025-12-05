// budget.js

function renderBudgetInfo(){
  const info   = document.getElementById('budgetInfo');
  const cumBox = document.getElementById('cumBudgetBox');
  if(!info || !cumBox) return;

  const s = loadSettings();
  const exp = loadExpenses();

  const mk = getCurrentMonthKey();
  const monthExp = exp.filter(e => (e.date||'').startsWith(mk));
  const total = monthExp.reduce((sum,e)=>sum+Number(e.amount||0),0);

  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const day = today.getDate();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const remainingDays = Math.max(0, daysInMonth - day + 1);

  let methodText = '';
  let remaining = null;
  if(s.monthlyBudget){
    remaining = Number(s.monthlyBudget) - total;
    methodText = 'based on monthly budget';
  }else if(s.dailyBudget){
    const remBudget = Number(s.dailyBudget)*remainingDays;
    remaining = remBudget - total;
    methodText = 'based on projected daily budget';
  }

  const parts = [];
  if(s.dailyBudget) parts.push('Daily: ' + Number(s.dailyBudget).toFixed(2) + ' €');
  if(s.monthlyBudget) parts.push('Monthly: ' + Number(s.monthlyBudget).toFixed(2) + ' €');
  if(remaining!=null){
    parts.push('Remaining this month: ' + remaining.toFixed(2) + ' € (' + methodText + ')');
  }
  info.textContent = parts.join(' • ');

  cumBox.textContent = '';
  cumBox.className = 'cum-box';
  if(!s.dailyBudget) return;

  const spentSoFar = monthExp
    .filter(e=>{
      if(!e.date) return false;
      const d = parseInt(e.date.slice(8,10),10);
      return d<=day;
    })
    .reduce((sum,e)=>sum+Number(e.amount||0),0);

  const allowed = Number(s.dailyBudget)*day;
  const diff = allowed - spentSoFar;
  let txt = 'Cumulative spending: ' + spentSoFar.toFixed(2) + ' € • Allowed so far (' + day + ' days): ' + allowed.toFixed(2) + ' €';
  if(diff>=0){
    txt += ' • Status: under by ' + diff.toFixed(2) + ' €';
    cumBox.className = 'cum-box cum-ok';
  }else{
    txt += ' • Status: OVER by ' + Math.abs(diff).toFixed(2) + ' €';
    cumBox.className = 'cum-box cum-warn';
  }
  cumBox.textContent = txt;
}

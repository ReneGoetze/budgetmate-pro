// ui.js

function saveBudgetFromUI(){
  const dailyInput=document.getElementById('dailyBudget');
  const monthlyInput=document.getElementById('monthlyBudget');
  if(!dailyInput||!monthlyInput) return;
  const daily=dailyInput.value?Number(dailyInput.value):null;
  const monthly=monthlyInput.value?Number(monthlyInput.value):null;

  if(daily && monthly){
    alert('Please choose EITHER a daily OR a monthly budget, not both at the same time. Clear one of the fields and try again.');
    return;
  }
  const s=loadSettings();
  s.dailyBudget=daily||null;
  s.monthlyBudget=monthly||null;
  saveSettings(s);
  renderBudgetInfo();
  renderCharts();
}

function loadBudgetToUI(){
  const s=loadSettings();
  const dailyInput=document.getElementById('dailyBudget');
  const monthlyInput=document.getElementById('monthlyBudget');
  if(dailyInput) dailyInput.value=s.dailyBudget!=null?Number(s.dailyBudget):'';
  if(monthlyInput) monthlyInput.value=s.monthlyBudget!=null?Number(s.monthlyBudget):'';
}

function toggleDarkMode(){
  const s=loadSettings();
  s.darkMode=!s.darkMode;
  saveSettings(s);
  applyDarkMode();
}
function applyDarkMode(){
  const s=loadSettings();
  if(s.darkMode) document.body.classList.add('dark');
  else document.body.classList.remove('dark');
}

function handleNewRules(){
  const ok=confirm('Do you really want to change the rules? You can adjust budget, categories and filters manually.');
  if(!ok) return;
  alert('Rules have been reset logically. Please update your budget fields, categories or filters as needed.');
}

async function captureFullPagePdf(filename){
  const container=document.querySelector('.container');
  if(!container) return;
  if(typeof html2canvas==='undefined' || typeof window.jspdf==='undefined'){
    alert('PDF export is not available.');
    return;
  }
  const {jsPDF}=window.jspdf;
  const canvas=await html2canvas(container,{scale:2, useCORS:true});
  const imgData=canvas.toDataURL('image/png');
  const pdf=new jsPDF('p','mm','a4');
  const pageWidth=210;
  const pageHeight=297;
  const margin=10;
  const availableWidth=pageWidth-2*margin;
  const availableHeight=pageHeight-2*margin;
  let imgWidth=availableWidth;
  let imgHeight=canvas.height*imgWidth/canvas.width;
  if(imgHeight>availableHeight){
    const ratio=availableHeight/imgHeight;
    imgWidth=imgWidth*ratio;
    imgHeight=imgHeight*ratio;
  }
  const x=margin + (availableWidth-imgWidth)/2;
  const y=margin + (availableHeight-imgHeight)/2;
  pdf.addImage(imgData,'PNG',x,y,imgWidth,imgHeight);
  pdf.save(filename);
}

async function printReport(){
  const dateStr=new Date().toISOString().slice(0,10);
  await captureFullPagePdf('BudgetMate_full_'+dateStr+'.pdf');
}

async function exportMonthPdf(){
  const prevFilter=Object.assign({},currentFilter);
  currentFilter={period:'month',category:'all',from:null,to:null};
  renderExpenseTable();
  renderCharts();
  renderBudgetInfo();

  const sel=getSelectedMonthDate();
  const fileMonth=MONTHS[sel.getMonth()];
  const filename='BudgetMate_month_'+fileMonth+'_'+sel.getFullYear()+'.pdf';
  await captureFullPagePdf(filename);

  currentFilter=prevFilter;
  renderExpenseTable();
  renderCharts();
  renderBudgetInfo();
}

function exportCsv(){
  const exp = typeof getFilteredExpenses==='function' ? getFilteredExpenses() : loadExpenses();
  if(!exp.length){
    alert('No expenses to export.');
    return;
  }
  const header=['Date','Category','Amount','Note'];
  let csv=header.join(';')+'\n';
  exp.forEach(e=>{
    const row=[
      e.date||'',
      (e.category||'').replace(/"/g,'""'),
      Number(e.amount||0).toFixed(2),
      (e.note||'').replace(/"/g,'""')
    ];
    csv+=row.map(v=>'"'+v+'"').join(';')+'\n';
  });
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const dateStr=new Date().toISOString().slice(0,10);
  a.href=url;
  a.download='BudgetMate_Expenses_'+dateStr+'.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

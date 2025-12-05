// ui.js
function updateDarkModeButtonLabel(){
  const btn=document.getElementById('darkToggle');
  if(!btn)return;
  const isDark=document.body.classList.contains('dark');
  btn.textContent=isDark?'Light mode':'Dark mode';
}
function saveBudgetFromUI(){
  const dailyInput=document.getElementById('dailyBudget');
  const monthlyInput=document.getElementById('monthlyBudget');
  if(!dailyInput||!monthlyInput)return;
  const daily=dailyInput.value?Number(dailyInput.value):null;
  const monthly=monthlyInput.value?Number(monthlyInput.value):null;
  if(daily&&monthly){
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
  if(dailyInput)dailyInput.value=s.dailyBudget!=null?Number(s.dailyBudget):'';
  if(monthlyInput)monthlyInput.value=s.monthlyBudget!=null?Number(s.monthlyBudget):'';
}
function toggleDarkMode(){
  const s=loadSettings();
  s.darkMode=!s.darkMode;
  saveSettings(s);
  applyDarkMode();
}
function applyDarkMode(){
  const s=loadSettings();
  if(s.darkMode)document.body.classList.add('dark');
  else document.body.classList.remove('dark');
  updateDarkModeButtonLabel();
}
function handleNewRules(){
  const ok=confirm('Do you really want to change the rules? You can adjust budget, categories and filters manually.');
  if(!ok)return;
  alert('Rules have been logically reset. Please update your budget fields, categories or filters as needed.');
}
function ensureLightModeForExport(){
  const wasDark=document.body.classList.contains('dark');
  if(wasDark){document.body.classList.remove('dark');updateDarkModeButtonLabel();}
  return wasDark;
}
function restoreDarkModeAfterExport(wasDark){
  if(wasDark){document.body.classList.add('dark');updateDarkModeButtonLabel();}
}
async function captureFullPagePdf(filename){
  const container=document.querySelector('.container');
  if(!container)return;
  if(typeof html2canvas==='undefined'||typeof window.jspdf==='undefined'){
    alert('PDF export is not available.');
    return;
  }
  const{jsPDF}=window.jspdf;
  const canvas=await html2canvas(container,{scale:2,useCORS:true});
  const imgData=canvas.toDataURL('image/png');
  const pdf=new jsPDF('p','mm','a4');
  const pageWidth=210,pageHeight=297,margin=10;
  const availableWidth=pageWidth-2*margin,availableHeight=pageHeight-2*margin;
  let imgWidth=availableWidth,imgHeight=canvas.height*imgWidth/canvas.width;
  if(imgHeight>availableHeight){
    const ratio=availableHeight/imgHeight;
    imgWidth*=ratio;imgHeight*=ratio;
  }
  const x=margin+(availableWidth-imgWidth)/2;
  const y=margin+(availableHeight-imgHeight)/2;
  pdf.addImage(imgData,'PNG',x,y,imgWidth,imgHeight);
  pdf.save(filename);
}
async function printReport(){
  const wasDark=ensureLightModeForExport();
  const dateStr=new Date().toISOString().slice(0,10);
  await captureFullPagePdf('BudgetMate_full_'+dateStr+'.pdf');
  restoreDarkModeAfterExport(wasDark);
}

function buildMonthBudgetSummaryForPdf(monthExp,settings){
  const sel=getSelectedMonthDate();
  const now=new Date();
  const ySel=sel.getFullYear(),mSel=sel.getMonth();
  const yNow=now.getFullYear(),mNow=now.getMonth();
  const daysInMonth=new Date(ySel,mSel+1,0).getDate();
  let daysCount;
  if(ySel<yNow||(ySel===yNow&&mSel<mNow))daysCount=daysInMonth;
  else if(ySel===yNow&&mSel===mNow)daysCount=now.getDate();
  else daysCount=daysInMonth;
  const sum=monthExp.reduce((s,e)=>s+Number(e.amount||0),0);
  let budget=null;
  if(settings.monthlyBudget)budget=Number(settings.monthlyBudget);
  else if(settings.dailyBudget)budget=Number(settings.dailyBudget)*daysCount;
  let lines=[];
  lines.push('Sum: '+sum.toFixed(2)+' €');
  lines.push('Days counted: '+daysCount);
  if(settings.dailyBudget)lines.push('Daily budget: '+Number(settings.dailyBudget).toFixed(2)+' €');
  if(settings.monthlyBudget)lines.push('Monthly budget: '+Number(settings.monthlyBudget).toFixed(2)+' €');
  if(budget!=null){
    const diff=sum-budget;
    if(diff>0)lines.push(diff.toFixed(2)+' € OVER BUDGET');
    else if(diff<0)lines.push(Math.abs(diff).toFixed(2)+' € UNDER BUDGET');
    else lines.push('Exactly on budget');
  }
  return{sum,budget,daysCount,lines};
}

async function exportMonthPdf(){
  if(typeof window.jspdf==='undefined'){
    alert('PDF export is not available.');
    return;
  }
  const wasDark=ensureLightModeForExport();
  const all=loadExpenses();
  const mk=getSelectedMonthKey();
  const monthExp=all.filter(e=>(e.date||'').startsWith(mk));
  const settings=loadSettings();
  const{jsPDF}=window.jspdf;
  const pdf=new jsPDF('p','mm','a4');
  const pageWidth=210,pageHeight=297,margin=10;
  let y=margin;

  const sel=getSelectedMonthDate();
  const title='BudgetMate – Monthly Report: '+MONTHS[sel.getMonth()]+' '+sel.getFullYear();
  pdf.setFontSize(16);
  pdf.text(title,pageWidth/2,y,{align:'center'});
  y+=8;

  pdf.setFontSize(10);
  const budgetInfo=buildMonthBudgetSummaryForPdf(monthExp,settings);
  budgetInfo.lines.forEach(line=>{pdf.text(line,margin,y);y+=5;});

  const monthSummaryEl=document.getElementById('monthSummary');
  const monthChangeEl=document.getElementById('monthChange');
  const monthProjectionEl=document.getElementById('monthProjection');
  const extraLines=[];
  if(monthSummaryEl&&monthSummaryEl.textContent)extraLines.push(monthSummaryEl.textContent);
  if(monthChangeEl&&monthChangeEl.textContent)extraLines.push(monthChangeEl.textContent);
  if(monthProjectionEl&&monthProjectionEl.textContent)extraLines.push(monthProjectionEl.textContent);
  if(extraLines.length){
    y+=3;
    extraLines.forEach(line=>{
      const splitted=pdf.splitTextToSize(line,pageWidth-2*margin);
      pdf.text(splitted,margin,y);
      y+=5*splitted.length;
    });
  }
  y+=4;

  if(window.monthlyChart){
    const imgData=window.monthlyChart.toBase64Image();
    const imgWidth=pageWidth-2*margin;
    const imgHeight=imgWidth*0.4;
    if(y+imgHeight>pageHeight-margin){pdf.addPage();y=margin;}
    pdf.text('Monthly spending (bar chart)',margin,y);y+=5;
    pdf.addImage(imgData,'PNG',margin,y,imgWidth,imgHeight);y+=imgHeight+6;
  }
  if(window.catMonthChart){
    const imgData=window.catMonthChart.toBase64Image();
    const imgWidth=pageWidth/2;
    const imgHeight=imgWidth*0.8;
    if(y+imgHeight>pageHeight-margin){pdf.addPage();y=margin;}
    pdf.text('Monthly categories (pie chart)',margin,y);y+=5;
    pdf.addImage(imgData,'PNG',margin,y,imgWidth,imgHeight);y+=imgHeight+6;
  }

  const cats=loadCategories().slice().sort((a,b)=>a.localeCompare(b));
  const colorMap=getCategoryColorMap();
  if(cats.length){
    if(y+10>pageHeight-margin){pdf.addPage();y=margin;}
    pdf.setFontSize(11);pdf.text('Category legend',margin,y);y+=4;
    pdf.setFontSize(9);
    cats.forEach(cat=>{
      const color=colorMap[cat]||CATEGORY_COLORS[0];
      const hex=color.replace('#','');
      const r=parseInt(hex.substring(0,2),16);
      const g=parseInt(hex.substring(2,4),16);
      const b=parseInt(hex.substring(4,6),16);
      if(y+5>pageHeight-margin){pdf.addPage();y=margin;}
      pdf.setFillColor(r,g,b);
      pdf.rect(margin,y-3,4,4,'F');
      pdf.setTextColor(0,0,0);
      pdf.text(' '+cat,margin+6,y);
      y+=5;
    });
  }

  if(monthExp.length){
    if(y+10>pageHeight-margin){pdf.addPage();y=margin;}
    pdf.setFontSize(11);pdf.text('Monthly expenses (details)',margin,y);y+=6;
    pdf.setFontSize(9);
    const colWidths=[25,60,25,80];
    const headers=['Date','Category','Amount','Note'];
    function drawHeader(){
      let x=margin;
      headers.forEach((h,i)=>{pdf.text(h,x,y);x+=colWidths[i];});
      y+=4;pdf.line(margin,y,pageWidth-margin,y);y+=2;
    }
    drawHeader();
    monthExp.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    monthExp.forEach(e=>{
      if(y+6>pageHeight-margin){pdf.addPage();y=margin;drawHeader();}
      let x=margin;
      const row=[e.date||'',e.category||'',Number(e.amount||0).toFixed(2),e.note||''];
      row.forEach((val,i)=>{
        const cellWidth=colWidths[i];
        const text=pdf.splitTextToSize(String(val),cellWidth-1);
        pdf.text(text,x,y);
        x+=cellWidth;
      });
      y+=6;
    });
  }

  const fileMonth=MONTHS[sel.getMonth()];
  const filename='BudgetMate_month_'+fileMonth+'_'+sel.getFullYear()+'.pdf';
  pdf.save(filename);
  restoreDarkModeAfterExport(wasDark);
}

function exportCsv(){
  const exp=typeof getFilteredExpenses==='function'?getFilteredExpenses():loadExpenses();
  if(!exp.length){alert('No expenses to export.');return;}
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
  a.href=url;a.download='BudgetMate_Expenses_'+dateStr+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

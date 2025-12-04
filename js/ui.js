// ui.js – print full report + export month PDF

async function printReport(){
  const main=document.querySelector('.container');
  if(!main){alert('Nothing to print.');return;}
  if(!window.html2canvas || !window.jspdf){
    alert('Print libraries not available.');return;
  }
  try{
    const canvas=await html2canvas(main,{scale:2});
    const img=canvas.toDataURL('image/png');
    const {jsPDF}=window.jspdf;
    const pdf=new jsPDF('p','mm','a4');
    const pw=pdf.internal.pageSize.getWidth();
    const ph=pdf.internal.pageSize.getHeight();
    const iw=pw;
    const ih=canvas.height*pw/canvas.width;
    if(ih<=ph){
      pdf.addImage(img,'PNG',0,0,iw,ih);
    }else{
      let hLeft=ih,pos=0;
      pdf.addImage(img,'PNG',0,pos,iw,ih);
      hLeft-=ph;
      while(hLeft>0){
        pdf.addPage();
        pos-=ph;
        pdf.addImage(img,'PNG',0,pos,iw,ih);
        hLeft-=ph;
      }
    }
    const dateStr=new Date().toISOString().slice(0,10);
    pdf.save('BudgetMate_Report_'+dateStr+'.pdf');
  }catch(e){
    console.error(e);
    alert('Error generating PDF: '+e.message);
  }
}

async function exportMonthPdf(){
  const section=document.getElementById('monthlySection');
  if(!section){alert('Nothing to export.');return;}
  if(!window.html2canvas || !window.jspdf){
    alert('Export libraries not available.');return;
  }
  try{
    const canvas=await html2canvas(section,{scale:2});
    const img=canvas.toDataURL('image/png');
    const {jsPDF}=window.jspdf;
    const pdf=new jsPDF('p','mm','a4');
    const pw=pdf.internal.pageSize.getWidth();
    const ph=pdf.internal.pageSize.getHeight();
    const iw=pw;
    const ih=canvas.height*pw/canvas.width;
    if(ih<=ph){
      pdf.addImage(img,'PNG',0,0,iw,ih);
    }else{
      let hLeft=ih,pos=0;
      pdf.addImage(img,'PNG',0,pos,iw,ih);
      hLeft-=ph;
      while(hLeft>0){
        pdf.addPage();
        pos-=ph;
        pdf.addImage(img,'PNG',0,pos,iw,ih);
        hLeft-=ph;
      }
    }
    const d=getSelectedMonthDate();
    const m=MONTHS[d.getMonth()];
    const y=d.getFullYear();
    pdf.save(`BudgetMate_Month_${m}_${y}.pdf`);
  }catch(e){
    console.error(e);
    alert('Error generating month PDF: '+e.message);
  }
}

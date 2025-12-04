// main.js

document.addEventListener('DOMContentLoaded',()=>{
  applyDarkMode();
  loadBudgetToUI();
  populateMonthYearSelectors();
  renderCategoryList();
  renderCategoryManager();
  renderCharts();
  renderBudgetInfo();
  renderExpenseTable();

  const form=document.getElementById('expenseForm');
  if(form){
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const date=document.getElementById('date').value;
      const amount=parseFloat(document.getElementById('amount').value||'0');
      const category=document.getElementById('category').value;
      const note=document.getElementById('note').value;
      if(!date || !amount || !category){
        alert('Please enter date, amount and category.');
        return;
      }
      addExpense(date,amount,category,note);
      form.reset();
      document.getElementById('date').value=todayDate();
      renderCategoryList();
      renderCategoryManager();
      renderCharts();
      renderExpenseTable();
      renderBudgetInfo();
    });
    document.getElementById('date').value=todayDate();
  }

  const fixed=document.getElementById('fixedCategories');
  if(fixed){
    fixed.querySelectorAll('.cat-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const val=btn.dataset.cat;
        const inp=document.getElementById('category');
        if(inp) inp.value=val;
      });
    });
  }

  const saveBtn=document.getElementById('saveBudget');
  if(saveBtn) saveBtn.addEventListener('click',saveBudgetFromUI);

  const darkBtn=document.getElementById('darkToggle');
  if(darkBtn) darkBtn.addEventListener('click',()=>{
    toggleDarkMode();
    renderCharts();
  });

  const prevBtn=document.getElementById('prevMonth');
  const nextBtn=document.getElementById('nextMonth');
  const todayBtn=document.getElementById('todayMonth');
  if(prevBtn) prevBtn.addEventListener('click',()=>{monthOffset--;renderCharts();renderExpenseTable();});
  if(nextBtn) nextBtn.addEventListener('click',()=>{if(monthOffset<0){monthOffset++;renderCharts();renderExpenseTable();}});
  if(todayBtn) todayBtn.addEventListener('click',()=>{monthOffset=0;renderCharts();renderExpenseTable();});

  const mSel=document.getElementById('monthSelect');
  const ySel=document.getElementById('yearSelect');
  if(mSel) mSel.addEventListener('change',setMonthYearFromSelectors);
  if(ySel) ySel.addEventListener('change',setMonthYearFromSelectors);

  const printBtn=document.getElementById('printReport');
  if(printBtn) printBtn.addEventListener('click',printReport);

  const expMonthBtn=document.getElementById('exportMonthPdf');
  if(expMonthBtn) expMonthBtn.addEventListener('click',exportMonthPdf);

  const delAllBtn=document.getElementById('deleteAll');
  if(delAllBtn) delAllBtn.addEventListener('click',()=>{
    if(!confirm('Do you really want to delete ALL expenses?')) return;
    saveExpenses([]);
    renderExpenseTable();
    renderCharts();
    renderBudgetInfo();
  });

  const rulesBtn=document.getElementById('newRules');
  if(rulesBtn) rulesBtn.addEventListener('click',handleNewRules);

  const exportCsvBtn=document.getElementById('exportCsv');
  if(exportCsvBtn) exportCsvBtn.addEventListener('click',exportCsv);

  const thDate=document.getElementById('thDate');
  const thCategory=document.getElementById('thCategory');
  if(thDate) thDate.addEventListener('click',()=>{
    currentFilter.period='day';
    currentFilter.from=null;
    currentFilter.to=null;
    renderExpenseTable();
  });
  if(thCategory) thCategory.addEventListener('click',()=>{
    openFilterModal();
  });

  const applyFilterBtn=document.getElementById('applyFilter');
  const clearFilterBtn=document.getElementById('clearFilter');
  const closeFilterBtn=document.getElementById('closeFilter');
  if(applyFilterBtn) applyFilterBtn.addEventListener('click',applyFilterFromModal);
  if(clearFilterBtn) clearFilterBtn.addEventListener('click',()=>{clearFilter();closeFilterModal();});
  if(closeFilterBtn) closeFilterBtn.addEventListener('click',closeFilterModal);
});

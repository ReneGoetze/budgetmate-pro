// main.js – wire up everything on DOMContentLoaded

document.addEventListener('DOMContentLoaded',()=>{
  const form=document.getElementById('expenseForm');
  const dateInput=document.getElementById('date');
  if(dateInput) dateInput.value=todayDate();

  const s=loadSettings();
  document.body.classList.toggle('dark',!!s.darkMode);
  const dailyInput=document.getElementById('dailyBudget');
  const monthlyInput=document.getElementById('monthlyBudget');
  if(dailyInput) dailyInput.value=s.dailyBudget!=null?s.dailyBudget:'';
  if(monthlyInput) monthlyInput.value=s.monthlyBudget!=null?s.monthlyBudget:'';
  const toggle=document.getElementById('darkToggle');
  if(toggle) toggle.textContent=s.darkMode?'Light mode':'Dark mode';

  populateMonthYearSelectors();
  renderBudgetInfo();
  renderCategoryList();
  renderCategoryManager();
  renderCharts();
  renderExpenseTable();

  document.querySelectorAll('.cat-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const cat=btn.dataset.cat || btn.getAttribute('data-cat');
      const inp=document.getElementById('category');
      if(inp && cat) inp.value=cat;
    });
  });

  if(toggle){
    toggle.addEventListener('click',()=>{
      const st=loadSettings();
      st.darkMode=!st.darkMode;
      saveSettings(st);
      document.body.classList.toggle('dark',!!st.darkMode);
      toggle.textContent=st.darkMode?'Light mode':'Dark mode';
    });
  }

  const saveBudgetBtn=document.getElementById('saveBudget');
  if(saveBudgetBtn){
    saveBudgetBtn.addEventListener('click',()=>{
      const st=loadSettings();
      const dv=document.getElementById('dailyBudget').value;
      const mv=document.getElementById('monthlyBudget').value;
      st.dailyBudget=dv?parseFloat(dv):null;
      st.monthlyBudget=mv?parseFloat(mv):null;
      saveSettings(st);
      renderBudgetInfo();
      renderExpenseTable();
      renderCharts();
      alert('Budget saved.');
    });
  }

  const tbody=document.querySelector('#expenseTable tbody');
  if(tbody){
    tbody.addEventListener('click',e=>{
      const target=e.target;
      if(target && target.classList.contains('del-btn')){
        const idStr=target.getAttribute('data-id');
        if(!idStr) return;
        if(!confirm('Do you really want to delete?\n\nYes = delete this single expense.\nNo = keep it.')) return;
        const idNum=Number(idStr);
        deleteExpense(idNum);
        renderCharts();
        renderExpenseTable();
        renderBudgetInfo();
      }
    });
  }

  const deleteAllBtn=document.getElementById('deleteAll');
  if(deleteAllBtn){
    deleteAllBtn.addEventListener('click',()=>{
      const msg='DELETE ALL EXPENSE DATA\n\nThis will delete:\n• all saved expenses\n• all saved categories\n\nBudgets & settings will stay.\n\nAre you sure?\nYes = delete all\nNo = cancel';
      if(!confirm(msg)) return;
      saveExpenses([]);
      saveCategories([]);
      renderCategoryList();
      renderCategoryManager();
      renderCharts();
      renderExpenseTable();
      renderBudgetInfo();
    });
  }

  const newRulesBtn=document.getElementById('newRules');
  if(newRulesBtn){
    newRulesBtn.addEventListener('click',()=>{
      if(!confirm('Do you really want to change the rules?')) return;
      const rulesCard=document.getElementById('rulesCard');
      if(rulesCard) rulesCard.scrollIntoView({behavior:'smooth'});
      alert('You can now adjust categories in the "Rules & Settings" section. Budgets can be changed in the Budget section at the top.');
    });
  }

  const printBtn=document.getElementById('printReport');
  if(printBtn){
    printBtn.addEventListener('click',()=>{ printReport(); });
  }
  const exportMonthBtn=document.getElementById('exportMonthPdf');
  if(exportMonthBtn){
    exportMonthBtn.addEventListener('click',()=>{ exportMonthPdf(); });
  }

  const thDate=document.getElementById('thDate');
  const thCategory=document.getElementById('thCategory');
  if(thDate) thDate.addEventListener('click',openFilterModal);
  if(thCategory) thCategory.addEventListener('click',openFilterModal);

  const modal=document.getElementById('filterModal');
  const closeFilterBtn=document.getElementById('closeFilter');
  const applyFilterBtn=document.getElementById('applyFilter');
  const clearFilterBtn=document.getElementById('clearFilter');
  const periodSel=document.getElementById('filterPeriod');
  const catSel=document.getElementById('filterCategory');
  const fromInput=document.getElementById('filterFrom');
  const toInput=document.getElementById('filterTo');

  if(closeFilterBtn){
    closeFilterBtn.addEventListener('click',()=>{ closeFilterModal(); });
  }
  if(modal){
    const backdrop=modal.querySelector('.modal-backdrop');
    if(backdrop) backdrop.addEventListener('click',()=>{ closeFilterModal(); });
  }
  if(applyFilterBtn){
    applyFilterBtn.addEventListener('click',()=>{
      if(periodSel) currentFilter.period=periodSel.value;
      if(catSel) currentFilter.category=catSel.value;
      if(periodSel && periodSel.value==='range'){
        currentFilter.from=fromInput.value||null;
        currentFilter.to=toInput.value||null;
      }else{
        currentFilter.from=null;
        currentFilter.to=null;
      }
      closeFilterModal();
      renderCharts();
      renderExpenseTable();
    });
  }
  if(clearFilterBtn){
    clearFilterBtn.addEventListener('click',()=>{
      currentFilter={period:'all',category:'all',from:null,to:null};
      closeFilterModal();
      renderCharts();
      renderExpenseTable();
    });
  }

  const prevMonthBtn=document.getElementById('prevMonth');
  const nextMonthBtn=document.getElementById('nextMonth');
  const todayBtn=document.getElementById('todayMonth');
  const monthSelect=document.getElementById('monthSelect');
  const yearSelect=document.getElementById('yearSelect');

  if(prevMonthBtn){
    prevMonthBtn.addEventListener('click',()=>{
      monthOffset--;
      renderCharts();
      renderExpenseTable();
    });
  }
  if(nextMonthBtn){
    nextMonthBtn.addEventListener('click',()=>{
      if(monthOffset<0){
        monthOffset++;
        renderCharts();
        renderExpenseTable();
      }
    });
  }
  if(todayBtn){
    todayBtn.addEventListener('click',()=>{
      monthOffset=0;
      renderCharts();
      renderExpenseTable();
    });
  }
  if(monthSelect){
    monthSelect.addEventListener('change',()=>{ setMonthYearFromSelectors(); });
  }
  if(yearSelect){
    yearSelect.addEventListener('change',()=>{ setMonthYearFromSelectors(); });
  }

  if(form){
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const date=dateInput.value;
      const amountVal=document.getElementById('amount').value;
      const category=document.getElementById('category').value;
      const note=document.getElementById('note').value;
      if(!date || !amountVal || !category){
        alert('Please fill in date, amount and category.');return;
      }
      const amount=parseFloat(amountVal);
      if(!isFinite(amount) || amount<=0){
        alert('Amount must be a positive number.');return;
      }
      addExpense(date,amount,category,note);
      form.reset();
      dateInput.value=todayDate();
      renderCategoryList();
      renderCategoryManager();
      renderCharts();
      renderExpenseTable();
      renderBudgetInfo();
    });
  }
});

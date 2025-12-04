// categories.js – list, manager, favorites

function renderCategoryList(){
  const cats = loadCategories().slice().sort((a,b)=>a.localeCompare(b));
  const dl = document.getElementById('categoryList');
  if(!dl) return;
  dl.innerHTML = '';
  cats.forEach(c=>{
    const opt = document.createElement('option');
    opt.value = c;
    dl.appendChild(opt);
  });
}

function renderCategoryManager(){
  const cont = document.getElementById('categoryManager');
  if(!cont) return;
  const cats = loadCategories().slice().sort((a,b)=>a.localeCompare(b));
  if(!cats.length){
    cont.textContent = 'No saved categories yet. They will appear here once you use them.';
    return;
  }
  cont.innerHTML = '';
  cats.forEach(cat=>{
    const row = document.createElement('div');
    row.className = 'cat-item';

    const span = document.createElement('span');
    span.textContent = cat;

    const btns = document.createElement('div');
    btns.className = 'cat-item-buttons';

    const renameBtn = document.createElement('button');
    renameBtn.textContent = 'Rename';
    renameBtn.className = 'cat-item-btn';
    renameBtn.addEventListener('click',()=>{
      const neu = prompt('New name for category:', cat);
      if(!neu) return;
      const t = neu.trim();
      if(!t) return;
      const all = loadCategories();
      const idx = all.indexOf(cat);
      if(idx>=0) all[idx] = t;
      saveCategories(all);
      const exp = loadExpenses();
      exp.forEach(e=>{
        if((e.category||'').trim()===cat) e.category = t;
      });
      saveExpenses(exp);
      renderCategoryList();
      renderCategoryManager();
      renderCharts();
      renderExpenseTable();
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.className = 'cat-item-btn';
    delBtn.addEventListener('click',()=>{
      if(!confirm('Delete this category from suggestions? Existing expenses keep their category.')) return;
      const all = loadCategories().filter(c=>c!==cat);
      saveCategories(all);
      renderCategoryList();
      renderCategoryManager();
    });

    btns.appendChild(renameBtn);
    btns.appendChild(delBtn);
    row.appendChild(span);
    row.appendChild(btns);
    cont.appendChild(row);
  });
}

function renderFavoriteCategories(){
  const fav = document.getElementById('favCategories');
  if(!fav) return;
  const exp = loadExpenses();
  if(!exp.length){
    fav.textContent = '';
    return;
  }
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate()-30);
  const freq = {};
  exp.forEach(e=>{
    if(!e.date) return;
    const d = new Date(e.date);
    if(d<cutoff) return;
    const cat = (e.category||'').trim();
    if(!cat) return;
    freq[cat] = (freq[cat]||0)+1;
  });
  const entries = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,7);
  fav.innerHTML='';
  entries.forEach(([cat])=>{
    const btn = document.createElement('button');
    btn.type='button';
    btn.className='cat-btn';
    btn.textContent = cat;
    btn.dataset.cat = cat;
    btn.addEventListener('click',()=>{
      const inp = document.getElementById('category');
      if(inp) inp.value = cat;
    });
    fav.appendChild(btn);
  });
}

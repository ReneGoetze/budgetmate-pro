function saveData(k,v){localStorage.setItem(k,JSON.stringify(v));}
function loadData(k,f){let d=localStorage.getItem(k);return d?JSON.parse(d):f;}
let monthlyData=loadData("monthlyData",{days:["01","02","03"],values:[12.5,8.9,22.1]});
let categoryData=loadData("categoryData",{labels:["Groceries","Coffee","Transport"],values:[120,40,35]});
let trendData=loadData("trendData",{labels:["Jun","Jul","Aug","Sep","Oct","Nov"],values:[450,420,510,490,530,480]});

function renderCharts(){
  const mCtx=document.getElementById('monthlyChart');
  const cCtx=document.getElementById('categoryChart');
  const tCtx=document.getElementById('trendChart');
  if(!mCtx||!cCtx||!tCtx)return;

  new Chart(mCtx,{type:"bar",data:{labels:monthlyData.days,datasets:[{label:"Daily Spending (€)",data:monthlyData.values}]}});
  new Chart(cCtx,{type:"doughnut",data:{labels:categoryData.labels,datasets:[{data:categoryData.values}]}});
  new Chart(tCtx,{type:"line",data:{labels:trendData.labels,datasets:[{label:"Monthly Total (€)",data:trendData.values}]}});
}

document.getElementById('importBtn').onclick=()=> {
  let j=prompt("Paste JSON from GPT");
  if(!j)return;
  try{
    let d=JSON.parse(j);
    if(d.monthlyData)monthlyData=d.monthlyData;
    if(d.categoryData)categoryData=d.categoryData;
    if(d.trendData)trendData=d.trendData;
    saveData("monthlyData",monthlyData);
    saveData("categoryData",categoryData);
    saveData("trendData",trendData);
    alert("Data imported. Reload the page to refresh charts.");
  }catch(e){
    alert("Invalid JSON");
  }
};

renderCharts();

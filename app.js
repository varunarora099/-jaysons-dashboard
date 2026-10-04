const state={data:{sales:[],receipts:[],orders:[]},filters:{year:"ALL",month:"ALL",company:"ALL",party:"ALL"}};
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n)||0);
const months=["January","February","March","April","May","June","July","August","September","October","November","December"];

function url(){return localStorage.getItem("jaysons_api_url")||$("apiUrl").value}
function normRow(r){let o={...r}; for(const k of Object.keys(o)){if(o[k]===null||o[k]===undefined)o[k]=""} return o}
function getDate(r){return r.Date||r.date||r.VoucherDate||r.voucherDate||""}
function getParty(r){return r.Party||r.party||r.Ledger||r.LedgerName||""}
function getCompany(r){return r.Company||r.company||""}
function getAmount(r){return Number(r.Amount||r.amount||r.BankAmount||r.bankAmount||0)}
function dateObj(s){let d=new Date(s); if(isNaN(d)) {let m=String(s).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/); if(m)d=new Date(+m[3],+m[2]-1,+m[1])} return d}
function rowYear(r){let d=dateObj(getDate(r));return isNaN(d)?String(getDate(r)).slice(0,4):String(d.getFullYear())}
function rowMonth(r){let d=dateObj(getDate(r));return isNaN(d)?"":months[d.getMonth()]}
function matches(r){let f=state.filters;return (f.year==="ALL"||rowYear(r)===f.year)&&(f.month==="ALL"||rowMonth(r)===f.month)&&(f.company==="ALL"||getCompany(r)===f.company)&&(f.party==="ALL"||getParty(r)===f.party)}
function filtered(type){return state.data[type].filter(matches)}

async function load(){
  $("statusText").textContent="Refreshing…";
  try{
    const res=await fetch(url(),{cache:"no-store"});
    const json=await res.json();
    state.data.sales=(json.sales||json["Sales Data"]||[]).map(normRow);
    state.data.receipts=(json.receipts||json["Receipts Data"]||[]).map(normRow);
    state.data.orders=(json.orders||json["Order Data"]||[]).map(normRow);
    localStorage.setItem("jaysons_cache",JSON.stringify(state.data));
    $("statusText").textContent="Live data connected";
    $("lastUpdated").textContent="Updated "+new Date().toLocaleString("en-IN");
    populateFilters(); render();
  }catch(e){
    const c=localStorage.getItem("jaysons_cache");
    if(c){state.data=JSON.parse(c);$("statusText").textContent="Offline — showing last saved data";populateFilters();render()}
    else $("statusText").textContent="Unable to connect. Check Apps Script URL.";
  }
}
function unique(type,fn){return [...new Set(state.data[type].map(fn).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}))}
function fillSelect(id,vals,selected){
  const s=$(id), first=s.options[0].text; s.innerHTML=`<option value="ALL">${first}</option>`; vals.forEach(v=>{let o=document.createElement("option");o.value=v;o.textContent=v;s.appendChild(o)});s.value=selected||"ALL";
}
function populateFilters(){
  fillSelect("yearFilter",unique("sales",rowYear),state.filters.year);
  fillSelect("monthFilter",months.filter(m=>state.data.sales.some(r=>rowMonth(r)===m)),state.filters.month);
  fillSelect("companyFilter",unique("sales",getCompany),state.filters.company);
  fillSelect("partyFilter",unique("sales",getParty),state.filters.party);
}
function render(){
  const sales=filtered("sales"), receipts=filtered("receipts"), orders=filtered("orders");
  const st=sales.reduce((a,r)=>a+getAmount(r),0), rt=receipts.reduce((a,r)=>a+getAmount(r),0);
  $("salesTotal").textContent=money(st);$("receiptTotal").textContent=money(rt);
  $("orderTotal").textContent=orders.reduce((a,r)=>a+Number(r.Quantity||r.Qty||r.OrderQty||r.quantity||0),0).toLocaleString("en-IN");
  $("pendingTotal").textContent=orders.reduce((a,r)=>a+Number(r.Pending||r.Balance||r.PendingQty||0),0).toLocaleString("en-IN");
  $("salesCount").textContent=sales.length+" vouchers";$("receiptCount").textContent=receipts.length+" receipts";
  $("receiptScreenTotal").textContent=money(rt);
  renderList("salesList",sales.slice().sort((a,b)=>dateObj(getDate(b))-dateObj(getDate(a))),"sale");
  renderList("receiptList",receipts.slice().sort((a,b)=>dateObj(getDate(b))-dateObj(getDate(a))),"receipt");
  renderOrders(orders); drawChart(sales);
}
function renderList(id,rows,type){
  const el=$(id); el.innerHTML="";
  if(!rows.length){el.innerHTML='<div class="card empty">No records for the selected filters.</div>';return}
  rows.slice(0,100).forEach(r=>{
    const d=getDate(r), p=getParty(r), c=getCompany(r), a=getAmount(r);
    let title=type==="sale"?(r.Invoice||r.VoucherNo||r["Invoice No"]||"Sales Voucher"):(r.Bank||r.BankName||r.VoucherNo||"Receipt");
    let div=document.createElement("div");div.className="listrow";
    div.innerHTML=`<div class="line1"><span>${esc(title)}</span><span class="amount">${money(a)}</span></div><div class="line2">${esc(p)}${c?" • "+esc(c):""}${d?" • "+esc(d):""}</div>`;
    el.appendChild(div);
  });
}
function renderOrders(rows){
  const el=$("orderList");el.innerHTML="";
  if(!rows.length){$("ordersEmpty").style.display="block";return}
  $("ordersEmpty").style.display="none";
  rows.slice(0,100).forEach(r=>{let div=document.createElement("div");div.className="listrow";div.innerHTML=`<div class="line1"><span>${esc(getParty(r))}</span><span class="amount">${Number(r.Pending||r.Balance||r.PendingQty||0).toLocaleString("en-IN")}</span></div><div class="line2">${esc(getCompany(r))} • Order ${Number(r.OrderQty||r.Quantity||r.Qty||0).toLocaleString("en-IN")} • Sold ${Number(r.SoldQty||r.Sold||0).toLocaleString("en-IN")}</div>`;el.appendChild(div)});
}
function drawChart(rows){
 const c=$("salesChart"),ctx=c.getContext("2d"),w=c.width=c.clientWidth*devicePixelRatio,h=c.height=c.clientHeight*devicePixelRatio;ctx.clearRect(0,0,w,h);
 const map={};rows.forEach(r=>{let d=dateObj(getDate(r));if(!isNaN(d)){let k=d.toLocaleDateString("en-IN",{day:"2-digit",month:"short"});map[k]=(map[k]||0)+getAmount(r)}});
 const vals=Object.values(map).slice(-10), labels=Object.keys(map).slice(-10), max=Math.max(...vals,1), pad=25;
 ctx.strokeStyle="#d1d5db";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad,10);ctx.lineTo(pad,h-pad);ctx.lineTo(w-10,h-pad);ctx.stroke();
 if(vals.length<1)return;ctx.beginPath();vals.forEach((v,i)=>{let x=pad+(i*(w-pad-15)/Math.max(vals.length-1,1)),y=10+(h-pad-20)*(1-v/max);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle="#111827";ctx.lineWidth=3;ctx.stroke();
 ctx.fillStyle="#6b7280";ctx.font=`${11*devicePixelRatio}px -apple-system`;labels.forEach((l,i)=>{let x=pad+(i*(w-pad-15)/Math.max(labels.length-1,1));ctx.fillText(l,x-12,h-6)});
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}

["yearFilter","monthFilter","companyFilter","partyFilter"].forEach(id=>$(id).addEventListener("change",e=>{state.filters[{yearFilter:"year",monthFilter:"month",companyFilter:"company",partyFilter:"party"}[id]]=e.target.value;render()}));
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));$(b.dataset.screen).classList.add("active")}));
$("refreshBtn").onclick=load;$("syncBtn").onclick=load;
$("saveUrl").onclick=()=>{localStorage.setItem("jaysons_api_url",$("apiUrl").value.trim());alert("Saved. Tap Sync / Refresh Data.");};
$("apiUrl").value=localStorage.getItem("jaysons_api_url")||$("apiUrl").value;
load();

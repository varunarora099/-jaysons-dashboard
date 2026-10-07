const API_URL = "https://script.google.com/macros/s/AKfycbzwcazUzjP9fk9hMTZFQh95X1ijtBD8sOQFgme3Lh5Zz8r42ckPUWwqFu29RcYKbq-n/exec";
const CACHE_KEY = "jaysons_dashboard_cache_v4";
const CACHE_TIME_KEY = "jaysons_dashboard_cache_time_v4";

const state = {
  data: { sales: [], receipts: [], orders: [] },
  filters: { year: "ALL", month: "ALL", company: "ALL", party: "ALL" },
  lastUpdated: null,
  loading: false
};

const $ = id => document.getElementById(id);
const clean = v => v == null ? "" : String(v).trim();
const escapeHTML = v => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
const parseMoney = v => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).replace(/₹|Rs\.?|INR/gi,"").replace(/,/g,"").replace(/\s/g,"").replace(/[^\d.-]/g,""));
  return Number.isFinite(n) ? n : 0;
};
const parseNumber = v => parseMoney(v);
const money = v => "₹" + (Number(v)||0).toLocaleString("en-IN",{maximumFractionDigits:0});
const qty = v => (Number(v)||0).toLocaleString("en-IN",{maximumFractionDigits:2});

function dateObj(v){
  const s=clean(v); if(!s) return null;
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d);}
  if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)){const [d,m,y]=s.split("/").map(Number);return new Date(y,m-1,d);}
  const d=new Date(s); return isNaN(d)?null:d;
}
function getDate(r){return clean(r.Date ?? r.date ?? r["Voucher Date"] ?? r["Order Date"]);}
function getFY(r){
  const raw=clean(r.FY ?? r.FinancialYear ?? r["Financial Year"]);
  if(raw) return raw.replace(/^FY\s*/i, "");
  const d=dateObj(getDate(r));
  if(!d) return "";
  const y=d.getFullYear(), m=d.getMonth()+1;
  return m>=4 ? `${y}-${String((y+1)%100).padStart(2,"0")}` : `${y-1}-${String(y%100).padStart(2,"0")}`;
}
function getYear(r){ return getFY(r); }
function getMonthNo(r){
  const d=dateObj(getDate(r)); if(d) return d.getMonth()+1;
  const m=clean(r.Month).toLowerCase();
  return ({january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12})[m]||0;
}
function getMonthName(r){
  const d=dateObj(getDate(r));
  return d ? d.toLocaleString("en-IN",{month:"long"}) : clean(r.Month);
}
function getCompany(r){return clean(r.Company ?? r.company ?? r["Company Name"] ?? r.CompanyName);}
function getParty(r){return clean(r.Party ?? r.party ?? r["Party Name"] ?? r["PartyName"] ?? r.Customer ?? r.customer);}
function getInvoice(r){return clean(r["Invoice No"] ?? r.InvoiceNo ?? r["Invoice Number"] ?? r["Voucher No"] ?? r.VoucherNo);}
function salesValue(r){return parseMoney(r["Sales Value"] ?? r["Sales Amount"] ?? r.SalesValue ?? r.SalesAmount ?? r.Amount ?? r.amount ?? r["Invoice Amount"] ?? r["Bill Amount"] ?? r.Total ?? r.total);}
function receiptValue(r){return parseMoney(r["Bank Amount"] ?? r.BankAmount ?? r["Bank Amount Received"] ?? r["Receipt Amount"] ?? r.ReceiptAmount ?? r["Received Amount"] ?? r["Amount Received"] ?? r.Amount ?? r.amount);}
function salesQty(r){return parseNumber(r.Quantity ?? r.Qty ?? r["Sales Qty"] ?? r["Sold Qty"]);}
function orderQty(r){return parseNumber(r["Order Qty"] ?? r.OrderQty ?? r["Order Quantity"] ?? r.Quantity ?? r.Qty);}

function normSale(r){return {...r,_date:getDate(r),_year:getFY(r),_month:getMonthNo(r),_company:getCompany(r),_party:getParty(r),_invoice:getInvoice(r),_qty:salesQty(r),_amount:salesValue(r)};}
function normReceipt(r){return {...r,_date:getDate(r),_year:getFY(r),_month:getMonthNo(r),_company:getCompany(r),_party:getParty(r),_amount:receiptValue(r)};}
function normOrder(r){return {...r,_date:getDate(r),_year:getFY(r),_month:getMonthNo(r),_company:getCompany(r),_party:getParty(r),_qty:orderQty(r)};}

function applyFilters(rows){
  return rows.filter(r =>
    (state.filters.year === "ALL" || getFY(r) === state.filters.year) &&
    (state.filters.month === "ALL" || String(getMonthNo(r)) === String(state.filters.month)) &&
    (state.filters.company === "ALL" || getCompany(r) === state.filters.company) &&
    (state.filters.party === "ALL" || getParty(r) === state.filters.party)
  );
}

function setStatus(text, live=true){
  const el=$("statusText");
  if(el) el.textContent=text;
  const dot=document.querySelector(".dot");
  if(dot) dot.style.background=live ? "#14804a" : "#9ca3af";
}
function updateTimestamp(){
  const el=$("lastUpdated");
  if(el && state.lastUpdated) el.textContent="Updated " + state.lastUpdated.toLocaleString("en-IN");
}

function populateFilters(){
  const all=[...state.data.sales,...state.data.receipts,...state.data.orders];
  const unique=a=>[...new Set(a.filter(Boolean).map(String))].sort((x,y)=>x.localeCompare(y,undefined,{numeric:true}));
  const years=unique(all.map(getFY)), companies=unique(all.map(getCompany)), parties=unique(all.map(getParty));
  fillSelect("yearFilter",years,"All Years");
  fillSelect("companyFilter",companies,"All Companies");
  fillSelect("partyFilter",parties,"All Parties");
  const months=[[1,"January"],[2,"February"],[3,"March"],[4,"April"],[5,"May"],[6,"June"],[7,"July"],[8,"August"],[9,"September"],[10,"October"],[11,"November"],[12,"December"]];
  const m=$("monthFilter"); if(m)m.innerHTML='<option value="ALL">All Months</option>'+months.map(([n,name])=>`<option value="${n}">${name}</option>`).join("");
  ["yearFilter","monthFilter","companyFilter","partyFilter"].forEach(id=>{const el=$(id); if(el)el.value=state.filters[id.replace("Filter","")];});
}
function fillSelect(id,values,allLabel){const el=$(id);if(!el)return;el.innerHTML=`<option value="ALL">${allLabel}</option>`+values.map(v=>`<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join("");}

async function fetchLiveData(){
  state.loading=true;
  setStatus("Loading data…",false);
  try{
    const res=await fetch(API_URL+"?t="+Date.now(),{cache:"no-store"});
    if(!res.ok) throw new Error("HTTP "+res.status);
    const json=await res.json();
    if(json.status!=="success") throw new Error(json.message||"API error");
    state.data.sales=(json.sales||json["Sales Data"]||[]).map(normSale);
    state.data.receipts=(json.receipts||json["Receipts Data"]||json["Receipt Data"]||[]).map(normReceipt);
    state.data.orders=(json.orders||json["Order Data"]||[]).map(normOrder);
    state.lastUpdated=new Date();
    localStorage.setItem(CACHE_KEY,JSON.stringify({sales:json.sales||[],receipts:json.receipts||[],orders:json.orders||[]}));
    localStorage.setItem(CACHE_TIME_KEY,state.lastUpdated.toISOString());
    populateFilters(); renderAll(); setStatus("Live data connected",true); updateTimestamp();
    return true;
  }catch(e){
    console.error(e);
    if(loadCache()){populateFilters();renderAll();setStatus("Using cached data",false);updateTimestamp();}
    else setStatus("Unable to load data",false);
    return false;
  }finally{state.loading=false;}
}
function loadCache(){
  try{
    const x=JSON.parse(localStorage.getItem(CACHE_KEY)||"null"); if(!x)return false;
    state.data.sales=(x.sales||[]).map(normSale); state.data.receipts=(x.receipts||[]).map(normReceipt); state.data.orders=(x.orders||[]).map(normOrder);
    const t=localStorage.getItem(CACHE_TIME_KEY); state.lastUpdated=t?new Date(t):null; return true;
  }catch(e){return false;}
}

function renderHome(){
  const s=applyFilters(state.data.sales), r=applyFilters(state.data.receipts), o=applyFilters(state.data.orders);
  $("salesTotal").textContent=money(s.reduce((a,x)=>a+x._amount,0));
  $("receiptTotal").textContent=money(r.reduce((a,x)=>a+x._amount,0));
  const oq=o.reduce((a,x)=>a+x._qty,0), sq=s.reduce((a,x)=>a+x._qty,0);
  $("orderTotal").textContent=qty(oq); $("pendingTotal").textContent=qty(Math.max(0,oq-sq));
  renderChart(s);
}
function renderChart(rows){
  const c=$("salesChart"); if(!c)return; const ctx=c.getContext("2d"), w=c.clientWidth||600,h=180,dpr=devicePixelRatio||1;c.width=w*dpr;c.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
  const months=["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"], vals=Array(12).fill(0);
  rows.forEach(r=>{const m=getMonthNo(r);if(m){const i=m>=4?m-4:m+8; vals[i]+=r._amount;}}); const max=Math.max(...vals,1); const pad=18, bw=(w-pad*2)/12*0.62;
  ctx.font="10px -apple-system, sans-serif";ctx.fillStyle="#6b7280";
  vals.forEach((v,i)=>{const x=pad+i*(w-pad*2)/12+((w-pad*2)/12-bw)/2;const bh=(v/max)*(h-42);ctx.fillStyle="#111827";ctx.fillRect(x,h-25-bh,bw,bh);ctx.fillStyle="#6b7280";ctx.fillText(months[i],x,h-8);});
}
function renderSales(){
  const rows=applyFilters(state.data.sales); $("salesCount").textContent=rows.length+" bills"; const el=$("salesList");
  el.innerHTML=rows.length?rows.slice().sort((a,b)=>b._date.localeCompare(a._date)).map(r=>`<div class="listrow"><div class="line1"><span>${escapeHTML(r._party||"—")}</span><span class="amount">${money(r._amount)}</span></div><div class="line2">${escapeHTML(r._date)} · ${escapeHTML(r._invoice||"No invoice")} · Qty ${qty(r._qty)} · ${escapeHTML(r._company)}</div></div>`).join(""):"<div class='card empty'>No sales found for selected filters.</div>";
}
function renderReceipts(){
  const rows=applyFilters(state.data.receipts); $("receiptCount").textContent=rows.length+" receipts"; $("receiptScreenTotal").textContent=money(rows.reduce((a,x)=>a+x._amount,0)); const el=$("receiptList");
  el.innerHTML=rows.length?rows.slice().sort((a,b)=>b._date.localeCompare(a._date)).map(r=>`<div class="listrow"><div class="line1"><span>${escapeHTML(r._party||"—")}</span><span class="amount">${money(r._amount)}</span></div><div class="line2">${escapeHTML(r._date)} · ${escapeHTML(r["Receipt No"]||r.ReceiptNo||r["Voucher No"]||"")} · ${escapeHTML(r._company)}</div></div>`).join(""):"<div class='card empty'>No receipts found for selected filters.</div>";
}
function renderOrders(){
  const el=$("orderList"), empty=$("ordersEmpty"), orders=applyFilters(state.data.orders), sales=applyFilters(state.data.sales), map={};
  orders.forEach(r=>{const p=getParty(r)||"Unknown Party";(map[p]??={order:0,sold:0}).order+=r._qty;}); sales.forEach(r=>{const p=getParty(r)||"Unknown Party";(map[p]??={order:0,sold:0}).sold+=r._qty;});
  const rows=Object.entries(map).map(([party,x])=>({party,...x,pending:Math.max(0,x.order-x.sold)})).sort((a,b)=>b.pending-a.pending);
  empty.style.display=rows.length?"none":"block"; el.innerHTML=rows.map(x=>`<div class="listrow"><div class="line1"><span>${escapeHTML(x.party)}</span><span class="amount">${qty(x.pending)}</span></div><div class="line2">Order ${qty(x.order)} · Sold ${qty(x.sold)} · Pending ${qty(x.pending)}</div></div>`).join("");
}
function renderSettings(){const api=$("apiUrl");if(api)api.value=API_URL;}
function renderAll(){renderHome();renderSales();renderReceipts();renderOrders();renderSettings();}

function showScreen(name){
  document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active",s.id===name));
  document.querySelectorAll(".tabbar .tab").forEach(b=>b.classList.toggle("active",b.dataset.screen===name));
  window.scrollTo({top:0,behavior:"smooth"});
}
function setupEvents(){
  document.querySelectorAll(".tabbar .tab").forEach(b=>b.addEventListener("click",()=>showScreen(b.dataset.screen)));
  ["year","month","company","party"].forEach(k=>{const el=$(k+"Filter");if(el)el.addEventListener("change",()=>{state.filters[k]=el.value;renderAll();});});
  $("refreshBtn")?.addEventListener("click",()=>fetchLiveData());
  $("syncBtn")?.addEventListener("click",()=>fetchLiveData());
  $("saveUrl")?.addEventListener("click",()=>{const v=clean($("apiUrl")?.value);if(v){localStorage.setItem("jaysons_api_url",v);setStatus("URL saved — refresh to connect",true);}});
}

async function init(){
  setupEvents();
  loadCache();
  populateFilters();
  renderAll();
  if(state.lastUpdated)updateTimestamp();
  await fetchLiveData();
}

document.addEventListener("DOMContentLoaded",init);

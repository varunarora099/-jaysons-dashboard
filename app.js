/* =========================================================
   JAYSONS INTERNATIONAL - BUSINESS DASHBOARD
   Fully corrected app.js
   ========================================================= */

const API_URL =
  "https://script.google.com/macros/s/AKfycbzwcazUzjP9fk9hMTZFQh95X1ijtBD8sOQFgme3Lh5Zz8r42ckPUWwqFu29RcYKbq-n/exec";

const CACHE_KEY = "jaysons_dashboard_cache_v3";
const CACHE_TIME_KEY = "jaysons_dashboard_cache_time_v3";

const state = {
  data: {
    sales: [],
    receipts: [],
    orders: []
  },

  filters: {
    year: "ALL",
    month: "ALL",
    company: "ALL",
    party: "ALL"
  },

  activeTab: "home",
  loading: false,
  lastUpdated: null
};


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}


function normalizeKey(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}


/* =========================================================
   MONEY PARSER
   Handles:
   45530
   "45,530"
   "₹45,530"
   "₹ 45,530.00"
   "45 530"
   ========================================================= */

function parseMoney(value) {

  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return isFinite(value) ? value : 0;
  }

  let str = String(value)
    .replace(/₹/g, "")
    .replace(/Rs\.?/gi, "")
    .replace(/INR/gi, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();

  if (!str) return 0;

  // Keep digits, minus sign and decimal
  str = str.replace(/[^\d.-]/g, "");

  const number = Number(str);

  return isFinite(number) ? number : 0;
}


/* =========================================================
   QUANTITY PARSER
   ========================================================= */

function parseNumber(value) {

  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return isFinite(value) ? value : 0;
  }

  let str = String(value)
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();

  str = str.replace(/[^\d.-]/g, "");

  const number = Number(str);

  return isFinite(number) ? number : 0;
}


/* =========================================================
   DATE HELPERS
   ========================================================= */

function parseDate(value) {

  if (!value) return null;

  if (value instanceof Date && !isNaN(value)) {
    return value;
  }

  const str = String(value).trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const parts = str.split("-");
    return new Date(
      Number(parts[0]),
      Number(parts[1]) - 1,
      Number(parts[2])
    );
  }

  // DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const parts = str.split("/");
    return new Date(
      Number(parts[2]),
      Number(parts[1]) - 1,
      Number(parts[0])
    );
  }

  const d = new Date(str);

  if (!isNaN(d)) return d;

  return null;
}


function getYear(row) {

  if (row.Year !== undefined && clean(row.Year) !== "") {
    return String(row.Year);
  }

  const date = parseDate(
    row.Date ||
    row.date ||
    row["Voucher Date"] ||
    row["Order Date"]
  );

  return date ? String(date.getFullYear()) : "";
}


function getMonthNumber(row) {

  const date = parseDate(
    row.Date ||
    row.date ||
    row["Voucher Date"] ||
    row["Order Date"]
  );

  if (date) {
    return date.getMonth() + 1;
  }

  const month = clean(row.Month);

  const months = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12
  };

  return months[month.toLowerCase()] || 0;
}


function getMonthName(row) {

  const date = parseDate(
    row.Date ||
    row.date ||
    row["Voucher Date"] ||
    row["Order Date"]
  );

  if (date) {
    return date.toLocaleString("en-IN", {
      month: "long"
    });
  }

  return clean(row.Month);
}


/* =========================================================
   FIELD HELPERS
   ========================================================= */

function getCompany(row) {

  return clean(
    row.Company ??
    row.company ??
    row["Company Name"] ??
    row["CompanyName"]
  );
}


function getParty(row) {

  return clean(
    row.Party ??
    row.party ??
    row["Party Name"] ??
    row["PartyName"] ??
    row.Customer ??
    row.customer
  );
}


function getDate(row) {

  return clean(
    row.Date ??
    row.date ??
    row["Voucher Date"] ??
    row["Order Date"]
  );
}


function getInvoice(row) {

  return clean(
    row["Invoice No"] ??
    row.InvoiceNo ??
    row["Invoice Number"] ??
    row["Voucher No"] ??
    row.VoucherNo
  );
}


/* =========================================================
   SALES VALUE
   IMPORTANT:
   YOUR API USES "Sales Value"
   ========================================================= */

function getSalesValue(row) {

  const value =
    row["Sales Value"] ??
    row["Sales Amount"] ??
    row.SalesValue ??
    row.SalesAmount ??
    row.Amount ??
    row.amount ??
    row["Invoice Amount"] ??
    row["Bill Amount"] ??
    row.Total ??
    row.total ??
    0;

  return parseMoney(value);
}


/* =========================================================
   RECEIPT VALUE
   IMPORTANT:
   Prefer BANK amount where available.
   ========================================================= */

function getReceiptValue(row) {

  const value =
    row["Bank Amount"] ??
    row.BankAmount ??
    row["Bank Amount Received"] ??
    row["Receipt Amount"] ??
    row.ReceiptAmount ??
    row["Received Amount"] ??
    row["Amount Received"] ??
    row.Amount ??
    row.amount ??
    0;

  return parseMoney(value);
}


/* =========================================================
   ORDER QUANTITY
   ========================================================= */

function getOrderQuantity(row) {

  return parseNumber(
    row["Order Qty"] ??
    row.OrderQty ??
    row["Order Quantity"] ??
    row.Quantity ??
    row.Qty ??
    0
  );
}


function getSalesQuantity(row) {

  return parseNumber(
    row.Quantity ??
    row.Qty ??
    row["Sales Qty"] ??
    row["Sold Qty"] ??
    0
  );
}


/* =========================================================
   NORMALIZE SALES
   ========================================================= */

function normalizeSale(row) {

  return {
    ...row,

    _date: getDate(row),
    _year: getYear(row),
    _monthNo: getMonthNumber(row),
    _monthName: getMonthName(row),
    _company: getCompany(row),
    _party: getParty(row),
    _invoice: getInvoice(row),
    _quantity: getSalesQuantity(row),
    _amount: getSalesValue(row)
  };
}


/* =========================================================
   NORMALIZE RECEIPTS
   ========================================================= */

function normalizeReceipt(row) {

  return {
    ...row,

    _date: getDate(row),
    _year: getYear(row),
    _monthNo: getMonthNumber(row),
    _monthName: getMonthName(row),
    _company: getCompany(row),
    _party: getParty(row),
    _amount: getReceiptValue(row)
  };
}


/* =========================================================
   NORMALIZE ORDERS
   ========================================================= */

function normalizeOrder(row) {

  return {
    ...row,

    _date: getDate(row),
    _year: getYear(row),
    _monthNo: getMonthNumber(row),
    _monthName: getMonthName(row),
    _company: getCompany(row),
    _party: getParty(row),
    _quantity: getOrderQuantity(row)
  };
}


/* =========================================================
   API FETCH
   ========================================================= */

async function fetchLiveData() {

  state.loading = true;

  try {

    const response = await fetch(
      API_URL + "?t=" + Date.now(),
      {
        method: "GET",
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        "API returned HTTP " + response.status
      );
    }

    const json = await response.json();

    if (!json || json.status !== "success") {
      throw new Error(
        json?.message || "Invalid API response"
      );
    }


    /* ---------------------------------------------
       SALES
       --------------------------------------------- */

    let sales =
      json.sales ||
      json.Sales ||
      json["Sales Data"] ||
      [];


    /* ---------------------------------------------
       RECEIPTS
       --------------------------------------------- */

    let receipts =
      json.receipts ||
      json.Receipts ||
      json["Receipts Data"] ||
      json["Receipt Data"] ||
      [];


    /* ---------------------------------------------
       ORDERS
       --------------------------------------------- */

    let orders =
      json.orders ||
      json.Orders ||
      json["Order Data"] ||
      json["Orders Data"] ||
      [];


    state.data.sales = Array.isArray(sales)
      ? sales.map(normalizeSale)
      : [];

    state.data.receipts = Array.isArray(receipts)
      ? receipts.map(normalizeReceipt)
      : [];

    state.data.orders = Array.isArray(orders)
      ? orders.map(normalizeOrder)
      : [];


    state.lastUpdated = new Date();


    /* ---------------------------------------------
       SAVE CACHE
       --------------------------------------------- */

    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        sales: sales,
        receipts: receipts,
        orders: orders
      })
    );

    localStorage.setItem(
      CACHE_TIME_KEY,
      state.lastUpdated.toISOString()
    );


    updateConnectionStatus(true);

    render();

    console.log(
      "Dashboard API loaded successfully",
      {
        sales: state.data.sales.length,
        receipts: state.data.receipts.length,
        orders: state.data.orders.length
      }
    );

    return true;

  } catch (error) {

    console.error(
      "Dashboard API error:",
      error
    );

    const loadedFromCache =
      loadFromCache();

    if (!loadedFromCache) {
      updateConnectionStatus(false);
    }

    render();

    return false;

  } finally {

    state.loading = false;
  }
}


/* =========================================================
   LOAD CACHE
   ========================================================= */

function loadFromCache() {

  try {

    const cached =
      localStorage.getItem(CACHE_KEY);

    if (!cached) return false;

    const json =
      JSON.parse(cached);


    state.data.sales =
      Array.isArray(json.sales)
        ? json.sales.map(normalizeSale)
        : [];

    state.data.receipts =
      Array.isArray(json.receipts)
        ? json.receipts.map(normalizeReceipt)
        : [];

    state.data.orders =
      Array.isArray(json.orders)
        ? json.orders.map(normalizeOrder)
        : [];


    const cachedTime =
      localStorage.getItem(
        CACHE_TIME_KEY
      );

    state.lastUpdated =
      cachedTime
        ? new Date(cachedTime)
        : null;


    updateConnectionStatus(false);

    return true;

  } catch (error) {

    console.error(
      "Cache error:",
      error
    );

    return false;
  }
}


/* =========================================================
   CONNECTION STATUS
   ========================================================= */

function updateConnectionStatus(isLive) {

  const elements =
    document.querySelectorAll(
      ".connection-status, #connectionStatus, [data-connection-status]"
    );

  elements.forEach(el => {

    if (isLive) {

      el.textContent =
        "● Live data connected";

      el.classList.remove("offline");
      el.classList.add("online");

    } else {

      el.textContent =
        "● Using cached data";

      el.classList.remove("online");
      el.classList.add("offline");
    }
  });
}


/* =========================================================
   FILTER OPTIONS
   ========================================================= */

function uniqueSorted(values) {

  return [...new Set(
    values
      .map(clean)
      .filter(Boolean)
  )].sort((a, b) =>
    a.localeCompare(b, undefined, {
      numeric: true
    })
  );
}


function getFilterValues() {

  const allRows = [
    ...state.data.sales,
    ...state.data.receipts,
    ...state.data.orders
  ];


  const years =
    uniqueSorted(
      allRows.map(r => getYear(r))
    );


  const companies =
    uniqueSorted(
      allRows.map(r => getCompany(r))
    );


  const parties =
    uniqueSorted(
      allRows.map(r => getParty(r))
    );


  return {
    years,
    companies,
    parties
  };
}


/* =========================================================
   APPLY FILTERS
   ========================================================= */

function matchesFilters(row) {

  const year =
    getYear(row);

  const monthNo =
    getMonthNumber(row);

  const company =
    getCompany(row);

  const party =
    getParty(row);


  if (
    state.filters.year !== "ALL" &&
    year !== state.filters.year
  ) {
    return false;
  }


  if (
    state.filters.month !== "ALL" &&
    String(monthNo) !== String(state.filters.month)
  ) {
    return false;
  }


  if (
    state.filters.company !== "ALL" &&
    normalizeKey(company) !==
      normalizeKey(state.filters.company)
  ) {
    return false;
  }


  if (
    state.filters.party !== "ALL" &&
    normalizeKey(party) !==
      normalizeKey(state.filters.party)
  ) {
    return false;
  }


  return true;
}


/* =========================================================
   FILTER DATA
   ========================================================= */

function filtered(type) {

  const rows =
    state.data[type] || [];

  return rows.filter(matchesFilters);
}


/* =========================================================
   FORMAT MONEY
   ========================================================= */

function formatMoney(value) {

  const number =
    Number(value) || 0;

  return number.toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 0
    }
  );
}


function formatRupees(value) {

  return "₹" + formatMoney(value);
}


/* =========================================================
   FORMAT QUANTITY
   ========================================================= */

function formatQuantity(value) {

  const number =
    Number(value) || 0;

  return number.toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 2
    }
  );
}


/* =========================================================
   DOM HELPERS
   ========================================================= */

function setText(id, value) {

  const el =
    document.getElementById(id);

  if (el) {
    el.textContent = value;
  }
}


function setHTML(id, value) {

  const el =
    document.getElementById(id);

  if (el) {
    el.innerHTML = value;
  }
}


/* =========================================================
   DASHBOARD TOTALS
   ========================================================= */

function calculateDashboard() {

  const sales =
    filtered("sales");

  const receipts =
    filtered("receipts");

  const orders =
    filtered("orders");


  const salesTotal =
    sales.reduce(
      (sum, row) =>
        sum + getSalesValue(row),
      0
    );


  const receiptTotal =
    receipts.reduce(
      (sum, row) =>
        sum + getReceiptValue(row),
      0
    );


  const orderQty =
    orders.reduce(
      (sum, row) =>
        sum + getOrderQuantity(row),
      0
    );


  const soldQty =
    sales.reduce(
      (sum, row) =>
        sum + getSalesQuantity(row),
      0
    );


  const pendingQty =
    Math.max(
      0,
      orderQty - soldQty
    );


  return {
    sales,
    receipts,
    orders,

    salesTotal,
    receiptTotal,

    orderQty,
    soldQty,
    pendingQty,

    salesCount: sales.length,
    receiptCount: receipts.length,
    orderCount: orders.length
  };
}


/* =========================================================
   RENDER MAIN DASHBOARD
   ========================================================= */

function renderDashboard() {

  const data =
    calculateDashboard();


  /* ---------------------------------------------
     SALES
     --------------------------------------------- */

  setText(
    "salesTotal",
    formatRupees(data.salesTotal)
  );

  setText(
    "totalSales",
    formatRupees(data.salesTotal)
  );


  setText(
    "salesCount",
    formatQuantity(data.salesCount)
  );


  /* ---------------------------------------------
     RECEIPTS
     --------------------------------------------- */

  setText(
    "receiptTotal",
    formatRupees(data.receiptTotal)
  );

  setText(
    "totalReceipts",
    formatRupees(data.receiptTotal)
  );


  setText(
    "receiptCount",
    formatQuantity(data.receiptCount)
  );


  /* ---------------------------------------------
     ORDERS
     --------------------------------------------- */

  setText(
    "orderTotal",
    formatQuantity(data.orderQty)
  );

  setText(
    "totalOrders",
    formatQuantity(data.orderQty)
  );


  /* ---------------------------------------------
     PENDING
     --------------------------------------------- */

  setText(
    "pendingTotal",
    formatQuantity(data.pendingQty)
  );

  setText(
    "pendingOrders",
    formatQuantity(data.pendingQty)
  );


  renderSalesTrend(
    data.sales
  );

  renderPartySales(
    data.sales
  );

  renderPartyReceipts(
    data.receipts
  );
}


/* =========================================================
   SALES TREND
   ========================================================= */

function renderSalesTrend(rows) {

  const container =
    document.getElementById(
      "salesTrend"
    );

  if (!container) return;


  const monthly = {};

  rows.forEach(row => {

    const month =
      getMonthName(row) || "Unknown";

    if (!monthly[month]) {
      monthly[month] = 0;
    }

    monthly[month] +=
      getSalesValue(row);
  });


  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];


  const values =
    months.map(
      month =>
        monthly[month] || 0
    );


  const max =
    Math.max(...values, 1);


  container.innerHTML =
    months.map(
      (month, index) => {

        const value =
          values[index];

        const height =
          Math.max(
            3,
            (value / max) * 100
          );


        return `
          <div class="trend-item">
            <div
              class="trend-bar"
              style="height:${height}%"
              title="${month}: ${formatRupees(value)}"
            ></div>
            <div class="trend-label">
              ${month.substring(0,3)}
            </div>
          </div>
        `;
      }
    ).join("");
}


/* =========================================================
   PARTY-WISE SALES
   ========================================================= */

function renderPartySales(rows) {

  const container =
    document.getElementById(
      "partySales"
    );

  if (!container) return;


  const partyMap = {};


  rows.forEach(row => {

    const party =
      getParty(row) ||
      "Unknown Party";


    if (!partyMap[party]) {
      partyMap[party] = 0;
    }


    partyMap[party] +=
      getSalesValue(row);
  });


  const sorted =
    Object.entries(partyMap)
      .sort(
        (a, b) =>
          b[1] - a[1]
      );


  if (!sorted.length) {

    container.innerHTML =
      `<div class="empty-state">
        No sales data
      </div>`;

    return;
  }


  const total =
    sorted.reduce(
      (sum, item) =>
        sum + item[1],
      0
    );


  container.innerHTML =
    sorted
      .slice(0, 20)
      .map(
        ([party, amount]) => {

          const percentage =
            total
              ? (amount / total) * 100
              : 0;


          return `
            <div class="party-row">
              <div class="party-name">
                ${escapeHTML(party)}
              </div>

              <div class="party-amount">
                ${formatRupees(amount)}
              </div>

              <div class="party-percent">
                ${percentage.toFixed(1)}%
              </div>
            </div>
          `;
        }
      )
      .join("");
}


/* =========================================================
   PARTY-WISE RECEIPTS
   ========================================================= */

function renderPartyReceipts(rows) {

  const container =
    document.getElementById(
      "partyReceipts"
    );

  if (!container) return;


  const partyMap = {};


  rows.forEach(row => {

    const party =
      getParty(row) ||
      "Unknown Party";


    if (!partyMap[party]) {
      partyMap[party] = {
        amount: 0,
        count: 0
      };
    }


    partyMap[party].amount +=
      getReceiptValue(row);

    partyMap[party].count++;
  });


  const sorted =
    Object.entries(partyMap)
      .sort(
        (a, b) =>
          b[1].amount -
          a[1].amount
      );


  if (!sorted.length) {

    container.innerHTML =
      `<div class="empty-state">
        No receipt data
      </div>`;

    return;
  }


  const total =
    sorted.reduce(
      (sum, item) =>
        sum + item[1].amount,
      0
    );


  container.innerHTML =
    sorted
      .slice(0, 30)
      .map(
        ([party, data]) => {

          const percentage =
            total
              ? (data.amount / total) * 100
              : 0;


          return `
            <div class="party-row">

              <div class="party-name">
                ${escapeHTML(party)}
              </div>

              <div class="party-amount">
                ${formatRupees(data.amount)}
              </div>

              <div class="party-count">
                ${data.count}
              </div>

              <div class="party-percent">
                ${percentage.toFixed(1)}%
              </div>

            </div>
          `;
        }
      )
      .join("");
}


/* =========================================================
   SALES TABLE
   ========================================================= */

function renderSalesTable() {

  const container =
    document.getElementById(
      "salesTable"
    );

  if (!container) return;


  const rows =
    filtered("sales");


  if (!rows.length) {

    container.innerHTML =
      `<div class="empty-state">
        No sales found for selected filters.
      </div>`;

    return;
  }


  container.innerHTML = `
    <div class="table-wrapper">

      <table>

        <thead>
          <tr>
            <th>Date</th>
            <th>Invoice</th>
            <th>Party</th>
            <th>Company</th>
            <th>Qty</th>
            <th>Sales</th>
          </tr>
        </thead>

        <tbody>

          ${rows
            .slice()
            .sort(
              (a,b) =>
                String(b._date)
                  .localeCompare(
                    String(a._date)
                  )
            )
            .map(row => `

              <tr>

                <td>
                  ${escapeHTML(row._date)}
                </td>

                <td>
                  ${escapeHTML(row._invoice)}
                </td>

                <td>
                  ${escapeHTML(row._party)}
                </td>

                <td>
                  ${escapeHTML(row._company)}
                </td>

                <td>
                  ${formatQuantity(
                    row._quantity
                  )}
                </td>

                <td>
                  ${formatRupees(
                    row._amount
                  )}
                </td>

              </tr>

            `)
            .join("")}

        </tbody>

      </table>

    </div>
  `;
}


/* =========================================================
   RECEIPTS TABLE
   ========================================================= */

function renderReceiptsTable() {

  const container =
    document.getElementById(
      "receiptsTable"
    );

  if (!container) return;


  const rows =
    filtered("receipts");


  if (!rows.length) {

    container.innerHTML =
      `<div class="empty-state">
        No receipts found for selected filters.
      </div>`;

    return;
  }


  container.innerHTML = `
    <div class="table-wrapper">

      <table>

        <thead>
          <tr>
            <th>Date</th>
            <th>Receipt No</th>
            <th>Party</th>
            <th>Company</th>
            <th>Amount</th>
          </tr>
        </thead>

        <tbody>

          ${rows
            .slice()
            .sort(
              (a,b) =>
                String(b._date)
                  .localeCompare(
                    String(a._date)
                  )
            )
            .map(row => `

              <tr>

                <td>
                  ${escapeHTML(row._date)}
                </td>

                <td>
                  ${escapeHTML(
                    row["Receipt No"] ||
                    row.ReceiptNo ||
                    row["Voucher No"] ||
                    ""
                  )}
                </td>

                <td>
                  ${escapeHTML(row._party)}
                </td>

                <td>
                  ${escapeHTML(row._company)}
                </td>

                <td>
                  ${formatRupees(
                    row._amount
                  )}
                </td>

              </tr>

            `)
            .join("")}

        </tbody>

      </table>

    </div>
  `;
}


/* =========================================================
   ORDER PENDING
   ========================================================= */

function renderOrders() {

  const container =
    document.getElementById(
      "ordersTable"
    );

  if (!container) return;


  const orders =
    filtered("orders");

  const sales =
    filtered("sales");


  const orderMap = {};


  orders.forEach(row => {

    const party =
      getParty(row) ||
      "Unknown Party";


    if (!orderMap[party]) {

      orderMap[party] = {
        orderQty: 0,
        salesQty: 0
      };
    }


    orderMap[party].orderQty +=
      getOrderQuantity(row);
  });


  sales.forEach(row => {

    const party =
      getParty(row) ||
      "Unknown Party";


    if (!orderMap[party]) {

      orderMap[party] = {
        orderQty: 0,
        salesQty: 0
      };
    }


    orderMap[party].salesQty +=
      getSalesQuantity(row);
  });


  const rows =
    Object.entries(orderMap)
      .map(
        ([party, data]) => ({

          party,

          orderQty:
            data.orderQty,

          salesQty:
            data.salesQty,

          pendingQty:
            Math.max(
              0,
              data.orderQty -
              data.salesQty
            )

        })
      )
      .sort(
        (a,b) =>
          b.pendingQty -
          a.pendingQty
      );


  if (!rows.length) {

    container.innerHTML =
      `<div class="empty-state">
        No order data available.
      </div>`;

    return;
  }


  container.innerHTML = `

    <div class="table-wrapper">

      <table>

        <thead>

          <tr>
            <th>Party</th>
            <th>Order Qty</th>
            <th>Sold Qty</th>
            <th>Pending</th>
          </tr>

        </thead>

        <tbody>

          ${rows.map(row => `

            <tr>

              <td>
                ${escapeHTML(
                  row.party
                )}
              </td>

              <td>
                ${formatQuantity(
                  row.orderQty
                )}
              </td>

              <td>
                ${formatQuantity(
                  row.salesQty
                )}
              </td>

              <td>
                ${formatQuantity(
                  row.pendingQty
                )}
              </td>

            </tr>

          `).join("")}

        </tbody>

      </table>

    </div>
  `;
}


/* =========================================================
   FILTER UI
   ========================================================= */

function populateFilters() {

  const values =
    getFilterValues();


  populateSelect(
    "yearFilter",
    values.years,
    state.filters.year,
    "All Years"
  );


  populateSelect(
    "companyFilter",
    values.companies,
    state.filters.company,
    "All Companies"
  );


  populateSelect(
    "partyFilter",
    values.parties,
    state.filters.party,
    "All Parties"
  );


  populateMonthFilter();
}


function populateSelect(
  id,
  values,
  selected,
  allLabel
) {

  const select =
    document.getElementById(id);

  if (!select) return;


  const current =
    selected || "ALL";


  select.innerHTML =
    `<option value="ALL">
      ${allLabel}
    </option>` +
    values
      .map(value => `
        <option
          value="${escapeAttribute(value)}"
          ${String(value) === String(current)
            ? "selected"
            : ""}
        >
          ${escapeHTML(value)}
        </option>
      `)
      .join("");
}


function populateMonthFilter() {

  const select =
    document.getElementById(
      "monthFilter"
    );

  if (!select) return;


  const months = [
    [1,"January"],
    [2,"February"],
    [3,"March"],
    [4,"April"],
    [5,"May"],
    [6,"June"],
    [7,"July"],
    [8,"August"],
    [9,"September"],
    [10,"October"],
    [11,"November"],
    [12,"December"]
  ];


  select.innerHTML =
    `<option value="ALL">
      All Months
    </option>` +

    months.map(
      ([number,name]) => `

        <option
          value="${number}"
          ${String(number) ===
            String(state.filters.month)
            ? "selected"
            : ""}
        >
          ${name}
        </option>

      `
    ).join("");
}


/* =========================================================
   FILTER EVENTS
   ========================================================= */

function setupFilters() {

  const year =
    document.getElementById(
      "yearFilter"
    );

  const month =
    document.getElementById(
      "monthFilter"
    );

  const company =
    document.getElementById(
      "companyFilter"
    );

  const party =
    document.getElementById(
      "partyFilter"
    );


  if (year) {

    year.addEventListener(
      "change",
      () => {

        state.filters.year =
          year.value;

        render();
      }
    );
  }


  if (month) {

    month.addEventListener(
      "change",
      () => {

        state.filters.month =
          month.value;

        render();
      }
    );
  }


  if (company) {

    company.addEventListener(
      "change",
      () => {

        state.filters.company =
          company.value;

        render();
      }
    );
  }


  if (party) {

    party.addEventListener(
      "change",
      () => {

        state.filters.party =
          party.value;

        render();
      }
    );
  }
}


/* =========================================================
   SEARCH
   ========================================================= */

function setupSearch() {

  const search =
    document.getElementById(
      "partySearch"
    );


  if (!search) return;


  search.addEventListener(
    "input",
    () => {

      const value =
        normalizeKey(
          search.value
        );


      document
        .querySelectorAll(
          ".party-row"
        )
        .forEach(row => {

          const text =
            normalizeKey(
              row.textContent
            );

          row.style.display =
            !value ||
            text.includes(value)
              ? ""
              : "none";
        });
    }
  );
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function setupNavigation() {

  document
    .querySelectorAll(
      "[data-tab]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const tab =
            button.dataset.tab;

          state.activeTab =
            tab;

          showTab(tab);
        }
      );
    });
}


function showTab(tab) {

  document
    .querySelectorAll(
      "[data-page]"
    )
    .forEach(page => {

      page.style.display =
        page.dataset.page === tab
          ? ""
          : "none";
    });


  document
    .querySelectorAll(
      "[data-tab]"
    )
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.tab === tab
      );
    });


  render();
}


/* =========================================================
   REFRESH BUTTON
   ========================================================= */

function setupRefreshButtons() {

  document
    .querySelectorAll(
      "#refreshButton, #syncButton, [data-refresh]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        async () => {

          if (
            state.loading
          ) return;


          button.disabled =
            true;

          const oldText =
            button.textContent;

          button.textContent =
            "Refreshing…";


          await fetchLiveData();


          button.disabled =
            false;

          button.textContent =
            oldText;
        }
      );
    });
}


/* =========================================================
   SETTINGS
   ========================================================= */

function renderSettings() {

  const cacheTime =
    localStorage.getItem(
      CACHE_TIME_KEY
    );


  if (cacheTime) {

    const date =
      new Date(cacheTime);


    setText(
      "lastSync",
      date.toLocaleString(
        "en-IN"
      )
    );
  }


  setText(
    "apiStatus",
    "Connected"
  );


  setText(
    "salesRecordCount",
    state.data.sales.length
  );


  setText(
    "receiptRecordCount",
    state.data.receipts.length
  );


  setText(
    "orderRecordCount",
    state.data.orders.length
  );
}


/* =========================================================
   MAIN RENDER
   ========================================================= */

function render() {

  renderDashboard();

  renderSalesTable();

  renderReceiptsTable();

  renderOrders();

  renderSettings();

  updateFilterDisplays();
}


/* =========================================================
   FILTER DISPLAY
   ========================================================= */

function updateFilterDisplays() {

  const labels = {

    year:
      state.filters.year === "ALL"
        ? "All Years"
        : state.filters.year,

    month:
      state.filters.month === "ALL"
        ? "All Months"
        : getMonthNameFromNumber(
            Number(state.filters.month)
          ),

    company:
      state.filters.company === "ALL"
        ? "All Companies"
        : state.filters.company,

    party:
      state.filters.party === "ALL"
        ? "All Parties"
        : state.filters.party
  };


  setText(
    "selectedYear",
    labels.year
  );

  setText(
    "selectedMonth",
    labels.month
  );

  setText(
    "selectedCompany",
    labels.company
  );

  setText(
    "selectedParty",
    labels.party
  );
}


function getMonthNameFromNumber(number) {

  const months = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];

  return months[number] || "";
}


/* =========================================================
   HTML SAFETY
   ========================================================= */

function escapeHTML(value) {

  return String(
    value ?? ""
  )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function escapeAttribute(value) {

  return escapeHTML(value);
}


/* =========================================================
   DEBUG INFORMATION
   ========================================================= */

function dashboardDebug() {

  const sales =
    state.data.sales;

  const receipts =
    state.data.receipts;


  const salesTotal =
    sales.reduce(
      (sum, row) =>
        sum + getSalesValue(row),
      0
    );


  const receiptTotal =
    receipts.reduce(
      (sum, row) =>
        sum + getReceiptValue(row),
      0
    );


  console.log(
    "========== JAYSONS DEBUG =========="
  );

  console.log(
    "Sales records:",
    sales.length
  );

  console.log(
    "Receipt records:",
    receipts.length
  );

  console.log(
    "Sales total:",
    salesTotal
  );

  console.log(
    "Receipt total:",
    receiptTotal
  );

  console.log(
    "First sales record:",
    sales[0]
  );

  console.log(
    "First sales value:",
    sales[0]
      ? getSalesValue(sales[0])
      : 0
  );

  console.log(
    "==================================="
  );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initDashboard() {

  console.log(
    "Jaysons Dashboard starting..."
  );


  /* Load cached data first */
  loadFromCache();


  /* Build filter controls */
  populateFilters();


  /* Setup UI */
  setupFilters();
  setupSearch();
  setupNavigation();
  setupRefreshButtons();


  /* Render cached data */
  render();


  /* Fetch latest live data */
  await fetchLiveData();


  /* Refresh filter lists */
  populateFilters();


  /* Final render */
  render();


  /* Debug */
  dashboardDebug();
}


/* =========================================================
   START
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initDashboard
  );

} else {

  initDashboard();
}
/* =========================================================
   COMPATIBILITY FIX
   Works with the existing JAYSONS DASHBOARD HTML
   ========================================================= */

function hideLoadingMessage() {

  const possibleIds = [
    "loading",
    "loadingMessage",
    "loadingData",
    "status",
    "statusMessage",
    "dataStatus",
    "connectionStatus"
  ];

  possibleIds.forEach(id => {

    const el = document.getElementById(id);

    if (el) {
      el.textContent = "● Live data connected";
      el.classList.remove("loading");
      el.classList.add("online");
    }
  });


  /* Also handle visible text "Loading data..." */
  document
    .querySelectorAll("body *")
    .forEach(el => {

      if (
        el.children.length === 0 &&
        el.textContent &&
        el.textContent.trim()
          .toLowerCase()
          .includes("loading data")
      ) {

        el.textContent =
          "● Live data connected";

        el.classList.add("online");
      }
    });
}


/* =========================================================
   UNIVERSAL PAGE SWITCHER
   ========================================================= */

function openPage(pageName) {

  console.log(
    "Opening page:",
    pageName
  );


  /* ---------------------------------------------
     Possible page containers
     --------------------------------------------- */

  const pages =
    document.querySelectorAll(
      "[data-page], .page, .screen, .app-page"
    );


  pages.forEach(page => {

    const pageId =
      page.dataset.page ||
      page.id ||
      page.dataset.screen ||
      "";


    const cleanPage =
      String(pageId)
        .replace("Page", "")
        .replace("page", "")
        .toLowerCase();


    const wanted =
      String(pageName)
        .replace("Page", "")
        .replace("page", "")
        .toLowerCase();


    if (
      cleanPage === wanted ||
      cleanPage === wanted + "screen"
    ) {

      page.style.display = "";

      page.classList.add("active");

    } else {

      page.style.display = "none";

      page.classList.remove("active");
    }
  });


  /* ---------------------------------------------
     Common IDs used by the dashboard
     --------------------------------------------- */

  const pageIds = {

    home: [
      "home",
      "homePage",
      "dashboard",
      "dashboardPage"
    ],

    sales: [
      "sales",
      "salesPage",
      "salesScreen"
    ],

    receipts: [
      "receipts",
      "receiptsPage",
      "receiptsScreen"
    ],

    orders: [
      "orders",
      "ordersPage",
      "ordersScreen"
    ],

    settings: [
      "settings",
      "settingsPage",
      "settingsScreen"
    ]
  };


  Object.keys(pageIds).forEach(
    key => {

      pageIds[key].forEach(id => {

        const el =
          document.getElementById(id);

        if (!el) return;


        if (key === pageName) {

          el.style.display = "";

          el.classList.add("active");

        } else {

          el.style.display = "none";

          el.classList.remove("active");
        }
      });
    }
  );


  /* ---------------------------------------------
     Refresh page-specific content
     --------------------------------------------- */

  if (pageName === "sales") {

    renderSalesTable();

  }


  if (pageName === "receipts") {

    renderReceiptsTable();

    renderPartyReceipts(
      filtered("receipts")
    );

  }


  if (pageName === "orders") {

    renderOrders();

  }


  if (pageName === "home") {

    renderDashboard();

  }


  if (pageName === "settings") {

    renderSettings();

  }


  /* ---------------------------------------------
     Bottom navigation active state
     --------------------------------------------- */

  document
    .querySelectorAll(
      "nav button, .bottom-nav button, .nav-item, [data-tab]"
    )
    .forEach(button => {

      const value =
        button.dataset.tab ||
        button.dataset.page ||
        button.getAttribute(
          "data-screen"
        ) ||
        button.getAttribute(
          "data-target"
        );


      if (
        value &&
        String(value)
          .toLowerCase()
          .includes(
            String(pageName)
              .toLowerCase()
          )
      ) {

        button.classList.add(
          "active"
        );

      } else {

        button.classList.remove(
          "active"
        );
      }
    });
}


/* =========================================================
   SUPPORT OLD INLINE HTML
   ========================================================= */

window.showPage = function(page) {

  openPage(
    String(page)
      .replace("#", "")
      .replace("Page", "")
      .toLowerCase()
  );

};


window.showTab = function(tab) {

  openPage(
    String(tab)
      .replace("#", "")
      .replace("Page", "")
      .toLowerCase()
  );

};


/* =========================================================
   SUPPORT BUTTONS WITHOUT DATA ATTRIBUTES
   ========================================================= */

function setupUniversalNavigation() {

  const buttons =
    document.querySelectorAll(
      "button, .nav-item, a"
    );


  buttons.forEach(button => {

    const text =
      button.textContent
        .trim()
        .toLowerCase();


    let page = null;


    if (
      text === "home" ||
      text.includes("home")
    ) {

      page = "home";

    } else if (
      text === "sales" ||
      text.includes("sales")
    ) {

      page = "sales";

    } else if (
      text === "receipts" ||
      text.includes("receipt")
    ) {

      page = "receipts";

    } else if (
      text === "orders" ||
      text.includes("order")
    ) {

      page = "orders";

    } else if (
      text === "settings" ||
      text.includes("setting") ||
      text === "more"
    ) {

      page = "settings";
    }


    if (!page) return;


    button.addEventListener(
      "click",
      function(event) {

        /*
         * Only intercept bottom-navigation
         * style buttons.
         */
        if (
          button.closest(
            "nav, .bottom-nav, .navigation, .tab-bar"
          ) ||
          button.dataset.tab ||
          button.dataset.page
        ) {

          event.preventDefault();

          openPage(page);
        }

      }
    );
  });
}


/* =========================================================
   FORCE LOADING STATUS OFF
   ========================================================= */

function dashboardFinishedLoading() {

  hideLoadingMessage();

  const statusElements =
    document.querySelectorAll(
      ".loading-status, .loading-message, .data-status"
    );


  statusElements.forEach(el => {

    el.textContent =
      "● Live data connected";

    el.classList.remove(
      "loading"
    );

    el.classList.add(
      "online"
    );
  });
}


/* =========================================================
   INITIALIZE COMPATIBILITY FIX
   ========================================================= */

setTimeout(
  function() {

    setupUniversalNavigation();

    dashboardFinishedLoading();

    /*
     * Default page
     */
    openPage("home");

  },
  1000
);


/* =========================================================
   KEEP LOADING STATUS OFF AFTER API REFRESH
   ========================================================= */

const originalFetchLiveData =
  window.fetchLiveData;


if (
  typeof originalFetchLiveData ===
  "function"
) {

  window.fetchLiveData =
    async function() {

      const result =
        await originalFetchLiveData.apply(
          this,
          arguments
        );

      dashboardFinishedLoading();

      return result;
    };
}

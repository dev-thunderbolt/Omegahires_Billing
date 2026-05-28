/* ============================================================
   OMEGA HIRES INVOICE BUILDER — APP LOGIC
   ============================================================ */

// ---------------- STATE ----------------
const DEFAULT_STATE = {
  company: {
    name: "Omega Hires India Private Limited",
    address: "B Wing 1702/03 - 17th floor Kailash Business Park, Vikhroli, Mumbai, India",
    phone: "+91 22 6123 4567",
    email: "billing@omegahires.in",
    website: "www.omegahires.in",
    gstin: "27AAFCO0923M1Z2",
    pan: "AAFCO0923M",
    cin: "U74140MH2021PTC368910",
    tagline: "Executive Recruitment · Workforce Solutions",
    subTagline: "Connecting talent. Building futures."
  },
  meta: {
    invoiceNo: "OH/26-27/0012",
    invoiceDate: "28 May 2026",
    dueDate: "27 Jun 2026",
    paymentTerms: "Net 30 Days",
    currency: "INR",
    pos: "Maharashtra",
    poNumber: "PO-48291",
    vendorCode: "VEN-1024",
    taxSystem: "CGST_SGST",
    status: "UNPAID",
    documentTitle: "Tax Invoice",
    invoiceLabel: "Invoice",
    copyLabel: "Original for recipient"
  },
  client: {
    name: "Lumen Technologies Pvt Ltd",
    contact: "Rahul Sharma",
    department: "Talent Acquisition",
    address: "801 Enterprise Way, BKC, Mumbai, Maharashtra – 400051",
    gstin: "27ABCDE1234F1Z5",
    email: "accounts@lumentech.in",
    phone: "+91 98765 43210"
  },
  recruitment: {
    enabled: true,
    candidateName: "Arjun Mehta",
    position: "Senior Software Engineer — Platform",
    joiningDate: "20 May 2026",
    recruitmentType: "Permanent Placement",
    replacementPeriod: "90 Days",
    serviceAgreementRef: "SA-2026-118"
  },
  items: [
    {
      id: "item-1",
      serviceCode: "REC-001",
      sacCode: "998513",
      description: "Recruitment placement fee — Sr. Software Engineer (Arjun Mehta)",
      qty: 1,
      rate: 150000,
      taxRate: 18
    },
    {
      id: "item-2",
      serviceCode: "CONS-002",
      sacCode: "998311",
      description: "Talent advisory & multi-round screening services",
      qty: 1,
      rate: 45000,
      taxRate: 18
    }
  ],
  totals: {
    discount: 5000,
    discountType: "FLAT",
    tdsPercent: 10,
    amountPaid: 0
  },
  payment: {
    bankName: "ICICI Bank",
    acName: "Omega Hires India Private Limited",
    acNo: "50200067891234",
    ifsc: "ICIC0000084",
    branch: "Sion Branch",
    upiId: "omegahires@icici"
  },
  terms: [
    "Payment due within 30 days of invoice date.",
    "Late payments attract 18% p.a. simple interest.",
    "Replacement guarantee valid within stated period; subject to agreement.",
    "Disputes subject to jurisdiction of Mumbai courts."
  ],
  notes: "Invoice covers recruitment and advisory services rendered in May 2026. Please reference the invoice number on remittance.",
  authorizedSignatory: "Narendra Kataria",
  signatureImage: null
};

let state = clone(DEFAULT_STATE);
let activeRail = "client";
let zoomFactor = 0.85;

// Tweaks defaults (will be controlled by Tweaks panel via React app)
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "template": "sovereign",
  "density": "regular",
  "showRecruitment": true,
  "signatureStyle": "handwritten",
  "paperBg": "white"
}/*EDITMODE-END*/;

let tweaks = { ...TWEAK_DEFAULTS };

// ---------------- UTILITIES ----------------
function sanitizeForFilename(str) {
  return String(str || "").replace(/[\/\\:*?"<>|]/g, "-").trim();
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function $(id) { return document.getElementById(id); }
function html(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function emptyOr(v, fallback = "—") {
  if (v === undefined || v === null) return fallback;
  const s = String(v).trim();
  return s === "" ? fallback : s;
}

function editableSpan(path, value, placeholder = "—", multiline = false) {
  const cleanVal = value ?? "";
  const multilineClass = multiline ? " multiline" : "";
  return `<span contenteditable="true" class="inline-edit${multilineClass}" data-path="${path}" data-placeholder="${placeholder}">${html(cleanVal)}</span>`;
}

function currencySymbol(code) {
  return { INR: "₹", USD: "$", EUR: "€", GBP: "£" }[code] || code;
}

function formatMoney(value, code = state.meta.currency) {
  const sym = currencySymbol(code);
  const n = Number(value) || 0;
  const formatted = code === "INR"
    ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym} ${formatted}`;
}

function calcTotals() {
  let subtotal = 0;
  const rows = state.items.map(item => {
    const taxable = (Number(item.qty) || 0) * (Number(item.rate) || 0);
    subtotal += taxable;
    return { ...item, taxable };
  });
  let discountVal = 0;
  if (state.totals.discountType === "FLAT") {
    discountVal = Number(state.totals.discount) || 0;
  } else {
    discountVal = subtotal * ((Number(state.totals.discount) || 0) / 100);
  }
  discountVal = Math.min(discountVal, subtotal);
  const discountedSubtotal = subtotal - discountVal;

  let totalGst = 0;
  rows.forEach(r => {
    const prop = subtotal > 0 ? r.taxable / subtotal : 0;
    const itemDiscTaxable = r.taxable - (discountVal * prop);
    const rate = state.meta.taxSystem === "NONE" ? 0 : (Number(r.taxRate) || 0);
    r.gstRate = rate;
    r.gstAmount = itemDiscTaxable * (rate / 100);
    r.rowTotal = r.taxable + (r.taxable * rate / 100); // pre-discount line total displayed in table
    totalGst += r.gstAmount;
  });

  const tdsVal = discountedSubtotal * ((Number(state.totals.tdsPercent) || 0) / 100);
  const grand = discountedSubtotal + totalGst;
  const balance = grand - tdsVal - (Number(state.totals.amountPaid) || 0);
  return { rows, subtotal, discountVal, discountedSubtotal, totalGst, tdsVal, grand, balance };
}

function numberToWords(num, currency = "INR") {
  if (!num || num === 0) return currency === "INR" ? "Zero Rupees Only" : `Zero ${currencyName(currency)} Only`;
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function lt1000(n) {
    let s = "";
    if (n >= 100) { s += ones[Math.floor(n / 100)] + " Hundred "; n %= 100; }
    if (n > 0) {
      if (s) s += "and ";
      if (n < 20) s += ones[n];
      else { s += tens[Math.floor(n / 10)]; if (n % 10) s += "-" + ones[n % 10]; }
    }
    return s.trim();
  }
  const integer = Math.floor(num);
  const decimals = Math.round((num - integer) * 100);

  if (currency === "INR") {
    function helper(n) {
      let s = "";
      if (n >= 10000000) { s += helper(Math.floor(n / 10000000)) + " Crore "; n %= 10000000; }
      if (n >= 100000) { s += helper(Math.floor(n / 100000)) + " Lakh "; n %= 100000; }
      if (n >= 1000) { s += helper(Math.floor(n / 1000)) + " Thousand "; n %= 1000; }
      if (n > 0) s += lt1000(n);
      return s.trim();
    }
    let words = helper(integer);
    let res = words ? `Rupees ${words} Only` : "Zero Rupees";
    if (decimals > 0) res = `Rupees ${words} and ${lt1000(decimals)} Paise Only`;
    return res;
  }

  function helperIntl(n) {
    let s = "";
    if (n >= 1000000000) { s += helperIntl(Math.floor(n / 1000000000)) + " Billion "; n %= 1000000000; }
    if (n >= 1000000) { s += helperIntl(Math.floor(n / 1000000)) + " Million "; n %= 1000000; }
    if (n >= 1000) { s += helperIntl(Math.floor(n / 1000)) + " Thousand "; n %= 1000; }
    if (n > 0) s += lt1000(n);
    return s.trim();
  }
  const words = helperIntl(integer);
  const cn = currencyName(currency);
  const sn = subUnitName(currency);
  let res = words ? `${words} ${cn} Only` : `Zero ${cn}`;
  if (decimals > 0) res = `${words} ${cn} and ${lt1000(decimals)} ${sn} Only`;
  return res;
}

function currencyName(c) { return { USD: "Dollars", EUR: "Euros", GBP: "Pounds", INR: "Rupees" }[c] || c; }
function subUnitName(c) { return { USD: "Cents", EUR: "Cents", GBP: "Pence", INR: "Paise" }[c] || "Cents"; }


// ============================================================
// SIDEBAR — RAIL NAV
// ============================================================
function setActiveRail(name) {
  activeRail = name;
  document.querySelectorAll(".sb-rail-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.rail === name);
  });
  document.querySelectorAll(".sb-panel").forEach(panel => {
    panel.classList.toggle("active", panel.dataset.panel === name);
  });
}

// ============================================================
// SIDEBAR — RENDER PANELS
// ============================================================
function renderSidebar() {
  renderClientPanel();
  renderRecruitmentPanel();
  renderDetailsPanel();
  renderItemsPanel();
  renderTotalsPanel();
  renderPaymentPanel();
  renderNotesPanel();
  renderCompanyPanel();
  renderDraftsPanel();
}

function field(label, id, value, opts = {}) {
  const type = opts.type || "text";
  const ph = opts.placeholder ? ` placeholder="${html(opts.placeholder)}"` : "";
  const onInput = opts.onInput || "updateField(this)";
  if (type === "textarea") {
    return `
      <div class="field">
        <label for="${id}">${html(label)}</label>
        <textarea id="${id}" data-bind="${html(opts.bind || id)}" oninput="${onInput}"${ph}>${html(value ?? "")}</textarea>
      </div>`;
  }
  if (type === "select") {
    const options = opts.options.map(o => `<option value="${html(o.value)}" ${o.value === value ? "selected" : ""}>${html(o.label)}</option>`).join("");
    return `
      <div class="field">
        <label for="${id}">${html(label)}</label>
        <select id="${id}" data-bind="${html(opts.bind || id)}" onchange="${onInput}">${options}</select>
      </div>`;
  }
  return `
    <div class="field">
      <label for="${id}">${html(label)}</label>
      <input id="${id}" data-bind="${html(opts.bind || id)}" type="${type}" value="${html(value ?? "")}" oninput="${onInput}"${ph} />
    </div>`;
}

function panelHead(title, sub) {
  return `<div class="sb-panel-head">
    <div class="sb-panel-title">${html(title)}</div>
    ${sub ? `<div class="sb-panel-sub">${html(sub)}</div>` : ""}
  </div>`;
}

function renderClientPanel() {
  const c = state.client;
  $("panel-client").innerHTML = `
    ${panelHead("Bill To", "Who's receiving this invoice.")}
    <div class="group">
      <div class="group-label">Organisation</div>
      ${field("Company name", "client-name", c.name, { bind: "client.name", placeholder: "e.g. Lumen Technologies Pvt Ltd" })}
      ${field("Billing address", "client-address", c.address, { bind: "client.address", type: "textarea", placeholder: "Street, City, State – PIN" })}
      ${field("Party GSTIN", "client-gstin", c.gstin, { bind: "client.gstin", placeholder: "27XXXXX1234X1Z5" })}
    </div>
    <div class="group">
      <div class="group-label">Contact</div>
      ${field("Contact person", "client-contact", c.contact, { bind: "client.contact" })}
      ${field("Department", "client-department", c.department, { bind: "client.department" })}
      <div class="field-row cols-2">
        ${field("Email", "client-email", c.email, { bind: "client.email" })}
        ${field("Phone", "client-phone", c.phone, { bind: "client.phone" })}
      </div>
    </div>
  `;
}

function renderRecruitmentPanel() {
  const r = state.recruitment;
  $("panel-recruitment").innerHTML = `
    ${panelHead("Candidate Details", "Recruitment placement and candidate details.")}
    <div class="switch-row" style="border-top: none; padding-top: 0;">
      <div class="switch-info">
        <div class="t">Recruitment details block</div>
        <div class="d">Show candidate, role and replacement period block on the invoice.</div>
      </div>
      <label class="switch">
        <input type="checkbox" id="rec-enabled" onchange="toggleRecruitment(this.checked)" ${r.enabled ? "checked" : ""}>
        <span class="slider"></span>
      </label>
    </div>
    <div id="rec-fields" class="group" style="${r.enabled ? "" : "display:none;"}">
      ${field("Candidate name", "rec-candidateName", r.candidateName, { bind: "recruitment.candidateName" })}
      ${field("Position / role", "rec-position", r.position, { bind: "recruitment.position" })}
      <div class="field-row cols-2">
        ${field("Joining date", "rec-joiningDate", r.joiningDate, { bind: "recruitment.joiningDate" })}
        ${field("Engagement type", "rec-recruitmentType", r.recruitmentType, { bind: "recruitment.recruitmentType" })}
      </div>
      <div class="field-row cols-2">
        ${field("Replacement period", "rec-replacementPeriod", r.replacementPeriod, { bind: "recruitment.replacementPeriod" })}
        ${field("Agreement ref.", "rec-serviceAgreementRef", r.serviceAgreementRef, { bind: "recruitment.serviceAgreementRef" })}
      </div>
    </div>
  `;
}

function renderDetailsPanel() {
  const m = state.meta;
  $("panel-details").innerHTML = `
    ${panelHead("Invoice Details", "Numbering, dates, and engagement context.")}
    <div class="group">
      <div class="group-label">Numbering &amp; Dates</div>
      <div class="field-row cols-2">
        ${field("Invoice number", "meta-invoiceNo", m.invoiceNo, { bind: "meta.invoiceNo" })}
        ${field("Status", "meta-status", m.status, { bind: "meta.status", type: "select", options: [
          { value: "UNPAID", label: "Unpaid" }, { value: "PAID", label: "Paid" }, { value: "OVERDUE", label: "Overdue" }
        ]})}
      </div>
      <div class="field-row cols-2">
        ${field("Invoice date", "meta-invoiceDate", m.invoiceDate, { bind: "meta.invoiceDate" })}
        ${field("Due date", "meta-dueDate", m.dueDate, { bind: "meta.dueDate" })}
      </div>
      <div class="field-row cols-2">
        ${field("Payment terms", "meta-paymentTerms", m.paymentTerms, { bind: "meta.paymentTerms" })}
        ${field("Currency", "meta-currency", m.currency, { bind: "meta.currency", type: "select", options: [
          { value: "INR", label: "INR (₹)" }, { value: "USD", label: "USD ($)" }, { value: "EUR", label: "EUR (€)" }, { value: "GBP", label: "GBP (£)" }
        ]})}
      </div>
    </div>
    <div class="group">
      <div class="group-label">References</div>
      <div class="field-row cols-2">
        ${field("PO number", "meta-poNumber", m.poNumber, { bind: "meta.poNumber" })}
        ${field("Vendor code", "meta-vendorCode", m.vendorCode, { bind: "meta.vendorCode" })}
      </div>
      <div class="field-row cols-2">
        ${field("Place of supply", "meta-pos", m.pos, { bind: "meta.pos" })}
        ${field("Tax system", "meta-taxSystem", m.taxSystem, { bind: "meta.taxSystem", type: "select", options: [
          { value: "CGST_SGST", label: "CGST + SGST" }, { value: "IGST", label: "IGST" }, { value: "NONE", label: "Tax exempt" }
        ]})}
      </div>
    </div>
    <div class="group">
      <div class="group-label">Document Labels</div>
      ${field("Document Title", "meta-documentTitle", m.documentTitle, { bind: "meta.documentTitle", placeholder: "e.g. Tax Invoice" })}
      <div class="field-row cols-2">
        ${field("Invoice Label", "meta-invoiceLabel", m.invoiceLabel, { bind: "meta.invoiceLabel", placeholder: "e.g. Invoice" })}
        ${field("Copy Descriptor", "meta-copyLabel", m.copyLabel, { bind: "meta.copyLabel", placeholder: "e.g. Original for recipient" })}
      </div>
    </div>
  `;
}

function renderItemsPanel() {
  const tots = calcTotals();
  const rowsHtml = state.items.map((item, idx) => {
    const row = tots.rows[idx];
    return `
      <div class="item-row" data-id="${item.id}">
        <div class="item-row-head">
          <div class="item-row-num"><span class="hash">#</span>${String(idx + 1).padStart(2, "0")} &nbsp;·&nbsp; ${html(item.serviceCode || "—")}</div>
          <div class="item-row-actions">
            <button class="icon-btn" title="Move up" onclick="moveItem('${item.id}', -1)" ${idx === 0 ? "disabled" : ""}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
            </button>
            <button class="icon-btn" title="Move down" onclick="moveItem('${item.id}', 1)" ${idx === state.items.length - 1 ? "disabled" : ""}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <button class="icon-btn" title="Duplicate" onclick="duplicateItem('${item.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <button class="icon-btn danger" title="Remove" onclick="deleteItem('${item.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path></svg>
            </button>
          </div>
        </div>
        <div class="field-row cols-2">
          <div class="field">
            <label>Service code</label>
            <input type="text" value="${html(item.serviceCode)}" oninput="updateItem('${item.id}', 'serviceCode', this.value)">
          </div>
          <div class="field">
            <label>SAC / HSN</label>
            <input type="text" value="${html(item.sacCode)}" oninput="updateItem('${item.id}', 'sacCode', this.value)">
          </div>
        </div>
        <div class="field">
          <label>Description</label>
          <textarea oninput="updateItem('${item.id}', 'description', this.value)" rows="2">${html(item.description)}</textarea>
        </div>
        <div class="field-row cols-3">
          <div class="field">
            <label>Rate</label>
            <input type="number" value="${item.rate}" oninput="updateItem('${item.id}', 'rate', Number(this.value))">
          </div>
          <div class="field">
            <label>Qty</label>
            <input type="number" value="${item.qty}" oninput="updateItem('${item.id}', 'qty', Number(this.value))">
          </div>
          <div class="field">
            <label>GST %</label>
            <select onchange="updateItem('${item.id}', 'taxRate', Number(this.value))">
              ${[0, 5, 12, 18, 28].map(r => `<option value="${r}" ${item.taxRate === r ? "selected" : ""}>${r}%</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="item-row-line">
          <span class="label">Line total</span>
          <span style="font-size: 11px; color: var(--slate-600);">${item.qty} × ${formatMoney(item.rate)} + ${row.gstRate}% GST</span>
          <span class="amount">${formatMoney(row.rowTotal)}</span>
        </div>
      </div>`;
  }).join("");

  $("panel-items").innerHTML = `
    ${panelHead("Line Items", `${state.items.length} item${state.items.length === 1 ? "" : "s"} · subtotal ${formatMoney(tots.subtotal)}`)}
    <div id="item-list">${rowsHtml}</div>
    <button class="add-item-btn" onclick="addItem()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      Add line item
    </button>
  `;
}

function renderTotalsPanel() {
  const t = state.totals;
  $("panel-totals").innerHTML = `
    ${panelHead("Discounts &amp; Tax", "TDS, discounts, and amounts already collected.")}
    <div class="group">
      <div class="group-label">Discount</div>
      <div class="field-row cols-2">
        ${field("Amount", "totals-discount", t.discount, { bind: "totals.discount", type: "number" })}
        ${field("Type", "totals-discountType", t.discountType, { bind: "totals.discountType", type: "select", options: [
          { value: "FLAT", label: "Flat amount" }, { value: "PERCENT", label: "Percentage (%)" }
        ]})}
      </div>
    </div>
    <div class="group">
      <div class="group-label">TDS &amp; Payments</div>
      <div class="field-row cols-2">
        ${field("TDS rate", "totals-tdsPercent", t.tdsPercent, { bind: "totals.tdsPercent", type: "select", options: [
          { value: 0, label: "0% — No TDS" },
          { value: 1, label: "1% — Sec 194Q (Goods)" },
          { value: 2, label: "2% — Sec 194C / GST" },
          { value: 10, label: "10% — Sec 194J (Prof.)" }
        ]})}
        ${field("Amount already paid", "totals-amountPaid", t.amountPaid, { bind: "totals.amountPaid", type: "number" })}
      </div>
    </div>
  `;
}

function renderPaymentPanel() {
  const p = state.payment;
  $("panel-payment").innerHTML = `
    ${panelHead("Payment Details", "Where the client should remit funds.")}
    <div class="group">
      ${field("Bank name", "payment-bankName", p.bankName, { bind: "payment.bankName" })}
      ${field("Account name", "payment-acName", p.acName, { bind: "payment.acName" })}
      ${field("Account number", "payment-acNo", p.acNo, { bind: "payment.acNo" })}
      <div class="field-row cols-2">
        ${field("IFSC", "payment-ifsc", p.ifsc, { bind: "payment.ifsc" })}
        ${field("Branch", "payment-branch", p.branch, { bind: "payment.branch" })}
      </div>
      ${field("UPI ID (optional)", "payment-upiId", p.upiId, { bind: "payment.upiId" })}
    </div>
  `;
}

function renderNotesPanel() {
  $("panel-notes").innerHTML = `
    ${panelHead("Signature", "Configure signature and invoice notes.")}
    <div class="group">
      <div class="group-label">Signature Settings</div>
      ${field("Authorised signatory", "authorizedSignatory", state.authorizedSignatory, { bind: "authorizedSignatory" })}
      
      <div class="field">
        <label for="signature-style-select">Signature Style</label>
        <select id="signature-style-select" onchange="updateSignatureStyle(this.value)">
          <option value="handwritten" ${tweaks.signatureStyle === "handwritten" ? "selected" : ""}>Handwritten Text</option>
          <option value="stamp" ${tweaks.signatureStyle === "stamp" ? "selected" : ""}>Approved Stamp</option>
          <option value="image" ${tweaks.signatureStyle === "image" ? "selected" : ""}>Uploaded Image</option>
          <option value="none" ${tweaks.signatureStyle === "none" ? "selected" : ""}>None (No Signature)</option>
        </select>
      </div>

      <div class="field">
        <label>Signature Image</label>
        <div class="sig-upload-container">
          <input type="file" id="sig-image-file" accept="image/*" onchange="handleSignatureUpload(this)" style="display: none;" />
          ${state.signatureImage ? `
            <div class="sig-preview-wrap">
              <img src="${state.signatureImage}" class="sig-preview" />
              <button class="btn-clear-sig" onclick="clearSignatureImage()" title="Remove Signature">Remove</button>
            </div>
          ` : `
            <button class="btn-upload-sig" onclick="$('sig-image-file').click()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload Signature Image
            </button>
          `}
        </div>
      </div>

      ${field("Invoice memo", "notes", state.notes, { bind: "notes", type: "textarea" })}
    </div>
    <div class="group">
      <div class="group-label">Terms &amp; Conditions</div>
      <div id="terms-list">
        ${state.terms.map((t, i) => `
          <div class="field" style="flex-direction:row;gap:8px;align-items:flex-start;">
            <input type="text" value="${html(t)}" oninput="updateTerm(${i}, this.value)" style="flex:1;">
            <button class="icon-btn danger" onclick="deleteTerm(${i})" title="Remove">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        `).join("")}
      </div>
      <button class="add-item-btn" style="padding:8px;font-size:12px;" onclick="addTerm()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Add term
      </button>
    </div>
  `;
}

function renderCompanyPanel() {
  const c = state.company;
  $("panel-company").innerHTML = `
    ${panelHead("Issuer", "Your business details — appears in the invoice header.")}
    <div class="group">
      ${field("Legal name", "company-name", c.name, { bind: "company.name" })}
      ${field("Registered address", "company-address", c.address, { bind: "company.address", type: "textarea" })}
      <div class="field-row cols-2">
        ${field("Phone", "company-phone", c.phone, { bind: "company.phone" })}
        ${field("Email", "company-email", c.email, { bind: "company.email" })}
      </div>
      ${field("Website", "company-website", c.website, { bind: "company.website" })}
    </div>
    <div class="group">
      <div class="group-label">Branding &amp; Taglines</div>
      ${field("Company tagline", "company-tagline", c.tagline, { bind: "company.tagline", placeholder: "e.g. Executive Recruitment · Workforce Solutions" })}
      ${field("Company sub-tagline", "company-subTagline", c.subTagline, { bind: "company.subTagline", placeholder: "e.g. Connecting talent. Building futures." })}
    </div>
    <div class="group">
      <div class="group-label">Tax Identifiers</div>
      ${field("GSTIN", "company-gstin", c.gstin, { bind: "company.gstin" })}
      <div class="field-row cols-2">
        ${field("PAN", "company-pan", c.pan, { bind: "company.pan" })}
        ${field("CIN / LLPIN", "company-cin", c.cin, { bind: "company.cin" })}
      </div>
    </div>
  `;
}

function renderDraftsPanel() {
  const drafts = loadDrafts();
  const list = drafts.length === 0
    ? `<div class="empty-state">
        <div class="glyph">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
        </div>
        <div class="t">No saved drafts yet</div>
        <div class="d">Save the current invoice from the footer to reuse it later.</div>
      </div>`
    : drafts.sort((a, b) => b.id.localeCompare(a.id)).map(d => `
        <div class="draft-card">
          <div class="info">
            <div class="num">${html(d.invoiceNo)}</div>
            <div class="client">${html(d.clientName)}</div>
            <div class="meta"><span>${html(d.savedAt)}</span><span class="amt">${html(d.totalDisplay)}</span></div>
          </div>
          <div class="actions">
            <button class="btn-pill primary" onclick="loadDraft('${d.id}')">Load</button>
            <button class="btn-pill danger" onclick="deleteDraft('${d.id}')">Delete</button>
          </div>
        </div>
      `).join("");

  $("panel-drafts").innerHTML = `
    ${panelHead("Saved Drafts", "Local invoices stored in this browser.")}
    ${list}
  `;
}

// ============================================================
// UPDATE HANDLERS
// ============================================================
function setByPath(obj, path, value) {
  const keys = path.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
  cur[keys[keys.length - 1]] = value;
}

function updateField(el) {
  const bind = el.dataset.bind;
  if (!bind) return;
  let v = el.value;
  if (el.type === "number") v = Number(v);
  setByPath(state, bind, v);
  renderInvoice();
  renderFooterTotals();
}

function toggleRecruitment(enabled) {
  state.recruitment.enabled = enabled;
  $("rec-fields").style.display = enabled ? "" : "none";
  renderInvoice();
}

function updateItem(id, field, value) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  item[field] = value;
  renderInvoice();
  renderFooterTotals();
  // Update line total display in item row without re-rendering whole list
  const tots = calcTotals();
  const idx = state.items.findIndex(i => i.id === id);
  if (idx >= 0) {
    const row = tots.rows[idx];
    const lineEl = document.querySelector(`.item-row[data-id="${id}"] .item-row-line`);
    if (lineEl) {
      lineEl.innerHTML = `
        <span class="label">Line total</span>
        <span style="font-size: 11px; color: var(--slate-600);">${item.qty} × ${formatMoney(item.rate)} + ${row.gstRate}% GST</span>
        <span class="amount">${formatMoney(row.rowTotal)}</span>
      `;
    }
  }
}

function addItem() {
  state.items.push({
    id: "item-" + Date.now(),
    serviceCode: "CONS-" + String(state.items.length + 1).padStart(3, "0"),
    sacCode: "998311",
    description: "New service line",
    qty: 1,
    rate: 0,
    taxRate: 18
  });
  renderItemsPanel();
  renderInvoice();
  renderFooterTotals();
}

function duplicateItem(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  const idx = state.items.indexOf(item);
  state.items.splice(idx + 1, 0, { ...item, id: "item-" + Date.now() });
  renderItemsPanel();
  renderInvoice();
}

function moveItem(id, dir) {
  const idx = state.items.findIndex(i => i.id === id);
  if (idx < 0) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= state.items.length) return;
  const [item] = state.items.splice(idx, 1);
  state.items.splice(newIdx, 0, item);
  renderItemsPanel();
  renderInvoice();
}

function deleteItem(id) {
  if (state.items.length <= 1) return showToast("Invoice must have at least one item.", "warn");
  state.items = state.items.filter(i => i.id !== id);
  renderItemsPanel();
  renderInvoice();
  renderFooterTotals();
}

function updateTerm(i, v) { state.terms[i] = v; renderInvoice(); }
function addTerm() { state.terms.push("New term"); renderNotesPanel(); renderInvoice(); }
function deleteTerm(i) { state.terms.splice(i, 1); renderNotesPanel(); renderInvoice(); }

function handleSignatureUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    state.signatureImage = e.target.result;
    tweaks.signatureStyle = "image";
    renderInvoice();
    renderNotesPanel();
    showToast("Signature image uploaded");
  };
  reader.readAsDataURL(file);
}

function clearSignatureImage() {
  state.signatureImage = null;
  if (tweaks.signatureStyle === "image") {
    tweaks.signatureStyle = "handwritten";
  }
  renderInvoice();
  renderNotesPanel();
  showToast("Signature image removed");
}

function updateSignatureStyle(val) {
  tweaks.signatureStyle = val;
  renderInvoice();
  renderNotesPanel();
}

// ============================================================
// INVOICE — RENDER PER TEMPLATE
// ============================================================
function renderInvoice() {
  const tots = calcTotals();
  const root = $("a4-stage");
  const tmpl = tweaks.template || "sovereign";
  
  // Set root as a pages wrapper container rather than a single A4 page itself
  root.className = `canvas-stage-pages tmpl-${tmpl} density-${tweaks.density || "regular"}`;
  root.style.background = "transparent";
  
  const isMultiPage = state.items.length >= 5;

  if (tmpl === "sovereign") root.innerHTML = templateSovereign(tots, isMultiPage);
  else if (tmpl === "ledger") root.innerHTML = templateLedger(tots, isMultiPage);
  else if (tmpl === "pulse") root.innerHTML = templatePulse(tots, isMultiPage);

  // Wire up click-to-edit on bindable spans
  root.querySelectorAll("[data-jump]").forEach(el => {
    el.classList.add("bindable");
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const [rail, fieldId] = el.dataset.jump.split("|");
      jumpToField(rail, fieldId);
    });
  });
}

function recruitmentBlockData() {
  return state.recruitment.enabled && tweaks.showRecruitment;
}

function templateSovereign(tots, _isMultiPage = false) {
  const c = state.company;
  const m = state.meta;
  const cl = state.client;
  const r = state.recruitment;
  const pageBgStyle = tweaks.paperBg === "cream" ? 'style="background: #fdfaf3;"' : "";
  const densityClass = `a4 sovereign density-${tweaks.density || "regular"}`;

  function renderRows(rows, startIdx) {
    return rows.map((row, i) => `
      <tr>
        <td class="c sr">${startIdx + i + 1}</td>
        <td><div class="code">${editableSpan('items.' + (startIdx + i) + '.serviceCode', row.serviceCode, 'Code')}</div></td>
        <td><div class="code">${editableSpan('items.' + (startIdx + i) + '.sacCode', row.sacCode, 'SAC')}</div></td>
        <td><div class="desc">${editableSpan('items.' + (startIdx + i) + '.description', row.description, 'Description', true)}</div></td>
        <td class="c">${row.qty}</td>
        <td class="r">${formatMoney(row.rate)}</td>
        <td class="r">${formatMoney(row.taxable)}</td>
        <td class="c">${row.gstRate}%</td>
        <td class="r"><strong>${formatMoney(row.rowTotal)}</strong></td>
      </tr>`).join("");
  }

  function renderBottomContent(pageNum, totalPages) {
    return `
      <div class="foot" style="position: absolute; bottom: 0; left: 0; right: 0;">
        ${state.notes && state.notes.trim() ? `
        <div class="notes" style="margin: 0 40px 14px; background: #fffbeb;"><div class="k">Notes</div><div class="v">${editableSpan('notes', state.notes, 'Notes', true)}</div></div>` : ""}
        <div class="grid">
          <div>
            <div class="col-title">Payment Details</div>
            <div class="bank-row"><span class="k">Bank</span><span class="v">${editableSpan('payment.bankName', state.payment.bankName, 'Bank')}</span></div>
            <div class="bank-row"><span class="k">A/C No.</span><span class="v">${editableSpan('payment.acNo', state.payment.acNo, 'A/C No')}</span></div>
            <div class="bank-row"><span class="k">IFSC</span><span class="v">${editableSpan('payment.ifsc', state.payment.ifsc, 'IFSC')}</span></div>
            <div class="bank-row"><span class="k">Branch</span><span class="v">${editableSpan('payment.branch', state.payment.branch, 'Branch')}</span></div>
            ${state.payment.upiId ? `<div class="bank-row"><span class="k">UPI</span><span class="v">${editableSpan('payment.upiId', state.payment.upiId, 'UPI ID')}</span></div>` : ""}
          </div>
          <div>
            <div class="col-title">Terms &amp; Conditions</div>
            <ul class="terms-list">${state.terms.map((t, idx) => `<li>${editableSpan('terms.' + idx, t, 'Term description')}</li>`).join("")}</ul>
          </div>
          <div class="sig">
            <div class="for">For</div>
            <div class="co">${editableSpan('company.name', c.name, 'Company Name')}</div>
            ${tweaks.signatureStyle === "handwritten" ? `<div class="hw">${editableSpan('authorizedSignatory', state.authorizedSignatory, 'Signatory')}</div>` : ""}
            ${tweaks.signatureStyle === "stamp" ? `<div style="display:inline-block; padding:4px 10px; border:2px solid var(--navy); border-radius:50%; color:var(--navy); font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; transform:rotate(-6deg); margin-bottom:2px;">APPROVED</div>` : ""}
            ${tweaks.signatureStyle === "image" ? `
              <div class="sig-img-wrap">
                ${state.signatureImage ? `<img src="${state.signatureImage}" class="sig-img" alt="Signature" />` : `<div class="sig-placeholder">No signature uploaded</div>`}
              </div>
            ` : ""}
            <div class="line">${editableSpan('authorizedSignatory', state.authorizedSignatory, 'Signatory')} · Authorised Signatory</div>
            <div class="gen">This is a computer-generated invoice and does not require a physical signature.</div>
          </div>
        </div>
        ${totalPages > 1 ? `
        <div style="padding: 10px 40px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--slate-200); font-size: 9px; color: var(--slate-500); font-weight: 500; background: #fff;">
          <span>Page ${pageNum} of ${totalPages}</span>
          <span>Omega Hires India Private Limited · Invoice № ${html(m.invoiceNo)}</span>
          ${pageNum < totalPages ? `<span style="font-weight: 600; color: var(--lime-dark);">Continued on Page ${pageNum + 1} →</span>` : `<span>End of Document</span>`}
        </div>
        ` : ""}
        <div class="bottom-bar"></div>
      </div>
    `;
  }

  const recEnabled = recruitmentBlockData();
  
  // Calculate heights
  const headerHeight = 180;
  const partiesHeight = 180;
  const recHeight = recEnabled ? 120 : 0;
  const tblHeaderHeight = 38;
  
  const notesHeight = state.notes && state.notes.trim() ? (40 + Math.ceil(state.notes.length / 90) * 14) : 0;
  const termsHeight = state.terms.length * 15;
  const sigHeight = tweaks.signatureStyle === "image" ? 50 : 0;
  const footerBaseHeight = 160 + notesHeight + termsHeight + sigHeight;
  
  const totalsHeight = 180;
  
  // Available heights
  const singlePageAvailable = 1123 - (headerHeight + partiesHeight + recHeight + tblHeaderHeight + totalsHeight + footerBaseHeight);
  const page1Available = 1123 - (headerHeight + partiesHeight + recHeight + tblHeaderHeight + footerBaseHeight);
  const middlePageAvailable = 1123 - (60 + tblHeaderHeight + footerBaseHeight);
  const lastPageAvailable = 1123 - (60 + tblHeaderHeight + totalsHeight + footerBaseHeight);

  // Measure row heights
  const rowHeights = tots.rows.map(row => {
    const lines = Math.max(1, Math.ceil(row.description.length / 55));
    return 24 + lines * 14;
  });

  const totalRowsHeight = rowHeights.reduce((a, b) => a + b, 0);

  const pages = [];
  if (totalRowsHeight <= singlePageAvailable) {
    pages.push(tots.rows);
  } else {
    let currentPageRows = [];
    let currentHeight = 0;
    let pageIdx = 0;

    for (let i = 0; i < tots.rows.length; i++) {
      const rowHeight = rowHeights[i];
      let limit = pageIdx === 0 ? page1Available : middlePageAvailable;

      if (pageIdx > 0) {
        const remainingRowsHeight = rowHeights.slice(i).reduce((a, b) => a + b, 0);
        if (remainingRowsHeight + totalsHeight <= lastPageAvailable) {
          pages.push(currentPageRows);
          currentPageRows = tots.rows.slice(i);
          break;
        }
      }

      if (currentHeight + rowHeight > limit && currentPageRows.length > 0) {
        pages.push(currentPageRows);
        currentPageRows = [tots.rows[i]];
        currentHeight = rowHeight;
        pageIdx++;
      } else {
        currentPageRows.push(tots.rows[i]);
        currentHeight += rowHeight;
      }
    }
    if (pages.indexOf(currentPageRows) === -1) {
      pages.push(currentPageRows);
    }
    if (pages.length === 1 && totalRowsHeight > singlePageAvailable) {
      pages.push([]);
    }
  }

  const totalPages = pages.length;

  return pages.map((pageRows, pageIdx) => {
    const isFirstPage = pageIdx === 0;
    const isLastPage = pageIdx === totalPages - 1;
    const pageNum = pageIdx + 1;
    
    let startIdx = 0;
    for (let p = 0; p < pageIdx; p++) {
      startIdx += pages[p].length;
    }

    let pageContent = "";

    if (isFirstPage) {
      pageContent += `
        <div class="top-bar"></div>
        <div class="sov-header">
          <div class="sov-brand">
            <img src="omega_hires_logo.png" alt="Omega Hires" />
            <div class="tag">${editableSpan('company.tagline', c.tagline, 'Company Tagline')}</div>
            <div class="sub">${editableSpan('company.subTagline', c.subTagline, 'Company Sub-tagline')}</div>
          </div>
          <div class="sov-doctype">
            <div class="label">${editableSpan('meta.documentTitle', m.documentTitle, 'Tax Invoice')}</div>
            <div class="title">${editableSpan('meta.invoiceLabel', m.invoiceLabel, 'Invoice')}</div>
            <div class="num">${editableSpan('meta.invoiceNo', m.invoiceNo, 'Invoice Number')}</div>
            <div class="copy">${editableSpan('meta.copyLabel', m.copyLabel, 'Copy Descriptor')}</div>
          </div>
        </div>
        <div class="sov-meta-strip">
          <div class="cell"><div class="k">Date Issued</div><div class="v">${editableSpan('meta.invoiceDate', m.invoiceDate, 'Date')}</div></div>
          <div class="cell"><div class="k">Due</div><div class="v">${editableSpan('meta.dueDate', m.dueDate, 'Due Date')}</div></div>
          <div class="cell"><div class="k">PO Reference</div><div class="v">${editableSpan('meta.poNumber', m.poNumber, '—')}</div></div>
          <div class="cell"><div class="k">Place of Supply</div><div class="v">${editableSpan('meta.pos', m.pos, '—')}</div></div>
        </div>
        <div class="sov-parties">
          <div class="party-block">
            <div class="label">From</div>
            <div class="name">${editableSpan('company.name', c.name, 'Company Name')}</div>
            <div class="row"><span class="k">Address</span><span class="v">${editableSpan('company.address', c.address, 'Address', true)}</span></div>
            <div class="row"><span class="k">Contact</span><span class="v">${editableSpan('company.phone', c.phone, 'Phone')} · ${editableSpan('company.email', c.email, 'Email')}</span></div>
            <div class="row"><span class="k">Web</span><span class="v">${editableSpan('company.website', c.website, 'Website')}</span></div>
            <div class="row"><span class="k">GSTIN</span><span class="v gst">${editableSpan('company.gstin', c.gstin, 'GSTIN')}</span></div>
            <div class="row"><span class="k">PAN / CIN</span><span class="v">${editableSpan('company.pan', c.pan, 'PAN')} · ${editableSpan('company.cin', c.cin, 'CIN')}</span></div>
          </div>
          <div class="party-block">
            <div class="label">Billed To</div>
            <div class="name">${editableSpan('client.name', cl.name, 'Client Name')}</div>
            <div class="row"><span class="k">Attn.</span><span class="v">${editableSpan('client.contact', cl.contact, 'Contact')} · ${editableSpan('client.department', cl.department, 'Department')}</span></div>
            <div class="row"><span class="k">Address</span><span class="v">${editableSpan('client.address', cl.address, 'Address', true)}</span></div>
            <div class="row"><span class="k">Contact</span><span class="v">${editableSpan('client.email', cl.email, 'Email')} · ${editableSpan('client.phone', cl.phone, 'Phone')}</span></div>
            <div class="row"><span class="k">GSTIN</span><span class="v gst">${editableSpan('client.gstin', cl.gstin, 'GSTIN')}</span></div>
          </div>
        </div>
        ${recEnabled ? `
          <div class="rec-card">
            <div class="head">
              <div class="title">Recruitment Engagement</div>
              <div class="badge">${editableSpan('recruitment.recruitmentType', r.recruitmentType, 'Type')}</div>
            </div>
            <div class="grid">
              <div class="item"><div class="k">Candidate</div><div class="v">${editableSpan('recruitment.candidateName', r.candidateName, 'Candidate')}</div></div>
              <div class="item"><div class="k">Position</div><div class="v">${editableSpan('recruitment.position', r.position, 'Position')}</div></div>
              <div class="item"><div class="k">Joining Date</div><div class="v">${editableSpan('recruitment.joiningDate', r.joiningDate, 'Date')}</div></div>
              <div class="item"><div class="k">Replacement Period</div><div class="v">${editableSpan('recruitment.replacementPeriod', r.replacementPeriod, 'Period')}</div></div>
              <div class="item"><div class="k">Agreement Ref.</div><div class="v">${editableSpan('recruitment.serviceAgreementRef', r.serviceAgreementRef, 'Agreement')}</div></div>
              <div class="item"><div class="k">Type</div><div class="v">${editableSpan('recruitment.recruitmentType', r.recruitmentType, 'Type')}</div></div>
            </div>
          </div>` : ""}
      `;
    } else {
      pageContent += `
        <div class="top-bar"></div>
        <div class="sov-header compact" style="padding: 18px 40px 14px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--navy);">
          <img src="omega_hires_logo.png" alt="Omega Hires" style="height: 36px; width: auto;" />
          <div style="font-family:'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; color: var(--navy); letter-spacing: 0.05em; text-transform: uppercase;">
            Invoice № ${editableSpan('meta.invoiceNo', m.invoiceNo, 'Invoice Number')} · Page ${pageNum}
          </div>
        </div>
      `;
    }

    pageContent += `
      <div class="items" style="margin-top: ${isFirstPage ? "0" : "24px"};">
        ${!isFirstPage ? `<div style="font-family:'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; color: var(--slate-500); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10px;">Line Items (Continued)</div>` : ""}
        <table>
          <thead>
            <tr>
              <th class="c" style="width:32px">Sr.</th>
              <th style="width:80px">Code</th>
              <th style="width:64px">SAC</th>
              <th>Description</th>
              <th class="c" style="width:32px">Qty</th>
              <th class="r" style="width:80px">Rate</th>
              <th class="r" style="width:80px">Taxable</th>
              <th class="c" style="width:50px">GST</th>
              <th class="r" style="width:88px">Total</th>
            </tr>
          </thead>
          <tbody>
            ${renderRows(pageRows, startIdx)}
          </tbody>
        </table>
      </div>
    `;

    if (isLastPage) {
      pageContent += `
        <div class="totals-wrap" style="margin-top: 20px;">
          <div class="words">
            <div class="k">Amount in words (${html(m.currency)})</div>
            <div class="v">${html(numberToWords(tots.grand, m.currency))}</div>
          </div>
          <div class="totals">
            <div class="row"><span>Subtotal (Taxable)</span><span class="v">${formatMoney(tots.subtotal)}</span></div>
            ${tots.discountVal > 0 ? `<div class="row neg"><span>Discount</span><span class="v">− ${formatMoney(tots.discountVal)}</span></div>` : ""}
            ${m.taxSystem === "CGST_SGST" ? `
              <div class="row"><span>CGST (½)</span><span class="v">${formatMoney(tots.totalGst / 2)}</span></div>
              <div class="row"><span>SGST (½)</span><span class="v">${formatMoney(tots.totalGst / 2)}</span></div>` :
              m.taxSystem === "IGST" ? `
              <div class="row"><span>IGST</span><span class="v">${formatMoney(tots.totalGst)}</span></div>` : `
              <div class="row"><span>Tax (Exempt)</span><span class="v">${formatMoney(0)}</span></div>`}
            <div class="row grand"><span>Grand Total</span><span class="v">${formatMoney(tots.grand)}</span></div>
            ${tots.tdsVal > 0 ? `<div class="row neg"><span>TDS (${state.totals.tdsPercent}%)</span><span class="v">− ${formatMoney(tots.tdsVal)}</span></div>` : ""}
            ${state.totals.amountPaid > 0 ? `<div class="row neg"><span>Amount Paid</span><span class="v">− ${formatMoney(state.totals.amountPaid)}</span></div>` : ""}
            <div class="row balance"><span>Balance Due</span><span class="v">${formatMoney(tots.balance)}</span></div>
          </div>
        </div>
      `;
    } else {
      pageContent += `<div style="height: 40px;"></div>`;
    }

    pageContent += renderBottomContent(pageNum, totalPages);

    return `
      <!-- PAGE ${pageNum} -->
      <div class="${densityClass}" ${pageBgStyle}>
        ${pageContent}
      </div>
    `;
  }).join("");
}

function templateLedger(tots, _isMultiPage = false) {
  const c = state.company;
  const m = state.meta;
  const cl = state.client;
  const r = state.recruitment;
  const pageBgStyle = tweaks.paperBg === "cream" ? 'style="background: #fdfaf3;"' : "";
  const densityClass = `a4 ledger density-${tweaks.density || "regular"}`;

  function renderRows(rows, startIdx) {
    return rows.map((row, i) => `
      <tr>
        <td class="c sr">${String(startIdx + i + 1).padStart(2, "0")}</td>
        <td>
          <div class="code-line">${editableSpan('items.' + (startIdx + i) + '.serviceCode', row.serviceCode, 'Code')} · SAC ${editableSpan('items.' + (startIdx + i) + '.sacCode', row.sacCode, 'SAC')}</div>
          <div>${editableSpan('items.' + (startIdx + i) + '.description', row.description, 'Description', true)}</div>
        </td>
        <td class="c">${row.qty}</td>
        <td class="r">${formatMoney(row.rate)}</td>
        <td class="c">${row.gstRate}%</td>
        <td class="r"><span class="total">${formatMoney(row.rowTotal)}</span></td>
      </tr>`).join("");
  }

  function renderBottomContent(pageNum, totalPages) {
    return `
      <div class="lg-foot" style="position: absolute; bottom: 0; left: 0; right: 0; padding: 20px 56px 20px;">
        ${state.notes && state.notes.trim() ? `<div class="lg-notes" style="margin: 0 0 16px 0;">${editableSpan('notes', state.notes, 'Notes', true)}</div>` : ""}
        <div class="lg-foot-grid">
          <div>
            <div class="col-title">Remit Payment</div>
            <div class="bank-line"><span class="k">Bank</span><span class="v">${editableSpan('payment.bankName', state.payment.bankName, 'Bank')}</span></div>
            <div class="bank-line"><span class="k">A/C</span><span class="v">${editableSpan('payment.acNo', state.payment.acNo, 'A/C')}</span></div>
            <div class="bank-line"><span class="k">IFSC</span><span class="v">${editableSpan('payment.ifsc', state.payment.ifsc, 'IFSC')}</span></div>
            <div class="bank-line"><span class="k">Branch</span><span class="v">${editableSpan('payment.branch', state.payment.branch, 'Branch')}</span></div>
            ${state.payment.upiId ? `<div class="bank-line"><span class="k">UPI</span><span class="v">${editableSpan('payment.upiId', state.payment.upiId, 'UPI')}</span></div>` : ""}
          </div>
          <div>
            <div class="col-title">Terms</div>
            <ul class="terms-list">${state.terms.map((t, idx) => `<li>${editableSpan('terms.' + idx, t, 'Term')}</li>`).join("")}</ul>
          </div>
          <div class="sig-col">
            <div class="for">Signed for</div>
            <div class="co">${editableSpan('company.name', c.name, 'Company')}</div>
            ${tweaks.signatureStyle === "handwritten" ? `<div class="hw">${editableSpan('authorizedSignatory', state.authorizedSignatory, 'Signatory')}</div>` : ""}
            ${tweaks.signatureStyle === "stamp" ? `<div style="display:inline-block; padding:4px 10px; border:2px solid var(--navy); border-radius:50%; color:var(--navy); font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; transform:rotate(-6deg); margin-bottom:2px;">APPROVED</div>` : ""}
            ${tweaks.signatureStyle === "image" ? `
              <div class="sig-img-wrap">
                ${state.signatureImage ? `<img src="${state.signatureImage}" class="sig-img" alt="Signature" />` : `<div class="sig-placeholder">No signature uploaded</div>`}
              </div>
            ` : ""}
            <div class="line">${editableSpan('authorizedSignatory', state.authorizedSignatory, 'Signatory')}</div>
            <div class="gen">Computer-generated invoice</div>
          </div>
        </div>
        ${totalPages > 1 ? `
        <div style="border-top: 1px solid var(--slate-200); padding-top: 10px; margin-top: 15px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: var(--slate-500); font-weight: 500; background: #fff;">
          <span>Page ${pageNum} of ${totalPages}</span>
          <span>Omega Hires India Private Limited · Invoice № ${html(m.invoiceNo)}</span>
          ${pageNum < totalPages ? `<span style="font-weight: 600; color: var(--lime-dark);">Continued on Page ${pageNum + 1} →</span>` : `<span>End of Document</span>`}
        </div>
        ` : ""}
      </div>
      <div class="lg-bottom-rule" style="position: absolute; bottom: 0; left: 0; right: 0;"></div>
    `;
  }

  const recEnabled = recruitmentBlockData();
  
  // Calculate heights
  const headerHeight = 210;
  const partiesHeight = 140;
  const recHeight = recEnabled ? 110 : 0;
  const tblHeaderHeight = 38;
  
  const notesHeight = state.notes && state.notes.trim() ? (40 + Math.ceil(state.notes.length / 90) * 14) : 0;
  const termsHeight = state.terms.length * 15;
  const sigHeight = tweaks.signatureStyle === "image" ? 50 : 0;
  const footerBaseHeight = 150 + notesHeight + termsHeight + sigHeight;
  
  const totalsHeight = 180;
  
  // Available heights
  const singlePageAvailable = 1123 - (headerHeight + partiesHeight + recHeight + tblHeaderHeight + totalsHeight + footerBaseHeight);
  const page1Available = 1123 - (headerHeight + partiesHeight + recHeight + tblHeaderHeight + footerBaseHeight);
  const middlePageAvailable = 1123 - (70 + tblHeaderHeight + footerBaseHeight);
  const lastPageAvailable = 1123 - (70 + tblHeaderHeight + totalsHeight + footerBaseHeight);

  // Measure row heights
  const rowHeights = tots.rows.map(row => {
    const lines = Math.max(1, Math.ceil(row.description.length / 80));
    return 26 + lines * 14;
  });

  const totalRowsHeight = rowHeights.reduce((a, b) => a + b, 0);

  const pages = [];
  if (totalRowsHeight <= singlePageAvailable) {
    pages.push(tots.rows);
  } else {
    let currentPageRows = [];
    let currentHeight = 0;
    let pageIdx = 0;

    for (let i = 0; i < tots.rows.length; i++) {
      const rowHeight = rowHeights[i];
      let limit = pageIdx === 0 ? page1Available : middlePageAvailable;

      if (pageIdx > 0) {
        const remainingRowsHeight = rowHeights.slice(i).reduce((a, b) => a + b, 0);
        if (remainingRowsHeight + totalsHeight <= lastPageAvailable) {
          pages.push(currentPageRows);
          currentPageRows = tots.rows.slice(i);
          break;
        }
      }

      if (currentHeight + rowHeight > limit && currentPageRows.length > 0) {
        pages.push(currentPageRows);
        currentPageRows = [tots.rows[i]];
        currentHeight = rowHeight;
        pageIdx++;
      } else {
        currentPageRows.push(tots.rows[i]);
        currentHeight += rowHeight;
      }
    }
    if (pages.indexOf(currentPageRows) === -1) {
      pages.push(currentPageRows);
    }
    if (pages.length === 1 && totalRowsHeight > singlePageAvailable) {
      pages.push([]);
    }
  }

  const totalPages = pages.length;

  return pages.map((pageRows, pageIdx) => {
    const isFirstPage = pageIdx === 0;
    const isLastPage = pageIdx === totalPages - 1;
    const pageNum = pageIdx + 1;
    
    let startIdx = 0;
    for (let p = 0; p < pageIdx; p++) {
      startIdx += pages[p].length;
    }

    let pageContent = "";

    if (isFirstPage) {
      pageContent += `
        <div class="lg-header">
          <div class="lg-eyebrow">
            <span>${editableSpan('meta.documentTitle', m.documentTitle, 'Tax Invoice')} · India</span>
            <span class="right">${editableSpan('meta.invoiceDate', m.invoiceDate, 'Issued')} → ${editableSpan('meta.dueDate', m.dueDate, 'Due')}</span>
          </div>
          <div class="lg-headline">
            <h1>${editableSpan('meta.invoiceLabel', m.invoiceLabel, 'Invoice')}<br><span class="accent">№ ${html(m.invoiceNo ? m.invoiceNo.split("/").pop() : "—")}</span></h1>
            <div class="meta-stack">
              <div class="n-label">Reference</div>
              <div class="n-val">${editableSpan('meta.invoiceNo', m.invoiceNo, 'Invoice No')}</div>
              <div class="dates">
                <div class="d-row"><span class="k">Issued</span><span class="v">${editableSpan('meta.invoiceDate', m.invoiceDate, 'Issued')}</span></div>
                <div class="d-row"><span class="k">Due</span><span class="v">${editableSpan('meta.dueDate', m.dueDate, 'Due')}</span></div>
                <div class="d-row"><span class="k">Terms</span><span class="v">${editableSpan('meta.paymentTerms', m.paymentTerms, 'Terms')}</span></div>
              </div>
            </div>
          </div>
          <div class="lg-brand-row" style="align-items: center;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <img src="omega_hires_logo.png" alt="Omega Hires" style="height: 38px; width: auto; align-self: flex-start;" />
              <div class="lg-tagline" style="font-family:'Barlow Condensed', sans-serif; font-size: 8.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--slate-500); font-weight: 600;">${editableSpan('company.tagline', c.tagline, 'Company Tagline')}</div>
              <div class="lg-subtagline" style="font-size: 8px; font-style: italic; color: var(--lime-dark); font-weight: 500;">${editableSpan('company.subTagline', c.subTagline, 'Company Sub-tagline')}</div>
            </div>
            <div class="ids">
              <div class="id-block"><div class="k">GSTIN</div><div class="v">${editableSpan('company.gstin', c.gstin, 'GSTIN')}</div></div>
              <div class="id-block"><div class="k">PAN</div><div class="v">${editableSpan('company.pan', c.pan, 'PAN')}</div></div>
              <div class="id-block"><div class="k">CIN</div><div class="v">${editableSpan('company.cin', c.cin, 'CIN')}</div></div>
            </div>
          </div>
        </div>
        <div class="lg-parties">
          <div class="col">
            <div class="label">From</div>
            <div class="name">${editableSpan('company.name', c.name, 'Company Name')}</div>
            <div class="info">
              <div>${editableSpan('company.address', c.address, 'Address', true)}</div>
              <div>${editableSpan('company.email', c.email, 'Email')} · ${editableSpan('company.phone', c.phone, 'Phone')}</div>
              <div>${editableSpan('company.website', c.website, 'Website')}</div>
            </div>
          </div>
          <div class="col">
            <div class="label">Billed To</div>
            <div class="name">${editableSpan('client.name', cl.name, 'Client Name')}</div>
            <div class="info">
              <div>Attn: ${editableSpan('client.contact', cl.contact, 'Contact')} · ${editableSpan('client.department', cl.department, 'Department')}</div>
              <div>${editableSpan('client.address', cl.address, 'Address', true)}</div>
              <div>${editableSpan('client.email', cl.email, 'Email')} · ${editableSpan('client.phone', cl.phone, 'Phone')}</div>
            </div>
            <span class="gst">${editableSpan('client.gstin', cl.gstin, 'GSTIN')}</span>
          </div>
        </div>
        ${recEnabled ? `
          <div class="lg-rec">
            <div class="lbl">Engagement<span class="sub">Recruitment placement</span></div>
            <div class="body">
              <div><div class="k">Candidate</div><div class="v">${editableSpan('recruitment.candidateName', r.candidateName, 'Candidate')}</div></div>
              <div><div class="k">Position</div><div class="v">${editableSpan('recruitment.position', r.position, 'Position')}</div></div>
              <div><div class="k">Type</div><div class="v">${editableSpan('recruitment.recruitmentType', r.recruitmentType, 'Type')}</div></div>
              <div><div class="k">Joined</div><div class="v">${editableSpan('recruitment.joiningDate', r.joiningDate, 'Joined')}</div></div>
              <div><div class="k">Replacement</div><div class="v">${editableSpan('recruitment.replacementPeriod', r.replacementPeriod, 'Period')}</div></div>
              <div><div class="k">Agreement</div><div class="v">${editableSpan('recruitment.serviceAgreementRef', r.serviceAgreementRef, 'Agreement')}</div></div>
            </div>
          </div>` : ""}
      `;
    } else {
      pageContent += `
        <div class="lg-header" style="padding: 32px 56px 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--ink); padding-bottom: 10px;">
            <img src="omega_hires_logo.png" alt="Omega Hires" style="height: 32px; width: auto;" />
            <div style="font-family:'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; color: var(--navy); letter-spacing: 0.05em; text-transform: uppercase;">
              Invoice № ${editableSpan('meta.invoiceNo', m.invoiceNo, 'Invoice No')} · Page ${pageNum}
            </div>
          </div>
        </div>
      `;
    }

    pageContent += `
      <div class="lg-items" style="margin-top: ${isFirstPage ? "0" : "20px"};">
        ${!isFirstPage ? `<div style="font-family:'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; color: var(--slate-500); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10px; padding-left: 6px;">Line Items (Continued)</div>` : ""}
        <table>
          <thead>
            <tr>
              <th class="c" style="width:36px">№</th>
              <th>Service</th>
              <th class="c" style="width:60px">Qty</th>
              <th class="r" style="width:100px">Rate</th>
              <th class="c" style="width:60px">GST</th>
              <th class="r" style="width:120px">Total</th>
            </tr>
          </thead>
          <tbody>
            ${renderRows(pageRows, startIdx)}
          </tbody>
        </table>
      </div>
    `;

    if (isLastPage) {
      pageContent += `
        <div class="lg-totals-wrap" style="margin-top: 20px;">
          <div class="lg-words">
            <div class="k">Amount in words (${html(m.currency)})</div>
            <div class="v">${html(numberToWords(tots.grand, m.currency))}</div>
          </div>
          <div class="lg-totals">
            <div class="row"><span>Subtotal</span><span class="v">${formatMoney(tots.subtotal)}</span></div>
            ${tots.discountVal > 0 ? `<div class="row neg"><span>Discount</span><span class="v">− ${formatMoney(tots.discountVal)}</span></div>` : ""}
            ${m.taxSystem === "CGST_SGST" ? `
              <div class="row"><span>CGST</span><span class="v">${formatMoney(tots.totalGst / 2)}</span></div>
              <div class="row"><span>SGST</span><span class="v">${formatMoney(tots.totalGst / 2)}</span></div>` :
              m.taxSystem === "IGST" ? `<div class="row"><span>IGST</span><span class="v">${formatMoney(tots.totalGst)}</span></div>` :
              `<div class="row"><span>Tax</span><span class="v">${formatMoney(0)}</span></div>`}
            <div class="grand"><span class="l">Total Due</span><span class="v">${formatMoney(tots.grand)}</span></div>
            ${tots.tdsVal > 0 ? `<div class="balance-line"><span>Less: TDS (${state.totals.tdsPercent}%)</span><span class="v">− ${formatMoney(tots.tdsVal)}</span></div>` : ""}
            ${state.totals.amountPaid > 0 ? `<div class="balance-line"><span>Less: Paid</span><span class="v">− ${formatMoney(state.totals.amountPaid)}</span></div>` : ""}
            <div class="balance-line" style="color:var(--navy);font-size:11px;border-top:1px dashed var(--slate-300);padding-top:6px;margin-top:6px;"><span>Balance Due</span><span class="v">${formatMoney(tots.balance)}</span></div>
          </div>
        </div>
      `;
    } else {
      pageContent += `<div style="height: 40px;"></div>`;
    }

    pageContent += renderBottomContent(pageNum, totalPages);

    return `
      <!-- PAGE ${pageNum} -->
      <div class="${densityClass}" ${pageBgStyle}>
        ${pageContent}
      </div>
    `;
  }).join("");
}

function templatePulse(tots, _isMultiPage = false) {
  const c = state.company;
  const m = state.meta;
  const cl = state.client;
  const r = state.recruitment;
  const statusClass = m.status === "PAID" ? "paid" : m.status === "OVERDUE" ? "overdue" : "unpaid";
  const statusLabel = m.status === "PAID" ? "Paid" : m.status === "OVERDUE" ? "Overdue" : "Awaiting Payment";
  const pageBgStyle = tweaks.paperBg === "cream" ? 'style="background: #fdfaf3;"' : "";
  const densityClass = `a4 pulse density-${tweaks.density || "regular"}`;

  function renderRows(rows, startIdx) {
    return rows.map((row, i) => `
      <div class="item-line">
        <div class="sr">${String(startIdx + i + 1).padStart(2, "0")}</div>
        <div class="codes">
          <div class="code">${editableSpan('items.' + (startIdx + i) + '.serviceCode', row.serviceCode, 'Code')}</div>
          <div class="sac">SAC ${editableSpan('items.' + (startIdx + i) + '.sacCode', row.sacCode, 'SAC')}</div>
        </div>
        <div class="desc">${editableSpan('items.' + (startIdx + i) + '.description', row.description, 'Description', true)}<span class="meta">${row.gstRate}% GST applied</span></div>
        <div class="qty">${row.qty}</div>
        <div class="rate">${formatMoney(row.rate)}</div>
        <div class="total">${formatMoney(row.rowTotal)}</div>
      </div>`).join("");
  }

  function renderBottomContent(pageNum, totalPages) {
    return `
      <div class="p-foot" style="position: absolute; bottom: 0; left: 0; right: 0; padding: 20px 40px 16px;">
        ${state.notes && state.notes.trim() ? `
        <div class="notes" style="margin: 0 0 14px 0; background: #fffbeb; padding: 10px 14px; border-radius: 8px; border-left: 3px solid var(--amber);"><span class="k" style="display: block; font-family: 'Barlow Condensed', sans-serif; font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; color: #92400e; font-weight: 700; margin-bottom: 3px;">Notes</span><div class="v" style="font-size: 9px; color: var(--slate-700); line-height: 1.5; white-space: pre-line;">${editableSpan('notes', state.notes, 'Notes', true)}</div></div>` : ""}
        <div class="p-foot-grid">
          <div>
            <div class="col-title">Payment Details</div>
            <div class="bank-line"><span class="k">Bank</span><span class="v">${editableSpan('payment.bankName', state.payment.bankName, 'Bank')}</span></div>
            <div class="bank-line"><span class="k">A/C No.</span><span class="v">${editableSpan('payment.acNo', state.payment.acNo, 'A/C No')}</span></div>
            <div class="bank-line"><span class="k">IFSC</span><span class="v">${editableSpan('payment.ifsc', state.payment.ifsc, 'IFSC')}</span></div>
            <div class="bank-line"><span class="k">Branch</span><span class="v">${editableSpan('payment.branch', state.payment.branch, 'Branch')}</span></div>
            ${state.payment.upiId ? `<div class="bank-line"><span class="k">UPI</span><span class="v">${editableSpan('payment.upiId', state.payment.upiId, 'UPI')}</span></div>` : ""}
          </div>
          <div>
            <div class="col-title">Terms</div>
            <ul class="terms-list">${state.terms.map((t, idx) => `<li>${editableSpan('terms.' + idx, t, 'Term')}</li>`).join("")}</ul>
          </div>
          <div class="sig-col">
            <div class="for">For</div>
            <div class="co">${editableSpan('company.name', c.name, 'Company')}</div>
            ${tweaks.signatureStyle === "handwritten" ? `<div class="hw">${editableSpan('authorizedSignatory', state.authorizedSignatory, 'Signatory')}</div>` : ""}
            ${tweaks.signatureStyle === "stamp" ? `<div style="display:inline-block; padding:4px 10px; border:2px solid var(--navy); border-radius:50%; color:var(--navy); font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; transform:rotate(-6deg); margin-bottom:2px;">APPROVED</div>` : ""}
            ${tweaks.signatureStyle === "image" ? `
              <div class="sig-img-wrap">
                ${state.signatureImage ? `<img src="${state.signatureImage}" class="sig-img" alt="Signature" />` : `<div class="sig-placeholder">No signature uploaded</div>`}
              </div>
            ` : ""}
            <div class="line">${editableSpan('authorizedSignatory', state.authorizedSignatory, 'Signatory')}</div>
            <div class="gen">Computer-generated invoice</div>
          </div>
        </div>
        ${totalPages > 1 ? `
        <div style="border-top: 1px solid var(--slate-200); padding-top: 10px; margin-top: 15px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: var(--slate-500); font-weight: 500; background: #fff;">
          <span>Page ${pageNum} of ${totalPages}</span>
          <span>Omega Hires India Private Limited · Invoice № ${html(m.invoiceNo)}</span>
          ${pageNum < totalPages ? `<span style="font-weight: 600; color: var(--lime-dark);">Continued on Page ${pageNum + 1} →</span>` : `<span>End of Document</span>`}
        </div>
        ` : ""}
      </div>
    `;
  }

  const recEnabled = recruitmentBlockData();
  
  // Calculate heights
  const headerHeight = 280;
  const partiesHeight = 140;
  const recHeight = recEnabled ? 110 : 0;
  const tblHeaderHeight = 38;
  
  const notesHeight = state.notes && state.notes.trim() ? (40 + Math.ceil(state.notes.length / 90) * 14) : 0;
  const termsHeight = state.terms.length * 15;
  const sigHeight = tweaks.signatureStyle === "image" ? 50 : 0;
  const footerBaseHeight = 160 + notesHeight + termsHeight + sigHeight;
  
  const totalsHeight = 160;
  
  // Available heights
  const singlePageAvailable = 1123 - (headerHeight + partiesHeight + recHeight + tblHeaderHeight + totalsHeight + footerBaseHeight);
  const page1Available = 1123 - (headerHeight + partiesHeight + recHeight + tblHeaderHeight + footerBaseHeight);
  const middlePageAvailable = 1123 - (70 + tblHeaderHeight + footerBaseHeight);
  const lastPageAvailable = 1123 - (70 + tblHeaderHeight + totalsHeight + footerBaseHeight);

  // Measure row heights
  const rowHeights = tots.rows.map(row => {
    const lines = Math.max(1, Math.ceil(row.description.length / 70));
    return 30 + lines * 15;
  });

  const totalRowsHeight = rowHeights.reduce((a, b) => a + b, 0);

  const pages = [];
  if (totalRowsHeight <= singlePageAvailable) {
    pages.push(tots.rows);
  } else {
    let currentPageRows = [];
    let currentHeight = 0;
    let pageIdx = 0;

    for (let i = 0; i < tots.rows.length; i++) {
      const rowHeight = rowHeights[i];
      let limit = pageIdx === 0 ? page1Available : middlePageAvailable;

      if (pageIdx > 0) {
        const remainingRowsHeight = rowHeights.slice(i).reduce((a, b) => a + b, 0);
        if (remainingRowsHeight + totalsHeight <= lastPageAvailable) {
          pages.push(currentPageRows);
          currentPageRows = tots.rows.slice(i);
          break;
        }
      }

      if (currentHeight + rowHeight > limit && currentPageRows.length > 0) {
        pages.push(currentPageRows);
        currentPageRows = [tots.rows[i]];
        currentHeight = rowHeight;
        pageIdx++;
      } else {
        currentPageRows.push(tots.rows[i]);
        currentHeight += rowHeight;
      }
    }
    if (pages.indexOf(currentPageRows) === -1) {
      pages.push(currentPageRows);
    }
    if (pages.length === 1 && totalRowsHeight > singlePageAvailable) {
      pages.push([]);
    }
  }

  const totalPages = pages.length;

  return pages.map((pageRows, pageIdx) => {
    const isFirstPage = pageIdx === 0;
    const isLastPage = pageIdx === totalPages - 1;
    const pageNum = pageIdx + 1;
    
    let startIdx = 0;
    for (let p = 0; p < pageIdx; p++) {
      startIdx += pages[p].length;
    }

    let pageContent = "";

    if (isFirstPage) {
      pageContent += `
        <div class="p-head">
          <div class="left">
            <img src="omega_hires_logo.png" alt="Omega Hires" />
            <div class="p-tagline" style="font-family:'Barlow Condensed', sans-serif; font-size: 8.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--slate-500); font-weight: 600; margin: 4px 0 2px;">${editableSpan('company.tagline', c.tagline, 'Company Tagline')}</div>
            <div class="p-subtagline" style="font-size: 8px; font-style: italic; color: var(--lime-dark); font-weight: 500; margin-bottom: 6px;">${editableSpan('company.subTagline', c.subTagline, 'Company Sub-tagline')}</div>
            <div class="co">${editableSpan('company.name', c.name, 'Company')}</div>
            <div class="info-row">${editableSpan('company.address', c.address, 'Address', true)}</div>
            <div class="info-row">${editableSpan('company.email', c.email, 'Email')} · ${editableSpan('company.phone', c.phone, 'Phone')} · ${editableSpan('company.website', c.website, 'Website')}</div>
            <div class="info-row" style="margin-top:6px;"><strong style="color:var(--navy);">GSTIN</strong> ${editableSpan('company.gstin', c.gstin, 'GSTIN')} · <strong style="color:var(--navy);">PAN</strong> ${editableSpan('company.pan', c.pan, 'PAN')}</div>
          </div>
          <div class="right">
            ${m.status !== "UNPAID" ? `<div class="badge"><span class="dot"></span>${html(statusLabel)}</div>` : ""}
            <div class="num">${editableSpan('meta.invoiceNo', m.invoiceNo, 'Invoice No')}</div>
            <div class="dates">
              <div class="row"><span class="k">Issued</span><span class="v">${editableSpan('meta.invoiceDate', m.invoiceDate, 'Issued')}</span></div>
              <div class="row"><span class="k">Due</span><span class="v">${editableSpan('meta.dueDate', m.dueDate, 'Due')}</span></div>
              <div class="row"><span class="k">Terms</span><span class="v">${editableSpan('meta.paymentTerms', m.paymentTerms, 'Terms')}</span></div>
            </div>
          </div>
        </div>
        <div class="p-amount-strip">
          <div>
            <div class="lbl">Amount Due</div>
            <div class="amount">${formatMoney(tots.balance)}</div>
          </div>
          <div class="due">
            <div class="k">Pay by</div>
            <div class="v">${editableSpan('meta.dueDate', m.dueDate, 'Due Date')}</div>
          </div>
        </div>
        <div class="p-parties">
          <div class="col from">
            <div class="lbl">From</div>
            <div class="name">${editableSpan('company.name', c.name, 'Company')}</div>
            <div class="info">
              <div>${editableSpan('company.address', c.address, 'Address', true)}</div>
              <div>${editableSpan('company.phone', c.phone, 'Phone')}</div>
            </div>
            <span class="gst">${editableSpan('company.gstin', c.gstin, 'GSTIN')}</span>
          </div>
          <div class="col bill">
            <div class="lbl">Billed To</div>
            <div class="name">${editableSpan('client.name', cl.name, 'Client')}</div>
            <div class="info">
              <div>${editableSpan('client.contact', cl.contact, 'Contact')} · ${editableSpan('client.department', cl.department, 'Department')}</div>
              <div>${editableSpan('client.address', cl.address, 'Address', true)}</div>
              <div>${editableSpan('client.email', cl.email, 'Email')} · ${editableSpan('client.phone', cl.phone, 'Phone')}</div>
            </div>
            <span class="gst">${editableSpan('client.gstin', cl.gstin, 'GSTIN')}</span>
          </div>
        </div>
        ${recEnabled ? `
          <div class="p-rec">
            <div class="head">
              <div class="icon">★</div>
              <div class="title">Recruitment Engagement</div>
            </div>
            <div class="grid">
              <div class="item"><div class="k">Candidate</div><div class="v">${editableSpan('recruitment.candidateName', r.candidateName, 'Candidate')}</div></div>
              <div class="item"><div class="k">Role</div><div class="v">${editableSpan('recruitment.position', r.position, 'Role')}</div></div>
              <div class="item"><div class="k">Type</div><div class="v">${editableSpan('recruitment.recruitmentType', r.recruitmentType, 'Type')}</div></div>
              <div class="item"><div class="k">Joined</div><div class="v">${editableSpan('recruitment.joiningDate', r.joiningDate, 'Joined')}</div></div>
              <div class="item"><div class="k">Replacement</div><div class="v">${editableSpan('recruitment.replacementPeriod', r.replacementPeriod, 'Period')}</div></div>
              <div class="item"><div class="k">Agreement</div><div class="v">${editableSpan('recruitment.serviceAgreementRef', r.serviceAgreementRef, 'Agreement')}</div></div>
            </div>
          </div>` : ""}
      `;
    } else {
      pageContent += `
        <div class="p-head" style="padding: 24px 40px 12px; border-bottom: 1px solid var(--slate-200);">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <img src="omega_hires_logo.png" alt="Omega Hires" style="height: 32px; width: auto;" />
            <div style="font-family:'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; color: var(--navy); letter-spacing: 0.05em; text-transform: uppercase;">
              Invoice № ${editableSpan('meta.invoiceNo', m.invoiceNo, 'Invoice No')} · Page ${pageNum}
            </div>
          </div>
        </div>
      `;
    }

    pageContent += `
      <div class="p-items" style="margin-top: ${isFirstPage ? "0" : "24px"};">
        <div class="row-hd">
          <div class="c">№</div>
          <div>Code</div>
          <div>Description</div>
          <div class="c">Qty</div>
          <div class="r">Rate</div>
          <div class="r">Total</div>
        </div>
        ${renderRows(pageRows, startIdx)}
      </div>
    `;

    if (isLastPage) {
      pageContent += `
        <div class="p-foot-wrap" style="margin-top: 20px;">
          <div class="p-side">
            <div class="words">
              <div class="k">Amount in words</div>
              <div class="v">${html(numberToWords(tots.grand, m.currency))}</div>
            </div>
          </div>
          <div class="p-totals">
            <div class="row"><span>Subtotal</span><span class="v">${formatMoney(tots.subtotal)}</span></div>
            ${tots.discountVal > 0 ? `<div class="row neg"><span>Discount</span><span class="v">− ${formatMoney(tots.discountVal)}</span></div>` : ""}
            ${m.taxSystem === "CGST_SGST" ? `
              <div class="row"><span>CGST</span><span class="v">${formatMoney(tots.totalGst / 2)}</span></div>
              <div class="row"><span>SGST</span><span class="v">${formatMoney(tots.totalGst / 2)}</span></div>` :
              m.taxSystem === "IGST" ? `<div class="row"><span>IGST</span><span class="v">${formatMoney(tots.totalGst)}</span></div>` :
              `<div class="row"><span>Tax</span><span class="v">${formatMoney(0)}</span></div>`}
            <div class="row grand"><span>Grand Total</span><span class="v">${formatMoney(tots.grand)}</span></div>
            ${tots.tdsVal > 0 ? `<div class="row neg"><span>TDS (${state.totals.tdsPercent}%)</span><span class="v">− ${formatMoney(tots.tdsVal)}</span></div>` : ""}
            ${state.totals.amountPaid > 0 ? `<div class="row neg"><span>Paid</span><span class="v">− ${formatMoney(state.totals.amountPaid)}</span></div>` : ""}
            <div class="row balance"><span>Balance Due</span><span class="v">${formatMoney(tots.balance)}</span></div>
          </div>
        </div>
      `;
    } else {
      pageContent += `<div style="height: 40px;"></div>`;
    }

    pageContent += renderBottomContent(pageNum, totalPages);

    return `
      <!-- PAGE ${pageNum} -->
      <div class="${densityClass}" ${pageBgStyle}>
        ${pageContent}
      </div>
    `;
  }).join("");
}

// ============================================================
// TOOLBAR
// ============================================================
function renderToolbar() {
  $("tb-crumb-num").textContent = state.meta.invoiceNo;
  $("tb-crumb-client").textContent = state.client.name;

  // Dynamically set document/tab title so that PDF export filename default is clean
  const cleanCompany = sanitizeForFilename((state.company.name || "Omega Hires").includes("Omega Hires") ? "Omega Hires" : (state.company.name || "Company").split(" ")[0]);
  const cleanClient = sanitizeForFilename((state.client.name || "Client").split(" ")[0]);
  const cleanInvoiceNo = sanitizeForFilename(state.meta.invoiceNo || "");
  
  const titleParts = [];
  if (cleanCompany) titleParts.push(cleanCompany);
  if (cleanClient) titleParts.push(cleanClient);
  if (cleanInvoiceNo) titleParts.push(cleanInvoiceNo);
  
  document.title = titleParts.join(" · ");

  const pill = $("tb-status");
  if (pill) {
    const s = state.meta.status;
    pill.className = `status-pill ${s === "PAID" ? "paid" : s === "OVERDUE" ? "overdue" : "unpaid"}`;
    pill.innerHTML = `<span class="dot"></span>${s === "PAID" ? "Paid" : s === "OVERDUE" ? "Overdue" : "Unpaid"}`;
  }

  document.querySelectorAll(".template-switch button").forEach(b => {
    b.classList.toggle("active", b.dataset.tmpl === (tweaks.template || "sovereign"));
  });
}

function renderFooterTotals() {
  const tots = calcTotals();
  $("ft-subtotal").textContent = formatMoney(tots.subtotal);
  $("ft-tax").textContent = formatMoney(tots.totalGst);
  $("ft-tds").textContent = `− ${formatMoney(tots.tdsVal)}`;
  $("ft-paid").textContent = `− ${formatMoney(state.totals.amountPaid)}`;
  $("ft-balance").textContent = formatMoney(tots.balance);
  renderToolbar();
}

// ============================================================
// ZOOM
// ============================================================
function zoomBy(delta) {
  setZoom(zoomFactor + delta);
}
function setZoom(z) {
  zoomFactor = Math.max(0.4, Math.min(1.6, z));
  $("canvas-stage").style.transform = `scale(${zoomFactor})`;
  $("zoom-val").textContent = Math.round(zoomFactor * 100) + "%";
}

// ============================================================
// TEMPLATE & TWEAKS
// ============================================================
function setTemplate(name) {
  tweaks.template = name;
  if (window.__broadcastTweak) window.__broadcastTweak({ template: name });
  renderInvoice();
  renderToolbar();
  showToast(`Switched to ${name.charAt(0).toUpperCase() + name.slice(1)} template`);
}

function applyTweakChange(newTweaks) {
  tweaks = { ...tweaks, ...newTweaks };
  renderInvoice();
  renderToolbar();
}

// ============================================================
// JUMP TO FIELD
// ============================================================
function jumpToField(rail, fieldId) {
  setActiveRail(rail);
  setTimeout(() => {
    const el = $(fieldId);
    if (el) {
      el.focus();
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 1200);
    }
  }, 50);
}

// ============================================================
// DRAFTS
// ============================================================
const DRAFT_KEY = "omega_hires_invoice_drafts_v2";
function loadDrafts() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "[]"); }
  catch { return []; }
}
function saveDrafts(arr) { localStorage.setItem(DRAFT_KEY, JSON.stringify(arr)); }

function saveCurrentDraft() {
  const drafts = loadDrafts();
  const tots = calcTotals();
  const draft = {
    id: "draft-" + Date.now(),
    savedAt: new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    invoiceNo: state.meta.invoiceNo || "Untitled",
    clientName: state.client.name || "Unnamed",
    totalDisplay: formatMoney(tots.grand),
    data: clone(state),
    tweaks: clone(tweaks)
  };
  const filtered = drafts.filter(d => d.data.meta.invoiceNo !== draft.invoiceNo);
  filtered.push(draft);
  saveDrafts(filtered);
  showToast(`Saved draft "${draft.invoiceNo}"`);
  renderDraftsPanel();
}

function loadDraft(id) {
  const drafts = loadDrafts();
  const d = drafts.find(x => x.id === id);
  if (!d) return;
  state = clone(d.data);
  if (d.tweaks) {
    tweaks = { ...tweaks, ...d.tweaks };
    if (window.__broadcastTweak) window.__broadcastTweak(d.tweaks);
  }
  renderAll();
  showToast(`Loaded "${d.invoiceNo}"`);
}

function deleteDraft(id) {
  const drafts = loadDrafts().filter(x => x.id !== id);
  saveDrafts(drafts);
  renderDraftsPanel();
  showToast("Draft deleted");
}

function loadSample() {
  state = clone(DEFAULT_STATE);
  renderAll();
  showToast("Sample invoice loaded");
}

function resetAll() {
  if (!confirm("Clear all fields? This wipes the current invoice.")) return;
  state = clone(DEFAULT_STATE);
  // empty out client / items / etc to start clean
  state.client = { name: "", contact: "", department: "", address: "", gstin: "", email: "", phone: "" };
  state.meta.invoiceNo = "";
  state.meta.poNumber = "";
  state.meta.vendorCode = "";
  state.items = [{ id: "item-1", serviceCode: "", sacCode: "", description: "", qty: 1, rate: 0, taxRate: 18 }];
  state.totals = { discount: 0, discountType: "FLAT", tdsPercent: 0, amountPaid: 0 };
  state.notes = "";
  state.recruitment.enabled = false;
  renderAll();
  showToast("Form cleared");
}

// ============================================================
// PRINT
// ============================================================
function printInvoice() {
  const cleanCompany = sanitizeForFilename((state.company.name || "Omega Hires").includes("Omega Hires") ? "Omega Hires" : (state.company.name || "Company").split(" ")[0]);
  const cleanClient = sanitizeForFilename((state.client.name || "Client").split(" ")[0]);
  const cleanInvoiceNo = sanitizeForFilename(state.meta.invoiceNo || "");
  
  const titleParts = [];
  if (cleanCompany) titleParts.push(cleanCompany);
  if (cleanClient) titleParts.push(cleanClient);
  if (cleanInvoiceNo) titleParts.push(cleanInvoiceNo);
  
  document.title = titleParts.join(" · ");

  // Notify the user to save inside the Billed directory
  showToast("Exporting PDF... Choose the 'Billed' folder in the save dialog", "warn");

  const prevZoom = zoomFactor;
  setZoom(1.0);
  setTimeout(() => {
    window.print();
    setTimeout(() => setZoom(prevZoom), 400);
  }, 100);
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg, kind = "ok") {
  const host = $("toast-host");
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.innerHTML = `<span class="toast-dot"></span><span>${html(msg)}</span>`;
  host.appendChild(t);
  setTimeout(() => {
    t.classList.add("leaving");
    setTimeout(() => t.remove(), 250);
  }, 2400);
}

// ============================================================
// INIT
// ============================================================
function renderAll() {
  renderSidebar();
  renderInvoice();
  renderToolbar();
  renderFooterTotals();
}

window.addEventListener("DOMContentLoaded", () => {
  // Rail buttons
  document.querySelectorAll(".sb-rail-btn").forEach(btn => {
    btn.addEventListener("click", () => setActiveRail(btn.dataset.rail));
  });
  // Template switch
  document.querySelectorAll(".template-switch button").forEach(btn => {
    btn.addEventListener("click", () => setTemplate(btn.dataset.tmpl));
  });
  setActiveRail("client");
  setZoom(zoomFactor);
  renderAll();

  // Universal Inline Editing Event Delegation
  const stage = $("canvas-stage");
  if (stage) {
    // 1. Save changes on blur
    stage.addEventListener("blur", (e) => {
      const path = e.target.dataset.path;
      if (!path) return;
      
      let val = e.target.textContent;
      if (e.target.dataset.type === "number") {
        val = Number(val) || 0;
      }
      
      setByPath(state, path, val);
      renderSidebar();
      renderFooterTotals();
      renderInvoice();
    }, true);

    // 2. Prevent Enter key from creating newlines in single-line fields
    stage.addEventListener("keydown", (e) => {
      const path = e.target.dataset.path;
      if (!path) return;
      if (e.key === "Enter" && !e.target.classList.contains("multiline")) {
        e.preventDefault();
        e.target.blur();
      }
    });

    // 3. Switch sidebar rail and focus sidebar input when canvas field is focused
    stage.addEventListener("focus", (e) => {
      const path = e.target.dataset.path;
      if (!path) return;
      
      let rail = "client";
      if (path.startsWith("company.")) rail = "company";
      else if (path.startsWith("meta.")) rail = "details";
      else if (path.startsWith("client.")) rail = "client";
      else if (path.startsWith("recruitment.")) rail = "recruitment";
      else if (path.startsWith("payment.")) rail = "payment";
      else if (path.startsWith("terms") || path.startsWith("notes") || path === "authorizedSignatory") rail = "notes";
      
      setActiveRail(rail);
      
      // Also highlight the sidebar field if it exists
      // Convert path dots and array indexes (e.g. company.name -> company-name, terms[i] -> notes panel elements)
      const fieldId = path.replace(".", "-");
      const sidebarEl = $(fieldId);
      if (sidebarEl) {
        sidebarEl.classList.add("flash");
        setTimeout(() => sidebarEl.classList.remove("flash"), 1200);
      }
    }, true);
  }
});

// Expose for tweaks panel
window.__omega = {
  getTweaks: () => tweaks,
  setTweaks: (t) => applyTweakChange(t),
  state: () => state
};

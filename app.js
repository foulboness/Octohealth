(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const KEYS = {
    users: "bgai_users_v1",
    session: "bgai_session_v1",
    data: "bgai_data_v1",
    prefs: "bgai_prefs_v1",
  };
  const pages = [
    "overview",
    "checker",
    "bills",
    "savings",
    "history",
    "guide",
    "letters",
    "settings",
    "help",
  ];
  const state = {
    authMode: "login",
    user: null,
    data: null,
    prefs: { currency: "ZAR", compact: true, dark: false },
    selectedFiles: [],
    billView: "grid",
    activeBillId: null,
    toastTimer: null,
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const id = () =>
    "bg_" +
    Math.random().toString(36).slice(2, 9) +
    Date.now().toString(36).slice(-4);
  const safe = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const load = (key, fallback) => {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  };
  const save = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      toast(
        "Browser storage is full. Export your data and remove large records.",
      );
      return false;
    }
  };
  const money = (n) => {
    const currency = state.prefs.currency || "ZAR";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(n) || 0);
    } catch {
      return `${currency} ${(Number(n) || 0).toFixed(2)}`;
    }
  };
  const fmtDate = (d) => {
    if (!d) return "Date not provided";
    const date = new Date(`${d}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? d
      : date.toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
  };
  const toast = (message) => {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  };
  const blankData = () => ({
    bills: [],
    items: [],
    audits: [],
    letterDraft: "",
  });
  const currentUsers = () => load(KEYS.users, []);
  const persist = () =>
    state.user
      ? save(KEYS.data + "_" + state.user.email, state.data)
      : save(KEYS.data, state.data);
  const saveAudit = (bill, action = "Analysis saved") => {
    state.data.audits.unshift({
      id: id(),
      billId: bill.id,
      billName: bill.name,
      provider: bill.provider,
      action,
      date: new Date().toISOString(),
      flagCount: itemsFor(bill.id).filter(isFlagged).length,
    });
    state.data.audits = state.data.audits.slice(0, 150);
  };
  const itemsFor = (billId) =>
    state.data.items.filter((x) => x.billId === billId);
  const isFlagged = (item) => item.issue && item.issue !== "No automated flag";
  const flagCount = (items) => items.filter(isFlagged).length;
  const billStatus = (bill) => {
    const its = itemsFor(bill.id);
    if (bill.followUp) return "Follow-up";
    if (!its.length) return bill.status || "Needs review";
    if (its.some((x) => isFlagged(x) && x.status === "Needs review"))
      return "Needs review";
    if (its.some((x) => isFlagged(x) && x.status === "Follow-up"))
      return "Follow-up";
    return "Reviewed";
  };
  function applyPrefs() {
    document.body.classList.toggle("dark", !!state.prefs.dark);
    document.body.classList.toggle("compact", !!state.prefs.compact);
    $("#themeToggle").textContent = state.prefs.dark ? "☀" : "☾";
  }
  function setAuthMode(mode) {
    state.authMode = mode;
    $$(".auth-tab").forEach((b) =>
      b.classList.toggle("active", b.dataset.authMode === mode),
    );
    $("#nameWrap").classList.toggle("hidden", mode === "login");
    $("#authName").required = mode === "signup";
    $("#authTitle").textContent =
      mode === "login" ? "Welcome back" : "Create your workspace";
    $("#authSubtitle").textContent =
      mode === "login"
        ? "Sign in to continue reviewing your bills."
        : "A few details and your demo workspace is ready.";
    $("#authSubmit").innerHTML =
      mode === "login"
        ? "Sign in <span>→</span>"
        : "Create account <span>→</span>";
    $("#authPassword").autocomplete =
      mode === "login" ? "current-password" : "new-password";
  }
  function enterApp(user) {
    state.user = user;
    state.data = load(KEYS.data + "_" + user.email, blankData());
    state.prefs = {
      ...state.prefs,
      ...load(KEYS.prefs + "_" + user.email, {}),
    };
    save(KEYS.session, { email: user.email });
    $("#authView").classList.add("hidden");
    $("#appView").classList.remove("hidden");
    $("#profileName").textContent = user.name || "Demo User";
    $("#profileEmail").textContent = user.email;
    $("#profileAvatar").textContent = (user.name || user.email || "M")
      .trim()
      .charAt(0)
      .toUpperCase();
    $("#topAvatar").textContent = $("#profileAvatar").textContent;
    $("#greetingName").textContent = (user.name || "there").split(" ")[0];
    $("#todayLabel").textContent = new Date().toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    applyPrefs();
    fillSettings();
    renderAll();
    showPage("overview");
  }
  function exitApp() {
    localStorage.removeItem(KEYS.session);
    state.user = null;
    state.data = null;
    $("#appView").classList.add("hidden");
    $("#authView").classList.remove("hidden");
    $("#authForm").reset();
    setAuthMode("login");
  }

  
  function showPage(page) {
    if (!pages.includes(page)) page = "overview";
    $$(".page").forEach((p) =>
      p.classList.toggle("active", p.id === `page-${page}`),
    );
    $$(".nav-item[data-page]").forEach((b) =>
      b.classList.toggle("active", b.dataset.page === page),
    );
    $("#pageCrumb").textContent =
      page === "overview"
        ? "Overview"
        : page === "checker"
          ? "Code Checker"
          : page === "bills"
            ? "My Bills"
            : page === "savings"
              ? "Savings Insights"
              : page === "history"
                ? "Audit History"
                : page === "guide"
                  ? "Billing Guide"
                  : page === "letters"
                    ? "Dispute Letter Studio"
                    : page === "settings"
                      ? "Settings"
                      : "Help & Support";
    $("#sidebar").classList.remove("open");
    if (page === "letters" && !$("#letterPreview").value) generateLetter();
  }
  function renderAll() {
    if (!state.data) return;
    renderOverview();
    renderChecker();
    renderBills();
    renderSavings();
    renderHistory();
    renderNavCount();
  }
  function renderNavCount() {
    $("#flagNavCount").textContent = state.data.items.filter(
      (x) => isFlagged(x) && x.status === "Needs review",
    ).length;
  }
  function renderOverview() {
    const bills = state.data.bills;
    const items = state.data.items;
    const flagged = items.filter(isFlagged);
    $("#statReviewed").textContent = bills.filter(
      (b) => b.status === "Reviewed" || billStatus(b) === "Reviewed",
    ).length;
    $("#statFlags").textContent = flagged.length;
    $("#statAmount").textContent = money(
      flagged.reduce((s, x) => s + Number(x.amount || 0), 0),
    );
    $("#statPending").textContent = items.filter(
      (x) => isFlagged(x) && x.status === "Needs review",
    ).length;
    const list = $("#recentBills");
    const recent = [...bills]
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 4);
    if (!recent.length) {
      list.innerHTML = `<div class="empty-state" style="padding:25px 10px"><span class="empty-icon">▤</span><h3>No bills yet</h3><p>Upload a statement to start your first review.</p><button class="btn btn-secondary" data-action="upload">Upload a bill</button></div>`;
    } else {
      list.innerHTML = recent
        .map(
          (b) =>
            `<div class="recent-row"><div class="file-icon">${b.fileType === "PDF" ? "▧" : "▣"}</div><div class="recent-info"><strong>${safe(b.name)}</strong><small>${safe(b.provider || "Provider not added")} · ${fmtDate(b.billDate || b.createdAt?.slice(0, 10))}</small></div><span class="status-pill ${statusClass(billStatus(b))}">${safe(billStatus(b))}</span></div>`,
        )
        .join("");
    }
  }
  function statusClass(status) {
    return status === "Reviewed"
      ? "status-reviewed"
      : status === "Follow-up"
        ? "status-follow"
        : status === "New"
          ? "status-new"
          : "status-needs";
  }
  function renderChecker() {
    const query = ($("#codeSearch")?.value || "").toLowerCase();
    const sev = $("#severityFilter")?.value || "all";
    const bill = $("#codeBillFilter")?.value || "all";
    const select = $("#codeBillFilter");
    const old = select.value;
    select.innerHTML =
      '<option value="all">All bills</option>' +
      state.data.bills
        .map((b) => `<option value="${safe(b.id)}">${safe(b.name)}</option>`)
        .join("");
    if ([...select.options].some((o) => o.value === old)) select.value = old;
    let items = state.data.items.filter((x) => {
      const b = state.data.bills.find((z) => z.id === x.billId);
      const hay =
        `${x.code} ${x.description} ${x.issue} ${b?.name || ""}`.toLowerCase();
      return (
        hay.includes(query) &&
        (bill === "all" || x.billId === bill) &&
        (sev === "all" || x.severity === sev)
      );
    });
    $("#codeTableBody").innerHTML = items.length
      ? items
          .map(
            (x) =>
              `<tr><td><div class="code-cell"><strong>${safe(x.code || "No code entered")}</strong><small>${safe(x.description || "Description not provided")}</small></div></td><td><div class="issue-text">${safe(x.issue || "No automated flag")}<br><small style="color:#a39daf">${safe(x.billName || state.data.bills.find((b) => b.id === x.billId)?.name || "")}</small></div></td><td>${money(x.amount)}</td><td><span class="priority-pill priority-${safe(x.severity || "low")}">${safe((x.severity || "low").toUpperCase())}</span></td><td><select class="status-select" data-item-status="${safe(x.id)}"><option ${x.status === "Needs review" ? "selected" : ""}>Needs review</option><option ${x.status === "Follow-up" ? "selected" : ""}>Follow-up</option><option ${x.status === "Reviewed" ? "selected" : ""}>Reviewed</option><option ${x.status === "Explained" ? "selected" : ""}>Explained</option></select></td><td><button class="row-action" data-item-detail="${safe(x.id)}" aria-label="View item">↗</button></td></tr>`,
          )
          .join("")
      : `<tr><td colspan="6"><div class="empty-state" style="padding:35px 10px"><span class="empty-icon">⌕</span><h3>No matching line items</h3><p>Upload a bill, then add its line items to run the demo checks.</p><button class="btn btn-secondary" data-action="upload">Add a bill</button></div></td></tr>`;
    $("#codeResultCount").textContent =
      `${items.length} line item${items.length === 1 ? "" : "s"}`;
  }
  function renderBills() {
    const q = ($("#billSearch")?.value || "").toLowerCase();
    const filter = $("#billStatusFilter")?.value || "all";
    const bills = state.data.bills.filter(
      (b) =>
        `${b.name} ${b.provider} ${b.reference}`.toLowerCase().includes(q) &&
        (filter === "all" || billStatus(b) === filter),
    );
    const grid = $("#billsGrid");
    grid.classList.toggle("list-view", state.billView === "list");
    $$("[data-bill-view]").forEach((b) =>
      b.classList.toggle("active", b.dataset.billView === state.billView),
    );
    $("#billsEmpty").classList.toggle("hidden", bills.length !== 0);
    grid.classList.toggle("hidden", !bills.length);
    grid.innerHTML = bills
      .map((b) => {
        const its = itemsFor(b.id);
        const f = flagCount(its);
        return `<article class="bill-card"><div class="bill-card-top"><div class="file-icon">${b.fileType === "PDF" ? "▧" : "▣"}</div><span class="status-pill ${statusClass(billStatus(b))}">${safe(billStatus(b))}</span></div><h3 title="${safe(b.name)}">${safe(b.name)}</h3><div class="bill-provider">${safe(b.provider || "Provider not specified")} · ${fmtDate(b.billDate || b.createdAt?.slice(0, 10))}</div><div class="bill-amount">${money(b.amount)}</div><div class="bill-provider">${f} charge${f === 1 ? "" : "s"} flagged · ${its.length} line item${its.length === 1 ? "" : "s"}</div><div class="bill-card-foot"><small>${safe(b.reference || "No reference added")}</small><div class="bill-card-actions"><button class="mini-btn" data-bill-detail="${safe(b.id)}">Open review ↗</button><button class="mini-btn" data-bill-delete="${safe(b.id)}" title="Remove bill">×</button></div></div></article>`;
      })
      .join("");
  }
  function renderSavings() {
    const flagged = state.data.items.filter(isFlagged);
    $("#insightAmount").textContent = money(
      flagged.reduce((s, x) => s + Number(x.amount || 0), 0),
    );
    $("#insightFlags").textContent = flagged.length;
    $("#insightOpen").textContent = flagged.filter(
      (x) => x.status === "Needs review" || x.status === "Follow-up",
    ).length;
    $("#insightResolved").textContent = flagged.filter(
      (x) => x.status === "Reviewed" || x.status === "Explained",
    ).length;
    const rows = state.data.bills
      .map((b) => ({ b, its: itemsFor(b.id).filter(isFlagged) }))
      .filter((x) => x.its.length);
    $("#savingsBreakdown").innerHTML = rows.length
      ? rows
          .map(
            ({ b, its }) =>
              `<div class="breakdown-row"><div><strong>${safe(b.name)}</strong><small>${safe(b.provider || "Provider not specified")} · ${its.length} flagged item${its.length === 1 ? "" : "s"}</small></div><div class="breakdown-amount">${money(its.reduce((s, x) => s + Number(x.amount || 0), 0))}</div><button class="text-button" data-bill-detail="${safe(b.id)}">Review →</button></div>`,
          )
          .join("")
      : `<div class="empty-state" style="padding:25px"><span class="empty-icon">↗</span><h3>No flagged charges yet</h3><p>Once line items are entered and checked, their amounts appear here.</p><button class="btn btn-secondary" data-page="checker">Open Code Checker</button></div>`;
  }
  function renderHistory() {
    const list = $("#historyList");
    $("#historyCount").textContent =
      `${state.data.audits.length} RECORD${state.data.audits.length === 1 ? "" : "S"}`;
    list.innerHTML = state.data.audits.length
      ? state.data.audits
          .map(
            (a) =>
              `<div class="history-row"><div class="file-icon">◷</div><div class="history-info"><strong>${safe(a.billName || "Bill review")}</strong><small>${safe(a.action)} · ${fmtDate((a.date || "").slice(0, 10))} · ${Number(a.flagCount) || 0} flagged item${a.flagCount === 1 ? "" : "s"}</small></div><div class="history-actions">${a.billId && state.data.bills.some((b) => b.id === a.billId) ? `<button class="mini-btn" data-bill-detail="${safe(a.billId)}">Reopen ↗</button>` : ""}</div></div>`,
          )
          .join("")
      : `<div class="empty-state" style="padding:35px"><span class="empty-icon">◷</span><h3>Your audit trail will appear here</h3><p>Save a bill review to create your first history record.</p></div>`;
  }
  function analyzeLineItem(item) {
    const amount = Number(item.amount) || 0;
    const qty = Number(item.quantity) || 1;
    const unit = Number(item.unitAmount) || 0;
    const code = String(item.code || "")
      .trim()
      .toUpperCase();
    let issue = "No automated flag",
      severity = "low",
      steps = [
        "Compare the line item with your itemized statement.",
        "Ask the provider to explain the service, code, and amount if unclear.",
      ];
    const siblings = state.data.items.filter(
      (x) => x.billId === item.billId && x.id !== item.id,
    );
    const duplicate = siblings.find(
      (x) =>
        String(x.code || "")
          .trim()
          .toUpperCase() === code &&
        String(x.description || "")
          .trim()
          .toLowerCase() ===
          String(item.description || "")
            .trim()
            .toLowerCase() &&
        code &&
        item.description,
    );
    if (qty > 1 && unit > 0 && Math.abs(amount - qty * unit) > 0.02) {
      issue = "Amount does not match quantity × unit amount";
      severity = "high";
      steps = [
        "Recalculate quantity multiplied by unit amount.",
        "Check whether tax, discounts, or adjustments explain the difference.",
        "Ask the billing office for an itemized calculation.",
      ];
    } else if (duplicate) {
      issue = "Possible duplicate code and description";
      severity = "high";
      steps = [
        "Compare service dates, units, provider, and modifiers for both entries.",
        "Ask whether each entry represents a separate service.",
        "Request supporting documentation before disputing the charge.",
      ];
    } else if (!code) {
      issue = "Billing code missing from entered details";
      severity = "medium";
      steps = [
        "Request the billing code and plain-language description.",
        "Confirm which code set and year applies.",
      ];
    } else if (!item.description || item.description.trim().length < 4) {
      issue = "Description may be incomplete";
      severity = "medium";
      steps = [
        "Request the full line-item description.",
        "Match the description to the service date and clinical record.",
      ];
    } else if (amount < 0) {
      issue = "Negative amount requires context";
      severity = "medium";
      steps = [
        "Check whether this is a credit or adjustment.",
        "Ask how it affects the final patient balance.",
      ];
    } else if (amount === 0) {
      issue = "Zero-dollar line item — confirm its meaning";
      severity = "low";
      steps = [
        "Check whether this line is informational or adjusted to zero.",
        "Confirm it is not included in the patient balance.",
      ];
    } else if (/misc|other|unlisted|unknown/i.test(item.description)) {
      issue = "Generic description may need clarification";
      severity = "medium";
      steps = [
        "Request the specific service, supply, or procedure represented.",
        "Ask for documentation supporting the charge.",
      ];
    }
    return { ...item, issue, severity, steps };
  }
  function addBillFromFiles() {
    if (!state.selectedFiles.length) {
      toast("Choose at least one PDF or image first.");
      return;
    }
    const provider = $("#uploadProvider").value.trim();
    const reference = $("#uploadReference").value.trim();
    const amount = Number($("#uploadAmount").value) || 0;
    const files = state.selectedFiles.slice();
    files.forEach((file, index) => {
      const bill = {
        id: id(),
        name: file.name,
        provider,
        reference,
        amount: amount && index === 0 ? amount : 0,
        fileType:
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf")
            ? "PDF"
            : "Image",
        fileSize: file.size,
        billDate: today(),
        createdAt: new Date().toISOString(),
        status: "Needs review",
        followUp: false,
      };
      state.data.bills.unshift(bill);
      saveAudit(bill, "Bill added — line items awaiting review");
    });
    persist();
    state.selectedFiles = [];
    $("#fileInput").value = "";
    $("#uploadFileList").innerHTML = "";
    $("#uploadProvider").value = "";
    $("#uploadReference").value = "";
    $("#uploadAmount").value = "";
    $("#createBill").disabled = true;
    closeModal();
    renderAll();
    showPage("bills");
    const bill = state.data.bills[0];
    openBillDetail(bill.id);
    toast("Bill added. Add the line items to run review checks.");
  }
  function openBillDetail(billId) {
    const bill = state.data.bills.find((b) => b.id === billId);
    if (!bill) return;
    state.activeBillId = billId;
    const its = itemsFor(billId);
    $("#detailContent").innerHTML =
      `<div class="detail-top"><div><div class="eyebrow">BILL REVIEW</div><h2>${safe(bill.name)}</h2><p class="muted">${safe(bill.provider || "Provider not specified")} · ${fmtDate(bill.billDate)}</p></div><span class="status-pill ${statusClass(billStatus(bill))}">${safe(billStatus(bill))}</span></div><div class="detail-grid"><div class="detail-box"><span>Bill total</span><strong>${money(bill.amount)}</strong></div><div class="detail-box"><span>Flagged charges</span><strong>${its.filter(isFlagged).length} item(s) · ${money(its.filter(isFlagged).reduce((s, x) => s + Number(x.amount || 0), 0))}</strong></div><div class="detail-box"><span>Reference</span><strong>${safe(bill.reference || "Not provided")}</strong></div><div class="detail-box"><span>Document</span><strong>${safe(bill.fileType)} · ${formatBytes(bill.fileSize || 0)}</strong></div></div><div class="detail-section"><h4>Line items & demo checks</h4><p>Enter details from the itemized statement. Basic checks look for duplicate-looking entries, missing descriptions, and arithmetic differences. They are not official code validation.</p><div class="table-scroll"><table><thead><tr><th>CODE / DESCRIPTION</th><th>AMOUNT</th><th>FLAG</th><th></th></tr></thead><tbody>${its.length ? its.map((x) => `<tr><td><div class="code-cell"><strong>${safe(x.code || "No code")}</strong><small>${safe(x.description)}</small></div></td><td>${money(x.amount)}</td><td><span class="priority-pill priority-${safe(x.severity)}">${safe(x.severity.toUpperCase())}</span></td><td><button class="row-action" data-item-detail="${safe(x.id)}">↗</button></td></tr>`).join("") : '<tr><td colspan="4" style="padding:18px;color:#9d97aa">No line items entered yet.</td></tr>'}</tbody></table></div></div><div class="detail-section"><h4>Add a line item</h4><form id="addItemForm" class="letter-form"><div class="form-row"><label class="field">Billing code<input name="code" placeholder="e.g. CODE-123"></label><label class="field">Description<input name="description" placeholder="Service / supply description" required></label></div><div class="form-row"><label class="field">Quantity<input name="quantity" type="number" min="0.01" step="any" value="1" required></label><label class="field">Unit amount<input name="unitAmount" type="number" min="0" step="0.01" placeholder="Optional"></label></div><label class="field">Line total<input name="amount" type="number" min="0" step="0.01" placeholder="Amount charged" required></label><button class="btn btn-primary" type="submit">＋ Add line item & check</button></form></div><div class="detail-actions"><button class="btn btn-secondary" data-action="letter-from-bill" data-bill-id="${safe(bill.id)}">Draft query letter</button><button class="btn btn-secondary" data-action="save-review" data-bill-id="${safe(bill.id)}">Save review</button><button class="btn btn-primary" data-close-modal>Done</button></div>`;
    $("#detailModal").classList.remove("hidden");
  }
  function openItemDetail(itemId) {
    const x = state.data.items.find((z) => z.id === itemId);
    if (!x) return;
    const bill = state.data.bills.find((b) => b.id === x.billId);
    $("#detailContent").innerHTML =
      `<div class="detail-top"><div><div class="eyebrow">LINE ITEM REVIEW</div><h2>${safe(x.code || "Uncoded line item")}</h2><p class="muted">${safe(x.description)}</p></div><span class="priority-pill priority-${safe(x.severity)}">${safe(x.severity.toUpperCase())}</span></div><div class="detail-grid"><div class="detail-box"><span>Amount</span><strong>${money(x.amount)}</strong></div><div class="detail-box"><span>Source bill</span><strong>${safe(bill?.name || "Unknown bill")}</strong></div><div class="detail-box"><span>Possible issue</span><strong>${safe(x.issue || "No automated flag")}</strong></div><div class="detail-box"><span>Review status</span><strong>${safe(x.status)}</strong></div></div><div class="detail-section"><h4>Suggested verification steps</h4><ul>${(x.steps || []).map((s) => `<li>${safe(s)}</li>`).join("")}</ul><p>These are preliminary prompts generated by simple demo rules, not a determination that the charge is incorrect.</p></div><div class="detail-actions"><button class="btn btn-secondary" data-action="letter-from-item" data-item-id="${safe(x.id)}">Draft query letter</button><button class="btn btn-secondary" data-action="toggle-item-status" data-item-id="${safe(x.id)}">Mark reviewed</button><button class="btn btn-primary" data-close-modal>Close</button></div>`;
    $("#detailModal").classList.remove("hidden");
  }
  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  function closeModal() {
    $$(".modal-backdrop").forEach((m) => m.classList.add("hidden"));
  }
  function openUpload() {
    state.selectedFiles = [];
    $("#uploadFileList").innerHTML = "";
    $("#createBill").disabled = true;
    $("#uploadModal").classList.remove("hidden");
  }
  function addFiles(files) {
    const allowed = [...files].filter(
      (f) =>
        f.type === "application/pdf" ||
        f.type.startsWith("image/") ||
        /\.pdf$/i.test(f.name),
    );
    const tooBig = allowed.filter((f) => f.size > 20 * 1024 * 1024);
    state.selectedFiles = [
      ...state.selectedFiles,
      ...allowed.filter((f) => f.size <= 20 * 1024 * 1024),
    ];
    if (tooBig.length) toast("Files over 20 MB were skipped.");
    if (!allowed.length) toast("Choose a PDF or image file.");
    $("#uploadFileList").innerHTML = state.selectedFiles
      .map(
        (f, i) =>
          `<div class="upload-file"><span>${f.type === "application/pdf" ? "▧" : "▣"}</span><span>${safe(f.name)} · ${formatBytes(f.size)}</span><button type="button" data-remove-file="${i}" aria-label="Remove file">×</button></div>`,
      )
      .join("");
    $("#createBill").disabled = !state.selectedFiles.length;
  }
  function generateLetter() {
    const name =
      $("#letterName").value.trim() || state.user?.name || "[Your full name]";
    const provider =
      $("#letterProvider").value.trim() || "[Hospital / provider name]";
    const account = $("#letterAccount").value.trim();
    const date = $("#letterDate").value
      ? fmtDate($("#letterDate").value)
      : fmtDate(today());
    const charges =
      $("#letterCharges").value.trim() ||
      "[List the specific charge(s), code(s), service date(s), and amount(s)]";
    const reason = $("#letterReason").value;
    const details = $("#letterDetails").value.trim();
    const text = `${name}\n${date}\n\nBilling Department\n${provider}\n\nSubject: Request for clarification and review of hospital bill${account ? ` — Account / invoice: ${account}` : ""}\n\nDear Billing Team,\n\nI am writing to request clarification and a review of charges on my statement${account ? ` associated with account ${account}` : ""}. I would appreciate an itemized explanation before drawing any conclusions about the entries.\n\nReason for this request: ${reason}.\n\nCharges I would like you to review:\n${charges}\n\n${details ? `Additional context:\n${details}\n\n` : ""}Please provide the full description and applicable code set for each item, the service date and quantity, and any supporting itemization or documentation needed to understand how the amount was calculated. If an entry appears more than once, please explain whether each entry represents a separate service. Please also explain how any adjustments and payments were applied to the current patient balance.\n\nWhile this review is pending, please let me know whether collection activity or the due date can be paused, if applicable. If an adjustment is warranted, I would appreciate a corrected statement and written confirmation.\n\nPlease confirm receipt of this request and provide a reference number for follow-up. Thank you for your assistance.\n\nSincerely,\n${name}\n[Preferred contact information]`;
    $("#letterPreview").value = text;
    state.data.letterDraft = text;
    persist();
    return text;
  }
  function fillSettings() {
    if (!state.user) return;
    $("#settingName").value = state.user.name || "";
    $("#settingEmail").value = state.user.email || "";
    $("#settingCurrency").value = state.prefs.currency || "ZAR";
    $("#settingCompact").checked = !!state.prefs.compact;
    $("#settingDark").checked = !!state.prefs.dark;
  }
  function saveSettings() {
    const name = $("#settingName").value.trim() || "Demo User";
    const email = $("#settingEmail").value.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast("Enter a valid email address.");
      return;
    }
    const users = currentUsers();
    const collision = users.find(
      (u) => u.email === email && u.email !== state.user.email,
    );
    if (collision) {
      toast("That email is already used in this browser.");
      return;
    }
    const oldEmail = state.user.email;
    const updated = { ...state.user, name, email };
    save(
      KEYS.users,
      users.map((u) => (u.email === oldEmail ? updated : u)),
    );
    if (email !== oldEmail) {
      const d = load(KEYS.data + "_" + oldEmail, state.data);
      save(KEYS.data + "_" + email, d);
      localStorage.removeItem(KEYS.data + "_" + oldEmail);
      const p = load(KEYS.prefs + "_" + oldEmail, state.prefs);
      save(KEYS.prefs + "_" + email, p);
      localStorage.removeItem(KEYS.prefs + "_" + oldEmail);
    }
    state.user = updated;
    state.prefs = {
      ...state.prefs,
      currency: $("#settingCurrency").value,
      compact: $("#settingCompact").checked,
      dark: $("#settingDark").checked,
    };
    save(KEYS.prefs + "_" + email, state.prefs);
    save(KEYS.session, { email });
    save(KEYS.data + "_" + email, state.data);
    applyPrefs();
    enterApp(updated);
    toast("Settings saved.");
  }
  function downloadText(filename, text, mime = "text/plain") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function exportData() {
    downloadText(
      "octohealth-demo-data.json",
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          profile: { name: state.user.name, email: state.user.email },
          preferences: state.prefs,
          data: state.data,
        },
        null,
        2,
      ),
      "application/json",
    );
    toast("Demo data export prepared.");
  }
  function seedDemoIfAsked() {
    const bill = {
      id: id(),
      name: "Sample hospital statement.pdf",
      provider: "Example Medical Centre",
      reference: "DEMO-1042",
      amount: 2840,
      billDate: today(),
      createdAt: new Date().toISOString(),
      fileType: "PDF",
      fileSize: 0,
      status: "Needs review",
    };
    state.data.bills.unshift(bill);
    const base = [
      {
        code: "DEMO-101",
        description: "Consultation fee",
        quantity: 1,
        unitAmount: 850,
        amount: 850,
      },
      {
        code: "DEMO-204",
        description: "Laboratory panel",
        quantity: 2,
        unitAmount: 495,
        amount: 990,
      },
      {
        code: "DEMO-204",
        description: "Laboratory panel",
        quantity: 2,
        unitAmount: 495,
        amount: 990,
      },
    ];
    base.forEach((raw, i) => {
      const x = analyzeLineItem({
        ...raw,
        id: id(),
        billId: bill.id,
        billName: bill.name,
        status: "Needs review",
      });
      state.data.items.push(x);
    });
    saveAudit(bill, "Sample demo analysis created");
    persist();
    renderAll();
    showPage("checker");
    toast("Sample data added. It is clearly illustrative, not a real bill.");
  }

  $$(".auth-tab").forEach((b) =>
    b.addEventListener("click", () => setAuthMode(b.dataset.authMode)),
  );
  $("#togglePassword").addEventListener("click", () => {
    const p = $("#authPassword");
    p.type = p.type === "password" ? "text" : "password";
  });
  $("#authForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = $("#authEmail").value.trim().toLowerCase();
    const password = $("#authPassword").value;
    const users = currentUsers();
    if (state.authMode === "signup") {
      const name = $("#authName").value.trim();
      if (!name) {
        toast("Enter your name.");
        return;
      }
      if (users.some((u) => u.email === email)) {
        toast("An account with this email already exists in this browser.");
        return;
      }
      const user = { name, email, password };
      save(KEYS.users, [...users, user]);
      enterApp(user);
      toast("Your local demo workspace is ready.");
    } else {
      let user = users.find(
        (u) => u.email === email && u.password === password,
      );
      if (!user && email === "demo@octohealth.ai" && password === "demo1234") {
        user = { name: "Demo User", email, password };
        save(KEYS.users, [...users, user]);
      }
      if (!user) {
        toast(
          "Account not found. Create an account or use demo@octohealth.ai / demo1234.",
        );
        return;
      }
      enterApp(user);
      toast("Welcome back.");
    }
  });
  $$("#navList [data-page],.sidebar-bottom [data-page]").forEach((b) =>
    b.addEventListener("click", () => showPage(b.dataset.page)),
  );
  $("#contentArea").addEventListener("click", (e) => {
    const page = e.target.closest("[data-page]");
    if (page) {
      showPage(page.dataset.page);
      return;
    }
    const action = e.target.closest("[data-action]");
    if (action) {
      const a = action.dataset.action;
      if (a === "upload") openUpload();
      if (a === "save-review") {
        const b = state.data.bills.find((x) => x.id === action.dataset.billId);
        if (b) {
          saveAudit(b, "Review saved");
          persist();
          renderAll();
          closeModal();
          toast("Review saved to Audit History.");
        }
      }
      if (a === "letter-from-bill") {
        const b = state.data.bills.find((x) => x.id === action.dataset.billId);
        if (b) {
          $("#letterProvider").value = b.provider || "";
          $("#letterAccount").value = b.reference || "";
          $("#letterCharges").value =
            itemsFor(b.id)
              .filter(isFlagged)
              .map(
                (x) =>
                  `${x.code || "No code"} — ${x.description} — ${money(x.amount)} (${x.issue})`,
              )
              .join("\n") || "[List the charge you want clarified]";
          generateLetter();
          closeModal();
          showPage("letters");
        }
      }
      if (a === "letter-from-item") {
        const x = state.data.items.find((y) => y.id === action.dataset.itemId);
        if (x) {
          $("#letterCharges").value =
            `${x.code || "No code"} — ${x.description} — ${money(x.amount)} (${x.issue})`;
          generateLetter();
          closeModal();
          showPage("letters");
        }
      }
      if (a === "toggle-item-status") {
        const x = state.data.items.find((y) => y.id === action.dataset.itemId);
        if (x) {
          x.status = "Reviewed";
          persist();
          renderAll();
          closeModal();
          toast("Item marked reviewed.");
        }
      }
      return;
    }
  });
  $("#mobileMenu").addEventListener("click", () =>
    $("#sidebar").classList.toggle("open"),
  );
  $("#themeToggle").addEventListener("click", () => {
    state.prefs.dark = !state.prefs.dark;
    applyPrefs();
    if (state.user) save(KEYS.prefs + "_" + state.user.email, state.prefs);
    $("#settingDark").checked = state.prefs.dark;
  });
function requestLogout() {
  const modal = $("#logoutModal");

  if (modal) {
    modal.hidden = false;
    $("#cancelLogout")?.focus();
  }
}

function closeLogoutModal() {
  const modal = $("#logoutModal");

  if (modal) {
    modal.hidden = true;
    $("#logoutButton")?.focus();
  }
}

$("#logoutButton").addEventListener("click", requestLogout);

$("#profileButton").addEventListener("click", requestLogout);

$("#cancelLogout")?.addEventListener("click", closeLogoutModal);

$("#confirmLogout")?.addEventListener("click", () => {
  $("#logoutModal").hidden = true;
  exitApp();
});

$("#logoutModal")?.addEventListener("click", (event) => {
  if (event.target.id === "logoutModal") {
    closeLogoutModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && $("#logoutModal")?.hidden === false) {
    closeLogoutModal();
  }
});
  $("#codeSearch").addEventListener("input", renderChecker);
  $("#severityFilter").addEventListener("change", renderChecker);
  $("#codeBillFilter").addEventListener("change", renderChecker);
  $("#billSearch").addEventListener("input", renderBills);
  $("#billStatusFilter").addEventListener("change", renderBills);
  $("#contentArea").addEventListener("change", (e) => {
    const sel = e.target.closest("[data-item-status]");
    if (sel) {
      const item = state.data.items.find(
        (x) => x.id === sel.dataset.itemStatus,
      );
      if (item) {
        item.status = sel.value;
        persist();
        renderAll();
        toast("Review status updated.");
      }
    }
  });
  $("#contentArea").addEventListener("click", (e) => {
    const bd = e.target.closest("[data-bill-detail]");
    if (bd) {
      openBillDetail(bd.dataset.billDetail);
      return;
    }
    const it = e.target.closest("[data-item-detail]");
    if (it) {
      openItemDetail(it.dataset.itemDetail);
      return;
    }
    const del = e.target.closest("[data-bill-delete]");
    if (del) {
      const bill = state.data.bills.find(
        (b) => b.id === del.dataset.billDelete,
      );
      if (
        bill &&
        confirm(
          `Remove “${bill.name}” and its line items from this local demo?`,
        )
      ) {
        state.data.bills = state.data.bills.filter((b) => b.id !== bill.id);
        state.data.items = state.data.items.filter((x) => x.billId !== bill.id);
        saveAudit({ ...bill, id: bill.id }, "Bill removed from active library");
        persist();
        renderAll();
        toast("Bill removed from active library.");
      }
      return;
    }
    const v = e.target.closest("[data-bill-view]");
    if (v) {
      state.billView = v.dataset.billView;
      renderBills();
    }
  });
  $("#fileInput").addEventListener("change", (e) => addFiles(e.target.files));
  $("#browseFiles").addEventListener("click", () => $("#fileInput").click());
  $("#createBill").addEventListener("click", addBillFromFiles);
  $("#dropZone").addEventListener("click", (e) => {
    if (!e.target.closest("button")) $("#fileInput").click();
  });
  ["dragenter", "dragover"].forEach((evt) =>
    $("#dropZone").addEventListener(evt, (e) => {
      e.preventDefault();
      $("#dropZone").classList.add("dragover");
    }),
  );
  ["dragleave", "drop"].forEach((evt) =>
    $("#dropZone").addEventListener(evt, (e) => {
      e.preventDefault();
      $("#dropZone").classList.remove("dragover");
      if (evt === "drop") addFiles(e.dataTransfer.files);
    }),
  );
  $("#uploadFileList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove-file]");
    if (b) {
      state.selectedFiles.splice(Number(b.dataset.removeFile), 1);
      $("#uploadFileList").innerHTML = state.selectedFiles
        .map(
          (f, i) =>
            `<div class="upload-file"><span>${f.type === "application/pdf" ? "▧" : "▣"}</span><span>${safe(f.name)} · ${formatBytes(f.size)}</span><button type="button" data-remove-file="${i}">×</button></div>`,
        )
        .join("");
      $("#createBill").disabled = !state.selectedFiles.length;
    }
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-modal]")) closeModal();
    if (e.target.classList.contains("modal-backdrop")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
  $("#detailContent").addEventListener("click", (e) => {
    const itemButton = e.target.closest("[data-item-detail]");
    if (itemButton) {
      openItemDetail(itemButton.dataset.itemDetail);
      return;
    }
    const action = e.target.closest("[data-action]");
    if (!action) return;
    const a = action.dataset.action;
    if (a === "save-review") {
      const b = state.data.bills.find((x) => x.id === action.dataset.billId);
      if (b) {
        saveAudit(b, "Review saved");
        persist();
        renderAll();
        closeModal();
        toast("Review saved to Audit History.");
      }
    }
    if (a === "letter-from-bill") {
      const b = state.data.bills.find((x) => x.id === action.dataset.billId);
      if (b) {
        $("#letterProvider").value = b.provider || "";
        $("#letterAccount").value = b.reference || "";
        $("#letterCharges").value =
          itemsFor(b.id)
            .filter(isFlagged)
            .map(
              (x) =>
                `${x.code || "No code"} — ${x.description} — ${money(x.amount)} (${x.issue})`,
            )
            .join("\n") || "[List the charge you want clarified]";
        generateLetter();
        closeModal();
        showPage("letters");
      }
    }
    if (a === "letter-from-item") {
      const x = state.data.items.find((y) => y.id === action.dataset.itemId);
      if (x) {
        $("#letterCharges").value =
          `${x.code || "No code"} — ${x.description} — ${money(x.amount)} (${x.issue})`;
        generateLetter();
        closeModal();
        showPage("letters");
      }
    }
    if (a === "toggle-item-status") {
      const x = state.data.items.find((y) => y.id === action.dataset.itemId);
      if (x) {
        x.status = "Reviewed";
        persist();
        renderAll();
        closeModal();
        toast("Item marked reviewed.");
      }
    }
  });
  $("#detailContent").addEventListener("submit", (e) => {
    if (e.target.id !== "addItemForm") return;
    e.preventDefault();
    const form = new FormData(e.target);
    const raw = {
      id: id(),
      billId: state.activeBillId,
      billName: state.data.bills.find((b) => b.id === state.activeBillId)?.name,
      code: form.get("code"),
      description: form.get("description"),
      quantity: Number(form.get("quantity")) || 1,
      unitAmount: Number(form.get("unitAmount")) || 0,
      amount: Number(form.get("amount")) || 0,
      status: "Needs review",
    };
    const item = analyzeLineItem(raw);
    state.data.items.push(item);
    const bill = state.data.bills.find((b) => b.id === state.activeBillId);
    if (bill) {
      bill.status = "Needs review";
      saveAudit(bill, "Line item added and checked");
    }
    persist();
    renderAll();
    openBillDetail(state.activeBillId);
    toast(
      item.issue === "No automated flag"
        ? "Line item added. No demo rule flagged it."
        : "Line item added; a possible issue was flagged.",
    );
  });
  $("#letterForm").addEventListener("submit", (e) => {
    e.preventDefault();
    generateLetter();
    toast("Letter preview generated. Edit it before sending.");
  });
  $("#letterPreview").addEventListener("input", () => {
    state.data.letterDraft = $("#letterPreview").value;
    persist();
  });
  $("#copyLetter").addEventListener("click", async () => {
    const text = $("#letterPreview").value || generateLetter();
    try {
      await navigator.clipboard.writeText(text);
      toast("Letter copied to clipboard.");
    } catch {
      $("#letterPreview").focus();
      $("#letterPreview").select();
      toast("Select the letter text and copy it manually.");
    }
  });
  $("#downloadLetter").addEventListener("click", () =>
    downloadText(
      "octohealth-billing-query-letter.txt",
      $("#letterPreview").value || generateLetter(),
    ),
  );
  $("#resetLetter").addEventListener("click", () => {
    if (confirm("Reset the letter form and preview?")) {
      $("#letterForm").reset();
      generateLetter();
    }
  });
  $("#useFlags").addEventListener("click", () => {
    const f = state.data.items.filter(isFlagged);
    $("#letterCharges").value = f
      .map(
        (x) =>
          `${x.code || "No code"} — ${x.description} — ${money(x.amount)} (${x.issue})`,
      )
      .join("\n");
    if (!f.length) toast("There are no flagged items to add yet.");
    else {
      generateLetter();
      toast("Flagged items added to the letter.");
    }
  });
  $("#saveSettings").addEventListener("click", saveSettings);
  $("#settingDark").addEventListener("change", () => {
    state.prefs.dark = $("#settingDark").checked;
    applyPrefs();
  });
  $("#settingCompact").addEventListener("change", () => {
    state.prefs.compact = $("#settingCompact").checked;
    applyPrefs();
  });
  $("#exportData").addEventListener("click", exportData);
  $("#exportHistory").addEventListener("click", () =>
    downloadText(
      "octohealth-audit-history.json",
      JSON.stringify(state.data.audits, null, 2),
      "application/json",
    ),
  );
  $("#clearData").addEventListener("click", () => {
    if (
      confirm(
        "Permanently clear this demo account’s bills, line items, and audit history from this browser? Export first if you need a copy.",
      )
    ) {
      state.data = blankData();
      persist();
      renderAll();
      toast("Demo billing data cleared.");
    }
  });
  $("#historyList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-bill-detail]");
    if (b) openBillDetail(b.dataset.billDetail);
  });
  const session = load(KEYS.session, null);
  if (session?.email) {
    const user = currentUsers().find((u) => u.email === session.email);
    if (user) enterApp(user);
    else localStorage.removeItem(KEYS.session);
  } else {
    setAuthMode("login");
  }
  // Restore an unsent draft after login.
  if (state.user && state.data.letterDraft)
    $("#letterPreview").value = state.data.letterDraft;
})();

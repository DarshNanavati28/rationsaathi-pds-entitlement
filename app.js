(() => {
  "use strict";
  const STORAGE_KEY = "rationsaathi.case.v1";
  const SCALE = 1000n;
  const emptyState = () => ({ household: "", members: "1", periodCount: "1", periodStart: "", periodEnd: "", rules: [], deliveries: [] });
  let state = loadState();
  let noticeTimer;
  const $ = (id) => document.getElementById(id);
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.rules) && Array.isArray(saved.deliveries)) return { ...emptyState(), ...saved };
    } catch (_) {}
    return emptyState();
  }
  function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { showNotice("This browser could not save the comparison. Export a copy to keep it.", true); } }
  function uid() { return (globalThis.crypto?.randomUUID?.() || ("id-" + Date.now() + "-" + Math.random().toString(16).slice(2))); }
  function parseAmount(value) {
    const s = String(value ?? "").trim();
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(s)) return null;
    const [whole, frac = ""] = s.split(".");
    return BigInt(whole) * SCALE + BigInt((frac + "000").slice(0, 3));
  }
  function fmtAmount(value) {
    const n = typeof value === "bigint" ? value : BigInt(value);
    const whole = n / SCALE;
    const remainder = String(n % SCALE).padStart(3, "0").replace(/0+$/, "");
    return remainder ? whole + "." + remainder : String(whole);
  }
  function exactMultiply(value, a, b) { return value * BigInt(a) * BigInt(b); }
  function getTotals() {
    return state.rules.map(rule => {
      const perMember = parseAmount(rule.qty) ?? 0n;
      const expected = exactMultiply(perMember, Number(state.members) || 0, Number(state.periodCount) || 0);
      const rows = state.deliveries.filter(d => d.ruleId === rule.id);
      const received = rows.reduce((sum, d) => sum + (parseAmount(d.qty) ?? 0n), 0n);
      const difference = rows.length && expected > received ? expected - received : 0n;
      const excess = rows.length && received > expected ? received - expected : 0n;
      const lateRows = rows.filter(d => state.periodEnd && d.date && d.date > state.periodEnd);
      return { rule, rows, hasRecords: rows.length > 0, expected, received, difference, excess, lateRows };
    });
  }
  function showNotice(message, isError = false) {
    const n = $("notice"); n.textContent = message; n.hidden = false; n.classList.toggle("error", isError);
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { n.hidden = true; }, 3800);
  }
  function unitFor(ruleId) { return state.rules.find(r => r.id === ruleId)?.unit || ""; }
  function dateText(date) { if (!date) return "Not entered"; const d = new Date(date + "T12:00:00"); return Number.isNaN(d.valueOf()) ? date : new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(d); }
  function rangeText() { return state.periodStart || state.periodEnd ? dateText(state.periodStart) + " - " + dateText(state.periodEnd) : "Dates not entered"; }
  function emptyRecord(title, copy) { return '<div class="empty-state"><strong>' + escapeHTML(title) + '</strong>' + escapeHTML(copy) + '</div>'; }
  function render() {
    syncForm(); renderRules(); renderDeliveryOptions(); renderDeliveries(); renderSummary(); renderReport();
  }
  function syncForm() {
    $("household").value = state.household;
    $("members").value = state.members;
    $("periodCount").value = state.periodCount;
    $("periodStart").value = state.periodStart;
    $("periodEnd").value = state.periodEnd;
  }
  function renderRules() {
    $("ruleCount").textContent = state.rules.length + " " + (state.rules.length === 1 ? "rule" : "rules");
    const list = $("rulesList");
    if (!state.rules.length) { list.innerHTML = emptyRecord("No entitlement rules yet", "Add a rule above. The calculation will use only what you enter."); return; }
    list.innerHTML = state.rules.map(rule => {
      const expected = exactMultiply(parseAmount(rule.qty) ?? 0n, Number(state.members) || 0, Number(state.periodCount) || 0);
      return '<article class="record-row"><div class="record-main"><div class="record-title">' + escapeHTML(rule.item) + ' <span class="count-pill">' + escapeHTML(rule.unit) + '</span></div><div class="record-detail">Rule source: ' + escapeHTML(rule.source) + '</div><div class="record-math">' + escapeHTML(rule.qty) + ' ' + escapeHTML(rule.unit) + ' x ' + escapeHTML(state.members) + ' members x ' + escapeHTML(state.periodCount) + ' periods</div></div><div class="record-qty">' + fmtAmount(expected) + ' <small>' + escapeHTML(rule.unit) + '</small></div><div class="record-actions"><button class="delete-button" type="button" data-remove-rule="' + escapeHTML(rule.id) + '" aria-label="Remove ' + escapeHTML(rule.item) + ' rule">Remove</button></div></article>';
    }).join("");
  }
  function renderDeliveryOptions() {
    const select = $("deliveryItem");
    if (!state.rules.length) { select.innerHTML = '<option value="">Add an entitlement rule first</option>'; select.disabled = true; $("deliveryUnitLabel").textContent = ""; return; }
    const prior = select.value;
    select.disabled = false;
    select.innerHTML = state.rules.map(r => '<option value="' + escapeHTML(r.id) + '">' + escapeHTML(r.item) + '</option>').join("");
    if (state.rules.some(r => r.id === prior)) select.value = prior;
    $("deliveryUnitLabel").textContent = "(" + unitFor(select.value) + ")";
  }
  function renderDeliveries() {
    $("deliveryCount").textContent = state.deliveries.length + " " + (state.deliveries.length === 1 ? "record" : "records");
    const list = $("deliveriesList");
    if (!state.deliveries.length) { list.innerHTML = emptyRecord("No deliveries recorded", "Add each visit separately. Partial deliveries will be added together."); return; }
    list.innerHTML = state.deliveries.slice().sort((a,b) => (a.date || "").localeCompare(b.date || "")).map(d => {
      const rule = state.rules.find(r => r.id === d.ruleId);
      return '<article class="record-row"><div class="record-main"><div class="record-title">' + escapeHTML(rule?.item || "Removed item") + ' <span class="count-pill">' + escapeHTML(dateText(d.date)) + '</span></div><div class="record-detail">' + escapeHTML(d.sourceType) + ': ' + escapeHTML(d.source) + '</div></div><div class="record-qty">' + escapeHTML(d.qty) + ' <small>' + escapeHTML(rule?.unit || "") + '</small></div><div class="record-actions"><button class="delete-button" type="button" data-remove-delivery="' + escapeHTML(d.id) + '" aria-label="Remove delivery record">Remove</button></div></article>';
    }).join("");
  }
  function renderSummary() {
    $("summaryRules").textContent = String(state.rules.length);
    $("summaryDeliveries").textContent = String(state.deliveries.length);
    const totals = getTotals();
    if (!totals.length) { $("summaryHeadline").innerHTML = "Your comparison<br>will appear here."; $("summaryCopy").textContent = "Add at least one rule and a delivery record to see the quantities side by side."; return; }
    const shortCount = totals.filter(t => t.difference > 0n).length;
    const missingCount = totals.filter(t => !t.hasRecords).length;
    const lateCount = totals.reduce((n,t) => n + t.lateRows.length, 0);
    const aboveCount = totals.filter(t => t.excess > 0n).length;
    if (missingCount) {
      $("summaryHeadline").innerHTML = missingCount + " item" + (missingCount === 1 ? "" : "s") + " with no<br>delivery records.";
      $("summaryCopy").textContent = "No delivery records were entered for " + missingCount + " item" + (missingCount === 1 ? "" : "s") + "; a quantity comparison for those items cannot be calculated from the records provided." + (shortCount ? " Other items have a recorded difference." : "");
    } else if (shortCount) {
      $("summaryHeadline").innerHTML = shortCount + " item" + (shortCount === 1 ? "" : "s") + " with a<br>recorded difference.";
      $("summaryCopy").textContent = (lateCount ? lateCount + " delivery record" + (lateCount === 1 ? " is" : "s are") + " dated after the period end. " : "") + "Compare each item and its source below. The cause is not established.";
    } else {
      $("summaryHeadline").innerHTML = aboveCount ? "No recorded<br>shortfall." : "Recorded amounts<br>meet the rules.";
      $("summaryCopy").textContent = (aboveCount ? "Recorded amounts meet or exceed the entered rules. " : "Based on the entries provided, no quantity shortfall is shown. ") + (lateCount ? lateCount + " delivery record" + (lateCount === 1 ? " is" : "s are") + " dated after the period end. Review the dates and amounts below." : "");
    }
  }
  function renderReport() {
    const box = $("reportContent");
    if (!state.rules.length) { box.innerHTML = '<div class="report-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h8"/></svg><strong>Nothing to compare yet</strong>Add at least one entitlement rule to begin the report.</div>'; return; }
    const totals = getTotals();
    const hasMissing = totals.some(t => !t.hasRecords);
    const hasShortfall = totals.some(t => t.difference > 0n);
    const intro = hasMissing
      ? "No delivery records were entered for one or more items, so a quantity comparison for those items cannot be calculated from the records provided. Any differences shown for other items describe quantities only; the cause is not established."
      : hasShortfall
        ? "Based on the rules and delivery records entered, one or more recorded amounts are below the entered entitlement. This comparison describes quantities only; it does not establish why a difference occurred."
        : "Based on the rules and delivery records entered, no quantity shortfall is shown. This comparison reflects only the information provided.";
    const label = state.household.trim() || "Not specified";
    const items = totals.map(t => {
      const status = !t.hasRecords ? '<span class="status-badge unclear">No delivery records entered</span>' : t.difference > 0n ? '<span class="status-badge shortfall">Recorded shortfall</span>' : '<span class="status-badge">No shortfall recorded</span>';
      const late = t.lateRows.length ? '<span class="status-badge late">Includes late dated record</span>' : "";
      const extra = t.excess > 0n ? '<span class="status-badge">Above entered amount</span>' : "";
      const formula = escapeHTML(t.rule.qty) + " " + escapeHTML(t.rule.unit) + " per member x " + escapeHTML(state.members) + " members x " + escapeHTML(state.periodCount) + " period" + (Number(state.periodCount) === 1 ? "" : "s") + ' = <strong>' + fmtAmount(t.expected) + " " + escapeHTML(t.rule.unit) + "</strong>";
      const receivedRows = t.rows.length ? t.rows.map(d => '<div class="evidence-row"><strong>' + escapeHTML(dateText(d.date)) + ' / ' + escapeHTML(d.qty) + " " + escapeHTML(t.rule.unit) + '</strong><span><b>' + escapeHTML(d.sourceType) + ':</b> <span class="evidence-text">' + escapeHTML(d.source) + '</span></span></div>').join("") : '<div class="evidence-row"><strong>No delivery record</strong><span>No delivery entry was provided for this item in this comparison.</span></div>';
      const diffText = t.hasRecords ? fmtAmount(t.difference) + " " + escapeHTML(t.rule.unit) : "Not calculated";
      const itemNote = t.lateRows.length ? '<div class="evidence-warning">At least one recorded delivery date is after the selected period end (' + escapeHTML(dateText(state.periodEnd)) + '). The date and quantity are shown as entered; the reason is not inferred.</div>' : "";
      return '<article class="report-item"><div class="report-item-top"><div><h3>' + escapeHTML(t.rule.item) + ' <span class="record-detail">(' + escapeHTML(t.rule.unit) + ')</span></h3></div><div class="status-badges">' + status + late + extra + '</div></div><p class="report-formula">' + formula + '</p><div class="report-numbers"><div class="report-number"><span>Expected</span><strong>' + fmtAmount(t.expected) + " " + escapeHTML(t.rule.unit) + '</strong></div><div class="report-number"><span>Recorded received</span><strong>' + (t.hasRecords ? fmtAmount(t.received) + " " + escapeHTML(t.rule.unit) : "No records") + '</strong></div><div class="report-number difference"><span>Difference below rule</span><strong>' + diffText + '</strong></div></div><div class="evidence-title">Entitlement source</div><div class="evidence-row"><strong>Rule entered</strong><span>' + escapeHTML(t.rule.source) + '</span></div><div class="evidence-title">Delivery evidence</div>' + receivedRows + itemNote + '</article>';
    }).join("");
    box.innerHTML = '<div class="report-banner"><h3>Quantity comparison</h3><p>' + escapeHTML(intro) + '</p></div><div class="report-meta"><div class="meta-block"><span>Household</span><strong>' + escapeHTML(label) + '</strong></div><div class="meta-block"><span>Members</span><strong>' + escapeHTML(state.members) + '</strong></div><div class="meta-block"><span>Period</span><strong>' + escapeHTML(rangeText()) + '</strong></div><div class="meta-block"><span>Periods counted</span><strong>' + escapeHTML(state.periodCount) + '</strong></div><div class="meta-block"><span>Rules provided</span><strong>' + state.rules.length + '</strong></div><div class="meta-block"><span>Delivery records</span><strong>' + state.deliveries.length + '</strong></div></div>' + items + '<div class="report-banner"><p><strong>Interpretation:</strong> A recorded difference is not evidence of wrongdoing. Stock availability, timing, recordkeeping, and other circumstances are not determined by this report. Please review all entries and source documents before sharing.</p></div>';
  }
  function persistAndRender() { saveState(); render(); }
  function setLocalDateIfEmpty(input) { if (!input.value) { const now = new Date(); input.value = now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2,"0") + "-" + String(now.getDate()).padStart(2,"0"); } }
  ["household", "members", "periodCount", "periodStart", "periodEnd"].forEach(id => $(id).addEventListener("input", () => {
    if (id === "members" || id === "periodCount") { const n = Number($(id).value); if (!Number.isInteger(n) || n < 1 || n > 999) { showNotice("Enter a whole number from 1 to 999.", true); $(id).value = state[id]; return; } }
    if (id === "periodStart" || id === "periodEnd") {
      const nextStart = id === "periodStart" ? $(id).value : state.periodStart;
      const nextEnd = id === "periodEnd" ? $(id).value : state.periodEnd;
      if (nextStart && nextEnd && nextStart > nextEnd) { showNotice("The period start must be on or before the period end.", true); $(id).value = state[id]; return; }
    }
    state[id] = $(id).value; persistAndRender();
  }));
  $("ruleForm").addEventListener("submit", e => {
    e.preventDefault();
    const item = $("ruleItem").value.trim(), qty = $("ruleQty").value.trim(), unit = $("ruleUnit").value, source = $("ruleSource").value.trim();
    const amount = parseAmount(qty);
    if (!item || !source || amount === null) { showNotice("Enter an item, a source, and a non-negative quantity with up to 3 decimal places.", true); return; }
    if (state.rules.some(r => r.item.trim().toLocaleLowerCase() === item.toLocaleLowerCase())) { showNotice("There is already a rule for that item. Use one unit and rule per item.", true); return; }
    state.rules.push({ id: uid(), item, qty, unit, source });
    $("ruleForm").reset(); $("ruleUnit").value = "kg"; persistAndRender(); showNotice(item + " entitlement rule added.");
  });
  $("deliveryItem").addEventListener("change", () => { $("deliveryUnitLabel").textContent = "(" + unitFor($("deliveryItem").value) + ")"; $("suggestions").innerHTML = ""; });
  $("sourceType").addEventListener("change", () => { const visible = $("sourceType").value === "Pasted receipt text"; $("receiptHelper").hidden = !visible; $("suggestions").innerHTML = ""; });
  $("deliveryForm").addEventListener("submit", e => {
    e.preventDefault();
    const ruleId = $("deliveryItem").value, qty = $("deliveryQty").value.trim(), date = $("deliveryDate").value, sourceType = $("sourceType").value, source = $("deliverySource").value.trim();
    if (!state.rules.some(r => r.id === ruleId)) { showNotice("Choose an item with an entitlement rule first.", true); return; }
    if (parseAmount(qty) === null || !date || !source) { showNotice("Enter a valid quantity, date, and source evidence.", true); return; }
    state.deliveries.push({ id: uid(), ruleId, qty, date, sourceType, source });
    const selectedRule = state.rules.find(r => r.id === ruleId);
    $("deliveryQty").value = ""; $("deliverySource").value = ""; $("sourceType").value = "Receipt reference"; $("receiptHelper").hidden = true; $("suggestions").innerHTML = "";
    persistAndRender(); showNotice(selectedRule.item + " delivery record added.");
  });
  $("rulesList").addEventListener("click", e => {
    const button = e.target.closest("[data-remove-rule]"); if (!button) return;
    const id = button.dataset.removeRule;
    if (state.deliveries.some(d => d.ruleId === id)) { showNotice("Remove this item's delivery records before removing its rule.", true); return; }
    const removed = state.rules.find(r => r.id === id); state.rules = state.rules.filter(r => r.id !== id); persistAndRender(); showNotice((removed?.item || "Rule") + " removed.");
  });
  $("deliveriesList").addEventListener("click", e => {
    const button = e.target.closest("[data-remove-delivery]"); if (!button) return;
    state.deliveries = state.deliveries.filter(d => d.id !== button.dataset.removeDelivery); persistAndRender(); showNotice("Delivery record removed.");
  });
  function receiptSuggestions() {
    const raw = $("deliverySource").value;
    const rule = state.rules.find(r => r.id === $("deliveryItem").value);
    if (!raw.trim() || !rule) return [];
    const unitRegex = { kg: "kg(?:s)?|kilograms?", g: "grams?|g", L: "lit(?:er|re)s?|l", mL: "millilit(?:er|re)s?|ml", pieces: "pieces?|pcs?" }[rule.unit];
    const qtyRe = new RegExp("\\b(\\d+(?:\\.\\d{1,3})?)\\s*(?:" + unitRegex + ")\\b", "gi");
    const out = [];
    for (const match of raw.matchAll(qtyRe)) {
      if (parseAmount(match[1]) !== null && !out.some(x => x.type === "qty" && x.value === match[1])) out.push({ type: "qty", value: match[1], label: "Use quantity " + match[1] + " " + rule.unit });
      if (out.length >= 5) break;
    }
    const iso = raw.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
    const dmy = raw.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
    let date = "";
    if (iso) date = iso[1] + "-" + String(iso[2]).padStart(2,"0") + "-" + String(iso[3]).padStart(2,"0");
    else if (dmy) date = dmy[3] + "-" + String(dmy[2]).padStart(2,"0") + "-" + String(dmy[1]).padStart(2,"0");
    if (date && !Number.isNaN(new Date(date + "T00:00:00").valueOf())) out.push({ type: "date", value: date, label: "Use date " + date });
    return out;
  }
  $("scanReceipt").addEventListener("click", () => {
    const suggestions = receiptSuggestions(), box = $("suggestions");
    if (!suggestions.length) { box.innerHTML = '<span class="no-suggestions">No quantity with a matching unit or supported date format was found. Enter values manually.</span>'; return; }
    box.innerHTML = suggestions.map((s,i) => '<button type="button" class="suggestion-chip" data-suggestion="' + i + '">' + escapeHTML(s.label) + '</button>').join("");
    box._suggestions = suggestions;
  });
  $("suggestions").addEventListener("click", e => {
    const button = e.target.closest("[data-suggestion]"); if (!button) return;
    const item = $("suggestions")._suggestions?.[Number(button.dataset.suggestion)]; if (!item) return;
    if (item.type === "qty") $("deliveryQty").value = item.value;
    if (item.type === "date") $("deliveryDate").value = item.value;
    button.textContent = "Applied " + item.label.replace(/^Use /, ""); button.disabled = true;
  });
  function reportPlainText() {
    const lines = ["RationSaathi - Quantity comparison", "Household: " + (state.household.trim() || "Not specified"), "Members: " + state.members, "Period: " + rangeText(), "Periods counted: " + state.periodCount, "", "This comparison uses only the rules and delivery records entered. A recorded difference is not evidence of wrongdoing; the cause is not determined.", ""];
    for (const t of getTotals()) {
      lines.push(t.rule.item + " (" + t.rule.unit + ")");
      lines.push("Expected: " + t.rule.qty + " " + t.rule.unit + " per member x " + state.members + " members x " + state.periodCount + " periods = " + fmtAmount(t.expected) + " " + t.rule.unit);
      lines.push("Recorded received: " + (t.hasRecords ? fmtAmount(t.received) + " " + t.rule.unit : "No delivery records entered"));
      lines.push("Difference below rule: " + (t.hasRecords ? fmtAmount(t.difference) + " " + t.rule.unit : "Not calculated (no delivery records entered)"));
      lines.push("Entitlement source: " + t.rule.source);
      if (t.rows.length) for (const d of t.rows) lines.push("Delivery " + dateText(d.date) + " - " + d.qty + " " + t.rule.unit + "; " + d.sourceType + ": " + d.source);
      else lines.push("Delivery evidence: No delivery entry provided for this item.");
      if (t.lateRows.length) lines.push("Date note: " + t.lateRows.length + " recorded delivery date(s) after period end " + dateText(state.periodEnd) + ".");
      lines.push("");
    }
    lines.push("Review all entries and original source documents before sharing. This report does not determine the reason for any difference.");
    return lines.join("\n");
  }
  $("copyReport").addEventListener("click", async () => { try { await navigator.clipboard.writeText(reportPlainText()); showNotice("Report copied to clipboard."); } catch (_) { showNotice("Clipboard access is not available. Use Export or Print instead.", true); } });
  $("downloadReport").addEventListener("click", () => {
    const data = { app: "RationSaathi", formatVersion: 1, exportedAt: new Date().toISOString(), comparison: { ...state, totals: getTotals().map(t => ({ item: t.rule.item, unit: t.rule.unit, perMemberPerPeriod: t.rule.qty, members: Number(state.members), periods: Number(state.periodCount), expected: fmtAmount(t.expected), received: t.hasRecords ? fmtAmount(t.received) : null, shortfall: t.hasRecords ? fmtAmount(t.difference) : null, deliveries: t.rows })) }, reportText: reportPlainText() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "rationsaathi-comparison.json"; a.click(); URL.revokeObjectURL(url); showNotice("Report exported as JSON.");
  });
  $("printTop").addEventListener("click", () => window.print());
  $("resetApp").addEventListener("click", () => { $("confirmDialog").hidden = false; $("confirmReset").focus(); });
  $("cancelReset").addEventListener("click", () => { $("confirmDialog").hidden = true; $("resetApp").focus(); });
  $("confirmReset").addEventListener("click", () => { state = emptyState(); localStorage.removeItem(STORAGE_KEY); $("confirmDialog").hidden = true; render(); showNotice("Saved data cleared from this browser."); $("resetApp").focus(); });
  $("confirmDialog").addEventListener("click", e => { if (e.target === $("confirmDialog")) $("cancelReset").click(); });
  setLocalDateIfEmpty($("deliveryDate"));
  render();
})();
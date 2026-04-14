const DB_KEY = 'farmUltimateDB';

const DEFAULT_DB = {
  config: {
    machinePrice: 60000,
    machineLife: 5000,
    laborRate: 50,
    kwPrice: 2
  },
  inventory: [
    { id: 1, name: 'PLA Black', price: 800, weight: 1000, stock: 1000 },
    { id: 2, name: 'PLA White', price: 800, weight: 1000, stock: 1000 },
    { id: 3, name: 'PLA Red', price: 800, weight: 1000, stock: 1000 },
    { id: 4, name: 'PLA Silk Gold', price: 1200, weight: 1000, stock: 1000 }
  ],
  sales: []
};

let db = loadDB();
let currentCalc = {
  cost: 0,
  price: 0,
  matCost: 0,
  dep: 0,
  labor: 0,
  extras: 0,
  materialUsage: []
};
let editingCode = null;

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return normalizeDB(DEFAULT_DB);

    const parsed = JSON.parse(raw);
    return normalizeDB(parsed);
  } catch {
    return normalizeDB(DEFAULT_DB);
  }
}

function normalizeDB(source) {
  const safeSource = source && typeof source === 'object' ? source : {};

  const configSource = safeSource.config && typeof safeSource.config === 'object'
    ? safeSource.config
    : {};

  const inventorySource = Array.isArray(safeSource.inventory)
    ? safeSource.inventory
    : [];

  const salesSource = Array.isArray(safeSource.sales)
    ? safeSource.sales
    : [];

  return {
    config: {
      machinePrice: toPositiveNumber(configSource.machinePrice, DEFAULT_DB.config.machinePrice),
      machineLife: Math.max(1, toPositiveNumber(configSource.machineLife, DEFAULT_DB.config.machineLife)),
      laborRate: toPositiveNumber(configSource.laborRate, DEFAULT_DB.config.laborRate),
      kwPrice: toPositiveNumber(configSource.kwPrice, DEFAULT_DB.config.kwPrice)
    },
    inventory: inventorySource.length
      ? inventorySource.map(normalizeInventoryItem).filter(Boolean)
      : DEFAULT_DB.inventory.map(item => ({ ...item })),
    sales: salesSource.map(normalizeSale).filter(Boolean)
  };
}

function normalizeInventoryItem(item) {
  if (!item || typeof item !== 'object') return null;

  const id = item.id ?? Date.now() + Math.floor(Math.random() * 1000);
  const name = String(item.name ?? '').trim();
  const price = toPositiveNumber(item.price, 0);
  const weight = toPositiveNumber(item.weight, 0);
  const stock = clampNumber(toPositiveNumber(item.stock, weight), 0, weight || Number.MAX_SAFE_INTEGER);

  if (!name) return null;

  return {
    id,
    name,
    price,
    weight,
    stock
  };
}

function normalizeSale(item) {
  if (!item || typeof item !== 'object') return null;

  const code = String(item.code ?? '').trim();
  const name = String(item.name ?? '').trim();

  if (!code || !name) return null;

  const cost = toPositiveNumber(item.cost, 0);
  const price = toPositiveNumber(item.price, 0);
  const profit = Number((price - cost).toFixed(2));

  return {
    code,
    date: String(item.date ?? '').trim(),
    name,
    customer: String(item.customer ?? '').trim(),
    notes: String(item.notes ?? '').trim(),
    cost: Number(cost.toFixed(2)),
    price: Number(price.toFixed(2)),
    profit
  };
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toPositiveNumber(value, fallback = 0) {
  const num = toNumber(value, fallback);
  return num >= 0 ? num : fallback;
}

function clampNumber(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return Math.min(max, Math.max(min, toNumber(value, min)));
}

function saveDB() {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function formatMoney(value) {
  return `${Number(value || 0).toFixed(1)} ج`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsString(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

function showToast(message, type = 'success') {
  const oldToast = document.getElementById('toastMsg');
  if (oldToast) oldToast.remove();

  const toast = document.createElement('div');
  toast.id = 'toastMsg';
  toast.className = `toast ${type}`;
  toast.innerText = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
  }, 2200);

  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 2600);
}

function getNextOrderCode() {
  let maxNumber = 1000;

  db.sales.forEach(sale => {
    const match = String(sale.code || '').match(/ORD-(\d+)/);
    if (match) {
      maxNumber = Math.max(maxNumber, Number(match[1]));
    }
  });

  return `ORD-${maxNumber + 1}`;
}

function saveConfig() {
  db.config.machinePrice = toPositiveNumber(document.getElementById('machinePrice').value, 0);
  db.config.machineLife = Math.max(1, toPositiveNumber(document.getElementById('machineLife').value, 1));
  db.config.laborRate = toPositiveNumber(document.getElementById('laborRate').value, 0);

  saveDB();
  calc();
}

function updateUI() {
  const invUI = document.getElementById('inventoryUI');
  const amsInp = document.getElementById('amsInputs');
  const nextOrderCode = document.getElementById('nextOrderCode');

  if (!invUI || !amsInp || !nextOrderCode) return;

  invUI.innerHTML = '';
  amsInp.innerHTML = '';

  if (!db.inventory.length) {
    invUI.innerHTML = `<div class="empty-state">لا توجد خامات مضافة حاليًا.</div>`;
    amsInp.innerHTML = `<div class="empty-state">أضف خامة أولًا لكي يظهر إدخال الاستهلاك.</div>`;
    nextOrderCode.innerText = getNextOrderCode().replace('ORD-', '');
    return;
  }

  db.inventory.forEach(item => {
    const weight = Math.max(item.weight, 1);
    const percentage = clampNumber((item.stock / weight) * 100, 0, 100);

    invUI.innerHTML += `
      <div class="stock-item ${item.stock < 150 ? 'low' : ''}">
        <div class="stock-header">
          <span>${escapeHtml(item.name)}</span>
          <span>${item.stock.toFixed(0)}g / ${item.weight.toFixed(0)}g</span>
        </div>
        <div class="stock-bar">
          <div class="stock-progress" style="width:${percentage}%"></div>
        </div>
      </div>
    `;

    amsInp.innerHTML += `
      <div class="form-group">
        <label>${escapeHtml(item.name)}</label>
        <input
          type="number"
          class="ams-weight"
          data-id="${escapeHtml(item.id)}"
          placeholder="جرام"
          min="0"
          step="0.1"
          oninput="calc()"
        >
      </div>
    `;
  });

  nextOrderCode.innerText = getNextOrderCode().replace('ORD-', '');
}

function getMaterialUsageFromInputs() {
  const usage = [];

  document.querySelectorAll('.ams-weight').forEach(input => {
    const id = input.dataset.id;
    const grams = toPositiveNumber(input.value, 0);
    const item = db.inventory.find(x => String(x.id) === String(id));

    if (item && grams > 0) {
      usage.push({
        id: item.id,
        name: item.name,
        grams,
        pricePerGram: item.weight > 0 ? item.price / item.weight : 0,
        stock: item.stock
      });
    }
  });

  return usage;
}

function calc() {
  const materialUsage = getMaterialUsageFromInputs();

  let matCost = 0;
  materialUsage.forEach(entry => {
    matCost += entry.grams * entry.pricePerGram;
  });

  const hours = toPositiveNumber(document.getElementById('printHours')?.value, 0);
  const manual = toPositiveNumber(document.getElementById('manualMins')?.value, 0);
  const margin = toPositiveNumber(document.getElementById('profitMargin')?.value, 0);

  const machineLife = Math.max(1, toPositiveNumber(db.config.machineLife, 1));
  const dep = hours * (toPositiveNumber(db.config.machinePrice, 0) / machineLife);
  const labor = (manual / 60) * toPositiveNumber(db.config.laborRate, 0);

  const packaging = 10;
  const failRate = 0.10;
  const baseCost = matCost + dep + labor + packaging;
  const extras = packaging + (baseCost * failRate);
  const finalCost = baseCost * (1 + failRate);
  const finalPrice = Math.ceil(finalCost + (finalCost * (margin / 100)));

  setText('resMat', formatMoney(matCost));
  setText('resDep', formatMoney(dep));
  setText('resLabor', formatMoney(labor));
  setText('resExtras', formatMoney(extras));
  setText('resTotal', formatMoney(finalCost));
  setText('resFinal', `${finalPrice} ج`);

  currentCalc = {
    cost: Number(finalCost.toFixed(2)),
    price: Number(finalPrice.toFixed(2)),
    matCost: Number(matCost.toFixed(2)),
    dep: Number(dep.toFixed(2)),
    labor: Number(labor.toFixed(2)),
    extras: Number(extras.toFixed(2)),
    materialUsage
  };
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

function resetResultsPanel() {
  setText('resMat', '0 ج');
  setText('resDep', '0 ج');
  setText('resLabor', '0 ج');
  setText('resExtras', '0 ج');
  setText('resTotal', '0 ج');
  setText('resFinal', '0 ج');
}

function resetOrderForm() {
  const itemName = document.getElementById('itemName');
  const customerName = document.getElementById('customerName');
  const orderNotes = document.getElementById('orderNotes');
  const printHours = document.getElementById('printHours');
  const manualMins = document.getElementById('manualMins');
  const profitMargin = document.getElementById('profitMargin');
  const opDate = document.getElementById('opDate');

  if (itemName) itemName.value = '';
  if (customerName) customerName.value = '';
  if (orderNotes) orderNotes.value = '';
  if (printHours) printHours.value = '';
  if (manualMins) manualMins.value = '15';
  if (profitMargin) profitMargin.value = '100';
  if (opDate) opDate.valueAsDate = new Date();

  document.querySelectorAll('.ams-weight').forEach(input => {
    input.value = '';
  });

  currentCalc = {
    cost: 0,
    price: 0,
    matCost: 0,
    dep: 0,
    labor: 0,
    extras: 0,
    materialUsage: []
  };

  resetResultsPanel();
  updateUI();

  if (itemName) itemName.focus();
}

function validateOrderBeforeSave() {
  const name = document.getElementById('itemName')?.value.trim() || '';
  const printHours = toPositiveNumber(document.getElementById('printHours')?.value, 0);
  const materialUsage = getMaterialUsageFromInputs();

  if (!name) {
    showToast('اكتب اسم المجسم الأول', 'error');
    document.getElementById('itemName')?.focus();
    return { valid: false };
  }

  if (printHours <= 0) {
    showToast('اكتب وقت الطباعة بشكل صحيح', 'error');
    document.getElementById('printHours')?.focus();
    return { valid: false };
  }

  if (!materialUsage.length) {
    showToast('أدخل استهلاك خامة واحد على الأقل', 'error');
    return { valid: false };
  }

  if (currentCalc.price <= 0 || currentCalc.cost <= 0) {
    showToast('دخل بيانات الأوردر بشكل صحيح الأول', 'error');
    return { valid: false };
  }

  for (const entry of materialUsage) {
    const item = db.inventory.find(x => x.id === entry.id);
    if (!item) {
      showToast(`الخامة ${entry.name} غير موجودة`, 'error');
      return { valid: false };
    }

    if (entry.grams > item.stock) {
      showToast(`المخزون غير كافٍ في ${entry.name}`, 'error');
      return { valid: false };
    }
  }

  return { valid: true, name, materialUsage };
}

function saveSale() {
  const validation = validateOrderBeforeSave();
  if (!validation.valid) return;

  const name = validation.name;
  const customerName = document.getElementById('customerName')?.value.trim() || '';
  const notes = document.getElementById('orderNotes')?.value.trim() || '';
  const opDate = document.getElementById('opDate')?.value || new Date().toISOString().slice(0, 10);
  const code = getNextOrderCode();

  validation.materialUsage.forEach(entry => {
    const item = db.inventory.find(x => x.id === entry.id);
    if (item) {
      item.stock = Number((item.stock - entry.grams).toFixed(2));
      if (item.stock < 0) item.stock = 0;
    }
  });

  db.sales.push({
    code,
    date: opDate,
    name,
    customer: customerName,
    notes,
    cost: Number(currentCalc.cost.toFixed(2)),
    price: Number(currentCalc.price.toFixed(2)),
    profit: Number((currentCalc.price - currentCalc.cost).toFixed(2))
  });

  saveDB();
  resetOrderForm();
  calc();
  showToast('تم تسجيل الأوردر وخصم المخزن بنجاح');
}

function getFilteredSales() {
  const search = (document.getElementById('salesSearch')?.value || '').trim().toLowerCase();
  const from = document.getElementById('filterFrom')?.value || '';
  const to = document.getElementById('filterTo')?.value || '';

  return [...db.sales]
    .filter(sale => {
      const code = (sale.code || '').toLowerCase();
      const name = (sale.name || '').toLowerCase();
      const customer = (sale.customer || '').toLowerCase();
      const notes = (sale.notes || '').toLowerCase();

      const matchesSearch =
        !search ||
        code.includes(search) ||
        name.includes(search) ||
        customer.includes(search) ||
        notes.includes(search);

      const matchesFrom = !from || (sale.date && sale.date >= from);
      const matchesTo = !to || (sale.date && sale.date <= to);

      return matchesSearch && matchesFrom && matchesTo;
    })
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.code || '').localeCompare(String(a.code || '')));
}

function openReports() {
  const modal = document.getElementById('reportsModal');
  if (!modal) return;

  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  renderReportsTable();
}

function closeReports() {
  const modal = document.getElementById('reportsModal');
  if (!modal) return;

  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
}

function renderReportsTable() {
  const body = document.getElementById('salesTableBody');
  if (!body) return;

  body.innerHTML = '';

  const filteredSales = getFilteredSales();

  let rev = 0;
  let prof = 0;
  let top = 0;

  filteredSales.forEach(sale => {
    const price = toPositiveNumber(sale.price, 0);
    const cost = toPositiveNumber(sale.cost, 0);
    const profit = Number((price - cost).toFixed(2));

    rev += price;
    prof += profit;
    top = Math.max(top, price);

    body.innerHTML += `
      <tr>
        <td>${escapeHtml(sale.code)}</td>
        <td>${escapeHtml(sale.date || '')}</td>
        <td>${escapeHtml(sale.name)}</td>
        <td>${escapeHtml(sale.customer || '')}</td>
        <td>${escapeHtml(sale.notes || '')}</td>
        <td>${formatMoney(cost)}</td>
        <td>${formatMoney(price)}</td>
        <td class="tag-profit">${formatMoney(profit)}</td>
        <td>
          <button class="action-btn edit" onclick="openEditSale('${escapeJsString(sale.code)}')">تعديل</button>
          <button class="action-btn delete" onclick="deleteSale('${escapeJsString(sale.code)}')">حذف</button>
        </td>
      </tr>
    `;
  });

  if (!filteredSales.length) {
    body.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state">لا توجد نتائج مطابقة.</div>
        </td>
      </tr>
    `;
  }

  setText('statRev', `${Math.round(rev)} ج`);
  setText('statProfit', `${Math.round(prof)} ج`);
  setText('statCount', String(filteredSales.length));
  setText('statTop', `${Math.round(top)} ج`);
}

function renderReportsTableSafe() {
  const modal = document.getElementById('reportsModal');
  if (modal && modal.style.display === 'flex') {
    renderReportsTable();
  }
}

function deleteSale(code) {
  const exists = db.sales.some(sale => sale.code === code);
  if (!exists) {
    showToast('الأوردر غير موجود', 'error');
    return;
  }

  if (!confirm('مسح الأوردر؟')) return;

  db.sales = db.sales.filter(sale => sale.code !== code);
  saveDB();
  updateUI();
  renderReportsTableSafe();
  showToast('تم حذف الأوردر', 'success');
}

function openEditSale(code) {
  const sale = db.sales.find(s => s.code === code);
  if (!sale) {
    showToast('الأوردر غير موجود', 'error');
    return;
  }

  editingCode = code;

  document.getElementById('editCode').value = sale.code || '';
  document.getElementById('editDate').value = sale.date || '';
  document.getElementById('editName').value = sale.name || '';
  document.getElementById('editCustomer').value = sale.customer || '';
  document.getElementById('editNotes').value = sale.notes || '';
  document.getElementById('editCost').value = sale.cost ?? 0;
  document.getElementById('editPrice').value = sale.price ?? 0;

  const modal = document.getElementById('editModal');
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
}

function closeEditModal() {
  const modal = document.getElementById('editModal');
  if (modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }

  editingCode = null;
}

function saveEditedSale() {
  const sale = db.sales.find(s => s.code === editingCode);
  if (!sale) {
    showToast('الأوردر غير موجود', 'error');
    return;
  }

  const date = document.getElementById('editDate').value;
  const name = document.getElementById('editName').value.trim();
  const customer = document.getElementById('editCustomer').value.trim();
  const notes = document.getElementById('editNotes').value.trim();
  const cost = toNumber(document.getElementById('editCost').value, NaN);
  const price = toNumber(document.getElementById('editPrice').value, NaN);

  if (!name) {
    showToast('اسم المجسم مطلوب', 'error');
    document.getElementById('editName').focus();
    return;
  }

  if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(price) || price < 0) {
    showToast('راجع التكلفة وسعر البيع', 'error');
    return;
  }

  sale.date = date;
  sale.name = name;
  sale.customer = customer;
  sale.notes = notes;
  sale.cost = Number(cost.toFixed(2));
  sale.price = Number(price.toFixed(2));
  sale.profit = Number((price - cost).toFixed(2));

  saveDB();
  closeEditModal();
  renderReportsTableSafe();
  updateUI();
  showToast('تم تعديل الأوردر بنجاح');
}

function addStockPrompt() {
  const name = prompt('اسم الخامة:');
  if (name === null) return;

  const price = prompt('سعر البكرة:');
  if (price === null) return;

  const weight = prompt('وزن البكرة بالجرام (مثلا 1000):');
  if (weight === null) return;

  const cleanName = String(name).trim();
  const priceNum = toNumber(price, NaN);
  const weightNum = toNumber(weight, NaN);

  if (!cleanName) {
    showToast('اسم الخامة مطلوب', 'error');
    return;
  }

  if (!Number.isFinite(priceNum) || priceNum <= 0 || !Number.isFinite(weightNum) || weightNum <= 0) {
    showToast('بيانات الخامة غير صحيحة', 'error');
    return;
  }

  db.inventory.push({
    id: Date.now(),
    name: cleanName,
    price: Number(priceNum.toFixed(2)),
    weight: Number(weightNum.toFixed(2)),
    stock: Number(weightNum.toFixed(2))
  });

  saveDB();
  updateUI();
  calc();
  showToast('تمت إضافة الخامة بنجاح');
}

function exportBackupJSON() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `farm_backup_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();

  URL.revokeObjectURL(url);
  showToast('تم تحميل النسخة الاحتياطية');
}

function importBackupJSON(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const normalized = normalizeDB(parsed);

      if (!normalized.config || !Array.isArray(normalized.inventory) || !Array.isArray(normalized.sales)) {
        throw new Error('invalid');
      }

      db = normalized;
      saveDB();
      updateUI();
      resetOrderForm();
      renderReportsTableSafe();
      showToast('تم استيراد البيانات بنجاح');
    } catch {
      showToast('ملف الاستيراد غير صالح', 'error');
    } finally {
      event.target.value = '';
    }
  };

  reader.readAsText(file);
}

window.onclick = function(event) {
  const reportsModal = document.getElementById('reportsModal');
  const editModal = document.getElementById('editModal');

  if (event.target === reportsModal) closeReports();
  if (event.target === editModal) closeEditModal();
};

window.onload = () => {
  const opDate = document.getElementById('opDate');
  if (opDate) opDate.valueAsDate = new Date();

  document.getElementById('machinePrice').value = db.config.machinePrice ?? 60000;
  document.getElementById('machineLife').value = db.config.machineLife ?? 5000;
  document.getElementById('laborRate').value = db.config.laborRate ?? 50;

  updateUI();
  calc();
};

const DB_KEY = 'farmUltimateDB';

// تعديل: جعل المخزن يبدأ فارغاً تماماً بدون خامات افتراضية
const DEFAULT_DB = {
  config: {
    machinePrice: 60000,
    machineLife: 5000,
    laborRate: 50,
    kwPrice: 2
  },
  inventory: [], // فارغ
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
  const configSource = safeSource.config && typeof safeSource.config === 'object' ? safeSource.config : {};
  const inventorySource = Array.isArray(safeSource.inventory) ? safeSource.inventory : [];
  const salesSource = Array.isArray(safeSource.sales) ? safeSource.sales : [];

  return {
    config: {
      machinePrice: toPositiveNumber(configSource.machinePrice, DEFAULT_DB.config.machinePrice),
      machineLife: Math.max(1, toPositiveNumber(configSource.machineLife, DEFAULT_DB.config.machineLife)),
      laborRate: toPositiveNumber(configSource.laborRate, DEFAULT_DB.config.laborRate),
      kwPrice: toPositiveNumber(configSource.kwPrice, DEFAULT_DB.config.kwPrice)
    },
    inventory: inventorySource.map(normalizeInventoryItem).filter(Boolean),
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
  return { id, name, price, weight, stock };
}

function normalizeSale(item) {
  if (!item || typeof item !== 'object') return null;
  const code = String(item.code ?? '').trim();
  const name = String(item.name ?? '').trim();
  if (!code || !name) return null;
  const cost = toPositiveNumber(item.cost, 0);
  const price = toPositiveNumber(item.price, 0);
  return {
    code,
    date: String(item.date ?? '').trim(),
    name,
    customer: String(item.customer ?? '').trim(),
    notes: String(item.notes ?? '').trim(),
    cost: Number(cost.toFixed(2)),
    price: Number(price.toFixed(2)),
    profit: Number((price - cost).toFixed(2))
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
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeJsString(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function showToast(message, type = 'success') {
  const oldToast = document.getElementById('toastMsg');
  if (oldToast) oldToast.remove();
  const toast = document.createElement('div');
  toast.id = 'toastMsg';
  toast.className = `toast ${type}`;
  toast.innerText = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(-8px)'; }, 2200);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 2600);
}

function getNextOrderCode() {
  let maxNumber = 1000;
  db.sales.forEach(sale => {
    const match = String(sale.code || '').match(/ORD-(\d+)/);
    if (match) maxNumber = Math.max(maxNumber, Number(match[1]));
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

// تعديل: إضافة زر الحذف لكل خامة في الواجهة
function updateUI() {
  const invUI = document.getElementById('inventoryUI');
  const amsInp = document.getElementById('amsInputs');
  const nextOrderCode = document.getElementById('nextOrderCode');
  if (!invUI || !amsInp || !nextOrderCode) return;

  invUI.innerHTML = '';
  amsInp.innerHTML = '';

  if (!db.inventory.length) {
    invUI.innerHTML = `<div class="empty-state">لا توجد خامات مضافة.</div>`;
    amsInp.innerHTML = `<div class="empty-state">أضف خامة أولاً.</div>`;
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
          <button class="action-btn delete" onclick="deleteMaterial(${item.id})" style="padding: 2px 8px; font-size: 10px;">حذف</button>
        </div>
        <div class="stock-bar">
          <div class="stock-progress" style="width:${percentage}%"></div>
        </div>
        <div style="font-size: 11px; margin-top: 4px;">${item.stock.toFixed(0)}g / ${item.weight.toFixed(0)}g</div>
      </div>
    `;

    amsInp.innerHTML += `
      <div class="form-group">
        <label>${escapeHtml(item.name)}</label>
        <input type="number" class="ams-weight" data-id="${item.id}" placeholder="جرام" min="0" step="0.1" oninput="calc()">
      </div>
    `;
  });
  nextOrderCode.innerText = getNextOrderCode().replace('ORD-', '');
}

// دالة جديدة لحذف الخامة من المخزن
function deleteMaterial(id) {
  if (!confirm('هل تريد حذف هذه الخامة نهائياً من المخزن؟')) return;
  db.inventory = db.inventory.filter(item => item.id !== id);
  saveDB();
  updateUI();
  calc();
  showToast('تم حذف الخامة');
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
  materialUsage.forEach(entry => { matCost += entry.grams * entry.pricePerGram; });

  const hours = toPositiveNumber(document.getElementById('printHours')?.value, 0);
  const manual = toPositiveNumber(document.getElementById('manualMins')?.value, 0);
  const margin = toPositiveNumber(document.getElementById('profitMargin')?.value, 0);

  const machineLife = Math.max(1, toPositiveNumber(db.config.machineLife, 1));
  const dep = hours * (toPositiveNumber(db.config.machinePrice, 0) / machineLife);
  const labor = (manual / 60) * toPositiveNumber(db.config.laborRate, 0);

  const packaging = 10;
  const failRate = 0.10;
  const baseCost = matCost + dep + labor + packaging;
  const finalCost = baseCost * (1 + failRate);
  const finalPrice = Math.ceil(finalCost + (finalCost * (margin / 100)));

  setText('resMat', formatMoney(matCost));
  setText('resDep', formatMoney(dep));
  setText('resLabor', formatMoney(labor));
  setText('resExtras', formatMoney(packaging + (baseCost * failRate)));
  setText('resTotal', formatMoney(finalCost));
  setText('resFinal', `${finalPrice} ج`);

  currentCalc = { cost: Number(finalCost.toFixed(2)), price: Number(finalPrice.toFixed(2)), matCost, dep, labor, materialUsage };
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

function resetOrderForm() {
  document.getElementById('itemName').value = '';
  document.getElementById('customerName').value = '';
  document.getElementById('printHours').value = '';
  document.querySelectorAll('.ams-weight').forEach(input => input.value = '');
  calc();
  updateUI();
}

function saveSale() {
  const name = document.getElementById('itemName').value.trim();
  const usage = getMaterialUsageFromInputs();
  if (!name || !usage.length) { showToast('أكمل بيانات الأوردر والخامات', 'error'); return; }

  usage.forEach(entry => {
    const item = db.inventory.find(x => x.id === entry.id);
    if (item) item.stock = Number((item.stock - entry.grams).toFixed(2));
  });

  db.sales.push({
    code: getNextOrderCode(),
    date: new Date().toISOString().slice(0, 10),
    name,
    customer: document.getElementById('customerName').value,
    cost: currentCalc.cost,
    price: currentCalc.price
  });

  saveDB();
  resetOrderForm();
  showToast('تم الحفظ وخصم المخزن');
}

function addStockPrompt() {
  const name = prompt('اسم الخامة:');
  const price = prompt('سعر البكرة:');
  const weight = prompt('وزن البكرة بالجرام (1000):');

  if (name && price && weight) {
    db.inventory.push({
      id: Date.now(),
      name: name.trim(),
      price: Number(price),
      weight: Number(weight),
      stock: Number(weight)
    });
    saveDB();
    updateUI();
    showToast('تمت إضافة الخامة');
  }
}

// استدعاء أولي لتشغيل الواجهة
document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    calc();
});

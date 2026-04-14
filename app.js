const DB_KEY = 'farmUltimateDB';

const DEFAULT_DB = {
  config: {
    machinePrice: 60000,
    machineLife: 5000,
    laborRate: 50,
    kwPrice: 2
  },
  inventory: [],
  sales: []
};

let db = loadDB();
let currentCalc = {};

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return DEFAULT_DB;
    return normalizeDB(JSON.parse(raw));
  } catch {
    return DEFAULT_DB;
  }
}

function normalizeDB(data) {
  return {
    config: data.config || DEFAULT_DB.config,
    inventory: Array.isArray(data.inventory) ? data.inventory : [],
    sales: Array.isArray(data.sales) ? data.sales : []
  };
}

function saveDB() {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

/* =========================
   INVENTORY CORE
========================= */

function addStockPrompt() {
  const name = prompt('اسم الخامة:');
  if (!name) return;

  const price = Number(prompt('سعر البكرة بالجنيه:'));
  const weight = Number(prompt('وزن البكرة بالجرام:'));

  if (!price || !weight || price <= 0 || weight <= 0) {
    alert('بيانات غير صحيحة');
    return;
  }

  const item = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: name.trim(),
    price,
    weight,
    stock: weight
  };

  db.inventory.push(item);
  saveDB();
  updateUI();
}

/* حذف خامة */
function deleteMaterial(id) {
  const item = db.inventory.find(x => x.id === id);
  if (!item) return;

  if (!confirm(`حذف خامة: ${item.name} ؟`)) return;

  db.inventory = db.inventory.filter(x => x.id !== id);
  saveDB();
  updateUI();
}

/* =========================
   UI RENDER
========================= */

function updateUI() {
  const invUI = document.getElementById('inventoryUI');
  const ams = document.getElementById('amsInputs');
  const nextOrder = document.getElementById('nextOrderCode');

  if (!invUI || !ams) return;

  invUI.innerHTML = '';
  ams.innerHTML = '';

  if (db.inventory.length === 0) {
    invUI.innerHTML = `<div class="empty-state">لا توجد خامات</div>`;
    ams.innerHTML = `<div class="empty-state">أضف خامة أولاً</div>`;
    return;
  }

  db.inventory.forEach(item => {
    const percent = Math.min(100, (item.stock / item.weight) * 100);

    invUI.innerHTML += `
      <div class="stock-item">
        <div class="stock-header">
          <span>${item.name}</span>
          <button class="action-btn delete" onclick="deleteMaterial(${item.id})">حذف</button>
        </div>

        <div class="stock-bar">
          <div class="stock-progress" style="width:${percent}%"></div>
        </div>

        <div style="font-size:12px;margin-top:5px;">
          ${item.stock}g / ${item.weight}g
        </div>
      </div>
    `;

    ams.innerHTML += `
      <div class="form-group">
        <label>${item.name}</label>
        <input type="number" class="ams-weight" data-id="${item.id}" placeholder="جرام المستخدم" oninput="calc()">
      </div>
    `;
  });
}

/* =========================
   MATERIAL USAGE
========================= */

function getMaterialUsage() {
  const usage = [];

  document.querySelectorAll('.ams-weight').forEach(inp => {
    const id = Number(inp.dataset.id);
    const grams = Number(inp.value) || 0;

    const item = db.inventory.find(x => x.id === id);
    if (!item || grams <= 0) return;

    usage.push({
      item,
      grams,
      cost: (item.price / item.weight) * grams
    });
  });

  return usage;
}

/* =========================
   CALCULATION ENGINE
========================= */

function calc() {
  const usage = getMaterialUsage();

  let matCost = usage.reduce((sum, u) => sum + u.cost, 0);

  const hours = Number(document.getElementById('printHours')?.value || 0);
  const laborMin = Number(document.getElementById('manualMins')?.value || 0);
  const margin = Number(document.getElementById('profitMargin')?.value || 0);

  const dep = hours * (db.config.machinePrice / db.config.machineLife);
  const labor = (laborMin / 60) * db.config.laborRate;

  const packaging = 10;
  const failRate = 0.1;

  const base = matCost + dep + labor + packaging;
  const total = base * (1 + failRate);
  const final = Math.ceil(total * (1 + margin / 100));

  document.getElementById('resMat').innerText = matCost.toFixed(1);
  document.getElementById('resDep').innerText = dep.toFixed(1);
  document.getElementById('resLabor').innerText = labor.toFixed(1);
  document.getElementById('resExtras').innerText = (packaging + total * failRate).toFixed(1);
  document.getElementById('resTotal').innerText = total.toFixed(1);
  document.getElementById('resFinal').innerText = final + " ج";

  currentCalc = { matCost, dep, labor, total, final, usage };
}

/* =========================
   SAVE SALE
========================= */

function saveSale() {
  const name = document.getElementById('itemName').value.trim();
  if (!name) return alert('ادخل اسم المجسم');

  const usage = getMaterialUsage();
  if (usage.length === 0) return alert('لا توجد خامات مستخدمة');

  // خصم المخزون
  usage.forEach(u => {
    u.item.stock = Math.max(0, u.item.stock - u.grams);
  });

  db.sales.push({
    code: 'ORD-' + Date.now(),
    date: new Date().toISOString().slice(0, 10),
    name,
    cost: currentCalc.total,
    price: currentCalc.final
  });

  saveDB();
  updateUI();
  alert('تم الحفظ بنجاح');
}

/* =========================
   INIT
========================= */

document.addEventListener('DOMContentLoaded', () => {
  updateUI();
  calc();
});

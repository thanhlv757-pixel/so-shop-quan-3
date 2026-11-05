// Lưu dữ liệu trên máy bằng IndexedDB (một bản ghi trạng thái duy nhất).

const DB_NAME = "so-pin-xe-dien", STORE = "state", KEY = "main";

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function load() {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const r = db.transaction(STORE).objectStore(STORE).get(KEY);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  } catch {
    try { return JSON.parse(localStorage.getItem(DB_NAME) || "null"); } catch { return null; }
  }
}

export async function save(state) {
  const data = JSON.parse(JSON.stringify(state));
  try {
    const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(data, KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try { localStorage.setItem(DB_NAME, JSON.stringify(data)); } catch { /* bộ nhớ đầy hoặc bị chặn */ }
  }
  // Xin trình duyệt giữ dữ liệu lâu dài (iOS có thể xoá dữ liệu web ít dùng).
  try { navigator.storage?.persist?.(); } catch { /* không hỗ trợ */ }
}

/** Kiểm tra và chuẩn hoá file JSON nhập vào. */
export function validateImport(obj) {
  if (!obj || typeof obj !== "object") throw new Error("File không đúng định dạng.");
  if (obj.app !== "so-pin-xe-dien") throw new Error("Đây không phải file sao lưu của Sổ Pin Xe Điện.");
  if (!Array.isArray(obj.legs)) throw new Error("File thiếu danh sách chặng đã đi.");
  return {
    legs: obj.legs.filter((l) => l && typeof l === "object").map((l) => ({ ...l, id: l.id || "leg-" + Math.random().toString(36).slice(2, 9) })),
    plan: obj.plan && Array.isArray(obj.plan.stops) && Array.isArray(obj.plan.legs) ? obj.plan : null,
    settings: obj.settings && typeof obj.settings === "object" ? obj.settings : null,
  };
}

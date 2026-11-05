import { test } from "node:test";
import assert from "node:assert/strict";
import { buildModel, forecastPlan, usable, samePlace, verdict, calibration } from "../model.js";

// Dữ liệu giả lập, không phải dữ liệu thật của người dùng.
const A = { name: "A", lat: 10.80, lon: 106.68 };
const B = { name: "B", lat: 10.81, lon: 106.70 };
const C = { name: "C", lat: 10.70, lon: 106.73 };
const legs = [
  { km: 10, used: 12, kmSource: "reported", traffic: "normal" },
  { km: 10, used: 16, kmSource: "maps", traffic: "busy", bridge: true },
  { km: 10, pinStart: 80, pinEnd: 66, kmSource: "maps", traffic: "busy" },
  { km: 50, used: 5, kmSource: "estimate", traffic: "normal" },
  { from: A, to: B, km: null, pinStart: 100, pinEnd: 93, traffic: "busy" },
];

test("loại km ước tính khỏi mô hình trừ khi bật", () => {
  assert.equal(usable(legs[3]), false);
  assert.equal(usable(legs[3], true), true);
  const M = buildModel(legs);
  assert.equal(M.pts.length, 3);
  assert.equal(M.R, (12 + 16 + 14) / 30);
  assert.equal(M.min, 1.2);
  assert.equal(M.max, 1.6);
});

test("pin tính nối tiếp qua các chặng", () => {
  const plan = {
    startPin: 90,
    stops: [{ name: "X" }, { name: "Y" }, { name: "Z" }],
    legs: [{ km: 10, traffic: "normal" }, { km: 5, traffic: "normal" }],
  };
  const F = forecastPlan(legs, plan);
  const r = F.rows;
  assert.ok(F.complete);
  assert.ok(Math.abs(r[1].after.norm - (90 - r[0].f.norm - r[1].f.norm)) < 1e-9);
  assert.ok(Math.abs(F.end.norm - r[1].after.norm) < 1e-9);
  assert.ok(F.end.fav >= F.end.norm && F.end.norm >= F.end.adv);
});

test("chặng đã đi dùng số thực tế lần trước (so khớp tọa độ ≤150 m)", () => {
  assert.ok(samePlace(A, { lat: 10.8005, lon: 106.6801 }));
  assert.ok(!samePlace(A, C));
  const plan = { startPin: 100, stops: [{ ...A, lat: 10.8004 }, B], legs: [{ km: "", traffic: "normal" }] };
  const F = forecastPlan(legs, plan);
  assert.ok(F.rows[0].f.hist);
  assert.equal(F.rows[0].f.norm, 7);
});

test("thiếu km và chưa từng đi thì không tính bừa", () => {
  const plan = { startPin: 100, stops: [B, C], legs: [{ km: "" }] };
  const F = forecastPlan(legs, plan);
  assert.equal(F.complete, false);
  assert.equal(verdict(F).level, "unknown");
});

test("chưa biết pin xuất phát: báo pin tối thiểu cần có", () => {
  const plan = { startPin: "", stops: [{ name: "X" }, { name: "Y" }], legs: [{ km: 20, traffic: "normal" }] };
  const F = forecastPlan(legs, plan, { reserve: 20 });
  assert.equal(F.end, null);
  assert.equal(F.needed.norm, Math.ceil(F.total.norm + 20));
  assert.ok(F.needed.adv >= F.needed.norm);
  assert.match(verdict(F).text, /Cần biết pin lúc xuất phát/);
});

test("ba kịch bản: bất lợi cộng 10% khi có cầu hoặc đường đông", () => {
  const M = buildModel(legs);
  const plan = { startPin: 100, stops: [{ name: "X" }, { name: "Y" }], legs: [{ km: 10, traffic: "jam", bridge: false }] };
  const F = forecastPlan(legs, plan);
  assert.ok(Math.abs(F.rows[0].f.adv - 10 * M.max * 1.1) < 1e-9);
  assert.ok(Math.abs(F.rows[0].f.fav - 10 * M.min) < 1e-9);
});

test("hiệu chỉnh: lệch trung bình và sai số tuyệt đối", () => {
  const c = calibration([{ used: 10, predicted: 8 }, { used: 6, predicted: 8 }]);
  assert.equal(c.mean, 0);
  assert.equal(c.mae, 2);
});

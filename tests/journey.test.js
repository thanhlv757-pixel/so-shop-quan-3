import { test } from "node:test";
import assert from "node:assert/strict";
import { buildModel, forecastPlan, journeyToLegs, SHORT_KM } from "../model.js";

// Dữ liệu giả lập, không phải dữ liệu thật của người dùng.
const long = (km, used, extra = {}) => ({ km, used, kmSource: "maps", traffic: "normal", ...extra });

test("mô hình tách chặng ngắn (< 5 km) khỏi chặng dài", () => {
  assert.equal(SHORT_KM, 5);
  const legs = [long(10, 12), long(10, 15), long(4, 8), long(3, 7)];
  const M = buildModel(legs);
  assert.equal(M.min, 1.2, "min chỉ lấy từ chặng dài");
  assert.equal(M.max, 1.5, "max chỉ lấy từ chặng dài");
  assert.equal(M.short.n, 2);
  assert.equal(M.short.rate, 15 / 7);
});

test("chặng ngắn dùng mức của chặng ngắn; chặng dài không bị kéo theo", () => {
  const legs = [long(10, 12), long(10, 15), long(4, 8), long(3, 7)];
  const plan = { startPin: 100, stops: [{ name: "X" }, { name: "Y" }, { name: "Z" }], legs: [{ km: 2, traffic: "normal" }, { km: 10, traffic: "normal" }] };
  const F = forecastPlan(legs, plan);
  assert.ok(Math.abs(F.rows[0].f.norm - 2 * (15 / 7)) < 1e-9);
  assert.match(F.rows[0].f.basis.join(" "), /chặng ngắn/i);
  assert.ok(F.rows[1].f.adv <= 10 * 1.5 + 1e-9, "bất lợi của chặng dài không dùng mức chặng ngắn");
});

test("chưa đủ 2 chặng dài thì min/max lấy từ tất cả", () => {
  const M = buildModel([long(10, 12), long(4, 8)]);
  assert.equal(M.min, 1.2);
  assert.equal(M.max, 2);
});

test("ghi cả hành trình: gộp chặng qua điểm quên xem pin", () => {
  const j = {
    date: "2026-01-02",
    stops: [
      { name: "Nhà", pin: 100, leave: "10:30" },
      { name: "A", pin: 75, arrive: "11:05", leave: "11:10", km: 15.4, kmSource: "maps", traffic: "busy", bridge: true },
      { name: "B", pin: "", arrive: "11:15", leave: "14:16", km: 0.9, kmSource: "maps", traffic: "normal" },
      { name: "C", pin: 68, arrive: "14:25", km: 2.1, kmSource: "osm", traffic: "busy" },
      { name: "D", pin: 59, km: 3.8, kmSource: "maps" },
    ],
  };
  const legs = journeyToLegs(j);
  assert.equal(legs.length, 3);
  assert.deepEqual(legs.map((l) => [l.from.name, l.to.name, l.pinStart, l.pinEnd]), [["Nhà", "A", 100, 75], ["A", "C", 75, 68], ["C", "D", 68, 59]]);
  assert.equal(legs[0].durationMin, 35);
  assert.deepEqual(legs[1].via.map((s) => s.name), ["B"]);
  assert.ok(Math.abs(legs[1].km - 3.0) < 1e-9, "km gộp = tổng các đoạn");
  assert.equal(legs[1].kmSource, "osm", "nguồn km gộp lấy nguồn kém tin cậy nhất");
  assert.equal(legs[1].traffic, "busy", "giao thông lấy mức đông nhất");
  assert.equal(legs[1].durationMin, 14, "thời gian chạy = tổng các đoạn, không tính lúc đỗ xem phim");
  assert.equal(legs[2].durationMin, null, "thiếu giờ thì để trống");
  assert.equal(legs[0].order, 1);
  assert.equal(legs[2].order, 3);
});

test("ghi cả hành trình: thiếu km một đoạn thì km gộp để trống; pin đầu trống thì báo lỗi", () => {
  const legs = journeyToLegs({ date: "", stops: [{ name: "A", pin: 90 }, { name: "B", pin: "", km: 2 }, { name: "C", pin: 80 }] });
  assert.equal(legs[0].km, null);
  assert.equal(legs[0].kmSource, "none");
  assert.throws(() => journeyToLegs({ stops: [{ name: "A", pin: "" }, { name: "B", pin: 50 }] }), /pin lúc xuất phát/i);
  assert.throws(() => journeyToLegs({ stops: [{ name: "A", pin: 90 }, { name: "B", pin: "" }] }), /pin ở điểm cuối/i);
});

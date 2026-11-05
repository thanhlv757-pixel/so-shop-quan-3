import { test } from "node:test";
import assert from "node:assert/strict";
import { queryVariants, houseNumber, matchesHouseNumber } from "../maps.js";

test("thử lần lượt: nguyên văn → bỏ quận/phường → bỏ số hẻm → bỏ số nhà (gần đúng)", () => {
  assert.deepEqual(queryVariants("139/3 Phan Đăng Lưu, Phú Nhuận").map((v) => v.q), [
    "139/3 Phan Đăng Lưu, Phú Nhuận",
    "139 Phan Đăng Lưu, Phú Nhuận",
    "Phan Đăng Lưu, Phú Nhuận",
  ]);
  const v = queryVariants("527 Điện Biên Phủ, Quận 3");
  assert.deepEqual(v.map((x) => x.q), ["527 Điện Biên Phủ, Quận 3", "527 Điện Biên Phủ", "Điện Biên Phủ"]);
  assert.deepEqual(v.map((x) => x.approx), [false, false, true]);
  assert.deepEqual(queryVariants("Co.opmart Huỳnh Tấn Phát, Q.7, TP. HCM").map((x) => x.q), ["Co.opmart Huỳnh Tấn Phát, Q.7, TP. HCM", "Co.opmart Huỳnh Tấn Phát"]);
  assert.deepEqual(queryVariants("  "), []);
});

test("nhận ra kết quả không khớp số nhà", () => {
  assert.equal(houseNumber("139/3 Phan Đăng Lưu"), "139");
  assert.equal(houseNumber("Co.opmart Huỳnh Tấn Phát"), null);
  assert.ok(matchesHouseNumber("Công Ty Nệm, 139, Phan Dang Luu, Phường Cầu Kiệu", "139"));
  assert.ok(!matchesHouseNumber("Dien Bien Phu Highway, Khu phố 13, Phường Thạnh Mỹ Tây, 72331", "527"));
  assert.ok(!matchesHouseNumber("Dien Bien Phu, 1527, Phường X", "527"));
  assert.ok(matchesHouseNumber("bất kỳ", null));
});

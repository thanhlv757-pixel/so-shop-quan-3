// Reads chat / bank-transfer screenshots with Gemini and returns deposit form values.
// Secret GEMINI_API_KEY is set in Supabase -> Edge Functions -> Secrets. Images are not stored.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

const str = { type: "string" };
const schema = {
  type: "object",
  properties: {
    customer: str, phone: str, product: str, variant: str, note: str,
    category: { type: "string", enum: ["Vợt", "Giày", "Balo", "Phụ kiện", "Quần áo", "Khác", ""] },
    date: { type: "string", description: "YYYY-MM-DD or empty" },
    amount: { type: "integer", description: "deposit in VND, 0 if not shown" },
  },
  required: ["customer", "phone", "product", "variant", "note", "category", "date", "amount"],
};
const PROMPT = `Ảnh là màn hình tin nhắn giữa shop cầu lông và một khách đặt cọc, và/hoặc biên lai chuyển khoản tiền cọc.
Trích thông tin để điền form khách đặt cọc. Chỉ ghi điều nhìn thấy rõ trong ảnh; không rõ thì để chuỗi rỗng (amount = 0). Không đoán.
- customer: tên khách (ưu tiên tên khách tự ghi, sau đó tên ở tiêu đề cuộc trò chuyện, bỏ phần ghi chú sản phẩm trong tiêu đề).
- phone: số điện thoại khách, chỉ chữ số.
- category: loại sản phẩm. product: tên/mã sản phẩm. variant: size / màu / phiên bản.
- amount: số tiền khách ĐÃ CỌC (đồng). Giá bán, giá khuyến mãi không phải tiền cọc.
- date: ngày nhận cọc nếu ảnh ghi rõ ngày tháng năm.
- note: hình thức cọc (Tiền mặt / Chuyển khoản), tên người chuyển nếu khác tên khách, địa chỉ giao hàng nếu có. Ngắn gọn.`;

// The REST response shape of the Interactions API is not documented on the page we checked: take output_text, else the last "text" string anywhere.
function findText(v: unknown): string | undefined {
  if (!v || typeof v !== "object") return;
  let out: string | undefined;
  for (const [k, x] of Object.entries(v)) {
    if (k === "text" && typeof x === "string") out = x;
    else out = findText(x) ?? out;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // Only members of the shop book may spend the Gemini quota.
  const mem = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/is_member`, {
    method: "POST",
    headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")!, Authorization: req.headers.get("Authorization") ?? "", "Content-Type": "application/json" },
    body: "{}",
  });
  if (!mem.ok || (await mem.json()) !== true) return json({ error: "forbidden" }, 403);

  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ error: "no_key" }, 500);

  const { images } = await req.json().catch(() => ({}));
  const ok = Array.isArray(images) && images.length >= 1 && images.length <= 3 &&
    images.every((i) => typeof i?.data === "string" && i.data.length < 3_000_000 && i.mime_type === "image/jpeg");
  if (!ok) return json({ error: "bad_images" }, 400);

  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json", "Api-Revision": "2026-05-20" },
    body: JSON.stringify({
      model: "gemini-3.5-flash-lite",
      input: [{ type: "text", text: PROMPT }, ...images.map((i) => ({ type: "image", data: i.data, mime_type: i.mime_type }))],
      response_format: { type: "text", mime_type: "application/json", schema },
    }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    console.error("gemini", r.status, JSON.stringify(j?.error ?? j).slice(0, 500));
    return json({ error: "gemini", status: r.status }, 502);
  }
  try {
    return json(JSON.parse(j.output_text ?? findText(j) ?? ""));
  } catch {
    console.error("gemini unparsable, top-level keys:", Object.keys(j ?? {}).join(","));
    return json({ error: "parse" }, 502);
  }
});

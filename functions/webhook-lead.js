// Cloudflare Pages Function: /webhook-lead
// 官网同域中转：立即 302 跳回官网（用户无感知）→ waitUntil 后台转发 Render
// 根治「Render 免费实例休眠唤醒页」：请求先打到永不休眠的 CF Pages，浏览器马上看到官网，
// Render 在后台被唤醒执行（飞书群/邮件/表3 照常收到，仅延迟几秒）。
const RENDER_LEAD_URL = "https://dg-supply-chain-monitor.onrender.com/webhook/lead";
const DEFAULT_NEXT = "https://miracle-website-e8e.pages.dev/";
const MAX_FILES = 5;
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB/个（与 Render 侧一致）

export async function onRequestPost(context) {
  const { request, waitUntil } = context;
  const fallback = DEFAULT_NEXT + "?upload=error";
  try {
    const form = await request.formData();

    // 组装转发表单：普通字段原样转发；文件转成 attachments（最多 5 个，单个 ≤15MB）
    const forward = new FormData();
    let fileCount = 0;
    const tooBig = [];
    for (const [key, value] of form.entries()) {
      if (value instanceof File) {
        fileCount++;
        if (fileCount > MAX_FILES) continue; // 超出数量上限直接丢弃
        if (value.size > MAX_FILE_BYTES) { tooBig.push(value.name); continue; }
        forward.append("attachments", value, value.name);
      } else {
        forward.append(key, value);
      }
    }

    // 后台转发，不阻塞浏览器
    waitUntil((async () => {
      try {
        await fetch(RENDER_LEAD_URL, { method: "POST", body: forward });
      } catch (e) {
        // best-effort：转发失败不打扰用户（可在飞书兜底日志观察）
      }
    })());

    // 302 立即回官网
    let next = form.get("_next") || DEFAULT_NEXT;
    if (typeof next !== "string" || !next.startsWith("http")) next = DEFAULT_NEXT;
    if (tooBig.length) {
      next += (next.includes("?") ? "&" : "?") +
        "upload=too_big&files=" + encodeURIComponent(tooBig.join(","));
    }
    return Response.redirect(next, 302);
  } catch (e) {
    return Response.redirect(fallback, 302);
  }
}

// GET 访问时给个提示页
export async function onRequestGet() {
  return new Response(
    "<html><body style='font-family:sans-serif;text-align:center;padding:60px'>" +
    "<h2>Form endpoint active</h2>" +
    "<p>POST form fields: name/company/email/phone/country/product/message/source_page + attachments (≤5 files, ≤15MB each)</p>" +
    "<p><a href='/'>Back to homepage</a></p></body></html>",
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

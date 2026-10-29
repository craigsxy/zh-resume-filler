// 上传适配器：把资料库里的 dataUrl 照片塞进 input[type=file]
import { fire, sleep } from '../util.js';

function dataUrlToBlob(dataUrl) {
  const [head, b64] = String(dataUrl).split(',');
  const mime = (head.match(/:(.*?);/) || [])[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function writeUpload(plan) {
  const v = plan.value;
  if (!v || typeof v !== 'object' || !v.dataUrl) return { status: 'skipped', reason: 'no-photo' };
  let input = plan.field.el;
  // 标签落在了上传区旁边的文本框（显示文件名的只读框 / 「上 传」按钮）上：
  // 就近找同一字段行里的 input[type=file]
  if (!input || input.type !== 'file') {
    const box = plan.field.container;
    let near = null;
    for (let n = box, d = 0; n && !near && d < 3; n = n.parentElement, d++) {
      try {
        const all = n.querySelectorAll('input[type="file"]');
        if (all.length === 1) near = all[0];
      } catch (_) {}
    }
    if (!near) return { status: 'skipped', reason: 'not-file-input' };
    input = near;
  }
  // 照片字段不往"只收文档"的控件里塞，反之亦然（accept 明确写了才判）
  const accept = String(input.getAttribute('accept') || '').toLowerCase();
  const mime = String(v.type || '').toLowerCase();
  if (accept && mime) {
    const okAccept = accept
      .split(',')
      .map(x => x.trim())
      .some(a => a === mime || (a.endsWith('/*') && mime.startsWith(a.slice(0, -1))) || (a.startsWith('.') && String(v.name || '').toLowerCase().endsWith(a)));
    if (!okAccept) return { status: 'skipped', reason: 'upload-type-mismatch' };
  }

  try {
    const blob = dataUrlToBlob(v.dataUrl);
    const file = new File([blob], v.name || 'photo.jpg', { type: v.type || blob.type || 'image/jpeg' });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    fire(input, 'change', { bubbles: true });
    await sleep(100);
    const ok = input.files && input.files.length > 0;
    return ok
      ? { status: 'filled', via: 'upload', readback: input.files[0].name }
      : { status: 'failed', reason: 'upload-failed' };
  } catch (e) {
    return { status: 'failed', reason: 'upload-error:' + String(e && e.message).slice(0, 60) };
  }
}

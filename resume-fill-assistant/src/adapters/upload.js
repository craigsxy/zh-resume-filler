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
  const input = plan.field.el;
  if (!input || input.type !== 'file') return { status: 'skipped', reason: 'not-file-input' };

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

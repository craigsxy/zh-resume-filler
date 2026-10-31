// content script 入口（打包为 content.bundle.js，注入到隔离世界）
import { fillPage } from './fill.js';
import * as bridge from './bridge.js';

// AI 请求转给 background：API Key 只在 background 里，内容脚本不持有
function aiClient(messages) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ type: 'AI_CHAT', messages }, res => {
        const err = chrome.runtime.lastError;
        if (err) return reject(new Error(err.message));
        if (!res || !res.ok) return reject(new Error((res && res.error) || 'AI 请求失败'));
        resolve(res.content);
      });
    } catch (e) {
      reject(e);
    }
  });
}

// 进度发给侧边栏 / 后台（后台再转给本页的悬浮按钮）。节流：填写阶段最多每 120ms 一条
let lastSent = 0;
function reportProgress(info) {
  const now = Date.now();
  if (info.stage === 'fill' && now - lastSent < 120 && info.done !== info.total) return;
  lastSent = now;
  try {
    chrome.runtime.sendMessage({ type: 'FILL_PROGRESS', ...info }, () => void chrome.runtime.lastError);
  } catch (_) {}
}

if (!window.__saaContentReady) {
  window.__saaContentReady = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'FILL_FORM') return false;
    (async () => {
      try {
        const report = await fillPage(msg.profile || {}, {
          bridge,
          onProgress: reportProgress,
          aiClient: msg.ai ? aiClient : null,
          aiForce: !!msg.aiForce,
          root: msg.region ? window.__saaRegionRoot || null : null,
        });
        sendResponse(report);
      } catch (e) {
        sendResponse({ error: String((e && e.message) || e), found: false });
      }
    })();
    return true; // 异步响应
  });
}

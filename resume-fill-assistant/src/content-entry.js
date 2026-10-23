// content script 入口（打包为 content.bundle.js，注入到隔离世界）
import { fillPage } from './fill.js';
import * as bridge from './bridge.js';

if (!window.__saaContentReady) {
  window.__saaContentReady = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'FILL_FORM') return false;
    (async () => {
      try {
        const report = await fillPage(msg.profile || {}, { bridge });
        sendResponse(report);
      } catch (e) {
        sendResponse({ error: String((e && e.message) || e), found: false });
      }
    })();
    return true; // 异步响应
  });
}

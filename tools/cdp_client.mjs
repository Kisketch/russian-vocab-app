// 最小 CDP 客户端：仅用 Node 内置 WebSocket，驱动本地 Chromium（与桌面 Electron 同源引擎）
export class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = new Map(); this.queue = [];
    this.open = (typeof ws.readyState === 'number') ? ws.readyState === 1 : false;
    ws.addEventListener('message', (e) => this._onMsg(e.data));
    ws.addEventListener('open', () => { this.open = true; this.queue.forEach(m => ws.send(m)); this.queue = []; });
  }
  _sendRaw(obj) { const s = JSON.stringify(obj); if (this.open) this.ws.send(s); else this.queue.push(s); }
  send(method, params = {}, sessionId = null, timeoutMs = 15000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('CDP timeout: ' + method)); } }, timeoutMs);
      this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      this._sendRaw({ id, method, params: params || {}, ...(sessionId ? { sessionId } : {}) });
    });
  }
  on(method, cb) { this.handlers.set(method, cb); }
  _onMsg(data) {
    let msg; try { msg = JSON.parse(typeof data === 'string' ? data : data.toString()); } catch { return; }
    if (msg.id && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id); this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result);
      return;
    }
    if (msg.method) { const h = this.handlers.get(msg.method); if (h) h(msg.params, msg.sessionId); }
  }
  close() { try { this.ws.close(); } catch {} }
}

export async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', () => res()); ws.addEventListener('error', (e) => rej(e)); });
  return new CDP(ws);
}

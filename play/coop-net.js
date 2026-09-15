// Real-time co-op transport.
//
// WHY A PUBLIC MQTT BROKER, AND WHY IT IS SAFE TO USE ONE HERE
// The game is hosted on Vercel, whose functions cannot hold a socket open, so there is no
// server of ours that could relay positions between players. Polling the database instead
// would cost one function call per player several times a second -- twelve children would
// exhaust the free plan in a week, and it would still feel laggy.
//
// A public MQTT broker over WebSocket relays small messages and needs no account. The
// catch is that anyone can subscribe to anything on it, so nothing readable is ever sent:
//
//   - The room code is the only secret. It never leaves the browser.
//   - The topic is a hash of the code, so the broker cannot tell which room is which.
//   - Every payload is AES-GCM encrypted under a key stretched from the code with PBKDF2.
//     The broker, and anyone listening to it, sees only random-looking bytes. A tampered
//     message fails authentication and is dropped.
//
// What does travel (inside the encryption): a random per-session id, the display name the
// child typed for the room, their position, heading and outfit. No account id, no email.
//
// The MQTT client below is written out by hand -- CONNECT, SUBSCRIBE, PUBLISH at QoS 0,
// PING -- for the same reason the Solana receipt is: a library that pulls in a dozen
// packages is a dozen chances for the co-op to fail to load on the day it matters.

export const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt'
];

const TOPIC_ROOT = 'skyseed/v1/';
const SALT = 'skyseed-isles/coop/v1';
const CONNECT_TIMEOUT = 10000;
// no 0/O, 1/I/L: a code gets read aloud across a classroom
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LEN = 6;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function makeCode(rand) {
  const r = rand || (() => globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296);
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += CODE_ALPHABET[Math.floor(r() * CODE_ALPHABET.length)];
  return s;
}

// Forgiving about case, spaces and dashes; strict about the characters themselves. The
// look-alikes were never issued, so a code containing one is simply not a code -- guessing
// which letter a child meant would put them in a stranger's room.
export function normaliseCode(raw) {
  const s = String(raw || '').toUpperCase().replace(/[\s-]/g, '');
  return s.length === CODE_LEN && [...s].every(c => CODE_ALPHABET.includes(c)) ? s : null;
}

function hex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function roomSecrets(code) {
  const subtle = globalThis.crypto.subtle;
  const topic = TOPIC_ROOT + hex(await subtle.digest('SHA-256', enc.encode('topic:' + code))).slice(0, 32);
  const base = await subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(SALT), iterations: 60000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return { topic, key };
}

export async function seal(key, obj) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv, 0); out.set(new Uint8Array(ct), 12);
  return out;
}

export async function unseal(key, bytes) {
  if (bytes.length < 13) return null;
  try {
    const pt = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
    return JSON.parse(dec.decode(pt));
  } catch { return null; }             // wrong room, or tampered: either way, not ours
}

// ---------- minimal MQTT 3.1.1 ----------
function varLen(n) {
  const out = [];
  do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; out.push(b); } while (n > 0);
  return out;
}
function str(s) { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; }
function packet(type, body) { return Uint8Array.from([type, ...varLen(body.length), ...body]); }

export function mqttConnect(clientId, keepAlive = 30) {
  return packet(0x10, [...str('MQTT'), 4, 0x02, keepAlive >> 8, keepAlive & 255, ...str(clientId)]);
}
export function mqttSubscribe(id, topic) {
  return packet(0x82, [id >> 8, id & 255, ...str(topic), 0]);
}
export function mqttPublish(topic, payload) {
  const t = str(topic);
  const body = new Uint8Array(t.length + payload.length);
  body.set(t, 0); body.set(payload, t.length);
  const head = [0x30, ...varLen(body.length)];
  const out = new Uint8Array(head.length + body.length);
  out.set(head, 0); out.set(body, head.length);
  return out;
}
const PINGREQ = Uint8Array.from([0xc0, 0]);
const DISCONNECT = Uint8Array.from([0xe0, 0]);

// Splits a byte stream into MQTT packets. A WebSocket frame may carry several packets, or
// half of one, so bytes are buffered until a whole packet is there.
export function makeParser(onPacket) {
  let buf = new Uint8Array(0);
  return chunk => {
    const n = new Uint8Array(buf.length + chunk.length);
    n.set(buf, 0); n.set(chunk, buf.length); buf = n;
    for (;;) {
      if (buf.length < 2) return;
      let len = 0, mul = 1, i = 1, b;
      do {
        if (i >= buf.length) return;
        b = buf[i++]; len += (b & 127) * mul; mul *= 128;
      } while (b & 128);
      if (buf.length < i + len) return;
      onPacket(buf[0], buf.slice(i, i + len));
      buf = buf.slice(i + len);
    }
  };
}

function readPublish(head, body) {
  const tl = (body[0] << 8) | body[1];
  const topic = dec.decode(body.slice(2, 2 + tl));
  const qos = (head >> 1) & 3;
  return { topic, payload: body.slice(2 + tl + (qos ? 2 : 0)) };
}

// ---------- the room ----------
// ALL BROKERS AT ONCE. A room is joined on every broker that answers, every message is
// published to all of them, and duplicates are dropped by their encryption nonce. The
// obvious alternative -- try the first broker, fall through to the next -- splits rooms:
// one child's first broker hiccups, they land on the second while their friend sits on
// the first, and the two never see each other. With fan-out, two children meet as long as
// they share any one broker.
//
// DIRECT PATH. The brokers are overseas, so a message relayed through one takes a couple
// of hundred milliseconds each way. Once two players have found each other in the
// encrypted room, they use it to set up a WebRTC data channel straight between their
// browsers. Two children on the same home or school Wi-Fi then talk over the local network
// in a few milliseconds; players further apart still usually get a shorter path than the
// relay. If the direct link cannot be made (some mobile networks forbid it) nothing
// breaks: the relay simply keeps carrying everything.
//
// What the direct path costs in privacy, stated plainly: a WebRTC link shows each player's
// IP address to the other players in the room, and the STUN servers below see it too. The
// room code is the gate -- only people a child gave the code to are in the room.
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];

export class CoopRoom {
  constructor({ brokers = BROKERS, onPeer, onLeave, onStatus, onChat, WebSocketImpl, direct = true } = {}) {
    this.brokers = brokers;
    this.onPeer = onPeer || (() => {});
    this.onLeave = onLeave || (() => {});
    this.onStatus = onStatus || (() => {});
    this.onChat = onChat || (() => {});
    this.WS = WebSocketImpl || globalThis.WebSocket;
    this.direct = direct && typeof globalThis.RTCPeerConnection === 'function';
    this.id = hex(globalThis.crypto.getRandomValues(new Uint8Array(6)));
    this.peers = new Map();            // id -> { name, state, seen, rtt, via, pc, dc }
    this.socks = new Map();            // broker url -> open, subscribed socket
    this.code = null; this.secrets = null; this.closed = false;
    this.rtt = null;                   // most recent round trip to any peer, in ms
    this._seen = new Set(); this._seenQ = [];
    this._timers = [];
  }

  get connected() { return this.socks.size > 0; }
  get broker() { return [...this.socks.keys()][0] || null; }

  // Resolves as soon as the first broker is subscribed; the others keep connecting in the
  // background and join the fan-out when they are ready.
  async join(code, name) {
    this.code = code; this.name = String(name || 'Friend').slice(0, 16);
    this.closed = false;
    this.secrets = await roomSecrets(code);
    return new Promise(resolve => {
      let pending = this.brokers.length, won = false;
      for (const url of this.brokers) {
        this.onStatus('connecting', url);
        this._open(url).then(ok => {
          if (ok && !won && !this.closed) {
            won = true;
            this._timers.push(setInterval(() => this._tick(), 1000));
            this._timers.push(setInterval(() => this._raw(PINGREQ), 20000));
            this.send({ type: 'hello' });
            resolve(true);
          } else if (ok) {
            this.send({ type: 'hello' });            // announce on the late broker too
          }
          if (--pending === 0 && !won) { this.onStatus('offline', null); resolve(false); }
        });
      }
    });
  }

  _open(url) {
    return new Promise(resolve => {
      let done = false, to = null;
      const finish = ok => { if (!done) { done = true; clearTimeout(to); resolve(ok); } };
      let ws;
      try { ws = new this.WS(url, 'mqtt'); } catch { this.onStatus('failed', url); return resolve(false); }
      ws.binaryType = 'arraybuffer';
      to = setTimeout(() => { this.onStatus('timeout', url); try { ws.close(); } catch {} finish(false); }, CONNECT_TIMEOUT);
      const parse = makeParser((head, body) => {
        const type = head & 0xf0;
        if (type === 0x20) {                                   // CONNACK
          if (body[1] !== 0) { this.onStatus('refused', url); return finish(false); }
          ws.send(mqttSubscribe(1, this.secrets.topic));
        } else if (type === 0x90) {                            // SUBACK
          if (this.closed) { try { ws.close(); } catch {} return finish(false); }
          this.socks.set(url, ws);
          this.onStatus('connected', url);
          finish(true);
        } else if (type === 0x30) {                            // PUBLISH
          const m = readPublish(head, body);
          if (m.topic === this.secrets.topic) this._receive(m.payload);
        }
      });
      ws.onopen = () => ws.send(mqttConnect('sky-' + this.id + '-' + Math.floor(Math.random() * 1e6)));
      ws.onmessage = e => parse(new Uint8Array(e.data));
      ws.onerror = () => { this.onStatus('failed', url); finish(false); };
      ws.onclose = () => {
        finish(false);
        if (this.socks.get(url) !== ws) return;
        this.socks.delete(url);
        if (this.closed) return;
        this.onStatus(this.socks.size ? 'lost one relay' : 'reconnecting', url);
        // bring this one broker back on its own; the room stays up on the others
        setTimeout(() => { if (!this.closed && !this.socks.has(url)) this._open(url).then(ok => { if (ok) this.send({ type: 'hello' }); }); }, 2000);
      };
    });
  }

  _raw(bytes) {
    for (const ws of this.socks.values()) {
      if (ws.readyState === 1) { try { ws.send(bytes); } catch {} }
    }
  }
  _envelope(msg) { return Object.assign({ from: this.id, n: this.name, at: Date.now() }, msg); }

  // to everyone, through the encrypted relays
  async send(msg) {
    if (!this.socks.size || !this.secrets) return;
    this._raw(mqttPublish(this.secrets.topic, await seal(this.secrets.key, this._envelope(msg))));
  }

  // to one peer: straight down the data channel when there is one, else through the relay
  _to(p, msg) {
    if (p.dc && p.dc.readyState === 'open') {
      try { p.dc.send(JSON.stringify(this._envelope(msg))); return; } catch {}
    }
    this.send(msg);
  }

  // to everyone, taking the direct path where it exists and the relay only if someone
  // still needs it -- so the relay goes quiet once every friend is directly connected
  _all(msg) {
    let needRelay = false;
    for (const p of this.peers.values()) {
      if (p.dc && p.dc.readyState === 'open') {
        try { p.dc.send(JSON.stringify(this._envelope(msg))); } catch { needRelay = true; }
      } else needRelay = true;
    }
    if (needRelay || !this.peers.size) this.send(msg);
  }

  // position updates go out unawaited so a slow encrypt never stalls a frame
  sendState(s) { this._all({ type: 'st', s }); }
  chat(text) { this._all({ type: 'chat', text: String(text).slice(0, 80) }); }
  ping() { this._all({ type: 'ping', t: performance.now() }); }

  async _receive(bytes) {
    // the same message arrives once per broker; its random nonce identifies it
    const nonce = hex(bytes.slice(0, 12));
    if (this._seen.has(nonce)) return;
    this._seen.add(nonce); this._seenQ.push(nonce);
    if (this._seenQ.length > 1024) this._seen.delete(this._seenQ.shift());
    const m = await unseal(this.secrets.key, bytes);
    if (!m || m.from === this.id) return;                      // our own echo, or not our room
    this._handle(m, 'relay');
  }

  _handle(m, via) {
    let p = this.peers.get(m.from);
    const fresh = !p;
    if (!p) {
      p = { id: m.from, name: m.n, state: null, seen: 0, rtt: null, via: 'relay', pc: null, dc: null };
      this.peers.set(m.from, p);
    }
    p.name = String(m.n || 'Friend').slice(0, 16); p.seen = Date.now();
    if (m.type === 'bye') { this._drop(p); this.onLeave(p); return; }
    if (m.type === 'hello' && fresh) this.send({ type: 'hello' });   // let a newcomer see us at once
    // exactly one side offers, or both would and the two half-built links would collide
    if (fresh && this.direct && this.id < m.from) this._offer(p);
    if (m.type === 'rtc' && m.to === this.id) this._signal(p, m.sdp);
    if (m.type === 'ping') this._to(p, { type: 'pong', to: m.from, t: m.t });
    if (m.type === 'pong' && m.to === this.id) {
      p.rtt = performance.now() - m.t; p.rttVia = via; this.rtt = p.rtt;
    }
    if (m.type === 'st') p.state = m.s;
    if (m.type === 'chat') this.onChat(p, String(m.text || '').slice(0, 80));
    this.onPeer(p, fresh);
  }

  // ---------- WebRTC ----------
  _pc(p) {
    if (p.pc) { try { p.pc.close(); } catch {} }
    const pc = new RTCPeerConnection({ iceServers: ICE });
    p.pc = pc;
    pc.ondatachannel = e => this._wire(p, e.channel);
    pc.onconnectionstatechange = () => {
      if (p.pc !== pc) return;
      this.onStatus('rtc ' + pc.connectionState, p.name);
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        p.dc = null; p.via = 'relay';
      }
    };
    return pc;
  }

  // how many ways the browser found to be reached, by kind -- host (the local network),
  // srflx (a public address found through STUN) -- which is what decides whether a direct
  // link is possible at all
  _candidates(sdp) {
    const kinds = {};
    for (const m of String(sdp).matchAll(/ typ (\w+)/g)) kinds[m[1]] = (kinds[m[1]] || 0) + 1;
    return Object.entries(kinds).map(([k, n]) => k + ':' + n).join(',') || 'none';
  }

  _wire(p, dc) {
    dc.onopen = () => { p.dc = dc; p.via = 'direct'; this.onStatus('direct', p.name); this.onPeer(p, false); };
    dc.onclose = () => { if (p.dc === dc) { p.dc = null; p.via = 'relay'; } };
    dc.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      // only the peer this channel was built for may speak on it
      if (m && m.from === p.id) this._handle(m, 'direct');
    };
  }

  // all candidates are gathered before the description is sent, so the whole handshake is
  // one offer and one answer through the relay instead of a trickle of candidate messages
  _gathered(pc) {
    return new Promise(res => {
      if (pc.iceGatheringState === 'complete') return res();
      const t = setTimeout(res, 2500);
      pc.addEventListener('icegatheringstatechange', () => {
        if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); }
      });
    });
  }

  async _offer(p) {
    try {
      const pc = this._pc(p);
      this._wire(p, pc.createDataChannel('sky', { ordered: false, maxRetransmits: 0 }));
      await pc.setLocalDescription(await pc.createOffer());
      await this._gathered(pc);
      const d = pc.localDescription;
      this.onStatus('rtc offer ' + this._candidates(d.sdp), p.name);
      this.send({ type: 'rtc', to: p.id, sdp: { type: d.type, sdp: d.sdp } });
    } catch (e) {
      // the direct path is a bonus; the relay keeps working
      this.onStatus('rtc error ' + (e && e.message || e), p.name);
    }
  }

  async _signal(p, sdp) {
    try {
      if (!sdp || typeof sdp.sdp !== 'string') return;
      if (sdp.type === 'offer' && this.direct) {
        const pc = this._pc(p);
        await pc.setRemoteDescription(sdp);
        await pc.setLocalDescription(await pc.createAnswer());
        await this._gathered(pc);
        const d = pc.localDescription;
        this.onStatus('rtc answer ' + this._candidates(d.sdp) + ' for offer ' + this._candidates(sdp.sdp), p.name);
        this.send({ type: 'rtc', to: p.id, sdp: { type: d.type, sdp: d.sdp } });
      } else if (sdp.type === 'answer' && p.pc && p.pc.signalingState === 'have-local-offer') {
        await p.pc.setRemoteDescription(sdp);
        this.onStatus('rtc answered ' + this._candidates(sdp.sdp), p.name);
      }
    } catch (e) {
      // same: stay on the relay
      this.onStatus('rtc error ' + (e && e.message || e), p.name);
    }
  }

  _drop(p) {
    this.peers.delete(p.id);
    if (p.pc) { try { p.pc.close(); } catch {} }
    p.pc = null; p.dc = null;
  }

  _tick() {
    const now = Date.now();
    for (const p of [...this.peers.values()]) {
      if (now - p.seen > 6000) { this._drop(p); this.onLeave(p); }
    }
    if (this.peers.size) this.ping();
  }

  // a summary the game can show: how many friends, and how they are connected
  links() {
    return [...this.peers.values()].map(p => ({
      id: p.id, name: p.name, via: p.via, rtt: p.rtt === null ? null : Math.round(p.rtt * 10) / 10
    }));
  }

  leave() {
    this.closed = true;
    this._timers.forEach(clearInterval); this._timers = [];
    for (const p of this.peers.values()) {
      if (p.dc && p.dc.readyState === 'open') {
        try { p.dc.send(JSON.stringify(this._envelope({ type: 'bye' }))); } catch {}
      }
    }
    const socks = [...this.socks.values()];
    this.socks.clear();
    if (socks.length && this.secrets) {
      // sealed and sent on the captured sockets: send() would find the map already
      // cleared, and the goodbye would silently never leave
      const topic = this.secrets.topic;
      seal(this.secrets.key, this._envelope({ type: 'bye' }))
        .then(bytes => { for (const ws of socks) if (ws.readyState === 1) ws.send(mqttPublish(topic, bytes)); })
        .finally(() => setTimeout(() => {
          for (const ws of socks) { try { ws.send(DISCONNECT); ws.close(); } catch {} }
        }, 150));
    }
    for (const p of [...this.peers.values()]) { this._drop(p); this.onLeave(p); }
    this.onStatus('left', null);
  }
}

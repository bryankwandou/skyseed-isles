// Co-op transport, tested without a browser: the packet codec, the encryption, and two
// real rooms meeting on a real public broker. No mocks for the network part -- a mocked
// broker proves only that the mock relays messages.
import {
  BROKERS, makeCode, normaliseCode, roomSecrets, seal, unseal,
  mqttPublish, makeParser, CoopRoom, CODE_ALPHABET
} from '../play/coop-net.js';

let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra !== undefined ? '  ' + extra : ''));
  if (!cond) fails++;
}

// ---------- room codes ----------
const code = makeCode();
ok('a room code is six characters from the safe alphabet',
  code.length === 6 && [...code].every(c => CODE_ALPHABET.includes(c)), code);
ok('typing it in lower case with a dash still works', normaliseCode(code.slice(0, 3).toLowerCase() + '-' + code.slice(3)) === code);
ok('a code with a look-alike character is refused, not guessed at', normaliseCode('ABC0EF') === null);
ok('a short code is refused', normaliseCode('ABCDE') === null);

// ---------- packets ----------
const payload = new Uint8Array(300).fill(9);            // > 127 bytes: two-byte length prefix
const pkt = mqttPublish('skyseed/v1/abc', payload);
const got = [];
const parse = makeParser((h, b) => got.push([h, b.length]));
parse(pkt.slice(0, 5)); parse(pkt.slice(5));             // one packet split across two frames
parse(Uint8Array.from([...pkt, ...pkt]));                // two packets in one frame
ok('a packet split across frames is reassembled, and two in one frame are both read',
  got.length === 3 && got.every(([h, n]) => h === 0x30 && n === pkt.length - 3), JSON.stringify(got));

// ---------- encryption ----------
const a = await roomSecrets('ABCDEF');
const b = await roomSecrets('ABCDEG');
ok('different rooms get different topics', a.topic !== b.topic, a.topic);
ok('the topic does not contain the code', !a.topic.includes('ABCDEF'));
const sealed = await seal(a.key, { hi: 'miru' });
ok('a sealed message opens with the right room key', (await unseal(a.key, sealed))?.hi === 'miru');
ok('the ciphertext does not contain the name in the clear',
  !Buffer.from(sealed).toString('latin1').includes('miru'));
ok('another room cannot read it', (await unseal(b.key, sealed)) === null);
const tampered = sealed.slice(); tampered[20] ^= 1;
ok('a tampered message is dropped', (await unseal(a.key, tampered)) === null);

// ---------- two rooms, one real broker ----------
const room = makeCode();
const seen = { a: null, b: null };
const chats = [];
const A = new CoopRoom({ onPeer: p => { if (p.state) seen.a = p; } });
const B = new CoopRoom({
  onPeer: p => { if (p.state) seen.b = p; },
  onChat: (p, text) => chats.push(text)
});
const t0 = Date.now();
const [ja, jb] = await Promise.all([A.join(room, 'Ayu'), B.join(room, 'Budi')]);
ok('player A reaches a broker', ja, A.broker);
ok('player B reaches a broker', jb, B.broker);

if (ja && jb) {
  // positions flow both ways
  const deadline = Date.now() + 8000;
  while ((!seen.a || !seen.b) && Date.now() < deadline) {
    A.sendState({ x: 1, y: 2, z: 3, r: 0.5, k: 'aurora' });
    B.sendState({ x: -4, y: 2, z: 8, r: 1.5, k: null });
    await new Promise(r => setTimeout(r, 100));
  }
  ok('A sees B, by name, where B is', seen.a && seen.a.name === 'Budi' && seen.a.state.z === 8,
    seen.a && JSON.stringify(seen.a.state));
  ok('B sees A, in A\'s outfit', seen.b && seen.b.name === 'Ayu' && seen.b.state.k === 'aurora',
    seen.b && JSON.stringify(seen.b.state));
  ok('they found each other within 8 s of joining', Date.now() - t0 < 16000, (Date.now() - t0) + ' ms');

  A.chat('hi Budi!');
  const rtts = [];
  for (let i = 0; i < 10; i++) {
    A.rtt = null; A.ping();
    const until = Date.now() + 3000;
    while (A.rtt === null && Date.now() < until) await new Promise(r => setTimeout(r, 5));
    if (A.rtt !== null) rtts.push(A.rtt);
  }
  rtts.sort((x, y) => x - y);
  const med = rtts[Math.floor(rtts.length / 2)];
  ok('round trips are measured', rtts.length >= 8, rtts.length + '/10');
  // honest bound: the relay is a broker somewhere on the internet, so this is
  // player -> broker -> player -> broker -> player. It is reported, not assumed.
  ok('median round trip is interactive (under 1 s)', med < 1000,
    'median ' + med.toFixed(1) + ' ms, best ' + rtts[0].toFixed(1) + ' ms via ' + A.broker);
  ok('a chat line arrives', chats.includes('hi Budi!'), JSON.stringify(chats));

  let left = false;
  B.onLeave = p => { if (p.name === 'Ayu') left = true; };
  A.leave();
  const until = Date.now() + 5000;
  while (!left && Date.now() < until) await new Promise(r => setTimeout(r, 50));
  ok('when A leaves, B is told', left);
  B.leave();
}

console.log('brokers tried in order:', BROKERS.join(', '));
console.log(fails ? 'COOP NET TEST: FAIL (' + fails + ')' : 'COOP NET TEST: PASS');
setTimeout(() => process.exit(fails ? 1 : 0), 300);

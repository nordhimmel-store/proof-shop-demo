import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
const MOB = innerWidth < 760 || matchMedia('(pointer:coarse)').matches;
const P = window.PRODUCT, RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const C = { cream:'#F2EDE3', graph:'#2B2B2B', black:'#0E0D0C', maple:'#E3C79A', amber:'#FFB54A', red:'#D9442B', steel:'#8A8F94' };
const state = { plies: [...P.stainPresets.Natural], ply: 0, mould: P.moulds[1], art: null, artIdx: 0, sc: 1, rot: 0, pos: 0, text: '', grip: P.grips[0], station: 0 };
$$('.cn').forEach(e => e.textContent = P.checkNote);
$('#pr').textContent = P.currency + P.price + ' (' + P.priceNote + ')';

/* ================= AUDIO: synthesized foley, layers build per station ================= */
let AC, hum, humG, OUT;
function audioOn() { if (AC) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  OUT = AC.createGain(); OUT.connect(AC.destination); loadSamples(); humG = AC.createGain(); humG.gain.value = .0; humG.connect(OUT);
  [55, 110.5, 164].forEach((f, i) => { const o = AC.createOscillator(); o.type = i ? 'sine' : 'sawtooth'; o.frequency.value = f; const g = AC.createGain(); g.gain.value = i ? .15 : .05;
    const lp = AC.createBiquadFilter(); lp.frequency.value = 300; o.connect(lp).connect(g).connect(humG); o.start(); }); }
function noise(dur, f = 1200, q = 1, vol = .2, type = 'bandpass', decay = 1) { if (!AC) return; const n = AC.sampleRate * dur | 0, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
  const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = vol; s.buffer = b; s.connect(fl).connect(g).connect(OUT); s.start(); }
function tone(f0, f1, dur, vol = .3, type = 'sine') { if (!AC) return; const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime; o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g).connect(OUT); o.start(); o.stop(t + dur); }
const sfx = {
  knock: () => { play('wood_creak', .4); tone(220, 90, .18, .5); noise(.06, 900, 2, .3); },
  clack: () => { play('ui_click_01', .5); tone(900, 500, .05, .15, 'square'); noise(.03, 3000, 3, .15); },
  glug: () => { tone(300, 120, .25, .2); setTimeout(() => tone(260, 110, .2, .15), 120); },
  hiss: (d = .8) => play('hydraulic_press_hiss', .5) || noise(d, 5000, .7, .12, 'highpass', .5),
  peel: () => noise(.45, 2500, .4, .2, 'bandpass', .3),
  whirr: () => { tone(400, 900, .9, .05, 'sawtooth'); },
  slam: () => { play('press_slam', .9); tone(34, 22, 2.2, 1.0); tone(48, 30, .9, .6, 'triangle'); noise(1.6, 200, .5, .9, 'lowpass', 2.5); tone(70, 28, 1.6, .9); noise(.15, 1800, 1, .5); setTimeout(() => tone(1800, 1750, 1.4, .04, 'triangle'), 60); },
  stamp: () => { play('press_stamp_hit', .8); tone(160, 60, .2, .6); noise(.08, 700, 1, .4); },
  scratch: () => noise(.25, 4200, 2, .05)
};
const SMP = {}; function loadSamples() { ['press_slam','press_stamp_hit','hydraulic_press_hiss','wood_creak','ui_click_01','mechanical_clunk','whoosh'].forEach(n => fetch('assets/sfx/' + n + '.ogg').then(r => r.ok ? r.arrayBuffer() : null).then(b => b && AC.decodeAudioData(b, d => SMP[n] = d, () => {})).catch(() => {})); }
function play(n, vol = .6) { if (!AC || !SMP[n]) return; const s = AC.createBufferSource(), g = AC.createGain(); g.gain.value = vol; s.buffer = SMP[n]; s.connect(g).connect(OUT); s.start(); }
function setHum(level) { if (humG) humG.gain.setTargetAtTime(level, AC.currentTime, .6); }

/* ================= TEXTURES (canvas) ================= */
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tl = new THREE.TextureLoader();
const T = p => { const t = tl.load(p); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const W = 'assets/tex/';
const woodC = T(W + 'maple.webp'); woodC.colorSpace = THREE.SRGBColorSpace;
const woodImg = new Image(); woodImg.src = W + 'maple.webp';
const paperImg = new Image(); paperImg.src = W + 'paper.webp';
const gripImg = new Image(); gripImg.src = W + 'grip.webp';
const wmImg = new Image(); wmImg.src = 'assets/canva/proof_wordmark.webp';
const stampImg = new Image(); stampImg.src = 'assets/canva/proof_stamp.webp';

// ply edge texture
const plyCan = mk(16, 140), plyTex = new THREE.CanvasTexture(plyCan); plyTex.colorSpace = THREE.SRGBColorSpace;
function drawPlies() { const x = plyCan.getContext('2d'), n = P.plies, h = 140 / n;
  state.plies.forEach((c, i) => { x.fillStyle = c; x.fillRect(0, (n - 1 - i) * h, 16, h); x.fillStyle = 'rgba(40,25,10,.55)'; x.fillRect(0, (n - 1 - i) * h, 16, 1.5); });
  plyTex.needsUpdate = true; drawGrip(); }
// bottom graphic
const artCan = mk(2048, 540), artTex = new THREE.CanvasTexture(artCan); artTex.colorSpace = THREE.SRGBColorSpace; artTex.anisotropy = 8;
let printReveal = 1;
function paintArt(x, W, H, reveal = 1, scuffs = true) { x.save(); x.scale(W / 2048, H / 540);
  x.fillStyle = state.plies[P.plies - 1]; x.fillRect(0, 0, 2048, 540);
  if (woodImg.naturalWidth) { x.globalAlpha = .35; x.globalCompositeOperation = 'multiply'; x.drawImage(woodImg, 0, 0, 2048, 540); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
  x.beginPath(); x.rect(0, 0, 2048 * reveal, 540); x.clip();
  const a = state.art; if (a) { x.save(); x.translate(1024 + state.pos * 2048, 270 + state.posY * 540); x.rotate(-Math.PI / 2 + state.rot * Math.PI / 180);
    const s = state.sc, ar = (a.width || a.naturalWidth) / (a.height || a.naturalHeight), h = 2048 * s * 1.06, w = Math.max(h * ar, 560 * s);
    x.drawImage(a, -w / 2, -h / 2, w, h); x.restore(); }
  if (state.text) { const fs = Math.min(112, 1250 / Math.max(5, state.text.length)); x.save(); x.translate(1690, 270); x.font = `${fs}px "Archivo Black"`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.lineWidth = fs * .16; x.strokeStyle = C.black; x.strokeText(state.text, 0, 0); x.fillStyle = C.cream; x.fillText(state.text, 0, 0); x.restore(); }
  x.restore();
  if (scuffs) { x.globalAlpha = .07; x.fillStyle = '#000'; for (let i = 0; i < 40; i++) x.fillRect((i * 811) % W, (i * 337) % H, 30 + (i * 13) % 90, 2); x.globalAlpha = 1; } }
function drawArt() { paintArt(artCan.getContext('2d'), 2048, 540, printReveal, true); artTex.needsUpdate = true; drawThumb(); }
const thumbC = document.getElementById('thumb');
function drawThumb() { if (!thumbC) return; const x = thumbC.getContext('2d'); x.clearRect(0, 0, 64, 256); x.save(); x.beginPath(); x.roundRect(4, 2, 56, 252, 28); x.clip();
  x.translate(4, 254); x.rotate(-Math.PI / 2); x.drawImage(artCan, 0, 0, 252, 56); x.restore();
  state.plies.forEach((c, i) => { x.fillStyle = c; x.fillRect(58 - i, 30, 1, 196); }); }
// grip top (dark sandpaper; uv is NOT mirrored)
const gripCan = mk(1024, 270), gripTex = new THREE.CanvasTexture(gripCan); gripTex.colorSpace = THREE.SRGBColorSpace;
let serialOnDeck = null; // [id, name, u, v]
function drawGrip() { const x = gripCan.getContext('2d'), g = state.grip;
  if (g.color) { x.fillStyle = g.color; x.fillRect(0, 0, 1024, 270);
    if (gripImg.naturalWidth) { x.globalCompositeOperation = 'screen'; x.globalAlpha = .22; for (let k = 0; k < 1024; k += 270) x.drawImage(gripImg, k, 0, 270, 270); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; } }
  else { x.fillStyle = state.plies[0]; x.fillRect(0, 0, 1024, 270); if (woodImg.naturalWidth) { x.globalAlpha = .45; x.globalCompositeOperation = 'multiply'; x.drawImage(woodImg, 0, 0, 1024, 270); x.globalCompositeOperation = 'source-over'; }
    if (gripImg.naturalWidth) { x.globalAlpha = .18; for (let k = 0; k < 1024; k += 270) x.drawImage(gripImg, k, 0, 270, 270); } x.globalAlpha = 1; }
  if (g.id === 'print') { x.fillStyle = C.red; x.globalAlpha = .9; x.font = '130px "Archivo Black"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('PROOF', 512, 140); x.globalAlpha = 1; }
  if (serialOnDeck) { const [id, nm, u, v] = serialOnDeck; x.save(); x.translate(u * 1024, (1 - v) * 270); x.rotate(-.05); x.globalAlpha = .95; x.drawImage(stampCanvas(id, nm), -170, -60, 340, 121); x.restore(); }
  gripTex.needsUpdate = true; }
/* procedural fallback graphics (original) */
function procArt(i) { const c = mk(512, 1126), x = c.getContext('2d'); const pal = [[C.cream, C.red, C.graph], [C.graph, C.amber, C.cream], [C.red, C.cream, C.black], [C.maple, C.black, C.red]][(i + (i >> 2)) % 4];
  x.fillStyle = pal[0]; x.fillRect(0, 0, 512, 1126); x.fillStyle = pal[1]; x.strokeStyle = pal[2];
  if (i % 4 === 0) { for (let r = 30; r < 600; r += 34) { x.lineWidth = 14; x.beginPath(); x.arc(256, 563, r, 0, 7); x.stroke(); } x.font = '150px "Archivo Black"'; x.save(); x.translate(330, 563); x.rotate(Math.PI / 2); x.textAlign = 'center'; x.fillText('PROOF', 0, 0); x.restore(); }
  if (i % 4 === 1) { for (let k = 0; k < 9; k++) { x.fillStyle = k % 2 ? pal[1] : pal[2]; x.fillRect(0, k * 125, 512, 62); } x.fillStyle = pal[2]; x.font = '96px "Archivo Black"'; x.textAlign = 'center'; x.fillText('NO', 256, 520); x.fillText('NOTES', 256, 620); }
  if (i % 4 === 2) { x.lineWidth = 10; for (let k = 0; k < 40; k++) { x.beginPath(); x.moveTo(0, k * 40); x.lineTo(512, k * 40 - 300); x.stroke(); } x.fillStyle = pal[1]; x.beginPath(); x.arc(256, 400, 170, 0, 7); x.fill(); x.fillStyle = pal[2]; x.font = '230px "Archivo Black"'; x.textAlign = 'center'; x.fillText('7', 256, 480); }
  if (i % 4 === 3) { x.fillStyle = pal[2]; for (let k = 0; k < 7; k++) { x.fillRect(60 + k * 10, 120 + k * 130, 392 - k * 20, 60); } x.fillStyle = pal[1]; x.font = '64px "Archivo Black"'; x.save(); x.translate(256, 1060); x.textAlign = 'center'; x.fillText('PLY / PLY', 0, 0); x.restore(); }
  return c; }
const arts = [];
function loadArts() { const box = $('#thumbs'); box.innerHTML = '';
  (P.graphics.length ? P.graphics : Array(8).fill(null)).forEach((src, i) => { const th = src ? src.replace('.webp', '_t.webp') : null; const b = document.createElement('button'); b.style.setProperty('--r', ((i * 37) % 5 - 2) * .8 + 'deg'); b.setAttribute('aria-label', 'Graphic ' + (i + 1)); box.append(b);
    const fallback = () => { const c = procArt(i); arts[i] = c; b.style.backgroundImage = `url(${c.toDataURL()})`; if (i === 0 && !state.art) setArt(0, false); };
    const im = new Image(); im.onload = () => { arts[i] = im; b.style.backgroundImage = `url(${th})`; if (i === 0 && !state.art) setArt(0, false); }; im.onerror = fallback; src ? (im.src = src) : fallback();
    dragify(b, { ghost: () => { const g = document.createElement('div'); g.className = 'thumbghost'; g.style.backgroundImage = b.style.backgroundImage; return g; },
      onHover: (x, y) => { glEl.classList.toggle('drop', !!rayAt(x, y, [meshes[0], meshes[1]])); },
      onDrop: (x, y) => { if (rayAt(x, y, [meshes[0], meshes[1]])) { setArt(i, true); complete(2); } else tone(200, 150, .08, .08); },
      onTap: () => { setArt(i, true); complete(2); } }); }); }
function setArt(i, anim) { if (anim && typeof snap === 'function') snap(); state.art = arts[i]; state.artIdx = i; $$('#thumbs button').forEach((b, k) => b.classList.toggle('on', k === i)); printSweep(anim); if (typeof updateReceipt === 'function' && $('#rSpec')) try { updateReceipt(); } catch (e) {} }
function printSweep(anim) { if (!anim || RM) { printReveal = 1; drawArt(); return; } sfx.whirr(); const o = { v: 0 };
  gsap.to(o, { v: 1, duration: .9, ease: 'power1.inOut', onUpdate: () => { printReveal = o.v; drawArt(); head.position.x = (o.v - .5) * 3.4; }, onComplete: () => { head.position.x = 2.4; tone(120, 70, .15, .3); } }); }

/* ================= 3D WORLD ================= */
const R = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, preserveDrawingBuffer: true });
R.setPixelRatio(Math.min(devicePixelRatio, MOB ? 1.5 : 2)); R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
const S = new THREE.Scene(); S.background = new THREE.Color(C.black); S.fog = new THREE.Fog(C.black, 6, 16);
new RGBELoader().load('assets/hdri/studio_small_09_1k.hdr', t => { t.mapping = THREE.EquirectangularReflectionMapping; S.environment = t; S.environmentIntensity = .18; });
const cam = new THREE.PerspectiveCamera(38, 1, .05, 60); cam.position.set(0, 9, 0.01);
const key = new THREE.SpotLight(C.amber, 90, 14, .55, .6, 1.4); key.position.set(1.8, 2.9, 4.4); key.target.position.set(0, -.1, 0); S.add(key.target); key.castShadow = true; key.shadow.mapSize.set(MOB ? 512 : 1024, MOB ? 512 : 1024); key.shadow.bias = -.0004; S.add(key, key.target);
const rim = new THREE.DirectionalLight('#9fb0bf', .7); rim.position.set(-4, 2, -3); S.add(rim);
S.add(new THREE.AmbientLight('#fff', .05));
const conc = T(W + 'conc.webp'); conc.colorSpace = THREE.SRGBColorSpace; conc.repeat.set(6, 6);
const concN = T(W + 'conc_n.webp'); concN.repeat.set(6, 6);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: conc, normalMap: concN, roughness: .95, color: '#777' }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.9; floor.receiveShadow = true; S.add(floor);
// workbench
const metC = T(W + 'brush.webp'); metC.colorSpace = THREE.SRGBColorSpace;
const metR = T(W + 'brush_r.webp'), metN = T(W + 'brush_n.webp');
const steel = new THREE.MeshStandardMaterial({ map: metC, roughnessMap: metR, normalMap: metN, metalness: .85, roughness: .5, color: '#9a9ea2' });
// ===== THE PRESS: heavy industrial hydraulic press =====
const pT = n => T(W + n + '.webp');
const paintC = pT('paint'); paintC.colorSpace = THREE.SRGBColorSpace;
const painted = new THREE.MeshStandardMaterial({ map: paintC, roughnessMap: pT('paint_r'), normalMap: pT('paint_n'), metalnessMap: pT('paint_m'), metalness: .75, roughness: .65, color: '#55524e', envMapIntensity: 1.4 });
const chrome = new THREE.MeshStandardMaterial({ color: '#f1f2f3', metalness: 1, roughness: .07, envMapIntensity: 2.6 });
const rubber = new THREE.MeshStandardMaterial({ color: '#121110', roughness: .55 });
const hz = mk(512, 64), hx = hz.getContext('2d'); hx.fillStyle = C.amber; hx.fillRect(0, 0, 512, 64); hx.fillStyle = '#121110';
for (let i = -3; i < 22; i++) { hx.beginPath(); hx.moveTo(i * 40, 64); hx.lineTo(i * 40 + 20, 64); hx.lineTo(i * 40 + 44, 0); hx.lineTo(i * 40 + 24, 0); hx.fill(); }
hx.globalAlpha = .3; for (let i = 0; i < 500; i++) { hx.fillStyle = Math.random() < .6 ? '#000' : '#cfc6b4'; hx.fillRect(Math.random() * 512, Math.random() * 64, 1 + Math.random() * 7, 1); } hx.globalAlpha = 1;
const hazT = new THREE.CanvasTexture(hz); hazT.colorSpace = THREE.SRGBColorSpace;
const hazM = new THREE.MeshStandardMaterial({ map: hazT, roughness: .75, metalness: .25, polygonOffset: true, polygonOffsetFactor: -2 });
const press = new THREE.Group(); S.add(press);
const RB = (w, h, d, r = .06) => new RoundedBoxGeometry(w, h, d, 3, r);
const add = (g, m, x, y, z, parent = press) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
const boltG = new THREE.CylinderGeometry(.038, .038, .04, 6); boltG.rotateX(Math.PI / 2);
const bolt = (x, y, z) => add(boltG, chrome, x, y, z);
// bed plinth + columns + crown
add(RB(5.8, .52, 1.7, .07), painted, 0, -.64, 0);
const hzBed = add(new THREE.PlaneGeometry(5.6, .16), hazM, 0, -.6, .852);
[-2.5, 2.5].forEach(x => { add(RB(.56, 3.6, .62, .08), painted, x, 1.4, 0);
  const d = add(new THREE.PlaneGeometry(3.0, .3), hazM, x, 1.25, .312); d.rotation.z = Math.PI / 2;
  for (let y = -.2; y < 3.1; y += .45) { bolt(x - .2, y, .33); bolt(x + .2, y, .33); } });
add(RB(5.9, .72, .95, .1), painted, 0, 3.5, 0);
add(new THREE.PlaneGeometry(5.5, .2), hazM, 0, 3.3, .477);
for (let x = -2.6; x <= 2.6; x += .52) { bolt(x, 3.72, .48); }
// main hydraulic cylinder on the crown
add(new THREE.CylinderGeometry(.46, .5, 1.9, 48), painted, 0, 4.75, 0);
[3.95, 5.6].forEach(y => add(new THREE.TorusGeometry(.5, .05, 12, 48), chrome, 0, y, 0).rotation.x = Math.PI / 2);
// guide sleeves
[-1.6, 1.6].forEach(x => add(new THREE.CylinderGeometry(.13, .13, 1.0, 24), painted, x, 4.2, 0));
// hoses
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
[1, -1].forEach(sx => { add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v3(.45 * sx, 5.2, .12), v3(1.2 * sx, 5.55, .4), v3(2.1 * sx, 4.7, .45), v3(2.55 * sx, 3.95, .36)]), 48, .05, 10), rubber, 0, 0, 0);
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v3(.5 * sx, 4.3, -.1), v3(1.5 * sx, 4.9, -.45), v3(2.6 * sx, 4.4, -.4), v3(2.85 * sx, 1.2, -.3), v3(2.9 * sx, -.38, -.2)]), 64, .04, 10), rubber, 0, 0, 0); });
// ram assembly (moves)
const RAM_REST = 1.9, RAM_HIT = .125;
const ram = new THREE.Group(); press.add(ram); ram.position.y = RAM_REST;
add(RB(4.5, .34, 1.35, .05), painted, 0, .33, 0, ram);
add(new THREE.PlaneGeometry(4.3, .12), hazM, 0, .33, .678, ram);
for (let x = -2; x <= 2; x += .5) { const b = add(boltG, chrome, x, .45, .69, ram); }
add(new THREE.CylinderGeometry(.17, .17, 3.0, 40), chrome, 0, 1.98, 0, ram);
[-1.6, 1.6].forEach(x => add(new THREE.CylinderGeometry(.06, .06, 3.0, 20), chrome, x, 1.98, 0, ram));
// pressure gauge on the right column
const gaugeG = new THREE.Group(); gaugeG.position.set(2.5, 2.25, .36); press.add(gaugeG);
const gc = mk(256, 256), gx = gc.getContext('2d'); gx.fillStyle = C.cream; gx.beginPath(); gx.arc(128, 128, 124, 0, 7); gx.fill();
gx.strokeStyle = C.red; gx.lineWidth = 16; gx.beginPath(); gx.arc(128, 128, 100, -.35, .6); gx.stroke();
gx.strokeStyle = C.graph; gx.lineWidth = 3; for (let i = 0; i <= 12; i++) { const a = -3.75 + i * .366; gx.beginPath(); gx.moveTo(128 + Math.cos(a) * 108, 128 + Math.sin(a) * 108); gx.lineTo(128 + Math.cos(a) * (i % 3 ? 96 : 86), 128 + Math.sin(a) * (i % 3 ? 96 : 86)); gx.stroke(); }
gx.fillStyle = C.graph; gx.font = '600 22px "IBM Plex Mono"'; gx.textAlign = 'center'; gx.fillText('BAR', 128, 190);
const gTex = new THREE.CanvasTexture(gc); gTex.colorSpace = THREE.SRGBColorSpace;
add(new THREE.CylinderGeometry(.26, .26, .08, 40), chrome, 0, 0, 0, gaugeG).rotation.x = Math.PI / 2;
add(new THREE.CircleGeometry(.23, 40), new THREE.MeshStandardMaterial({ map: gTex, roughness: .3 }), 0, 0, .045, gaugeG);
const needle = new THREE.Group(); needle.position.z = .055; gaugeG.add(needle); needle.rotation.z = 2.2;
add(new THREE.BoxGeometry(.012, .2, .01), new THREE.MeshBasicMaterial({ color: C.red }), 0, .09, 0, needle);
// red warning lamp
const lampMat = new THREE.MeshStandardMaterial({ color: '#5a0e06', emissive: '#ff2a10', emissiveIntensity: .15, roughness: .3 });
const lampM = add(new THREE.CylinderGeometry(.13, .15, .26, 24), lampMat, -2.3, 4.0, .1);
add(new THREE.CylinderGeometry(.18, .18, .06, 24), painted, -2.3, 3.88, .1);
const lampLight = new THREE.PointLight('#ff2a10', 0, 9, 1.5); lampLight.position.set(-2.3, 4.0, .5); press.add(lampLight);
let lampMode = 0, lampStrobe = 0; function lampBlink(on) { lampMode = on ? 1 : 0; }
// mould halves, shaped to the deck's concave + kicks
let upperMould = null, lowerMould = null;
function buildMoulds(bend, L, hw) {
  [upperMould, lowerMould].forEach(m => m && (m.parent.remove(m), m.geometry.dispose()));
  const mkM = (top) => { const g = new THREE.BoxGeometry(L + .4, .3, 2 * hw + .3, 90, 1, 14), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = Math.max(-hw, Math.min(hw, p.getZ(i))), xx = Math.max(-L / 2, Math.min(L / 2, x));
      if (top && y < 0) p.setY(i, -.15 + bend(xx, z)); if (!top && y > 0) p.setY(i, .15 + bend(xx, z)); }
    g.computeVertexNormals(); return g; };
  upperMould = add(mkM(true), steel, 0, 0, 0, ram);
  lowerMould = add(mkM(false), steel, 0, -.23, 0);
}
// out-feed conveyor (deck exits towards camera)
const bc = mk(64, 256), bx = bc.getContext('2d'); bx.fillStyle = '#1a1918'; bx.fillRect(0, 0, 64, 256); bx.fillStyle = '#2c2a28'; for (let y = 0; y < 256; y += 32) bx.fillRect(0, y, 64, 6);
const beltT = new THREE.CanvasTexture(bc); beltT.colorSpace = THREE.SRGBColorSpace; beltT.wrapS = beltT.wrapT = THREE.RepeatWrapping; beltT.repeat.set(6, 8);
add(new THREE.BoxGeometry(3.8, .1, 6.4), new THREE.MeshStandardMaterial({ map: beltT, roughness: .95, color: '#6a6560' }), 0, -.19, 4.5);
[-1.95, 1.95].forEach(x => add(RB(.12, .3, 6.6, .03), painted, x, -.2, 4.5));
let beltOn = false;
// print head gantry
const head = new THREE.Mesh(new THREE.BoxGeometry(.18, .22, 1.5), new THREE.MeshStandardMaterial({ color: C.graph, metalness: .5, roughness: .4 })); head.position.set(2.4, .35, 0); S.add(head);
// dust motes: only inside the key light cone
const dN = MOB ? 120 : 260, dG = new THREE.BufferGeometry(), dP = new Float32Array(dN * 3), dLife = new Float32Array(dN);
const _kp = new THREE.Vector3(), _kd = new THREE.Vector3();
function dustSpawn(i) { _kp.set(1.8, 2.9, 4.4); _kd.set(0, -.1, 0).sub(_kp); const len = _kd.length(); _kd.normalize(); const t = .25 + Math.random() * .6, r = Math.tan(.42) * len * t * Math.sqrt(Math.random()), a = Math.random() * 6.283;
  const u = new THREE.Vector3(1, 0, 0).cross(_kd).normalize(), w = _kd.clone().cross(u); const p = _kp.clone().addScaledVector(_kd, len * t).addScaledVector(u, Math.cos(a) * r).addScaledVector(w, Math.sin(a) * r);
  dP[i * 3] = p.x; dP[i * 3 + 1] = p.y; dP[i * 3 + 2] = p.z; dLife[i] = 3 + Math.random() * 5; }
for (let i = 0; i < dN; i++) dustSpawn(i);
dG.setAttribute('position', new THREE.BufferAttribute(dP, 3));
const dsC = document.createElement('canvas'); dsC.width = dsC.height = 32; { const g = dsC.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); }
const dust = new THREE.Points(dG, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(dsC), color: C.amber, size: .03, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending })); dust.frustumCulled = false; S.add(dust);
function stepDust(dt, t) { for (let i = 0; i < dN; i++) { dLife[i] -= dt * (burst ? 4 : 1); dP[i * 3 + 1] += Math.sin(t * .7 + i) * .0007 + (burst ? .01 : 0); dP[i * 3] += Math.cos(t * .5 + i * 1.3) * .0006; if (dLife[i] <= 0) dustSpawn(i); } dG.attributes.position.needsUpdate = true; }

/* ---- procedural deck: popsicle outline, concave, kicks, visible 7-ply edge ---- */
const deck = new THREE.Group(); S.add(deck);
const matTop = new THREE.MeshStandardMaterial({ map: gripTex, roughness: .95 });
const matBot = new THREE.MeshStandardMaterial({ map: artTex, roughness: .55 });
const matEdge = new THREE.MeshStandardMaterial({ map: plyTex, roughness: .8 });
let meshes = [];
function buildDeck(k = 1) {
  meshes.forEach(m => { deck.remove(m); m.geometry.dispose(); }); meshes = [];
  const L = 3.2, hw = state.mould.width / 8.25 * .41, Th = .055, hl = L / 2 - hw, NX = 140, NY = 22;
  const cv = state.mould.concave * .05 * k, kk = state.mould.kick * .32 * k, kl = .52; const cvF = state.mould.concave * .05, kkF = state.mould.kick * .32;
  const half = x => Math.abs(x) <= hl ? hw : Math.sqrt(Math.max(0, hw * hw - (Math.abs(x) - hl) ** 2)) * 1.0 + .0005;
  const bendF = (c, q) => (x, z) => { const e = Math.abs(x) - (L / 2 - kl); return c * (z / hw) ** 2 + (e > 0 ? q * (e / kl) ** 2 : 0); }; const bend = bendF(cv, kk);
  function surface(up) { const pos = [], uv = [], idx = [];
    for (let i = 0; i <= NX; i++) { const x = -L / 2 + L * i / NX, h = half(x);
      for (let j = 0; j <= NY; j++) { const z = -h + 2 * h * j / NY; pos.push(x, bend(x, z) + (up ? Th : 0), z); uv.push(i / NX, up ? .5 - z / (2 * hw) : z / (2 * hw) + .5); } }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) { const a = i * (NY + 1) + j, b = a + NY + 1; up ? idx.push(a, a + 1, b, b, a + 1, b + 1) : idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; }
  function edge() { const pos = [], uv = [], idx = []; let k = 0;
    [-1, 1].forEach(sd => { for (let i = 0; i <= NX; i++) { const x = -L / 2 + L * i / NX, z = sd * half(x), y = bend(x, z); pos.push(x, y, z, x, y + Th, z); uv.push(i / NX * 8, 0, i / NX * 8, 1); }
      for (let i = 0; i < NX; i++) { const a = k + i * 2; sd > 0 ? idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3) : idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); } k += (NX + 1) * 2; });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; }
  plyTex.wrapS = THREE.RepeatWrapping; const mk2 = state.mould.id + state.mould.width; if (buildDeck.m !== mk2) { buildDeck.m = mk2; buildMoulds(bendF(cvF, kkF), L, hw); }
  [[surface(true), matTop], [surface(false), matBot], [edge(), matEdge]].forEach(([g, m]) => { const me = new THREE.Mesh(g, m); me.castShadow = me.receiveShadow = true; deck.add(me); meshes.push(me); });
  // truck hole marks
  for (const sx of [-1, 1]) for (const dx of [0, .06]) for (const dz of [-.04, .04]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .002, 8), new THREE.MeshBasicMaterial({ color: '#111' })); h.position.set(sx * (1.05 + dx), Th + cv * 0 + .001, dz); deck.add(h); meshes.push(h); }
}
deck.position.y = -.08;

/* ================= STATIONS / UI ================= */
const STN = ['VENEER', 'MOULD', 'PRINT', 'BENCH', 'PRESS'];
const HINTS = [['DRAG A JAR ONTO A SHEET', 'KEEP IT NATURAL'], ['HOLD THE DECK TO PRESS IT', 'PRESS IT FOR ME'], ['DRAG A PRINT ONTO THE DECK, THEN DRAG IT', ''], ['TYPE YOUR NAME', 'NO NAME'], ['FILL THE ORDER, THEN PULL THE LEVER', '']];
const doneSt = new Set();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const camT = [
  [[1.7, .75, 2.6], [.35, -.05, 0]],
  [[1.9, .5, 2.7], [0, -.02, 0]],
  [[0, 4.1, 3.3], [0, -.1, 1.75]],
  [[0, 3.8, 3.6], [0, -.1, 1.75]],
  [[1.1, 1.8, 7.6], [.3, .9, 0]]];
const look = new THREE.Vector3(0, 0, 0);
function moveCam(i, dur = 1.6) { const [p, l] = camT[i]; const k = MOB ? (i === 2 || i === 3 ? 1.9 : 1.5) : 1;
  const tp = { x: p[0] * k, y: p[1] * (MOB ? 1.15 : 1), z: p[2] * k }, tl2 = { x: l[0] + (MOB && i === 4 ? .9 : 0), y: l[1], z: l[2] };
  if (RM || dur < .05) { cam.position.set(tp.x, tp.y, tp.z); look.set(tl2.x, tl2.y, tl2.z); return; }
  gsap.to(cam.position, { ...tp, duration: dur, ease: 'power3.inOut' }); gsap.to(look, { ...tl2, duration: dur, ease: 'power3.inOut' }); }
function viewOffset() { const w = innerWidth, h = innerHeight; if (w < 760) cam.setViewOffset(w, h, 0, h * .17, w, h); else cam.setViewOffset(w, h, 165, 0, w, h); }
// rail
const railEl = $('#rail'); railEl.innerHTML = STN.map((n, i) => `<button data-i="${i}" aria-label="Station ${i + 1}: ${n}"><b>0${i + 1}</b>${n}</button>`).join('');
railEl.querySelectorAll('button').forEach(b => b.onclick = () => { sfx.clack(); go(+b.dataset.i); });
function railUpdate() { railEl.querySelectorAll('button').forEach((b, i) => { b.classList.toggle('on', i === state.station); b.classList.toggle('done', doneSt.has(i)); b.setAttribute('aria-current', i === state.station ? 'step' : 'false'); }); }
// hints
function showHint(txt, btn, fn) { const h = $('#hint'); $('#hintTxt').textContent = txt; const hb = $('#hintBtn'); hb.textContent = btn || ''; hb.onclick = fn || null; h.hidden = false; if (!RM) gsap.fromTo(h, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: .18 }); }
function stationHint(i) { if (doneSt.has(i) && i !== 4) { $('#hint').hidden = true; return; } const [t, b] = HINTS[i]; showHint(t, b, () => hintFallback(i)); }
function hintFallback(i) { if (i === 0) complete(0); if (i === 1) bendTo1(); if (i === 3) complete(3); }
function complete(i) { if (!doneSt.has(i)) { doneSt.add(i); tone(1200, 1500, .12, .1); } railUpdate(); if (i === state.station && i !== 4) gsap.to('#hint', { opacity: 0, duration: .3, onComplete: () => { if (state.station === i) $('#hint').hidden = true; gsap.set('#hint', { opacity: 1 }); } }); }
// receipt
function stainName() { for (const [n, arr] of Object.entries(P.stainPresets)) if (arr.join() === state.plies.join()) return n; return 'Custom stripe'; }
function graphicName() { return state.art ? (state.artIdx >= 0 ? 'PROOF ' + String(state.artIdx + 1).padStart(2, '0') : 'Your upload') : '—'; }
function updateReceipt() { $('#rPrice').textContent = P.currency + P.price;
  $('#rSpec').innerHTML = [['Shape', state.mould.label], ['Plies', stainName()], ['Graphic', graphicName()], ['Text', state.text || '—'], ['Grip', state.grip.label]].map(([a, b]) => `<dt>${a}</dt><dd>${b.replace(/[<>&]/g, '')}</dd>`).join(''); }
function go(i) { i = clamp(i, 0, 4); if (pressed) return; const prev = state.station; state.station = i;
  $$('.st').forEach(s => s.classList.toggle('on', +s.dataset.s === i)); $('#stn').textContent = `0${i + 1} ${STN[i]}`;
  $$('.ov').forEach(o => o.classList.toggle('on', o.id === 'ov' + i));
  $('#wo').hidden = i !== 4; $('#pressIt').hidden = i === 4; $('#next').style.visibility = i === 4 ? 'hidden' : 'visible';
  railUpdate(); stationHint(i); updateReceipt(); moveCam(i); setHum(.04 + i * .035);
  if (i === 1 && !state.bent) setBend(0); if (i !== 1 && !state.bent && bendK < 1) setBend(1, true);
  const flip = (i === 2 || i === 3) ? Math.PI : 0; gsap.to(deck.rotation, { x: flip, y: 0, duration: RM ? 0 : 1.1, ease: 'back.inOut(1.4)' }); gsap.to(deck.position, { y: flip ? .02 : i === 1 && !state.bent ? .1 : -.08, z: flip ? 1.75 : 0, duration: .9, ease: 'power2.inOut' });
  if ((prev === 2 || prev === 3) !== !!flip) setTimeout(() => sfx.clack(), 500);
  gsap.to(ram.position, { y: i === 1 ? .62 : RAM_REST, duration: 1.4, ease: 'power2.inOut' });
  if (i === 1) setTimeout(() => sfx.hiss(1.2), 200);
  if (i === 4) { fired = false; leverP = leverTarget = 0; }
  if (i === 3 && !MOB) setTimeout(() => $('#txt').focus({ preventScroll: true }), 900); }
// undo
const hist = [];
function snap() { hist.push({ plies: [...state.plies], mould: state.mould, art: state.art, artIdx: state.artIdx, sc: state.sc, rot: state.rot, pos: state.pos, posY: state.posY, text: state.text, grip: state.grip }); if (hist.length > 40) hist.shift(); }
function syncButtons() { $$('#moulds button').forEach((b, i) => b.classList.toggle('on', P.moulds[i] === state.mould)); $$('#grips button').forEach((b, i) => b.classList.toggle('on', P.grips[i] === state.grip));
  $$('#thumbs button').forEach((b, k) => b.classList.toggle('on', k === state.artIdx)); $('#sc').value = state.sc; $('#rot').value = state.rot; $('#pos').value = state.pos; $('#txt').value = state.text; }
$('#undo').onclick = () => { const s = hist.pop(); if (!s) { tone(220, 160, .12, .12); return; } const mc = s.mould !== state.mould; Object.assign(state, s); if (mc) buildDeck(bendK);
  renderType(true); sheetsFromState(); drawPlies(); drawArt(); drawGrip(); syncButtons(); updateReceipt(); tintWorld(); sfx.clack(); };
$('#pressIt').onclick = () => { sfx.clack(); go(4); };
// ---- generic drag with spring lag ----
function dragify(el, o) { el.addEventListener('pointerdown', e => { if (e.button) return; e.preventDefault(); const sx0 = e.clientX, sy0 = e.clientY; let g = null, moved = false, gx = sx0, gy = sy0, tx = sx0, ty = sy0, raf;
  const step = () => { gx += (tx - gx) * .28; gy += (ty - gy) * .28; const rot = clamp((tx - gx) * .4, -35, 35) + (o.tilt ? o.tilt(tx, ty) : 0); g.style.transform = `translate(${gx - g.offsetWidth / 2}px,${gy - g.offsetHeight / 2}px) rotate(${rot}deg)`; raf = requestAnimationFrame(step); };
  const mv = ev => { tx = ev.clientX; ty = ev.clientY; if (!moved && Math.hypot(tx - sx0, ty - sy0) > 6) { moved = true; g = o.ghost(); g.classList.add('ghost'); document.body.append(g); sfx.clack(); step(); } if (moved && o.onHover) o.onHover(tx, ty); };
  const up = ev => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); cancelAnimationFrame(raf); if (g) g.remove(); if (moved) o.onDrop(ev.clientX, ev.clientY); else if (o.onTap) o.onTap(); if (o.onHover) o.onHover(-1e4, -1e4); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); }); }
const elAt = (x, y) => document.elementFromPoint(x, y);
// ---- station 1: veneer sheets + stain jars (drag to pour, tap fallback) ----
const sheetsEl = $('#sheets'), SH = [];
for (let i = P.plies - 1; i >= 0; i--) { const c = mk(600, 40); c.dataset.i = i; c.setAttribute('role', 'button'); c.setAttribute('aria-label', 'Veneer sheet ' + (i + 1)); sheetsEl.append(c); SH[i] = { c, col: state.plies[i], prev: state.plies[i], cx: 300, r: 999 }; }
function drawSheet(i) { const s = SH[i], x = s.c.getContext('2d'); x.globalCompositeOperation = 'source-over'; x.fillStyle = C.maple; x.fillRect(0, 0, 600, 40);
  if (woodImg.naturalWidth) x.drawImage(woodImg, 0, (i * 97) % 900, 1024, 70, 0, 0, 600, 40);
  x.globalCompositeOperation = 'multiply'; if (s.prev !== C.maple) { x.fillStyle = s.prev; x.fillRect(0, 0, 600, 40); }
  if (s.r < 999) { x.save(); x.beginPath(); for (let a = 0; a <= 72; a++) { const t = a / 72 * Math.PI * 2, rr = s.r * (1 + .22 * Math.sin(t * 5 + i) + .12 * Math.sin(t * 13 + s.r * .01)); const px = s.cx + Math.cos(t) * rr, py = 20 + Math.sin(t) * rr * .3; a ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.clip(); x.fillStyle = s.col; x.fillRect(0, 0, 600, 40); x.restore(); }
  x.globalCompositeOperation = 'source-over'; x.fillStyle = 'rgba(40,25,10,.4)'; x.fillRect(0, 38, 600, 2); }
function sheetsFromState() { SH.forEach((s, i) => { s.prev = s.col = state.plies[i]; s.r = 999; drawSheet(i); }); }
function pour(i, cx, col) { snap(); const s = SH[i]; s.prev = state.plies[i]; s.col = col; s.cx = cx; s.r = 0; state.plies[i] = col;
  gsap.to(s, { r: 720, duration: RM ? 0 : 1.2, ease: 'power2.out', onUpdate: () => drawSheet(i), onComplete: () => { s.prev = col; s.r = 999; drawSheet(i); } });
  sfx.glug(); drawPlies(); drawArt(); tintWorld(); updateReceipt(); complete(0); }
function sheetAt(x, y) { const R0 = sheetsEl.getBoundingClientRect(); if (x < R0.left - 20 || x > R0.right + 20 || y < R0.top - 20 || y > R0.bottom + 20) return null; let best = null, bd = 1e9;
  SH.forEach(s => { const r = s.c.getBoundingClientRect(), d = Math.abs(y - (r.top + r.height / 2)); if (d < bd) { bd = d; best = s.c; } }); return best; }
let selJar = null;
P.stainJars.forEach(col => { const j = document.createElement('button'); j.className = 'jar'; j.style.background = col; j.setAttribute('aria-label', 'Stain jar ' + col); $('#jars').append(j);
  dragify(j, { ghost: () => { const g = document.createElement('div'); g.className = 'jar'; g.style.background = col; return g; },
    tilt: (x, y) => sheetAt(x, y) ? 70 : 0,
    onHover: (x, y) => { const el = sheetAt(x, y); SH.forEach(s => s.c.classList.toggle('hot', s.c === el)); },
    onDrop: (x, y) => { const el = sheetAt(x, y); if (el) { const r = el.getBoundingClientRect(); pour(+el.dataset.i, (x - r.left) / r.width * 600, col); } else tone(200, 150, .08, .08); },
    onTap: () => { selJar = col; $$('.jar').forEach(k => k.classList.toggle('sel', k === j)); sfx.clack(); showHint('NOW TAP A SHEET', 'KEEP IT NATURAL', () => complete(0)); } }); });
sheetsEl.addEventListener('click', e => { const c = sheetAt(e.clientX, e.clientY); if (selJar && c) { const r = c.getBoundingClientRect(); pour(+c.dataset.i, clamp((e.clientX - r.left) / r.width, 0, 1) * 600, selJar); } });
Object.keys(P.stainPresets).forEach(n => { const b = document.createElement('button'); b.className = 'btn sm'; b.type = 'button'; b.textContent = n.toUpperCase(); b.onclick = () => { snap(); state.plies = [...P.stainPresets[n]]; sheetsFromState(); drawPlies(); drawArt(); tintWorld(); updateReceipt(); sfx.glug(); complete(0); }; $('#presets').append(b); });
P.stainJars.forEach(c => { const b = document.createElement('button'); b.type = 'button'; b.style.background = c; b.setAttribute('aria-label', 'Stain next ply ' + c); b.onclick = () => { pour(state.ply, 300, c); state.ply = (state.ply + 1) % P.plies; }; $('#jarBtns').append(b); });
function tintWorld() { const mid = new THREE.Color(state.plies[3]), a = new THREE.Color(C.amber); const tgt = a.clone().lerp(mid, .35);
  gsap.to(key.color, { r: tgt.r, g: tgt.g, b: tgt.b, duration: 1.2 }); const dc = a.clone().lerp(new THREE.Color(state.plies[1]), .6); gsap.to(dust.material.color, { r: dc.r, g: dc.g, b: dc.b, duration: 1.2 }); }
// ---- station 2: mould (hold to bend live, swipe or buttons to change mould) ----
let bendK = 1, bendHold = false; state.bent = false;
function setBend(k, quiet) { bendK = k; buildDeck(k); }
function bentDone() { if (state.bent) return; state.bent = true; gsap.to(deck.position, { y: -.08, duration: .5, ease: 'bounce.out' }); bendHold = false; setBend(1); tone(1600, 1600, .3, .12, 'triangle'); sfx.hiss(.5); complete(1); gsap.to(ram.position, { y: .62, duration: .7, ease: 'back.out(2)' }); gsap.to(needle.rotation, { z: 2.2, duration: .8 }); }
function bendTo1() { if (state.bent) return; const o = { v: bendK }; gsap.to(o, { v: 1, duration: RM ? 0 : .7, onUpdate: () => { setBend(o.v); ram.position.y = .62 - o.v * .4; }, onComplete: bentDone }); }
function setMould(m) { if (m === state.mould) return; snap(); state.mould = m; syncButtons(); sfx.hiss(.6); tone(90, 60, .5, .25); gsap.fromTo(ram.position, { y: .45 }, { y: .62, duration: .7, ease: 'elastic.out(1,.5)' }); buildDeck(state.bent ? 1 : bendK); updateReceipt();
  showHint(m.label.toUpperCase() + (state.bent ? '' : ' · NOW HOLD THE DECK'), state.bent ? '' : 'PRESS IT FOR ME', bendTo1); }
P.moulds.forEach(m => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm' + (m === state.mould ? ' on' : ''); b.textContent = m.label.toUpperCase(); b.onclick = () => setMould(m); $('#moulds').append(b); });
const gb = $('#gaugeBtn'); gb.addEventListener('pointerdown', () => { bendHold = true; tone(45, 90, 1.4, .3, 'sawtooth'); }); ['pointerup', 'pointerleave'].forEach(e => gb.addEventListener(e, () => bendHold = false));
// ---- station 3: print (drag a print onto the deck, then drag the art) ----
const rights = $('#rights'), file = $('#file');
rights.onchange = () => { file.disabled = !rights.checked; $('#uplBtn').setAttribute('aria-disabled', String(!rights.checked)); };
file.onchange = () => { const f = file.files[0]; if (!f || !rights.checked) return; const im = new Image(); im.onload = () => { snap(); state.art = im; state.artIdx = -1; syncButtons(); printSweep(true); updateReceipt(); complete(2); }; im.src = URL.createObjectURL(f); };
['sc', 'rot', 'pos'].forEach(k => { $('#' + k).addEventListener('pointerdown', snap); $('#' + k).oninput = e => { state[k] = +e.target.value; drawArt(); }; });
// ---- station 4: bench (type sorts + grip) ----
function renderType(all) { const st = $('#typeblocks'), cur = st.children.length, chars = [...state.text];
  if (all || chars.slice(0, cur).join('') !== [...st.children].map(c => c.dataset.c).join('')) { st.innerHTML = chars.map(c => `<span data-c="${c}" style="animation:none">${c === ' ' ? '&nbsp;' : c}</span>`).join(''); return; }
  while (st.children.length > chars.length) st.lastChild.remove();
  for (let k = st.children.length; k < chars.length; k++) { const sp = document.createElement('span'); sp.dataset.c = chars[k]; sp.innerHTML = chars[k] === ' ' ? '&nbsp;' : chars[k]; st.append(sp); setTimeout(() => sfx.clack(), 260); } }
let typeSnap = 0; $('#txt').oninput = e => { if (Date.now() - typeSnap > 1500) snap(); typeSnap = Date.now(); state.text = e.target.value.toUpperCase().replace(/[^A-Z0-9 .,!?'&-]/g, '').slice(0, 22); renderType(); drawArt(); updateReceipt(); if (state.text) complete(3); };
P.grips.forEach(g => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm' + (g === state.grip ? ' on' : ''); b.textContent = g.label.toUpperCase(); b.onclick = () => {
  snap(); state.grip = g; syncButtons(); sfx.peel(); drawGrip(); updateReceipt(); if (state.station === 3) { gsap.to(deck.rotation, { x: 0, duration: .7, ease: 'back.inOut(1.4)' }); gsap.to(deck.rotation, { x: Math.PI, duration: .7, delay: 1.8, ease: 'back.inOut(1.4)' }); } }; $('#grips').append(b); });
$('#ov3').append($('#grips'));
// nav
$('#next').onclick = () => { $('#next').classList.add('pull'); setTimeout(() => $('#next').classList.remove('pull'), 300); sfx.clack(); if (state.station === 0) complete(0); if (state.station === 1) bendTo1(); go(state.station + 1); };
let wl = 0; addEventListener('wheel', e => { if (inSketch || pressed || e.target.closest('.receipt,.ov')) return; const t = Date.now(); if (t - wl < 1100 || Math.abs(e.deltaY) < 25) return; wl = t; go(state.station + Math.sign(e.deltaY)); }, { passive: true });
addEventListener('keydown', e => { if (inSketch || pressed || e.target.tagName === 'INPUT') return; if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(state.station + 1); if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(state.station - 1); });
// ---- pointer on the 3D scene: hold-to-bend, drag art, pull lever, place stamp ----
const glEl = $('#gl'), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function rayAt(x, y, objs) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam); return ray.intersectObjects(objs, false)[0]; }
let ptr = null;
glEl.addEventListener('pointerdown', e => { if (inSketch) return; const st = state.station;
  if (stampMode) { placeStamp(e.clientX, e.clientY); return; }
  if (pressed) return;
  if (st === 4) { if (rayAt(e.clientX, e.clientY, [leverHit])) { if (!$('#wo').checkValidity()) { $('#wo').reportValidity(); showHint('FILL THE WORK ORDER FIRST', ''); gsap.fromTo('.receipt', { x: -8 }, { x: 0, duration: .4, ease: 'elastic.out(1,.3)' }); return; } glEl.setPointerCapture(e.pointerId); leverDrag = { y0: e.clientY }; leverStart(); } return; }
  if (st === 1) { glEl.setPointerCapture(e.pointerId); ptr = { mode: 'bend', x0: e.clientX }; if (!state.bent) { bendHold = true; tone(45, 90, 1.4, .25, 'sawtooth'); } return; }
  if (st === 2) { const h = rayAt(e.clientX, e.clientY, [meshes[1]]); if (h) { glEl.setPointerCapture(e.pointerId); snap(); ptr = { mode: 'art', u0: h.uv.x, v0: h.uv.y, p0: state.pos, q0: state.posY }; glEl.style.cursor = 'grabbing'; } } });
glEl.addEventListener('pointermove', e => { if (leverDrag) { leverTarget = clamp((e.clientY - leverDrag.y0) / (innerHeight * .3), 0, 1); return; }
  if (inSketch || stampMode) return;
  if (!ptr) { const st = state.station; glEl.style.cursor = st === 4 && rayAt(e.clientX, e.clientY, [leverHit]) ? 'grab' : st === 2 && rayAt(e.clientX, e.clientY, [meshes[1]]) ? 'grab' : st === 1 ? 'pointer' : ''; return; }
  if (ptr.mode === 'bend' && Math.abs(e.clientX - ptr.x0) > 90) { bendHold = false; const i = P.moulds.indexOf(state.mould); setMould(P.moulds[(i + (e.clientX < ptr.x0 ? 1 : P.moulds.length - 1)) % P.moulds.length]); ptr = null; return; }
  if (ptr.mode === 'art') { const h = rayAt(e.clientX, e.clientY, [meshes[1]]); if (h) { state.pos = clamp(ptr.p0 + (h.uv.x - ptr.u0), -.5, .5); state.posY = clamp(ptr.q0 - (h.uv.y - ptr.v0), -.45, .45); $('#pos').value = state.pos; drawArt(); } } });
addEventListener('pointerup', () => { if (leverDrag) { leverDrag = null; leverRelease(); } bendHold = false; if (ptr && ptr.mode === 'art') complete(2); ptr = null; glEl.style.cursor = ''; });

/* ================= THE PRESS (mock checkout): lever + hold fallback ================= */
function nextOrderId() { const n = (+localStorage.proofOrderSeq || 0) + 1; localStorage.proofOrderSeq = n; return String(n).padStart(4, '0'); }
let holdStart = 0, holdT = 0, holding = false, pressed = false; const pb = $('#press');
pb.addEventListener('pointerdown', () => { const f = $('#wo'); if (!f.reportValidity()) return; holding = true; holdStart = performance.now(); tone(40, 120, 1.2, .25, 'sawtooth'); });
['pointerup', 'pointerleave'].forEach(e => pb.addEventListener(e, () => { holding = false; }));
pb.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && $('#wo').reportValidity()) { e.preventDefault(); slam(); } });
// lever: pedestal + chrome arm + red knob, pulled down against a spring
const leverG = new THREE.Group(); leverG.position.set(2.25, -.2, 1.15); S.add(leverG);
const ped = new THREE.Mesh(RB(.34, .9, .34, .05), painted); ped.position.y = -.25; ped.castShadow = true; leverG.add(ped);
const pivot = new THREE.Group(); pivot.position.y = .24; leverG.add(pivot);
const hub = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .42, 24), chrome); hub.rotation.z = Math.PI / 2; pivot.add(hub);
const arm = new THREE.Mesh(new THREE.CylinderGeometry(.03, .035, 1.0, 16), chrome); arm.position.y = .5; arm.castShadow = true; pivot.add(arm);
const knobM = new THREE.MeshStandardMaterial({ color: C.red, roughness: .3, emissive: '#3a0800', emissiveIntensity: .4 });
const knob = new THREE.Mesh(new THREE.SphereGeometry(.12, 24, 16), knobM); knob.position.y = 1.02; knob.castShadow = true; pivot.add(knob);
const leverHit = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.6, .7), new THREE.MeshBasicMaterial({ visible: false })); leverHit.position.y = .55; pivot.add(leverHit);
let leverP = 0, leverTarget = 0, leverDrag = null, fired = false, whine = null, steamT = 0;
function leverStart() { audioOn(); sfx.clack(); if (AC && !whine) { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sawtooth'; o.frequency.value = 50; g.gain.value = 0; o.connect(g).connect(OUT); o.start(); whine = { o, g }; } }
function leverRelease() { if (fired) return; if (leverP > .08) { play('mechanical_clunk', .5); tone(140, 70, .15, .3); } leverTarget = 0; stopWhine(); }
function stopWhine() { if (whine) { const t = AC.currentTime; whine.g.gain.setTargetAtTime(0, t, .05); const w = whine; setTimeout(() => { try { w.o.stop(); } catch (e) {} }, 300); whine = null; } }
// steam puffs
const stN = 60, stG = new THREE.BufferGeometry(), stP = new Float32Array(stN * 3).fill(-50), stL = new Float32Array(stN); stG.setAttribute('position', new THREE.BufferAttribute(stP, 3));
const softC = mk(64, 64), sfc = softC.getContext('2d'), rg = sfc.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); sfc.fillStyle = rg; sfc.fillRect(0, 0, 64, 64);
const softT = new THREE.CanvasTexture(softC);
const steam = new THREE.Points(stG, new THREE.PointsMaterial({ map: softT, color: '#d8d4cc', size: .45, transparent: true, opacity: .35, depthWrite: false })); steam.frustumCulled = false; S.add(steam);
function puff() { for (let i = 0; i < stN; i++) if (stL[i] <= 0) { stL[i] = 1.2; stP[i * 3] = -1.6 + Math.random() * .3; stP[i * 3 + 1] = 2.6; stP[i * 3 + 2] = .5; if (Math.random() < .5) return; } }
function stepLever(dt) { if (state.station !== 4 || pressed) { if (leverP > 0.001) { leverP *= .8; pivot.rotation.x = -.25 + leverP * 1.5; } return; }
  leverP += (leverTarget - leverP) * (1 - Math.pow(1 - (.2 - .14 * Math.min(leverP, leverTarget + .3)), dt * 60)); if (leverTarget >= .99 && leverP > .88) leverP = Math.max(leverP, .9); pivot.rotation.x = -.25 + leverP * 1.5;
  needle.rotation.z = 2.2 - leverP * 3.3; ram.position.y = RAM_REST - leverP * .35;
  if (whine) { const t = AC.currentTime; whine.o.frequency.setTargetAtTime(50 + leverP * 260, t, .05); whine.g.gain.setTargetAtTime(.02 + leverP * .07, t, .05); }
  if (leverP > .35) { steamT -= dt; if (steamT <= 0) { puff(); steamT = .25 - leverP * .18; if (Math.random() < .3) noise(.3, 5000, .7, .04 + leverP * .05, 'highpass', .5); } }
  if (leverP >= .9 && !fired) { fired = true; leverDrag = null; stopWhine(); slam(); }
  for (let i = 0; i < stN; i++) { if (stL[i] <= 0) continue; stL[i] -= dt; stP[i * 3 + 1] += dt * .9; stP[i * 3] += dt * .25; if (stL[i] <= 0) stP[i * 3 + 1] = -50; } stG.attributes.position.needsUpdate = true; }
// steam must update also after the lever fires
function stepSteam(dt) { for (let i = 0; i < stN; i++) { if (stL[i] <= 0) continue; stL[i] -= dt; stP[i * 3 + 1] += dt * .9; if (stL[i] <= 0) stP[i * 3 + 1] = -50; } stG.attributes.position.needsUpdate = true; }

let replay = false, lastId = null, lastNm = '', autoStamp = false, stampMode = false, slamTL = null;
function slam() { if (pressed) return; pressed = true; $('#proc').hidden = false; setTimeout(() => document.body.classList.add('slam'), 300); $('#hint').hidden = true;
  const id = replay && lastId ? lastId : nextOrderId(), nm = replay && lastId ? lastNm : (($('#wo').nm.value || 'you').trim().slice(0, 24)); lastId = id; lastNm = nm; const isReplay = replay; replay = false;
  autoStamp = isReplay || recording || RM || window.__autoStamp;
  serialOnDeck = null; drawGrip(); deck.visible = true; deck.position.set(0, -.08, 0); deck.scale.set(1, 1, 1); cam.clearViewOffset(); cam.updateProjectionMatrix();
  gsap.to(deck.rotation, { x: 0, y: 0, duration: .8, ease: 'power2.out' });
  const tl = slamTL = gsap.timeline();
  if (RM) { tl.set(ram.position, { y: RAM_HIT }).call(() => { cam.position.set(1.5, .12, 1.75); look.set(0, -.05, 0); sfx.slam(); impact(); })
      .to({}, { duration: .8 }).call(() => stampIt(id, nm, .78, .5)).to({}, { duration: 2 }).call(() => { ram.position.y = RAM_REST; if (recording) stopRec(); outro(id, nm); }); return; }
  tl.to(cam.position, { x: 4.4, y: .02, z: 4.8, duration: 1.1, ease: 'power3.inOut' }, 0).to(look, { x: 0, y: 1.4, z: 0, duration: 1.1, ease: 'power3.inOut' }, 0)
    .call(() => { sfx.hiss(1.6); lampBlink(true); setHum(.22); }, null, .5)
    .to(ram.position, { y: .95, duration: 1.2, ease: 'sine.inOut' }, .5)
    .to(needle.rotation, { z: -1.1, duration: 1.2, ease: 'power2.in' }, .5)
    .to(cam.position, { x: 2.8, y: .14, z: 3.2, duration: 1.2, ease: 'none' }, 1.1).to(look, { y: .7, duration: 1.2, ease: 'none' }, 1.1)
    .to(ram.position, { y: RAM_HIT, duration: .1, ease: 'power4.in' })
    .call(() => { cam.position.set(1.6, .5, 2.15); look.set(0, -.02, 0); sfx.slam(); impact(); gsap.fromTo(deck.scale, { y: .55, x: 1.015, z: 1.03 }, { y: 1, x: 1, z: 1, duration: .5, ease: 'elastic.out(1,.35)' }); })
    .to(ram.position, { y: RAM_HIT + .012, duration: .2, ease: 'power1.out' })
    .to({}, { duration: .5 })
    .call(() => { lampBlink(false); })
    .to(ram.position, { y: RAM_REST, duration: 1.0, ease: 'power2.inOut' })
    .to(needle.rotation, { z: 2.2, duration: 1.0 }, '<')
    
    .to(cam.position, { x: 0, y: MOB ? 3.9 : 2.7, z: MOB ? 1.6 : 1.1, duration: 1.0, ease: 'power2.inOut' }, '<').to(look, { x: 0, y: 0, z: 0, duration: 1.0, ease: 'power2.inOut' }, '<')
    .call(() => { if (serialOnDeck) return; if (autoStamp) stampIt(id, nm, .78, .5); else { tl.pause(); enterStampMode(id, nm); } })
    .to({}, { duration: 1.6 })
    .call(() => { $('#title').hidden = true; })
    .to(cam.position, { x: 3.2, y: 1.3, z: 7.6, duration: 1.4, ease: 'power2.inOut' }).to(look, { x: 0, y: -.1, z: 3.2, duration: 1.4, ease: 'power2.inOut' }, '<')
    .call(() => { beltOn = true; sfx.clack(); })
    .to(deck.position, { z: 6.6, duration: 2.4, ease: 'power1.in' })
    .to(look, { z: 5.2, duration: 2.4, ease: 'power1.in' }, '<')
    .call(() => { beltOn = false; if (recording) stopRec(); outro(id, nm); }, null, '+=.1'); }
// brass stamp: follows the pointer, tap the deck to place it
const brass = $('#brass'); let stampArgs = null, bx0 = innerWidth / 2, by0 = innerHeight / 2, bxT = bx0, byT = by0;
function enterStampMode(id, nm) { stampMode = true; stampArgs = [id, nm]; $('#brassFace').src = stampCanvas(id, nm).toDataURL(); brass.hidden = false; document.body.classList.add('stamping');
  showHint('TAP THE DECK TO STAMP YOUR NUMBER', 'STAMP IT FOR ME', () => placeStamp(null)); }
addEventListener('pointermove', e => { bxT = e.clientX; byT = e.clientY; });
function stepBrass() { if (!stampMode) return; bx0 += (bxT - bx0) * .25; by0 += (byT - by0) * .25; brass.style.transform = `translate(${bx0}px,${by0}px) rotate(${(bxT - bx0) * .15}deg)`; }
function placeStamp(x, y) { if (!stampMode) return; let u = .78, v = .5;
  if (x != null) { const h = rayAt(x, y, [meshes[0]]); if (!h) { gsap.fromTo(brass, { opacity: .4 }, { opacity: 1, duration: .3 }); return; } u = clamp(h.uv.x, .18, .82); v = clamp(h.uv.y, .25, .75); }
  stampMode = false; $('#hint').hidden = true; document.body.classList.remove('stamping');
  const done = () => { brass.hidden = true; stampIt(stampArgs[0], stampArgs[1], u, v); slamTL && slamTL.play(); };
  if (RM) return done(); gsap.timeline().to(brass, { scale: .82, duration: .09, ease: 'power3.in' }).call(done).to(brass, { scale: 1, duration: .2 }); }
function stampIt(id, nm, u, v) { serialOnDeck = [id, nm, u, v]; drawGrip(); sfx.stamp(); shake.set(.02, .02, 0);
  const t = $('#title'); t.innerHTML = `<small>PROOF No.</small><b>${id}</b><em>made for ${nm.replace(/[<>&"]/g, '')}</em>`; t.hidden = false;
  if (!RM) gsap.fromTo(t, { scale: 1.6, opacity: 0 }, { scale: 1, opacity: 1, duration: .25, ease: 'power4.out' });
  $('#proc').textContent = 'Order placed (demo). Nothing was charged.'; fulfil(id, nm); }
function impact() { pressFx = 3; spawnSparks();
  if (AC) { const t = AC.currentTime; OUT.gain.cancelScheduledValues(t); OUT.gain.setValueAtTime(1, t); OUT.gain.setValueAtTime(1, t + .42); OUT.gain.linearRampToValueAtTime(0, t + .45); OUT.gain.setValueAtTime(0, t + .75); OUT.gain.linearRampToValueAtTime(1, t + .78); humG.gain.setValueAtTime(0, t + .45); humG.gain.setTargetAtTime(.1, t + .8, .5); }
  lampStrobe = 1.8;
  if (RM) return; const f = $('#flash'); gsap.fromTo(f, { opacity: .5 }, { opacity: 0, duration: .45 });
  bloom.strength = 2.4; gsap.to(bloom, { strength: .35, duration: 1.4, ease: 'power2.out' }); chroma.uniforms.amt.value = .035; gsap.to(chroma.uniforms.amt, { value: 0, duration: .9, ease: 'power3.out' });
  const o = { k: 1 }; gsap.to(o, { k: 0, duration: .7, ease: 'power2.out', onUpdate: () => { shake.set((Math.random() - .5) * .09 * o.k, (Math.random() - .5) * .09 * o.k, 0); } });
  gsap.timeline().to(key, { intensity: 6, duration: .05 }).to(key, { intensity: 80, duration: .06 }).to(key, { intensity: 12, duration: .08 }).to(key, { intensity: 90, duration: .4 });
  burst = 1; }
let burst = 0, proofURL = '';
function outro(id, nm) { document.body.classList.remove('slam'); $('#title').hidden = true; deck.rotation.set(0, 0, 0); deck.position.set(0, -.08, 0); deck.visible = true; cam.clearViewOffset(); cam.position.set(0, 2.6, 2.4); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix(); R.render(S, cam); const snap = R.domElement.toDataURL('image/jpeg', .9);
  viewOffset(); proofURL = proofCard(id, nm, snap); finalSnap = new Image(); finalSnap.src = snap;
  $('#doneSerial').textContent = `PROOF No. ${id} · That's your order number, and it's on your deck.`;
  showSketch(true); }
/* ================= FULFILMENT: print-ready PNG + order JSON ================= */
const FC = P.fulfilment || { active: 'mock', printDpi: 150, providers: { mock: {} }, shapeMap: {} };
function printSpec() { const w = state.mould.width, inW = w >= 8.5 ? 9.5 : 9, inH = w >= 8.5 ? 34 : 33, d = FC.printDpi || 150; return { inW, inH, dpi: d, pxW: Math.round(inW * d), pxH: Math.round(inH * d) }; }
function renderPrint() { const s = printSpec(), land = mk(s.pxH, s.pxW); paintArt(land.getContext('2d'), s.pxH, s.pxW, 1, false);
  const out = mk(s.pxW, s.pxH), x = out.getContext('2d'); x.translate(s.pxW, 0); x.rotate(Math.PI / 2); x.drawImage(land, 0, 0); return { canvas: out, spec: s }; } // portrait, nose at top
let lastOrder = null, lastPrint = null, lastJsonURL = '';
function buildOrderData(id, nm, spec) { const f = $('#wo'), g = k => (f[k] && f[k].value || '').trim();
  return { order_no: 'PRF-' + id, serial: id, created_at: new Date().toISOString(), mode: 'DEMO (no payment taken)', price: { amount: P.price, currency: P.currencyCode || 'USD' },
    product: { name: 'PROOF custom deck', maker: P.maker, shape_id: state.mould.id, shape: state.mould.label, width_in: state.mould.width, plies: P.plies, boardpusher_product_hint: (FC.shapeMap || {})[state.mould.id] || null,
      stain_layers: [...state.plies], stain_name: stainName(), grip: state.grip.label, stamp: 'PROOF No. ' + id + ' / made for ' + nm },
    artwork: { file: `proof-${id}-print.png`, width_px: spec.pxW, height_px: spec.pxH, dpi: spec.dpi, bleed_in: [spec.inW, spec.inH], orientation: 'portrait, nose at top', graphic: graphicName(), text: state.text, transform: { scale: state.sc, rotate_deg: state.rot, offset_x: state.pos, offset_y: state.posY } },
    customer: { name: g('nm'), email: g('em') }, shipping: { address: g('ad'), city: g('ci'), postcode: g('pc'), country: g('co') },
    checks: ['Options shown in preview; final availability confirmed at order', 'Stain layers are a preview effect; confirm with maker', 'Grip options confirm with maker'], fulfilment_provider: FC.active }; }
async function fulfil(id, nm) { try { const { canvas, spec } = renderPrint(); const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  if (lastPrint) URL.revokeObjectURL(lastPrint); lastPrint = URL.createObjectURL(blob);
  const order = buildOrderData(id, nm, spec); const files = { printBlob: blob, printName: order.artwork.file, jsonName: `proof-${id}-order.json` };
  const mod = await import('./fulfilment.js'); const res = await mod.submitOrder(order, files, FC); order.fulfilment_result = res; order.artwork.sha256 = files.printSha; lastOrder = order;
  if (lastJsonURL) URL.revokeObjectURL(lastJsonURL); lastJsonURL = URL.createObjectURL(new Blob([JSON.stringify(order, null, 2)], { type: 'application/json' }));
  $('#fulStatus').textContent = `Fulfilment: ${res.provider.toUpperCase()} · ${res.message || (res.ok ? 'ok' : 'not sent')} · print file ${spec.pxW}×${spec.pxH}px @${spec.dpi}dpi`;
  window.__order = order; } catch (e) { console.warn('fulfil failed', e); $('#fulStatus').textContent = 'Fulfilment: could not build files (' + e.message + ')'; } }
function dlURL(u, n) { if (!u) return; const a = document.createElement('a'); a.href = u; a.download = n; document.body.append(a); a.click(); a.remove(); }
$('#dlPrint').onclick = () => dlURL(lastPrint, lastOrder ? lastOrder.artwork.file : 'proof-print.png');
$('#dlJson').onclick = () => dlURL(lastJsonURL, lastOrder ? `proof-${lastOrder.serial}-order.json` : 'proof-order.json');
/* ================= PAPER TEAR into the machine ================= */
function tearPaper(cx, cy, done) { const W2 = innerWidth, H2 = innerHeight, box = $('#tear'); const url = sk.toDataURL('image/jpeg', .85); box.innerHTML = ''; box.hidden = false;
  const N = 7, R2 = Math.hypot(W2, H2) * 1.2, a0 = Math.random() * 6, pts = [];
  for (let k = 0; k <= N; k++) { const a = a0 + k / N * Math.PI * 2, ray = []; for (let s = 0; s <= 10; s++) { const r = s / 10 * R2, jj = s ? (Math.random() - .5) * 26 : 0; ray.push([cx + Math.cos(a) * r - Math.sin(a) * jj, cy + Math.sin(a) * r + Math.cos(a) * jj]); } pts.push(ray); }
  for (let k = 0; k < N; k++) { const f = document.createElement('div'); f.className = 'flap'; f.style.backgroundImage = `url(${url})`;
    const poly = [...pts[k], ...[...pts[k + 1]].reverse()].map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(','); f.style.clipPath = `polygon(${poly})`;
    const am = a0 + (k + .5) / N * Math.PI * 2, ax = -Math.sin(am), ay = Math.cos(am); f.style.transformOrigin = `${cx + Math.cos(am) * 60}px ${cy + Math.sin(am) * 60}px`; box.append(f);
    gsap.to(f, { duration: 1.0, ease: 'power2.in', transform: `rotate3d(${ax.toFixed(3)},${ay.toFixed(3)},0,${(100 + Math.random() * 40) * (Math.random() < .5 ? 1 : 1)}deg) translate3d(${Math.cos(am) * 120}px,${Math.sin(am) * 120}px,0)`, opacity: 0, delay: Math.random() * .08 }); }
  noise(.5, 2600, .5, .35, 'bandpass', .25); setTimeout(() => noise(.3, 1800, .6, .25, 'bandpass', .3), 120); play('whoosh', .6);
  gsap.fromTo(box, { scale: 1 }, { scale: 1.8, duration: 1.1, ease: 'power2.in', onComplete: () => { box.hidden = true; box.innerHTML = ''; gsap.set(box, { scale: 1 }); tone(60, 35, .4, .5); } });
  done(); }
let finalSnap = null;
function proofCard(id, nm, snap) { const c = mk(1080, 1350), x = c.getContext('2d'); x.fillStyle = C.cream; x.fillRect(0, 0, 1080, 1350);
  const im = new Image(); im.src = snap; if (wmImg.naturalWidth) x.drawImage(wmImg, 60, 70, 480, 125); else { x.fillStyle = C.graph; x.font = '120px "Archivo Black"'; x.fillText('PROOF', 60, 170); }
  x.font = '600 30px "IBM Plex Mono"'; [['NO.', id], ['MADE FOR', nm.toUpperCase()], ['SHAPE', state.mould.label], ['GRIP', state.grip.label], ['TEXT', state.text || '—'], ['STATUS', 'DEMO ORDER · NOTHING CHARGED']].forEach(([a, b], i) => { x.fillStyle = C.steel; x.fillText(a, 60, 1000 + i * 52); x.fillStyle = C.graph; x.fillText(b, 300, 1000 + i * 52); });
  state.plies.forEach((p, i) => { x.fillStyle = p; x.fillRect(760, 1000 + i * 26, 260, 22); });
  x.save(); x.translate(800, 135); x.rotate(-.08); x.drawImage(stampCanvas(id, nm), -225, -80, 450, 160); x.restore();
  return new Promise(r => { im.onload = () => { x.drawImage(im, 60, 240, 960, 960 * im.height / im.width > 700 ? 700 : 960 * im.height / im.width); r(c.toDataURL('image/png')); }; }); }
$('#dl').onclick = async () => { const a = document.createElement('a'); a.href = await proofURL; a.download = 'proof.png'; a.click(); };
$('#again').onclick = () => { replay = true; pressed = false; holdT = 0; fired = false; $('#proc').hidden = true; $('#proc').textContent = 'Applying a frankly rude amount of pressure…'; enterMachine(4); setTimeout(slam, 900); };
$('#another').onclick = () => location.reload();

/* ================= SKETCHBOOK (arrival + ending) ================= */
const sk = $('#sk'), sx = sk.getContext('2d'); let inSketch = true, frame = 0, mxs = 0, mys = 0;
addEventListener('pointermove', e => { mxs = e.clientX / innerWidth - .5; mys = e.clientY / innerHeight - .5; });
addEventListener('deviceorientation', e => { if (e.gamma != null) { mxs = e.gamma / 90; mys = e.beta / 180 - .25; } });
function sizeSk() { const d = Math.min(devicePixelRatio, 2); sk.width = innerWidth * d; sk.height = innerHeight * d; sx.setTransform(d, 0, 0, d, 0, 0); }
const j = (a = 1.6) => (Math.random() - .5) * a;
function pencil(pts, w = 1.4, a = .85, close) { sx.strokeStyle = `rgba(43,43,43,${a})`; sx.lineWidth = w; sx.lineCap = 'round'; sx.beginPath(); pts.forEach(([x, y], i) => i ? sx.lineTo(x + j(), y + j()) : sx.moveTo(x + j(), y + j())); if (close) sx.closePath(); sx.stroke(); }
function drawSketch() { const w = innerWidth, h = innerHeight, m = w < 760;
  sx.fillStyle = C.cream; sx.fillRect(0, 0, w, h); if (paperImg.naturalWidth) { sx.globalAlpha = .18; sx.globalCompositeOperation = 'multiply'; const s = 512; for (let x = 0; x < w; x += s) for (let y = 0; y < h; y += s) sx.drawImage(paperImg, x, y, s, s); sx.globalAlpha = 1; sx.globalCompositeOperation = 'source-over'; }
  // ruled margin
  sx.strokeStyle = 'rgba(217,68,43,.35)'; sx.lineWidth = 1; sx.beginPath(); sx.moveTo(m ? 18 : 60, 0); sx.lineTo(m ? 18 : 60, h); sx.stroke();
  const cx = w / 2, cy = h * (m ? .62 : .6), L = Math.min(w * (m ? .92 : .66), 880), hw = L * .13, lean = mxs * 10, ang = -.14 + mys * .03;
  sx.save(); sx.translate(cx, cy); sx.rotate(ang);
  if (finalSnap && finalSnap.naturalWidth) { const sw = L * 1.15, sh = sw * finalSnap.height / finalSnap.width; sx.globalAlpha = .96; sx.drawImage(finalSnap, -sw / 2, -sh / 2, sw, sh); sx.globalAlpha = 1; sx.restore(); notes(w, h, m, true); return; }
  // construction lines
  sx.setLineDash([6, 8]); pencil([[-L * .62, 0], [L * .62, 0]], .7, .4); pencil([[-L / 2 + hw, -hw * 1.6], [-L / 2 + hw, hw * 1.6]], .7, .35); pencil([[L / 2 - hw, -hw * 1.6], [L / 2 - hw, hw * 1.6]], .7, .35); sx.setLineDash([]);
  for (let pass = 0; pass < 2; pass++) { const pts = []; const hl = L / 2 - hw;
    for (let t = 0; t <= 40; t++) pts.push([-hl + 2 * hl * t / 40 + lean * .2, -hw]);
    for (let t = 0; t <= 24; t++) { const a = -Math.PI / 2 + Math.PI * t / 24; pts.push([hl + Math.cos(a) * hw + lean, Math.sin(a) * hw]); }
    for (let t = 0; t <= 40; t++) pts.push([hl - 2 * hl * t / 40 + lean * .2, hw]);
    for (let t = 0; t <= 24; t++) { const a = Math.PI / 2 + Math.PI * t / 24; pts.push([-hl + Math.cos(a) * hw - lean * .4, Math.sin(a) * hw]); }
    pencil(pts, pass ? 1 : 2, pass ? .5 : .9, true); }
  // truck holes + hatching
  for (const s of [-1, 1]) for (const dx of [0, 14]) for (const dy of [-10, 10]) { sx.beginPath(); sx.arc(s * (L * .32 + dx), dy + j(.6), 2.2, 0, 7); sx.fillStyle = C.graph; sx.fill(); }
  for (let k = 0; k < 16; k++) pencil([[-L * .2 + k * 12, hw * .9], [-L * .2 + k * 12 + 30, hw * .2]], .8, .3);
  // dimension callout
  pencil([[L * .25, -hw - 18], [L * .25, hw + 18]], .8, .6); pencil([[L * .25 - 6, -hw - 12], [L * .25, -hw - 18], [L * .25 + 6, -hw - 12]], .8, .6);
  sx.restore(); notes(w, h, m, false); }
function notes(w, h, m, done) { sx.fillStyle = 'rgba(43,43,43,.85)'; sx.font = `${m ? 20 : 28}px Caveat`;
  if (!done) { sx.fillText('8.25 IN', w * (m ? .62 : .66), h * (m ? .5 : .43));
    sx.fillText('concave — not too deep?', w * (m ? .08 : .1), h * (m ? .78 : .8)); sx.fillText('7 ply. maple. obviously.', w * (m ? .5 : .7), h * (m ? .84 : .82));
    sx.save(); sx.fillStyle = C.red; sx.font = `${m ? 26 : 34}px Caveat`; const ax = w * (m ? .55 : .72), ay = h * (m ? .4 : .32); sx.fillText('tap the deck', ax, ay - 8 + Math.sin(frame / 8) * 3);
    sx.strokeStyle = C.red; sx.lineWidth = 2; sx.beginPath(); sx.moveTo(ax + 30, ay + 4); sx.quadraticCurveTo(ax + 10, ay + 50, ax - 30, ay + 70); sx.lineTo(ax - 22, ay + 54); sx.moveTo(ax - 30, ay + 70); sx.lineTo(ax - 12, ay + 70); sx.stroke(); sx.restore(); }
  else { sx.fillText('it survived.', w * .62, h * .3); }
  if (wmImg.naturalWidth) { const ww = m ? 110 : 190; sx.save(); sx.translate(w - ww - (m ? 16 : 40) + j(), h - (m ? 50 : 80) + j()); sx.rotate(-.05); sx.globalAlpha = .38; sx.globalCompositeOperation = 'multiply'; sx.drawImage(wmImg, 0, 0, ww, ww * .26); sx.restore(); } }
function showSketch(done) { inSketch = true; document.body.classList.add('sk'); const s = $('#sketch'); s.style.display = ''; $('#done').hidden = !done; $('.sk-copy').style.display = done ? 'none' : '';
  $('#enter').style.display = done ? 'none' : ''; $('#skipIntro').style.display = done ? 'none' : ''; gsap.fromTo(s, { opacity: 0, scale: .6 }, { opacity: 1, scale: 1, duration: RM ? 0 : 1.2, ease: 'power3.out' }); if (done) setTimeout(sfx.scratch, 300); }
function enterMachine(st = 0, ev) { audioOn(); sfx.knock(); const s = $('#sketch'); inSketch = false; document.body.classList.remove('sk');
  if (RM || !ev) { gsap.to(s, { opacity: 0, duration: RM ? .01 : .5, onComplete: () => { s.style.display = 'none'; gsap.set(s, { opacity: 1 }); } }); }
  else { $('#tear').classList.add('on'); tearPaper(ev.clientX, ev.clientY, () => {}); s.style.display = 'none'; setTimeout(() => $('#tear').classList.remove('on'), 1200); }
  viewOffset(); cam.position.set(0, 9, .4); look.set(0, 0, 0); go(st); if (!RM && ev) gsap.from(cam.position, { y: 14, duration: 1.4, ease: 'power3.in' }); setTimeout(() => sfx.scratch(), 50); }
$('#enter').onclick = e => enterMachine(0, e);
$('#skipIntro').onclick = e => { doneSt.add(0); doneSt.add(1); doneSt.add(2); state.bent = true; enterMachine(4, e); };

/* ================= LOOP ================= */
function size() { if (typeof viewOffset === 'function' && !inSketch) viewOffset(); R.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight); composer.setPixelRatio(MOB ? 1 : Math.min(devicePixelRatio, 1.5)); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); sizeSk(); if (!inSketch) moveCam(state.station, .01); }
const clk = new THREE.Clock();
function loop() { frame++; const dt = Math.min(clk.getDelta(), .05), t = clk.elapsedTime;
  if (inSketch) { if (frame % 3 === 0 || RM && frame === 1) drawSketch(); }
  else {
    if (bendHold && !state.bent && state.station === 1) { bendK = Math.min(1, bendK + dt / 1.5); $('#gauge').style.width = bendK * 100 + '%'; }
    else if (!state.bent && state.station === 1 && bendK > 0 && !bendHold) bendK = Math.max(0, bendK - dt * 1.6);
    if (state.station === 1 && !state.bent && !pressed) { ram.position.y = .62 - bendK * .4; needle.rotation.z = 2.2 - bendK * 3.3; if (frame % 2 === 0 && Math.abs(bendK - (buildDeck.k || 0)) > .003) { buildDeck(bendK); buildDeck.k = bendK; } if (bendK >= 1) bentDone(); }
    if (holding && !pressed) { holdT = (performance.now() - holdStart) / 1000; $('#hold').style.width = Math.min(100, holdT / 1.2 * 100) + '%'; if (holdT >= 1.2) { holding = false; slam(); } } else if (!pressed && holdT > 0) { holdT = Math.max(0, holdT - dt * 2); $('#hold').style.width = holdT / 1.2 * 100 + '%'; }
    if (state.station === 4 && !pressed && !RM) deck.rotation.y = Math.sin(t * .4) * .35; else if (state.station !== 4 && !ptr) deck.rotation.y += (0 - deck.rotation.y) * .08;
    stepLever(dt); stepSteam(dt); stepBrass(); stepDust(dt, t); burst = Math.max(0, burst - dt * .5);
    cam.lookAt(look); stepFx(dt); if (usePost()) composer.render(); else R.render(S, cam); if (recording) recFrame(); }
  requestAnimationFrame(loop); }
/* ================= POST FX: bloom + chromatic aberration hit ================= */
const composer = new EffectComposer(R);
composer.addPass(new RenderPass(S, cam));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .35, .5, .82); composer.addPass(bloom);
const chroma = new ShaderPass({ uniforms: { tDiffuse: { value: null }, amt: { value: 0 } },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: 'uniform sampler2D tDiffuse;uniform float amt;varying vec2 vUv;void main(){vec2 d=(vUv-.5)*amt;vec4 c=texture2D(tDiffuse,vUv);c.r=texture2D(tDiffuse,vUv+d).r;c.b=texture2D(tDiffuse,vUv-d).b;gl_FragColor=c;}' });
composer.addPass(chroma); composer.addPass(new OutputPass());
let pressFx = 0; const shake = new THREE.Vector3();
const usePost = () => !inSketch && (MOB ? pressFx > 0 : state.station === 4);
/* sparks + wood dust */
const SN = MOB ? 160 : 320, sG = new THREE.BufferGeometry(), sP = new Float32Array(SN * 3).fill(-50), sV = new Float32Array(SN * 3), sL = new Float32Array(SN);
sG.setAttribute('position', new THREE.BufferAttribute(sP, 3));
const sparks = new THREE.Points(sG, new THREE.PointsMaterial({ color: '#ffb54a', size: .035, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sparks.frustumCulled = false; S.add(sparks);
function spawnSparks() { for (let i = 0; i < SN; i++) { const side = Math.random() < .5 ? -1 : 1, x = (Math.random() - .5) * 3.4;
  sP[i * 3] = x; sP[i * 3 + 1] = -.02; sP[i * 3 + 2] = side * .45; sV[i * 3] = x * .8 + (Math.random() - .5) * 2; sV[i * 3 + 1] = Math.random() * 3.2; sV[i * 3 + 2] = side * (1 + Math.random() * 3.5); sL[i] = .5 + Math.random() * 1.1; } }
function stepFx(dt) { pressFx = Math.max(0, pressFx - dt);
  for (let i = 0; i < SN; i++) { if (sL[i] <= 0) continue; sL[i] -= dt; sV[i * 3 + 1] -= 9 * dt; for (let k = 0; k < 3; k++) sP[i * 3 + k] += sV[i * 3 + k] * dt;
    if (sP[i * 3 + 1] < -.38 && sV[i * 3 + 1] < 0) { sV[i * 3 + 1] *= -.3; sV[i * 3] *= .6; sV[i * 3 + 2] *= .6; } if (sL[i] <= 0) sP[i * 3 + 1] = -50; }
  sG.attributes.position.needsUpdate = true;
  const t = performance.now() / 1000; let on = 0;
  if (lampStrobe > 0) { lampStrobe -= dt; on = Math.floor(t * 16) % 2; } else if (lampMode) on = Math.floor(t * 2.5) % 2;
  lampMat.emissiveIntensity = on ? 6 : .15; lampLight.intensity = on ? 40 : 0;
  if (beltOn) beltT.offset.y -= dt * 1.2;
  cam.position.add(shake); cam.lookAt(look); cam.position.sub(shake); shake.multiplyScalar(.5); }
/* serial stamp art (BOT1's proof_stamp + live serial) */
const stampCache = {};
function stampCanvas(id, nm) { const k = id + '|' + nm; if (stampCache[k]) return stampCache[k]; const c = mk(900, 320), x = c.getContext('2d');
  if (stampImg.naturalWidth) x.drawImage(stampImg, 0, 0, 900, 320); else { x.strokeStyle = C.red; x.lineWidth = 10; x.strokeRect(20, 20, 860, 280); }
  x.fillStyle = C.red; x.textAlign = 'center'; x.font = '700 72px "IBM Plex Mono"'; x.fillText(String(id), 450, 192);
  x.font = '700 34px Caveat'; x.fillText('made for ' + nm, 450, 262);
  // ink texture: knock out speckles so it reads as a real rubber stamp
  x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 1400; i++) { x.fillRect(Math.random() * 900, Math.random() * 320, 1.5, 1.5); } x.globalCompositeOperation = 'source-over';
  return stampCache[k] = c; }
/* "Record the slam": 9:16 MediaRecorder clip */
const wmW = new Image(); wmW.src = 'assets/canva/proof_wordmark_white.webp';
let recording = false, rec = null, recChunks = [], rcv = mk(720, 1280), rcx = rcv.getContext('2d');
function recFrame() { const src = R.domElement, sh = src.height, sw = Math.min(src.width, sh * 9 / 16), sx0 = (src.width - sw) / 2;
  rcx.drawImage(src, sx0, 0, sw, sh, 0, 0, 720, 1280);
  rcx.fillStyle = 'rgba(14,13,12,.55)'; rcx.fillRect(0, 0, 720, 120); if (wmW.naturalWidth) rcx.drawImage(wmW, 36, 30, 230, 60);
  if (serialOnDeck) rcx.drawImage(stampCanvas(serialOnDeck[0], serialOnDeck[1]), 90, 1040, 540, 192); }
function startRec() { const btn = $('#rec');
  if (!rcv.captureStream || !window.MediaRecorder) { btn.textContent = 'RECORDING NOT SUPPORTED IN THIS BROWSER'; return; }
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || '';
  recChunks = []; rec = new MediaRecorder(rcv.captureStream(30), mime ? { mimeType: mime, videoBitsPerSecond: 5e6 } : {});
  rec.ondataavailable = e => e.data.size && recChunks.push(e.data);
  rec.onstop = () => { const b = new Blob(recChunks, { type: rec.mimeType || 'video/webm' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `proof-${lastId || 'slam'}-9x16.${(rec.mimeType || '').includes('mp4') ? 'mp4' : 'webm'}`; a.click(); btn.textContent = 'RECORD THE SLAM (9:16)'; };
  btn.textContent = 'RECORDING…'; recording = true; rec.start(250); replay = true; pressed = false; holdT = 0; fired = false; enterMachine(4); setTimeout(slam, 1600); }
function stopRec() { recording = false; try { rec && rec.state !== 'inactive' && rec.stop(); } catch (e) {} }
$('#rec').onclick = startRec;
/* loader handoff */
let assetsDone = false; const t0 = performance.now();
THREE.DefaultLoadingManager.onLoad = () => { assetsDone = true; };
function hideLoader() { const L = $('#load'); if (!L) return; if ((!assetsDone && performance.now() - t0 < 9000) || performance.now() - t0 < 1400) return setTimeout(hideLoader, 120);
  document.fonts.ready.then(() => gsap.to(L, { opacity: 0, duration: RM ? 0 : .5, onComplete: () => L.remove() })); }
hideLoader();

/* boot */
state.posY = 0; buildDeck(1); drawPlies(); sheetsFromState(); loadArts(); drawArt(); updateReceipt(); railUpdate(); size(); addEventListener('resize', size);
document.fonts.ready.then(() => { drawArt(); drawGrip(); });
woodImg.onload = () => { drawArt(); drawGrip(); sheetsFromState(); };
document.body.classList.add('sk'); loop();
window.__proof = { deck, go, enterMachine, state, slam, placeStamp, setArt, pour, bendTo1, doneSt, rayAt, meshes: () => meshes, cam, leverHit, leverP: () => leverP, stampMode: () => stampMode };
window.__deckZ = () => deck.position.z;
window.__ramY = () => ram.position.y;

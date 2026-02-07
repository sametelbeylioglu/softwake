/* ═══════════════════════════════════════════════
   SoftWakeEngine — 5 dk ses motoru (Web Audio API)
   
   Faz 1 (0–2 dk):  432 Hz sinüs, çok düşük ses, dalgalı
   Faz 2 (2–4 dk):  528 Hz'e geçiş, pink noise, ses artar
   Faz 3 (4–5 dk):  Doğal ortam, ton söner
   5. dakika sonunda tamamen susar.
   ═══════════════════════════════════════════════ */

var SoftWakeEngine = (function () {
  'use strict';

  var TOTAL_DURATION = 300; // 5 dakika (saniye)

  var audioCtx = null;
  var oscillator = null;
  var toneGain = null;
  var noiseSource = null;
  var noiseGain = null;
  var masterGain = null;

  var startTime = null;
  var rafId = null;
  var tickInterval = null;
  var isPlaying = false;

  // Callbacks
  var onProgressFn = null;
  var onStopFn = null;
  var onPhaseFn = null;

  // ── AudioContext oluştur (kullanıcı etkileşimi sonrası) ──

  function ensureContext() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // ── Pink noise buffer üret ──

  function createPinkNoiseBuffer(ctx, seconds) {
    var sampleRate = ctx.sampleRate;
    var length = Math.floor(sampleRate * seconds);
    var buffer = ctx.createBuffer(1, length, sampleRate);
    var data = buffer.getChannelData(0);

    // Paul Kellet refined algorithm
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (var i = 0; i < length; i++) {
      var white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      var pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.11;
    }

    return buffer;
  }

  // ── Başlat ──

  function start() {
    if (isPlaying) return;

    var ctx = ensureContext();

    // Master gain
    masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(ctx.destination);

    // ── Oscillator (sinüs ton) ──
    oscillator = ctx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 432;

    toneGain = ctx.createGain();
    toneGain.gain.value = 0;

    oscillator.connect(toneGain);
    toneGain.connect(masterGain);
    oscillator.start();

    // ── Pink noise (looping buffer) ──
    var noiseBuffer = createPinkNoiseBuffer(ctx, 4); // 4 saniyelik buffer, loop
    noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;

    noiseSource.connect(noiseGain);
    noiseGain.connect(masterGain);
    noiseSource.start();

    // ── Zamanlama ──
    startTime = Date.now();
    isPlaying = true;

    // Tick: her 60ms güncelle
    tickInterval = setInterval(tick, 60);

    // İlk tick
    tick();
  }

  // ── Durdur ──

  function stop() {
    if (!isPlaying) return;

    clearInterval(tickInterval);
    tickInterval = null;

    try {
      if (oscillator) { oscillator.stop(); oscillator.disconnect(); }
      if (noiseSource) { noiseSource.stop(); noiseSource.disconnect(); }
      if (toneGain) toneGain.disconnect();
      if (noiseGain) noiseGain.disconnect();
      if (masterGain) masterGain.disconnect();
    } catch (e) { /* zaten durdurulmuş olabilir */ }

    oscillator = null;
    noiseSource = null;
    toneGain = null;
    noiseGain = null;
    masterGain = null;
    startTime = null;
    isPlaying = false;

    if (onStopFn) onStopFn();
  }

  // ── Tick (her 60ms) ──

  function tick() {
    if (!isPlaying || !startTime) return;

    var elapsed = (Date.now() - startTime) / 1000; // saniye

    // ⛔ 5 dakika doldu
    if (elapsed >= TOTAL_DURATION) {
      stop();
      return;
    }

    var ctx = audioCtx;
    var now = ctx.currentTime;

    // Smooth geçişler için kısa ramp süresi
    var ramp = 0.08;

    // ── Faz 1: 0–2 dk | 432 Hz | çok düşük, dalgalı ──
    if (elapsed < 120) {
      var wave = Math.sin(elapsed * 0.4) * 0.015;
      var toneVol = Math.max(0, 0.04 + wave);

      oscillator.frequency.setTargetAtTime(432, now, ramp);
      toneGain.gain.setTargetAtTime(toneVol, now, ramp);
      noiseGain.gain.setTargetAtTime(0, now, ramp);

      if (onPhaseFn) onPhaseFn('432 Hz · Çok hafif');
    }
    // ── Faz 2: 2–4 dk | 432→528 Hz | pink noise | ses artar ──
    else if (elapsed < 240) {
      var t = (elapsed - 120) / 120; // 0→1

      // Smoothstep frekans geçişi
      var smoothT = t * t * (3 - 2 * t);
      var freq = 432 + (528 - 432) * smoothT;

      // Kuadratik volüm eğrisi
      var volumeCurve = t * t;
      var toneVol = 0.055 + volumeCurve * 0.145;

      // Pink noise kademeli giriş
      var noiseVol = t * 0.10;

      oscillator.frequency.setTargetAtTime(freq, now, ramp);
      toneGain.gain.setTargetAtTime(toneVol, now, ramp);
      noiseGain.gain.setTargetAtTime(noiseVol, now, ramp);

      if (onPhaseFn) onPhaseFn('528 Hz\'e geçiş · Yükseliyor');
    }
    // ── Faz 3: 4–5 dk | Doğal ortam | ton söner ──
    else {
      var t = (elapsed - 240) / 60; // 0→1

      // Ton söner
      var toneVol = 0.20 * (1.0 - t);

      // Ambient noise zirve yapıp iner
      var ambientCurve = Math.sin(t * Math.PI);
      var noiseVol = 0.10 + ambientCurve * 0.15;

      oscillator.frequency.setTargetAtTime(528, now, ramp);
      toneGain.gain.setTargetAtTime(toneVol, now, ramp);
      noiseGain.gain.setTargetAtTime(noiseVol, now, ramp);

      if (onPhaseFn) onPhaseFn('Doğal uyanış · Son dakika');
    }

    // ── Progress callback ──
    var progress = elapsed / TOTAL_DURATION;
    var remaining = Math.ceil(TOTAL_DURATION - elapsed);
    var mins = Math.floor(remaining / 60);
    var secs = remaining % 60;
    var timeStr = mins + ':' + (secs < 10 ? '0' : '') + secs;

    if (onProgressFn) onProgressFn(progress, timeStr);
  }

  // ── Callback setters ──

  function onProgress(fn) { onProgressFn = fn; }
  function onStop(fn) { onStopFn = fn; }
  function onPhase(fn) { onPhaseFn = fn; }

  function getIsPlaying() { return isPlaying; }

  return {
    start: start,
    stop: stop,
    onProgress: onProgress,
    onStop: onStop,
    onPhase: onPhase,
    isPlaying: getIsPlaying,
    ensureContext: ensureContext
  };

})();

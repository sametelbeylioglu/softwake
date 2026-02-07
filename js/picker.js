/* ═══════════════════════════════════════════════
   WheelPicker — Touch/drag tabanlı iOS saat seçici
   Scroll-snap yerine transform + momentum kullanır.
   ═══════════════════════════════════════════════ */

var WheelPicker = (function () {
  'use strict';

  var ITEM_H = 44;      // Her öğe yüksekliği (px)
  var CENTER = 2;        // Merkezin üstündeki öğe sayısı (5 görünür → 2 üst, 1 merkez, 2 alt)
  var activePicker = null;

  // ── Yardımcılar ──

  function getY(e) {
    return e.touches ? e.touches[0].clientY : e.clientY;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // ── Global move / end (tek sefer kayıt, tüm picker'lar paylaşır) ──

  document.addEventListener('touchmove', function (e) {
    if (!activePicker) return;
    e.preventDefault();
    handleMove(getY(e));
  }, { passive: false });

  document.addEventListener('mousemove', function (e) {
    if (!activePicker) return;
    e.preventDefault();
    handleMove(getY(e));
  });

  document.addEventListener('touchend', handleEnd);
  document.addEventListener('touchcancel', handleEnd);
  document.addEventListener('mouseup', handleEnd);

  function handleMove(y) {
    var p = activePicker;
    if (!p) return;

    var delta = y - p.startY;
    var now = Date.now();
    var dt = now - p.lastTime;

    if (dt > 5) {
      p.velocity = (y - p.lastY) / dt * 1000; // px/saniye
      p.lastY = y;
      p.lastTime = now;
    }

    applyOffset(p, p.startOffset + delta);
  }

  function handleEnd() {
    var p = activePicker;
    if (!p) return;
    activePicker = null;
    p.el.style.cursor = 'grab';

    // Momentum hesapla
    var momentum = p.velocity * 0.12;
    var targetOffset = p.offset + momentum;

    // En yakın öğeye snap
    var index = Math.round(-targetOffset / ITEM_H);
    index = clamp(index, 0, p.count - 1);
    animateTo(p, -index * ITEM_H);
  }

  // ── Offset uygula (track'ı hareket ettir + görsel güncelle) ──

  function applyOffset(p, offset) {
    // Sınırları aş biraz (rubber band efekti)
    var min = -(p.count - 1) * ITEM_H;
    var max = 0;

    if (offset > max) {
      offset = max + (offset - max) * 0.3;
    } else if (offset < min) {
      offset = min + (offset - min) * 0.3;
    }

    p.offset = offset;
    p.track.style.transform = 'translate3d(0,' + (offset + CENTER * ITEM_H) + 'px,0)';
    updateItemStyles(p);
  }

  // ── Öğe stillerini güncelle (merkeze yakınlığa göre) ──

  function updateItemStyles(p) {
    var centerFloat = -p.offset / ITEM_H;
    var items = p.items;

    for (var i = 0; i < items.length; i++) {
      var dist = Math.abs(i - centerFloat);

      var opacity, scale;
      if (dist < 0.5) {
        opacity = 1;
        scale = 1;
      } else if (dist < 1.5) {
        opacity = 0.5;
        scale = 0.92;
      } else if (dist < 2.5) {
        opacity = 0.25;
        scale = 0.85;
      } else {
        opacity = 0.1;
        scale = 0.8;
      }

      items[i].style.opacity = opacity;
      items[i].style.transform = 'scale(' + scale + ')';
    }
  }

  // ── Animasyonlu geçiş (ease-out) ──

  function animateTo(p, target) {
    cancelAnimationFrame(p.animId);

    // Sınırla
    target = clamp(target, -(p.count - 1) * ITEM_H, 0);

    var start = p.offset;
    var t0 = performance.now();
    var dur = 350;

    function step(now) {
      var t = Math.min(1, (now - t0) / dur);
      // ease-out cubic
      t = 1 - Math.pow(1 - t, 3);

      var current = start + (target - start) * t;
      p.offset = current;
      p.track.style.transform = 'translate3d(0,' + (current + CENTER * ITEM_H) + 'px,0)';
      updateItemStyles(p);

      if (t < 1) {
        p.animId = requestAnimationFrame(step);
      }
    }

    p.animId = requestAnimationFrame(step);
  }

  // ═══ Public API ═══

  /**
   * Wheel picker oluştur
   * @param {HTMLElement} container - .wheel elementi
   * @param {number} count - Seçenek sayısı (0..count-1)
   * @param {number} initial - Başlangıç değeri
   * @param {function} [formatFn] - Görüntüleme formatı
   */
  function create(container, count, initial, formatFn) {
    formatFn = formatFn || function (n) {
      return n < 10 ? '0' + n : '' + n;
    };

    container.innerHTML = '';

    // Track (tüm öğeleri taşır, transform ile hareket eder)
    var track = document.createElement('div');
    track.className = 'wheel-track';
    container.appendChild(track);

    var items = [];
    for (var i = 0; i < count; i++) {
      var el = document.createElement('div');
      el.className = 'wheel-item';
      el.textContent = formatFn(i);
      el.dataset.index = i;
      track.appendChild(el);
      items.push(el);
    }

    // Picker state
    var p = {
      el: container,
      track: track,
      items: items,
      count: count,
      offset: 0,
      startY: 0,
      startOffset: 0,
      lastY: 0,
      lastTime: 0,
      velocity: 0,
      animId: null
    };

    container._picker = p;

    // ── Touch / mouse start ──
    function onStart(e) {
      cancelAnimationFrame(p.animId);
      activePicker = p;
      container.style.cursor = 'grabbing';

      var y = getY(e);
      p.startY = y;
      p.startOffset = p.offset;
      p.lastY = y;
      p.lastTime = Date.now();
      p.velocity = 0;
    }

    container.addEventListener('touchstart', onStart, { passive: true });
    container.addEventListener('mousedown', function (e) {
      e.preventDefault();
      onStart(e);
    });

    // ── Tıklama ile seçim ──
    items.forEach(function (el, idx) {
      el.addEventListener('click', function (e) {
        // Sürükleme sonrası tıklamayı yoksay
        if (Math.abs(p.offset - p.startOffset) > 5) return;
        animateTo(p, -idx * ITEM_H);
      });
    });

    // ── Mouse wheel desteği ──
    container.addEventListener('wheel', function (e) {
      e.preventDefault();
      cancelAnimationFrame(p.animId);

      var delta = e.deltaY > 0 ? 1 : -1;
      var currentIndex = Math.round(-p.offset / ITEM_H);
      var newIndex = clamp(currentIndex + delta, 0, count - 1);
      animateTo(p, -newIndex * ITEM_H);
    }, { passive: false });

    // Başlangıç pozisyonu (animasyonsuz)
    initial = clamp(initial, 0, count - 1);
    p.offset = -initial * ITEM_H;
    p.track.style.transform = 'translate3d(0,' + (p.offset + CENTER * ITEM_H) + 'px,0)';
    updateItemStyles(p);
  }

  function getValue(container) {
    var p = container._picker;
    if (!p) return 0;
    var idx = Math.round(-p.offset / ITEM_H);
    return clamp(idx, 0, p.count - 1);
  }

  function setValue(container, value) {
    var p = container._picker;
    if (!p) return;
    value = clamp(value, 0, p.count - 1);
    animateTo(p, -value * ITEM_H);
  }

  return {
    create: create,
    getValue: getValue,
    setValue: setValue,
    ITEM_HEIGHT: ITEM_H
  };

})();

/* ═══════════════════════════════════════════════
   AlarmStore — localStorage tabanlı veri katmanı
   ═══════════════════════════════════════════════ */

var AlarmStore = (function () {
  'use strict';

  var STORAGE_KEY = 'softwake_alarms';
  var listeners = [];
  var alarms = [];

  // Gün isimleri (0=Pazar, 1=Pazartesi, ... 6=Cumartesi)
  var DAY_NAMES_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  var DAY_NAMES_FULL = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  // Sıralama: Pzt(1) → Paz(0) formatında
  var SORT_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Pzt, Sal, Çar, Per, Cum, Cmt, Paz

  // ── Yardımcılar ──

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function describeRepeat(days) {
    if (!days || days.length === 0) return 'Bir kez';

    var sorted = days.slice().sort(function (a, b) {
      return SORT_ORDER.indexOf(a) - SORT_ORDER.indexOf(b);
    });

    var weekdays = [1, 2, 3, 4, 5];
    var weekends = [0, 6];
    var allDays = [0, 1, 2, 3, 4, 5, 6];

    if (arraysEqual(sorted, allDays.slice().sort())) return 'Her gün';
    if (arraysEqual(sorted, weekdays)) return 'Hafta içi';
    if (arraysEqual(sorted, weekends.slice().sort())) return 'Hafta sonu';

    return sorted.map(function (d) { return DAY_NAMES_SHORT[d]; }).join(', ');
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    var sa = a.slice().sort();
    var sb = b.slice().sort();
    for (var i = 0; i < sa.length; i++) {
      if (sa[i] !== sb[i]) return false;
    }
    return true;
  }

  // ── Persistence ──

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
    } catch (e) {
      console.warn('[SoftWake] Kayıt hatası:', e);
    }
  }

  function load() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      if (data) alarms = JSON.parse(data);
    } catch (e) {
      console.warn('[SoftWake] Yükleme hatası:', e);
      alarms = [];
    }
  }

  function notify() {
    listeners.forEach(function (fn) { fn(alarms); });
  }

  // ── CRUD ──

  function add(alarm) {
    alarm.id = generateId();
    alarm.enabled = true;
    alarm.lastFired = null;
    alarms.push(alarm);
    save();
    notify();
    return alarm;
  }

  function update(id, data) {
    for (var i = 0; i < alarms.length; i++) {
      if (alarms[i].id === id) {
        Object.assign(alarms[i], data);
        save();
        notify();
        return alarms[i];
      }
    }
    return null;
  }

  function remove(id) {
    alarms = alarms.filter(function (a) { return a.id !== id; });
    save();
    notify();
  }

  function toggle(id) {
    for (var i = 0; i < alarms.length; i++) {
      if (alarms[i].id === id) {
        alarms[i].enabled = !alarms[i].enabled;
        save();
        notify();
        return alarms[i].enabled;
      }
    }
    return false;
  }

  function getAll() {
    return alarms.slice();
  }

  function getById(id) {
    for (var i = 0; i < alarms.length; i++) {
      if (alarms[i].id === id) return alarms[i];
    }
    return null;
  }

  // ── Alarm zamanlaması kontrol ──

  function checkAlarms() {
    var now = new Date();
    var currentH = now.getHours();
    var currentM = now.getMinutes();
    var currentDay = now.getDay(); // 0=Pazar

    var todayStr = now.toDateString();

    for (var i = 0; i < alarms.length; i++) {
      var a = alarms[i];
      if (!a.enabled) continue;
      if (a.hour !== currentH || a.minute !== currentM) continue;
      if (a.lastFired === todayStr) continue; // Bugün zaten çaldı

      // Başlangıç tarihi kontrolü
      if (a.startDate) {
        var startDate = new Date(a.startDate);
        startDate.setHours(0, 0, 0, 0);
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        if (today < startDate) continue;
      }

      // Gün kontrolü
      if (a.days && a.days.length > 0) {
        if (a.days.indexOf(currentDay) === -1) continue;
      }

      // Alarm tetikle!
      a.lastFired = todayStr;

      // Tek seferlik alarmı kapat
      if (!a.days || a.days.length === 0) {
        a.enabled = false;
      }

      save();
      notify();
      return a; // Tetiklenen alarm
    }

    return null;
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  // ── Init ──
  load();

  return {
    add: add,
    update: update,
    remove: remove,
    toggle: toggle,
    getAll: getAll,
    getById: getById,
    checkAlarms: checkAlarms,
    onChange: onChange,
    describeRepeat: describeRepeat,
    DAY_NAMES_SHORT: DAY_NAMES_SHORT,
    DAY_NAMES_FULL: DAY_NAMES_FULL
  };

})();

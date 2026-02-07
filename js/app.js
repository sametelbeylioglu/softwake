/* ═══════════════════════════════════════════════
   SoftWake — Ana uygulama kontrolcüsü
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── DOM referansları ──
  var screenList = document.getElementById('screen-list');
  var screenEdit = document.getElementById('screen-edit');
  var screenActive = document.getElementById('screen-active');

  var alarmListEl = document.getElementById('alarm-list');
  var emptyStateEl = document.getElementById('empty-state');

  var editTitle = document.getElementById('edit-title');
  var btnAdd = document.getElementById('btn-add-alarm');
  var btnAddEmpty = document.getElementById('btn-add-empty');
  var btnCancel = document.getElementById('btn-cancel');
  var btnSave = document.getElementById('btn-save');
  var btnDelete = document.getElementById('btn-delete');
  var btnRepeat = document.getElementById('btn-repeat');
  var repeatPicker = document.getElementById('repeat-picker');
  var repeatValue = document.getElementById('repeat-value');
  var startDateInput = document.getElementById('start-date');

  var pickerHour = document.getElementById('picker-hour');
  var pickerMinute = document.getElementById('picker-minute');

  var activeTimeEl = document.getElementById('active-time');
  var activePhaseEl = document.getElementById('active-phase');
  var remainingTimeEl = document.getElementById('remaining-time');
  var progressArc = document.getElementById('progress-arc');
  var btnStop = document.getElementById('btn-stop');

  // ── Durum ──
  var currentScreen = 'list';
  var editingAlarmId = null; // null = yeni alarm
  var selectedDays = [];
  var alarmCheckTimer = null;
  var clockTimer = null;
  var audioUnlocked = false;

  // ── Ekran geçişleri ──

  function showScreen(name) {
    screenList.classList.remove('active');
    screenEdit.classList.remove('active');
    screenActive.classList.remove('active');

    if (name === 'list') screenList.classList.add('active');
    if (name === 'edit') screenEdit.classList.add('active');
    if (name === 'active') screenActive.classList.add('active');

    currentScreen = name;
  }

  // ── Alarm listesi render ──

  function renderList() {
    var alarms = AlarmStore.getAll();

    if (alarms.length === 0) {
      alarmListEl.style.display = 'none';
      emptyStateEl.classList.remove('hidden');
      return;
    }

    emptyStateEl.classList.add('hidden');
    alarmListEl.style.display = 'block';
    alarmListEl.innerHTML = '';

    alarms.forEach(function (alarm) {
      var timeStr = pad(alarm.hour) + ':' + pad(alarm.minute);
      var repeatStr = AlarmStore.describeRepeat(alarm.days);
      var disabledClass = alarm.enabled ? '' : ' disabled';

      var html =
        '<div class="alarm-item" data-id="' + alarm.id + '">' +
          '<div class="alarm-info">' +
            '<div class="alarm-time' + disabledClass + '">' + timeStr + '</div>' +
            '<div class="alarm-meta">' +
              '<span class="alarm-label' + disabledClass + '">Yumuşak Uyanış</span>' +
              '<span class="alarm-dot">·</span>' +
              '<span class="alarm-days' + disabledClass + '">' + repeatStr + '</span>' +
            '</div>' +
          '</div>' +
          '<label class="toggle" onclick="event.stopPropagation()">' +
            '<input type="checkbox" ' + (alarm.enabled ? 'checked' : '') + ' data-toggle-id="' + alarm.id + '">' +
            '<div class="toggle-track"></div>' +
            '<div class="toggle-thumb"></div>' +
          '</label>' +
        '</div>';

      alarmListEl.insertAdjacentHTML('beforeend', html);
    });

    // Toggle event'leri
    alarmListEl.querySelectorAll('input[data-toggle-id]').forEach(function (input) {
      input.addEventListener('change', function () {
        AlarmStore.toggle(this.dataset.toggleId);
        syncAlarmsToServer();
      });
    });

    // Tıklama → düzenle
    alarmListEl.querySelectorAll('.alarm-item').forEach(function (item) {
      item.addEventListener('click', function () {
        openEdit(this.dataset.id);
      });
    });
  }

  // ── Düzenleme ekranını aç ──

  function openEdit(alarmId) {
    editingAlarmId = alarmId || null;
    selectedDays = [];

    // Tekrar picker'ı kapat
    repeatPicker.classList.add('hidden');

    if (editingAlarmId) {
      // Düzenleme modu
      var alarm = AlarmStore.getById(editingAlarmId);
      if (!alarm) return;

      editTitle.textContent = 'Alarmı Düzenle';
      btnDelete.classList.remove('hidden');

      WheelPicker.setValue(pickerHour, alarm.hour);
      WheelPicker.setValue(pickerMinute, alarm.minute);

      selectedDays = (alarm.days || []).slice();
      startDateInput.value = alarm.startDate || todayStr();
    } else {
      // Yeni alarm
      editTitle.textContent = 'Alarm Ekle';
      btnDelete.classList.remove('hidden');
      btnDelete.classList.add('hidden');

      var now = new Date();
      var nextHour = (now.getHours() + 1) % 24;
      WheelPicker.setValue(pickerHour, nextHour);
      WheelPicker.setValue(pickerMinute, 0);

      selectedDays = [];
      startDateInput.value = todayStr();
    }

    updateRepeatUI();
    showScreen('edit');
  }

  // ── Kaydet ──

  function saveAlarm() {
    var hour = WheelPicker.getValue(pickerHour);
    var minute = WheelPicker.getValue(pickerMinute);
    var startDate = startDateInput.value || todayStr();

    var data = {
      hour: hour,
      minute: minute,
      days: selectedDays.slice(),
      startDate: startDate
    };

    if (editingAlarmId) {
      AlarmStore.update(editingAlarmId, data);
      showToast('Alarm güncellendi');
    } else {
      AlarmStore.add(data);
      showToast('Alarm eklendi — ' + pad(hour) + ':' + pad(minute));
    }

    // Push notification sunucusuna senkronize et
    syncAlarmsToServer();

    showScreen('list');
  }

  // ── Sil ──

  function deleteAlarm() {
    if (editingAlarmId) {
      AlarmStore.remove(editingAlarmId);
      showToast('Alarm silindi');
    }

    // Push notification sunucusuna senkronize et
    syncAlarmsToServer();

    showScreen('list');
  }

  // ── Push senkronizasyonu (kullanıcı eylemi ile tetiklenir) ──

  function syncAlarmsToServer() {
    if (PushManager && PushManager.supported()) {
      var allAlarms = AlarmStore.getAll();
      console.log('[SoftWake] Sync: ' + allAlarms.length + ' alarm gönderiliyor', JSON.stringify(allAlarms));
      PushManager.syncAlarms(allAlarms);
    }
  }

  // ── Tekrar picker ──

  function updateRepeatUI() {
    // Değer göstergesini güncelle
    repeatValue.textContent = AlarmStore.describeRepeat(selectedDays);

    // Chip'leri güncelle
    document.querySelectorAll('.chip').forEach(function (chip) {
      chip.classList.remove('active');
    });

    var weekdays = [1, 2, 3, 4, 5];
    var weekends = [0, 6];
    var allDays = [0, 1, 2, 3, 4, 5, 6];

    if (arrEq(selectedDays, allDays)) {
      document.querySelector('[data-preset="everyday"]').classList.add('active');
    } else if (arrEq(selectedDays, weekdays)) {
      document.querySelector('[data-preset="weekdays"]').classList.add('active');
    } else if (arrEq(selectedDays, weekends)) {
      document.querySelector('[data-preset="weekends"]').classList.add('active');
    }

    // Gün check'lerini güncelle
    document.querySelectorAll('.day-toggle').forEach(function (btn) {
      var day = parseInt(btn.dataset.day);
      var check = btn.querySelector('.check-icon');
      if (selectedDays.indexOf(day) >= 0) {
        check.classList.remove('hidden');
      } else {
        check.classList.add('hidden');
      }
    });
  }

  function arrEq(a, b) {
    if (a.length !== b.length) return false;
    var sa = a.slice().sort();
    var sb = b.slice().sort();
    for (var i = 0; i < sa.length; i++) {
      if (sa[i] !== sb[i]) return false;
    }
    return true;
  }

  // ── Aktif alarm ekranı ──

  function showActiveAlarm() {
    showScreen('active');
    updateActiveClock();

    // Saat güncelleme timer'ı
    clockTimer = setInterval(updateActiveClock, 1000);

    // Ses motorunu başlat
    SoftWakeEngine.start();
  }

  function updateActiveClock() {
    var now = new Date();
    activeTimeEl.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes());
  }

  function stopAlarm() {
    SoftWakeEngine.stop();
    clearInterval(clockTimer);
    showScreen('list');
  }

  // ── Engine callbacks ──

  SoftWakeEngine.onProgress(function (progress, timeStr) {
    remainingTimeEl.textContent = timeStr;

    // SVG arc güncelle (circumference = 2πr = 2×π×100 = 628.32)
    var circumference = 628.32;
    var offset = circumference * (1 - progress);
    progressArc.style.strokeDashoffset = offset;
  });

  SoftWakeEngine.onPhase(function (description) {
    activePhaseEl.textContent = description;
  });

  SoftWakeEngine.onStop(function () {
    clearInterval(clockTimer);
    showScreen('list');
    showToast('Yumuşak uyanış tamamlandı');
  });

  // ── Alarm kontrol döngüsü (her saniye) ──

  function startAlarmCheck() {
    alarmCheckTimer = setInterval(function () {
      if (currentScreen === 'active') return; // Zaten çalıyor

      var triggered = AlarmStore.checkAlarms();
      if (triggered) {
        showActiveAlarm();
      }
    }, 1000);
  }

  // ── Bildirim izni iste ──

  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  // ── Audio unlock (iOS/mobil için gerekli) ──

  function unlockAudio() {
    if (audioUnlocked) return;
    SoftWakeEngine.ensureContext();
    audioUnlocked = true;
    document.removeEventListener('touchstart', unlockAudio);
    document.removeEventListener('click', unlockAudio);
  }

  // ── Toast bildirimi ──

  function showToast(msg) {
    // Varsa eskiyi kaldır
    var old = document.querySelector('.toast');
    if (old) old.remove();

    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);

    requestAnimationFrame(function () {
      el.classList.add('show');
    });

    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 300);
    }, 2500);
  }

  // ── Yardımcılar ──

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // ═══ Event Listener'lar ═══

  // Alarm ekle
  btnAdd.addEventListener('click', function () { openEdit(null); });
  btnAddEmpty.addEventListener('click', function () { openEdit(null); });

  // İptal
  btnCancel.addEventListener('click', function () { showScreen('list'); });

  // Kaydet
  btnSave.addEventListener('click', saveAlarm);

  // Sil
  btnDelete.addEventListener('click', deleteAlarm);

  // Durdur
  btnStop.addEventListener('click', stopAlarm);

  // Tekrar toggle
  btnRepeat.addEventListener('click', function () {
    repeatPicker.classList.toggle('hidden');
  });

  // Preset chip'ler
  document.querySelectorAll('.chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var preset = this.dataset.preset;
      if (preset === 'everyday') selectedDays = [0, 1, 2, 3, 4, 5, 6];
      else if (preset === 'weekdays') selectedDays = [1, 2, 3, 4, 5];
      else if (preset === 'weekends') selectedDays = [0, 6];
      updateRepeatUI();
    });
  });

  // Gün toggle'ları
  document.querySelectorAll('.day-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var day = parseInt(this.dataset.day);
      var idx = selectedDays.indexOf(day);
      if (idx >= 0) {
        selectedDays.splice(idx, 1);
      } else {
        selectedDays.push(day);
      }
      updateRepeatUI();
    });
  });

  // Store değişiklik dinleyicisi
  AlarmStore.onChange(renderList);

  // Audio unlock (mobil)
  document.addEventListener('touchstart', unlockAudio, { once: true });
  document.addEventListener('click', unlockAudio, { once: true });

  // ── Service Worker'dan gelen mesajları dinle (push notification tıklaması) ──

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (event) {
      if (event.data && event.data.type === 'ALARM_TRIGGERED') {
        console.log('[SoftWake] Push notification ile alarm tetiklendi');
        showActiveAlarm();
      }
    });
  }

  // ── URL'den alarm tetikleme kontrolü (?alarm=triggered) ──

  function checkURLTrigger() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('alarm') === 'triggered') {
      // URL'i temizle
      history.replaceState(null, '', '/');
      // Kısa gecikme ile ses motorunu başlat (UI hazır olsun)
      setTimeout(function () {
        showActiveAlarm();
      }, 500);
    }
  }

  // ═══ Başlat ═══

  // Wheel picker'ları oluştur
  WheelPicker.create(pickerHour, 24, new Date().getHours());
  WheelPicker.create(pickerMinute, 60, 0);

  // Bugünün tarihini ayarla
  startDateInput.value = todayStr();
  startDateInput.min = todayStr();

  // Listeyi render et
  renderList();

  // Alarm kontrol döngüsünü başlat (ön plan kontrolü)
  startAlarmCheck();

  // Push durum mesajlarını toast olarak göster
  if (PushManager && PushManager.onStatus) {
    PushManager.onStatus(function (msg) {
      showToast(msg);
    });
  }

  // URL'den tetikleme kontrolü
  checkURLTrigger();

  // İlk ekranı göster
  showScreen('list');

  console.log('[SoftWake] Uygulama başlatıldı ✓');

})();

// ---- Salah Reminder app logic ----

const PRAYER_ORDER = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const KAABA = { lat: 21.4225, lng: 39.8262 };
const CALC_METHOD = 1; // University of Islamic Sciences, Karachi (common for South Asia)

const PRAYER_NAME_BN = {
  Fajr: "ফজর", Dhuhr: "যোহর", Asr: "আসর", Maghrib: "মাগরিব", Isha: "এশা"
};

const I18N = {
  en: {
    brandSalah: "Salah", brandReminder: "Reminder",
    nextPrayer: "Next prayer", remaining: "remaining",
    methodLabel: "Method: Karachi",
    notifyText: "Enable notifications so Salah Reminder can alert you at every prayer time.",
    notifyBtn: "Enable notifications",
    qiblaHint: "Point the top of your phone forward and rotate until the needle lines up with the marker.",
    qiblaCalc: "Calculating direction to the Kaaba from your location…",
    qiblaAligned: "Line up the needle with the marker — that's the Qibla direction.",
    qiblaTapEnable: "Tap the compass to enable your device's sensor.",
    qiblaUnsupported: "Your device does not support compass sensors — use the degree value with a separate compass.",
    tabTimes: "Prayer Times", tabQibla: "Qibla", tabTasbih: "Tasbih",
    tapToCount: "Tap the circle to count", resetBtn: "Reset",
    locating: "Locating…", locationNeeded: "Location needed", locationSet: "Location set",
    enableLocation: "Enable location",
    ramadanUpcoming: "<b>{days} days</b> until Ramadan {year}",
    ramadanSoon: "<b>Ramadan</b> begins tomorrow",
    ramadanToday: "<b>Ramadan Mubarak!</b> Ramadan begins today",
    tomorrow: "(tomorrow)",
    at: "at",
  },
  bn: {
    brandSalah: "সালাহ", brandReminder: "রিমাইন্ডার",
    nextPrayer: "পরবর্তী নামাজ", remaining: "বাকি আছে",
    methodLabel: "পদ্ধতি: করাচি",
    notifyText: "প্রতি ওয়াক্তের নামাজের সময় সতর্কতা পেতে নোটিফিকেশন চালু করুন।",
    notifyBtn: "নোটিফিকেশন চালু করুন",
    qiblaHint: "ফোনের উপরের দিকটা সামনে রেখে ঘুরান, যতক্ষণ না needle মার্কারের সাথে মিলে যায়।",
    qiblaCalc: "আপনার অবস্থান থেকে কাবার দিক হিসাব করা হচ্ছে…",
    qiblaAligned: "needle-কে মার্কারের সাথে মিলিয়ে নিন — এটাই কিবলার দিক।",
    qiblaTapEnable: "ডিভাইসের সেন্সর চালু করতে কম্পাসে ট্যাপ করুন।",
    qiblaUnsupported: "আপনার ডিভাইস কম্পাস সেন্সর সাপোর্ট করে না — আলাদা কম্পাস দিয়ে ডিগ্রি অনুযায়ী দিক ঠিক করুন।",
    tabTimes: "নামাজের সময়", tabQibla: "কিবলা", tabTasbih: "তাসবিহ",
    tapToCount: "গণনা করতে বৃত্তে ট্যাপ করুন", resetBtn: "রিসেট",
    locating: "অবস্থান খোঁজা হচ্ছে…", locationNeeded: "অবস্থান প্রয়োজন", locationSet: "অবস্থান সেট হয়েছে",
    enableLocation: "অবস্থান চালু করুন",
    ramadanUpcoming: "রমজান {year} শুরু হতে বাকি <b>{days} দিন</b>",
    ramadanSoon: "আগামীকাল থেকে <b>রমজান</b> শুরু",
    ramadanToday: "<b>রমজান মুবারক!</b> আজ থেকে রমজান শুরু",
    tomorrow: "(আগামীকাল)",
    at: "সময়:",
  }
};

let state = {
  coords: null,
  timings: null,
  dateInfo: null,
  timers: [],
  lang: localStorage.getItem("sr_lang") || "en",
  tasbihCount: parseInt(localStorage.getItem("sr_tasbih_count") || "0", 10),
  tasbihTarget: parseInt(localStorage.getItem("sr_tasbih_target") || "33", 10),
};

function t(key) { return (I18N[state.lang] && I18N[state.lang][key]) || I18N.en[key] || key; }
function prayerLabel(name) { return state.lang === "bn" ? (PRAYER_NAME_BN[name] || name) : name; }

// ---------- Utilities ----------
function pad(n) { return n.toString().padStart(2, "0"); }

function parseTimeToday(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function fmt12(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${period}`;
}

// ---------- Language ----------
function applyLanguage() {
  document.body.classList.toggle("lang-bn", state.lang === "bn");
  document.getElementById("langEnBtn").classList.toggle("active", state.lang === "en");
  document.getElementById("langBnBtn").classList.toggle("active", state.lang === "bn");

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (I18N[state.lang] && I18N[state.lang][key] !== undefined) {
      el.textContent = I18N[state.lang][key];
    }
  });

  document.getElementById("tasbihOf").textContent = "/ " + state.tasbihTarget;

  if (state.timings) {
    renderList(state.timings);
    startCountdown(state.timings);
  } else {
    document.getElementById("locLabel").textContent = t("locating");
  }
  if (state.coords) renderRamadanCard();
}

function setupLangToggle() {
  document.getElementById("langEnBtn").addEventListener("click", () => {
    state.lang = "en"; localStorage.setItem("sr_lang", "en"); applyLanguage();
  });
  document.getElementById("langBnBtn").addEventListener("click", () => {
    state.lang = "bn"; localStorage.setItem("sr_lang", "bn"); applyLanguage();
  });
}

// ---------- Location ----------
function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

async function reverseGeocodeLabel(lat, lng) {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
    const data = await res.json();
    const label = data.city || data.locality || data.principalSubdivision || "Your location";
    document.getElementById("locLabel").textContent = label;
  } catch (e) {
    document.getElementById("locLabel").textContent = t("locationSet");
  }
}

// ---------- Prayer times ----------
async function fetchTimings(lat, lng) {
  const now = new Date();
  const dateStr = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
  const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=${CALC_METHOD}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.data;
}

function renderList(timings) {
  const list = document.getElementById("prayerList");
  list.innerHTML = "";
  const next = getNextPrayer(timings);

  PRAYER_ORDER.forEach(name => {
    const hhmm = timings[name].slice(0, 5);
    const row = document.createElement("div");
    row.className = "row" + (next && next.name === name ? " active" : "");
    row.innerHTML = `
      <div class="name-wrap"><span class="dot"></span><span class="name">${prayerLabel(name)}</span></div>
      <div class="time">${fmt12(hhmm)}</div>
    `;
    list.appendChild(row);
  });
}

function getNextPrayer(timings) {
  const now = new Date();
  for (const name of PRAYER_ORDER) {
    const time = parseTimeToday(timings[name].slice(0, 5));
    if (time > now) return { name, time };
  }
  const time = parseTimeToday(timings["Fajr"].slice(0, 5));
  time.setDate(time.getDate() + 1);
  return { name: "Fajr", time, tomorrow: true };
}

function startCountdown(timings) {
  state.timers.forEach(clearInterval);
  state.timers = [];

  function tick() {
    const next = getNextPrayer(timings);
    const now = new Date();
    let diff = Math.max(0, next.time - now);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    document.getElementById("nextName").textContent =
      prayerLabel(next.name) + (next.tomorrow ? " " + t("tomorrow") : "");
    document.getElementById("countdown").innerHTML =
      `${pad(h)}:${pad(m)}:${pad(s)}<span class="lbl">${t("remaining")}</span>`;
    document.getElementById("nextAt").textContent =
      t("at") + " " + next.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (diff <= 0) {
      renderList(timings);
      maybeNotify(next.name);
    }
  }
  tick();
  const id = setInterval(tick, 1000);
  state.timers.push(id);
}

// ---------- Notifications ----------
function maybeNotify(prayerName) {
  if (Notification.permission === "granted") {
    new Notification("Salah Reminder", {
      body: `It's time for ${prayerName}.`,
      icon: "icon-192.png",
    });
  }
}

function setupNotifyBanner() {
  const banner = document.getElementById("notifyBanner");
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    banner.classList.add("visible");
  }
  document.getElementById("enableNotifyBtn").addEventListener("click", async () => {
    const perm = await Notification.requestPermission();
    if (perm === "granted") banner.classList.remove("visible");
  });
}

// ---------- Dates ----------
function renderDates(data) {
  const g = data.date.readable;
  const hijri = `${data.date.hijri.day} ${data.date.hijri.month.en} ${data.date.hijri.year} AH`;
  document.getElementById("gregDate").textContent = g;
  document.getElementById("hijriDate").textContent = hijri;
  state.hijri = data.date.hijri;
}

// ---------- Ramadan countdown ----------
async function computeRamadanCountdown() {
  if (!state.hijri) return;
  const currentHijriMonth = parseInt(state.hijri.month.number, 10);
  const currentHijriYear = parseInt(state.hijri.year, 10);
  const targetYear = currentHijriMonth >= 9 ? currentHijriYear + 1 : currentHijriYear;

  try {
    const res = await fetch(`https://api.aladhan.com/v1/hToG?date=01-09-${targetYear}`);
    const data = await res.json();
    const g = data.data.gregorian;
    const ramadanDate = new Date(`${g.year}-${g.month.number}-${g.day}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((ramadanDate - today) / (1000 * 60 * 60 * 24));
    state.ramadanDays = diffDays;
    state.ramadanYear = g.year;
    renderRamadanCard();
  } catch (e) { /* silently skip */ }
}

function renderRamadanCard() {
  const card = document.getElementById("ramadanCard");
  const txt = document.getElementById("ramadanText");
  if (state.ramadanDays === undefined) return;
  card.classList.add("visible");
  if (state.ramadanDays <= 0) {
    txt.innerHTML = t("ramadanToday");
  } else if (state.ramadanDays === 1) {
    txt.innerHTML = t("ramadanSoon");
  } else {
    txt.innerHTML = t("ramadanUpcoming")
      .replace("{days}", state.ramadanDays)
      .replace("{year}", state.ramadanYear);
  }
}

// ---------- Qibla ----------
function bearingToKaaba(lat, lng) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const phi1 = toRad(lat), phi2 = toRad(KAABA.lat);
  const dLambda = toRad(KAABA.lng - lng);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  let brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

function setupQibla(lat, lng) {
  const qDeg = bearingToKaaba(lat, lng);
  document.getElementById("qiblaDeg").textContent = Math.round(qDeg) + "° from North";
  const needle = document.getElementById("needle");

  let heading = 0;
  function updateNeedle() {
    needle.style.transform = `translateX(-50%) rotate(${qDeg - heading}deg)`;
  }
  updateNeedle();

  if (window.DeviceOrientationEvent) {
    const attach = () => {
      window.addEventListener("deviceorientationabsolute", handleOrientation, true);
      window.addEventListener("deviceorientation", handleOrientation, true);
    };
    function handleOrientation(e) {
      if (e.absolute === false && e.webkitCompassHeading === undefined) return;
      heading = e.webkitCompassHeading !== undefined ? e.webkitCompassHeading : (360 - e.alpha);
      updateNeedle();
      document.getElementById("qiblaNote").textContent = t("qiblaAligned");
    }
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      document.getElementById("qiblaNote").textContent = t("qiblaTapEnable");
      document.querySelector(".compass-wrap").addEventListener("click", async () => {
        try {
          const perm = await DeviceOrientationEvent.requestPermission();
          if (perm === "granted") attach();
        } catch (e) {}
      }, { once: true });
    } else {
      attach();
    }
  } else {
    document.getElementById("qiblaNote").textContent = t("qiblaUnsupported");
  }
}

// ---------- Tasbih ----------
function setupTasbih() {
  const dial = document.getElementById("tasbihDial");
  const countEl = document.getElementById("tasbihCount");
  const ofEl = document.getElementById("tasbihOf");
  const resetBtn = document.getElementById("tasbihReset");
  const chips = document.querySelectorAll(".tasbih-chip");

  function render() {
    countEl.textContent = state.tasbihCount;
    ofEl.textContent = "/ " + state.tasbihTarget;
  }
  render();

  dial.addEventListener("click", () => {
    state.tasbihCount++;
    if (state.tasbihCount >= state.tasbihTarget && navigator.vibrate) {
      navigator.vibrate([40, 30, 40]);
    } else if (navigator.vibrate) {
      navigator.vibrate(12);
    }
    if (state.tasbihCount > state.tasbihTarget) state.tasbihCount = 0;
    localStorage.setItem("sr_tasbih_count", state.tasbihCount);
    render();
  });

  resetBtn.addEventListener("click", () => {
    state.tasbihCount = 0;
    localStorage.setItem("sr_tasbih_count", 0);
    render();
  });

  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      chips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      state.tasbihTarget = parseInt(chip.dataset.target, 10);
      state.tasbihCount = 0;
      localStorage.setItem("sr_tasbih_target", state.tasbihTarget);
      localStorage.setItem("sr_tasbih_count", 0);
      render();
    });
  });
}

// ---------- Tabs ----------
function setupTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      document.getElementById("timesView").style.display = tab === "times" ? "block" : "none";
      document.getElementById("qiblaView").classList.toggle("visible", tab === "qibla");
      document.getElementById("tasbihView").classList.toggle("visible", tab === "tasbih");
    });
  });
}

// ---------- Init ----------
async function init() {
  setupTabs();
  setupNotifyBanner();
  setupLangToggle();
  setupTasbih();
  applyLanguage();

  try {
    const coords = await getLocation();
    state.coords = coords;
    reverseGeocodeLabel(coords.lat, coords.lng);

    const data = await fetchTimings(coords.lat, coords.lng);
    state.timings = data.timings;
    state.dateInfo = data.date;

    renderDates(data);
    renderList(data.timings);
    startCountdown(data.timings);
    setupQibla(coords.lat, coords.lng);
    computeRamadanCountdown();
  } catch (err) {
    document.getElementById("locLabel").textContent = t("locationNeeded");
    document.getElementById("nextName").textContent = t("enableLocation");
    document.getElementById("countdown").innerHTML = `--:--:--<span class="lbl">${t("remaining")}</span>`;
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

init();

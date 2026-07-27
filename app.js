// ---- Salah Reminder app logic ----

const PRAYER_ORDER = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const KAABA = { lat: 21.4225, lng: 39.8262 };
const CALC_METHOD = 1; // University of Islamic Sciences, Karachi (common for South Asia)

let state = {
  coords: null,
  timings: null,
  dateInfo: null,
  timers: [],
};

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
    document.getElementById("locLabel").textContent = "Location set";
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
  const now = new Date();
  const next = getNextPrayer(timings);

  PRAYER_ORDER.forEach(name => {
    const hhmm = timings[name].slice(0, 5);
    const row = document.createElement("div");
    row.className = "row" + (next && next.name === name ? " active" : "");
    row.innerHTML = `
      <div class="name-wrap"><span class="dot"></span><span class="name">${name}</span></div>
      <div class="time">${fmt12(hhmm)}</div>
    `;
    list.appendChild(row);
  });
}

function getNextPrayer(timings) {
  const now = new Date();
  for (const name of PRAYER_ORDER) {
    const t = parseTimeToday(timings[name].slice(0, 5));
    if (t > now) return { name, time: t };
  }
  // all passed today -> tomorrow's Fajr
  const t = parseTimeToday(timings["Fajr"].slice(0, 5));
  t.setDate(t.getDate() + 1);
  return { name: "Fajr", time: t, tomorrow: true };
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

    document.getElementById("nextName").textContent = next.name + (next.tomorrow ? " (tomorrow)" : "");
    document.getElementById("countdown").innerHTML =
      `${pad(h)}:${pad(m)}:${pad(s)}<span class="lbl">remaining</span>`;
    document.getElementById("nextAt").textContent =
      "at " + next.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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
      icon: "icons/icon-192.png",
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
      document.getElementById("qiblaNote").textContent = "Line up the needle with the marker — that's the Qibla direction.";
    }
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      document.getElementById("qiblaNote").textContent = "Tap the compass to enable your device's sensor.";
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
    document.getElementById("qiblaNote").textContent = "Your device does not support compass sensors — use the degree value with a separate compass.";
  }
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
    });
  });
}

// ---------- Init ----------
async function init() {
  setupTabs();
  setupNotifyBanner();

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
  } catch (err) {
    document.getElementById("locLabel").textContent = "Location needed";
    document.getElementById("nextName").textContent = "Enable location";
    document.getElementById("countdown").innerHTML = `--:--:--<span class="lbl">remaining</span>`;
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

init();

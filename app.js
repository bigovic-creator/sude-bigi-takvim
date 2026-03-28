import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, push, remove, set }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getStorage, ref as sref, uploadBytes, getDownloadURL, deleteObject }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);
const storage = getStorage(app);


let currentUser = localStorage.getItem("takvim_user") || null;
let viewYear, viewMonth, selectedDate;
let allNotes  = {};
let allEvents = {};
let allPhotos = {};
let counterData = { start: null, end: null };

const now = new Date();
const months = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
                 "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

viewYear  = now.getFullYear();
viewMonth = now.getMonth();


onValue(ref(db, "notes"), snap => {
  allNotes = snap.val() || {};
  renderCalendar();
  if (isModalOpen()) renderModalNotes();
});

onValue(ref(db, "events"), snap => {
  allEvents = snap.val() || {};
  renderCalendar();
  updateCounter();
});

onValue(ref(db, "photos"), snap => {
  allPhotos = snap.val() || {};
  renderCalendar();
  if (isModalOpen()) renderModalPhotos();
});

onValue(ref(db, "counter"), snap => {
  counterData = snap.val() || { start: null, end: null };
  updateCounter();
});


if (currentUser) showCalendar();
else document.getElementById("user-screen").classList.remove("hidden");


window.selectUser = function(u) {
  currentUser = u;
  localStorage.setItem("takvim_user", u);
  showCalendar();
};

window.switchUser = function() {
  document.getElementById("calendar-screen").classList.add("hidden");
  document.getElementById("user-screen").classList.remove("hidden");
};

function showCalendar() {
  document.getElementById("user-screen").classList.add("hidden");
  document.getElementById("calendar-screen").classList.remove("hidden");
  updateBadge();
  renderCalendar();
}

function updateBadge() {
  const badge = document.getElementById("active-badge");
  badge.textContent  = currentUser === "sude" ? "♥ Sude" : "♥ Bigi";
  badge.className    = "active-user-badge badge-" + currentUser;
  const sendBtn = document.getElementById("send-btn");
  if (sendBtn) sendBtn.className = "send-btn send-" + currentUser;
}


window.changeMonth = function(dir) {
  viewMonth += dir;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  if (viewMonth < 0)  { viewMonth = 11; viewYear--; }
  renderCalendar();
};

function renderCalendar() {
  document.getElementById("month-title").textContent = months[viewMonth] + " " + viewYear;
  const grid = document.getElementById("cal-grid");
  grid.innerHTML = "";

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const offset   = firstDay === 0 ? 6 : firstDay - 1;
  const total    = new Date(viewYear, viewMonth + 1, 0).getDate();

  for (let i = 0; i < offset; i++) {
    const el = document.createElement("div");
    el.className = "cal-day empty";
    grid.appendChild(el);
  }

  for (let d = 1; d <= total; d++) {
    const key       = dateKey(viewYear, viewMonth, d);
    const dayNotes  = getNotesForKey(key);
    const eventType = allEvents[key] || null;
    const dayPhotos = getPhotosForKey(key);
    const isToday   = d === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
    const isHeart   = d === 5;

    const el = document.createElement("div");
    let cls = "cal-day";
    if (isToday && !eventType) cls += " today";
    if (isHeart) cls += " heart-day";
    if (eventType === "sinav")    cls += " ev-sinav-day";
    if (eventType === "ayrilik")  cls += " ev-ayrilik-day";
    if (eventType === "kavustay") cls += " ev-kavustay-day";
    el.className = cls;
    el.onclick = () => openModal(d);

    const numEl = document.createElement("div");
    numEl.className = "day-num";
    numEl.textContent = d;
    el.appendChild(numEl);

    if (isHeart && eventType !== "sinav" && eventType !== "ayrilik") {
      const h = document.createElement("div");
      h.className = "heart-corner";
      h.textContent = "♥";
      el.appendChild(h);
    }

    if (eventType === "kavustay") {
      const em = document.createElement("div");
      em.className = "kavustay-emojis";
      em.textContent = "💚💙💛💜🧡❤️";
      el.appendChild(em);
    }

   
    if (dayPhotos.length > 0) {
      const pi = document.createElement("div");
      pi.className = "photo-indicator";
      pi.textContent = "📷" + (dayPhotos.length > 1 ? " " + dayPhotos.length : "");
      el.appendChild(pi);
    }

    if (dayNotes.length > 0) {
      const list = document.createElement("div");
      list.className = "day-notes-list";
      dayNotes.slice(0, 1).forEach(n => {
        const chip = document.createElement("div");
        chip.className = "day-note-chip chip-" + n.user;
        chip.textContent = n.text;
        list.appendChild(chip);
      });
      if (dayNotes.length > 1) {
        const more = document.createElement("div");
        more.className = "day-note-chip chip-more";
        more.textContent = "+" + (dayNotes.length - 1);
        list.appendChild(more);
      }
      el.appendChild(list);
    }

    grid.appendChild(el);
  }
}


window.setDayEvent = async function(type) {
  if (!selectedDate) return;
  const key     = dateKey(viewYear, viewMonth, selectedDate);
  const current = allEvents[key];
  const newType = current === type ? null : type;

  try {
    if (newType === null) {
      await set(ref(db, "events/" + key), null);
     
      if (current === "ayrilik") {
        await set(ref(db, "counter/start"), null);
        await set(ref(db, "counter/end"), null);
      }
      showToast("Etkinlik kaldırıldı");
    } else {
      await set(ref(db, "events/" + key), newType);
      if (newType === "ayrilik") {
        await set(ref(db, "counter/start"), { year: viewYear, month: viewMonth, day: selectedDate, timestamp: Date.now() });
        await set(ref(db, "counter/end"), null);
        showToast("Ayrılık günü işaretlendi 💔");
      } else if (newType === "kavustay") {
        await set(ref(db, "counter/end"), { year: viewYear, month: viewMonth, day: selectedDate, timestamp: Date.now() });
        document.getElementById("kavustay-alert").classList.remove("hidden");
      } else if (newType === "sinav") {
        showToast("Sınav günü işaretlendi 📚");
      }
    }
  } catch(err) { showToast("Hata: " + err.message); }
};


let counterTimer = null;

function updateCounter() {
  const bar   = document.getElementById("counter-bar");
  const valEl = document.getElementById("counter-value");

  const hasAyrilik = Object.values(allEvents).includes("ayrilik");
  if (!hasAyrilik || !counterData.start) {
    bar.classList.add("hidden");
    if (counterTimer) { clearInterval(counterTimer); counterTimer = null; }
    return;
  }

  bar.classList.remove("hidden");

  if (counterData.end) {
    if (counterTimer) { clearInterval(counterTimer); counterTimer = null; }
    const startTs = counterData.start.timestamp;
    const endTs   = counterData.end.timestamp;
    const diff    = endTs - startTs;
    valEl.textContent = formatDiff(diff) + " 💜";
    bar.style.background = "linear-gradient(90deg, #641349, #00a693)";
  } else {
    if (counterTimer) clearInterval(counterTimer);
    counterTimer = setInterval(() => {
      const diff = Date.now() - counterData.start.timestamp;
      valEl.textContent = formatDiff(diff);
      bar.style.background = "#1a1a1a";
    }, 1000);
  }
}

function formatDiff(ms) {
  const totalSec = Math.floor(ms / 1000);
  const days  = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins  = Math.floor((totalSec % 3600) / 60);
  const secs  = totalSec % 60;
  return days + "g " + String(hours).padStart(2,"0") + ":" + String(mins).padStart(2,"0") + ":" + String(secs).padStart(2,"0");
}


window.triggerPhotoUpload = function() {
  document.getElementById("photo-input").click();
};

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("photo-input");
  if (input) {
    input.addEventListener("change", handlePhotoUpload);
  }
});

async function handlePhotoUpload(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  if (!currentUser) { showToast("Önce kim olduğunu seç!"); return; }

  showToast("Yükleniyor...");

  for (const file of files) {
    try {
    
      const base64 = await resizeAndConvert(file);
      const key = dateKey(viewYear, viewMonth, selectedDate);
      await push(ref(db, "photos/" + key), {
        user: currentUser,
        data: base64,
        name: file.name,
        createdAt: Date.now()
      });
    } catch(err) {
      showToast("Hata: " + err.message);
    }
  }

  e.target.value = "";
  showToast("Fotoğraf eklendi ✓");
}

function resizeAndConvert(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 1200;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

window.deletePhoto = async function(fbKey) {
  const key = dateKey(viewYear, viewMonth, selectedDate);
  try {
    await remove(ref(db, "photos/" + key + "/" + fbKey));
    showToast("Fotoğraf silindi");
  } catch(err) { showToast("Silinemedi"); }
};


window.openModal = function(day) {
  selectedDate = day;
  const isHeart = day === 5;
  document.getElementById("modal-date").textContent =
    (isHeart ? "♥ " : "") + day + " " + months[viewMonth] + " " + viewYear;

  renderModalNotes();
  renderModalPhotos();
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("note-input").value = "";
};

function isModalOpen() {
  return !document.getElementById("modal-overlay").classList.contains("hidden");
}

function renderModalNotes() {
  const key      = dateKey(viewYear, viewMonth, selectedDate);
  const dayNotes = getNotesForKey(key);
  const container = document.getElementById("modal-notes");
  container.innerHTML = "";

  if (dayNotes.length === 0) {
    container.innerHTML = '<div class="empty-notes">Henüz not yok 🌸</div>';
    return;
  }

  dayNotes.forEach(n => {
    const el = document.createElement("div");
    el.className = "modal-note note-" + n.user;

    const av = document.createElement("div");
    av.className = "note-avatar avatar-" + n.user;
    av.textContent = n.user === "sude" ? "S" : "B";

    const content = document.createElement("div");
    content.className = "note-content";

    const txt = document.createElement("div");
    txt.className = "note-text";
    txt.textContent = n.text;

    const time = document.createElement("div");
    time.className = "note-time";
    time.textContent = (n.user === "sude" ? "Sude" : "Bigi");
    if (n.createdAt) {
      const d = new Date(n.createdAt);
      time.textContent += " · " + d.toLocaleDateString("tr-TR", { day:"numeric", month:"short" })
        + " " + d.toLocaleTimeString("tr-TR", { hour:"2-digit", minute:"2-digit" });
    }

    content.appendChild(txt);
    content.appendChild(time);

    const del = document.createElement("button");
    del.className = "note-del";
    del.textContent = "×";
    del.onclick = (e) => { e.stopPropagation(); deleteNote(n.firebaseKey); };

    el.appendChild(av);
    el.appendChild(content);
    el.appendChild(del);
    container.appendChild(el);
  });
}

function renderModalPhotos() {
  const key       = dateKey(viewYear, viewMonth, selectedDate);
  const dayPhotos = getPhotosForKey(key);
  const container = document.getElementById("modal-photos");
  container.innerHTML = "";
  if (dayPhotos.length === 0) return;

  dayPhotos.forEach(p => {
    const wrap = document.createElement("div");
    wrap.className = "photo-thumb-wrap";

    const img = document.createElement("img");
    img.className = "photo-thumb";
    img.src = p.data;
    img.onclick = () => openPhotoViewer(p.data);

    const del = document.createElement("button");
    del.className = "photo-del";
    del.textContent = "×";
    del.onclick = (e) => { e.stopPropagation(); deletePhoto(p.firebaseKey); };

    const who = document.createElement("div");
    who.className = "photo-who photo-who-" + p.user;
    who.textContent = p.user === "sude" ? "S" : "B";

    wrap.appendChild(img);
    wrap.appendChild(del);
    wrap.appendChild(who);
    container.appendChild(wrap);
  });
}


window.openPhotoViewer = function(src) {
  const viewer = document.getElementById("photo-viewer");
  document.getElementById("photo-viewer-img").src = src;
  viewer.classList.remove("hidden");
};

window.closePhotoViewer = function() {
  document.getElementById("photo-viewer").classList.add("hidden");
};

window.closeModal = function() {
  document.getElementById("modal-overlay").classList.add("hidden");
};

window.closeModalOnBg = function(e) {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
};


window.saveNote = async function() {
  if (!currentUser) { showToast("Önce kim olduğunu seç!"); return; }
  const ta   = document.getElementById("note-input");
  const text = ta.value.trim();
  if (!text) return;
  const key = dateKey(viewYear, viewMonth, selectedDate);
  try {
    await push(ref(db, "notes/" + key), { user: currentUser, text, createdAt: Date.now() });
    ta.value = "";
    showToast("Kaydedildi ✓");
  } catch(err) { showToast("Hata: " + err.message); }
};

window.deleteNote = async function(fbKey) {
  const key = dateKey(viewYear, viewMonth, selectedDate);
  try { await remove(ref(db, "notes/" + key + "/" + fbKey)); }
  catch(err) { showToast("Silinemedi"); }
};


function dateKey(y, m, d) { return y + "-" + m + "-" + d; }

function getNotesForKey(key) {
  const raw = allNotes[key];
  if (!raw) return [];
  return Object.entries(raw).map(([k, v]) => ({ ...v, firebaseKey: k }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

function getPhotosForKey(key) {
  const raw = allPhotos[key];
  if (!raw) return [];
  return Object.entries(raw).map(([k, v]) => ({ ...v, firebaseKey: k }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
  setTimeout(() => t.classList.add("hidden"), 2600);
}

document.getElementById("note-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveNote(); }
});

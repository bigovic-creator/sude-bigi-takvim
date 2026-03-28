import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, push, remove, set, get }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentUser = localStorage.getItem("takvim_user") || null;
let viewYear, viewMonth, selectedDate;
let allNotes = {};
let allEvents = {};
let counterInterval = null;

const now = new Date();
const months = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
                 "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

viewYear = now.getFullYear();
viewMonth = now.getMonth();

const notesRef = ref(db, "notes");
onValue(notesRef, (snapshot) => {
  allNotes = snapshot.val() || {};
  renderCalendar();
  if (!document.getElementById("modal-overlay").classList.contains("hidden")) {
    renderModalNotes();
  }
});

const eventsRef = ref(db, "events");
onValue(eventsRef, (snapshot) => {
  allEvents = snapshot.val() || {};
  renderCalendar();
  updateCounter();
});

if (currentUser) {
  showCalendar();
} else {
  document.getElementById("user-screen").classList.remove("hidden");
}

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
  if (currentUser === "sude") {
    badge.textContent = "♥ Sude";
    badge.className = "active-user-badge badge-sude";
  } else {
    badge.textContent = "♥ Bigi";
    badge.className = "active-user-badge badge-bigi";
  }
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
    const key      = dateKey(viewYear, viewMonth, d);
    const dayNotes = getNotesForKey(key);
    const eventType = allEvents[key] || null;
    const isToday  = d === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
    const isHeart  = d === 5;

    const el = document.createElement("div");
    let cls = "cal-day";
    if (isToday && !eventType) cls += " today";
    if (isHeart) cls += " heart-day";
    if (eventType === "sinav") cls += " ev-sinav-day";
    if (eventType === "ayrilik") cls += " ev-ayrilik-day";
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
      em.textContent = "💜💙🩵💚💛🧡❤️🩷";
      el.appendChild(em);
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
        more.textContent = "+" + (dayNotes.length - 1) + " daha";
        list.appendChild(more);
      }
      el.appendChild(list);
    }

    grid.appendChild(el);
  }
}

window.setDayEvent = async function(type) {
  if (!selectedDate) return;
  const key = dateKey(viewYear, viewMonth, selectedDate);
  const current = allEvents[key];

  const newType = current === type ? null : type;

  try {
    if (newType === null) {
      await set(ref(db, "events/" + key), null);
      showToast("Etkinlik kaldırıldı");
    } else {
      await set(ref(db, "events/" + key), type);

      if (type === "ayrilik") {
      
        await set(ref(db, "counter/start"), { year: viewYear, month: viewMonth, day: selectedDate });
        await set(ref(db, "counter/end"), null);
        showToast("Ayrılık günü işaretlendi 💔");
      } else if (type === "kavustay") {
        
        await set(ref(db, "counter/end"), { year: viewYear, month: viewMonth, day: selectedDate });
        showToast("Kavuştay günü işaretlendi 💜💙");
      } else if (type === "sinav") {
        showToast("Sınav günü işaretlendi 📚");
      }
    }
  } catch(err) {
    showToast("Hata: " + err.message);
  }
};


let counterData = { start: null, end: null };

const counterRef = ref(db, "counter");
onValue(counterRef, (snapshot) => {
  counterData = snapshot.val() || { start: null, end: null };
  updateCounter();
});

function updateCounter() {
  const bar = document.getElementById("counter-bar");
  const valEl = document.getElementById("counter-value");

  if (!counterData.start) {
    bar.classList.add("hidden");
    return;
  }

  bar.classList.remove("hidden");

  const startDate = new Date(counterData.start.year, counterData.start.month, counterData.start.day);

  if (counterData.end) {
   
    const endDate = new Date(counterData.end.year, counterData.end.month, counterData.end.day);
    const days = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
    valEl.textContent = days + " gün 💜";
    bar.style.background = "linear-gradient(90deg, #641349, #00a693)";
  } else {
   
    const today = new Date();
    today.setHours(0,0,0,0);
    const days = Math.round((today - startDate) / (1000 * 60 * 60 * 24));
    valEl.textContent = days + " gün";
    bar.style.background = "#1a1a1a";
  }
}


window.openModal = function(day) {
  selectedDate = day;
  const isHeart = day === 5;
  document.getElementById("modal-date").textContent =
    (isHeart ? "♥ " : "") + day + " " + months[viewMonth] + " " + viewYear;

  renderModalNotes();
  document.getElementById("modal-overlay").classList.remove("hidden");
  const ta = document.getElementById("note-input");
  ta.value = "";
  setTimeout(() => ta.focus(), 300);
};

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
    time.textContent = n.user === "sude" ? "Sude" : "Bigi";
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
    await push(ref(db, "notes/" + key), {
      user: currentUser,
      text: text,
      createdAt: Date.now()
    });
    ta.value = "";
    showToast("Kaydedildi ✓");
  } catch (err) {
    showToast("Hata: " + err.message);
  }
};


window.deleteNote = async function(fbKey) {
  const key = dateKey(viewYear, viewMonth, selectedDate);
  try {
    await remove(ref(db, "notes/" + key + "/" + fbKey));
  } catch (err) {
    showToast("Silinemedi: " + err.message);
  }
};


function dateKey(y, m, d) {
  return y + "-" + m + "-" + d;
}

function getNotesForKey(key) {
  const raw = allNotes[key];
  if (!raw) return [];
  return Object.entries(raw).map(([fbKey, val]) => ({ ...val, firebaseKey: fbKey }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  t.classList.add("show");
  setTimeout(() => { t.classList.remove("show"); }, 2200);
  setTimeout(() => { t.classList.add("hidden"); }, 2600);
}

document.getElementById("note-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    saveNote();
  }
});

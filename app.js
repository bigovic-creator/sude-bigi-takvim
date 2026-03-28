import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, push, remove, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ─── FIREBASE AYARLARI ────────────────────────────────────────────
// firebase.js dosyasındaki config'i buraya yapıştır
// ya da firebase.js dosyasını doldur
import { firebaseConfig } from "./firebase-config.js";
// ──────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ─── STATE ────────────────────────────────────────────────────────
let currentUser = localStorage.getItem("takvim_user") || null;
let viewYear, viewMonth, selectedDate;
let allNotes = {};

const now = new Date();
const months = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
                 "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

// ─── INIT ─────────────────────────────────────────────────────────
viewYear = now.getFullYear();
viewMonth = now.getMonth();

// Firebase'den notları dinle (gerçek zamanlı)
const notesRef = ref(db, "notes");
onValue(notesRef, (snapshot) => {
  allNotes = snapshot.val() || {};
  renderCalendar();
  // Modal açıksa güncelle
  if (!document.getElementById("modal-overlay").classList.contains("hidden")) {
    renderModalNotes();
  }
});

// Kullanıcı daha önce seçildiyse direkt takvime git
if (currentUser) {
  showCalendar();
} else {
  document.getElementById("user-screen").classList.remove("hidden");
}

// ─── KULLANICI SEÇİMİ ─────────────────────────────────────────────
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
    document.querySelector(".note-textarea").style.borderColor = "";
  } else {
    badge.textContent = "♥ Bigi";
    badge.className = "active-user-badge badge-bigi";
  }
  const sendBtn = document.getElementById("send-btn");
  if (sendBtn) {
    sendBtn.className = "send-btn send-" + currentUser;
  }
}

// ─── TAKVİM RENDER ────────────────────────────────────────────────
window.changeMonth = function(dir) {
  viewMonth += dir;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  if (viewMonth < 0)  { viewMonth = 11; viewYear--; }
  renderCalendar();
};

function renderCalendar() {
  document.getElementById("month-title").textContent =
    months[viewMonth] + " " + viewYear;

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
    const isToday  = d === now.getDate() &&
                     viewMonth === now.getMonth() &&
                     viewYear  === now.getFullYear();
    const isHeart  = d === 5;

    const el = document.createElement("div");
    el.className = "cal-day" +
      (isToday ? " today" : "") +
      (isHeart ? " heart-day" : "");
    el.onclick = () => openModal(d);

    const numEl = document.createElement("div");
    numEl.className = "day-num";
    numEl.textContent = d;
    el.appendChild(numEl);

    if (isHeart) {
      const h = document.createElement("div");
      h.className = "heart-corner";
      h.textContent = "♥";
      el.appendChild(h);
    }

    if (dayNotes.length > 0) {
      const list = document.createElement("div");
      list.className = "day-notes-list";
      const show = dayNotes.slice(0, 2);
      show.forEach(n => {
        const chip = document.createElement("div");
        chip.className = "day-note-chip chip-" + n.user;
        chip.textContent = n.text;
        list.appendChild(chip);
      });
      if (dayNotes.length > 2) {
        const more = document.createElement("div");
        more.className = "day-note-chip chip-more";
        more.textContent = "+" + (dayNotes.length - 2) + " daha";
        list.appendChild(more);
      }
      el.appendChild(list);
    }

    grid.appendChild(el);
  }
}

// ─── MODAL ────────────────────────────────────────────────────────
window.openModal = function(day) {
  selectedDate = day;
  const isHeart = day === 5;
  document.getElementById("modal-date").textContent =
    (isHeart ? "♥ " : "") + day + " " + months[viewMonth] + " " + viewYear;

  renderModalNotes();

  const overlay = document.getElementById("modal-overlay");
  overlay.classList.remove("hidden");

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

// ─── NOT KAYDET ───────────────────────────────────────────────────
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

// ─── NOT SİL ──────────────────────────────────────────────────────
window.deleteNote = async function(fbKey) {
  const key = dateKey(viewYear, viewMonth, selectedDate);
  try {
    await remove(ref(db, "notes/" + key + "/" + fbKey));
  } catch (err) {
    showToast("Silinemedi: " + err.message);
  }
};

// ─── YARDIMCI ─────────────────────────────────────────────────────
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

// Enter ile gönder (Shift+Enter yeni satır)
document.getElementById("note-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    saveNote();
  }
});

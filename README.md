# 💕 Bizim Takvim

Sude ve Bigi'nin özel paylaşımlı takvimi.  
Her iki telefondan girilir, notlar gerçek zamanlı senkronize olur.

---

## 🚀 Kurulum

### 1. Firebase Projesi Oluştur

1. [console.firebase.google.com](https://console.firebase.google.com) adresine git
2. **"Add project"** → proje adı ver (örn: `sude-bigi-takvim`) → oluştur
3. Sol menüden **"Realtime Database"** → **"Create database"**
4. Konum: `europe-west1` seç → **"Start in test mode"** → Enable

### 2. Firebase Config'i Ekle

1. Firebase Console → ⚙️ Project Settings → **"Your apps"** → `</>` (Web) butonuna tıkla
2. Uygulama adı ver → Register app
3. Çıkan `firebaseConfig` objesini kopyala
4. `firebase-config.js` dosyasını aç ve değerleri yapıştır:

```js
export const firebaseConfig = {
  apiKey: "ABC123...",
  authDomain: "proje-adın.firebaseapp.com",
  databaseURL: "https://proje-adın-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "proje-adın",
  storageBucket: "proje-adın.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc"
};
```

### 3. Database Kurallarını Ayarla

Firebase Console → Realtime Database → **Rules** sekmesi → şunu yapıştır:

```json
{
  "rules": {
    "notes": {
      ".read": true,
      ".write": true
    }
  }
}
```

**Publish** butonuna bas.

### 4. GitHub'a Yükle

```bash
git init
git add .
git commit -m "ilk commit 💕"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADIN/sude-bigi-takvim.git
git push -u origin main
```

### 5. GitHub Pages ile Yayınla (Ücretsiz!)

1. GitHub repo → **Settings** → **Pages**
2. Source: `Deploy from a branch`
3. Branch: `main` / `/ (root)` → **Save**
4. Birkaç dakika sonra `https://KULLANICI_ADIN.github.io/sude-bigi-takvim` adresine gir

---

## 📱 iPhone'a Ana Ekrana Ekle

1. Safari ile siteyi aç
2. Alt menüden **Paylaş** (kutu+ok simgesi) → **"Ana Ekrana Ekle"**
3. Uygulama gibi açılır!

---

## 📁 Dosya Yapısı

```
sude-bigi-takvim/
├── index.html          → Ana sayfa
├── style.css           → Tasarım
├── app.js              → Uygulama mantığı + Firebase
├── firebase-config.js  → 🔧 SADECE BU DOSYAYI DOLDUR
└── README.md           → Bu dosya
```

---

## ✨ Özellikler

- Her ayın 5'i ❤️ ile işaretlidir
- Sude (pembe) ve Bigi (mavi) notları renk kodludur
- Değişiklikler gerçek zamanlı senkronize olur
- iPhone Safari'de ana ekrana eklenebilir
- Notlar asla kaybolmaz (Firebase'de saklanır)

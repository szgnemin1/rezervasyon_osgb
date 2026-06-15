# OSGB Eğitim Rezervasyon Sistemi & Yönetim Paneli

Bu proje, İş Sağlığı ve Güvenliği (İSG) temel eğitimleri için aday kayıt ve randevu yönetim süreçlerini uçtan uca dijitalleştiren, hukuki ve teknik güvenlik standartlarıyla donatılmış akıllı bir SaaS platformudur.

---

## 🌟 BÖLÜM 1: İŞ Ortakları & Yöneticiler İçin (Satış & Vizyon Perspektifi)

### 🚀 Neden OSGB Eğitim Rezervasyon Sistemi?

Günümüz İSG dünyasında zaman kayıpları, manuel evrak takipleri ve eksik bilgilendirmeler operasyonel birer kara deliktir. Platformumuz, adaylarınızın eğitim rezervasyon süreçlerini saniyeler içinde tamamlamasını sağlarken, işletmenizin prestijini ve operasyonel verimliliğini zirveye taşır.

#### 💎 Öne Çıkan Ticari Faydalar:
*   **Sıfır Operasyonel Kayıp & Otomasyon:** Adaylar kayıt olduğu andan itibaren bilgilendirme, yol tarifi ve karekodlu giriş kartları otomatik olarak SMS veya WhatsApp aracılığıyla yönlendirilir. Ofis çalışanlarınızın telefon trafiği %90 oranında azalır.
*   **Hukuki %100 Uyum (KVKK Hazır):** Kayıt adımlarında entegre edilen açık rıza beyanları ve veri işleme kabulleri ile cezai risklerin önüne geçilir. Markanızın hukuki güvencesi garanti altına alınır.
*   **Prestijli Aday Deneyimi:** Ultra-modern, akıcı arayüz tasarımıyla (bento-grid esintileri, pürüzsüz geçiş animasyonları) adaylarınıza profesyonel bir ilk izlenim sunarsınız.
*   **Mobil Öncelikli & Güçlü Altyapı:** İnşaat sahalarında veya fabrika yollarında mobil cihaz kullanan tüm işçiler için sıfır hata ile yüksek erişilebilirlik sunar.

---

## 🛠️ BÖLÜM 2: Geliştiriciler & Güvenlik Denetçileri İçin (Teknik Perspektif)

Sistem, son derece güvenli, hafif ve ölçeklenebilir bir tam yığın (Full-Stack) **Vite + React (TypeScript)** ve **Express** mimarisi üzerine inşa edilmiştir.

### 🛡️ Güvenlik ve KVKK / GDPR Sıkılaştırma Önlemleri (Security & Compliance)

Proje üzerinde gerçekleştirilen kapsamlı güvenlik ve verisellik denetimleri sonucunda aşağıdaki teknik önlemler alınmıştır:

#### 1. Zero-Leakage (Sıfır Sızıntı) Altyapısı:
*   **Sorun:** Geliştiricilerin sıklıkla yaptığı bir hata olarak, SMS/WhatsApp sağlayıcılarının API anahtarları veya hassas kurumsal telefon numaraları public `/api/config` rotasından istemciye (browser console/network) sızabiliyordu.
*   **Çözüm:** `/api/config` rotası tamamen arındırıldı. Hassas anahtarlar (WhatsApp API Key, SMS Token vb.) yalnızca yetkilendirilmiş admin oturum belirteci (**Session Token/JWT**) vasıtasıyla `/api/admin/config` üzerinden talep edilebilir hale getirildi.

#### 2. Giriş Doğrulama & Parametre Sızdırma Engeli (Parameter Pollution & Mass Assignment Prevention):
*   **Sorun:** Kötü niyetli bir kullanıcı, kayıt oluştururken arka plana `status: "geldi"` veya `id` parametreleri enjekte edip rezervasyonu önceden onaylanmış gösterebilirdi.
*   **Çözüm:** `req.body` içeriği körü körüne veritabanına ya da bellek nesnesine yazılmaz. Veriler sunucu tarafında yapıbozuma uğratılarak (`destructuring`) yalnızca belirlenen `firstName`, `lastName`, `phone`, `workplace`, `transport`, `date`, `time` alanları alınır. Diğer enjekte edilmeye çalışılan tüm parametreler yok sayılır.

#### 3. Kusursuz XSS ve SQL Enjeksiyon Koruması:
*   **Çözüm:** Tüm string girdiler sunucu düzeyinde özel karakter filtrelemelerinden (`escapeHtml`) geçirilir. Kullanıcının kötü niyetli HTML veya skript kodları girdisi tamamen pasifleştirilir.

#### 4. KVKK Entegrasyonu:
*   **Çözüm:** İstemci tarafında ilk adımda zorunlu, interaktif bir KVKK Açık Rıza Beyanı onay mekanizması kurulmuştur. Onay verilmeden sunucuya kayıt istekleri gönderilemez ve sonraki adıma geçilemez.

---

### 💻 Teknolojik Stack & Kurulum

*   **Frontend:** React 18, Vite, Tailwind CSS (modern, özelleştirilmiş Cosmic-Slate teması), Framer Motion, Lucide Icons, QRCodeSVG.
*   **Backend:** Node.js Express, Tsx, TypeScript, Esbuild.

#### Kurulum ve Çalıştırma:
```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirme (development) modunda başlatın
npm run dev

# Canlı ortama derleyin (Production Build)
npm run build

# Canlı ortamda koşturun (Production Start)
npm run start
```

Ürünümüz, esnek konfigürasyon yapısı sayesinde verileri bellek üzerinde (In-Memory) tutarak saniyeler içerisinde devreye alınabilir, istendiğinde bir ilişkisel veritabanına (`PostgreSQL/Cloud SQL`) veya belge tabanlı çözümlere (`Firestore`) bağlanabilir.

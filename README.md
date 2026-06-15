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

## 🖥️ BÖLÜM 3: Sunucuya Kurulum ve Canlıya Alma Rehberi (Production Deployment Guide)

Bu rehber, projenin Linux tabanlı bir sunucuya (örn: Ubuntu 22.04 LTS) güvenli ve yüksek performanslı şekilde kurulması için gereken tüm adımları içerir.

### 📂 1. Sunucu Ön Gereksinimleri
Sunucunuzda aşağıdaki araçların kurulu olduğundan emin olun:
- **Node.js** (v18 veya üzeri önerilir)
- **Nginx** (Ters proxy ve SSL yönetimi için)
- **PM2** (Node.js uygulamasını arka planda kesintisiz çalıştırmak için)
- **Git** (Kodu çekebilmek için)

```bash
# Ubuntu için gerekli güncellemeler ve Node.js kurulumu
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git

# PM2 kurulumu
sudo npm install pm2 -g
```

---

### 📥 2. Kodun Çekilmesi ve Bağımlılıkların Yüklenmesi
Projeyi sunucunuzda `/var/www/` dizini altına veya tercih ettiğiniz bir klasöre klonlayın.

```bash
cd /var/www
git clone <depo_adresi> osgb-rezervasyon
cd osgb-rezervasyon

# npm paketlerinin kurulması
npm install
```

---

### ⚙️ 3. Çevre Değişkenlerinin Yapılandırılması (.env)
Kök dizinde bir `.env` dosyası oluşturun ve gerekli değişkenleri girin.

```env
PORT=3000
NODE_ENV=production
# Varsa diğer API Key ve veritabanı değişkenlerinizi buraya ekleyin
```

---

### 🏗️ 4. Üretim Derlemesi (Production Build)
Uygulamayı canlıda çalıştırmadan önce derleme (build) işleminden geçirmemiz gerekir. Bu komut istemci (React) tarafını optimize eder ve sunucu (Express) kodunu tek bir bağımlılıksız dosyaya derler:

```bash
npm run build
```
Bu komut sonucunda sunucu dosyalarınız ve statik kodlarınız `/dist` klasörüne derlenecektir.

---

### 🔄 5. PM2 ile Uygulamanın Başlatılması
Sunucunun çökmesi durumunda uygulamanın otomatik yeniden başlaması ve arka planda güvenle çalışması için **PM2** proses yöneticisini kullanıyoruz:

```bash
# Uygulamayı PM2 ile başlatın
pm2 start dist/server.cjs --name "osgb-rezervasyon"

# Sistemin her yeniden açılışında PM2'nun otomatik başlamasını sağlayın
pm2 startup
pm2 save
```

PM2 Durum Kontrolü ve Log İzleme:
```bash
# Çalışan uygulamaları gösterir
pm2 status

# Canlı logları akıtır (Hata ayıklama için çok önemlidir)
pm2 logs "osgb-rezervasyon"
```

---

### 🛡️ 6. Nginx ve Ters Proxy (Reverse Proxy) Yapılandırması
Kullanıcıların uygulamanıza standart `http (80)` veya `https (443)` portu üzerinden erişmesini sağlamak için Nginx yapılandırması yapıyoruz:

```bash
# Yeni Nginx yapılandırma dosyası oluşturun
sudo nano /etc/nginx/sites-available/osgb-rezervasyon
```

Aşağıdaki yapılandırmayı kendinize göre güncelleyerek yapıştırın:
```nginx
server {
    listen 80;
    server_name randeve.isortaginiz.com; # Kendi domaininizi yazın

    location / {
        proxy_pass http://localhost:3000; # Uygulamanın çalıştığı port
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # IP ve Protokol aktarımı (Logların doğru tutulması ve güvenlik için)
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Dosyayı kaydedip çıkın (`CTRL+X`, `Y`, `Enter`). Ardından konfigürasyonu etkinleştirin:
```bash
# Sembiyotik link oluşturarak aktif edin
sudo ln -s /etc/nginx/sites-available/osgb-rezervasyon /etc/nginx/sites-enabled/

# Nginx konfigurasyon testi
sudo nginx -t

# Nginx servisini yeniden başlatın
sudo systemctl restart nginx
```

---

### 🔒 7. SSL Kurulumu (Güvenli Https & KVKK Gereksinimi)
KVKK gereği iletilen tüm ad, soyad ve iletişim verilerinin uçtan uca şifrelenmesi zorunludur. Ücretsiz ve otomatik yenilenen **Let's Encrypt SSL** sertifikasını saniyeler içinde kurabilirsiniz:

```bash
sudo apt install certbot python3-certbot-nginx -y

# Domaininiz için SSL sertifikasını alın (Nginx yönlendirmelerini kendisi otomatik yapar)
sudo certbot --nginx -d randeve.isortaginiz.com
```

---

### 🐳 Alternatif: Docker Mimarisi İle Canlıya Alma
Eğer sunucunuzda Docker kuruluysa, aşağıdaki basit komutlar ile uygulamayı saniyeler içinde ayağa kaldırabilirsiniz:

```bash
# Docker imajını derleyin
docker build -t osgb-rezervasyon .

# Container'ı arka planda (detached) 3000 portuna yönlendirerek başlatın
docker run -d -p 3000:3000 --name osgb-container-app osgb-rezervasyon
```

---

Ürünümüz, esnek konfigürasyon yapısı sayesinde verileri bellek üzerinde (In-Memory) tutarak saniyeler içerisinde devreye alınabilir, istendiğinde bir ilişkisel veritabanına (`PostgreSQL/Cloud SQL`) veya belge tabanlı çözümlere (`Firestore`) bağlanabilir.

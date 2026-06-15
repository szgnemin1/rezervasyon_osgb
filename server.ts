import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import axios from 'axios';
import pino from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

// API Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, error: 'Too many requests, please try again later.' },
  validate: { trustProxy: false, xForwardedForHeader: false, forwardedHeader: false }
});

const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,  // limit each IP to 10 login requests per hour
  message: { success: false, error: 'Too many login attempts, please try again later.' },
  validate: { trustProxy: false, xForwardedForHeader: false, forwardedHeader: false }
});

app.use('/api', apiLimiter);

// In-memory admin session token to prevent hardcoded token vulnerability
const ADMIN_SESSION_TOKEN = crypto.randomBytes(32).toString('hex');

const STORE_DIR = path.join(process.cwd(), '.store');
if (!fs.existsSync(STORE_DIR)) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
}
const DATA_FILE = path.join(STORE_DIR, 'data.json');

const defaultData = {
  adminPassword: 'admin123',
  reservations: [],
  config: {
    insaatTimes: ['08:30', '09:30', '10:30', '11:30'],
    fabrikaTimes: ['13:30', '14:30', '15:30', '16:30'],
    hizmetTimes: ['13:30', '14:30', '15:30', '16:30'],
    blockedDates: [],
    // Yol tarifi detayları
    otobusTarifi: 'Kordonboyu Mahallesi, Hürriyet Caddesi durağında indikten sonra 100 metre geriye yürüyerek sol koldaki OSGB Akademi binasına ulaşabilirsiniz. (M4 Metro Yakacık durağına 5 dk yürüme mesafesindedir)',
    konumLink: 'https://maps.google.com/?q=OSGB+Akademi+Kartal+Istanbul',
    sahsiAracTarifi: 'E-5 Karayolu Kartal köprüsünden sahil yönüne inişte Hürriyet caddesi sapağından giriniz. Binamızın önünde ücretsiz misafir otoparkımız mevcuttur.',
    // Modüller
    whatsappEnabled: true,
    whatsappNumber: '+905551234567',
    whatsappTemplate: 'Merhaba [AD] [SOYAD]. OSGB Akademi eğitim rezervasyonunuz başarıyla oluşturuldu. Kodunuz: [KOD], Tarih: [TARIH], Saat: [SAAT]. Lütfen zamanında hazır bulununuz.',
    whatsappProvider: 'MetaCloudAPI',
    whatsappApiKey: '',
    whatsappNumberID: '',
    whatsappGatewayUrl: 'https://bursa-rezervasyon-sms.loca.lt',
    smsEnabled: false,
    smsProvider: 'Netgsm',
    smsApiKey: 'MOCK_API_KEY_123456_OSGB',
    smsSender: 'OSGBAKADEMI',
    smsTemplate: 'OSGB Akademi: Sayin [AD] [SOYAD], [TARIH] gunu saat [SAAT] randevunuz onaylanmistir. Kodunuz: [KOD]',
    membershipEnabled: false
  }
};

let inMemoryData = defaultData;
try {
  if (fs.existsSync(DATA_FILE)) {
    const fileData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    inMemoryData = {
      adminPassword: fileData.adminPassword || 'admin123',
      reservations: fileData.reservations || [],
      config: {
        ...defaultData.config,
        ...(fileData.config || {})
      }
    };
  }
} catch(e) {
  console.error("Error reading file", e);
}

function writeDataAsync() {
  fs.writeFile(DATA_FILE, JSON.stringify(inMemoryData, null, 2), (err) => {
    if(err) console.error("Error writing file", err);
  });
}

if (!fs.existsSync(DATA_FILE)) writeDataAsync();

// ----------------- WHATSAPP WEB BAİLEYS SETUP -----------------
let sock: any = null;
let currentQR: string | null = null;
let waConnectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
let waStatusMessage: string = 'Bağlantı bulunmuyor';
let waUserInfo: any = null;

async function initWhatsAppWeb() {
  try {
    waConnectionState = 'connecting';
    waStatusMessage = 'WhatsApp Web başlatılıyor...';
    
    const pkg = await import('@whiskeysockets/baileys');
    const makeWASocket = pkg.default || (pkg as any).default;
    const { useMultiFileAuthState, DisconnectReason } = pkg;
    
    const { state, saveCreds } = await useMultiFileAuthState(path.join(STORE_DIR, 'wa-session'));
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: pino({ level: 'silent' }),
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        currentQR = qr;
        waConnectionState = 'disconnected';
        waStatusMessage = 'QR kod tarama bekliyor';
      }
      
      if (connection === 'close') {
        currentQR = null;
        const lastDisconnectError = lastDisconnect?.error as any;
        const statusCode = lastDisconnectError?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log('WhatsApp connection closed due to:', lastDisconnectError, ', reconnecting:', shouldReconnect);
        waConnectionState = 'disconnected';
        waStatusMessage = 'Bağlantı koptu. Tarama veya ağ hatası.';
        waUserInfo = null;
        
        if (shouldReconnect) {
          setTimeout(() => {
            initWhatsAppWeb();
          }, 5000);
        } else {
          waStatusMessage = 'Oturum kapatıldı, temizleniyor...';
          const sessionPath = path.join(STORE_DIR, 'wa-session');
          setTimeout(() => {
            try {
              if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
              }
            } catch (e) {
              console.error('Session wipe failed', e);
            }
            initWhatsAppWeb();
          }, 2000);
        }
      } else if (connection === 'open') {
        currentQR = null;
        waConnectionState = 'connected';
        waStatusMessage = 'Bağlantı başarılı';
        waUserInfo = sock.user;
        console.log('WhatsApp connection is open now! User:', sock.user);
      }
    });
  } catch (err: any) {
    console.error('Failed to init WhatsApp Web:', err);
    waConnectionState = 'disconnected';
    waStatusMessage = 'Yükleme hatası: ' + err.message;
  }
}

// Otomatik Resmi SMS gönderen fonksiyon
async function sendRealSMS(phoneNumber: string, message: string, config: any) {
  const provider = config.smsProvider || 'Netgsm';
  const apiKey = config.smsApiKey || '';
  const sender = config.smsSender || 'OSGB';

  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const gsm = cleanPhone.startsWith('90') ? cleanPhone : (cleanPhone.startsWith('0') ? '90' + cleanPhone.substring(1) : '90' + cleanPhone);

  console.log(`[REAL SMS API] Sending via ${provider} to ${gsm} sender ${sender}`);

  if (!apiKey || apiKey === 'MOCK_API_KEY_123456_OSGB' || apiKey === '') {
    console.log(`[REAL SMS API SIMULATION] API key not customized. Simulated SMS payload:`, { provider, sender, gsm, message });
    return { success: true, simulated: true };
  }

  try {
    if (provider === 'Netgsm') {
      let usercode = '';
      let password = '';
      if (apiKey.includes(':')) {
        [usercode, password] = apiKey.split(':');
      } else {
        usercode = 'usercode';
        password = apiKey;
      }

      const response = await axios.get('https://api.netgsm.com.tr/sms/send/get/', {
        params: {
          usercode,
          password,
          gsm,
          message,
          header: sender,
          filter: '0',
          appkey: 'ViteOSGBAkademi'
        },
        timeout: 10000
      });
      console.log(`[NETGSM SUCCESS] Result:`, response.data);
      return { success: true, serverResponse: response.data };

    } else if (provider === 'VatanSms') {
      let api_key = apiKey;
      let api_id = '';
      if (apiKey.includes('|')) {
        [api_key, api_id] = apiKey.split('|');
      }

      const response = await axios.post('https://api.vatansms.net/v1/create-single', {
        api_key,
        api_id,
        sender,
        message,
        phones: [gsm]
      }, {
        timeout: 10000
      });
      console.log(`[VATANSMS SUCCESS] Result:`, response.data);
      return { success: true, serverResponse: response.data };

    } else if (provider === 'Verimor') {
      let username = '';
      let password = '';
      if (apiKey.includes(':')) {
        [username, password] = apiKey.split(':');
      } else {
        username = 'username';
        password = apiKey;
      }

      const response = await axios.post('https://sms.verimor.com.tr/v2/send.json', {
        username,
        password,
        source_addr: sender,
        messages: [
          {
            msg: message,
            dest: gsm
          }
        ]
      }, {
        timeout: 10000
      });
      console.log(`[VERIMOR SUCCESS] Result:`, response.data);
      return { success: true, serverResponse: response.data };
    }
  } catch (error: any) {
    console.error(`[REAL SMS API ERROR] Failed sending via ${provider}:`, error.message);
    return { success: false, error: error.message };
  }

  return { success: false, error: 'Unsupported provider' };
}

// Otomatik Resmi WhatsApp gönderen fonksiyon
async function sendRealWhatsApp(phoneNumber: string, message: string, config: any) {
  const provider = config.whatsappProvider || 'MetaCloudAPI';
  const apiKey = config.whatsappApiKey || '';
  const numberID = config.whatsappNumberID || '';
  const senderNumber = config.whatsappNumber || '';

  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const gsm = cleanPhone.startsWith('90') ? cleanPhone : (cleanPhone.startsWith('0') ? '90' + cleanPhone.substring(1) : '90' + cleanPhone);

  console.log(`[REAL WA API] Sending via ${provider} to ${gsm}`);

  if (provider !== 'Gateway' && provider !== 'WhatsAppWeb' && !apiKey) {
    console.log(`[REAL WHATSAPP API SIMULATION] API key not specified. Simulated WhatsApp payload:`, { provider, gsm, message });
    return { success: true, simulated: true };
  }

  try {
    if (provider === 'WhatsAppWeb') {
      if (waConnectionState !== 'connected' || !sock) {
        console.warn(`[WHATSAPP WEB ERROR] Connection is not open. State: ${waConnectionState}`);
        return { success: false, error: `WhatsApp Web bağlantısı aktif değil. Durum: ${waStatusMessage}` };
      }
      const jid = `${gsm}@s.whatsapp.net`;
      console.log(`[WHATSAPP WEB] Direct sending to ${jid}`);
      const sentMsg = await sock.sendMessage(jid, { text: message });
      console.log(`[WHATSAPP WEB SUCCESS] Message sent successfully. ID: ${sentMsg?.key?.id}`);
      return { success: true, serverResponse: { messageId: sentMsg?.key?.id } };
    } else if (provider === 'Gateway') {
      const gatewayUrl = config.whatsappGatewayUrl || '';
      if (!gatewayUrl) {
        console.log(`[REAL WHATSAPP GATEWAY SIMULATION] No gateway URL provided`);
        return { success: false, error: 'Tünel Gateway URL adresi girilmedi.' };
      }
      const targetUrl = `${gatewayUrl.replace(/\/$/, '')}/send-whatsapp`;
      console.log(`[WHATSAPP GATEWAY] POST-ing to ${targetUrl} payload:`, { phone: gsm, message });
      
      try {
        const response = await axios.post(targetUrl, {
          phone: gsm,
          message: message
        }, {
          headers: { 
            'Content-Type': 'application/json',
            'bypass-tunnel-reminder': 'true'
          },
          timeout: 10000
        });
        console.log(`[WHATSAPP GATEWAY SUCCESS] Response:`, response.data);
        return { success: true, serverResponse: response.data };
      } catch (gatewayErr: any) {
        console.error(`[WHATSAPP GATEWAY DIRECT ERROR] Failed via /send-whatsapp, trying fallback /send-sms:`, gatewayErr.message);
        try {
          const fallbackUrl = `${gatewayUrl.replace(/\/$/, '')}/send-sms`;
          console.log(`[WHATSAPP GATEWAY FALLBACK] Attempting POST-ing to fallback ${fallbackUrl}`);
          const responseFallback = await axios.post(fallbackUrl, {
            phone: gsm,
            message: message
          }, {
            headers: { 
              'Content-Type': 'application/json',
              'bypass-tunnel-reminder': 'true'
            },
            timeout: 10000
          });
          console.log(`[WHATSAPP GATEWAY FALLBACK SUCCESS] Response:`, responseFallback.data);
          return { success: true, serverResponse: responseFallback.data };
        } catch (fbError: any) {
          console.error(`[WHATSAPP GATEWAY FALLBACK ERROR] Failed fallback:`, fbError.message);
          throw gatewayErr; // Re-throw the original error if fallback also fails
        }
      }
    } else if (provider === 'MetaCloudAPI') {
      const numID = numberID || 'me';
      const url = `https://graph.facebook.com/v19.0/${numID}/messages`;
      
      const response = await axios.post(url, {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: gsm,
        type: "text",
        text: {
          preview_url: false,
          body: message
        }
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      console.log(`[META WA SUCCESS]`, response.data);
      return { success: true, serverResponse: response.data };

    } else if (provider === 'Twilio') {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${numberID}/Messages.json`;
      const auth = Buffer.from(`${numberID}:${apiKey}`).toString('base64');
      
      const params = new URLSearchParams();
      params.append('To', `whatsapp:+${gsm}`);
      params.append('From', `whatsapp:${senderNumber || '+14155238886'}`);
      params.append('Body', message);

      const response = await axios.post(url, params.toString(), {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      });
      console.log(`[TWILIO WA SUCCESS]`, response.data);
      return { success: true, serverResponse: response.data };

    } else if (provider === 'Ultramsg') {
      const instID = numberID || 'instanceX';
      const url = `https://api.ultramsg.com/${instID}/messages/chat`;

      const response = await axios.post(url, {
        token: apiKey,
        to: gsm,
        body: message
      }, {
        timeout: 10000
      });
      console.log(`[ULTRAMSG SUCCESS]`, response.data);
      return { success: true, serverResponse: response.data };
    }
  } catch (error: any) {
    console.error(`[REAL WA ERROR] Failed sending via ${provider}:`, error.response?.data || error.message);
    return { success: false, error: error.message };
  }

  return { success: false, error: 'Unsupported WhatsApp Provider' };
}

// ----------------- API ENDPOINTS -----------------
app.get('/api/config', (req, res) => {
  // Return ONLY public/safe config keys to prevent developer oversight leakage of keys or personal numbers (KVKK compliance)
  const c = inMemoryData.config;
  const publicConfig = {
    insaatTimes: c.insaatTimes || [],
    fabrikaTimes: c.fabrikaTimes || [],
    hizmetTimes: c.hizmetTimes || [],
    blockedDates: c.blockedDates || [],
    otobusTarifi: c.otobusTarifi || '',
    konumLink: c.konumLink || '',
    sahsiAracTarifi: c.sahsiAracTarifi || '',
    whatsappEnabled: !!c.whatsappEnabled,
    smsEnabled: !!c.smsEnabled,
    membershipEnabled: !!c.membershipEnabled
  };
  res.json(publicConfig);
});

app.get('/api/admin/config', (req, res) => {
  const token = req.headers.authorization;
  if (token !== ADMIN_SESSION_TOKEN) return res.status(401).json({ error: 'Yetkisiz erişim' });
  
  res.json(inMemoryData.config);
});

// Helper for XSS escaping
function escapeHtml(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

app.post('/api/reservations', (req, res) => {
  const { firstName, lastName, phone, workplace, transport, date, time } = req.body;
  
  // 1. Precise validation of required fields
  if (!firstName || !lastName || !phone || !workplace || !transport || !date || !time) {
    return res.status(400).json({ success: false, error: 'Lütfen tüm zorunlu alanları doldurun.' });
  }

  // 2. Format checks (Defense in Depth)
  const cleanFirstName = escapeHtml(firstName.trim()).substring(0, 50);
  const cleanLastName = escapeHtml(lastName.trim()).substring(0, 50);
  const cleanPhone = phone.replace(/\D/g, '').substring(0, 15);
  
  if (cleanFirstName.length === 0 || cleanLastName.length === 0) {
    return res.status(400).json({ success: false, error: 'Geçersiz Ad veya Soyad girdiniz.' });
  }

  if (cleanPhone.length < 10) {
    return res.status(400).json({ success: false, error: 'Geçersiz telefon numarası.' });
  }

  const allowedWorkplaces = ['insaat', 'fabrika', 'hizmet'];
  const allowedTransports = ['toplu', 'sahsi'];

  if (!allowedWorkplaces.includes(workplace) || !allowedTransports.includes(transport)) {
    return res.status(400).json({ success: false, error: 'Geçersiz çalışma veya ulaşım seçeneği.' });
  }

  // 3. Strict object construction (Defeats status/parameter override injection attacks!)
  const reservationCode = Math.random().toString(36).substring(2, 6).toUpperCase().padStart(4, '0');
  const newRes = { 
    id: Date.now().toString() + Math.random().toString(36).substring(2, 5), 
    reservationCode,
    status: 'bekliyor',
    createdAt: new Date().toISOString(), 
    firstName: cleanFirstName,
    lastName: cleanLastName,
    phone: cleanPhone,
    workplace,
    transport,
    date: escapeHtml(date).substring(0, 20),
    time: escapeHtml(time).substring(0, 10)
  };
  
  inMemoryData.reservations.push(newRes);
  writeDataAsync();

  let smsLog = undefined;
  if (inMemoryData.config.smsEnabled) {
    const provider = inMemoryData.config.smsProvider || 'Netgsm';
    const rawTemplate = inMemoryData.config.smsTemplate || '';
    
    let yolTarifiText = '';
    if (transport === 'toplu') {
      yolTarifiText = inMemoryData.config.otobusTarifi || "Kordonboyu Mahallesi, Hürriyet Caddesi durağında indikten sonra 100 metre geriye yürüyerek sol koldaki OSGB Akademi binasına ulaşabilirsiniz. (M4 Metro Yakacık durağına 5 dk yürüme mesafesindedir)";
    } else {
      yolTarifiText = inMemoryData.config.sahsiAracTarifi || "E-5 Karayolu Kartal köprüsünden sahil yönüne inişte Hürriyet caddesi sapağından giriniz. Binamızın önünde ücretsiz misafir otoparkımız mevcuttur.";
    }
    const konumLink = inMemoryData.config.konumLink || '';

    let message = rawTemplate
      .replace('[AD]', cleanFirstName)
      .replace('[SOYAD]', cleanLastName)
      .replace('[KOD]', reservationCode)
      .replace('[TARIH]', newRes.date)
      .replace('[SAAT]', newRes.time);

    if (rawTemplate.includes('[YOL_TARIFI]')) {
      message = message.replace('[YOL_TARIFI]', yolTarifiText);
    } else {
      const transportEmoji = transport === 'toplu' ? '🚌' : '🚗';
      message += `\n\n${transportEmoji} Yol Tarifi:\n${yolTarifiText}`;
    }

    if (konumLink) {
      if (rawTemplate.includes('[KONUM_LINK]')) {
        message = message.replace('[KONUM_LINK]', konumLink);
      } else {
        message += `\n📍 Konum: ${konumLink}`;
      }
    } else {
      message = message.replace('[KONUM_LINK]', '');
    }

    console.log(`[SMS INTEGRATION] Auto-sending via ${provider} to ${cleanPhone}: "${message}"`);
    smsLog = {
      sent: true,
      provider,
      recipient: cleanPhone,
      message
    };

    sendRealSMS(cleanPhone, message, inMemoryData.config).catch(err => {
      console.error("[SMS AUTO-SEND CRITICAL ERROR]", err);
    });
  }

  let whatsappLog = undefined;
  if (inMemoryData.config.whatsappEnabled) {
    const provider = inMemoryData.config.whatsappProvider || 'MetaCloudAPI';
    const rawTemplate = inMemoryData.config.whatsappTemplate || 'Sayın [AD] [SOYAD], [TARIH] saat [SAAT] tarihindeki OSGB Akademi eğitim rezervasyonunuz onaylanmıştır. Rezervasyon Kodunuz: [KOD]';
    
    let yolTarifiText = '';
    if (transport === 'toplu') {
      yolTarifiText = inMemoryData.config.otobusTarifi || "Kordonboyu Mahallesi, Hürriyet Caddesi durağında indikten sonra 100 metre geriye yürüyerek sol koldaki OSGB Akademi binasına ulaşabilirsiniz. (M4 Metro Yakacık durağına 5 dk yürüme mesafesindedir)";
    } else {
      yolTarifiText = inMemoryData.config.sahsiAracTarifi || "E-5 Karayolu Kartal köprüsünden sahil yönüne inişte Hürriyet caddesi sapağından giriniz. Binamızın önünde ücretsiz misafir otoparkımız mevcuttur.";
    }
    const konumLink = inMemoryData.config.konumLink || '';

    let message = rawTemplate
      .replace('[AD]', cleanFirstName)
      .replace('[SOYAD]', cleanLastName)
      .replace('[KOD]', reservationCode)
      .replace('[TARIH]', newRes.date)
      .replace('[SAAT]', newRes.time);

    if (rawTemplate.includes('[YOL_TARIFI]')) {
      message = message.replace('[YOL_TARIFI]', yolTarifiText);
    } else {
      const transportEmoji = transport === 'toplu' ? '🚌' : '🚗';
      message += `\n\n${transportEmoji} Yol Tarifi:\n${yolTarifiText}`;
    }

    if (konumLink) {
      if (rawTemplate.includes('[KONUM_LINK]')) {
        message = message.replace('[KONUM_LINK]', konumLink);
      } else {
        message += `\n📍 Konum: ${konumLink}`;
      }
    } else {
      message = message.replace('[KONUM_LINK]', '');
    }

    console.log(`[WHATSAPP INTEGRATION] Auto-sending via ${provider} to ${cleanPhone}: "${message}"`);
    whatsappLog = {
      sent: true,
      provider,
      recipient: cleanPhone,
      message
    };

    sendRealWhatsApp(cleanPhone, message, inMemoryData.config).catch(err => {
      console.error("[WHATSAPP AUTO-SEND CRITICAL ERROR]", err);
    });
  }
  
  res.json({ success: true, reservation: newRes, smsLog, whatsappLog });
});

app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== 'string') {
    return res.status(401).json({ success: false, error: 'Hatalı şifre' });
  }
  if (password === inMemoryData.adminPassword) {
    return res.json({ success: true, token: ADMIN_SESSION_TOKEN });
  }
  res.status(401).json({ success: false, error: 'Hatalı şifre' });
});

app.post('/api/admin/password', (req, res) => {
  const token = req.headers.authorization;
  if (token !== ADMIN_SESSION_TOKEN) return res.status(401).json({ error: 'Yetkisiz erişim' });

  const { newPassword } = req.body;
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'Yeni şifre en az 6 karakterli ve güvenli olmalıdır.' });
  }

  inMemoryData.adminPassword = newPassword;
  writeDataAsync();

  res.json({ success: true });
});

app.get('/api/admin/reservations', (req, res) => {
  const token = req.headers.authorization;
  if (token !== ADMIN_SESSION_TOKEN) return res.status(401).json({ error: 'Yetkisiz erişim' });
  
  res.json(inMemoryData.reservations);
});

app.post('/api/admin/config', (req, res) => {
  const token = req.headers.authorization;
  if (token !== ADMIN_SESSION_TOKEN) return res.status(401).json({ error: 'Yetkisiz erişim' });

  inMemoryData.config = { ...inMemoryData.config, ...req.body };
  writeDataAsync();

  res.json({ success: true });
});

app.delete('/api/admin/reservations/:id', (req, res) => {
  const token = req.headers.authorization;
  if (token !== ADMIN_SESSION_TOKEN) return res.status(401).json({ error: 'Yetkisiz erişim' });

  inMemoryData.reservations = inMemoryData.reservations.filter((r: any) => r.id !== req.params.id);
  writeDataAsync();

  res.json({ success: true });
});

app.put('/api/admin/reservations/:id/status', (req, res) => {
  const token = req.headers.authorization;
  if (token !== ADMIN_SESSION_TOKEN) return res.status(401).json({ error: 'Yetkisiz erişim' });
  
  const resIndex = inMemoryData.reservations.findIndex((r: any) => r.id === req.params.id);
  if(resIndex > -1) {
    inMemoryData.reservations[resIndex].status = req.body.status;
    writeDataAsync();
    return res.json({ success: true, reservation: inMemoryData.reservations[resIndex] });
  }
  res.status(404).json({ success: false, error: 'Bulunamadı' });
});

// ----------------- WHATSAPP WEB ENDPOINTS -----------------
app.get('/api/admin/whatsapp-web/status', (req, res) => {
  const token = req.headers.authorization;
  if (token !== ADMIN_SESSION_TOKEN) return res.status(401).json({ error: 'Yetkisiz erişim' });
  
  res.json({
    status: waConnectionState,
    message: waStatusMessage,
    qr: currentQR,
    user: waUserInfo
  });
});

app.post('/api/admin/whatsapp-web/logout', (req, res) => {
  const token = req.headers.authorization;
  if (token !== ADMIN_SESSION_TOKEN) return res.status(401).json({ error: 'Yetkisiz erişim' });
  
  try {
    currentQR = null;
    waConnectionState = 'disconnected';
    waStatusMessage = 'Oturum kapatıldı, temizleniyor...';
    waUserInfo = null;
    
    if (sock) {
      try {
        sock.logout().catch(() => {});
      } catch (e) {}
    }
    
    const sessionPath = path.join(STORE_DIR, 'wa-session');
    setTimeout(() => {
      try {
        if (fs.existsSync(sessionPath)) {
          fs.rmSync(sessionPath, { recursive: true, force: true });
        }
      } catch (e) {
        console.error("Session clean-up error:", e);
      }
      initWhatsAppWeb();
    }, 1500);

    res.json({ success: true, message: 'Oturum kapatılıyor, lütfen bekleyin...' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/whatsapp-web/restart', (req, res) => {
  const token = req.headers.authorization;
  if (token !== ADMIN_SESSION_TOKEN) return res.status(401).json({ error: 'Yetkisiz erişim' });
  
  try {
    if (sock) {
      try { sock.end(undefined); } catch (e) {}
    }
    initWhatsAppWeb();
    res.json({ success: true, message: 'Yeniden başlatılıyor...' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------- VITE MIDDLEWARE -----------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    // Start WhatsApp Web on server boot
    initWhatsAppWeb();
  });
}

startServer();

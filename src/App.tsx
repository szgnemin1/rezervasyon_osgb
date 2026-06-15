import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { tr } from 'date-fns/locale';
import { 
  Check, ChevronRight, ChevronLeft, Calendar, 
  Clock, User, Car, Bus, Factory, 
  Briefcase, CheckCircle2, HardHat, Info,
  Phone, Lock, Trash2, LogOut, Settings, Users, Search, Key, QrCode,
  MapPin, CreditCard, Smartphone, Sparkles, MessageSquare, ExternalLink
} from 'lucide-react';

type WorkplaceType = 'insaat' | 'fabrika' | 'hizmet' | '';
type TransportType = 'arac' | 'toplu' | '';

interface FormData {
  firstName: string;
  lastName: string;
  phone: string;
  workplace: WorkplaceType;
  transport: TransportType;
  date: string;
  time: string;
}

interface AppConfig {
  insaatTimes: string[];
  fabrikaTimes: string[];
  hizmetTimes: string[];
  blockedDates: string[];
  otobusTarifi?: string;
  konumLink?: string;
  sahsiAracTarifi?: string;
  whatsappEnabled?: boolean;
  whatsappProvider?: string;
  whatsappApiKey?: string;
  whatsappNumberID?: string;
  whatsappNumber?: string;
  whatsappGatewayUrl?: string;
  whatsappTemplate?: string;
  smsEnabled?: boolean;
  smsProvider?: string;
  smsApiKey?: string;
  smsSender?: string;
  smsTemplate?: string;
  membershipEnabled?: boolean;
}

const WORKPLACES = [
  { id: 'insaat', label: 'İnşaat', icon: HardHat, desc: 'Şantiye ve inşaat sahası çalışanları' },
  { id: 'fabrika', label: 'Fabrika', icon: Factory, desc: 'Üretim ve fabrika sahası çalışanları' },
  { id: 'hizmet', label: 'Hizmet', icon: Briefcase, desc: 'Ofis ve hizmet sektörü çalışanları' },
] as const;

const TRANSPORTS = [
  { id: 'arac', label: 'Şahsi Araç', icon: Car, desc: 'Kendi aracımla geleceğim' },
  { id: 'toplu', label: 'Toplu Taşıma / Yaya', icon: Bus, desc: 'Toplu taşıma veya yaya olarak geleceğim' },
] as const;

const getUpcomingDays = (blockedDates: string[] = []) => {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 1; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    // Hafta sonlarını (Cumartesi: 6, Pazar: 0) atla
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      // Adjust to local date string yyyy-mm-dd
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d.valueOf() - tzOffset)).toISOString().split('T')[0];
      if (!blockedDates.includes(localISOTime)) {
        days.push(d);
      }
    }
  }
  return days.slice(0, 10); // Yaklaşan 10 iş günü
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return new Intl.DateTimeFormat('tr-TR', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  }).format(new Date(dateStr));
};

interface ScannerErrorBoundaryProps {
  children: React.ReactNode;
}
interface ScannerErrorBoundaryState {
  hasError: boolean;
  errorMsg: string;
}

class ScannerErrorBoundary extends React.Component<ScannerErrorBoundaryProps, ScannerErrorBoundaryState> {
  state: ScannerErrorBoundaryState = { hasError: false, errorMsg: '' };
  props: ScannerErrorBoundaryProps;

  constructor(props: ScannerErrorBoundaryProps) {
    super(props);
    this.props = props;
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorMsg: error.message || 'Kamera başlatılamadı.' };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-slate-900 border border-slate-700 rounded-xl">
          <p className="text-red-400 font-bold mb-2">Kamera Açılamadı</p>
          <p className="text-sm text-slate-400">{this.state.errorMsg}</p>
          <p className="text-xs text-slate-500 mt-4">Cihazınızda kamera bulunmuyor veya tarayıcı izin vermiyor olabilir.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [view, setView] = useState<'client' | 'admin-login' | 'admin-panel'>('client');
  const [adminToken, setAdminToken] = useState<string>('');
  const [waWebStatus, setWaWebStatus] = useState<any>(null);
  
  // Client States
  const [step, setStep] = useState(1);
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [reservationCode, setReservationCode] = useState('');
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    phone: '',
    workplace: '',
    transport: '',
    date: '',
    time: ''
  });
  const [config, setConfig] = useState<AppConfig>({
    insaatTimes: ['08:30', '09:30', '10:30', '11:30'],
    fabrikaTimes: ['13:30', '14:30', '15:30', '16:30'],
    hizmetTimes: ['13:30', '14:30', '15:30', '16:30'],
    blockedDates: [],
    otobusTarifi: '',
    konumLink: '',
    sahsiAracTarifi: '',
    whatsappEnabled: true,
    whatsappProvider: 'MetaCloudAPI',
    whatsappApiKey: '',
    whatsappNumberID: '',
    whatsappNumber: '',
    whatsappGatewayUrl: '',
    whatsappTemplate: '',
    smsEnabled: false,
    smsProvider: 'Netgsm',
    smsApiKey: '',
    smsSender: 'OSGBAKADEMI',
    smsTemplate: '',
    membershipEnabled: false
  });

  // Client dynamic states for integration simulation
  const [smsResult, setSmsResult] = useState<any>(null);
  const [whatsappResult, setWhatsappResult] = useState<any>(null);
  const [paymentName, setPaymentName] = useState('');
  const [paymentCard, setPaymentCard] = useState('');
  const [paymentExpiry, setPaymentExpiry] = useState('');
  const [paymentCvv, setPaymentCvv] = useState('');

  // Admin States
  const [adminPassword, setAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [reservations, setReservations] = useState<any[]>([]);
  const [activeAdminTab, setActiveAdminTab] = useState<'list' | 'search' | 'settings' | 'password' | 'modules'>('list');

  useEffect(() => {
    if (view === 'admin-panel' && searchCode.trim().length === 4) {
      const code = searchCode.trim().toUpperCase();
      const res = reservations.find(r => r.reservationCode === code);
      if (res && res.status !== 'geldi') {
        updateReservationStatus(res.id, 'geldi');
      }
    }
  }, [searchCode, reservations, view]);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error("Config fetch error:", err));
  }, []);

  useEffect(() => {
    if (!adminToken || view !== 'admin-panel') return;
    
    const fetchStatus = () => {
      fetch('/api/admin/whatsapp-web/status', {
        headers: { 'Authorization': adminToken }
      })
        .then(res => res.json())
        .then(data => setWaWebStatus(data))
        .catch(err => console.error("WhatsApp Web status fetch error:", err));
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [adminToken, view]);

  // Compute Days
  const availableDays = useMemo(() => getUpcomingDays(config.blockedDates), [config.blockedDates]);

  const availableTimes = useMemo(() => {
    if (!formData.workplace) return [];
    if (formData.workplace === 'insaat') return config.insaatTimes || [];
    if (formData.workplace === 'fabrika') return config.fabrikaTimes || [];
    if (formData.workplace === 'hizmet') return config.hizmetTimes || [];
    return [];
  }, [formData.workplace, config]);

  const isStep4Valid = useMemo(() => {
    if (!config.membershipEnabled) return true;
    const cleanCard = paymentCard.replace(/\s/g, '');
    return paymentName.trim().length > 3 && cleanCard.length === 16 && paymentExpiry.length === 5 && paymentCvv.length === 3;
  }, [config.membershipEnabled, paymentName, paymentCard, paymentExpiry, paymentCvv]);

  const handleNext = () => {
    if (step === 4) {
      if (!isStep4Valid) {
        alert('Lütfen üyelik ödeme adımlarını eksiksiz tamamlayın.');
        return;
      }
      // Submit form
      fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      }).then(res => res.json()).then(data => {
        if(data.success) {
          setReservationCode(data.reservation.reservationCode);
          if (data.smsLog) {
            setSmsResult(data.smsLog);
          } else {
            setSmsResult(null);
          }
          if (data.whatsappLog) {
            setWhatsappResult(data.whatsappLog);
          } else {
            setWhatsappResult(null);
          }
          setStep(5);
        }
      });
    } else {
      setStep((s) => Math.min(s + 1, 5));
    }
  };
  const handleAdminWhatsAppNotify = (r: any) => {
    const rawTemplate = config.whatsappTemplate || 'Sayın [AD] [SOYAD], [TARIH] saat [SAAT] tarihindeki OSGB Akademi eğitim rezervasyonunuz onaylanmıştır. Rezervasyon Kodunuz: [KOD]';
    
    let yolTarifiText = '';
    const transportType = r.transport || 'sahsi';
    if (transportType === 'toplu') {
      yolTarifiText = config.otobusTarifi || "Kordonboyu Mahallesi, Hürriyet Caddesi durağında indikten sonra 100 metre geriye yürüyerek sol koldaki OSGB Akademi binasına ulaşabilirsiniz. (M4 Metro Yakacık durağına 5 dk yürüme mesafesindedir)";
    } else {
      yolTarifiText = config.sahsiAracTarifi || "E-5 Karayolu Kartal köprüsünden sahil yönüne inişte Hürriyet caddesi sapağından giriniz. Binamızın önünde ücretsiz misafir otoparkımız mevcuttur.";
    }
    const konumLink = config.konumLink || '';

    let message = rawTemplate
      .replace('[AD]', r.firstName || '')
      .replace('[SOYAD]', r.lastName || '')
      .replace('[KOD]', r.reservationCode || '')
      .replace('[TARIH]', r.date || '')
      .replace('[SAAT]', r.time || '');

    if (rawTemplate.includes('[YOL_TARIFI]')) {
      message = message.replace('[YOL_TARIFI]', yolTarifiText);
    } else {
      const transportEmoji = transportType === 'toplu' ? '🚌' : '🚗';
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

    const encodedText = encodeURIComponent(message);
    const num = r.phone ? r.phone.replace(/\D/g, '') : '';
    const formattedNum = num.startsWith('90') ? num : (num.startsWith('0') ? '90' + num.substring(1) : '90' + num);
    const url = `https://api.whatsapp.com/send?phone=${formattedNum}&text=${encodedText}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const isStep1Valid = formData.firstName.trim().length > 0 && formData.lastName.trim().length > 0 && formData.phone.trim().length >= 10 && kvkkAccepted;
  const isStep2Valid = formData.workplace !== '' && formData.transport !== '';
  const isStep3Valid = formData.date !== '' && formData.time !== '';

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword })
    });
    const data = await res.json();
    if (data.success) {
      setAdminToken(data.token);
      setView('admin-panel');
      fetchReservations(data.token);
      fetchAdminConfig(data.token);
    } else {
      alert('Hatalı şifre');
    }
  };

  const handleWaWebLogout = async () => {
    if (!confirm('WhatsApp Web oturumunu kapatmak istediğinize emin misiniz?')) return;
    try {
      const res = await fetch('/api/admin/whatsapp-web/logout', {
        method: 'POST',
        headers: { 'Authorization': adminToken }
      });
      const data = await res.json();
      if (data.success) {
        alert('Oturum sonlandırma işlemi başlatıldı. Lütfen yeni QR kodun hazırlanmasını bekleyin.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleWaWebRestart = async () => {
    try {
      const res = await fetch('/api/admin/whatsapp-web/restart', {
        method: 'POST',
        headers: { 'Authorization': adminToken }
      });
      const data = await res.json();
      if (data.success) {
        alert('Bağlantı yeniden başlatılıyor...');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchReservations = async (token: string) => {
    const res = await fetch('/api/admin/reservations', {
      headers: { 'Authorization': token }
    });
    const data = await res.json();
    setReservations(data);
  };

  const fetchAdminConfig = async (token: string) => {
    try {
      const res = await fetch('/api/admin/config', {
        headers: { 'Authorization': token }
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error("fetchAdminConfig error:", err);
    }
  };

  const deleteReservation = async (id: string) => {
    if(!confirm('Emin misiniz?')) return;
    await fetch(`/api/admin/reservations/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': adminToken }
    });
    fetchReservations(adminToken);
  };

  const updateReservationStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/reservations/${id}/status`, {
      method: 'PUT',
      headers: { 
        'Authorization': adminToken,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ status })
    });
    fetchReservations(adminToken);
  };

  const saveConfig = async () => {
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 
        'Authorization': adminToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });
    alert('Ayarlar kaydedildi!');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newAdminPassword) return;
    const res = await fetch('/api/admin/password', {
       method: 'POST',
       headers: {'Content-Type': 'application/json', 'Authorization': adminToken},
       body: JSON.stringify({newPassword: newAdminPassword})
    });
    if (res.ok) {
       alert('Şifre başarıyla değiştirildi!');
       setNewAdminPassword('');
    } else {
       alert('Şifre değiştirilemedi.');
    }
  };

  const handleBlockAllWeekends = () => {
    const newDates = [];
    const year = new Date().getFullYear();
    // Block weekends for current and next year
    for(let y = year; y <= year + 1; y++) {
      for (let m = 0; m < 12; m++) {
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        for(let d = 1; d <= daysInMonth; d++) {
          const date = new Date(y, m, d);
          if (date.getDay() === 0 || date.getDay() === 6) { 
            const tzOffset = date.getTimezoneOffset() * 60000;
            const dateStr = (new Date(date.valueOf() - tzOffset)).toISOString().split('T')[0];
            newDates.push(dateStr);
          }
        }
      }
    }
    const merged = Array.from(new Set([...config.blockedDates, ...newDates])).sort();
    setConfig({...config, blockedDates: merged});
  };

  const handleAddBulkDates = () => {
    if (!bulkStartDate || !bulkEndDate) return;
    const start = new Date(bulkStartDate);
    const end = new Date(bulkEndDate);
    if (end < start) {
      alert("Bitiş tarihi başlangıç tarihinden küçük olamaz.");
      return;
    }
    const newDates = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const tzOffset = d.getTimezoneOffset() * 60000;
      const dateStr = (new Date(d.valueOf() - tzOffset)).toISOString().split('T')[0];
      newDates.push(dateStr);
    }
    const merged = Array.from(new Set([...config.blockedDates, ...newDates])).sort();
    setConfig({...config, blockedDates: merged});
    setBulkStartDate('');
    setBulkEndDate('');
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-1 sm:space-x-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center">
          <div 
            className={`w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-colors ${
              step === i ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' 
              : step > i ? 'bg-emerald-500 text-white' 
              : 'bg-white/10 text-slate-500'
            }`}
          >
            {step > i ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : i}
          </div>
          {i < 4 && (
            <div className={`w-3.5 sm:w-10 h-0.5 sm:h-1 mx-1 sm:mx-2 rounded-full ${step > i ? 'bg-emerald-500' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  );

  if (view === 'admin-login') {
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-100 flex items-center justify-center relative overflow-hidden font-sans">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="max-w-md w-full bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 z-10">
          <div className="text-center mb-8">
            <Lock className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Yönetici Girişi</h2>
          </div>
          <form onSubmit={handleAdminLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 ml-1 mb-2">Şifre</label>
              <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="block w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-indigo-500/50" />
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setView('client')} className="flex-1 py-3 border border-white/10 rounded-xl text-slate-300 bg-white/5 hover:bg-white/10 font-bold">İptal</button>
              <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/30 hover:bg-indigo-700">Giriş</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'admin-panel') {
    const searchedReservation = searchCode.trim() 
      ? reservations.find(r => r.reservationCode === searchCode.trim().toUpperCase()) 
      : null;

    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-100 p-8 relative font-sans">
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Settings className="text-indigo-400"/>
              OSGB Akademi - Yönetim
            </h1>
            <button onClick={() => { setAdminToken(''); setView('client'); }} className="flex items-center px-4 py-2 bg-white/5 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors">
              <LogOut className="w-4 h-4 mr-2" />
              Çıkış
            </button>
          </div>

          <div className="flex flex-wrap gap-4 mb-8">
            <button onClick={() => setActiveAdminTab('list')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 ${activeAdminTab === 'list' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
              <Users className="w-5 h-5"/> Rezervasyonlar
            </button>
            <button onClick={() => setActiveAdminTab('search')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 ${activeAdminTab === 'search' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
              <Search className="w-5 h-5"/> Kod Sorgula
            </button>
            <button onClick={() => setActiveAdminTab('settings')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 ${activeAdminTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
              <Clock className="w-5 h-5"/> Gün ve Saat Ayarları
            </button>
            <button onClick={() => setActiveAdminTab('password')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 ${activeAdminTab === 'password' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
              <Key className="w-5 h-5"/> Şifre İşlemleri
            </button>
            <button onClick={() => setActiveAdminTab('modules')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 ${activeAdminTab === 'modules' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
              <Sparkles className="w-5 h-5"/> Modüller & Yol Tarifi
            </button>
          </div>

          {activeAdminTab === 'list' && (
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden overflow-x-auto whitespace-nowrap">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50">
                  <tr>
                    <th className="p-4 font-bold text-slate-400 uppercase">Kayıt No</th>
                    <th className="p-4 font-bold text-slate-400 uppercase">Durum</th>
                    <th className="p-4 font-bold text-slate-400 uppercase">Ad Soyad</th>
                    <th className="p-4 font-bold text-slate-400 uppercase">Telefon</th>
                    <th className="p-4 font-bold text-slate-400 uppercase">Tür / Ulaşım</th>
                    <th className="p-4 font-bold text-slate-400 uppercase">Tarih - Saat</th>
                    <th className="p-4 font-bold text-slate-400 uppercase text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {reservations.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">Henüz rezervasyon yok.</td></tr>}
                  {reservations.map(r => (
                    <tr key={r.id} className="hover:bg-white-[0.02]">
                      <td className="p-4 font-mono text-indigo-400">{r.reservationCode || '-'}</td>
                      <td className="p-4">
                        <select 
                          value={r.status || 'bekliyor'} 
                          onChange={(e) => updateReservationStatus(r.id, e.target.value)}
                          className={`text-xs font-bold px-2 py-1 rounded-md outline-none border focus:ring-2 ${
                            r.status === 'geldi' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            r.status === 'gelmedi' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          <option value="bekliyor" className="bg-slate-800 text-slate-100">Bekliyor</option>
                          <option value="geldi" className="bg-slate-800 text-emerald-400">Geldi</option>
                          <option value="gelmedi" className="bg-slate-800 text-red-400">Gelmedi</option>
                        </select>
                      </td>
                      <td className="p-4 font-medium">{r.firstName} {r.lastName}</td>
                      <td className="p-4 text-slate-400">{r.phone}</td>
                      <td className="p-4 text-slate-400 capitalize">{r.workplace} / {r.transport}</td>
                      <td className="p-4"><span className="text-indigo-400 font-bold">{r.date}</span> {r.time}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 justify-end">
                          <button 
                            onClick={() => handleAdminWhatsAppNotify(r)} 
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            title="WhatsApp İle Bildir"
                          >
                            <MessageSquare className="w-3.5 h-3.5"/>
                            WhatsApp Bildir
                          </button>
                          <button onClick={() => deleteReservation(r.id)} className="p-2 text-slate-500 hover:text-red-400 bg-white/5 rounded-lg border border-white/5 cursor-pointer" title="Sil"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeAdminTab === 'search' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-white/5 border border-white/10 p-8 rounded-2xl text-center">
                <h3 className="text-xl font-bold mb-6">Rezervasyon Kodu ile Sorgulama</h3>
                <div className="flex gap-4 justify-center items-center flex-col">
                  <div className="flex w-full max-w-sm gap-2 relative">
                    <input 
                      type="text" 
                      value={searchCode}
                      onChange={e => setSearchCode(e.target.value)}
                      placeholder="XXXX"
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-4 pl-6 pr-14 font-mono text-lg text-slate-100 focus:outline-none focus:border-indigo-500/50 uppercase text-center"
                    />
                    <button 
                      onClick={() => setIsScanning(!isScanning)}
                      className={`absolute right-2 top-2 bottom-2 aspect-square rounded-lg flex items-center justify-center transition-colors ${isScanning ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
                      title="Kamera ile Tara"
                    >
                      <QrCode className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {isScanning && (
                    <div className="w-full max-w-sm mt-4 overflow-hidden rounded-xl border border-white/20 bg-black aspect-square relative">
                      <ScannerErrorBoundary>
                        <Scanner 
                          onScan={(result) => {
                            if (result && result.length > 0) {
                              setSearchCode(result[0].rawValue);
                              setIsScanning(false);
                            }
                          }}
                          onError={(error) => {
                            console.error('Scan Error:', error);
                            alert('Kamera açılamadı. Lütfen erişim izinlerini kontrol edin.');
                            setIsScanning(false);
                          }}
                          allowMultiple={false}
                          components={{ finder: true }}
                        />
                      </ScannerErrorBoundary>
                      <button 
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-1.5 rounded-lg font-bold text-sm shadow-xl"
                        onClick={() => setIsScanning(false)}
                      >
                        Kamerayı Kapat
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {searchCode.trim().length > 0 && !searchedReservation && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl text-center font-medium">
                  Bu kodla eşleşen bir rezervasyon bulunamadı.
                </div>
              )}

              {searchedReservation && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-8 rounded-2xl">
                  <div className="flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-center text-white mb-6">Geçerli Rezervasyon!</h3>
                  <dl className="grid grid-cols-1 gap-y-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-emerald-500/70">Durum</dt>
                      <dd className="mt-1">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${
                          searchedReservation.status === 'geldi' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                          searchedReservation.status === 'gelmedi' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                          'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {searchedReservation.status === 'geldi' ? 'Eğitime Katıldı' : 
                          searchedReservation.status === 'gelmedi' ? 'Katılmadı' : 
                          'Bekliyor'}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-emerald-500/70">Ad Soyad</dt>
                      <dd className="mt-1 text-xl text-emerald-200 font-medium">{searchedReservation.firstName} {searchedReservation.lastName}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-emerald-500/70">Tarih - Saat</dt>
                      <dd className="mt-1 text-xl text-emerald-200 font-medium">{formatDate(searchedReservation.date)} - {searchedReservation.time}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-emerald-500/70">Telefon</dt>
                      <dd className="mt-1 text-lg text-emerald-100/70 font-medium">{searchedReservation.phone}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-emerald-500/70">İşyeri / Ulaşım</dt>
                      <dd className="mt-1 text-lg text-emerald-100/70 capitalize font-medium">{searchedReservation.workplace} / {searchedReservation.transport}</dd>
                    </div>
                  </dl>
                  <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center border-t border-emerald-500/20 pt-6">
                    <button onClick={() => handleAdminWhatsAppNotify(searchedReservation)} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer transition-colors">
                      <MessageSquare className="w-5 h-5" /> WhatsApp ile Bildir / Gönder
                    </button>
                    <button onClick={() => updateReservationStatus(searchedReservation.id, 'geldi')} className="px-6 py-3 bg-emerald-600/20 text-emerald-400 rounded-xl hover:bg-emerald-600/30 font-bold border border-emerald-500/20 transition-colors">
                      Eğitime "Katıldı" Olarak İşaretle
                    </button>
                    <button onClick={() => updateReservationStatus(searchedReservation.id, 'gelmedi')} className="px-6 py-3 bg-red-600/20 text-red-400 rounded-xl hover:bg-red-600/30 font-bold border border-red-500/20 transition-colors">
                      Eğitime "Katılmadı" Olarak İşaretle
                    </button>
                  </div>
                  <div className="mt-4 flex justify-center">
                    <button onClick={() => { deleteReservation(searchedReservation.id); setSearchCode(''); }} className="text-sm px-4 py-2 text-slate-400 hover:text-red-400 flex items-center font-bold">
                      <Trash2 className="w-4 h-4 mr-2"/> Kaydı Sil
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeAdminTab === 'password' && (
            <div className="max-w-xl mx-auto bg-white/5 border border-white/10 p-8 rounded-2xl">
              <h3 className="text-xl font-bold mb-6 text-indigo-400">Yönetici Şifresini Değiştir</h3>
              <form onSubmit={handleChangePassword} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 ml-1 mb-2">Yeni Şifre</label>
                  <input 
                    type="password" 
                    value={newAdminPassword} 
                    onChange={e => setNewAdminPassword(e.target.value)} 
                    className="block w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-indigo-500/50" 
                    placeholder="Yeni şifrenizi girin..."
                  />
                </div>
                <button type="submit" disabled={!newAdminPassword} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 disabled:opacity-50">
                  Şifreyi Güncelle
                </button>
              </form>
            </div>
          )}

          {activeAdminTab === 'settings' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                  <h3 className="font-bold mb-4 text-indigo-400">İnşaat (Sabah)</h3>
                  <textarea 
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl p-4 text-sm text-slate-100" 
                    rows={4}
                    value={config.insaatTimes.join(', ')}
                    onChange={e => setConfig({...config, insaatTimes: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}
                    placeholder="08:30, 09:30... (Virgül ile ayırın)"
                  />
                </div>
                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                  <h3 className="font-bold mb-4 text-emerald-400">Fabrika (Öğle)</h3>
                  <textarea 
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl p-4 text-sm text-slate-100" 
                    rows={4}
                    value={config.fabrikaTimes.join(', ')}
                    onChange={e => setConfig({...config, fabrikaTimes: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}
                    placeholder="13:30, 14:30... (Virgül ile ayırın)"
                  />
                </div>
                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                  <h3 className="font-bold mb-4 text-amber-400">Hizmet (Öğle)</h3>
                  <textarea 
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl p-4 text-sm text-slate-100" 
                    rows={4}
                    value={config.hizmetTimes.join(', ')}
                    onChange={e => setConfig({...config, hizmetTimes: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}
                    placeholder="13:30, 14:30... (Virgül ile ayırın)"
                  />
                </div>
                
                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl md:col-span-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-white/10 pb-4">
                    <h3 className="text-lg font-bold text-red-400">Kapalı (Engellenmiş) Tarihler</h3>
                    <button onClick={handleBlockAllWeekends} className="mt-4 sm:mt-0 px-4 py-2 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-lg text-sm font-bold transition-colors border border-amber-500/20 shadow-lg">
                      Bu Yılki Tüm Hafta Sonlarını Kapat
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                      <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5 mb-6">
                        <p className="text-sm text-slate-400 mb-3 font-medium">Toplu Tarih Kapatma</p>
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 uppercase font-bold">Başlangıç:</span>
                            <input 
                              type="date"
                              value={bulkStartDate}
                              className="bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500/50 min-w-[140px]"
                              onChange={(e) => setBulkStartDate(e.target.value)}
                            />
                          </div>
                          <span className="text-slate-600">-</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 uppercase font-bold">Bitiş:</span>
                            <input 
                              type="date"
                              value={bulkEndDate}
                              className="bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500/50 min-w-[140px]"
                              onChange={(e) => setBulkEndDate(e.target.value)}
                            />
                          </div>
                          <button onClick={handleAddBulkDates} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-indigo-600/30">
                            Aralığı Ekle
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-900/30 p-4 rounded-xl border border-white/5 h-64 overflow-y-auto">
                        <p className="text-sm text-slate-400 mb-3 font-medium sticky top-0 bg-slate-900/30 backdrop-blur pb-2">Engellenmiş Tarihler ({config.blockedDates.length})</p>
                        {config.blockedDates.length === 0 ? (
                          <p className="text-sm text-slate-500">Engellenmiş tarih yok.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {config.blockedDates.map(d => (
                              <span key={d} className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-sm font-medium">
                                {d}
                                <button onClick={() => setConfig({...config, blockedDates: config.blockedDates.filter(x => x !== d)})} className="hover:text-red-300">
                                  &times;
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-center items-start">
                      <div className="bg-white rounded-xl p-4 shadow-xl">
                        <style>{`
                          .rdp-root {
                            --rdp-accent-color: #ef4444; /* red-500 */
                            --rdp-background-color: #fee2e2; /* red-100 */
                            color: #0f172a;
                          }
                          .rdp-day_selected {
                            background-color: var(--rdp-accent-color) !important;
                            color: white !important;
                            font-weight: bold;
                          }
                        `}</style>
                        <DayPicker 
                          mode="multiple"
                          locale={tr}
                          weekStartsOn={1}
                          selected={config.blockedDates.map(d => {
                            const parts = d.split('-');
                            return new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
                          })}
                          onSelect={(selectedDates) => {
                            if (!selectedDates) {
                              setConfig({...config, blockedDates: []});
                              return;
                            }
                            const strDates = selectedDates.map(d => {
                               const tzOffset = d.getTimezoneOffset() * 60000;
                               return (new Date(d.valueOf() - tzOffset)).toISOString().split('T')[0];
                            });
                            setConfig({...config, blockedDates: strDates.sort()});
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={saveConfig} className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600">Ayarları Kaydet</button>
            </div>
          )}

          {activeAdminTab === 'modules' && (
            <div className="space-y-6 text-left">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* YOL TARİFİ AYARLARI */}
                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <MapPin className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-bold text-lg text-white">Yol Tarifi & Konum Ayarları</h3>
                  </div>
                  
                  <div>
                    <label className="block text-xs uppercase text-slate-400 font-bold mb-2">Google Harita / Konum Linki</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" 
                      value={config.konumLink || ''}
                      onChange={e => setConfig({...config, konumLink: e.target.value})}
                      placeholder="https://maps.app.goo.gl/..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase text-slate-400 font-bold mb-2">Toplu Taşıma / Otobüs Tarifi</label>
                    <textarea 
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" 
                      rows={3}
                      value={config.otobusTarifi || ''}
                      onChange={e => setConfig({...config, otobusTarifi: e.target.value})}
                      placeholder="Kullanıcı toplu taşımayı seçtiğinde gösterilecek tarif..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase text-slate-400 font-bold mb-2">Şahsi Araç Tarifi</label>
                    <textarea 
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" 
                      rows={3}
                      value={config.sahsiAracTarifi || ''}
                      onChange={e => setConfig({...config, sahsiAracTarifi: e.target.value})}
                      placeholder="Kullanıcı şahsi aracı seçtiğinde gösterilecek tarif..."
                    />
                  </div>
                </div>

                {/* MODÜLLER VE ENTEGRASYONLAR */}
                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-6">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <h3 className="font-bold text-lg text-white">Sistem Entegrasyonları</h3>
                  </div>

                  {/* ÜCRETLİ ÜYELİK */}
                  <div className="p-4 bg-slate-900/60 rounded-xl border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-slate-200">Ücretli Üyelik & Tahsilat Modülü</span>
                        <p className="text-xs text-slate-500">Kullanıcılardan 150 TL randevu güvence ödemesi talep eder.</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setConfig({...config, membershipEnabled: !config.membershipEnabled})}
                        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${config.membershipEnabled ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'}`}
                      >
                        <div className="bg-white w-4 h-4 rounded-full shadow-md"></div>
                      </button>
                    </div>
                  </div>

                  {/* WHATSAPP MODÜLÜ */}
                  <div className="p-4 bg-slate-900/60 rounded-xl border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-slate-200">WhatsApp Bildirim Modülü</span>
                        <p className="text-xs text-slate-500">Kullanıcı rezervasyon yaptığında, resmi API veya entegre servis sağlayıcınız üzerinden otomatik onay mesajı gönderir.</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setConfig({...config, whatsappEnabled: !config.whatsappEnabled})}
                        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${config.whatsappEnabled ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'}`}
                      >
                        <div className="bg-white w-4 h-4 rounded-full shadow-md"></div>
                      </button>
                    </div>

                    {config.whatsappEnabled && (
                      <div className="space-y-3 pt-3 border-t border-white/5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">WhatsApp Servis Sağlayıcı</label>
                            <select 
                              className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-slate-100 outline-none"
                              value={config.whatsappProvider || 'MetaCloudAPI'}
                              onChange={e => setConfig({...config, whatsappProvider: e.target.value})}
                            >
                              <option value="WhatsAppWeb">Sunucu WhatsApp Web (Sistem Üzerinden - Ücretsiz & QR Kodlu)</option>
                              <option value="Gateway">Yerel Android Gateway (Ücretsiz & Cihaz Bağımlı)</option>
                              <option value="MetaCloudAPI">Meta Cloud API (Resmi & Ücretli)</option>
                              <option value="Twilio">Twilio WhatsApp (Resmi & Ücretli)</option>
                              <option value="Ultramsg">Ultramsg API</option>
                            </select>
                          </div>
                          {config.whatsappProvider === 'WhatsAppWeb' ? (
                            <div className="bg-emerald-950/20 border border-emerald-500/20 p-2.5 rounded-lg text-xs text-slate-300 flex items-center gap-2">
                              <div>
                                <span className="font-bold text-emerald-400 block mb-0.5 text-[11px]">🟢 Sunucu WhatsApp Web Modülü</span>
                                Entegre QR Kod tüneli üzerinden oturumunuzu bağlayıp ücretsiz gönderim yaparsınız.
                              </div>
                            </div>
                          ) : config.whatsappProvider === 'Gateway' ? (
                            <div>
                              <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Gateway Tünel URL adresi (LocalTunnel / Ngrok)</label>
                              <input 
                                type="text"
                                className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-indigo-300 focus:outline-none font-mono"
                                value={config.whatsappGatewayUrl || ''}
                                onChange={e => setConfig({...config, whatsappGatewayUrl: e.target.value})}
                                placeholder="Örn: https://bursa-rezervasyon-sms.loca.lt"
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">API Key / Access Token</label>
                              <input 
                                type="password"
                                className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-slate-100 focus:outline-none"
                                value={config.whatsappApiKey || ''}
                                onChange={e => setConfig({...config, whatsappApiKey: e.target.value})}
                                placeholder="Access Token / Auth Token"
                              />
                            </div>
                          )}
                        </div>

                        {config.whatsappProvider !== 'Gateway' && config.whatsappProvider !== 'WhatsAppWeb' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Phone Number ID / Account SID / Instance ID</label>
                              <input 
                                type="text"
                                className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-slate-100 focus:outline-none font-mono"
                                value={config.whatsappNumberID || ''}
                                onChange={e => setConfig({...config, whatsappNumberID: e.target.value})}
                                placeholder="Örn: 328012301982 veya ACxxxxx"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Gönderici Numarası (Twilio için zorunlu)</label>
                              <input 
                                type="text"
                                className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-slate-100 focus:outline-none font-mono"
                                value={config.whatsappNumber || ''}
                                onChange={e => setConfig({...config, whatsappNumber: e.target.value})}
                                placeholder="Örn: +14155238886"
                              />
                            </div>
                          </div>
                        )}

                        {config.whatsappProvider === 'WhatsAppWeb' && (
                          <div className="bg-slate-950 border border-white/10 rounded-xl p-4 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-2.5 gap-2">
                              <div className="flex items-center gap-2">
                                <span className="relative flex h-2.5 w-2.5">
                                  {waWebStatus?.status === 'connected' ? (
                                    <>
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                    </>
                                  ) : waWebStatus?.status === 'connecting' ? (
                                    <>
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                                    </>
                                  ) : (
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                                  )}
                                </span>
                                <span className="text-xs font-bold text-slate-200">
                                  WhatsApp Bağlantı Durumu:
                                </span>
                                <span className={`text-[11px] ml-1 font-mono font-bold ${
                                  waWebStatus?.status === 'connected' ? 'text-emerald-400' :
                                  waWebStatus?.status === 'connecting' ? 'text-amber-400' : 'text-slate-400'
                                }`}>
                                  {waWebStatus?.message || 'Yükleniyor...'}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={handleWaWebRestart}
                                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-white/10 text-white text-[10px] rounded transition-all font-semibold"
                                >
                                  Cihazı Yeniden Bağla
                                </button>
                                {waWebStatus?.status === 'connected' && (
                                  <button
                                    type="button"
                                    onClick={handleWaWebLogout}
                                    className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/20 text-rose-200 text-[10px] rounded transition-all font-semibold"
                                  >
                                    Oturumu Kapat
                                  </button>
                                )}
                              </div>
                            </div>

                            {waWebStatus?.status === 'connected' ? (
                              <div className="flex flex-col sm:flex-row items-center gap-4 bg-emerald-950/20 border border-emerald-500/10 p-4 rounded-lg">
                                <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400 flex-shrink-0">
                                  <CheckCircle2 className="w-8 h-8" />
                                </div>
                                <div className="text-center sm:text-left space-y-1">
                                  <p className="text-sm font-bold text-emerald-400">Aktif Oturum Bağlandı</p>
                                  <p className="text-[11px] text-slate-300">
                                    Müşterilerinize gidecek olan tüm onay mesajları bu bağlı hattan tamamen ücretsiz ve otomatik olarak gönderilecektir.
                                  </p>
                                  {waWebStatus.user && (
                                    <p className="text-[10px] text-slate-400 font-mono">
                                      Bağlı Kullanıcı: <strong className="text-slate-200">{waWebStatus.user.name || 'WhatsApp Kullanıcısı'}</strong> ({waWebStatus.user.id.split(':')[0]})
                                    </p>
                                  )}
                                </div>
                              </div>
                            ) : waWebStatus?.status === 'connecting' ? (
                              <div className="text-center p-6 space-y-3">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto"></div>
                                <p className="text-xs text-slate-400 font-mono">Sunucu üzerinde güvenli WhatsApp Web soketi başlatılıyor, lütfen bekleyin...</p>
                              </div>
                            ) : waWebStatus?.qr ? (
                              <div className="bg-slate-900 p-4 rounded-lg text-center space-y-4">
                                <p className="text-xs font-semibold text-amber-400">
                                  ⚠️ Telefonunuzdan QR Kodu Taratın
                                </p>
                                <div className="p-4 bg-white rounded-xl inline-block shadow-lg">
                                  <QRCodeSVG value={waWebStatus.qr} size={180} />
                                </div>
                                <div className="max-w-md mx-auto text-[11px] text-slate-300 space-y-2 leading-relaxed text-left">
                                  <p className="font-bold border-b border-white/5 pb-1 select-none">Bağlama adımları:</p>
                                  <ol className="list-decimal list-inside space-y-1 text-slate-400 pl-1">
                                    <li>Telefonunuzda <strong>WhatsApp</strong> uygulamasını açın.</li>
                                    <li>Menü (üç nokta) veya <strong>Ayarlar</strong> sekmesine girin.</li>
                                    <li><strong>"Bağlı Cihazlar" (Linked Devices)</strong> seçeneğine tıklayın.</li>
                                    <li><strong>"Cihaz Bağla" (Link a Device)</strong> tuşuna basın ve yukarıdaki QR kodu taratın.</li>
                                  </ol>
                                  <p className="text-[10px] text-zinc-500 italic mt-2 text-center">
                                    * Tarama işlemi başarılı olduğunda bu ekran otomatik olarak kapanacak ve "Aktif" ibaresi belirecektir.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center p-6 space-y-3 bg-rose-950/10 border border-rose-500/10 rounded-lg">
                                <p className="text-xs text-rose-400 font-semibold">{waWebStatus?.message || 'QR Kod yüklenemedi.'}</p>
                                <p className="text-[11px] text-slate-400">QR kod üretilmesi için sunucu arka planda deneme yapıyor veya oturum hazırlanıyor olabilir. Birkaç saniye içinde gelmezse lütfen 'Cihazı Yeniden Bağla' butonuna basın.</p>
                              </div>
                            )}
                          </div>
                        )}

                        {config.whatsappProvider === 'Gateway' && (
                          <div className="text-[11px] text-slate-300 bg-indigo-950/40 p-4 rounded-xl border border-indigo-500/10 leading-relaxed space-y-3">
                            <p>
                              💡 <strong>Ücretsiz Otomasyon İpucu:</strong> Android telefonunuza "SMS Gateway" veya "WhatsApp Gateway API" benzeri ücretsiz bir uygulama yükleyip, aldığınız tünel URL adresini buraya girerek müşterilerinize tamamen ücretsiz ve otomatik olarak mesaj gönderebilirsiniz.
                            </p>
                            <div className="bg-slate-900/80 border border-white/5 p-3 rounded-lg text-xs text-slate-400 space-y-2">
                              <span className="font-bold text-amber-400 flex items-center gap-1">🛑 Ekran Kapandığında Gateway Bağlantısının Kopmasını Engelleme:</span>
                              <p className="text-[11px] leading-relaxed">
                                Android işletim sistemi cihaz ekranı kapandığında güç tasarrufu sağlamak için arka plan uygulamalarını uyutur. Bunun önüne geçmek için uygulayacağınız basit adımlar:
                              </p>
                              <ul className="list-decimal list-inside space-y-1.5 text-[11px] pl-1">
                                <li>Telefon ayarlarından <strong>"Pil Tasarrufu / Pil Optimizasyonu"</strong> ayarlarına girin. Liste içinden Gateway uygulamasını bulup <strong>"Kısıtlamasız / Optimize Etme (Unrestricted)"</strong> olarak seçin.</li>
                                <li>Uygulama bilgisi sayfasından <strong>"Arka Planda Çalışmaya İzin Ver"</strong> iznini aktif edin.</li>
                                <li>Son uygulamalar (Overview) ekranını açın, Gateway uygulamasının penceresine basılı tutarak <strong>"Kilitle" (Kilit/Padlock simgesi)</strong> seçeneğini işaretleyin. Böylece siz temizleseniz de arka planda kalır.</li>
                                <li>Uygulama ayarlarında <strong>"Wake Lock"</strong> veya <strong>"Keep Awake (Uyanık Kal)"</strong> seçeneği varsa mutlaka aktif edin.</li>
                                <li>Mümkünse cihazı şarja takılı tutun; bu durum cihazın derin uyku (Doze) moduna geçmesini otomatik olarak önler.</li>
                              </ul>
                            </div>
                          </div>
                        )}

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-[10px] uppercase text-slate-500 font-bold">Mesaj Taslağı</label>
                            <span className="text-[9px] text-indigo-400 font-mono">Dinamik Tagler: [AD] [SOYAD] [KOD] [TARIH] [SAAT]</span>
                          </div>
                          <textarea 
                            className="w-full bg-slate-950 border border-white/10 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-700 focus:outline-none"
                            rows={3}
                            value={config.whatsappTemplate || ''}
                            onChange={e => setConfig({...config, whatsappTemplate: e.target.value})}
                            placeholder="Sayın [AD] [SOYAD], [TARIH] saat [SAAT] tarihindeki OSGB Akademi eğitim randevunuz onaylanmıştır. Rezervasyon Kodunuz: [KOD]"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SMS MODÜLÜ */}
                  <div className="p-4 bg-slate-900/60 rounded-xl border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-slate-200">SMS Entegrasyonu</span>
                        <p className="text-xs text-slate-500">Yeni rezervasyon oluştuğunda resmi API üzerinden otomatik kısa mesaj gönderir.</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setConfig({...config, smsEnabled: !config.smsEnabled})}
                        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${config.smsEnabled ? 'bg-indigo-500 justify-end' : 'bg-slate-700 justify-start'}`}
                      >
                        <div className="bg-white w-4 h-4 rounded-full shadow-md"></div>
                      </button>
                    </div>

                    {config.smsEnabled && (
                      <div className="space-y-3 pt-3 border-t border-white/5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Servis Sağlayıcı</label>
                            <select 
                              className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-slate-100 outline-none"
                              value={config.smsProvider || 'Netgsm'}
                              onChange={e => setConfig({...config, smsProvider: e.target.value})}
                            >
                              <option value="Netgsm">Netgsm</option>
                              <option value="VatanSms">VatanSms</option>
                              <option value="Verimor">Verimor</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">API Key / Şifre</label>
                            <input 
                              type="password"
                              className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-slate-100 focus:outline-none"
                              value={config.smsApiKey || ''}
                              onChange={e => setConfig({...config, smsApiKey: e.target.value})}
                              placeholder="••••••••••••••"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1">Gönderici Başlığı (Alfanumerik / Header)</label>
                          <input 
                            type="text"
                            className="w-full bg-slate-950 border border-white/10 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none font-mono"
                            value={config.smsSender || ''}
                            onChange={e => setConfig({...config, smsSender: e.target.value})}
                            placeholder="Örn: OSGBAKADEMI"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-[10px] uppercase text-slate-500 font-bold">SMS Gönderim Mesajı</label>
                            <span className="text-[9px] text-indigo-400 font-mono">Dinamik Tagler: [AD] [SOYAD] [KOD] [TARIH] [SAAT]</span>
                          </div>
                          <textarea 
                            className="w-full bg-slate-950 border border-white/10 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-700 focus:outline-none"
                            rows={3}
                            value={config.smsTemplate || ''}
                            onChange={e => setConfig({...config, smsTemplate: e.target.value})}
                            placeholder="Sayın [AD] [SOYAD], [TARIH] tarihli randevunuz kaydedilmiştir. Kodunuz: [KOD]"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                </div>

              </div>
              <button onClick={saveConfig} className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all hover:scale-105">Ayarları Kaydet</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // CLIENT VIEW
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 py-12 px-4 flex flex-col items-center relative overflow-hidden font-sans">
      
      {/* Mesh Gradient Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[150px] pointer-events-none"></div>
      
      <div className="max-w-3xl w-full relative z-10">
        {/* Header - Secret Admin trigger on click */}
        <div className="text-center mb-6 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight cursor-default" onClick={(e) => { if(e.detail === 5) setView('admin-login'); }}>OSGB Eğitim Rezervasyonu</h1>
          <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-400">İş sağlığı ve güvenliği temel eğitim randevunuzu oluşturun.</p>
        </div>

        {/* Form Container */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10">
          
          <div className="p-4 sm:p-6 pb-4 bg-white/5 border-b border-white/10">
            {step < 5 && renderStepIndicator()}
          </div>

          <div className="p-4 sm:p-8">
            <AnimatePresence mode="wait">
              
              {/* ADIM 1: Kişisel Bilgiler */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="mb-4">
                    <h2 className="text-xl sm:text-2xl font-semibold text-white">Genel Bilgiler</h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">Lütfen iletişim bilgilerinizi eksiksiz girin.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 ml-1 mb-2">Adınız</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            value={formData.firstName}
                            onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                            className="pl-10 block w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-indigo-500/50"
                            placeholder="Örn. Ahmet"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 ml-1 mb-2">Soyadınız</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            value={formData.lastName}
                            onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                            className="pl-10 block w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-indigo-500/50"
                            placeholder="Örn. Yılmaz"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 ml-1 mb-2">Telefon Numaranız</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Phone className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          className="pl-10 block w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-indigo-500/50"
                          placeholder="05XX XXX XX XX"
                        />
                      </div>
                    </div>

                    {/* KVKK Bilgilendirme ve Onay Kutusu */}
                    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 sm:p-5 space-y-3.5">
                      <div className="flex items-start gap-3">
                        <input
                          id="kvkk-checkbox"
                          type="checkbox"
                          checked={kvkkAccepted}
                          onChange={(e) => setKvkkAccepted(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-white/10 text-indigo-600 bg-slate-950 focus:ring-indigo-500/50 cursor-pointer"
                        />
                        <label htmlFor="kvkk-checkbox" className="text-xs sm:text-sm text-slate-300 leading-relaxed cursor-pointer select-none">
                          <span className="font-semibold text-white">6698 sayılı KVKK</span> kapsamında, eğitim rezervasyon kaydımın yapılması ve bildirim SMS/WhatsApp mesajlarının tarafıma ulaştırılması amacıyla kişisel verilerimin işlenmesini kabul ediyorum.
                        </label>
                      </div>
                      
                      <div className="text-[11px] text-slate-400/80 leading-relaxed pl-7 border-t border-white/5 pt-3">
                        <p className="font-bold uppercase tracking-wider text-slate-300 mb-1">Açık Rıza Beyanı:</p>
                        Girdiğiniz ad, soyad ve iletişim bilgileri yalnızca eğitim katılım teyidiniz, giriş kartınızın oluşturulması, yol tarifi ve randevu durum güncellemelerinin size iletilmesi amacıyla üçüncü taraf SMS veya WhatsApp sağlayıcıları (Netgsm, Meta vb.) altyapısı kullanılarak işlenecektir. Verileriniz hiçbir şekilde pazarlama amacıyla paylaşılmaz veya satılmaz.
                      </div>
                    </div>
                  </div>

                  <div className="mt-10 flex justify-end">
                    <button
                      disabled={!isStep1Valid}
                      onClick={handleNext}
                      className="inline-flex items-center px-6 py-3 border border-transparent text-base font-bold rounded-xl shadow-xl shadow-white/10 text-slate-900 bg-white hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed transition-transform"
                    >
                      İleri
                      <ChevronRight className="ml-2 -mr-1 h-5 w-5" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ADIM 2: Ulaşım ve Tür */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="mb-4">
                    <h2 className="text-xl sm:text-2xl font-semibold text-white">Çalışma ve Ulaşım</h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">Lütfen size uygun seçenekleri işaretleyin.</p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">İşyeri Türü</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {WORKPLACES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setFormData({...formData, workplace: t.id})}
                          className={`relative flex flex-col p-4 border rounded-xl shadow-sm cursor-pointer transition-all ${
                            formData.workplace === t.id 
                              ? 'bg-indigo-500/20 border-indigo-500/40 ring-1 ring-indigo-500/50' 
                              : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                          }`}
                        >
                          <t.icon className={`h-8 w-8 mb-3 ${formData.workplace === t.id ? 'text-indigo-400' : 'text-slate-500'}`} />
                          <span className={`block text-sm font-medium ${formData.workplace === t.id ? 'text-indigo-300' : 'text-slate-300'}`}>
                            {t.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Kuruma Ulaşım Şekliniz</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {TRANSPORTS.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setFormData({...formData, transport: t.id})}
                          className={`relative flex items-start p-4 border rounded-xl shadow-sm cursor-pointer transition-all ${
                            formData.transport === t.id 
                              ? 'bg-indigo-500/20 border-indigo-500/40 ring-1 ring-indigo-500/50' 
                              : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                          }`}
                        >
                          <div className={`p-2 rounded-lg mr-4 ${formData.transport === t.id ? 'bg-indigo-500/20' : 'bg-white/5'}`}>
                            <t.icon className={`h-6 w-6 ${formData.transport === t.id ? 'text-indigo-400' : 'text-slate-500'}`} />
                          </div>
                          <div className="text-left">
                            <span className={`block text-sm font-medium ${formData.transport === t.id ? 'text-indigo-300' : 'text-slate-300'}`}>
                              {t.label}
                            </span>
                            <span className={`mt-1 block text-xs ${formData.transport === t.id ? 'text-indigo-400/80' : 'text-slate-500'}`}>
                              {t.desc}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between mt-10">
                    <button
                      onClick={handleBack}
                      className="inline-flex items-center px-6 py-3 border border-white/10 text-base font-bold rounded-xl text-slate-300 bg-white/5 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <ChevronLeft className="mr-2 -ml-1 h-5 w-5" />
                      Geri
                    </button>
                    <button
                      disabled={!isStep2Valid}
                      onClick={handleNext}
                      className="inline-flex items-center px-6 py-3 border border-transparent text-base font-bold rounded-xl shadow-xl shadow-white/10 text-slate-900 bg-white hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed transition-transform"
                    >
                      İleri
                      <ChevronRight className="ml-2 -mr-1 h-5 w-5" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ADIM 3: Saat ve Tarih */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div>
                    <h2 className="text-xl sm:text-2xl font-semibold text-white">Tarih ve Saat Seçimi</h2>
                    <p className="text-xs sm:text-sm text-indigo-400 mt-1 font-medium">
                      {formData.workplace === 'insaat' 
                        ? 'İnşaat sektörü eğitimlerimiz sabah saatlerinde yapılmaktadır.' 
                        : 'Fabrika ve hizmet sektörü eğitimlerimiz öğleden sonra saatlerinde yapılmaktadır.'}
                    </p>
                  </div>

                  {/* Tarih Seçimi */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 ml-1 flex items-center mb-4">
                      <Calendar className="w-5 h-5 mr-2 text-slate-500" />
                      Lütfen Bir Gün Seçin
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {availableDays.map((d, idx) => {
                        const tzOffset = d.getTimezoneOffset() * 60000;
                        const dateStr = (new Date(d.valueOf() - tzOffset)).toISOString().split('T')[0];
                        const isSelected = formData.date === dateStr;
                        return (
                          <button
                            key={idx}
                            onClick={() => setFormData({...formData, date: dateStr, time: ''})}
                            className={`p-3 text-sm font-medium rounded-xl border text-center transition-all ${
                              isSelected 
                                ? 'bg-indigo-600 border-indigo-500/30 text-white shadow-lg shadow-indigo-600/30' 
                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <div className="text-xs uppercase opacity-80 mb-1">
                              {new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(d)}
                            </div>
                            <div className="text-lg">
                              {new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(d)}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Saat Seçimi */}
                  {formData.date && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="pt-6 border-t border-white/10"
                    >
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 ml-1 flex items-center mb-4">
                        <Clock className="w-5 h-5 mr-2 text-slate-500" />
                        Lütfen Saat Seçin
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {availableTimes.map((time) => (
                          <button
                            key={time}
                            onClick={() => setFormData({...formData, time})}
                            className={`p-3 text-center rounded-xl font-medium border transition-all ${
                              formData.time === time 
                                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 ring-1 ring-indigo-500/30' 
                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  <div className="flex justify-between mt-10">
                    <button
                      onClick={handleBack}
                      className="inline-flex items-center px-6 py-3 border border-white/10 text-base font-bold rounded-xl text-slate-300 bg-white/5 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <ChevronLeft className="mr-2 -ml-1 h-5 w-5" />
                      Geri
                    </button>
                    <button
                      disabled={!isStep3Valid}
                      onClick={handleNext}
                      className="inline-flex items-center px-6 py-3 border border-transparent text-base font-bold rounded-xl shadow-xl shadow-white/10 text-slate-900 bg-white hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed transition-transform"
                    >
                      İleri
                      <ChevronRight className="ml-2 -mr-1 h-5 w-5" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ADIM 4: Onay */}
              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="text-center">
                    <h2 className="text-xl sm:text-2xl font-semibold text-white">Rezervasyon Özeti</h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">Lütfen bilgilerinizi kontrol edip onaylayın.</p>
                  </div>

                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <dl className="grid grid-cols-1 gap-y-6 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Ad Soyad</dt>
                        <dd className="mt-1 text-lg text-white font-medium">{formData.firstName} {formData.lastName}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Telefon</dt>
                        <dd className="mt-1 text-lg text-white font-medium">{formData.phone}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">İşyeri Türü / Ulaşım</dt>
                        <dd className="mt-1 text-lg text-white font-medium">
                          {WORKPLACES.find(w => w.id === formData.workplace)?.label} / {TRANSPORTS.find(t => t.id === formData.transport)?.label}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Randevu Zamanı</dt>
                        <dd className="mt-1 text-lg text-white font-medium">
                          {formData.date && formatDate(formData.date)} - <span className="font-bold text-indigo-400">{formData.time}</span>
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {config.membershipEnabled && (
                    <motion.div 
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 space-y-4 text-left"
                    >
                      <div className="flex items-center gap-2 border-b border-amber-500/10 pb-3">
                        <CreditCard className="w-5 h-5 text-amber-400" />
                        <h3 className="text-lg font-bold text-amber-200">Ücretli Üyelik & Aktivasyon Ödemesi (150 TL)</h3>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Sistemde aktif <strong className="text-amber-400">"Ücretli Üyelik ve Rezervasyon Güvencesi"</strong> modülü bulunuyor. Kaydınızı tamamlayabilmek için lütfen aşağıdaki test ödeme formunu (kart sahibi, kart no ve cvc) doldurun.
                      </p>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] sm:text-xs uppercase text-slate-400 font-bold ml-1 mb-1">Kart Sahibi Ad Soyad</label>
                          <input 
                            type="text" 
                            placeholder="AHMET YILMAZ"
                            value={paymentName}
                            onChange={e => setPaymentName(e.target.value.toUpperCase())}
                            className="block w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-xs uppercase text-slate-400 font-bold ml-1 mb-1">Kart Numarası</label>
                          <input 
                            type="text" 
                            placeholder="4355 8812 3445 9901"
                            maxLength={19}
                            value={paymentCard}
                            onChange={e => {
                              const value = e.target.value.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim();
                              setPaymentCard(value);
                            }}
                            className="block w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 font-mono tracking-wider"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] sm:text-xs uppercase text-slate-400 font-bold ml-1 mb-1">Son Kullanma (AA/YY)</label>
                            <input 
                              type="text" 
                              placeholder="09/28"
                              maxLength={5}
                              value={paymentExpiry}
                              onChange={e => {
                                let val = e.target.value.replace(/\D/g, '');
                                if (val.length > 2) {
                                  val = val.substring(0, 2) + '/' + val.substring(2, 4);
                                }
                                setPaymentExpiry(val);
                              }}
                              className="block w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 font-mono text-center"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] sm:text-xs uppercase text-slate-400 font-bold ml-1 mb-1">CVC / CVV</label>
                            <input 
                              type="password" 
                              placeholder="***"
                              maxLength={3}
                              value={paymentCvv}
                              onChange={e => setPaymentCvv(e.target.value.replace(/\D/g, ''))}
                              className="block w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 font-mono text-center"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div className="flex justify-between mt-10">
                    <button
                      onClick={handleBack}
                      className="inline-flex items-center px-6 py-3 border border-white/10 text-base font-bold rounded-xl text-slate-300 bg-white/5 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <ChevronLeft className="mr-2 -ml-1 h-5 w-5" />
                      Düzenle
                    </button>
                    <button
                      onClick={handleNext}
                      disabled={!isStep4Valid}
                      className={`inline-flex items-center px-8 py-3 border border-transparent text-base font-bold rounded-xl shadow-lg transition-all cursor-pointer ${
                        isStep4Valid 
                          ? 'text-white bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 hover:scale-105' 
                          : 'bg-white/10 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Check className="mr-2 h-5 w-5" />
                      {config.membershipEnabled ? 'Ödeme Yap & Onayla' : 'Rezervasyonu Onayla'}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* BAŞARI */}
              {step === 5 && (
                <motion.div
                  key="step5"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6 sm:py-12"
                >
                  <div className="print-section max-w-md mx-auto">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-emerald-500/20 mb-4 sm:mb-6 print-hidden">
                      <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 text-emerald-400" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 print-text-black font-sans">Rezervasyon Alındı!</h2>
                    
                    <p className="text-xs sm:text-sm text-slate-400 mb-2 print-hidden">Aşağıda oluşan kodun ve bilgilerin bulunduğu bu <span className="font-bold text-white">ekranın görüntüsünü almanızı</span> önemle rica ederiz.</p>

                    <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 my-6 sm:my-8 text-left print-bg-white print-border-black print-text-black relative">
                      {/* Decorative corner borders for code focus */}
                      <div className="absolute top-0 right-0 w-12 sm:w-16 h-12 sm:h-16 border-t-2 border-r-2 border-indigo-500/50 rounded-tr-xl sm:rounded-tr-2xl print-border-black"></div>
                      <div className="absolute bottom-0 left-0 w-12 sm:w-16 h-12 sm:h-16 border-b-2 border-l-2 border-indigo-500/50 rounded-bl-xl sm:rounded-bl-2xl print-border-black"></div>

                      <div className="text-center mb-6 border-b border-indigo-500/20 print-border-black pb-6">
                        <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-indigo-400 mb-3 sm:mb-4 print-text-black">Rezervasyon Kodu</p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
                          <div className="bg-white p-2 rounded-xl">
                            {reservationCode ? (
                              <QRCodeSVG value={reservationCode} size={90} level="L" includeMargin={false} />
                            ) : (
                              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-200 animate-pulse rounded-lg"></div>
                            )}
                          </div>
                          <p className="text-3xl sm:text-4xl font-mono font-bold tracking-widest text-white print-text-black">{reservationCode}</p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <h3 className="text-lg sm:text-xl font-bold uppercase tracking-wide">Eğitim Giriş Belgesi</h3>
                        <p className="text-xs sm:text-sm text-slate-400 print-text-black">OSGB Akademi</p>
                      </div>
                      <dl className="space-y-4">
                        <div>
                          <dt className="text-xs font-bold uppercase tracking-wider text-slate-500 print-text-black">Katılımcı</dt>
                          <dd className="mt-1 text-lg font-medium">{formData.firstName} {formData.lastName}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold uppercase tracking-wider text-slate-500 print-text-black">Tarih ve Saat</dt>
                          <dd className="mt-1 text-lg font-medium">{formData.date ? formatDate(formData.date) : ''} - {formData.time}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold uppercase tracking-wider text-slate-500 print-text-black">İşyeri / Ulaşım</dt>
                          <dd className="mt-1 text-base">
                            {WORKPLACES.find(w => w.id === formData.workplace)?.label} / {TRANSPORTS.find(t => t.id === formData.transport)?.label}
                          </dd>
                        </div>
                      </dl>

                      {/* Yol Tarifi Bölümü */}
                      <div className="mt-6 pt-6 border-t border-white/10 text-left">
                        <h4 className="text-sm font-bold uppercase text-indigo-400 flex items-center gap-2 mb-2 print-hidden">
                          <MapPin className="w-4 h-4" /> Ulaşım ve Yol Tarifi
                        </h4>
                        {formData.transport === 'toplu' ? (
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-400">Otobüs Tarifi:</p>
                            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                              {config.otobusTarifi || "Merkez durağında inerek Akademi tabelalarını takip edip 200m yürüyerek binamıza ulaşabilirsiniz."}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-400">Şahsi Araç Konum Tarifi:</p>
                            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                              {config.sahsiAracTarifi || "Merkez kavşağından ilk sağa sapıp Akademi otoparkına aracınızı ücretsiz park edebilirsiniz."}
                            </p>
                          </div>
                        )}
                        {config.konumLink && (
                          <a
                            href={config.konumLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors print-hidden"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Google Haritalarda Gör / Yol Tarifi Al
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Otomatik Bildirim Durumları */}

                    {smsResult && (
                      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-4 text-left flex items-start gap-3 print-hidden">
                        <Smartphone className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">SMS Bildirimi Gönderildi ({smsResult.provider})</p>
                          <p className="text-xs text-slate-300 mt-1">Sistemimiz tarafından telefonunuza otomatik onay kısa mesajı iletilmiştir:</p>
                          <p className="text-sm font-mono bg-black/40 text-indigo-300 p-2.5 rounded-lg border border-indigo-500/15 mt-2 leading-relaxed whitespace-pre-wrap">
                            {smsResult.message}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Bottom padding spacing */}
                  <div className="mb-4"></div>

                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-6 mb-8 text-left print-bg-white print-border-black print-text-black">
                      <h3 className="font-semibold text-indigo-300 print-text-black mb-2 flex items-center">
                        <Info className="h-5 w-5 mr-2 print-hidden" />
                        Önemli Bilgilendirme
                      </h3>
                      <ul className="text-sm text-indigo-300/80 print-text-black space-y-2 list-disc list-inside">
                        <li>Lütfen eğitimden 15 dakika önce kurumda hazır bulununuz.</li>
                        <li>Kimlik kartınızı yanınızda getirmeyi unutmayınız.</li>
                        <li>Kuruma geldiğinizde <span className="font-bold">rezervasyon kodunuzu ({reservationCode})</span> yetkiliye iletiniz.</li>
                        <li>Lütfen <span className="font-bold underline decoration-indigo-400/50">bu ekranın görüntüsünü alarak</span> işlemi sonlandırınız.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 justify-center print-hidden">
                    <button
                      onClick={() => {
                        setStep(1);
                        setFormData({
                          firstName: '', lastName: '', phone: '', workplace: '', transport: '', date: '', time: ''
                        });
                      }}
                      className="inline-flex items-center justify-center px-6 py-3 border border-indigo-500/50 shadow-lg shadow-indigo-500/20 text-base font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                    >
                       Tüm İşlemleri Tamamla & Yeni Rezervasyon
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer Admin trigger */}
        <div className="mt-8 text-center text-xs text-slate-600 opacity-50 hover:opacity-100 transition-opacity">
          Sistem <button className="underline cursor-pointer" onClick={() => setView('admin-login')}>yönetici girişi</button> için tıklayın.
        </div>
      </div>
    </div>
  );
}

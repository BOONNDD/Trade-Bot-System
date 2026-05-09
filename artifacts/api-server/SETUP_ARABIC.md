# 🧲 دليل الإعداد الكامل — V11 MAGNETAR
## نظام التداول الآلي المستقل مع بوت تليغرام

---

## 📋 نظرة عامة على المشروع

هذا النظام يحوّل سكريبت التداول V11 MAGNETAR إلى خدمة Node.js مستقلة تعمل 24/7 على السحابة مع:

- **بوت تليغرام** للتحكم الكامل عن بُعد
- **محرك Puppeteer** لتشغيل السكريبت في متصفح مخفي
- **نظام WebSocket ذاتي الشفاء** مع إعادة اتصال تلقائية
- **نظام سجلات متقدم** مع تدوير تلقائي وتصدير عبر تليغرام
- **مراقبة مستمرة** مع إشعارات فورية

---

## 📁 هيكل المشروع

```
artifacts/api-server/
├── src/
│   ├── bot/
│   │   └── telegramBot.ts       — بوت تليغرام وجميع الأوامر
│   ├── core/
│   │   ├── puppeteerEngine.ts   — محرك Puppeteer وحقن السكريبت
│   │   ├── wsMonitor.ts         — مراقب WebSocket ذاتي الشفاء
│   │   └── candle_V11_MAGNETAR.js — سكريبت التداول الأصلي
│   ├── logs/
│   │   └── logManager.ts        — نظام إدارة السجلات
│   ├── config/
│   │   └── env.ts               — إعدادات متغيرات البيئة
│   ├── utils/
│   │   └── helpers.ts           — دوال مساعدة
│   ├── routes/
│   │   ├── health.ts            — نقطة فحص الصحة /api/healthz
│   │   └── status.ts            — لوحة الحالة /api/status
│   └── index.ts                 — نقطة الدخول الرئيسية
├── ecosystem.config.cjs          — إعداد PM2
├── Dockerfile                    — صورة Docker
├── railway.toml                  — إعداد Railway
├── startup.sh                    — سكريبت التشغيل السريع
└── SETUP_ARABIC.md               — هذا الدليل
```

---

## ⚙️ خطوات الإعداد

### الخطوة 1: إنشاء بوت تليغرام

1. افتح تليغرام وابحث عن **@BotFather**
2. أرسل `/newbot`
3. اختر اسمًا للبوت (مثال: `MagnetarTradingBot`)
4. اختر اسم مستخدم ينتهي بـ `bot` (مثال: `magnetar_v11_bot`)
5. احفظ **التوكن** الذي ستحصل عليه (مثال: `7123456789:AAHExample...`)

### الخطوة 2: الحصول على Chat ID

1. ابحث عن **@userinfobot** في تليغرام
2. أرسل `/start`
3. احفظ رقم **Id** الذي يظهر (مثال: `123456789`)

### الخطوة 3: إعداد ملف .env

```bash
# انسخ ملف المثال
cp .env.example .env

# افتح الملف وعدّل القيم
nano .env
```

أضف قيمك:
```env
TELEGRAM_TOKEN=7123456789:AAHExample_your_actual_token_here
CHAT_ID=123456789
TARGET_URL=https://pocketoption.com/en/cabinet/demo-quick-high-low/
HEADLESS=true
SESSION_PATH=./session
RECONNECT_DELAY=5000
LOG_DIR=./logs
HEARTBEAT_INTERVAL_MS=300000
PORT=5000
```

### الخطوة 4: تثبيت المتطلبات

```bash
# تثبيت Node.js 20+
# تثبيت pnpm
npm install -g pnpm

# تثبيت الحزم
pnpm install
```

### الخطوة 5: تشغيل النظام

```bash
# البناء والتشغيل المباشر
cd artifacts/api-server
bash startup.sh
```

---

## 🚀 النشر على Railway.app (مجاني)

### الخطوة 1: إنشاء حساب Railway

1. اذهب إلى [railway.app](https://railway.app)
2. سجّل دخولاً بحساب GitHub

### الخطوة 2: إنشاء مشروع جديد

```bash
# ثبّت Railway CLI
npm install -g @railway/cli

# سجّل دخولك
railway login

# أنشئ مشروع جديد
railway init

# اربط المستودع
railway link
```

### الخطوة 3: إضافة متغيرات البيئة على Railway

```bash
railway variables set TELEGRAM_TOKEN=your_token_here
railway variables set CHAT_ID=your_chat_id_here
railway variables set TARGET_URL=https://pocketoption.com/en/cabinet/demo-quick-high-low/
railway variables set HEADLESS=true
railway variables set SESSION_PATH=/app/session
railway variables set LOG_DIR=/app/logs
railway variables set HEARTBEAT_INTERVAL_MS=300000
```

### الخطوة 4: النشر

```bash
# انشر المشروع
railway up

# شاهد السجلات
railway logs
```

> **ملاحظة مهمة:** Railway يوفر $5 رصيد شهري مجاناً وهو كافٍ للتشغيل المستمر.

---

## 🐳 النشر باستخدام Docker

```bash
# بناء الصورة
docker build -t magnetar-trading -f artifacts/api-server/Dockerfile .

# تشغيل الحاوية
docker run -d \
  --name magnetar \
  --restart unless-stopped \
  -p 5000:5000 \
  -e TELEGRAM_TOKEN=your_token \
  -e CHAT_ID=your_chat_id \
  -e TARGET_URL=https://pocketoption.com/en/cabinet/demo-quick-high-low/ \
  -e HEADLESS=true \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/session:/app/session \
  magnetar-trading

# مشاهدة السجلات
docker logs -f magnetar
```

---

## ⚙️ استخدام PM2 للتشغيل المستمر

PM2 هو مدير عمليات Node.js يضمن إعادة التشغيل التلقائي عند الأعطال.

```bash
# تثبيت PM2
npm install -g pm2

# تشغيل النظام مع PM2
cd artifacts/api-server
pm2 start ecosystem.config.cjs

# حفظ الإعداد للتشغيل التلقائي عند إعادة تشغيل الجهاز
pm2 save
pm2 startup

# أوامر PM2 المفيدة:
pm2 list                          # عرض جميع العمليات
pm2 logs magnetar-trading         # مشاهدة السجلات المباشرة
pm2 restart magnetar-trading      # إعادة التشغيل
pm2 stop magnetar-trading         # الإيقاف
pm2 monit                         # لوحة مراقبة تفاعلية
```

---

## 🤖 أوامر بوت تليغرام

| الأمر | الوظيفة |
|-------|---------|
| `/start` | عرض جميع الأوامر المتاحة |
| `/status` | عرض حالة النظام الكاملة |
| `/restart` | إعادة تشغيل محرك التداول |
| `/stop` | إيقاف محرك التداول |
| `/logs` | عرض آخر سجلات التداول والأخطاء |
| `/export` | تصدير كل السجلات كملف TXT |
| `/uptime` | عرض مدة تشغيل النظام |
| `/memory` | عرض استخدام الذاكرة والمعالج |
| `/ping` | اختبار سرعة الاستجابة |
| `/screenshot` | التقاط لقطة شاشة لمنصة التداول |
| `/reconnect` | إعادة الاتصال بـ WebSocket |
| `/reload` | إعادة تحميل الصفحة وحقن السكريبت |
| `/profit` | إحصاءات الصفقات الرابحة |
| `/loss` | إحصاءات الصفقات الخاسرة |
| `/clearlogs` | مسح جميع السجلات |

---

## 🔌 نظام WebSocket ذاتي الشفاء

النظام يراقب اتصال WebSocket بمنصة التداول ويتصرف تلقائياً:

1. **كشف البيانات المتوقفة:** إذا لم تصل بيانات لأكثر من 30 ثانية → إعادة الاتصال
2. **التراجع الأسي:** كل محاولة إعادة اتصال تنتظر ضعف الوقت السابق (5s → 10s → 20s...)
3. **أقصى محاولات:** بعد 10 محاولات فاشلة → إعادة تشغيل المحرك كاملاً
4. **كشف التجمد:** إذا لم يحدث أي نشاط لـ 2 دقيقة → تحديث الصفحة تلقائياً

---

## 📊 نقاط API المتاحة

| النقطة | الوصف |
|--------|--------|
| `GET /api/healthz` | فحص صحة الخادم |
| `GET /api/status` | حالة النظام الكاملة بصيغة JSON |
| `GET /api/status/logs/trades` | سجلات الصفقات |
| `GET /api/status/logs/errors` | سجلات الأخطاء |
| `GET /api/status/logs/websocket` | سجلات WebSocket |
| `GET /api/status/logs/runtime` | سجلات وقت التشغيل |
| `GET /api/status/logs/reconnects` | سجلات إعادة الاتصال |

---

## ⚠️ تحذيرات مهمة

1. **تسجيل الدخول:** يجب تسجيل الدخول إلى منصة التداول يدوياً مرة واحدة لحفظ الجلسة في مجلد `./session`
2. **الاستخدام المسؤول:** هذا النظام للأغراض التعليمية — التداول الآلي ينطوي على مخاطر مالية
3. **الأمان:** لا تشارك ملف `.env` مع أي أحد
4. **الاختبار:** ابدأ بحساب تجريبي (Demo) قبل التبديل إلى حساب حقيقي

---

## 🆘 استكشاف الأخطاء

### المشكلة: البوت لا يستجيب
```bash
# تحقق من صحة التوكن
curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe

# تحقق من Chat ID
curl https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
```

### المشكلة: السكريبت لا يُحقن
- تأكد من تسجيل الدخول إلى PocketOption أولاً
- جرّب HEADLESS=false لمشاهدة المتصفح مباشرة

### المشكلة: خطأ في Chromium
```bash
# على Ubuntu/Debian
sudo apt-get install -y chromium-browser

# أو استخدم المتغير
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

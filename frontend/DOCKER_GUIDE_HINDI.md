# 🐳 AI Video Studio: सम्पूर्ण डॉकर और डॉकर कम्पोज़ गाइड (Docker Guide in Hindi)

इस गाइड में **AI Video Studio**, **Suwayomi (Anime/Manga Server)**, **MongoDB** और **Frontend** को डॉकर और डॉकर कम्पोज़ के साथ चलाने और सर्वर पर डिप्लॉय करने की पूरी विधि सरल हिंदी में दी गई है।

---

## 📑 अनुक्रमणिका (Table of Contents)
1. [वातावरण (Development vs Production) में APIs का व्यवहार](#1-वातावरण-development-vs-production-में-apis-का-व्यवहार)
2. [विकल्प 1: डॉकर कम्पोज़ (Production Multi-Container Stack)](#2-विकल्प-1-डॉकर-कम्पोज़-production-multi-container-stack)
3. [विकल्प 2: डेवलपमेंट कम्पोज़ (Live Hot-Reload Stack)](#3-विकल्प-2-डेवलपमेंट-कम्पोज़-live-hot-reload-stack)
4. [विकल्प 3: ऑल-इन-वन सिंगल इमेज (All-in-One Single Docker Image)](#4-विकल्प-3-ऑल-इन-वन-सिंगल-इमेज-all-in-one-single-docker-image)
5. [डेटा सुरक्षा और पर्सिस्टेंट वॉल्यूम (Persistent Volumes)](#5-डेटा-सुरक्षा-और-पर्सिस्टेंट-वॉल्यूम)
6. [सामान्य प्रश्न और ट्रबलशूटिंग (FAQ & Troubleshooting)](#6-सामान्य-प्रश्न-और-ट्रबलशूटिंग)

---

## 1. वातावरण (Development vs Production) में APIs का व्यवहार

एप्लिकेशन आपके वातावरण (Environment) को स्वचालित रूप से पहचानती है और उसके अनुसार APIs और UI को अनुकूलित करती है:

| विशेषता | 🛠️ डेवलपमेंट वातावरण (Development) | 🚀 प्रोडक्शन वातावरण (Production) |
| :--- | :--- | :--- |
| **वातावरण मोड** | `NODE_ENV=development` | `NODE_ENV=production` |
| **UI बैज** | `🛠️ Development Mode` (पीला बैज) | `🚀 Production Mode` (हरा बैज) |
| **बैकएंड API URL** | `http://localhost:5000/api/video` (या `/api/video`) | `/api/video` (Nginx रिवर्स प्रॉक्सी) |
| **Suwayomi API URL** | `http://127.0.0.1:4567` (या `/suwayomi`) | `/suwayomi` (Nginx रिवर्स प्रॉक्सी -> `suwayomi:4567`) |
| **डेटाबेस (MongoDB)** | `mongodb://127.0.0.1:27017/aivideo` | `mongodb://mongodb:27017/aivideo` |
| **UI में स्थिति जांच** | नेवबार में ग्लोब आइकन पर क्लिक करने पर दोनों APIs की लाइव स्थिति दिखती है | नेवबार और Anime Library हेडर में दोनों APIs लाइव दिखते हैं |

---

## 2. विकल्प 1: डॉकर कम्पोज़ (Production Multi-Container Stack)

### चलाने के कमांड:
```bash
# बैकएंड या फ्रंटएंड फोल्डर से चलाएं:
docker compose up -d

# कंटेनर्स की लाइव स्थिति जांचें:
docker compose ps

# सभी कंटेनर्स के लाइव लॉग्स देखें:
docker compose logs -f

# कंटेनर्स बंद करें (डेटा सुरक्षित रहेगा):
docker compose down
```

---

## 3. विकल्प 2: डेवलपमेंट कम्पोज़ (Live Hot-Reload Stack)

```bash
docker compose -f docker-compose.dev.yml up
```
- **Frontend Live**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000/api/video`
- **Suwayomi UI**: `http://localhost:4567`

---

## 4. विकल्प 3: ऑल-इन-वन सिंगल इमेज (All-in-One Single Docker Image)

**Frontend, Backend, और Suwayomi Server तीनों एक ही सिंगल डॉकर इमेज में!**

### सिंगल इमेज को बिल्ड करने का कमांड:
*(नोट: जब आप तैयार हों तभी चलाएं)*
```bash
# मुख्य प्रोजेक्ट रूट फोल्डर से चलाएं:
docker build -f backend/Dockerfile.all-in-one -t aivideo-all-in-one:latest .
```

### सिंगल कंटेनर को सर्वर पर चलाने का कमांड:
```bash
docker run -d \
  --name aivideo-app \
  -p 80:80 \
  -p 5000:5000 \
  -p 4567:4567 \
  -v aivideo_storage:/app/backend/storage \
  -v suwayomi_data:/home/suwayomi/.local/share/Tachidesk \
  -e GEMINI_API_KEY="आपकी_GEMINI_API_KEY" \
  -e MONGODB_URI="mongodb://your_mongo_host:27017/aivideo" \
  --restart unless-stopped \
  aivideo-all-in-one:latest
```

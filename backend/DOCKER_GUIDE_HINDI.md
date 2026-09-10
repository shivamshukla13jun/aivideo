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

यह प्रोडक्शन का सबसे पसंदीदा तरीका है। इसमें चारों सेवाएं अलग-अलग सुरक्षित कंटेनरों में एक आंतरिक नेटवर्क (`aivideo-network`) पर चलती हैं:

### शामिल सेवाएं:
1. **`suwayomi`**: आधिकारिक इमेज `ghcr.io/suwayomi/tachidesk:latest` (पोर्ट `4567`)
2. **`mongodb`**: डेटाबेस इमेज `mongo:7` (पोर्ट `27017`)
3. **`backend`**: Node.js + Express + FFmpeg + Gemini AI (पोर्ट `5000`)
4. **`frontend`**: React + Vite + Nginx रिवर्स प्रॉक्सी (पोर्ट `80`)

### चलाने के कमांड:
```bash
# बैकएंड फोल्डर में जाएं
cd backend

# सभी 4 कंटेनर्स बैकग्राउंड में चालू करें
docker compose up -d

# कंटेनर्स की लाइव स्थिति जांचें
docker compose ps

# सभी कंटेनर्स के लाइव लॉग्स देखें
docker compose logs -f

# सिर्फ बैकएंड या Suwayomi के लॉग्स देखें
docker compose logs -f backend
docker compose logs -f suwayomi

# कंटेनर्स बंद करें (डेटा सुरक्षित रहेगा)
docker compose down
```

---

## 3. विकल्प 2: डेवलपमेंट कम्पोज़ (Live Hot-Reload Stack)

यदि आप डॉकर के अंदर रहते हुए कोड में बदलाव करना चाहते हैं और तुरंत लाइव रीलोड (Live Hot-Reload) देखना चाहते हैं:

### चलाने के कमांड:
```bash
cd backend

# डेवलपमेंट स्टैक चालू करें
docker compose -f docker-compose.dev.yml up

# बैकग्राउंड में चलाने के लिए:
docker compose -f docker-compose.dev.yml up -d
```
- **Frontend Live**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000/api/video`
- **Suwayomi UI**: `http://localhost:4567`

---

## 4. विकल्प 3: ऑल-इन-वन सिंगल इमेज (All-in-One Single Docker Image)

उपयोगकर्ता की विशेष मांग: **Frontend, Backend, और Suwayomi Server तीनों एक ही सिंगल डॉकर इमेज में!**
इससे आप सिर्फ 1 इमेज को Docker Hub या GitHub Packages पर पुश करके किसी भी सर्वर पर 1 कमांड से चला सकते हैं।

### सिंगल इमेज कैसे काम करती है?
- **बेस इमेज**: `ghcr.io/suwayomi/tachidesk:latest` (इसमें Java और Suwayomi पहले से स्थापित है)।
- **इनस्टॉल**: Node.js 20, Nginx, FFmpeg, और Supervisor।
- **Supervisor**: तीनों प्रक्रियाओं को एक साथ चलाता और मॉनिटर करता है:
  - 1. Suwayomi Tachidesk (`port 4567`)
  - 2. AI Video Studio Backend (`port 5000`)
  - 3. Nginx Web Server (`port 80` - फ्रंटएंड दिखाता है और `/api/` व `/suwayomi/` को प्रॉक्सी करता है)

### सिंगल इमेज को बिल्ड करने का कमांड:
*(नोट: जब आप तैयार हों तभी चलाएं, अभी स्वतः बिल्ड नहीं किया गया है)*
```bash
# प्रोजेक्ट के मुख्य रूट फोल्डर से चलाएं:
cd e:\shivam\aivideo

# ऑल-इन-वन इमेज बिल्ड करें:
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

### इमेज को Docker Hub पर अपलोड करके सर्वर पर डाउनलोड करना:
```bash
# 1. अपने Docker Hub अकाउंट में टैग करें
docker tag aivideo-all-in-one:latest yourusername/aivideo-all-in-one:latest

# 2. Docker Hub पर पुश करें
docker push yourusername/aivideo-all-in-one:latest

# 3. अपने रिमोट VPS/सर्वर पर जाएं और डाउनलोड करें
docker pull yourusername/aivideo-all-in-one:latest

# 4. सर्वर पर रन करें
docker run -d -p 80:80 -p 5000:5000 -p 4567:4567 \
  -v aivideo_storage:/app/backend/storage \
  -v suwayomi_data:/home/suwayomi/.local/share/Tachidesk \
  -e GEMINI_API_KEY="आपकी_KEY" \
  yourusername/aivideo-all-in-one:latest
```

---

## 5. डेटा सुरक्षा और पर्सिस्टेंट वॉल्यूम (Persistent Volumes)

कंटेनर बंद या अपडेट होने पर भी आपका डेटा कभी डिलीट नहीं होगा क्योंकि निम्नांकित डॉकर वॉल्यूम्स बनाए गए हैं:

1. **`aivideo_suwayomi_data`**: Suwayomi Manga डेटा, डाउनलोड की गई एनिमे/मंगा फाइल्स, और एक्सटेंशन।
2. **`aivideo_backend_storage`**: रेंडर किए गए वीडियो, अपलोड की गई इमेजेस, चैप्टर डिस्क बैकअप और कैरेक्टर मेमोरी फाइल्स।
3. **`aivideo_mongodb_data`**: MongoDB डेटाबेस फाइल्स (चैप्टर कैश, सीन सबटाइटल्स, ड्यूरेशन, थीम सेटिंग्स)।

---

## 6. सामान्य प्रश्न और ट्रबलशूटिंग (FAQ & Troubleshooting)

### प्र: क्या मुझे सर्वर पर Nginx अलग से इनस्टॉल करने की आवश्यकता है?
**उ:** नहीं! Nginx पहले से ही कंटेनर के अंदर पोर्ट 80 पर कॉन्फ़िगर किया गया है। यह फ्रंटएंड भी सर्व करता है और बैकएंड व Suwayomi दोनों APIs को स्वचालित रूप से रिवर्स प्रॉक्सी करता है।

### प्र: मैं Suwayomi का वेब इंटरफ़ेस सीधे कैसे देख सकता हूँ?
**उ:** आप सीधे ब्राउज़र में `http://your-server-ip:4567` खोल सकते हैं, या मुख्य वेब स्टूडियो से `http://your-server-ip/suwayomi` पर जा सकते हैं।

### प्र: अगर Suwayomi ऑफलाइन दिखता है तो क्या करें?
**उ:**
1. `docker compose logs suwayomi` चलाकर देखें।
2. Suwayomi पहली बार शुरू होते समय एक्सटेंशन इंडेक्स डाउनलोड करने में 20-30 सेकंड का समय लेता है।
3. UI के हेडर में दिया गया स्टेटस इंडिकेटर Suwayomi के तैयार होते ही अपने आप हरा (🟢) हो जाएगा।

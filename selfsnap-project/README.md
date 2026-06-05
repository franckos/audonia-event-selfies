# 📸 SelfSnap

**SelfSnap** is a browser-based photo booth that lets users take a **4-shot photo strip**, preview it in real time, and download or share the final image — all **without uploading or storing photos on a server**.

It’s designed to feel like a real photo booth: fixed framing, timed captures, no retakes — optimized for **mobile and desktop**.

### [Try It Now](https://selfsnap.darladavid.com/)
### [Watch the Video](https://youtu.be/dKt2zKtm6m0)
### [Read More](https://builder.aws.com/content/38xEmQgKgi1OXvVR6diRaDkJqsz/aws-ai-a-killer-combo-to-build-an-app-in-one-day)

---

## ✨ Features

- 📱 Mobile-first photo booth experience
- 🖼️ Live **2×2 grid preview** with exact framing
- ⏱️ Timer-based capture (no retakes)
- 🪞 Mirrored selfie preview
- 📤 Download & Share (Web Share API on supported devices)
- ☁️ Fully serverless
- 🔒 Privacy-first: **no uploads, no database**

---

## 🧠 How It Works

1. User selects a frame and settings
2. Camera preview shows **only the active capture box**
3. Photos are captured sequentially (4 shots)
4. A final image is composed using `<canvas>`
5. User downloads or shares the result
6. Images never leave the browser session

---

## 🏗️ Tech Stack

### Frontend
- Vue 3 (Composition API)
- TypeScript
- Vite
- Tailwind CSS
- HTML Canvas API
- Web Media APIs (`getUserMedia`)

### Backend / Infrastructure
- AWS S3 (static hosting)
- AWS CloudFront (CDN)
- AWS Lambda (frame listing API)
- AWS API Gateway
- AWS SAM (deployment)
- AWS Certificate Manager (TLS)

---

## 🧮 Layout System

- Final canvas size: **1080 × 1920**
- Grid layout: **2 × 2**
- Each photo: **3:4 aspect ratio**
- Shared math via `compute4GridSlots()`
- Booth preview and Result composition use **the same coordinates**

This guarantees **what you see in the booth is exactly what you get in the final image**.

---

## 🔒 Privacy by Design

- ❌ No image uploads
- ❌ No database
- ❌ No server-side image storage
- ✅ Images exist only in:
  - Browser memory
  - Session Storage
  - User’s device

Closing the tab clears everything.

---

## 🚀 Deployment

### Frontend

```bash
npm run build
aws s3 sync dist s3://<your-bucket> --delete
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

### Backend (AWS SAM)
```
sam build
sam deploy
```

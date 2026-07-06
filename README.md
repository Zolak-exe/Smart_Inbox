# 📬 Smart_Inbox

Mail Job Tracker is an Electron-based desktop application designed to automatically scan, categorize, and track job applications by interfacing directly with a local **ProtonMail Bridge** instance via SMTP/IMAP.

---

## 🚀 Key Features

- **Local ProtonMail Bridge Syncing**: Connects securely to the local ProtonMail email client bridge to process incoming and outgoing messages.
- **Automated Job Tracking**: Parses and indexes sent applications, interview requests, and recruiter follow-ups.
- **AI-Powered Classification**: Automatically analyzes email content and groups threads by status (Applied, Interview scheduled, Rejected, Offer received).
- **SQLite Storage**: Local-first architecture with zero external database dependencies.
- **Modern Desktop UI**: Desktop dashboard showing clean timelines and statistics of all active applications.

---

## 🛠️ Stack & Technologies

- **Frontend**: React (JS/HTML/CSS)
- **Backend/Desktop Integration**: Electron, Node.js
- **Database**: SQLite
- **Protocols**: SMTP & IMAP (Nodemailer, IMAP clients)

---

## 📦 Getting Started

### Prerequisites
- Node.js (v18+)
- A running **ProtonMail Bridge** client on your local machine.

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development mode:
   ```bash
   npm run dev
   ```

---

## 🔒 Security
Designed with privacy in mind:
- Credentials and email caches are kept 100% locally in an SQLite file.
- Direct integration with ProtonMail Bridge ensures end-to-end encryption is preserved for all mail transfers.

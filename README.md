# AO3 Journey

**Your personalized "Spotify Wrapped" for Archive of Our Own**

Track your complete AO3 journey as both a creator and reader. Get beautiful annual reports, detailed statistics, and discover your reading patterns!

![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Chrome%20%7C%20Safari-orange)

---

## ⚡ Quick Start

### 💻 Chrome Users

| Step | Action |
|:----:|--------|
| 1️⃣ | **[Install Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)** |
| 2️⃣ | **[Download AO3Journey.user.js](./AO3Journey.user.js?raw=true)** → Click "Install" |

### 📱 Safari Users (iOS/macOS)

| Step | Action |
|:----:|--------|
| 1️⃣ | **[Install Userscripts App](https://apps.apple.com/app/userscripts/id1463298887)** (Free) |
| 2️⃣ | **[Download AO3Journey-Safari.user.js](./AO3Journey-Safari.user.js?raw=true)** → Copy to Userscripts |

---

## ✨ Features

### 📊 Annual Report ("Wrapped" Style)

- **Reader Report (阅读者报告)**: Your reading journey throughout the year
  - Total works read and word count
  - Most-read fandoms, relationships, and tags
  - Your favorite author and their most-viewed work
  - Reading milestones and fun statistics

- **Creator Report (创作者报告)**: Your creative contributions
  - Works published and total word count
  - Kudos and comments received
  - Your most popular work
  - Loyal readers who support your writing

### 📈 Yearly Statistics

- Detailed breakdown by year
- Top fandoms, relationships, and tropes
- Most revisited works
- Popular works and engagement metrics

### 🎨 Interactive UI

- Swipeable card interface
- Responsive design for desktop, tablet, and mobile
- Gradient backgrounds and smooth animations
- Dark rose theme matching AO3's aesthetic

### 💾 Smart Caching

- Local storage caching for faster subsequent loads
- Incremental scanning (only fetches new data)
- Progress saving during long scans (resume if interrupted)
- Force refresh option when needed

### 📸 Export Feature

- Export annual reports as high-quality PNG images
- Export yearly statistics
- iOS: Native share sheet support
- Perfect for sharing on social media

---

## 📥 Detailed Installation

### For Chrome

**Step 1: Install Tampermonkey Extension**
- Download from **[Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)**

**Step 2: Install the Script**
- Click **[AO3Journey.user.js](./AO3Journey.user.js?raw=true)**
- Tampermonkey will automatically detect and prompt installation
- Click **"Install"**
- Done! 🎉

### For Safari (iOS/macOS)

**Step 1: Install Userscripts App**
- Download from **[App Store](https://apps.apple.com/app/userscripts/id1463298887)** (Free!)

**Step 2: Enable the Extension**
- **iOS**: Settings → Safari → Extensions → Userscripts → Enable
- **macOS**: Safari → Settings → Extensions → Enable "Userscripts"

**Step 3: Install the Script**
- Open **[AO3Journey-Safari.user.js](./AO3Journey-Safari.user.js?raw=true)**
- Select all and copy the script
- Open Userscripts app → Tap **"+"** → Create new script
- Paste and save
- Done! 🎉

---

## 🚀 How to Use

1. **Navigate to AO3**
   - Go to [archiveofourown.org](https://archiveofourown.org)
   - Make sure you're logged in

2. **Launch AO3 Journey**
   - Click the floating **"📊 My AO3 Journey"** button (bottom-right corner)

3. **Confirm Adult Content Warning**
   - The script needs to access your reading history which may include adult-rated works
   - Click **"Yes, Continue"** to proceed

4. **Wait for Scanning**
   - First scan may take a few minutes depending on your history size
   - Progress is shown in real-time
   - If interrupted, you can resume from where you left off!
   - Subsequent scans are much faster due to caching

5. **Explore Your Journey**
   - Swipe between Reader and Creator reports
   - Click year tabs to see detailed yearly statistics
   - Use the **Export** button to save images

---

## 🔧 Requirements

- **AO3 Account**: Must be logged in
- **History Enabled**: Go to My Dashboard → Preferences → Misc → Turn on History
- **Browser**: Chrome (with Tampermonkey) or Safari (with Userscripts app)

---

## 📋 Privacy & Permissions

This script:
- ✅ Reads your public profile and works
- ✅ Reads your reading history
- ✅ Reads your inbox for comment/kudos data
- ✅ Stores data locally in your browser's localStorage
- ❌ Does **NOT** send any data to external servers
- ❌ Does **NOT** modify any AO3 content

**All data stays on your device!**

---

## 🐛 Troubleshooting

### "No Data Found" Message
- Make sure History is enabled: My Dashboard → Preferences → Misc → Turn on History
- Ensure you're logged into AO3

### Scanning Takes Too Long
- Large histories may take 5-10 minutes on first scan
- Subsequent scans use cached data and are much faster
- Don't close the tab during scanning
- If interrupted, you'll be prompted to resume next time

### Export Issues
- Make sure the report is fully loaded before exporting
- Try scrolling through the entire report first
- On iOS, images can be shared via the native share sheet

### Script Not Appearing
- Refresh the AO3 page
- Check that Tampermonkey/Userscripts extension is enabled
- Verify the script is enabled in your extension settings

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests

---

## 📄 License

MIT License - feel free to use, modify, and distribute!

---

## 👤 Author

**No21_lqz**

---

## 💖 Acknowledgments

- Inspired by LOFTER Wrapped
- Built for the amazing AO3 community
- Thanks to all the fanfic writers and readers!
- Thanks to Cursor, Gemini, Claude, and Deepseek

---

*到了八十岁，也要继续搞同人！* 🌸

*愿你永远热爱，永远年轻*

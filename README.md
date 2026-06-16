# BigQuery Release Insights Hub 🚀

A modern, responsive single-page web dashboard built using **Python Flask** and **plain vanilla HTML, CSS, and JavaScript** that aggregates, caches, parses, and searches the Google Cloud BigQuery Release Notes, and lets you draft and share updates directly to X (formerly Twitter).

---

## ✨ Features

- **Automated RSS Feed Parsing**: Fetches the official Google Cloud BigQuery XML feed and breaks down entries into structured update types (`Feature`, `Changed`, `Issue`, `Deprecated`).
- **Server-Side Cache**: Prevents rate limits and optimizes page loads by caching feed content for 1 hour, with manual force-refresh capabilities.
- **Dynamic Search & Categories**: Quick text search and filter pills to drill down into release notes immediately.
- **Custom Tweet Builder**: Selecting any update card loads a tweet draft with:
  - Twitter character counter (with standard 23-character t.co URL limits).
  - Editable draft preview area.
  - Quick launch link for the official Twitter/X Web Intent.
  - Click-to-copy text and raw HTML options.
- **Premium Glassmorphic Theme**: Dark mode design layout, card scaling hover effects, glowing custom badges, and skeleton loading screens.

---

## 📁 Project Structure

```
├── app.py                  # Flask application server (caching & beautifulsoup xml parsing)
├── requirements.txt        # Backend dependencies
├── templates/
│   └── index.html          # Semantic HTML5 frontend layout with SVG icons
└── static/
    ├── css/
    │   └── styles.css      # Custom stylesheet (Glassmorphic variables, animations)
    └── js/
        └── app.js          # State management (filters, character counter, sharing)
```

---

## 🚀 Installation & Local Run

### Prerequisites
Make sure you have Python 3.8+ installed on your machine.

### 1. Clone the repository
```bash
git clone https://github.com/lbhumika12/antigravity.git
cd antigravity
```

### 2. Install dependencies
Install the required packages using pip:
```bash
pip install -r requirements.txt
```

### 3. Run the application
Start the development server:
```bash
python app.py
```

### 4. Open the Web Hub
Open your browser and navigate to:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🛠️ How Caching & Normalization Work

1. **Feed Sync**: The backend parses `<content>` HTML inside Atom feed entries. It partitions text by `<h3>` tags to extract individual updates.
2. **Twitter t.co URL Limit**: Twitter maps all URLs to exactly 23 characters regardless of length. The client-side script matches URLs using regular expressions and corrects the character length progress bar accordingly, ensuring accuracy.

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).

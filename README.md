<div align="center">
  <h1>TextTidy</h1>
  <p><strong>A beautifully simple, lightning-fast browser extension that turns long text into bite-sized summaries using the power of Google Gemini.</strong></p>
</div>

---

## 👋 Hey there! Welcome to the project!

Ever found yourself staring at a giant wall of text and thought, *"I just need the TL;DR!"*? That's exactly why this extension exists. 

This is a lightweight browser extension (works on both Chrome and Edge) that lets you highlight any text on any webpage and instantly get a concise, 3-bullet-point summary.

## 🚀 Why you'll love it

* **The Floating Button:** Just highlight any text (20+ characters), and a sleek little "Summarize" button pops up right next to your cursor.
* **Right-Click Friendly:** Old school? No problem. Highlight your text, right-click, and select "Summarize with AI".
* **Blink-and-you-miss-it Speed:** It uses the `gemini-2.5-flash-lite` model under the hood, meaning you get answers almost instantly without lagging your browser.
* **Smart UI:** The summary popup calculates its own position, ensuring it never gets cut off at the edge of your screen.
* **Zero Bloat:** Built with pure Vanilla HTML, CSS, and JavaScript. No heavy frameworks. It's clean, fast, and does exactly what it says on the tin.

## 🛠️ What's under the hood?

I wanted to keep things simple but modern. Here's what's running the show:

* **Core:** Vanilla JavaScript, HTML5, CSS3
* **Architecture:** Manifest V3 (The latest standard for browser extensions)
* **AI Brain:** Google Gemini API (`gemini-2.5-flash-lite`)
* **Background Heavy Lifting:** Service Workers (`background.js`)

## 📦 How to install and try it out (Developer Mode)

Since this project isn't on the official Chrome Web Store (yet!), you can easily run it locally. Here's how:

1. **Grab the code:** Clone or download this repository to your computer.
2. **Open your browser's extension page:**
   * **Chrome:** Type `chrome://extensions/` in your address bar.
   * **Edge:** Type `edge://extensions/` in your address bar.
3. **Turn on Developer Mode:** Look for the "Developer mode" toggle (usually top right or bottom left) and switch it on.
4. **Load the project:** Click the **"Load unpacked"** button.
5. **Select the folder:** Find the folder where you downloaded this project and select it.
6. 🎉 *Boom!* The extension is installed and ready to go.

## 🔑 A quick note about the API Key

To wake the AI up, you'll need your own Google Gemini API Key. Don't worry, it's free and easy to get:

1. Head over to [Google AI Studio](https://aistudio.google.com/) and create a free API key.
2. Open the `background.js` file in this project.
3. Find the API key configuration near the top and paste your key in.

## 🧠 How it actually works (for the curious)

1. **`content.js`** is the watchful eye. It monitors when you highlight text, figures out where your cursor is, and shows the UI.
2. When you click summarize, it passes the text back to **`background.js`** (our invisible service worker).
3. **`background.js`** securely wraps up your text and asks the Gemini API to do its thing.
4. The response travels back to **`content.js`**, which beautifully animates the 3-bullet summary onto your screen.

## 🤝 Want to contribute?

Feel free to fork this project, submit a pull request, or open an issue if you find a bug. Whether it's making the UI even sleeker or adding new features, contributions are always welcome!

---
*Built with ❤️ to make reading the web a whole lot easier.*

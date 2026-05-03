// This file acts as the background worker for the extension.
// It manages the connection to the AI, handles right-click menu actions, 
// and talks to the content script running on webpages.

// Store your Google Gemini API key and endpoint here.
const GEMINI_API_KEY = 'put here own API key';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

// We use these variables to prevent making too many requests to the AI at once (rate limiting).
let lastRequestTime = 0;
const MIN_REQUEST_GAP_MS = 1500; // Wait at least 1.5 seconds between each request

// When the extension is installed, add a "Summarize with AI" option to the right-click menu.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'ais-summarize-ctx',
    title: 'Summarize with AI',
    contexts: ['selection'],
  });
});

// Listen for when the user clicks the "Summarize with AI" option in the right-click menu.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'ais-summarize-ctx' && info.selectionText) {
    // Try to send the selected text to the webpage so it can show the popup summary there.
    chrome.tabs.sendMessage(tab.id, {
      type: 'AIS_CONTEXT_MENU_SUMMARIZE',
      text: info.selectionText,
    }, async (response) => {
      // If the webpage cannot receive messages (like on a PDF viewer), we handle it directly in the background.
      if (chrome.runtime.lastError) {
        // Show a loading notification to the user.
        chrome.notifications.create('ais-loading', {
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'AI Summarizer',
          message: 'Summarizing selected text from PDF...',
        });

        // Ask the AI to summarize the text.
        const result = await handleSummarize(info.selectionText);

        // Remove the loading notification and show the final summary or an error message.
        chrome.notifications.clear('ais-loading');
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'AI Summary',
          message: result.success ? result.summary : `Error: ${result.error}`,
        });
      }
    });
  }
});

// Listen for messages from the webpage requesting a summary.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'AIS_SUMMARIZE') {
    // Process the summary and send the result back to the webpage.
    handleSummarize(message.text)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: err.message }));

    // Return true to keep the connection open until we have the AI's response.
    return true;
  }
});

// This is the core function that communicates with the Google Gemini API.
async function handleSummarize(text) {
  // Check if we are making requests too quickly.
  const now = Date.now();
  if (now - lastRequestTime < MIN_REQUEST_GAP_MS) {
    return {
      success: false,
      error: 'Please wait a moment before making another request.',
    };
  }
  lastRequestTime = now;

  // Make sure the selected text is long enough to actually summarize.
  if (!text || text.trim().length < 20) {
    return { success: false, error: 'Selected text is too short to summarize.' };
  }

  // Give a clear error if the API key hasn't been set up yet.
  if (GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
    return {
      success: false,
      error: 'API key not configured. Open background.js and replace YOUR_API_KEY_HERE with your Gemini API key.',
    };
  }

  // Create the instructions (prompt) for the AI, asking it to make bullet points.
  const prompt = `Extract the most important key points from the following text and list them as bullet points:\n\n${text.trim()}`;

  // Package up the prompt and the settings for the AI response.
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4, // Lower temperature means more focused and factual responses.
      maxOutputTokens: 3000,
    },
  };

  try {
    // Send the request to the Google Gemini API.
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Handle any errors that the API might send back (like rate limits or bad API keys).
    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      const status = response.status;

      if (status === 429) {
        return { success: false, error: 'Rate limit exceeded. Please try again later.' };
      }
      if (status === 403) {
        return { success: false, error: 'API key is invalid or unauthorized.' };
      }

      const apiMsg = errData?.error?.message || `API returned status ${status}`;
      return { success: false, error: apiMsg };
    }

    // Read the successful response from the AI.
    const data = await response.json();

    // Extract the summary text and the number of tokens used.
    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    const tokenCount = data?.usageMetadata?.totalTokenCount || 0;

    // If the AI somehow didn't return text, let the user know.
    if (!summary) {
      return { success: false, error: 'The AI returned an empty response. Try selecting different text.' };
    }

    // Return the successful summary so it can be displayed.
    return { success: true, summary, tokenCount };
  } catch (networkErr) {
    // If the fetch fails entirely (e.g., no internet), catch it here.
    return {
      success: false,
      error: `Network error: ${networkErr.message}. Check your internet connection.`,
    };
  }
}

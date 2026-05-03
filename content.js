// This file runs on the webpages you visit.
// It watches for when you select text, shows the "Summarize" button,
// and displays the AI summary popup on the screen.

(() => {
  'use strict';

  // Minimum number of characters needed to show the summarize button.
  const MIN_SELECTION_LENGTH = 20;
  // How long to wait after you stop selecting text before showing the button.
  const DEBOUNCE_DELAY = 200;

  // Variables to keep track of the current state.
  let debounceTimer = null;
  let isRequestInFlight = false;
  let currentSelectionText = '';

  // Simple SVG icons used in the UI (no external images needed).
  const ICONS = {
    sparkle: `<svg class="ais-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>`,
    copy: `<svg class="ais-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    check: `<svg class="ais-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    alertCircle: `<svg class="ais-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  // Helper functions to remove the popup and button smoothly.
  function removeElement(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('ais-fade-out'); // Add fade out animation class
      setTimeout(() => el.remove(), 180); // Wait for animation to finish before removing
    }
  }

  function removeButton() {
    removeElement('ais-summarize-btn');
  }

  function removePopup() {
    removeElement('ais-popup');
  }

  function removeAll() {
    removeButton();
    removePopup();
  }

  // Places an element near the text you selected.
  // It automatically adjusts the position so the popup never goes off the edge of the screen.
  function positionNearRect(element, rect, offsetY = 8) {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    let top = rect.bottom + scrollY + offsetY;
    let left = rect.left + scrollX + (rect.width / 2);

    // Fine-tune the position once the browser has drawn the element.
    requestAnimationFrame(() => {
      const elRect = element.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Keep it within the left and right edges.
      if (left + elRect.width / 2 > vw + scrollX - 12) {
        left = vw + scrollX - elRect.width - 12;
      }
      if (left - elRect.width / 2 < scrollX + 12) {
        left = scrollX + 12;
      } else {
        left -= elRect.width / 2;
      }

      // If there's no room below the text, show the popup above it instead.
      if (rect.bottom + elRect.height + offsetY > vh) {
        top = rect.top + scrollY - elRect.height - offsetY;
      }

      element.style.top = `${Math.max(scrollY + 4, top)}px`;
      element.style.left = `${Math.max(scrollX + 4, left)}px`;
    });

    // Set the initial position right away.
    element.style.top = `${top}px`;
    element.style.left = `${left}px`;
  }

  // Shows the floating "Summarize" button when text is selected.
  function showButton(rect, selectedText) {
    removeButton(); // Clear any existing button first.

    const btn = document.createElement('button');
    btn.id = 'ais-summarize-btn';
    btn.innerHTML = `${ICONS.sparkle} Summarize`;
    document.body.appendChild(btn);
    positionNearRect(btn, rect, 6);

    // When the button is clicked, start the summarization process.
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeButton();
      triggerSummarize(selectedText, rect);
    });
  }

  // Creates the main frame for the popup window (header and body).
  function createPopupShell() {
    removePopup(); // Clear any existing popup.

    const popup = document.createElement('div');
    popup.id = 'ais-popup';

    // Create the top title bar of the popup.
    const header = document.createElement('div');
    header.className = 'ais-header';
    header.innerHTML = `<span class="ais-header-title">${ICONS.sparkle} AI Summary</span>`;
    
    // Add the "X" close button.
    const closeBtn = document.createElement('button');
    closeBtn.className = 'ais-close-btn';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removePopup();
    });
    header.appendChild(closeBtn);

    // Create the content area of the popup.
    const body = document.createElement('div');
    body.className = 'ais-body';

    popup.appendChild(header);
    popup.appendChild(body);

    return { popup, body };
  }

  // Shows a loading animation inside the popup while waiting for the AI.
  function showLoadingPopup(rect) {
    const { popup, body } = createPopupShell();

    body.innerHTML = `
      <div class="ais-loading">
        <div class="ais-spinner"></div>
        <span class="ais-loading-text">Summarizing with AI…</span>
      </div>
    `;

    document.body.appendChild(popup);
    positionNearRect(popup, rect, 10);

    return { popup, body };
  }

  // Updates the popup body to display the final AI summary.
  function showSummary(body, responseData) {
    const summaryText = responseData.summary;
    const tokens = responseData.tokenCount;

    // Clean up bold Markdown stars (**) just in case the AI added them.
    const cleanText = summaryText.replace(/\*\*/g, '').trim();

    const textContainer = document.createElement('div');
    textContainer.style.whiteSpace = 'pre-wrap'; // Keeps the line breaks from the AI.
    textContainer.style.fontSize = '12.5px';
    textContainer.style.lineHeight = '1.6';
    textContainer.style.color = 'var(--ais-text)';
    textContainer.textContent = cleanText;

    body.innerHTML = '';
    body.appendChild(textContainer);

    // Build the bottom footer bar with the "Copy" button.
    const popup = body.parentElement;
    const footer = document.createElement('div');
    footer.className = 'ais-footer';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'ais-copy-btn';
    copyBtn.innerHTML = `${ICONS.copy} Copy`;
    
    // Handle copying the text to the clipboard.
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(cleanText).then(() => {
        copyBtn.innerHTML = `${ICONS.check} Copied!`;
        copyBtn.classList.add('ais-copied');
        
        // Change it back to "Copy" after 2 seconds.
        setTimeout(() => {
          copyBtn.innerHTML = `${ICONS.copy} Copy`;
          copyBtn.classList.remove('ais-copied');
        }, 2000);
      });
    });

    const branding = document.createElement('span');
    branding.className = 'ais-branding';
    branding.textContent = tokens ? `⚡ ${tokens} tokens • Powered by Gemini` : 'Powered by Gemini';

    footer.appendChild(copyBtn);
    footer.appendChild(branding);
    popup.appendChild(footer);
  }

  // Shows an error message in the popup if something goes wrong.
  function showError(body, errorMessage) {
    body.innerHTML = `
      <div class="ais-error">
        ${ICONS.alertCircle}
        <span>${escapeHTML(errorMessage)}</span>
      </div>
    `;
  }

  // The main function that starts the request to background.js
  function triggerSummarize(text, rect) {
    if (isRequestInFlight) return; // Don't allow multiple requests at once.
    isRequestInFlight = true;

    // Show the loading state.
    const { popup, body } = showLoadingPopup(rect);

    // Send the selected text to background.js so it can call the Gemini API.
    chrome.runtime.sendMessage(
      { type: 'AIS_SUMMARIZE', text },
      (response) => {
        isRequestInFlight = false;

        // If the user closed the popup while waiting, do nothing.
        if (!document.getElementById('ais-popup')) return;

        // If we couldn't reach background.js.
        if (chrome.runtime.lastError) {
          showError(body, 'Extension communication error. Try reloading the page.');
          return;
        }

        // Show the summary if successful, otherwise show the error.
        if (response && response.success) {
          showSummary(body, response);
        } else {
          showError(body, response?.error || 'An unknown error occurred.');
        }
      }
    );
  }

  // Secures against injecting harmful code into the webpage.
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // Listen for the user releasing the mouse button to detect a text selection.
  document.addEventListener('mouseup', (e) => {
    // Ignore clicks on our own popup or button so they don't vanish unexpectedly.
    if (e.target.closest('#ais-summarize-btn, #ais-popup')) return;

    // Reset the wait timer.
    clearTimeout(debounceTimer);
    
    // Wait slightly before checking the selection.
    debounceTimer = setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() || '';

      // Text is too short to summarize, hide the button.
      if (text.length < MIN_SELECTION_LENGTH) {
        removeButton();
        return;
      }

      // If it's the exact same text, don't keep recreating the button.
      if (text === currentSelectionText && document.getElementById('ais-summarize-btn')) {
        return;
      }
      currentSelectionText = text;

      // Get the coordinates of the text selection on the screen.
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      showButton(rect, text);
    }, DEBOUNCE_DELAY);
  });

  // Hide the popup and button if the user clicks somewhere else on the page.
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('#ais-popup, #ais-summarize-btn')) {
      removeAll();
      currentSelectionText = '';
    }
  });

  // Hide the popup and button if the user presses the Escape key.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      removeAll();
      currentSelectionText = '';
    }
  });

  // Listen for messages from background.js when the user clicks the right-click menu option.
  chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    if (message.type === 'AIS_CONTEXT_MENU_SUMMARIZE' && message.text) {
      const selection = window.getSelection();
      let rect;

      // Try to find where the selected text is so we can show the popup there.
      if (selection && selection.rangeCount > 0) {
        rect = selection.getRangeAt(0).getBoundingClientRect();
      } else {
        // If we can't find the location, put the popup in the middle of the screen.
        rect = {
          top: window.innerHeight / 3,
          bottom: window.innerHeight / 3 + 10,
          left: window.innerWidth / 2 - 150,
          width: 300,
        };
      }

      // Start the summarization process immediately.
      triggerSummarize(message.text, rect);
    }
  });
})();

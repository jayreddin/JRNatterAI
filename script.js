// ---- GLOBALS ----
let chatHistory = [];
let currentChat = [];
let streamingMode = false;
let multiModelMode = false;
let selectedModels = [];
let contextDocuments = []; // For context management
let userSettings = {
  textSize: 16,
  theme: 'light',
  streamingMode: false,
  multiModelMode: false,
  enabledModels: [
    "gpt-4o-mini", "gpt-4o", "o1", "o1-mini", "o1-pro", "o3", "o3-mini", "o4-mini", "gpt-4.1", "gpt-4.1-mini",
    "gpt-4.1-nano", "gpt-4.5-preview", "claude-3-7-sonnet", "claude-3-5-sonnet", "deepseek-chat", "deepseek-reasoner",
    "gemini-2.0-flash", "gemini-1.5-flash", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo", "mistral-large-latest", "pixtral-large-latest", "codestral-latest", "google/gemma-2-27b-it", "grok-beta"
  ],
  speechVoice: "en-US", // Default speech voice
  customThemes: [], // For custom themes
  keyboardShortcuts: {
    sendMessage: 'Enter',
    newChat: 'Alt+N',
    searchMessages: 'Ctrl+F',
    toggleSettings: 'Alt+S'
  },
  markdownEnabled: true, // Enable markdown by default
  tokenUsage: {
    current: 0,
    limit: 4000
  }
};

// Define toggle functions
window.toggleStreamingMode = function(enabled) {
  try {
    streamingMode = enabled;
    userSettings.streamingMode = enabled;
    saveSettings();
    updateModelSelectOptions();

    // Update UI to reflect streaming mode
    const streamToggle = document.getElementById('streaming-toggle');
    if (streamToggle) {
      streamToggle.checked = enabled;
    }

    // Disable non-streaming models
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) {
      Array.from(modelSelect.options).forEach(option => {
        option.disabled = enabled && !isModelStreamCapable(option.value);
      });
    }
  } catch (error) {
    console.error('Error toggling streaming mode:', error);
  }
};

window.toggleMultiModel = function(enabled) {
  try {
    multiModelMode = enabled;
    userSettings.multiModelMode = enabled;
    saveSettings();

    // Update UI
    const multiToggle = document.getElementById('multi-toggle');
    if (multiToggle) {
      multiToggle.checked = enabled;
    }

    // Update UI for multi-model selection
    const modelSelect = document.getElementById('model-select');
    const container = document.getElementById('model-select-container');

    if (!modelSelect || !container) return;

    if (enabled) {
      // Hide main model dropdown
      modelSelect.style.display = 'none';

      // Initialize selected models with the current selection if empty
      if (selectedModels.length === 0) {
        selectedModels = [modelSelect.value];
      }

      // Create multi-select container if it doesn't exist
      if (!document.getElementById('multi-model-container')) {
        const multiContainer = document.createElement('div');
        multiContainer.id = 'multi-model-container';
        multiContainer.className = 'multi-model-container';
        container.appendChild(multiContainer);

        // Add model selector with + button
        const modelSelectorContainer = document.createElement('div');
        modelSelectorContainer.id = 'model-selector-container';
        modelSelectorContainer.className = 'model-selector-container';

        // Create new dropdown for model selection
        const newModelSelect = document.createElement('select');
        newModelSelect.id = 'multi-model-select';
        newModelSelect.className = 'bg-gray-50 border rounded-cool py-1 px-3 text-sm dark:bg-gray-800';

        // Clone options from main model select
        Array.from(modelSelect.options).forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.textContent;
          option.disabled = selectedModels.includes(opt.value);
          newModelSelect.appendChild(option);
        });

        const addButton = document.createElement('button');
        addButton.id = 'add-model-btn';
        addButton.innerHTML = '<i class="fa fa-plus"></i>';
        addButton.className = 'ml-2 px-2 py-1 bg-blue-600 text-white rounded-full hover:bg-blue-700';
        addButton.onclick = (e) => {
          e.preventDefault();
          const selectedValue = newModelSelect.value;
          if (selectedValue && !selectedModels.includes(selectedValue)) {
            selectedModels.push(selectedValue);
            updateMultiModelDisplay();

            // Disable this option in the dropdown
            const option = newModelSelect.querySelector(`option[value="${selectedValue}"]`);
            if (option) option.disabled = true;

            // Select first non-disabled option
            const firstAvailableOption = newModelSelect.querySelector('option:not([disabled])');
            if (firstAvailableOption) newModelSelect.value = firstAvailableOption.value;
          }
        };

        modelSelectorContainer.appendChild(newModelSelect);
        modelSelectorContainer.appendChild(addButton);
        container.appendChild(modelSelectorContainer);
      }
    } else {
      // Keep only the first selected model when turning off multi-model mode
      selectedModels = selectedModels.length > 0 ? [selectedModels[0]] : [modelSelect.value];

      // Restore visibility to the model select dropdown
      modelSelect.style.display = '';

      // Clean up the UI
      const multiContainer = document.getElementById('multi-model-container');
      if (multiContainer) multiContainer.remove();

      const modelSelectorContainer = document.getElementById('model-selector-container');
      if (modelSelectorContainer) modelSelectorContainer.remove();
    }

    updateMultiModelDisplay();
  } catch (error) {
    console.error('Error toggling multi-model mode:', error);
  }
}

// Update multi-model display with selected models
function updateMultiModelDisplay() {
  const container = document.getElementById('multi-model-container');
  if (!container) return;

  container.innerHTML = '';

  // Create a chip for each selected model
  selectedModels.forEach((model, idx) => {
    const chip = document.createElement('div');
    chip.className = 'inline-flex items-center bg-blue-100 dark:bg-blue-900 px-3 py-1 rounded-full text-sm';

    // Truncate long model names for display purposes
    const displayName = model.length > 30 ? model.substring(0, 27) + '...' : model;

    chip.innerHTML = `
      <span title="${model}" class="mr-1">${displayName}</span>
      <button class="text-red-500 hover:text-red-700 focus:outline-none" 
              onclick="removeSelectedModel(${idx})">
        <i class="fa fa-times-circle"></i>
      </button>
    `;
    container.appendChild(chip);
  });
}

// Global function for removing models from multi-model selection
window.removeModel = function(idx) {
  selectedModels.splice(idx, 1);
  if (selectedModels.length === 0) {
    const modelSelect = document.getElementById('model-select');
    selectedModels = modelSelect ? [modelSelect.value] : ["gpt-4o-mini"];
  }
  updateMultiModelDisplay();
};

// Make functions available globally
window.toggleStreamingMode = toggleStreamingMode;
window.toggleMultiModel = toggleMultiModel;

// Response cache implementation
const responseCache = {
  cache: new Map(),
  maxSize: 100,

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  },

  get(key) {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < 3600000) { // 1 hour cache
      return entry.value;
    }
    return null;
  },

  clear() {
    this.cache.clear();
  }
};

// Debouncing implementation
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Garbage collection for chat history
function cleanupChatHistory() {
  const maxMessages = 1000;
  if (chatHistory.length > maxMessages) {
    chatHistory = chatHistory.slice(-maxMessages);
  }

  // Clean up memory from deleted messages
  if (currentChat.length > maxMessages) {
    currentChat = currentChat.slice(-maxMessages);
  }

  // Force garbage collection of unused images
  document.querySelectorAll('img').forEach(img => {
    if (!img.parentNode) {
      URL.revokeObjectURL(img.src);
    }
  });
}

// Message threading implementation
const messageThreads = new Map();

function createThread(messageId) {
  return {
    id: messageId,
    messages: [],
    children: new Set(),
    parent: null
  };
}

function addMessageToThread(message, threadId = null) {
  if (!threadId) {
    threadId = Date.now().toString();
    messageThreads.set(threadId, createThread(threadId));
  }

  const thread = messageThreads.get(threadId);
  if (thread) {
    thread.messages.push(message);
    return threadId;
  }
  return null;
}

function renderThreadedChat() {
  const container = document.getElementById('chat-container');
  container.innerHTML = '';

  // Render main thread
  messageThreads.forEach((thread, threadId) => {
    if (!thread.parent) {
      renderThread(thread, container);
    }
  });
}

function renderThread(thread, container) {
  const threadDiv = document.createElement('div');
  threadDiv.className = 'thread-container mb-4';

  thread.messages.forEach(message => {
    const messageDiv = createMessageElement(message);
    threadDiv.appendChild(messageDiv);
  });

  // Render child threads
  thread.children.forEach(childId => {
    const childThread = messageThreads.get(childId);
    if (childThread) {
      const childDiv = document.createElement('div');
      childDiv.className = 'ml-8 border-l-2 pl-4 mt-2';
      renderThread(childThread, childDiv);
      threadDiv.appendChild(childDiv);
    }
  });

  container.appendChild(threadDiv);
}

// Run cleanup periodically
setInterval(cleanupChatHistory, 300000); // Every 5 minutes

let isDarkMode = false;
// Utility for date/time
function nowStr() {
  let d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
// ---- UI MODES ----
function setTheme(mode) {
  document.body.classList.remove('dark-mode');
  if (mode === 'dark') { document.body.classList.add('dark-mode'); }
  if (mode === 'sunset') {
    document.body.style.background = "linear-gradient(120deg,#ffecd2 0%,#fcb69f 100%)";
    document.body.style.color = "#46251a";
  } else if (mode === 'multicolored') {
    document.body.style.background = "linear-gradient(120deg,#89f7fe 0%,#66a6ff 100%)";
    document.body.style.color = "#163253";
  } else if (mode === 'dark') {
    document.body.style.background = "#181a1b";
    document.body.style.color = "#e5e7eb";
  } else {
    // reset
    document.body.style.background = "#fafafa";
    document.body.style.color = "#24292f";
  }
  userSettings.theme = mode;
  saveSettings();
}

// Toggle streaming mode
function toggleStreamingMode(enabled) {
  try {
    streamingMode = enabled;
    userSettings.streamingMode = enabled;
    saveSettings();
    updateModelSelectOptions();

    // Update UI to reflect streaming mode
    const streamToggle = document.getElementById('streaming-toggle');
    if (streamToggle) {
      streamToggle.checked = enabled;
    }

    // Disable non-streaming models
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) {
      Array.from(modelSelect.options).forEach(option => {
        option.disabled = enabled && !isModelStreamCapable(option.value);
      });
    }
  } catch (error) {
    console.error('Error toggling streaming mode:', error);
  }
}

// Toggle multi-model mode
function toggleMultiModel(enabled) {
  try {
    multiModelMode = enabled;
    userSettings.multiModelMode = enabled;
    saveSettings();

    // Update UI
    const multiToggle = document.getElementById('multi-toggle');
    if (multiToggle) {
      multiToggle.checked = enabled;
    }

    // Update UI for multi-model selection
    const modelSelect = document.getElementById('model-select');
    const container = document.getElementById('model-select-container');

    if (!modelSelect || !container) return;

    if (enabled) {
      // Initialize selected models with the current selection if empty
      if (selectedModels.length === 0) {
        selectedModels = [modelSelect.value];
      }

      // Create multi-select container if it doesn't exist
      if (!document.getElementById('multi-model-container')) {
        const multiContainer = document.createElement('div');
        multiContainer.id = 'multi-model-container';
        multiContainer.className = 'flex flex-wrap gap-2 mt-4 pb-2 overflow-y-auto max-h-32';
        container.appendChild(multiContainer);

        // Add model selector with + button
        const modelSelectorContainer = document.createElement('div');
        modelSelectorContainer.id = 'model-selector-container';
        modelSelectorContainer.className = 'flex items-center mt-2';

        const newModelSelect = document.createElement('select');
        newModelSelect.id = 'multi-model-select';
        newModelSelect.className = 'bg-gray-50 border rounded-cool py-1 px-3 text-sm dark:bg-gray-800';

        // Clone options from main model select
        Array.from(modelSelect.options).forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.textContent;
          // Disable options that are already selected
          option.disabled = selectedModels.includes(opt.value);
          newModelSelect.appendChild(option);
        });

        const addButton = document.createElement('button');
        addButton.innerHTML = '<i class="fa fa-plus"></i>';
        addButton.className = 'ml-2 px-2 py-1 bg-blue-600 text-white rounded-full hover:bg-blue-700';
        addButton.onclick = (e) => {
          e.preventDefault();
          const selectedValue = newModelSelect.value;
          if (selectedValue && !selectedModels.includes(selectedValue)) {
            selectedModels.push(selectedValue);
            updateMultiModelDisplay();

            // Disable this option in the multi-model select dropdown
            const option = newModelSelect.querySelector(`option[value="${selectedValue}"]`);
            if (option) option.disabled = true;

            // Select first non-disabled option
            const firstAvailableOption = newModelSelect.querySelector('option:not([disabled])');
            if (firstAvailableOption) newModelSelect.value = firstAvailableOption.value;
          }
        };

        modelSelectorContainer.appendChild(newModelSelect);
        modelSelectorContainer.appendChild(addButton);
        container.appendChild(modelSelectorContainer);
      }
    } else {
      // Keep only the first selected model when turning off multi-model mode
      selectedModels = selectedModels.length > 0 ? [selectedModels[0]] : [modelSelect.value];

      // Clean up the UI
      const multiContainer = document.getElementById('multi-model-container');
      if (multiContainer) multiContainer.remove();

      const modelSelectorContainer = document.getElementById('model-selector-container');
      if (modelSelectorContainer) modelSelectorContainer.remove();
    }

    updateMultiModelDisplay();
  } catch (error) {
    console.error('Error toggling multi-model mode:', error);
  }
}

// Update multi-model display with selected models
function updateMultiModelDisplay() {
  const container = document.getElementById('multi-model-container');
  if (!container) return;

  container.innerHTML = '';

  // Create a chip for each selected model
  selectedModels.forEach((model, idx) => {
    const chip = document.createElement('div');
    chip.className = 'inline-flex items-center bg-blue-100 dark:bg-blue-900 px-3 py-1 rounded-full text-sm';

    // Truncate long model names for display purposes
    const displayName = model.length > 30 ? model.substring(0, 27) + '...' : model;

    chip.innerHTML = `
      <span title="${model}" class="mr-1">${displayName}</span>
      <button class="text-red-500 hover:text-red-700 focus:outline-none" 
              onclick="removeSelectedModel(${idx})">
        <i class="fa fa-times-circle"></i>
      </button>
    `;
    container.appendChild(chip);
  });
}

// Remove a model from the selected models list
window.removeSelectedModel = function(idx) {
  if (idx >= 0 && idx < selectedModels.length) {
    const removedModel = selectedModels[idx];
    selectedModels.splice(idx, 1);

    // If no models are left, add the currently selected model
    if (selectedModels.length === 0) {
      const modelSelect = document.getElementById('model-select');
      if (modelSelect) selectedModels.push(modelSelect.value);
    }

    updateMultiModelDisplay();

    // Re-enable the option in the multi-model select dropdown
    const multiModelSelect = document.getElementById('multi-model-select');
    if (multiModelSelect) {
      const option = multiModelSelect.querySelector(`option[value="${removedModel}"]`);
      if (option) option.disabled = false;
    }
  }
};

// Update multi-model display
function updateMultiModelDisplay() {
  const container = document.getElementById('multi-model-container');
  if (!container) return;

  container.innerHTML = '';
  selectedModels.forEach((model, idx) => {
    const chip = document.createElement('div');
    chip.className = 'bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded-full text-sm flex items-center';
    chip.innerHTML = `
      ${model}
      <button class="ml-2 text-red-500 hover:text-red-700" onclick="removeModel(${idx})">×</button>
    `;
    container.appendChild(chip);
  });
}

// Remove model from selection
window.removeModel = function(idx) {
  selectedModels.splice(idx, 1);
  if (selectedModels.length === 0) {
    selectedModels = [document.getElementById('model-select').value];
  }
  updateMultiModelDisplay();
};

document.addEventListener('DOMContentLoaded', function() {
  const toggleModeButton = document.getElementById('toggle-mode');
  if (toggleModeButton) {
    toggleModeButton.onclick = function() {
      isDarkMode = !isDarkMode;
      setTheme(isDarkMode ? 'dark' : 'light');
      // Show sun or moon icon
      document.getElementById('moon-icon').classList.toggle('hidden', isDarkMode);
      document.getElementById('sun-icon').classList.toggle('hidden', !isDarkMode);
    };
  }
});

// ---- POPUP DIALOGS ----
const popupOverlay = document.getElementById('popup-overlay');
function togglePopup(name, open) {
  // Ensure all popups are hidden first
  document.querySelectorAll('.popup-ptr').forEach(el => el.classList.add('hidden'));

  if (open) {
    // Show the overlay and the requested popup
    popupOverlay.classList.remove('hidden');
    const popup = document.getElementById('popup-' + name);
    if (popup) {
      popup.classList.remove('hidden');
    } else {
      console.error(`Popup with id 'popup-${name}' not found`);
    }
  } else {
    // Hide the overlay
    popupOverlay.classList.add('hidden');

    // Hide the specific popup if it exists
    const popup = document.getElementById('popup-' + name);
    if (popup) {
      popup.classList.add('hidden');
    }

    // Cleanup for certain popups
    if (name === 'file') {
      const fileInput = document.getElementById('file-input-file');
      const previewBox = document.getElementById('file-preview-box');
      if (fileInput) fileInput.value = "";
      if (previewBox) previewBox.innerHTML = '';
    }
    if (name === 'image') {
      const promptInput = document.getElementById('image-gen-prompt');
      const genArea = document.getElementById('image-gen-area');
      if (promptInput) promptInput.value = '';
      if (genArea) genArea.innerHTML = '';
    }
    if (name === 'code') {
      const codePrompt = document.getElementById('code-gen-prompt');
      const codeResult = document.getElementById('code-result');
      if (codePrompt) codePrompt.value = '';
      if (codeResult) codeResult.textContent = '';
    }
  }
}

// Close all popups when overlay is clicked
if (popupOverlay) {
  popupOverlay.onclick = function(event) {
    // Only close if the overlay itself was clicked, not its children
    if (event.target === popupOverlay) {
      document.querySelectorAll('.popup-ptr').forEach(el => el.classList.add('hidden'));
      popupOverlay.classList.add('hidden');
    }
  };
}

// Prevent clicks on popup windows from closing the popup
document.querySelectorAll('.popup-ptr').forEach(popup => {
  popup.addEventListener('click', function(event) {
    event.stopPropagation();
  });
});

// ---- CHAT MESSAGE RENDERING ----
function renderChat() {
  const container = document.getElementById('chat-container');
  if (!container) return;

  const fragment = document.createDocumentFragment();
  const markdownEnabled = userSettings.markdownEnabled && window.marked;
  const darkMode = document.body.classList.contains('dark-mode');

  for (let i = currentChat.length - 1; i >= 0; i--) {
    const m = currentChat[i];
    const isUser = m.role === 'user';
    const bubbleClr = isUser ? 
      `border-black ${darkMode ? 'bg-gray-800' : 'bg-white'}` : 
      `border-black ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`;
    const align = isUser ? 'user-message' : 'assistant-message';
    const label = isUser ? `You: ${m.time}` : `${m.model || "Assistant"}: ${m.time}`;

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${align}`;

    // Process content with markdown if enabled
    let content = "";
    if (typeof m.content === 'string') {
      if (markdownEnabled && window.marked) {
        try {
          content = `<div class="markdown-content">${window.marked(m.content)}</div>`;
        } catch (e) {
          console.warn("Markdown parsing failed, falling back to plain text:", e);
          content = `<div>${m.content}</div>`;
        }
      } else {
        content = `<div>${m.content}</div>`;
      }
    } else if (m.content?.type === "img") {
      content = `<img src='${m.content.url}' alt='image' class='rounded-cool' loading="lazy">`;
    }

    messageDiv.innerHTML = `
      <div class="message-timestamp ${isUser ? 'text-right' : ''} mb-1">${label}</div>
      <div class="chat-bubble ${bubbleClr}">
        ${content}
      </div>
      <div class="message-actions mt-1 ${isUser ? 'text-right' : ''}">
        <button onclick="resendMsg(${i})" class="action-button" title="Resend"><i class="fa fa-redo"></i></button>
        <button onclick="copyMsg(${i})" class="action-button" title="Copy"><i class="fa fa-copy"></i></button>
        <button onclick="deleteMsg(${i})" class="action-button delete" title="Delete"><i class="fa fa-trash"></i></button>
        <button onclick="speakMsg(${i})" class="action-button speak" title="Speak"><i class="fa fa-volume-up"></i></button>
        <button class="action-button" title="Translate" data-message-idx="${i}"><i class="fa fa-language"></i></button>
      </div>
    `;

    fragment.appendChild(messageDiv);
  }

  container.textContent = '';
  container.appendChild(fragment);
  updateTokenUsageDisplay();
}

// ---- CHAT INPUT ----
document.addEventListener('DOMContentLoaded', function() {
  const chatForm = document.getElementById('chat-form');
  if (chatForm) {
    chatForm.onsubmit = async function(e) {
      e.preventDefault();
      let chatInput = document.getElementById('chat-input');
      let txt = chatInput.value.trim();
      if (!txt) return;
      
      const modelSelect = document.getElementById('model-select');
      const model = modelSelect ? modelSelect.value : 'gpt-4o-mini'; // Default if not found
      
      const time = nowStr();
      currentChat.push({ role: 'user', content: txt, time, model: null });
      renderChat();
      chatInput.value = "";
      // Reset the height of textarea
      chatInput.style.height = 'auto';
      await aiSend(txt, model, time);
    };
  }

  // Auto-resize textarea as user types
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = (this.scrollHeight) + 'px';
    });

    // Add event listener for Enter key press on the chat input
    chatInput.addEventListener('keydown', function(e) {
      // Check if Enter was pressed (without shift for new line)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Prevent default to avoid new line
        const chatForm = document.getElementById('chat-form');
        if (chatForm) {
          chatForm.dispatchEvent(new Event('submit'));
        }
      }
    });
  }
});

// send to AI
async function aiSend(txt, model, usetime) {
  const models = multiModelMode ? (selectedModels.length > 0 ? selectedModels : [model]) : [model];

  for (const currentModel of models) {
    const idx = currentChat.length;
    currentChat.push({ role: 'model', content: "...", time: nowStr(), model: currentModel });
    renderChat();

    try {
      const opts = { 
        model: currentModel,
        stream: streamingMode && isModelStreamCapable(currentModel)
      };

      if (opts.stream) {
        try {
          let fullResponse = '';
          const stream = await puter.ai.chat(txt, opts);

          for await (const chunk of stream) {
            fullResponse += chunk;
            currentChat[idx].content = fullResponse;
            renderChat();
          }
        } catch (error) {
          console.error("Streaming error:", error);
          currentChat[idx].content = "[STREAMING ERROR]: " + (error.message || "Unknown error");
          renderChat();
        }
      } else {
        try {
          const resp = await puter.ai.chat(txt, opts);
          let text = '';

          // Handle different response formats
          if (resp && resp.message && resp.message.text) {
            text = resp.message.text;
          } else if (resp && resp.message && resp.message.content) {
            text = resp.message.content;
          } else if (resp && resp.text) {
            text = resp.text;
          } else if (typeof resp === 'string') {
            text = resp;
          } else {
            // If we get here, format the response as a string
            text = JSON.stringify(resp);
          }

          currentChat[idx] = { role: 'model', content: text, time: nowStr(), model: currentModel };
          renderChat();
        } catch (error) {
          console.error("Response error:", error);
          currentChat[idx] = { role: 'model', content: "[ERROR]: " + (error.message || "Unknown error"), time: nowStr(), model: currentModel };
          renderChat();
        }
      }
    } catch (err) {
      console.error("AI error:", err);
      currentChat[idx] = { role: 'model', content: "[ERROR]: " + (err.message || JSON.stringify(err)), time: nowStr(), model: currentModel };
      renderChat();
    }
  }
}

// ---- MSG ICON TASKS ----
window.resendMsg = async function(idx) {
  const m = currentChat[idx];
  if (m.role === 'user') { 
    aiSend(m.content, document.getElementById('model-select').value, nowStr()); 
  } else if (m.role === 'model') { //resend prompt before
    if (idx > 0 && currentChat[idx - 1].role === 'user') {
      aiSend(currentChat[idx - 1].content, m.model || document.getElementById('model-select').value, nowStr());
    }
  }
};

window.copyMsg = function(idx) {
  const m = currentChat[idx];
  let txt = typeof m.content === 'string' ? m.content : "";
  if (navigator.clipboard) navigator.clipboard.writeText(txt);
};

window.deleteMsg = function(idx) {
  currentChat.splice(idx, 1); 
  renderChat();
};

window.speakMsg = function(idx) {
  const m = currentChat[idx];
  const txt = typeof m.content === 'string' ? m.content : '';

  if (txt.length) {
    try {
      // Show loading indicator
      const bubbleElement = document.querySelectorAll('#chat-container > div')[currentChat.length - 1 - idx];
      if (bubbleElement) {
        const loadingId = 'speech-loading-' + Date.now();
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = loadingId;
        loadingIndicator.className = 'text-xs text-blue-600 mt-1 flex items-center';
        loadingIndicator.innerHTML = '<i class="fa fa-spinner fa-spin mr-1"></i> Generating speech...';
        
        // Add the loading indicator to the message
        const chatBubble = bubbleElement.querySelector('.chat-bubble');
        if (chatBubble) {
          chatBubble.appendChild(loadingIndicator);
        } else {
          bubbleElement.appendChild(loadingIndicator);
        }

        // Get voice setting with fallbacks for compatibility
        const speechVoiceSelect = document.getElementById('speech-voice-select');
        // Default to 'en-US' if no setting found to ensure compatibility
        const voice = speechVoiceSelect?.value || userSettings.speechVoice || 'en-US';

        // Use simple parameters to improve compatibility
        puter.ai.txt2speech(txt, voice)
          .then(audio => {
            // Remove loading indicator
            document.getElementById(loadingId)?.remove();

            if (audio && audio instanceof HTMLAudioElement) {
              // Add audio controls to the message
              audio.controls = true;
              audio.className = 'mt-2 w-full';
              audio.style.maxWidth = '300px';

              // Add the audio element to the message
              if (chatBubble) {
                chatBubble.appendChild(audio);
              } else {
                bubbleElement.appendChild(audio);
              }

              // Auto-play the audio
              audio.play().catch(err => {
                console.warn("Auto-play failed (may require user interaction):", err);
                // Create a play button as fallback
                const playButton = document.createElement('button');
                playButton.className = 'bg-blue-600 text-white px-2 py-1 rounded mt-1 text-xs';
                playButton.innerHTML = '<i class="fa fa-play mr-1"></i> Play Audio';
                playButton.onclick = () => audio.play();
                if (chatBubble) {
                  chatBubble.appendChild(playButton);
                } else {
                  bubbleElement.appendChild(playButton);
                }
              });
            } else {
              throw new Error("Invalid audio returned");
            }
          })
          .catch(err => {
            console.error("Speech error:", err);

            // Remove loading indicator
            document.getElementById(loadingId)?.remove();

            // Show error message
            const errorMsg = document.createElement('div');
            errorMsg.className = 'text-xs text-red-600 mt-1';
            errorMsg.textContent = "Speech generation failed. Trying alternative voice...";
            if (chatBubble) {
              chatBubble.appendChild(errorMsg);
            } else {
              bubbleElement.appendChild(errorMsg);
            }

            // Try again with alternative method
            setTimeout(() => {
              // Fallback to standard engine and default voice
              puter.ai.txt2speech(txt)
                .then(audio => {
                  errorMsg.remove();
                  if (audio) {
                    audio.controls = true;
                    audio.className = 'mt-2 w-full';
                    audio.style.maxWidth = '300px';
                    if (chatBubble) {
                      chatBubble.appendChild(audio);
                    } else {
                      bubbleElement.appendChild(audio);
                    }
                    audio.play();
                  }
                })
                .catch(fallbackErr => {
                  console.error("Fallback speech error:", fallbackErr);
                  errorMsg.textContent = "Speech generation unavailable at this time";
                });
            }, 500);
          });
      }
    } catch (err) {
      console.error("Speech error:", err);
      alert("Speech function error: " + err.message);
    }
  }
};

// ---- FEATURE BUTTONS ----
document.addEventListener('DOMContentLoaded', function() {
  const newChatBtn = document.getElementById('btn-new-chat');
  if (newChatBtn) {
    newChatBtn.onclick = function() {
      if (currentChat.length > 0) {
        // Save current chat to history with automatic topic headline
        chatHistory.unshift({
          title: autoTitle(currentChat),
          when: new Date(),
          messages: [...currentChat]
        });
        // limit history
        if (chatHistory.length > 50) chatHistory.length = 50;
      }
      currentChat = [];
      renderChat();
    };
  }

  const historyBtn = document.getElementById('btn-history');
  if (historyBtn) {
    historyBtn.onclick = function() {
      updateHistoryUI();
      togglePopup('history', true);
    };
  }

  const fileBtn = document.getElementById('btn-file');
  if (fileBtn) {
    fileBtn.onclick = function() {
      togglePopup('file', true);
    };
  }

  const imageBtn = document.getElementById('btn-image');
  if (imageBtn) {
    imageBtn.onclick = function() {
      togglePopup('image', true);
    };
  }

  const settingsBtn = document.getElementById('btn-settings');
  if (settingsBtn) {
    settingsBtn.onclick = function() {
      // Show UI tab by default
      const uiTab = document.getElementById('ui-tab');
      if (uiTab) uiTab.click();

      // Set text size
      const textSizeRange = document.getElementById('text-size-range');
      if (textSizeRange) textSizeRange.value = userSettings.textSize;

      // Set theme
      const themeSelect = document.getElementById('theme-select');
      if (themeSelect) themeSelect.value = userSettings.theme;

      // Setup OpenRouter toggle
      const openrouterToggle = document.getElementById('openrouter-toggle');
      if (openrouterToggle) openrouterToggle.checked = userSettings.openRouterEnabled || false;

      // Populate models list
      populateModelsList();

      // Set speech voice
      const speechVoiceSelect = document.getElementById('speech-voice-select');
      if (speechVoiceSelect) speechVoiceSelect.value = userSettings.speechVoice;

      togglePopup('settings', true);
    };
  }

  // Setup tab switching functionality
  document.querySelectorAll('#settings-tabs button').forEach(tab => {
    tab.addEventListener('click', function() {
      // Hide all tab contents
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
      });

      // Remove active class from all tabs
      document.querySelectorAll('#settings-tabs button').forEach(t => {
        t.classList.remove('active', 'border-blue-600');
        t.classList.add('border-transparent');
      });

      // Add active class to clicked tab
      this.classList.add('active', 'border-blue-600');
      this.classList.remove('border-transparent');

      // Show corresponding tab content
      const tabContentId = this.getAttribute('data-tab');
      const tabContent = document.getElementById(tabContentId);
      if (tabContent) tabContent.classList.remove('hidden');
    });
  });

  // Set up text size range
  const textSizeRange = document.getElementById('text-size-range');
  if (textSizeRange) {
    textSizeRange.oninput = function() {
      document.body.style.fontSize = this.value + "px";
      userSettings.textSize = this.value;
      saveSettings();
    };
  }

  // Set up theme selection
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    themeSelect.onchange = function(e) {
      setTheme(e.target.value);
    };
  }

  // Set up OCR extract text logic
  const fileInputFile = document.getElementById('file-input-file');
  if (fileInputFile) {
    fileInputFile.onchange = async function(e) {
      const file = e.target.files[0];
      if (!file) return;
      const previewBox = document.getElementById('file-preview-box');
      if (!previewBox) return;

      previewBox.innerHTML = "";
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        previewBox.innerHTML = `<img src="${url}" class="rounded-cool border mx-auto mb-2" height="140" style="max-height:140px"><button id="ocr-btn" class="bg-blue-700 text-white flat px-3 py-1 rounded-cool mt-2">Extract Text</button> <div id="ocr-result" class="mt-3"></div>`;

        const ocrBtn = document.getElementById('ocr-btn');
        if (ocrBtn) {
          ocrBtn.onclick = async function() {
            try {
              // Show loading indicator
              const loadingId = 'ocr-loading-' + Date.now();
              const loadingHTML = `<div id="${loadingId}" class="flex items-center mt-2">
                <i class="fa fa-spinner fa-spin mr-2 text-blue-600"></i>
                <span>Extracting text from image...</span>
              </div>`;
              previewBox.innerHTML += loadingHTML;

              // Convert file to data URL for processing
              const dataURL = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });

              // Call OCR with proper error handling
              let result;
              try {
                // Try with data URL first
                result = await puter.ai.img2txt(dataURL);
              } catch (e) {
                console.warn("Data URL OCR failed, trying with File object:", e);
                // Fall back to using the File object directly
                result = await puter.ai.img2txt(file);
              }

              // Remove loading indicator
              const loadingElement = document.getElementById(loadingId);
              if (loadingElement) loadingElement.remove();

              // Format and display result
              result = (result || "").trim() || "[No text detected]";

              // Create result container with controls
              const resultHTML = `
                <div class="mt-3 border rounded-cool overflow-hidden">
                  <div class="flex justify-between items-center p-2 bg-gray-200 dark:bg-gray-700">
                    <span class="text-sm font-medium">Extracted Text</span>
                    <div class="flex space-x-1">
                      <button id="copy-ocr-btn" class="text-gray-600 hover:text-blue-700 dark:text-gray-300">
                        <i class="fa fa-copy"></i>
                      </button>
                      <button id="edit-ocr-btn" class="text-gray-600 hover:text-blue-700 dark:text-gray-300">
                        <i class="fa fa-pen"></i>
                      </button>
                    </div>
                  </div>
                  <div id="ocr-result-container" class="p-3 bg-white dark:bg-gray-800">
                    <div id="ocrTextResult" class="whitespace-pre-wrap">${result}</div>
                  </div>
                </div>`;

              previewBox.innerHTML += resultHTML;

              // Set up copy button
              document.getElementById('copy-ocr-btn').onclick = function() {
                const textToCopy = document.getElementById('ocrTextResult').textContent;
                navigator.clipboard.writeText(textToCopy)
                  .then(() => {
                    // Show brief success message
                    this.innerHTML = '<i class="fa fa-check text-green-600"></i>';
                    setTimeout(() => {
                      this.innerHTML = '<i class="fa fa-copy"></i>';
                    }, 1000);
                  })
                  .catch(err => {
                    console.error("Copy failed:", err);
                    alert("Failed to copy: " + err.message);
                  });
              };

              // Set up edit button
              document.getElementById('edit-ocr-btn').onclick = function() {
                const resultContainer = document.getElementById('ocr-result-container');
                const currentText = document.getElementById('ocrTextResult').textContent;

                // Replace result container with textarea
                resultContainer.innerHTML = `
                  <textarea id="ocr-edit-textarea" class="w-full h-32 p-2 border rounded-cool dark:bg-gray-900">${currentText}</textarea>
                  <div class="flex justify-end mt-2">
                    <button id="save-ocr-btn" class="bg-blue-600 text-white px-3 py-1 rounded-cool text-sm mr-2">
                      <i class="fa fa-save mr-1"></i> Save
                    </button>
                    <button id="cancel-ocr-btn" class="bg-gray-500 text-white px-3 py-1 rounded-cool text-sm">
                      Cancel
                    </button>
                  </div>`;

                // Set up save button
                document.getElementById('save-ocr-btn').onclick = function() {
                  const newText = document.getElementById('ocr-edit-textarea').value;
                  resultContainer.innerHTML = `<div id="ocrTextResult" class="whitespace-pre-wrap">${newText}</div>`;
                };

                // Set up cancel button
                document.getElementById('cancel-ocr-btn').onclick = function() {
                  resultContainer.innerHTML = `<div id="ocrTextResult" class="whitespace-pre-wrap">${currentText}</div>`;
                };
              };
            } catch (err) {
              console.error("OCR Error:", err);
              // Remove loading indicator if it exists
              const loadingElement = document.getElementById('ocr-loading');
              if (loadingElement) loadingElement.remove();

              // Show error message with retry option
              previewBox.innerHTML += `
                <div class="mt-3 bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 p-3 rounded-cool">
                  <p class="text-red-700 dark:text-red-300 mb-2">
                    <i class="fa fa-exclamation-triangle mr-2"></i>
                    OCR Error: ${err.message || "Failed to extract text from image"}
                  </p>
                  <button id="retry-ocr-btn" class="bg-blue-600 text-white px-3 py-1 rounded-cool text-sm">
                    Try Again
                  </button>
                </div>`;

              // Set up retry button
              document.getElementById('retry-ocr-btn').onclick = ocrBtn.onclick;
            }
          };
        }
      } else if (file.type.startsWith('text/')) {
        const txt = await file.text();
        previewBox.innerHTML = `<pre class="rounded-cool bg-gray-100 border p-2 flat">${txt.slice(0, 2048)}</pre>`;
      } else {
        previewBox.innerHTML = `<div class='text-gray-500 mt-2'>Unsupported file format.</div>`;
      }
    };
  }

  // Set up generate image button
  const generateImageBtn = document.getElementById('generate-image-btn');
  if (generateImageBtn) {
    generateImageBtn.onclick = generateImg;
  }

  // Set up refresh image button
  const refreshImggenBtn = document.getElementById('refresh-imggen-btn');
  if (refreshImggenBtn) {
    refreshImggenBtn.onclick = function() {
      const imageGenArea = document.getElementById('image-gen-area');
      const imageGenPrompt = document.getElementById('image-gen-prompt');
      if (imageGenArea) imageGenArea.innerHTML = '';
      if (imageGenPrompt) imageGenPrompt.value = '';
    };
  }

  // Code generation functionality removed

  // Set up settings save button
  const settingsSaveBtn = document.getElementById('settings-save-btn');
  if (settingsSaveBtn) {
    settingsSaveBtn.onclick = function() {
      // Save enabled models from checkboxes
      const checkedModels = [...document.querySelectorAll('#models-list input[type=checkbox]:checked')].map(x => x.value);
      userSettings.enabledModels = checkedModels;

      // Update OpenRouter setting
      const openrouterToggle = document.getElementById('openrouter-toggle');
      if (openrouterToggle) {
        userSettings.openRouterEnabled = openrouterToggle.checked;
      }

      // Update speech voice setting
      const speechVoiceSelect = document.getElementById('speech-voice-select');
      if (speechVoiceSelect) {
        userSettings.speechVoice = speechVoiceSelect.value;
      }

      // Update model select dropdown options
      updateModelSelectOptions();

      saveSettings();
      togglePopup('settings', false);
    };
  }

  // Set up model search functionality
  const modelSearch = document.getElementById('model-search');
  if (modelSearch) {
    modelSearch.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      document.querySelectorAll('#models-list .model-item').forEach(item => {
        const modelName = item.querySelector('.model-name').textContent.toLowerCase();
        if (modelName.includes(searchTerm)) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }

  // Set up OpenRouter toggle
  const openrouterToggle = document.getElementById('openrouter-toggle');
  if (openrouterToggle) {
    openrouterToggle.addEventListener('change', function() {
      userSettings.openRouterEnabled = this.checked;

      if (this.checked && !modelSelect.querySelector('optgroup[label^="OpenRouter"]')) {
        addOpenRouterModels();
      }

      updateModelSelectionBasedOnOpenRouterSetting();
      populateModelsList();
    });
  }

  // Set up show enabled models only button
  const showEnabledOnly = document.getElementById('show-enabled-only');
  if (showEnabledOnly) {
    showEnabledOnly.addEventListener('click', function() {
      const isShowingAll = this.textContent.includes('Show Enabled');
      if (isShowingAll) {
        populateModelsList(true);
        this.textContent = 'Show All';
      } else {
        populateModelsList(false);
        this.textContent = 'Show Enabled';
      }
    });
  }
});

function autoTitle(msgs) {
  // Use first user message or fallback
  if (!msgs || !msgs.length) return "New Chat";
  let txt = msgs[0].content || "";
  txt = txt.slice(0, 36); if (txt.length >= 36) txt += "...";
  return txt;
}

function updateHistoryUI() {
  const list = document.getElementById('history-list');
  if (!list) return;

  if (!chatHistory.length) { 
    list.innerHTML = "<div class='text-gray-500'>No chat history yet.</div>"; 
    return; 
  }

  list.innerHTML = '';
  chatHistory.forEach((h, i) => {
    list.innerHTML += `<div class="border flat rounded-cool px-3 py-2 bg-gray-50 dark:bg-gray-900 hover:bg-blue-100 dark:hover:bg-gray-700 cursor-pointer mb-1" onclick="selectHistory(${i})">
        <div class="font-semibold">${h.title}</div>
        <div class="text-xs text-gray-500">${h.when.toLocaleString()}</div>
      </div>`;
  });
}

window.selectHistory = function(idx) {
  currentChat = chatHistory[idx].messages.slice();
  renderChat();
  togglePopup('history', false);
};

async function generateImg() {
  const imageGenPrompt = document.getElementById('image-gen-prompt');
  const imageGenArea = document.getElementById('image-gen-area');
  if (!imageGenPrompt || !imageGenArea) return;

  let prompt = imageGenPrompt.value.trim();
  if (!prompt) { 
    imageGenArea.innerHTML = '<div class="text-red-500">Please enter prompt above first.</div>'; 
    return; 
  }

  imageGenArea.innerHTML = '<div class="w-full h-48 flex flex-col items-center justify-center"><span class="fa fa-spinner fa-spin text-blue-600 text-3xl"></span><span class="text-xs mt-2">Generating Image...</span></div>';

  try {
    // Use the txt2img API with the prompt (set testMode to false for production)
    const img = await puter.ai.txt2img(prompt, false);

    // Append the image to the area
    imageGenArea.innerHTML = '';
    if (img instanceof HTMLImageElement) {
      img.className = "rounded-cool border mx-auto";
      img.alt = "AI Generated";
      imageGenArea.appendChild(img);

      // Add save button and info text
      const saveBtn = document.createElement('button');
      saveBtn.className = "flat rounded-cool px-3 py-1 mt-2";
      saveBtn.innerHTML = '<i class="fa fa-download mr-1"></i>Save';
      saveBtn.onclick = function() {
        let a = document.createElement('a');
        a.href = img.src;
        a.download = "ai_generated.png";
        a.click();
      };
      imageGenArea.appendChild(saveBtn);

      const infoText = document.createElement('span');
      infoText.className = "text-xs block mt-2 text-blue-600";
      infoText.textContent = "Click image to expand.";
      imageGenArea.appendChild(infoText);

      // Add click handler to open in new window
      img.onclick = function() {
        window.open(img.src, '_blank');
      };
    } else {
      throw new Error("Failed to generate image");
    }
  } catch (err) {
    console.error("Image generation error:", err);
    imageGenArea.innerHTML = `<div class="text-red-600">Image generation failed: ${err.message || "Unknown error"}</div>`;
  }
}

// Add CSS for capability badges
document.addEventListener('DOMContentLoaded', function() {
  const style = document.createElement('style');
  style.textContent = `
    .capability-badge {
      display: inline-flex;
      align-items: center;
      background: rgba(37, 99, 235, 0.1);
      color: #2563eb;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.7rem;
      margin-right: 4px;
      margin-bottom: 4px;
    }

    .dark-mode .capability-badge {
      background: rgba(37, 99, 235, 0.2);
      color: #93c5fd;
    }
  `;
  document.head.appendChild(style);
});

// Default models to enable
const defaultModels = [
  "gpt-4o", "gpt-4.1-mini", "gpt-4.5-preview", "o1-mini", "o3-mini", "o4-mini", 
  "claude-3-5-sonnet", "claude-3-7-sonnet", "deepseek-chat", "deepseek-reasoner", 
  "gemini-2.0-flash", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", 
  "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo", "mistral-large-latest", "pixtral-large-latest", "codestral-latest", "google/gemma-2-27b-it", "grok-beta"
];

// Populate the models list
function populateModelsList(showEnabledOnly = false) {
  const modelsList = document.getElementById('models-list');
  if (!modelsList) return;

  modelsList.innerHTML = '';

  // Get all available models
  let allModels = [];
  const modelSelect = document.getElementById('model-select');
  if (modelSelect) {
    allModels = [...modelSelect.querySelectorAll('option')].map(x => x.value);
  }

  // If OpenRouter is enabled, only show OpenRouter models
  if (userSettings.openRouterEnabled) {
    allModels = getAllOpenRouterModels();
  }

  // Ensure userSettings.enabledModels exists
  if (!userSettings.enabledModels) {
    userSettings.enabledModels = defaultModels;
  }

  // Filter models if showing enabled only
  if (showEnabledOnly) {
    allModels = allModels.filter(model => userSettings.enabledModels.includes(model));
  }

  // Group models by provider
  const modelsByProvider = {};

  allModels.forEach(model => {
    const provider = getProviderFromModel(model);
    if (!modelsByProvider[provider]) {
      modelsByProvider[provider] = [];
    }
    modelsByProvider[provider].push(model);
  });

  // Create provider sections
  Object.keys(modelsByProvider).sort().forEach(provider => {
    // Create provider header
    const providerHeader = document.createElement('div');
    providerHeader.className = 'provider-header flex items-center my-3 pb-1 border-b border-gray-300 dark:border-gray-700';

    const providerIcon = document.createElement('i');
    providerIcon.className = getProviderIcon(provider);
    providerIcon.style.marginRight = '8px';

    const providerName = document.createElement('span');
    providerName.className = 'font-bold text-md';
    providerName.textContent = provider;

    // Add a count badge
    const countBadge = document.createElement('span');
    countBadge.className = 'ml-2 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full text-xs';
    countBadge.textContent = modelsByProvider[provider].length;

    providerHeader.appendChild(providerIcon);
    providerHeader.appendChild(providerName);
    providerHeader.appendChild(countBadge);

    // Add a separator if this is an OpenRouter provider
    if (provider.includes('OpenRouter')) {
      const separator = document.createElement('hr');
      separator.className = 'border-t border-blue-200 dark:border-blue-800 my-1';
      modelsList.appendChild(separator);
    }

    modelsList.appendChild(providerHeader);

    // Limit the number of models shown per provider to avoid overwhelming the UI
    const modelsToShow = userSettings.openRouterEnabled 
      ? modelsByProvider[provider].slice(0, 20) // Show a limited number when in OpenRouter mode
      : modelsByProvider[provider];

    // Add models for this provider
    modelsToShow.forEach(model => {
      const modelItem = document.createElement('div');
      modelItem.className = 'model-item flex items-center justify-between border-b pb-2 mb-2';
      modelItem.dataset.provider = provider;

      const modelNameContainer = document.createElement('div');
      modelNameContainer.className = 'flex items-center';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'form-checkbox mr-2';
      checkbox.value = model;
      checkbox.checked = userSettings.enabledModels.includes(model);

      const modelName = document.createElement('span');
      modelName.className = 'model-name text-sm';
      // Format OpenRouter models or truncate long model names
      if (model.startsWith('openrouter:')) {
        modelName.textContent = formatOpenRouterModelName(model);
      } else {
        modelName.textContent = model.length > 40 ? model.substring(0, 37) + '...' : model;
      }
      modelName.title = model; // Full name on hover

      modelNameContainer.appendChild(checkbox);
      modelNameContainer.appendChild(modelName);

      const infoButton = document.createElement('button');
      infoButton.className = 'text-blue-500 hover:text-blue-700';
      infoButton.innerHTML = '<i class="fa fa-plus"></i>';
      infoButton.setAttribute('title', 'Show details');

      // Info button click handler
      infoButton.addEventListener('click', function() {
        const detailsDiv = modelItem.querySelector('.model-details');
        if (detailsDiv) {
          detailsDiv.remove();
          this.innerHTML = '<i class="fa fa-plus"></i>';
        } else {
          const details = document.createElement('div');
          details.className = 'model-details mt-2 w-full text-xs text-gray-600 dark:text-gray-400';

          const capabilities = getModelCapabilities(model);

          details.innerHTML = `
            <div class="p-2 bg-gray-100 dark:bg-gray-800 rounded-cool">
              <p class="mb-1"><strong>Model ID:</strong> ${model}</p>
              <p class="mb-1"><strong>Provider:</strong> ${getProviderFromModel(model)}</p>
              <p class="mb-2"><strong>Description:</strong> ${getModelDescription(model)}</p>
              <div class="mb-1"><strong>Capabilities:</strong></div>
              <div class="grid grid-cols-2 gap-1">
                ${capabilities.code ? '<div class="capability-badge"><i class="fa fa-code mr-1"></i> Code</div>' : ''}
                ${capabilities.vision ? '<div class="capability-badge"><i class="fa fa-eye mr-1"></i> Vision</div>' : ''}
                ${capabilities.reasoning ? '<div class="capability-badge"><i class="fa fa-brain mr-1"></i> Reasoning</div>' : ''}
                ${capabilities.streaming ? '<div class="capability-badge"><i class="fa fa-stream mr-1"></i> Streaming</div>' : ''}
                ${capabilities.longContext ? '<div class="capability-badge"><i class="fa fa-file-alt mr-1"></i> Long Context</div>' : ''}
              </div>
            </div>
          `;
          modelItem.appendChild(details);
          this.innerHTML = '<i class="fa fa-minus"></i>';
        }
      });

      modelItem.appendChild(modelNameContainer);
      modelItem.appendChild(infoButton);
      modelsList.appendChild(modelItem);
    });

    // If there are more models than shown, add a "Show More" button
    if (userSettings.openRouterEnabled && modelsByProvider[provider].length > 20) {
      const showMoreButton = document.createElement('button');
      showMoreButton.className = 'text-blue-600 hover:text-blue-800 text-sm mt-2 ml-2';
      showMoreButton.textContent = `Show ${modelsByProvider[provider].length - 20} more models...`;
      showMoreButton.onclick = function() {
        let startIndex = 20;
        const batchSize = 20;
        const endIndex = Math.min(startIndex + batchSize, modelsByProvider[provider].length);

        // Add the next batch of models
        for (let i = startIndex; i < endIndex; i++) {
          const model = modelsByProvider[provider][i];
          // Clone the code to add more models
          const modelItem = document.createElement('div');
          modelItem.className = 'model-item flex items-center justify-between border-b pb-2 mb-2 new-item';

          const modelNameContainer = document.createElement('div');
          modelNameContainer.className = 'flex items-center';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'form-checkbox mr-2';
          checkbox.value = model;
          checkbox.checked = userSettings.enabledModels.includes(model);

          const modelName = document.createElement('span');
          modelName.className = 'model-name text-sm';
          modelName.textContent = model.length > 40 ? model.substring(0, 37) + '...' : model;
          modelName.title = model;

          modelNameContainer.appendChild(checkbox);
          modelNameContainer.appendChild(modelName);
          modelItem.appendChild(modelNameContainer);

          // Insert before the "Show More" button
          showMoreButton.parentNode.insertBefore(modelItem, showMoreButton);
        }

        startIndex = endIndex;

        // Update or remove the "Show More" button
        if (startIndex >= modelsByProvider[provider].length) {
          showMoreButton.remove();
        } else {
          showMoreButton.textContent = `Show ${modelsByProvider[provider].length - startIndex} more models...`;
        }
      };
      modelsList.appendChild(showMoreButton);
    }
  });
}

// Get provider icon
function getProviderIcon(provider) {
  const icons = {
    'OpenAI': 'fa fa-robot',
    'Anthropic': 'fa fa-comment-dots',
    'Google': 'fab fa-google',
    'Meta': 'fab fa-facebook',
    'Mistral AI': 'fa fa-wind',
    'DeepSeek': 'fa fa-search',
    'xAI': 'fa fa-times',
    'Other': 'fa fa-cube'
  };

  // Check if provider contains OpenRouter
  if (provider.includes('OpenRouter')) {
    return 'fa fa-random';
  }

  return icons[provider] || 'fa fa-cube';
}

// Get model capabilities
function isModelStreamCapable(model) {
  const streamingModels = [
    'gpt-4o', 'gpt-4o-mini', 'claude-3-7-sonnet', 'claude-3-5-sonnet',
    'deepseek-chat', 'deepseek-reasoner', 'mistral-large-latest',
    'gemini-2.0-flash', 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'
  ];
  return streamingModels.includes(model);
}

function getModelCapabilities(model) {
  // Default capabilities
  const capabilities = {
    code: false,
    vision: false,
    reasoning: false,
    streaming: isModelStreamCapable(model),
    longContext: false
  };

  // Set capabilities based on model name
  if (model.includes('codestral') || model.includes('code') || model.includes('coder')) {
    capabilities.code = true;
  }

  if (model.includes('vision') || model.includes('vl') || model.includes('pixtral') || model.includes('gpt-4') || model.includes('o3') || model.includes('o4') || model.includes('claude-3')) {
    capabilities.vision = true;
  }

  if (model.includes('reasoner') || model.includes('reasoning') || model.includes('o1') || model.includes('gpt-4') || model.includes('claude-3')) {
    capabilities.reasoning = true;
  }

  if (model.includes('32k') || model.includes('128k') || model.includes('gemini-1.5') || model.includes('claude-3') || model.includes('o1-pro')) {
    capabilities.longContext = true;
  }

  return capabilities;
}

// Helper function to get provider from model name
function getProviderFromModel(model) {
  if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) {
    return 'OpenAI';
  } else if (model.startsWith('claude-')) {
    return 'Anthropic';
  } else if (model.startsWith('gemini-')) {
    return 'Google';
  } else if (model.includes('Llama') || model.startsWith('meta-llama')) {
    return 'Meta';
  } else if (model.startsWith('mistral') || model.startsWith('codestral') || model.startsWith('pixtral')) {
    return 'Mistral AI';
  } else if (model.startsWith('deepseek')) {
    return 'DeepSeek';
  } else if (model.startsWith('grok')) {
    return 'xAI';
  } else if (model.startsWith('openrouter:')) {
    // Get provider from OpenRouter model
    const modelPath = model.replace('openrouter:', '');
    if (modelPath.includes('openai') || modelPath.includes('gpt')) {
      return 'OpenRouter - OpenAI';
    } else if (modelPath.includes('anthropic') || modelPath.includes('claude')) {
      return 'OpenRouter - Anthropic';
    } else if (modelPath.includes('google') || modelPath.includes('gemini')) {
      return 'OpenRouter - Google';
    } else if (modelPath.includes('llama') || modelPath.includes('meta')) {
      return 'OpenRouter - Meta';
    } else if (modelPath.includes('mistral') || modelPath.includes('pixtral')) {
      return 'OpenRouter - Mistral';
    } else if (modelPath.includes('deepseek')) {
      return 'OpenRouter - DeepSeek';
    } else {
      return 'OpenRouter - Other';
    }
  }
  return 'Other';
}

// Helper function to get model description
function getModelDescription(model) {
  const descriptions = {
    'gpt-4o': 'GPT-4o is OpenAI\'s latest multimodal model with high performance.',
    'gpt-4o-mini': 'Smaller, faster version of GPT-4o.',
    'o1': 'Advanced reasoning model from OpenAI.',
    'o1-mini': 'Compact version of O1 for faster responses.',
    'o1-pro': 'Professional version of O1 with enhanced capabilities.',
    'claude-3-7-sonnet': 'Claude 3.7 Sonnet from Anthropic with advanced capabilities.',
    'claude-3-5-sonnet': 'Claude 3.5 Sonnet from Anthropic with strong reasoning ability.',
    'deepseek-chat': 'Conversational AI model from DeepSeek.',
    'deepseek-reasoner': 'Specialized model for complex reasoning tasks.',
  };

  return descriptions[model] || 'Advanced language model for tasks including text generation, summarization, and more.';
}

// Format OpenRouter model name for display
function formatOpenRouterModelName(model) {
  if (!model.startsWith('openrouter:')) return model;

  // Extract model name from path
  const modelPath = model.replace('openrouter:', '');
  let displayName = '';

  // Parse out a readable name
  if (modelPath.includes('/')) {
    // Handle format like openrouter:provider/model-name
    const parts = modelPath.split('/');
    const modelName = parts[1] || '';

    // Clean up model name
    displayName = modelName
      .replace('llama-', 'Llama ')
      .replace('gemma-', 'Gemma ')
      .replace('gpt-', 'GPT-')
      .replace('claude-', 'Claude ')
      .replace('mistral-', 'Mistral ')
      .replace('deepseek-', 'DeepSeek ')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase()); // Capitalize words
  } else {
    // Handle format without provider
    displayName = modelPath
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  return 'OR: ' + displayName;
}

// Update the model selection dropdown based on enabled models
function updateModelSelectOptions() {
  let sel = document.getElementById('model-select');
  if (!sel) return;

  // First, hide all options
  [...sel.options].forEach(o => {
    o.style.display = 'none';
  });

  // Show only enabled and streaming-capable models if streaming mode is on
  [...sel.options].forEach(o => {
    if (userSettings.enabledModels.includes(o.value)) {
      if (streamingMode && !isModelStreamCapable(o.value)) {
        o.style.display = 'none';
      } else {
        o.style.display = '';
      }
    }
  });

  // Show only enabled options
  [...sel.options].forEach(o => {
    if (userSettings.enabledModels.includes(o.value)) {
      o.style.display = '';
    }
  });

  // Add OpenRouter models if enabled
  if (userSettings.openRouterEnabled) {
    // Group OpenRouter models by provider
    const openRouterModelsByProvider = {};

    userSettings.enabledModels
      .filter(model => model.startsWith('openrouter:'))
      .forEach(model => {
        const provider = getProviderFromModel(model);
        if (!openRouterModelsByProvider[provider]) {
          openRouterModelsByProvider[provider] = [];
        }
        openRouterModelsByProvider[provider].push(model);
      });

    // Create or update optgroups for each provider
    Object.keys(openRouterModelsByProvider).forEach(provider => {
      // Find or create optgroup
      let providerGroup = sel.querySelector(`optgroup[label="${provider}"]`);
      if (!providerGroup) {
        providerGroup = document.createElement('optgroup');
        providerGroup.label = provider;
        sel.appendChild(providerGroup);
      }

      // Clear existing options
      providerGroup.innerHTML = '';

      // Add models for this provider
      openRouterModelsByProvider[provider].forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = formatOpenRouterModelName(model);
        providerGroup.appendChild(option);
      });
    });
  }
}

// Store OpenRouter models list from the full model list
const openRouterModelsList = [
    "gpt-4o", "gpt-4o-mini", "o1", "o1-mini", "o1-pro", "o3", "o3-mini", "o4-mini", 
    "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4.5-preview", "claude-3-7-sonnet-20250219", 
    "claude-3-7-sonnet-latest", "claude-3-5-sonnet-20241022", "claude-3-5-sonnet-latest", 
    "claude-3-5-sonnet-20240620", "claude-3-haiku-20240307", "WhereIsAI/UAE-Large-V1", 
    "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8", "togethercomputer/m2-bert-80M-32k-retrieval", 
    "google/gemma-2-9b-it", "cartesia/sonic", "BAAI/bge-large-en-v1.5", 
    "NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO", "meta-llama/Llama-2-13b-chat-hf", 
    "black-forest-labs/FLUX.1-schnell-Free", "black-forest-labs/FLUX.1.1-pro", 
    "Qwen/Qwen2.5-7B-Instruct-Turbo", "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free", 
    "meta-llama-llama-2-70b-hf", "BAAI/bge-base-en-v1.5", "Gryphe/MythoMax-L2-13b", 
    "google/gemma-2-27b-it", "Qwen/Qwen2-VL-72B-Instruct", "Qwen/QwQ-32B", 
    "meta-llama/LlamaGuard-2-8b", "cartesia/sonic-2", "togethercomputer/m2-bert-80M-8k-retrieval", 
    "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free", "upstage/SOLAR-10.7B-Instruct-v1.0", 
    "togethercomputer/MoA-1", "meta-llama/Meta-Llama-3-70B-Instruct-Turbo", 
    "mistralai/Mistral-7B-Instruct-v0.2", "togethercomputer/m2-bert-80M-2k-retrieval", 
    "google/gemma-2b-it"
];

// OpenRouter models with prefixes for direct API access
const openRouterPrefixedModels = [
    "openrouter:microsoft/mai-ds-r1:free", "openrouter:google/gemini-2.5-pro-preview-03-25", 
    "openrouter:thudm/glm-z1-32b:free", "openrouter:thudm/glm-4-32b:free", 
    "openrouter:google/gemini-2.5-flash-preview", "openrouter:google/gemini-2.5-flash-preview:thinking", 
    "openrouter:openai/o4-mini-high", "openrouter:openai/o3", "openrouter:openai/o4-mini", 
    "openrouter:shisa-ai/shisa-v2-llama3.3-70b:free", "openrouter:qwen/qwen2.5-coder-7b-instruct", 
    "openrouter:openai/gpt-4.1", "openrouter:openai/gpt-4.1-mini", "openrouter:openai/gpt-4.1-nano", 
    "openrouter:eleutherai/llemma_7b", "openrouter:alfredpros/codellama-7b-instruct-solidity", 
    "openrouter:arliai/qwq-32b-arliai-rpr-v1:free", "openrouter:agentica-org/deepcoder-14b-preview:free", 
    "openrouter:moonshotai/kimi-vl-a3b-thinking:free", "openrouter:x-ai/grok-3-mini-beta", 
    "openrouter:x-ai/grok-3-beta", "openrouter:nvidia/llama-3.1-nemotron-nano-8b-v1:free", 
    "openrouter:nvidia/llama-3.3-nemotron-super-49b-v1:free", "openrouter:nvidia/llama-3.1-nemotron-ultra-253b-v1:free", 
    "openrouter:meta-llama/llama-4-maverick:free", "openrouter:meta-llama/llama-4-maverick", 
    "openrouter:meta-llama/llama-4-scout:free", "openrouter:meta-llama/llama-4-scout", 
    "openrouter:all-hands/openhands-lm-32b-v0.1", "openrouter:mistral/ministral-8b", 
    "openrouter:deepseek/deepseek-v3-base:free", "openrouter:scb10x/llama3.1-typhoon2-8b-instruct", 
    "openrouter:scb10x/llama3.1-typhoon2-70b-instruct", "openrouter:allenai/molmo-7b-d:free", 
    "openrouter:bytedance-research/ui-tars-72b:free", "openrouter:qwen/qwen2.5-vl-3b-instruct:free", 
    "openrouter:google/gemini-2.5-pro-exp-03-25:free", "openrouter:qwen/qwen2.5-vl-32b-instruct:free", 
    "openrouter:qwen/qwen2.5-vl-32b-instruct", "openrouter:deepseek/deepseek-chat-v3-0324:free", 
    "openrouter:deepseek/deepseek-chat-v3-0324", "openrouter:featherless/qwerky-72b:free", 
    "openrouter:openai/o1-pro", "openrouter:mistralai/mistral-small-3.1-24b-instruct:free", 
    "openrouter:mistralai/mistral-small-3.1-24b-instruct", "openrouter:open-r1/olympiccoder-7b:free", 
    "openrouter:open-r1/olympiccoder-32b:free", "openrouter:steelskull/l3.3-electra-r1-70b", 
    "openrouter:google/gemma-3-1b-it:free", "openrouter:google/gemma-3-4b-it:free", 
    "openrouter:google/gemma-3-4b-it", "openrouter:ai21/jamba-1.6-large", "openrouter:ai21/jamba-1.6-mini", 
    "openrouter:google/gemma-3-12b-it:free", "openrouter:google/gemma-3-12b-it", 
    "openrouter:cohere/command-a", "openrouter:openai/gpt-4o-mini-search-preview", 
    "openrouter:openai/gpt-4o-search-preview", "openrouter:rekaai/reka-flash-3:free", 
    "openrouter:google/gemma-3-27b-it:free", "openrouter:google/gemma-3-27b-it", 
    "openrouter:thedrummer/anubis-pro-105b-v1", "openrouter:latitudegames/wayfarer-large-70b-llama-3.3", 
    "openrouter:thedrummer/skyfall-36b-v2", "openrouter:microsoft/phi-4-multimodal-instruct", 
    "openrouter:perplexity/sonar-reasoning-pro", "openrouter:perplexity/sonar-pro", 
    "openrouter:perplexity/sonar-deep-research", "openrouter:deepseek/deepseek-r1-zero:free", 
    "openrouter:qwen/qwq-32b:free", "openrouter:qwen/qwq-32b", 
    "openrouter:moonshotai/moonlight-16b-a3b-instruct:free", 
    "openrouter:nousresearch/deephermes-3-llama-3-8b-preview:free", "openrouter:openai/gpt-4.5-preview", 
    "openrouter:google/gemini-2.0-flash-lite-001", "openrouter:anthropic/claude-3.7-sonnet", 
    "openrouter:anthropic/claude-3.7-sonnet:thinking", "openrouter:anthropic/claude-3.7-sonnet:beta", 
    "openrouter:perplexity/r1-1776", "openrouter:mistralai/mistral-saba", 
    "openrouter:cognitivecomputations/dolphin3.0-r1-mistral-24b:free", 
    "openrouter:cognitivecomputations/dolphin3.0-mistral-24b:free", 
    "openrouter:meta-llama/llama-guard-3-8b", "openrouter:openai/o3-mini-high", 
    "openrouter:deepseek/deepseek-r1-distill-llama-8b", "openrouter:google/gemini-2.0-flash-001", 
    "openrouter:qwen/qwen-vl-plus", "openrouter:aion-labs/aion-1.0", "openrouter:aion-labs/aion-1.0-mini", 
    "openrouter:aion-labs/aion-rp-llama-3.1-8b", "openrouter:qwen/qwen-vl-max", 
    "openrouter:qwen/qwen-turbo", "openrouter:qwen/qwen2.5-vl-72b-instruct:free"
];

// Get all OpenRouter models by combining the lists
const getAllOpenRouterModels = () => {
    // Add openrouter: prefix to models without it
    const prefixedStandardModels = openRouterModelsList.map(model => 
        model.startsWith('openrouter:') ? model : `openrouter:${model}`
    );

    // Combine with the already prefixed models
    return [...prefixedStandardModels, ...openRouterPrefixedModels];
};

// ---- STORAGE: SAVE SETTINGS (localStorage) ----
function saveSettings() {
  localStorage.setItem("puterChatUserSettings", JSON.stringify(userSettings));
}

function loadSettings() {
  let s = localStorage.getItem("puterChatUserSettings");
  if (s) {
    userSettings = JSON.parse(s);

    // Apply text size
    document.body.style.fontSize = (userSettings.textSize || 16) + "px";

    // Apply theme
    setTheme(userSettings.theme || 'light');

    // Add OpenRouter models if enabled
    if (userSettings.openRouterEnabled) {
      addOpenRouterModels();
    }

    // Default to common models if none are saved
    if (!userSettings.enabledModels || userSettings.enabledModels.length === 0) {
      userSettings.enabledModels = [
        "gpt-4o", "gpt-4.1-mini", "gpt-4.5-preview", "o1-mini", "o3-mini", "o4-mini", 
        "claude-3-5-sonnet", "claude-3-7-sonnet", "deepseek-chat", "deepseek-reasoner", 
        "gemini-2.0-flash", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", 
        "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", "mistral-large-latest", "grok-beta"
      ];
    }

    // Update model dropdown
    updateModelSelectOptions();

    // Set up streaming and multi-model modes
    if (userSettings.streamingMode) {
      toggleStreamingMode(true);
    }

    if (userSettings.multiModelMode) {
      toggleMultiModel(true);
    }
  }

  // Load chat history
  let hist = localStorage.getItem("puterChatHistory");
  if (hist) {
    try {
      chatHistory = JSON.parse(hist).map(hist => {
        hist.when = hist.when ? new Date(hist.when) : new Date();
        return hist;
      });
    } catch (e) {
      console.error("Error loading chat history:", e);
      chatHistory = [];
    }
  }
}

// ---- ADVANCED FEATURES ----

// Message Search implementation
function searchMessages(query) {
  if (!query) return [];
  
  // Check cache first
  const cacheKey = query.toLowerCase();
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }
  
  const results = [];
  
  // Search in current chat
  currentChat.forEach((msg, idx) => {
    if (typeof msg.content === 'string' && msg.content.toLowerCase().includes(cacheKey)) {
      results.push({
        type: 'current',
        index: idx,
        message: msg,
        highlight: highlightText(msg.content, query)
      });
    }
  });
  
  // Search in chat history
  chatHistory.forEach((chat, chatIdx) => {
    chat.messages.forEach((msg, msgIdx) => {
      if (typeof msg.content === 'string' && msg.content.toLowerCase().includes(cacheKey)) {
        results.push({
          type: 'history',
          chatIndex: chatIdx,
          messageIndex: msgIdx,
          message: msg,
          highlight: highlightText(msg.content, query)
        });
      }
    });
  });
  
  // Cache results
  searchCache.set(cacheKey, results);
  
  // Clear old cache entries
  if (searchCache.size > 100) {
    const oldestKey = searchCache.keys().next().value;
    searchCache.delete(oldestKey);
  }
  
  return results;
}

function highlightText(text, query) {
  if (typeof text !== 'string') return '';
  const regex = new RegExp(query, 'gi');
  return text.replace(regex, match => `<mark class="bg-yellow-200 dark:bg-yellow-700">${match}</mark>`);
}

// Display search results
function displaySearchResults(results) {
  const searchResultsContainer = document.getElementById('search-results-container');
  if (!searchResultsContainer) return;
  
  if (results.length === 0) {
    searchResultsContainer.innerHTML = '<div class="text-gray-500 dark:text-gray-400 p-4 text-center">No results found</div>';
    return;
  }
  
  searchResultsContainer.innerHTML = '';
  results.forEach((result, idx) => {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'p-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer';
    
    // Create message header
    const messageHeader = document.createElement('div');
    messageHeader.className = 'flex justify-between items-center mb-1';
    
    const roleSpan = document.createElement('span');
    roleSpan.className = 'font-medium';
    roleSpan.textContent = result.message.role === 'user' ? 'You' : (result.message.model || 'Assistant');
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'text-sm text-gray-500 dark:text-gray-400';
    timeSpan.textContent = result.message.time || '';
    
    messageHeader.appendChild(roleSpan);
    messageHeader.appendChild(timeSpan);
    
    // Create message content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'text-sm text-gray-700 dark:text-gray-300';
    contentDiv.innerHTML = result.highlight;
    
    // Add action buttons
    const actionDiv = document.createElement('div');
    actionDiv.className = 'flex justify-end mt-2';
    
    const jumpButton = document.createElement('button');
    jumpButton.className = 'text-blue-600 dark:text-blue-400 text-xs hover:underline mr-3';
    jumpButton.textContent = 'Jump to message';
    jumpButton.onclick = () => {
      togglePopup('search', false);
      
      if (result.type === 'current') {
        // Scroll to message in current chat
        const messageElements = document.querySelectorAll('#chat-container > div');
        if (messageElements.length > 0) {
          const targetElement = messageElements[currentChat.length - 1 - result.index];
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetElement.classList.add('highlight-animation');
            setTimeout(() => targetElement.classList.remove('highlight-animation'), 2000);
          }
        }
      } else if (result.type === 'history') {
        // Load chat from history and then scroll to message
        selectHistory(result.chatIndex);
        setTimeout(() => {
          const messageElements = document.querySelectorAll('#chat-container > div');
          if (messageElements.length > 0) {
            const targetElement = messageElements[currentChat.length - 1 - result.messageIndex];
            if (targetElement) {
              targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              targetElement.classList.add('highlight-animation');
              setTimeout(() => targetElement.classList.remove('highlight-animation'), 2000);
            }
          }
        }, 300);
      }
    };
    
    const copyButton = document.createElement('button');
    copyButton.className = 'text-gray-600 dark:text-gray-400 text-xs hover:underline';
    copyButton.textContent = 'Copy text';
    copyButton.onclick = () => {
      const text = typeof result.message.content === 'string' ? result.message.content : '';
      navigator.clipboard.writeText(text);
      
      // Show copied notification
      copyButton.textContent = 'Copied!';
      setTimeout(() => {
        copyButton.textContent = 'Copy text';
      }, 1500);
    };
    
    actionDiv.appendChild(jumpButton);
    actionDiv.appendChild(copyButton);
    
    // Assemble result div
    resultDiv.appendChild(messageHeader);
    resultDiv.appendChild(contentDiv);
    resultDiv.appendChild(actionDiv);
    
    searchResultsContainer.appendChild(resultDiv);
  });
}

// Conversation summarization
async function summarizeConversation() {
  if (currentChat.length === 0) {
    alert('There is no conversation to summarize.');
    return;
  }
  
  // Show loading indicator
  const summaryContainer = document.getElementById('summary-container');
  if (!summaryContainer) return;
  
  summaryContainer.innerHTML = `
    <div class="flex items-center justify-center p-4">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span class="ml-2">Generating summary...</span>
    </div>
  `;
  
  try {
    // Prepare the conversation for summarization
    const conversationText = currentChat.map(msg => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const content = typeof msg.content === 'string' ? msg.content : '[Image/Media content]';
      return `${role}: ${content}`;
    }).join('\n\n');
    
    // Request summary from the AI
    const summaryPrompt = `Please provide a concise summary of the following conversation. Highlight the main topics discussed and key conclusions reached:\n\n${conversationText}`;
    
    const model = document.getElementById('model-select')?.value || 'gpt-4o-mini';
    
    const summary = await puter.ai.chat(summaryPrompt, { model });
    
    // Display the summary
    if (summary) {
      summaryContainer.innerHTML = `
        <div class="p-4">
          <h3 class="text-lg font-semibold mb-2">Conversation Summary</h3>
          <div class="bg-gray-100 dark:bg-gray-800 p-3 rounded-cool">
            ${typeof summary === 'string' ? summary : 
              (summary.message?.content || summary.message?.text || summary.text || JSON.stringify(summary))}
          </div>
          <div class="flex justify-end mt-4">
            <button id="copy-summary-btn" class="bg-blue-600 text-white px-3 py-1 rounded-cool text-sm mr-2">
              <i class="fa fa-copy mr-1"></i> Copy
            </button>
            <button id="save-summary-btn" class="bg-green-600 text-white px-3 py-1 rounded-cool text-sm">
              <i class="fa fa-download mr-1"></i> Save
            </button>
          </div>
        </div>
      `;
      
      // Set up copy button
      document.getElementById('copy-summary-btn').addEventListener('click', function() {
        const summaryText = typeof summary === 'string' ? summary : 
          (summary.message?.content || summary.message?.text || summary.text || JSON.stringify(summary));
        navigator.clipboard.writeText(summaryText);
        this.innerHTML = '<i class="fa fa-check mr-1"></i> Copied!';
        setTimeout(() => {
          this.innerHTML = '<i class="fa fa-copy mr-1"></i> Copy';
        }, 1500);
      });
      
      // Set up save button
      document.getElementById('save-summary-btn').addEventListener('click', function() {
        const summaryText = typeof summary === 'string' ? summary : 
          (summary.message?.content || summary.message?.text || summary.text || JSON.stringify(summary));
        const blob = new Blob([summaryText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'conversation_summary.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    } else {
      summaryContainer.innerHTML = `
        <div class="p-4 text-red-600">
          <p>Unable to generate summary. Please try again later.</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Summarization error:', error);
    summaryContainer.innerHTML = `
      <div class="p-4 text-red-600">
        <p>Error generating summary: ${error.message || 'Unknown error'}</p>
        <button id="retry-summary-btn" class="bg-blue-600 text-white px-3 py-1 rounded-cool text-sm mt-2">
          Try Again
        </button>
      </div>
    `;
    
    document.getElementById('retry-summary-btn')?.addEventListener('click', summarizeConversation);
  }
}

// Context management
function addContextDocument(docText, docName) {
  if (!docText) return false;
  
  const docId = Date.now().toString();
  contextDocuments.push({
    id: docId,
    name: docName || `Document ${contextDocuments.length + 1}`,
    content: docText
  });
  
  updateContextList();
  return true;
}

function removeContextDocument(docId) {
  const index = contextDocuments.findIndex(doc => doc.id === docId);
  if (index !== -1) {
    contextDocuments.splice(index, 1);
    updateContextList();
    return true;
  }
  return false;
}

function updateContextList() {
  const contextListElement = document.getElementById('context-list');
  if (!contextListElement) return;
  
  if (contextDocuments.length === 0) {
    contextListElement.innerHTML = '<div class="text-gray-500 dark:text-gray-400 p-4 text-center">No context documents added</div>';
    return;
  }
  
  contextListElement.innerHTML = '';
  contextDocuments.forEach(doc => {
    const docElement = document.createElement('div');
    docElement.className = 'border border-gray-200 dark:border-gray-700 rounded-cool p-3 mb-2';
    
    const docHeader = document.createElement('div');
    docHeader.className = 'flex justify-between items-center mb-2';
    
    const docTitle = document.createElement('h4');
    docTitle.className = 'font-medium';
    docTitle.textContent = doc.name;
    
    const actionsDiv = document.createElement('div');
    
    const viewButton = document.createElement('button');
    viewButton.className = 'text-blue-600 hover:text-blue-800 mr-2';
    viewButton.innerHTML = '<i class="fa fa-eye"></i>';
    viewButton.title = 'View document';
    viewButton.onclick = () => {
      const previewContainer = document.getElementById('context-preview');
      if (previewContainer) {
        previewContainer.innerHTML = `
          <div class="p-3">
            <h4 class="font-medium mb-2">${doc.name}</h4>
            <pre class="bg-gray-100 dark:bg-gray-800 p-3 rounded-cool whitespace-pre-wrap text-sm max-h-60 overflow-y-auto">${doc.content}</pre>
          </div>
        `;
      }
    };
    
    const removeButton = document.createElement('button');
    removeButton.className = 'text-red-600 hover:text-red-800';
    removeButton.innerHTML = '<i class="fa fa-trash"></i>';
    removeButton.title = 'Remove document';
    removeButton.onclick = () => removeContextDocument(doc.id);
    
    actionsDiv.appendChild(viewButton);
    actionsDiv.appendChild(removeButton);
    
    docHeader.appendChild(docTitle);
    docHeader.appendChild(actionsDiv);
    
    const docPreview = document.createElement('div');
    docPreview.className = 'text-sm text-gray-700 dark:text-gray-300 overflow-hidden whitespace-nowrap text-overflow-ellipsis';
    docPreview.textContent = doc.content.substring(0, 100) + (doc.content.length > 100 ? '...' : '');
    
    docElement.appendChild(docHeader);
    docElement.appendChild(docPreview);
    
    contextListElement.appendChild(docElement);
  });
}

// Translation feature
async function translateMessage(messageIdx, targetLanguage) {
  if (messageIdx < 0 || messageIdx >= currentChat.length) return;
  
  const message = currentChat[messageIdx];
  if (typeof message.content !== 'string') return;
  
  try {
    // Show loading indicator
    const bubbleElement = document.querySelectorAll('#chat-container > div')[currentChat.length - 1 - messageIdx];
    if (!bubbleElement) return;
    
    const loadingId = 'translation-loading-' + Date.now();
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = loadingId;
    loadingIndicator.className = 'text-xs text-blue-600 mt-1 flex items-center';
    loadingIndicator.innerHTML = '<i class="fa fa-spinner fa-spin mr-1"></i> Translating...';
    
    const chatBubble = bubbleElement.querySelector('.chat-bubble');
    if (chatBubble) {
      chatBubble.appendChild(loadingIndicator);
    }
    
    // Request translation
    const translationPrompt = `Translate the following text to ${targetLanguage}:\n\n"${message.content}"`;
    const model = document.getElementById('model-select')?.value || 'gpt-4o-mini';
    
    const translation = await puter.ai.chat(translationPrompt, { model });
    
    // Remove loading indicator
    document.getElementById(loadingId)?.remove();
    
    if (translation) {
      const translationText = typeof translation === 'string' ? translation : 
        (translation.message?.content || translation.message?.text || translation.text || JSON.stringify(translation));
      
      // Create translation block
      const translationBlock = document.createElement('div');
      translationBlock.className = 'mt-3 border-t pt-2 text-sm';
      
      const translationHeader = document.createElement('div');
      translationHeader.className = 'flex justify-between items-center mb-1';
      
      const languageInfo = document.createElement('span');
      languageInfo.className = 'text-gray-600 dark:text-gray-400 text-xs';
      languageInfo.textContent = `Translated to ${targetLanguage}`;
      
      const closeButton = document.createElement('button');
      closeButton.className = 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300';
      closeButton.innerHTML = '<i class="fa fa-times"></i>';
      closeButton.onclick = () => translationBlock.remove();
      
      translationHeader.appendChild(languageInfo);
      translationHeader.appendChild(closeButton);
      
      const translationContent = document.createElement('div');
      translationContent.textContent = translationText;
      
      translationBlock.appendChild(translationHeader);
      translationBlock.appendChild(translationContent);
      
      if (chatBubble) {
        chatBubble.appendChild(translationBlock);
      }
    }
  } catch (error) {
    console.error('Translation error:', error);
    
    // Remove loading indicator
    document.getElementById('translation-loading')?.remove();
    
    // Show error message
    const errorMsg = document.createElement('div');
    errorMsg.className = 'text-xs text-red-600 mt-1';
    errorMsg.textContent = 'Translation failed. Please try again later.';
    
    const chatBubble = bubbleElement?.querySelector('.chat-bubble');
    if (chatBubble) {
      chatBubble.appendChild(errorMsg);
    }
  }
}

// Message export
function exportChat(format = 'txt') {
  if (currentChat.length === 0) {
    alert('There is no conversation to export.');
    return;
  }
  
  try {
    let content = '';
    let fileName = 'chat_export_' + new Date().toISOString().split('T')[0];
    let mimeType = 'text/plain';
    
    if (format === 'txt') {
      content = currentChat.map(msg => {
        const role = msg.role === 'user' ? 'You' : (msg.model || 'Assistant');
        const time = msg.time || '';
        const messageContent = typeof msg.content === 'string' ? msg.content : '[Image/Media content]';
        return `${role} (${time}):\n${messageContent}\n\n`;
      }).join('');
      fileName += '.txt';
    } else if (format === 'md') {
      content = `# Chat Export - ${new Date().toLocaleString()}\n\n`;
      content += currentChat.map(msg => {
        const role = msg.role === 'user' ? 'You' : (msg.model || 'Assistant');
        const time = msg.time || '';
        const messageContent = typeof msg.content === 'string' ? msg.content : '[Image/Media content]';
        return `## ${role} (${time})\n\n${messageContent}\n\n`;
      }).join('');
      fileName += '.md';
    } else if (format === 'html') {
      content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Chat Export - ${new Date().toLocaleString()}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .message { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
    .user { background-color: #f0f7ff; border-radius: 10px; padding: 10px; }
    .assistant { background-color: #f5f5f5; border-radius: 10px; padding: 10px; }
    .meta { font-size: 12px; color: #666; margin-bottom: 5px; }
    h1 { text-align: center; color: #333; }
  </style>
</head>
<body>
  <h1>Chat Export - ${new Date().toLocaleString()}</h1>
`;

      currentChat.forEach(msg => {
        const role = msg.role === 'user' ? 'You' : (msg.model || 'Assistant');
        const time = msg.time || '';
        const messageContent = typeof msg.content === 'string' ? msg.content.replace(/\n/g, '<br>') : '[Image/Media content]';
        const className = msg.role === 'user' ? 'user' : 'assistant';
        
        content += `
  <div class="message">
    <div class="meta">${role} - ${time}</div>
    <div class="${className}">${messageContent}</div>
  </div>
`;
      });
      
      content += `
</body>
</html>`;
      fileName += '.html';
      mimeType = 'text/html';
    } else if (format === 'json') {
      content = JSON.stringify({
        timestamp: new Date().toISOString(),
        messages: currentChat
      }, null, 2);
      fileName += '.json';
      mimeType = 'application/json';
    }
    
    // Create and download the file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Export error:', error);
    alert('Failed to export chat: ' + (error.message || 'Unknown error'));
    return false;
  }
}

// Web search integration
async function webSearch(query) {
  if (!query) return null;
  
  try {
    // This is a simplified implementation using AI to simulate web search
    // In a real implementation, you would use a proper search API
    const searchPrompt = `Please act as a web search engine and provide relevant, factual information about: "${query}". Include only the most pertinent and up-to-date information you have access to, formatted in a concise way with key points. Cite sources where possible.`;
    
    const model = document.getElementById('model-select')?.value || 'gpt-4o-mini';
    
    const searchResult = await puter.ai.chat(searchPrompt, { model });
    
    const resultText = typeof searchResult === 'string' ? searchResult : 
      (searchResult.message?.content || searchResult.message?.text || searchResult.text || JSON.stringify(searchResult));
    
    return resultText;
  } catch (error) {
    console.error('Web search error:', error);
    throw error;
  }
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', function(event) {
    // Avoid catching keyboard events when user is typing in inputs
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      // Special case: Enter to send message
      if (event.key === 'Enter' && !event.shiftKey && event.target.id === 'chat-input') {
        if (userSettings.keyboardShortcuts.sendMessage === 'Enter') {
          event.preventDefault();
          document.getElementById('chat-form')?.dispatchEvent(new Event('submit'));
        }
      }
      return;
    }
    
    // Check against defined shortcuts
    if (event.altKey && event.key === 'n') {
      // Alt+N: New chat
      event.preventDefault();
      document.getElementById('btn-new-chat')?.click();
    } else if (event.ctrlKey && event.key === 'f') {
      // Ctrl+F: Search messages
      event.preventDefault();
      togglePopup('search', true);
      document.getElementById('search-input')?.focus();
    } else if (event.altKey && event.key === 's') {
      // Alt+S: Settings
      event.preventDefault();
      document.getElementById('btn-settings')?.click();
    }
  });
}

// Markdown support using marked.js
function renderMarkdown(text) {
  if (!userSettings.markdownEnabled || !window.marked || typeof text !== 'string') {
    return text;
  }
  
  try {
    return window.marked(text);
  } catch (error) {
    console.error('Markdown rendering error:', error);
    return text;
  }
}

// Token usage visualization
function updateTokenUsageDisplay() {
  const tokenUsageEl = document.getElementById('token-usage');
  if (!tokenUsageEl) return;
  
  const { current, limit } = userSettings.tokenUsage;
  const percentage = Math.min(100, Math.round((current / limit) * 100));
  
  tokenUsageEl.innerHTML = `
    <div class="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div class="absolute top-0 left-0 h-full transition-all duration-300 ${percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-yellow-500' : 'bg-green-500'}"
        style="width: ${percentage}%"></div>
    </div>
    <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
      ${current} / ${limit} tokens (${percentage}%)
    </div>
  `;
}

// Estimate token count for a message - simplified approximation
function estimateTokenCount(text) {
  if (typeof text !== 'string') return 0;
  return Math.ceil(text.length / 4); // Rough estimate: 4 chars = 1 token
}

// Update token usage when sending messages
function updateTokenUsage(message) {
  if (typeof message !== 'string') return;
  
  const estimatedTokens = estimateTokenCount(message);
  userSettings.tokenUsage.current += estimatedTokens;
  
  // Reset if we exceed the limit (simplification)
  if (userSettings.tokenUsage.current > userSettings.tokenUsage.limit) {
    userSettings.tokenUsage.current = estimatedTokens;
  }
  
  updateTokenUsageDisplay();
}

window.onbeforeunload = function() {
  saveSettings();
  localStorage.setItem("puterChatHistory", JSON.stringify(chatHistory));
};

// ---- PUTER AUTH ----
// Handle Puter Auth
async function handlePuterAuth(event) {
  try {
    const isSignedIn = puter && puter.auth && puter.auth.isSignedIn && puter.auth.isSignedIn();
    const loginBtn = document.getElementById('puter-login-btn');
    const userInfo = document.getElementById('user-info');

    if (!loginBtn || !userInfo) return;

    if (isSignedIn) {
      if (puter.auth.signOut) {
        await puter.auth.signOut();
      }
      loginBtn.innerHTML = '<i class="fa fa-user mr-1"></i> Sign In';
      userInfo.classList.add('hidden');
      return;
    }

    if (puter.auth.signIn) {
      await puter.auth.signIn();

      if (puter.auth.getUser) {
        const user = await puter.auth.getUser();

        if (user?.username) {
          loginBtn.innerHTML = '<i class="fa fa-sign-out mr-1"></i> Sign Out';
          userInfo.textContent = user.username;
          userInfo.classList.remove('hidden');
        }
      }
    }
  } catch (error) {
    console.error('Auth error:', error);
    alert('Authentication failed. Please try again.');
  }
}

// Check initial auth state
async function checkAuthState() {
  if (puter && puter.auth && puter.auth.isSignedIn && puter.auth.isSignedIn()) {
    try {
      if (puter.auth.getUser) {
        const user = await puter.auth.getUser();
        if (user && user.username) {
          const loginBtn = document.getElementById('puter-login-btn');
          const userInfo = document.getElementById('user-info');
          if (loginBtn) loginBtn.innerHTML = '<i class="fa fa-sign-out mr-1"></i> Sign Out';
          if (userInfo) {
            userInfo.textContent = user.username;
            userInfo.classList.remove('hidden');
          }
        }
      }
    } catch (err) {
      console.error("Error getting user:", err);
    }
  }
}

// Add OpenRouter models to the list
function addOpenRouterModels() {
  const modelSelect = document.getElementById('model-select');
  if (!modelSelect) return;

  // Remove any existing OpenRouter optgroups
  const existingGroups = modelSelect.querySelectorAll('optgroup[label^="OpenRouter"]');
  existingGroups.forEach(group => group.remove());

  // Get all OpenRouter models
  const allOpenRouterModels = getAllOpenRouterModels();

  // Organize models by category
  const modelCategories = {
    "OpenRouter: OpenAI": [],
    "OpenRouter: Anthropic": [],
    "OpenRouter: Google": [],
    "OpenRouter: Meta": [],
    "OpenRouter: Mistral": [],
    "OpenRouter: Other": []
  };

  // Categorize models
  allOpenRouterModels.forEach(model => {
    const modelName = model.toLowerCase();

    if (modelName.includes('openai') || modelName.includes('gpt')) {
      modelCategories["OpenRouter: OpenAI"].push(model);
    } else if (modelName.includes('claude') || modelName.includes('anthropic')) {
      modelCategories["OpenRouter: Anthropic"].push(model);
    } else if (modelName.includes('gemini') || modelName.includes('google')) {
      modelCategories["OpenRouter: Google"].push(model);
    } else if (modelName.includes('llama') || modelName.includes('meta')) {
      modelCategories["OpenRouter: Meta"].push(model);
    } else if (modelName.includes('mistral') || modelName.includes('pixtral') || modelName.includes('codestral')) {
      modelCategories["OpenRouter: Mistral"].push(model);
    } else {
      modelCategories["OpenRouter: Other"].push(model);
    }
  });

  // Create optgroups for each category
  Object.entries(modelCategories).forEach(([category, models]) => {
    if (models.length === 0) return;

    // Create optgroup
    const group = document.createElement('optgroup');
    group.label = category;

    // Limit to 10 models per category to avoid overwhelming the dropdown
    const limitedModels = models.slice(0, 10);

    // Add models to group
    limitedModels.forEach(model => {
      const option = document.createElement('option');
      option.value = model;

      // Format display name 
      let displayName = model.replace('openrouter:', '');
      if (displayName.length > 30) {
        // Shorten long names
        displayName = displayName.split('/')[1] || displayName;
        if (displayName.length > 30) {
          displayName = displayName.substring(0, 27) + '...';
        }
      }

      option.textContent = displayName;
      option.title = model; // Show full model name on hover
      group.appendChild(option);

      // Add to enabled models if not already there
      if (!userSettings.enabledModels.includes(model)) {
        userSettings.enabledModels.push(model);
      }
    });

    modelSelect.appendChild(group);
  });

  saveSettings();
}

// Update the model selection dropdown based on OpenRouter toggle
function updateModelSelectionBasedOnOpenRouterSetting() {
  const modelSelectElement = document.getElementById('model-select');
  if (!modelSelectElement) return;

  // Clear current selection
  const currentValue = modelSelectElement.value;

  if (userSettings.openRouterEnabled) {
    // Hide non-OpenRouter models
    Array.from(modelSelectElement.options).forEach(option => {
      const optgroup = option.parentNode;
      if (optgroup && optgroup.tagName === 'OPTGROUP' && !optgroup.label.startsWith('OpenRouter')) {
        option.style.display = 'none';
      }
    });

    // Show OpenRouter models
    Array.from(modelSelectElement.options).forEach(option => {
      const optgroup = option.parentNode;
      if (optgroup && optgroup.tagName === 'OPTGROUP' && optgroup.label.startsWith('OpenRouter')) {
        option.style.display = '';
      }
    });

    // If current selection is hidden, select first visible option
    if (!currentValue.startsWith('openrouter:')) {
      const firstVisibleOption = Array.from(modelSelectElement.options).find(opt => opt.style.display !== 'none');
      if (firstVisibleOption) {
        modelSelectElement.value = firstVisibleOption.value;
      }
    }
  } else {
    // Show all options
    Array.from(modelSelectElement.options).forEach(option => {
      option.style.display = '';
    });

    // If current selection is from OpenRouter, select first standard option
    if (currentValue.startsWith('openrouter:')) {
      const firstStandardOption = Array.from(modelSelectElement.options).find(opt => {
        const optgroup = opt.parentNode;
        return optgroup && optgroup.tagName === 'OPTGROUP' && !optgroup.label.startsWith('OpenRouter');
      });

      if (firstStandardOption) {
        modelSelectElement.value = firstStandardOption.value;
      }
    }
  }
}

// INIT
document.addEventListener('DOMContentLoaded', function() {
  try {
    // Load Marked.js for markdown support
    const markedScript = document.createElement('script');
    markedScript.src = 'https://cdn.jsdelivr.net/npm/marked@4.0.2/marked.min.js';
    document.head.appendChild(markedScript);
    
    // Load settings first
    loadSettings();

    // Initialize UI components
    renderChat();

    // Initialize theme
    const isDarkTheme = userSettings.theme === 'dark';
    const moonIcon = document.getElementById('moon-icon');
    const sunIcon = document.getElementById('sun-icon');
    if (moonIcon) moonIcon.classList.toggle('hidden', isDarkTheme);
    if (sunIcon) sunIcon.classList.toggle('hidden', !isDarkTheme);

    // Initialize Puter Auth
    const loginBtn = document.getElementById('puter-login-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', handlePuterAuth);
    }

    // Check auth state
    setTimeout(checkAuthState, 500);

    // Add OpenRouter models if enabled
    if (userSettings.openRouterEnabled) {
      addOpenRouterModels();
      updateModelSelectionBasedOnOpenRouterSetting();
    }

    // Initialize toggle switches
    const streamingToggle = document.getElementById('streaming-toggle');
    if (streamingToggle) {
      streamingToggle.checked = streamingMode;
      streamingToggle.addEventListener('change', function() {
        toggleStreamingMode(this.checked);
      });
    }

    const multiToggle = document.getElementById('multi-toggle');
    if (multiToggle) {
      multiToggle.checked = multiModelMode;
      multiToggle.addEventListener('change', function() {
        toggleMultiModel(this.checked);
      });
    }

    // Initialize models list in settings
    populateModelsList();

    // Setup select all and deselect all buttons
    const selectAllBtn = document.getElementById('select-all-models');
    const deselectAllBtn = document.getElementById('deselect-all-models');
    
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', function() {
        document.querySelectorAll('#models-list input[type=checkbox]').forEach(checkbox => {
          checkbox.checked = true;
        });
      });
    }
    
    if (deselectAllBtn) {
      deselectAllBtn.addEventListener('click', function() {
        document.querySelectorAll('#models-list input[type=checkbox]').forEach(checkbox => {
          checkbox.checked = false;
        });
      });
    }
    
    // Setup search functionality
    const searchBtn = document.getElementById('btn-search');
    if (searchBtn) {
      searchBtn.addEventListener('click', function() {
        togglePopup('search', true);
        setTimeout(() => {
          document.getElementById('search-input')?.focus();
        }, 100);
      });
    }
    
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', debounce(function() {
        const query = this.value.trim();
        if (query.length < 2) {
          document.getElementById('search-results-container').innerHTML = '<div class="text-gray-500 dark:text-gray-400 p-4 text-center">Enter at least 2 characters</div>';
          return;
        }
        
        const results = searchMessages(query);
        displaySearchResults(results);
      }, 300));
    }
    
    // Setup summarize functionality
    const summarizeBtn = document.getElementById('btn-summarize');
    if (summarizeBtn) {
      summarizeBtn.addEventListener('click', function() {
        togglePopup('summary', true);
        summarizeConversation();
      });
    }
    
    // Setup context management
    const contextBtn = document.getElementById('btn-context');
    if (contextBtn) {
      contextBtn.addEventListener('click', function() {
        togglePopup('context', true);
        updateContextList();
      });
    }
    
    const addContextBtn = document.getElementById('add-context-btn');
    if (addContextBtn) {
      addContextBtn.addEventListener('click', function() {
        const contextText = document.getElementById('context-text').value.trim();
        const contextName = document.getElementById('context-name').value.trim() || `Document ${contextDocuments.length + 1}`;
        
        if (contextText) {
          addContextDocument(contextText, contextName);
          document.getElementById('context-text').value = '';
          document.getElementById('context-name').value = '';
        }
      });
    }
    
    const contextFileBtn = document.getElementById('context-file-btn');
    const contextFileInput = document.getElementById('context-file-input');
    if (contextFileBtn && contextFileInput) {
      contextFileBtn.addEventListener('click', function() {
        contextFileInput.click();
      });
      
      contextFileInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
          let content = '';
          if (file.type.startsWith('text/')) {
            content = await file.text();
          } else {
            // For non-text files, try to extract text using OCR if it's an image
            if (file.type.startsWith('image/')) {
              // Show loading state
              contextFileBtn.innerHTML = '<i class="fa fa-spinner fa-spin mr-1"></i> Processing...';
              
              try {
                const result = await puter.ai.img2txt(file);
                content = result || '';
              } catch (error) {
                console.error("OCR error:", error);
                alert("Failed to extract text from image: " + (error.message || "Unknown error"));
                contextFileBtn.innerHTML = '<i class="fa fa-file mr-1"></i> Upload File';
                return;
              }
            } else {
              alert('Only text and image files are supported.');
              return;
            }
          }
          
          if (content) {
            const fileName = file.name || `File ${contextDocuments.length + 1}`;
            addContextDocument(content, fileName);
          }
          
          // Reset file input
          contextFileInput.value = '';
          contextFileBtn.innerHTML = '<i class="fa fa-file mr-1"></i> Upload File';
        } catch (error) {
          console.error("File reading error:", error);
          alert("Failed to read file: " + (error.message || "Unknown error"));
          contextFileBtn.innerHTML = '<i class="fa fa-file mr-1"></i> Upload File';
        }
      });
    }
    
    // Setup export functionality
    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', function() {
        togglePopup('export', true);
      });
    }
    
    const exportButtons = {
      txt: document.getElementById('export-txt-btn'),
      md: document.getElementById('export-md-btn'),
      html: document.getElementById('export-html-btn'),
      json: document.getElementById('export-json-btn')
    };
    
    Object.entries(exportButtons).forEach(([format, button]) => {
      if (button) {
        button.addEventListener('click', function() {
          exportChat(format);
          togglePopup('export', false);
        });
      }
    });
    
    // Setup web search functionality
    const webSearchInput = document.getElementById('websearch-input');
    if (webSearchInput) {
      webSearchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          
          const query = this.value.trim();
          if (!query) return;
          
          const resultsContainer = document.getElementById('websearch-results');
          if (!resultsContainer) return;
          
          resultsContainer.innerHTML = `
            <div class="flex items-center justify-center p-4">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span class="ml-2">Searching the web...</span>
            </div>
          `;
          
          webSearch(query)
            .then(result => {
              if (result) {
                resultsContainer.innerHTML = `
                  <div class="p-3">
                    <h3 class="font-medium mb-2">Search Results for "${query}"</h3>
                    <div class="bg-gray-100 dark:bg-gray-800 p-3 rounded-cool whitespace-pre-wrap">${result}</div>
                  </div>
                `;
                
                // Enable the "Add to Context" button
                const addToContextBtn = document.getElementById('websearch-add-context-btn');
                if (addToContextBtn) {
                  addToContextBtn.disabled = false;
                  addToContextBtn.addEventListener('click', function() {
                    addContextDocument(result, `Web Search: ${query}`);
                    togglePopup('websearch', false);
                    togglePopup('context', true);
                  });
                }
              } else {
                resultsContainer.innerHTML = `
                  <div class="p-4 text-red-600">
                    <p>No results found. Please try a different search term.</p>
                  </div>
                `;
              }
            })
            .catch(error => {
              console.error('Web search error:', error);
              resultsContainer.innerHTML = `
                <div class="p-4 text-red-600">
                  <p>Error searching the web: ${error.message || 'Unknown error'}</p>
                  <button id="retry-search-btn" class="bg-blue-600 text-white px-3 py-1 rounded-cool text-sm mt-2">
                    Try Again
                  </button>
                </div>
              `;
              
              document.getElementById('retry-search-btn')?.addEventListener('click', function() {
                webSearchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
              });
            });
        }
      });
    }
    
    // Setup custom theme creator
    const createThemeBtn = document.getElementById('create-theme-btn');
    if (createThemeBtn) {
      createThemeBtn.addEventListener('click', function() {
        togglePopup('theme-creator', true);
        
        // Set initial values
        document.getElementById('theme-name').value = 'My Custom Theme';
        document.getElementById('theme-base-mode').value = 'light';
        document.getElementById('theme-bg-color').value = '#ffffff';
        document.getElementById('theme-bg-color-text').value = '#ffffff';
        document.getElementById('theme-text-color').value = '#000000';
        document.getElementById('theme-text-color-text').value = '#000000';
        document.getElementById('theme-user-color').value = '#e3f2fd';
        document.getElementById('theme-user-color-text').value = '#e3f2fd';
        document.getElementById('theme-assistant-color').value = '#f5f5f5';
        document.getElementById('theme-assistant-color-text').value = '#f5f5f5';
        document.getElementById('theme-accent-color').value = '#3b82f6';
        document.getElementById('theme-accent-color-text').value = '#3b82f6';
        
        updateThemePreview();
      });
    }
    
    // Color input synchronization
    const colorInputs = [
      { color: 'bg', text: 'bg-color-text' },
      { color: 'text', text: 'text-color-text' },
      { color: 'user', text: 'user-color-text' },
      { color: 'assistant', text: 'assistant-color-text' },
      { color: 'accent', text: 'accent-color-text' }
    ];
    
    colorInputs.forEach(input => {
      const colorInput = document.getElementById(`theme-${input.color}-color`);
      const textInput = document.getElementById(`theme-${input.text}`);
      
      if (colorInput && textInput) {
        colorInput.addEventListener('input', function() {
          textInput.value = this.value;
          updateThemePreview();
        });
        
        textInput.addEventListener('input', function() {
          // Ensure value is a valid hex color
          if (/^#[0-9A-F]{6}$/i.test(this.value)) {
            colorInput.value = this.value;
            updateThemePreview();
          }
        });
      }
    });
    
    // Base mode change
    const themeBaseMode = document.getElementById('theme-base-mode');
    if (themeBaseMode) {
      themeBaseMode.addEventListener('change', updateThemePreview);
    }
    
    // Theme preview update function
    function updateThemePreview() {
      const preview = document.getElementById('theme-preview');
      if (!preview) return;
      
      const baseMode = document.getElementById('theme-base-mode')?.value || 'light';
      const bgColor = document.getElementById('theme-bg-color')?.value || '#ffffff';
      const textColor = document.getElementById('theme-text-color')?.value || '#000000';
      const userColor = document.getElementById('theme-user-color')?.value || '#e3f2fd';
      const assistantColor = document.getElementById('theme-assistant-color')?.value || '#f5f5f5';
      const accentColor = document.getElementById('theme-accent-color')?.value || '#3b82f6';
      
      // Update preview background and text colors
      preview.style.backgroundColor = bgColor;
      preview.style.color = textColor;
      
      // Update message bubbles
      const userBubble = preview.querySelector('div:first-child');
      const assistantBubble = preview.querySelector('div:last-child');
      
      if (userBubble) {
        userBubble.style.backgroundColor = userColor;
        userBubble.style.borderColor = adjustColor(userColor, -20);
      }
      
      if (assistantBubble) {
        assistantBubble.style.backgroundColor = assistantColor;
        assistantBubble.style.borderColor = adjustColor(assistantColor, -20);
      }
    }
    
    // Helper function to adjust color brightness
    function adjustColor(hex, percent) {
      // Convert hex to RGB
      let r = parseInt(hex.substring(1, 3), 16);
      let g = parseInt(hex.substring(3, 5), 16);
      let b = parseInt(hex.substring(5, 7), 16);
      
      // Adjust brightness
      r = Math.max(0, Math.min(255, r + percent));
      g = Math.max(0, Math.min(255, g + percent));
      b = Math.max(0, Math.min(255, b + percent));
      
      // Convert back to hex
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }
    
    // Save custom theme
    const themeSaveBtn = document.getElementById('theme-save-btn');
    if (themeSaveBtn) {
      themeSaveBtn.addEventListener('click', function() {
        const name = document.getElementById('theme-name')?.value || 'Custom Theme';
        const baseMode = document.getElementById('theme-base-mode')?.value || 'light';
        const bgColor = document.getElementById('theme-bg-color')?.value || '#ffffff';
        const textColor = document.getElementById('theme-text-color')?.value || '#000000';
        const userColor = document.getElementById('theme-user-color')?.value || '#e3f2fd';
        const assistantColor = document.getElementById('theme-assistant-color')?.value || '#f5f5f5';
        const accentColor = document.getElementById('theme-accent-color')?.value || '#3b82f6';
        
        // Create theme object
        const theme = {
          id: 'custom_' + Date.now(),
          name,
          baseMode,
          bgColor,
          textColor,
          userColor,
          assistantColor,
          accentColor
        };
        
        // Add to custom themes
        if (!userSettings.customThemes) {
          userSettings.customThemes = [];
        }
        
        userSettings.customThemes.push(theme);
        saveSettings();
        
        // Update theme select dropdown
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
          const customGroup = themeSelect.querySelector('#custom-themes-optgroup');
          if (customGroup) {
            const option = document.createElement('option');
            option.value = theme.id;
            option.textContent = theme.name;
            customGroup.appendChild(option);
          }
        }
        
        togglePopup('theme-creator', false);
        alert('Custom theme saved successfully!');
      });
    }
    
    // Reset theme creator
    const themeResetBtn = document.getElementById('theme-reset-btn');
    if (themeResetBtn) {
      themeResetBtn.addEventListener('click', function() {
        document.getElementById('theme-name').value = 'My Custom Theme';
        document.getElementById('theme-base-mode').value = 'light';
        document.getElementById('theme-bg-color').value = '#ffffff';
        document.getElementById('theme-bg-color-text').value = '#ffffff';
        document.getElementById('theme-text-color').value = '#000000';
        document.getElementById('theme-text-color-text').value = '#000000';
        document.getElementById('theme-user-color').value = '#e3f2fd';
        document.getElementById('theme-user-color-text').value = '#e3f2fd';
        document.getElementById('theme-assistant-color').value = '#f5f5f5';
        document.getElementById('theme-assistant-color-text').value = '#f5f5f5';
        document.getElementById('theme-accent-color').value = '#3b82f6';
        document.getElementById('theme-accent-color-text').value = '#3b82f6';
        
        updateThemePreview();
      });
    }
    
    // Setup translation feature
    document.addEventListener('click', function(e) {
      // Find if the click was on a translate button
      if (e.target.closest('.message-actions .action-button[title="Translate"]')) {
        const button = e.target.closest('.action-button');
        const messageIndex = parseInt(button.getAttribute('data-message-idx'));
        
        if (!isNaN(messageIndex)) {
          // Open translate popup
          document.getElementById('translate-message-idx').value = messageIndex;
          togglePopup('translate', true);
        }
      }
    });
    
    const translateConfirmBtn = document.getElementById('translate-confirm-btn');
    if (translateConfirmBtn) {
      translateConfirmBtn.addEventListener('click', function() {
        const messageIdx = parseInt(document.getElementById('translate-message-idx').value);
        const language = document.getElementById('translate-language').value;
        
        if (!isNaN(messageIdx)) {
          translateMessage(messageIdx, language);
          togglePopup('translate', false);
        }
      });
    }
    
    // Feature tab settings
    const markdownToggle = document.getElementById('markdown-toggle');
    if (markdownToggle) {
      markdownToggle.checked = userSettings.markdownEnabled !== false;
      markdownToggle.addEventListener('change', function() {
        userSettings.markdownEnabled = this.checked;
        saveSettings();
        renderChat(); // Re-render chat with markdown
      });
    }
    
    const tokenCounterToggle = document.getElementById('token-counter-toggle');
    if (tokenCounterToggle) {
      tokenCounterToggle.checked = true; // Default enabled
      tokenCounterToggle.addEventListener('change', function() {
        const tokenUsage = document.getElementById('token-usage');
        if (tokenUsage) {
          tokenUsage.style.display = this.checked ? '' : 'none';
        }
      });
    }
    
    const tokenLimitRange = document.getElementById('token-limit-range');
    const tokenLimitValue = document.getElementById('token-limit-value');
    if (tokenLimitRange && tokenLimitValue) {
      tokenLimitRange.value = userSettings.tokenUsage?.limit || 4000;
      tokenLimitValue.textContent = `${(userSettings.tokenUsage?.limit || 4000) / 1000}K`;
      
      tokenLimitRange.addEventListener('input', function() {
        const value = parseInt(this.value);
        tokenLimitValue.textContent = `${value / 1000}K`;
        
        if (!userSettings.tokenUsage) {
          userSettings.tokenUsage = { current: 0, limit: value };
        } else {
          userSettings.tokenUsage.limit = value;
        }
        
        updateTokenUsageDisplay();
      });
    }
    
    // Clear local storage button
    const clearStorageBtn = document.getElementById('clear-local-storage');
    if (clearStorageBtn) {
      clearStorageBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to clear all saved data? This action cannot be undone.')) {
          localStorage.clear();
          alert('All data cleared. The page will now reload.');
          location.reload();
        }
      });
    }
    
    // Keyboard shortcuts tab settings
    const shortcutSelects = {
      send: document.getElementById('shortcut-send'),
      newchat: document.getElementById('shortcut-newchat'),
      search: document.getElementById('shortcut-search'),
      settings: document.getElementById('shortcut-settings')
    };
    
    Object.entries(shortcutSelects).forEach(([action, select]) => {
      if (select) {
        // Set initial value from user settings
        if (userSettings.keyboardShortcuts && userSettings.keyboardShortcuts[action]) {
          select.value = userSettings.keyboardShortcuts[action];
        }
        
        // Handle changes
        select.addEventListener('change', function() {
          if (!userSettings.keyboardShortcuts) {
            userSettings.keyboardShortcuts = {};
          }
          userSettings.keyboardShortcuts[action] = this.value;
          saveSettings();
        });
      }
    });
    
    // Initialize token usage display
    updateTokenUsageDisplay();
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Display custom themes in the dropdown
    if (userSettings.customThemes && userSettings.customThemes.length > 0) {
      const themeSelect = document.getElementById('theme-select');
      const customGroup = themeSelect?.querySelector('#custom-themes-optgroup');
      
      if (themeSelect && customGroup) {
        userSettings.customThemes.forEach(theme => {
          const option = document.createElement('option');
          option.value = theme.id;
          option.textContent = theme.name;
          customGroup.appendChild(option);
        });
        
        // If current theme is a custom theme, select it
        if (userSettings.theme && userSettings.theme.startsWith('custom_')) {
          themeSelect.value = userSettings.theme;
        }
      }
    }

    // Mobile optimization
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => window.scrollTo(0, 0), 100);
    });

    console.log('Initialization complete');
  } catch (error) {
    console.error('Initialization error:', error);
  }
});
// Voice input functionality
function setupVoiceInput() {
  const voiceButton = document.getElementById('voice-input-btn');
  const chatInput = document.getElementById('chat-input');
  
  if (!voiceButton || !chatInput) return;
  
  let isRecording = false;
  let recognition;
  
  // Check if browser supports SpeechRecognition
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = false;
    recognition.interimResults = true;
    
    // Set language to English - could make this configurable
    recognition.lang = 'en-US';
    
    // Handle recognition results
    recognition.onresult = function(event) {
      const transcript = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('');
      
      // Update the textarea with the transcript
      chatInput.value = transcript;
      
      // Auto-resize the textarea
      chatInput.style.height = 'auto';
      chatInput.style.height = chatInput.scrollHeight + 'px';
    };
    
    // When recognition ends
    recognition.onend = function() {
      voiceButton.innerHTML = '<i class="fa fa-microphone"></i>';
      voiceButton.classList.remove('bg-red-500', 'hover:bg-red-600');
      voiceButton.classList.add('bg-gray-200', 'hover:bg-gray-300', 'dark:bg-gray-700', 'dark:hover:bg-gray-600');
      isRecording = false;
    };
    
    // Error handling
    recognition.onerror = function(event) {
      console.error('Speech recognition error:', event.error);
      voiceButton.innerHTML = '<i class="fa fa-microphone"></i>';
      voiceButton.classList.remove('bg-red-500', 'hover:bg-red-600');
      voiceButton.classList.add('bg-gray-200', 'hover:bg-gray-300', 'dark:bg-gray-700', 'dark:hover:bg-gray-600');
      isRecording = false;
      
      // Show error message
      const errorMessage = document.createElement('div');
      errorMessage.className = 'absolute top-0 left-0 right-0 bg-red-500 text-white text-center py-1 text-sm';
      errorMessage.textContent = 'Speech recognition error: ' + event.error;
      errorMessage.style.zIndex = '999';
      document.body.appendChild(errorMessage);
      
      // Remove error message after 3 seconds
      setTimeout(() => {
        errorMessage.remove();
      }, 3000);
    };
    
    // Toggle voice input
    voiceButton.addEventListener('click', function() {
      if (isRecording) {
        recognition.stop();
      } else {
        // Clear previous input
        chatInput.value = '';
        recognition.start();
        voiceButton.innerHTML = '<i class="fa fa-stop"></i>';
        voiceButton.classList.remove('bg-gray-200', 'hover:bg-gray-300', 'dark:bg-gray-700', 'dark:hover:bg-gray-600');
        voiceButton.classList.add('bg-red-500', 'hover:bg-red-600');
        isRecording = true;
      }
    });
  } else {
    // Browser doesn't support speech recognition
    voiceButton.addEventListener('click', function() {
      alert('Speech recognition is not supported in your browser. Try using Chrome or Edge.');
    });
  }
}

// Initialize voice input on document load
document.addEventListener('DOMContentLoaded', function() {
  setupVoiceInput();
  // Rest of initialization code...
});

// Load marked.js before using it
function loadMarked() {
  return new Promise((resolve, reject) => {
    if (window.marked) {
      resolve(window.marked);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/marked@4.0.2/marked.min.js';
    script.onload = () => resolve(window.marked);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Initialize marked when the page loads
document.addEventListener('DOMContentLoaded', async function() {
  try {
    await loadMarked();
  } catch (error) {
    console.error('Failed to load marked.js:', error);
  }
});

// Add token info functionality
document.addEventListener('DOMContentLoaded', function() {
  const tokenInfoBtn = document.getElementById('token-info-btn');
  const tokenUsage = document.getElementById('token-usage');

  if (tokenInfoBtn && tokenUsage) {
    tokenInfoBtn.addEventListener('click', function() {
      const tokenStats = document.createElement('div');
      tokenStats.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
      
      const currentTokens = userSettings.tokenUsage?.current || 0;
      const tokenLimit = userSettings.tokenUsage?.limit || 4000;
      const percentage = Math.round((currentTokens / tokenLimit) * 100);
      
      tokenStats.innerHTML = `
        <div class="bg-white dark:bg-gray-800 p-4 rounded-cool max-w-md w-full mx-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">Token Usage Statistics</h3>
            <button class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" onclick="this.parentElement.parentElement.remove()">
              <i class="fa fa-times"></i>
            </button>
          </div>
          <div class="space-y-4">
            <div>
              <div class="flex justify-between mb-1">
                <span>Current Usage</span>
                <span>${currentTokens} tokens</span>
              </div>
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div class="bg-blue-600 h-2 rounded-full" style="width: ${percentage}%"></div>
              </div>
            </div>
            <div class="flex justify-between">
              <span>Token Limit</span>
              <span>${tokenLimit} tokens</span>
            </div>
            <div class="flex justify-between">
              <span>Remaining</span>
              <span>${tokenLimit - currentTokens} tokens</span>
            </div>
            <div class="flex justify-between">
              <span>Usage Percentage</span>
              <span>${percentage}%</span>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(tokenStats);
      
      // Close on click outside
      tokenStats.addEventListener('click', function(e) {
        if (e.target === tokenStats) {
          tokenStats.remove();
        }
      });
    });
  }
});

// Token usage tracking
let totalTokens = 0;
const TOKEN_LIMIT = 100000; // Example limit, adjust as needed

async function updateTokenUsage() {
  try {
    // Check if user is signed in
    if (!puter.auth.isSignedIn()) {
      // Show sign in prompt in the token usage popup
      const detailsContainer = document.querySelector('.token-usage-details');
      if (detailsContainer) {
        detailsContainer.innerHTML = `
          <div class="text-sm text-center">
            <p class="mb-2">Please sign in to view storage usage</p>
            <button onclick="handleTokenUsageAuth()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-cool text-xs">
              Sign In
            </button>
          </div>
        `;
      }
      return;
    }

    // Get space usage from puter.fs.space()
    const spaceData = await puter.fs.space();
    if (!spaceData) {
      throw new Error('Could not fetch usage data');
    }

    const usedBytes = spaceData.used || 0;
    const totalBytes = spaceData.capacity || 100000;
    const usagePercent = Math.min((usedBytes / totalBytes) * 100, 100);
    
    // Convert bytes to more readable format
    const usedFormatted = formatBytes(usedBytes);
    const totalFormatted = formatBytes(totalBytes);
    const remainingFormatted = formatBytes(totalBytes - usedBytes);
    
    // Update the UI elements
    const percentElement = document.getElementById('token-usage-percent');
    const countElement = document.getElementById('token-usage-count');
    const progressBar = document.getElementById('token-progress-bar');
    const detailsContainer = document.querySelector('.token-usage-details');

    if (percentElement) {
      percentElement.textContent = `${Math.round(usagePercent)}%`;
    }
    
    if (countElement) {
      countElement.textContent = usedFormatted;
    }
    
    if (progressBar) {
      progressBar.style.width = `${usagePercent}%`;
      
      // Add warning class if usage is high
      if (usagePercent > 80) {
        progressBar.classList.add('token-progress-warning');
      } else {
        progressBar.classList.remove('token-progress-warning');
      }
    }
    
    if (detailsContainer) {
      detailsContainer.innerHTML = `
        <div class="text-sm">
          <div class="flex justify-between mb-1">
            <span>Total Storage:</span>
            <span>${totalFormatted}</span>
          </div>
          <div class="flex justify-between mb-1">
            <span>Used:</span>
            <span>${usedFormatted}</span>
          </div>
          <div class="flex justify-between mb-1">
            <span>Remaining:</span>
            <span>${remainingFormatted}</span>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error fetching storage usage:', error);
    
    // Show error in the token usage popup
    const detailsContainer = document.querySelector('.token-usage-details');
    if (detailsContainer) {
      detailsContainer.innerHTML = `
        <div class="text-sm text-red-600 dark:text-red-400">
          <p class="mb-2">Error fetching storage usage: ${error.message || 'Please try signing in again'}</p>
          <button onclick="handleTokenUsageAuth()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-cool text-xs">
            Sign In
          </button>
        </div>
      `;
    }
  }
}

// Helper function to format bytes into human readable format
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Update token usage when the popup is opened
document.getElementById('token-info-btn')?.addEventListener('click', () => {
  updateTokenUsage();
  // Set up auto-refresh every 2 seconds while popup is open
  const refreshInterval = setInterval(updateTokenUsage, 2000);
  
  // Clear interval when popup is closed
  const tokenPopup = document.getElementById('popup-tokens');
  if (tokenPopup) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class' && tokenPopup.classList.contains('hidden')) {
          clearInterval(refreshInterval);
          observer.disconnect();
        }
      });
    });
    
    observer.observe(tokenPopup, { attributes: true });
  }
});

// Helper function to handle authentication for token usage
async function handleTokenUsageAuth() {
  try {
    await puter.auth.signIn();
    // After successful sign in, update the token usage display
    updateTokenUsage();
  } catch (error) {
    console.error('Authentication error:', error);
    const detailsContainer = document.querySelector('.token-usage-details');
    if (detailsContainer) {
      detailsContainer.innerHTML = `
        <div class="text-sm text-red-600 dark:text-red-400">
          <p class="mb-2">Authentication failed: ${error.message || 'Please try again'}</p>
          <button onclick="handleTokenUsageAuth()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-cool text-xs">
            Try Again
          </button>
        </div>
      `;
    }
  }
}

// Global variable to store the update interval ID
let tokenUsageUpdateInterval = null;

// Function to start token usage updates
async function startTokenUsageUpdates() {
  try {
    // Check authentication first
    if (!puter.auth.isSignedIn()) {
      // Show sign in prompt
      const detailsContainer = document.querySelector('.token-usage-details');
      if (detailsContainer) {
        detailsContainer.innerHTML = `
          <div class="text-sm text-center">
            <p class="mb-2">Please sign in to view storage usage</p>
            <button onclick="handleTokenUsageAuth()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-cool text-xs">
              Sign In
            </button>
          </div>
        `;
      }
      return;
    }

    // Clear any existing interval
    stopTokenUsageUpdates();

    // Initial update
    await updateTokenUsage();

    // Set up new interval only if we're authenticated
    tokenUsageUpdateInterval = setInterval(async () => {
      if (!puter.auth.isSignedIn()) {
        stopTokenUsageUpdates();
        return;
      }
      try {
        await updateTokenUsage();
      } catch (error) {
        console.error('Error in update interval:', error);
        if (error?.status === 401) {
          stopTokenUsageUpdates();
        }
      }
    }, 2000);
  } catch (error) {
    console.error('Error starting token usage updates:', error);
    stopTokenUsageUpdates();
  }
}

// Update the token info button click handler
document.addEventListener('DOMContentLoaded', function() {
  const tokenInfoBtn = document.getElementById('token-info-btn');
  if (tokenInfoBtn) {
    tokenInfoBtn.addEventListener('click', async () => {
      // Try to initialize updates
      await startTokenUsageUpdates();
      
      // Set up popup close detection
      const tokenPopup = document.getElementById('popup-tokens');
      if (tokenPopup) {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class' && tokenPopup.classList.contains('hidden')) {
              stopTokenUsageUpdates();
              observer.disconnect();
            }
          });
        });
        
        observer.observe(tokenPopup, { attributes: true });
      }
    });
  }
});

// Update the auth handler
async function handleTokenUsageAuth() {
  try {
    await puter.auth.signIn();
    // Only start updates if authentication was successful
    if (puter.auth.isSignedIn()) {
      await startTokenUsageUpdates();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    const detailsContainer = document.querySelector('.token-usage-details');
    if (detailsContainer) {
      detailsContainer.innerHTML = `
        <div class="text-sm text-red-600 dark:text-red-400">
          <p class="mb-2">Authentication failed: ${error.message || 'Please try again'}</p>
          <button onclick="handleTokenUsageAuth()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-cool text-xs">
            Try Again
          </button>
        </div>
      `;
    }
    stopTokenUsageUpdates();
  }
}

// Function to format bytes into human readable format
function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// Function to update storage usage display
async function updateTokenUsage() {
    try {
        // Get space usage from puter.fs.space()
        const spaceData = await puter.fs.space();
        if (!spaceData) {
            throw new Error('Could not fetch usage data');
        }

        const used = spaceData.used || 0;
        const capacity = spaceData.capacity || 100000;
        let usagePercent = Math.min(((used / capacity) * 100), 100).toFixed(0);

        // Update UI elements
        const storageUsed = document.getElementById('storage-used');
        const storageCapacity = document.getElementById('storage-capacity');
        const storageUsedPercent = document.getElementById('storage-used-percent');
        const storageBar = document.getElementById('storage-bar');
        const storageBarHost = document.getElementById('storage-bar-host');

        if (storageUsed) storageUsed.textContent = formatBytes(used);
        if (storageCapacity) storageCapacity.textContent = formatBytes(capacity);
        if (storageUsedPercent) storageUsedPercent.textContent = `${usagePercent}%`;
        if (storageBar) {
            storageBar.style.width = `${usagePercent}%`;
            if (parseInt(usagePercent) >= 100) {
                storageBar.style.borderTopRightRadius = '3px';
                storageBar.style.borderBottomRightRadius = '3px';
            }
        }

        // Update host usage if available
        if (spaceData.host_used) {
            const hostUsed = spaceData.host_used;
            const hostUsagePercent = ((hostUsed - used) / capacity * 100).toFixed(0);
            
            const storagePuterUsed = document.getElementById('storage-puter-used');
            const storagePuterUsedWrapper = document.getElementById('storage-puter-used-w');
            
            if (storagePuterUsed) storagePuterUsed.textContent = formatBytes(used);
            if (storagePuterUsedWrapper) storagePuterUsedWrapper.style.display = 'inline';
            if (storageBarHost) storageBar.style.width = `${hostUsagePercent}%`;
        }

    } catch (error) {
        console.error('Error fetching storage usage:', error);
        clearInterval(tokenUsageUpdateInterval);
        tokenUsageUpdateInterval = null;
    }
}

// Function to start token usage updates
function startTokenUsageUpdates() {
    // Clear any existing interval
    if (tokenUsageUpdateInterval) {
        clearInterval(tokenUsageUpdateInterval);
    }

    // Initial update
    updateTokenUsage();

    // Set up new interval
    tokenUsageUpdateInterval = setInterval(updateTokenUsage, 2000);
}

// Function to stop token usage updates
function stopTokenUsageUpdates() {
    if (tokenUsageUpdateInterval) {
        clearInterval(tokenUsageUpdateInterval);
        tokenUsageUpdateInterval = null;
    }
}

// Initialize token usage display when document is ready
document.addEventListener('DOMContentLoaded', function() {
    const tokenInfoBtn = document.getElementById('token-info-btn');
    if (tokenInfoBtn) {
        tokenInfoBtn.addEventListener('click', () => {
            startTokenUsageUpdates();
            
            // Set up popup close detection
            const tokenPopup = document.getElementById('popup-tokens');
            if (tokenPopup) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.attributeName === 'class' && tokenPopup.classList.contains('hidden')) {
                            stopTokenUsageUpdates();
                            observer.disconnect();
                        }
                    });
                });
                
                observer.observe(tokenPopup, { attributes: true });
            }
        });
    }
});

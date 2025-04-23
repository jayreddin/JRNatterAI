
// ---- GLOBALS ----
let chatHistory = [];
let currentChat = [];
let streamingMode = false;
let multiModelMode = false;
let selectedModels = [];
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
  speechVoice: "en-US" // Add default speech voice
};

// Global function for toggling streaming mode
window.toggleStreamingMode = toggleStreamingMode;

// Global function for toggling multi-model mode
window.toggleMultiModel = toggleMultiModel;

// Global function for removing models from multi-model selection
window.removeModel = function(idx) {
  selectedModels.splice(idx, 1);
  if (selectedModels.length === 0) {
    selectedModels = [document.getElementById('model-select').value];
  }
  updateMultiModelDisplay();
};

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
        addButton.className = 'ml-2 px-2 py-1 bg-blue-600 text-base rounded-full hover:bg-blue-700';
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
  
  // Newest at top
  container.innerHTML = "";
  for (let i = currentChat.length - 1; i >= 0; i--) {
    const m = currentChat[i];
    let bubbleClr = m.role === 'user' ? 'border-black bg-white dark:bg-gray-800' : 'border-black bg-gray-50 dark:bg-gray-900';
    let align = m.role === 'user' ? 'ml-auto' : 'mr-auto';
    let label = m.role === 'user' ? `You: ${m.time}` : `${m.model || "Assistant"}: ${m.time}`;
    let iconBtns = `<button onclick="resendMsg(${i})" class="text-gray-500 hover:text-blue-700 mr-2" title="Resend"><i class="fa fa-redo"></i></button>
      <button onclick="copyMsg(${i})" class="text-gray-500 hover:text-blue-700 mr-2" title="Copy"><i class="fa fa-copy"></i></button>
      <button onclick="deleteMsg(${i})" class="text-gray-500 hover:text-blue-700 mr-2" title="Delete"><i class="fa fa-trash"></i></button>
      <button onclick="speakMsg(${i})" class="text-gray-500 hover:text-yellow-700" title="Speak"><i class="fa fa-volume-up"></i></button>`;
    container.innerHTML += `
        <div class="mb-6 flex flex-col w-full ${align}">
          <div class="text-xs text-gray-500 mb-1">${label}</div>
          <div class="border ${bubbleClr} rounded-cool p-3 font-medium whitespace-pre-line flat ${align}" style="max-width:94vw">
            ${typeof m.content === 'string' ? m.content : m.content && m.content.type === "img" ? `<img src='${m.content.url}' alt='image' class='rounded-cool'>` : ""}
          </div>
            <div class="flex flex-row mt-1">${iconBtns}</div>
        </div>
      `;
  }
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
      const model = document.getElementById('model-select').value;
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
  const models = multiModelMode ? selectedModels : [model];

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
          if (resp.message && resp.message.text) {
            text = resp.message.text;
          } else if (resp.message && resp.message.content) {
            text = resp.message.content;
          } else if (resp.text) {
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
        bubbleElement.querySelector('.flex.flex-row').appendChild(loadingIndicator);
        
        // Get voice setting with fallbacks for compatibility
        const speechVoiceSelect = document.getElementById('speech-voice-select');
        // Default to 'en-US' if no setting found to ensure compatibility
        const voice = speechVoiceSelect?.value || userSettings.speechVoice || 'en-US';
        
        // Use different options for text to speech to improve compatibility
        puter.ai.txt2speech(txt, {
          voice: voice,
          engine: 'neural'  // Try neural engine
        })
        .then(audio => {
          // Remove loading indicator
          document.getElementById(loadingId)?.remove();
          
          if (audio && audio instanceof HTMLAudioElement) {
            // Add audio controls to the message
            audio.controls = true;
            audio.className = 'mt-2 w-full';
            audio.style.maxWidth = '300px';
            
            // Add the audio element to the message
            bubbleElement.querySelector('.border').appendChild(audio);
            
            // Auto-play the audio
            audio.play().catch(err => {
              console.warn("Auto-play failed (may require user interaction):", err);
              // Create a play button as fallback
              const playButton = document.createElement('button');
              playButton.className = 'bg-blue-600 text-base px-2 py-1 rounded mt-1 text-xs';
              playButton.innerHTML = '<i class="fa fa-play mr-1"></i> Play Audio';
              playButton.onclick = () => audio.play();
              bubbleElement.querySelector('.border').appendChild(playButton);
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
          bubbleElement.querySelector('.flex.flex-row').appendChild(errorMsg);
          
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
                  bubbleElement.querySelector('.border').appendChild(audio);
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

  const codeBtn = document.getElementById('btn-code');
  if (codeBtn) {
    codeBtn.onclick = function() {
      togglePopup('code', true);
      const codeResult = document.getElementById('code-result');
      if (codeResult) codeResult.textContent = "";
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
        previewBox.innerHTML = `<img src="${url}" class="rounded-cool border mx-auto mb-2" height="140" style="max-height:140px"><button id="ocr-btn" class="bg-blue-700 text-base flat px-3 py-1 rounded-cool mt-2">Extract Text</button> <div id="ocr-result" class="mt-3"></div>`;
        
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
                    <button id="save-ocr-btn" class="bg-blue-600 text-base px-3 py-1 rounded-cool text-sm mr-2">
                      <i class="fa fa-save mr-1"></i> Save
                    </button>
                    <button id="cancel-ocr-btn" class="bg-gray-500 text-base px-3 py-1 rounded-cool text-sm">
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
                  <button id="retry-ocr-btn" class="bg-blue-600 text-base px-3 py-1 rounded-cool text-sm">
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

  // Set up generate code button
  const generateCodeBtn = document.getElementById('generate-code-btn');
  if (generateCodeBtn) {
    generateCodeBtn.onclick = async function() {
      const codeGenPrompt = document.getElementById('code-gen-prompt');
      const codeResult = document.getElementById('code-result');
      if (!codeGenPrompt || !codeResult) return;
      
      let prompt = codeGenPrompt.value.trim();
      if (!prompt) return;
      
      codeResult.textContent = "Generating code...";
      try {
        // Always use the Codestral model for code generation
        let model = 'codestral-latest';

        // Create a more code-focused prompt
        let codePrompt = `Generate code for: ${prompt}\nPlease provide just the code without explanations.`;

        // Call the AI API with the prompt and model
        let out = await puter.ai.chat(codePrompt, { model });

        // Process the response
        let responseText = '';
        if (out.message && out.message.text) {
          responseText = out.message.text;
        } else if (out.message && out.message.content) {
          responseText = out.message.content;
        } else if (out.text) {
          responseText = out.text;
        } else if (typeof out === 'string') {
          responseText = out;
        } else {
          responseText = JSON.stringify(out);
        }

        // Extract code blocks if present (looking for markdown code blocks)
        let codeMatch = responseText.match(/```(?:[a-z]+\n)?([\s\S]*?)```/m);

        if (codeMatch && codeMatch[1]) {
          // If we found a code block, use that
          codeResult.textContent = codeMatch[1].trim();
        } else {
          // Otherwise use the whole response but try to clean it up
          // Remove any explanations or markdown that's not code
          let cleanedResponse = responseText
            .replace(/^Here's the code[:\s]*/i, '')
            .replace(/^I've created[:\s]*/i, '')
            .replace(/^Here is[:\s]*/i, '')
            .trim();

          codeResult.textContent = cleanedResponse;
        }
      } catch (err) {
        console.error("Code generation error:", err);
        codeResult.textContent = '[ERROR]: ' + (err.message || JSON.stringify(err));
      }
    };
  }

  // Set up preview code button
  const previewCodeBtn = document.getElementById('preview-code-btn');
  if (previewCodeBtn) {
    previewCodeBtn.onclick = function() {
      const codeResult = document.getElementById('code-result');
      if (!codeResult) return;
      
      const code = codeResult.textContent;
      if (!code) return;
      
      // Check if preview already exists
      const existingPreview = document.getElementById('code-preview-container');
      if (existingPreview) {
        existingPreview.remove();
        previewCodeBtn.innerHTML = '<i class="fa fa-eye mr-1"></i> Preview';
        return;
      }
      
      // Create preview container
      const previewContainer = document.createElement('div');
      previewContainer.id = 'code-preview-container';
      previewContainer.className = 'mt-4 border rounded-cool overflow-hidden';
      
      // Create header with language detection and close button
      const header = document.createElement('div');
      header.className = 'flex justify-between items-center p-2 bg-gray-200 dark:bg-gray-700';
      
      // Try to detect language
      let language = 'plaintext';
      if (code.includes('function') || code.includes('const ') || code.includes('let ') || code.includes('var ')) {
        language = 'javascript';
      } else if (code.includes('def ') || code.includes('import ') || code.includes('class ') && code.includes(':')) {
        language = 'python';
      } else if (code.includes('<html') || code.includes('<!DOCTYPE') || (code.includes('<') && code.includes('>'))) {
        language = 'html';
      } else if (code.includes('{') && code.includes('}') && code.includes(';')) {
        language = 'css';
      }
      
      header.innerHTML = `
        <span class="text-sm font-medium">${language.charAt(0).toUpperCase() + language.slice(1)} Preview</span>
        <button class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-base">
          <i class="fa fa-times"></i>
        </button>
      `;
      
      // Create code preview with syntax highlighting
      const previewContent = document.createElement('div');
      previewContent.className = 'p-3 bg-white dark:bg-gray-800 overflow-auto max-h-64';
      
      // Use Prism.js for syntax highlighting if available
      if (window.Prism) {
        const pre = document.createElement('pre');
        pre.className = `language-${language}`;
        
        const codeElement = document.createElement('code');
        codeElement.className = `language-${language}`;
        codeElement.textContent = code;
        
        pre.appendChild(codeElement);
        previewContent.appendChild(pre);
        
        // Highlight the code
        previewContainer.appendChild(header);
        previewContainer.appendChild(previewContent);
        
        // Add to the popup
        const codePopup = document.getElementById('popup-code');
        codePopup.querySelector('.space-y-2').appendChild(previewContainer);
        
        // Initialize Prism highlighting
        if (Prism.highlightElement) {
          Prism.highlightElement(codeElement);
        }
      } else {
        // Fallback without Prism
        previewContent.innerHTML = `<pre>${code.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</pre>`;
        previewContainer.appendChild(header);
        previewContainer.appendChild(previewContent);
        
        // Add to the popup
        const codePopup = document.getElementById('popup-code');
        codePopup.querySelector('.space-y-2').appendChild(previewContainer);
      }
      
      // Set up close button
      header.querySelector('button').onclick = function() {
        previewContainer.remove();
        previewCodeBtn.innerHTML = '<i class="fa fa-eye mr-1"></i> Preview';
      };
      
      // Update button text
      previewCodeBtn.innerHTML = '<i class="fa fa-eye-slash mr-1"></i> Hide Preview';
    };
  }

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
  "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", "mistral-large-latest", "grok-beta"
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

    providerHeader.appendChild(providerIcon);
    providerHeader.appendChild(providerName);
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
      // Truncate long model names
      modelName.textContent = model.length > 40 ? model.substring(0, 37) + '...' : model;
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
    return 'OpenRouter - ' + model.split('/')[0].replace('openrouter:', '');
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
    // First check if OpenRouter optgroup exists
    let openRouterGroup = sel.querySelector('optgroup[label="OpenRouter"]');
    if (!openRouterGroup) {
      // If it doesn't exist, create it
      openRouterGroup = document.createElement('optgroup');
      openRouterGroup.label = "OpenRouter";
      sel.appendChild(openRouterGroup);
    }

    // Clear existing OpenRouter options
    openRouterGroup.innerHTML = '';

    // Add enabled OpenRouter models
    userSettings.enabledModels.forEach(model => {
      if (model.startsWith('openrouter:')) {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model.replace('openrouter:', 'OR: ');
        openRouterGroup.appendChild(option);
      }
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
  const modelSelect = document.getElementById('model-select');
  if (!modelSelect) return;
  
  // Clear current selection
  const currentValue = modelSelect.value;
  
  if (userSettings.openRouterEnabled) {
    // Hide non-OpenRouter models
    Array.from(modelSelect.options).forEach(option => {
      const optgroup = option.parentNode;
      if (optgroup.tagName === 'OPTGROUP' && !optgroup.label.startsWith('OpenRouter')) {
        option.style.display = 'none';
      }
    });
    
    // Show OpenRouter models
    Array.from(modelSelect.options).forEach(option => {
      const optgroup = option.parentNode;
      if (optgroup.tagName === 'OPTGROUP' && optgroup.label.startsWith('OpenRouter')) {
        option.style.display = '';
      }
    });
    
    // If current selection is hidden, select first visible option
    if (!currentValue.startsWith('openrouter:')) {
      const firstVisibleOption = Array.from(modelSelect.options).find(opt => opt.style.display !== 'none');
      if (firstVisibleOption) {
        modelSelect.value = firstVisibleOption.value;
      }
    }
  } else {
    // Show all options
    Array.from(modelSelect.options).forEach(option => {
      option.style.display = '';
    });
    
    // If current selection is from OpenRouter, select first standard option
    if (currentValue.startsWith('openrouter:')) {
      const firstStandardOption = Array.from(modelSelect.options).find(opt => {
        const optgroup = opt.parentNode;
        return optgroup.tagName === 'OPTGROUP' && !optgroup.label.startsWith('OpenRouter');
      });
      
      if (firstStandardOption) {
        modelSelect.value = firstStandardOption.value;
      }
    }
  }
}

// INIT
document.addEventListener('DOMContentLoaded', function() {
  try {
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

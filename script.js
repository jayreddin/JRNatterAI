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

document.getElementById('toggle-mode').onclick = function() {
  isDarkMode = !isDarkMode;
  setTheme(isDarkMode ? 'dark' : 'light');
  // Show sun or moon icon
  document.getElementById('moon-icon').classList.toggle('hidden', isDarkMode);
  document.getElementById('sun-icon').classList.toggle('hidden', !isDarkMode);
}

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
  }
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
document.getElementById('chat-form').onsubmit = async function(e) {
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
}

// Auto-resize textarea as user types
document.getElementById('chat-input').addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight) + 'px';
});

// Add event listener for Enter key press on the chat input
document.getElementById('chat-input').addEventListener('keydown', function(e) {
  // Check if Enter was pressed (without shift for new line)
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); // Prevent default to avoid new line
    document.getElementById('chat-form').dispatchEvent(new Event('submit'));
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
        let fullResponse = '';
        const stream = await puter.ai.chat(txt, opts);
        
        for await (const chunk of stream) {
          fullResponse += chunk;
          currentChat[idx].content = fullResponse;
          renderChat();
        }
      } else {
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

    currentChat[idx] = { role: 'model', content: text, time: nowStr(), model };
    renderChat();
  } catch (err) {
    console.error("AI error:", err);
    currentChat[idx] = { role: 'model', content: "[ERROR]: " + (err.message || JSON.stringify(err)), time: nowStr(), model };
    renderChat();
  }
}

// ---- MSG ICON TASKS ----
window.resendMsg = async function(idx) {
  const m = currentChat[idx];
  if (m.role === 'user') { aiSend(m.content, document.getElementById('model-select').value, nowStr()); }
  else if (m.role === 'model') {//resend prompt before
    if (idx > 0 && currentChat[idx - 1].role === 'user') {
      aiSend(currentChat[idx - 1].content, m.model || document.getElementById('model-select').value, nowStr());
    }
  }
};
window.copyMsg = function(idx) {
  const m = currentChat[idx];
  let txt = typeof m.content === 'string' ? m.content : "";
  if (navigator.clipboard) navigator.clipboard.writeText(txt);
}
window.deleteMsg = function(idx) {
  currentChat.splice(idx, 1); renderChat();
}
window.speakMsg = function(idx) {
  const m = currentChat[idx];
  const txt = typeof m.content === 'string' ? m.content : '';
  const voice = document.getElementById('speech-voice-select').value; // Get selected voice
  if (txt.length) {
    try {
      puter.ai.txt2speech(txt, voice) // Use selected voice
        .then(audio => { 
          if (audio) audio.play(); 
        })
        .catch(err => {
          console.error("Speech error:", err);
          alert("Unable to play speech at this time");
        });
    } catch (err) {
      console.error("Speech error:", err);
    }
  }
}

// ---- FEATURE BUTTONS ----
document.getElementById('btn-new-chat').onclick = function() {
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
function autoTitle(msgs) {
  // Use first user message or fallback
  if (!msgs || !msgs.length) return "New Chat";
  let txt = msgs[0].content || "";
  txt = txt.slice(0, 36); if (txt.length >= 36) txt += "...";
  return txt;
}
// History popup
document.getElementById('btn-history').onclick = function() {
  updateHistoryUI();
  togglePopup('history', true);
};
function updateHistoryUI() {
  const list = document.getElementById('history-list');
  if (!chatHistory.length) { list.innerHTML = "<div class='text-gray-500'>No chat history yet.</div>"; return; }
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
}

// File & OCR popup
document.getElementById('btn-file').onclick = function() {
  togglePopup('file', true);
};
// OCR Extract text logic
document.getElementById('file-input-file').onchange = async function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const previewBox = document.getElementById('file-preview-box');
  previewBox.innerHTML = "";
  if (file.type.startsWith('image/')) {
    const url = URL.createObjectURL(file);
    previewBox.innerHTML = `<img src="${url}" class="rounded-cool border mx-auto mb-2" height="140" style="max-height:140px"><button id="ocr-btn" class="bg-blue-700 text-white flat px-3 py-1 rounded-cool mt-2">Extract Text</button> <div id="ocr-result" class="mt-3"></div>`;
    document.getElementById('ocr-btn').onclick = async function() {
      try {
        let result = await puter.ai.img2txt(file);
        result = result.trim() || "[No text detected]";
        previewBox.innerHTML += `<div class="rounded-cool bg-gray-50 border mt-2 p-2 dark:bg-gray-900" id="ocrTextResult">${result}</div>
            <div class="flex mt-2 space-x-2">
              <button onclick="copyOCR()" class="feature-btn" title="Copy"><i class="fa fa-copy"></i></button>
              <button onclick="editOCR()" class="feature-btn" title="Edit"><i class="fa fa-pen"></i></button>
            </div>`;
        window.copyOCR = function() { navigator.clipboard.writeText(result); }
        window.editOCR = function() {
          let cur = document.getElementById('ocrTextResult').textContent;
          previewBox.innerHTML += `<textarea class='flat rounded-cool w-full mt-2' rows='3' id='ocrEdit'>${cur}</textarea><button onclick="saveOCR()" class="feature-btn mt-2"><i class="fa fa-save"></i></button>`;
          window.saveOCR = function() {
            let v = document.getElementById('ocrEdit').value;
            document.getElementById('ocrTextResult').textContent = v;
          }
        }
      } catch (err) {
        previewBox.innerHTML += "<div class='text-red-600 mt-2'>OCR Error: " + err.message + "</div>";
      }
    }
  } else if (file.type.startsWith('text/')) {
    const txt = await file.text();
    previewBox.innerHTML = `<pre class="rounded-cool bg-gray-100 border p-2 flat">${txt.slice(0, 2048)}</pre>`;
  } else {
    previewBox.innerHTML = `<div class='text-gray-500 mt-2'>Unsupported file format.</div>`;
  }
};

// Image Generation popup
document.getElementById('btn-image').onclick = function() {
  togglePopup('image', true);
};
document.getElementById('generate-image-btn').onclick = generateImg;
document.getElementById('refresh-imggen-btn').onclick = function() {
  document.getElementById('image-gen-area').innerHTML = '';
  document.getElementById('image-gen-prompt').value = '';
};
async function generateImg() {
  let prompt = document.getElementById('image-gen-prompt').value.trim();
  let area = document.getElementById('image-gen-area');
  if (!prompt) { area.innerHTML = '<div class="text-red-500">Please enter prompt above first.</div>'; return; }
  area.innerHTML = '<div class="w-full h-48 flex flex-col items-center justify-center"><span class="fa fa-spinner fa-spin text-blue-600 text-3xl"></span><span class="text-xs mt-2">Generating Image...</span></div>';
  try {
    // Use the txt2img API with the prompt (set testMode to false for production)
    const img = await puter.ai.txt2img(prompt, false);

    // Append the image to the area
    area.innerHTML = '';
    if (img instanceof HTMLImageElement) {
      img.className = "rounded-cool border mx-auto";
      img.alt = "AI Generated";
      area.appendChild(img);

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
      area.appendChild(saveBtn);

      const infoText = document.createElement('span');
      infoText.className = "text-xs block mt-2 text-blue-600";
      infoText.textContent = "Click image to expand.";
      area.appendChild(infoText);

      // Add click handler to open in new window
      img.onclick = function() {
        window.open(img.src, '_blank');
      };
    } else {
      throw new Error("Failed to generate image");
    }
  } catch (err) {
    console.error("Image generation error:", err);
    area.innerHTML = `<div class="text-red-600">Image generation failed: ${err.message || "Unknown error"}</div>`;
  }
}
// Code Generation popup
document.getElementById('btn-code').onclick = function() {
  togglePopup('code', true);
  document.getElementById('code-result').textContent = "";
};
document.getElementById('generate-code-btn').onclick = async function() {
  let prompt = document.getElementById('code-gen-prompt').value.trim();
  if (!prompt) return;
  let res = document.getElementById('code-result');
  res.textContent = "Generating code...";
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
      res.textContent = codeMatch[1].trim();
    } else {
      // Otherwise use the whole response but try to clean it up
      // Remove any explanations or markdown that's not code
      let cleanedResponse = responseText
        .replace(/^Here's the code[:\s]*/i, '')
        .replace(/^I've created[:\s]*/i, '')
        .replace(/^Here is[:\s]*/i, '')
        .trim();

      res.textContent = cleanedResponse;
    }
  } catch (err) {
    console.error("Code generation error:", err);
    res.textContent = '[ERROR]: ' + (err.message || JSON.stringify(err));
  }
}
document.getElementById('preview-code-btn').onclick = function() {
  let code = document.getElementById('code-result').textContent;
  if (code) {
    let w = window.open('');
    w.document.write('<pre>' + code.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])) + '</pre>');
  }
}

// Settings popup
document.getElementById('btn-settings').onclick = function() {
  // Show UI tab by default
  document.getElementById('ui-tab').click();

  // Set text size
  document.getElementById('text-size-range').value = userSettings.textSize;

  // Set theme
  document.getElementById('theme-select').value = userSettings.theme;

  // Setup OpenRouter toggle
  document.getElementById('openrouter-toggle').checked = userSettings.openRouterEnabled || false;

  // Populate models list
  populateModelsList();

  // Set speech voice
  document.getElementById('speech-voice-select').value = userSettings.speechVoice;

  togglePopup('settings', true);
};

// Tab switching functionality
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
    document.getElementById(tabContentId).classList.remove('hidden');
  });
});

// Text size
document.getElementById('text-size-range').oninput = function() {
  document.body.style.fontSize = this.value + "px";
  userSettings.textSize = this.value;
  saveSettings();
};

// Theme selection
document.getElementById('theme-select').onchange = function(e) {
  setTheme(e.target.value);
};

// Speech voice selection
document.getElementById('speech-voice-select').onchange = function(e) {
  userSettings.speechVoice = e.target.value;
  saveSettings();
};


// Model search functionality
document.getElementById('model-search').addEventListener('input', function() {
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

// OpenRouter toggle
document.getElementById('openrouter-toggle').addEventListener('change', function() {
  userSettings.openRouterEnabled = this.checked;
  populateModelsList();
});

// Show enabled models only button
document.getElementById('show-enabled-only').addEventListener('click', function() {
  const isShowingAll = this.textContent.includes('Show Enabled');
  if (isShowingAll) {
    populateModelsList(true);
    this.textContent = 'Show All';
  } else {
    populateModelsList(false);
    this.textContent = 'Show Enabled';
  }
});

// Add CSS for capability badges
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
  modelsList.innerHTML = '';

  // Get all available models
  let allModels = [...document.querySelectorAll('#model-select option')].map(x => x.value);

  // Add OpenRouter models if enabled
  if (userSettings.openRouterEnabled) {
    // Parse the models from the OpenRouter list (first clean up quotes and commas)
    const openRouterModelsText = openRouterModelsList.replace(/"/g, '').replace(/,/g, '').trim();
    const openRouterModels = openRouterModelsText.split('\n').map(m => m.trim()).filter(m => m);
    allModels = [...allModels, ...openRouterModels];
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

    // Add models for this provider
    modelsByProvider[provider].forEach(model => {
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
      modelName.textContent = model;

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

// Save settings button
document.getElementById('settings-save-btn').onclick = function() {
  // Save enabled models from checkboxes
  const checkedModels = [...document.querySelectorAll('#models-list input[type=checkbox]:checked')].map(x => x.value);
  userSettings.enabledModels = checkedModels;

  // Update OpenRouter setting
  userSettings.openRouterEnabled = document.getElementById('openrouter-toggle').checked;

  // Update speech voice setting
  userSettings.speechVoice = document.getElementById('speech-voice-select').value;


  // Update model select dropdown options
  updateModelSelectOptions();

  saveSettings();
  togglePopup('settings', false);
};

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

// Store OpenRouter models list
const openRouterModelsList = `
    "gpt-4o",
    "gpt-4o-mini",
    "o1",
    "o1-mini",
    "o1-pro",
    "o3",
    "o3-mini",
    "o4-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4.5-preview",
    "claude-3-7-sonnet-20250219",
    "claude-3-7-sonnet-latest",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet-latest",
    "claude-3-5-sonnet-20240620",
    "claude-3-haiku-20240307",
    "WhereIsAI/UAE-Large-V1",
    "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
    "togethercomputer/m2-bert-80M-32k-retrieval",
    "google/gemma-2-9b-it",
    "cartesia/sonic",
    "BAAI/bge-large-en-v1.5",
    "NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO",
    "meta-llama/Llama-2-13b-chat-hf",
    "black-forest-labs/FLUX.1-schnell-Free",
    "black-forest-labs/FLUX.1.1-pro",
    "Qwen/Qwen2.5-7B-Instruct-Turbo",
    "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
    "meta-llama-llama-2-70b-hf",
    "BAAI/bge-base-en-v1.5",
    "Gryphe/MythoMax-L2-13b",
    "google/gemma-2-27b-it",
    "Qwen/Qwen2-VL-72B-Instruct",
    "Qwen/QwQ-32B",
    "meta-llama/LlamaGuard-2-8b",
    "cartesia/sonic-2",
    "togethercomputer/m2-bert-80M-8k-retrieval",
    "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
    "upstage/SOLAR-10.7B-Instruct-v1.0",
    "togethercomputer/MoA-1",
    "meta-llama/Meta-Llama-3-70B-Instruct-Turbo",
    "mistralai/Mistral-7B-Instruct-v0.2",
    "togethercomputer/m2-bert-80M-2k-retrieval",
    "google/gemma-2b-it",
    "black-forest-labs/FLUX.1-pro",
    "mistralai/Mistral-Small-24B-Instruct-2501",
    "Gryphe/MythoMax-L2-13b-Lite",
    "black-forest-labs/FLUX.1-redux",
    "scb10x/scb10x-llama3-1-typhoon2-70b-instruct",
    "meta-llama/Meta-Llama-Guard-3-8B",
    "arcee-ai/virtuoso-medium-v2",
    "black-forest-labs/FLUX.1-depth",
    "black-forest-labs/FLUX.1-canny",
    "meta-llama/Llama-3-8b-chat-hf",
    "arcee-ai/caller",
    "arcee-ai/virtuoso-large",
    "arcee-ai/maestro-reasoning",
    "arcee-ai/coder-large",
    "togethercomputer/MoA-1-Turbo",
    "mistralai/Mistral-7B-Instruct-v0.1",
    "scb10x/scb10x-llama3-1-typhoon2-8b-instruct",
    "mistralai/Mixtral-8x7B-v0.1"
`;

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
  }

  // Load chat history
  let hist = localStorage.getItem("puterChatHistory");
  if (hist) {
    chatHistory = JSON.parse(hist).map(hist => {
      hist.when = hist.when ? new Date(hist.when) : new Date();
      return hist;
    });
  }
}
window.onbeforeunload = function() {
  saveSettings();
  localStorage.setItem("puterChatHistory", JSON.stringify(chatHistory));
}

// ---- PUTER AUTH ----
document.getElementById('puter-login-btn').addEventListener('click', async function() {
  try {
    // Check if already signed in
    if (puter.auth.isSignedIn()) {
      // Sign out instead
      puter.auth.signOut();
      document.getElementById('puter-login-btn').innerHTML = '<i class="fa fa-user mr-1"></i> Sign In';
      document.getElementById('user-info').classList.add('hidden');
      return;
    }

    // Attempt to sign in
    await puter.auth.signIn();

    // Get user information
    const user = await puter.auth.getUser();
    if (user && user.username) {
      document.getElementById('puter-login-btn').innerHTML = '<i class="fa fa-sign-out mr-1"></i> Sign Out';
      document.getElementById('user-info').textContent = user.username;
      document.getElementById('user-info').classList.remove('hidden');
    }
  } catch (error) {
    console.error('Auth error:', error);
  }
});

// Check initial auth state
async function checkAuthState() {
  if (puter.auth.isSignedIn()) {
    try {
      const user = await puter.auth.getUser();
      if (user && user.username) {
        document.getElementById('puter-login-btn').innerHTML = '<i class="fa fa-sign-out mr-1"></i> Sign Out';
        document.getElementById('user-info').textContent = user.username;
        document.getElementById('user-info').classList.remove('hidden');
      }
    } catch (err) {
      console.error("Error getting user:", err);
    }
  }
}

// Add OpenRouter models to the list
function addOpenRouterModels() {
  const modelSelect = document.getElementById('model-select');

  // Check if the OpenRouter optgroup already exists
  let openRouterGroup = document.querySelector('optgroup[label="OpenRouter"]');
  if (!openRouterGroup) {
    // Create OpenRouter optgroup
    openRouterGroup = document.createElement('optgroup');
    openRouterGroup.label = "OpenRouter";

    // Add some popular OpenRouter models
    const openRouterModels = [
      {value: 'openrouter:anthropic/claude-3.7-sonnet', label: 'OpenRouter: Claude 3.7 Sonnet'},
      {value: 'openrouter:openai/o1', label: 'OpenRouter: OpenAI o1'},
      {value: 'openrouter:openai/o3-mini', label: 'OpenRouter: OpenAI o3-mini'},
      {value: 'openrouter:google/gemini-2.0-flash', label: 'OpenRouter: Gemini 2.0 Flash'},
      {value: 'openrouter:meta-llama/llama-4-maverick', label: 'OpenRouter: Llama 4 Maverick'},
      {value: 'openrouter:mistralai/mistral-large', label: 'OpenRouter: Mistral Large'},
      {value: 'openrouter:deepseek/deepseek-chat', label: 'OpenRouter: DeepSeek Chat'},
      {value: 'openrouter:x-ai/grok-beta', label: 'OpenRouter: Grok Beta'}
    ];

    // Add options to the optgroup
    openRouterModels.forEach(model => {
      const option = document.createElement('option');
      option.value = model.value;
      option.textContent = model.label;
      openRouterGroup.appendChild(option);
    });

    // Add the group to the select element
    modelSelect.appendChild(openRouterGroup);

    // Update userSettings with new models
    openRouterModels.forEach(model => {
      if (!userSettings.enabledModels.includes(model.value)) {
        userSettings.enabledModels.push(model.value);
      }
    });

    saveSettings();
  }
}

// ---- PUTER AUTH ----
// Function to handle Puter login
async function initPuterAuth() {
  const loginBtn = document.getElementById('puter-login-btn');
  const userInfoElement = document.getElementById('user-info');

  if (loginBtn && userInfoElement) {
    loginBtn.addEventListener('click', async function() {
      try {
        // Check if already signed in
        if (puter.auth && puter.auth.isSignedIn()) {
          // Sign out instead
          await puter.auth.signOut();
          loginBtn.innerHTML = '<i class="fa fa-user mr-1"></i> Sign In';
          userInfoElement.classList.add('hidden');
          return;
        }

        // Attempt to sign in
        await puter.auth.signIn();

        // Get user information
        const user = await puter.auth.getUser();
        if (user && user.username) {
          loginBtn.innerHTML = '<i class="fa fa-sign-out mr-1"></i> Sign Out';
          userInfoElement.textContent = user.username;
          userInfoElement.classList.remove('hidden');
        }
      } catch (error) {
        console.error('Auth error:', error);
        // Show friendly error to user
        alert('Authentication failed. Please try again later.');
      }
    });
  } else {
    console.warn("Auth elements not found in the DOM");
  }
}

// Check initial auth state
async function checkAuthState() {
  const userInfoElement = document.getElementById('user-info');
  const loginBtn = document.getElementById('puter-login-btn');

  if (!loginBtn || !userInfoElement) {
    console.warn("Auth elements not found in the DOM");
    return;
  }

  if (puter.auth && puter.auth.isSignedIn()) {
    try {
      const user = await puter.auth.getUser();
      if (user && user.username) {
        loginBtn.innerHTML = '<i class="fa fa-sign-out mr-1"></i> Sign Out';
        userInfoElement.textContent = user.username;
        userInfoElement.classList.remove('hidden');
      }
    } catch (err) {
      console.error("Error getting user:", err);
    }
  }
}

// Toggle streaming mode
function toggleStreamingMode(enabled) {
  streamingMode = enabled;
  userSettings.streamingMode = enabled;
  saveSettings();
  updateModelSelectOptions(); // Refresh model list to show only streaming models
}

// Toggle multi-model mode
function toggleMultiModel(enabled) {
  multiModelMode = enabled;
  userSettings.multiModelMode = enabled;
  
  // Update UI for multi-model selection
  const modelSelect = document.getElementById('model-select');
  const container = document.getElementById('model-select-container');
  
  if (enabled) {
    selectedModels = [modelSelect.value];
    // Add multi-select container if it doesn't exist
    if (!document.getElementById('multi-model-container')) {
      const multiContainer = document.createElement('div');
      multiContainer.id = 'multi-model-container';
      multiContainer.className = 'flex flex-wrap gap-2 mt-2';
      container.appendChild(multiContainer);
    }
    // Add + buttons to options
    Array.from(modelSelect.options).forEach(opt => {
      if (!opt.dataset.hasPlus) {
        const plusBtn = document.createElement('button');
        plusBtn.innerHTML = '+';
        plusBtn.className = 'ml-2 px-1 text-xs bg-blue-500 text-white rounded';
        plusBtn.onclick = (e) => {
          e.preventDefault();
          if (!selectedModels.includes(opt.value)) {
            selectedModels.push(opt.value);
            updateMultiModelDisplay();
          }
        };
        opt.dataset.hasPlus = 'true';
        opt.innerHTML += ' ';
        opt.appendChild(plusBtn);
      }
    });
  } else {
    selectedModels = [modelSelect.value];
    // Remove multi-select container
    const multiContainer = document.getElementById('multi-model-container');
    if (multiContainer) multiContainer.remove();
    // Remove + buttons
    Array.from(modelSelect.options).forEach(opt => {
      if (opt.dataset.hasPlus) {
        opt.innerHTML = opt.innerHTML.replace(/ \+$/, '');
        delete opt.dataset.hasPlus;
      }
    });
  }
  updateMultiModelDisplay();
  saveSettings();
}

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
function removeModel(idx) {
  selectedModels.splice(idx, 1);
  if (selectedModels.length === 0) {
    selectedModels = [document.getElementById('model-select').value];
  }
  updateMultiModelDisplay();
}

// INIT
document.addEventListener('DOMContentLoaded', function() {
  loadSettings();
  renderChat();
  initPuterAuth();
  setTimeout(checkAuthState, 500); // Slight delay to ensure Puter.js is fully loaded
  addOpenRouterModels();

  // Initialize dark mode toggle state
  const isDarkTheme = userSettings.theme === 'dark';
  document.getElementById('moon-icon').classList.toggle('hidden', isDarkTheme);
  document.getElementById('sun-icon').classList.toggle('hidden', !isDarkTheme);

  // MOBILE: Keep input at bottom
  window.addEventListener('resize', function() { 
    setTimeout(() => window.scrollTo(0, 0), 100); 
  });
});
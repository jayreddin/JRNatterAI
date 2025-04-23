// ---- GLOBALS ----
let chatHistory = [];
let currentChat = [];
let userSettings = {
  textSize: 16,
  theme: 'light',
  enabledModels: [
    "gpt-4o-mini", "gpt-4o", "o1", "o1-mini", "o1-pro", "o3", "o3-mini", "o4-mini", "gpt-4.1", "gpt-4.1-mini",
    "gpt-4.1-nano", "gpt-4.5-preview", "claude-3-7-sonnet", "claude-3-5-sonnet", "deepseek-chat", "deepseek-reasoner",
    "gemini-2.0-flash", "gemini-1.5-flash", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo", "mistral-large-latest", "pixtral-large-latest", "codestral-latest", "google/gemma-2-27b-it", "grok-beta"
  ]
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
  document.querySelector('.fa-moon').classList.toggle('hidden', isDarkMode);
  document.querySelector('.fa-sun').classList.toggle('hidden', !isDarkMode);
}

// ---- POPUP DIALOGS ----
const popupOverlay = document.getElementById('popup-overlay');
function togglePopup(name, open) {
  document.querySelectorAll('.popup-ptr').forEach(el => el.classList.add('hidden'));
  if (open) {
    popupOverlay.classList.remove('hidden');
    document.getElementById('popup-' + name).classList.remove('hidden');
  } else {
    popupOverlay.classList.add('hidden');
    document.getElementById('popup-' + name).classList.add('hidden');
    // cleanup for certain popups
    if (name === 'file') {
      document.getElementById('file-input-file').value = ""; document.getElementById('file-preview-box').innerHTML = '';
    }
    if (name === 'image') {
      document.getElementById('image-gen-prompt').value = ''; document.getElementById('image-gen-area').innerHTML = '';
    }
    if (name === 'code') {
      document.getElementById('code-gen-prompt').value = ''; document.getElementById('code-result').textContent = '';
    }
  }
}
popupOverlay.onclick = function() {
  document.querySelectorAll('.popup-ptr').forEach(el => el.classList.add('hidden'));
  popupOverlay.classList.add('hidden');
}

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
  let txt = document.getElementById('chat-input').value.trim();
  if (!txt) return;
  const model = document.getElementById('model-select').value;
  const time = nowStr();
  currentChat.push({ role: 'user', content: txt, time, model: null });
  renderChat();
  document.getElementById('chat-input').value = "";
  await aiSend(txt, model, time);
}
// send to AI
async function aiSend(txt, model, usetime) {
  const idx = currentChat.length;
  // Placeholder
  currentChat.push({ role: 'model', content: "...", time: nowStr(), model });
  renderChat();
  try {
    const opts = { model };
    const resp = await puter.ai.chat(txt, opts);
    let text = resp.message.text || '';
    currentChat[idx] = { role: 'model', content: text, time: nowStr(), model };
    renderChat();
  } catch (err) {
    currentChat[idx] = { role: 'model', content: "[ERROR]: " + (err.message || err), time: nowStr(), model };
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
  if (txt.length) {
    puter.ai.txt2speech(txt, "en-US").then(audio => { audio.play(); });
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
    const img = await puter.ai.txt2img(prompt, false);
    const url = img.src ?? img;
    area.innerHTML = `<img src="${url}" alt="AI Generated" class="rounded-cool border mx-auto">
        <button class="flat rounded-cool px-3 py-1 mt-2" onclick="saveImageGen('${url}')"><i class="fa fa-download mr-1"></i>Save</button>
        <span class="text-xs block mt-2 text-blue-600">Click image to expand.</span>`;
    area.querySelector('img').onclick = () => { window.open(url, '_blank'); };
    window.saveImageGen = function(src) {
      let a = document.createElement('a'); a.href = src; a.download = "ai_generate.png"; a.click();
    };
  } catch (err) {
    area.innerHTML = `<div class="text-red-600">Image generation failed: ${err.message}</div>`;
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
    let model = 'codestral-latest';
    let out = await puter.ai.chat(prompt, { model });
    let code = (out.message.text || '').match(/```(?:[a-z]+\n)?([\s\S]*?)```/m);
    res.textContent = code ? code[1].trim() : out.message.text;
  } catch (err) {
    res.textContent = '[ERROR]: ' + err.message;
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
  // text size
  document.getElementById('text-size-range').value = userSettings.textSize;
  // theme
  document.getElementById('theme-select').value = userSettings.theme;
  // models
  let allModels = [...document.querySelectorAll('#model-select option')].map(x => x.value);
  document.getElementById('model-incl-excl-list').innerHTML = allModels.map(m =>
    `<label class="block mx-2 mb-1"><input type="checkbox" class="form-checkbox" value="${m}" ${userSettings.enabledModels.includes(m) ? "checked" : ""}> <span class="text-xs">${m}</span></label>`
  ).join('');
  togglePopup('settings', true);
};
// Text size
document.getElementById('text-size-range').oninput = function() {
  document.body.style.fontSize = this.value + "px";
  userSettings.textSize = this.value;
  saveSettings();
}
document.getElementById('theme-select').onchange = function(e) {
  setTheme(e.target.value);
}
document.getElementById('settings-save-btn').onclick = function() {
  // models
  let cheks = [...document.querySelectorAll('#model-incl-excl-list input[type=checkbox]:checked')].map(x => x.value);
  userSettings.enabledModels = cheks;
  // update model select dropdown
  let sel = document.getElementById('model-select');
  [...sel.options].forEach(o => {
    o.style.display = userSettings.enabledModels.includes(o.value) ? '' : 'none';
  });
  saveSettings();
  togglePopup('settings', false);
}

// ---- STORAGE: SAVE SETTINGS (localStorage) ----
function saveSettings() {
  localStorage.setItem("puterChatUserSettings", JSON.stringify(userSettings));
}
function loadSettings() {
  let s = localStorage.getItem("puterChatUserSettings");
  if (s) {
    userSettings = JSON.parse(s);
    document.body.style.fontSize = (userSettings.textSize || 16) + "px";
    setTheme(userSettings.theme || 'light');
    // update model dropdown
    let sel = document.getElementById('model-select');
    [...sel.options].forEach(o => {
      o.style.display = userSettings.enabledModels.includes(o.value) ? '' : 'none';
    });
  }
  let hist = localStorage.getItem("puterChatHistory");
  if (hist) chatHistory = JSON.parse(hist).map(hist => {
    hist.when = hist.when ? new Date(hist.when) : new Date();
    return hist;
  });
}
window.onbeforeunload = function() {
  saveSettings();
  localStorage.setItem("puterChatHistory", JSON.stringify(chatHistory));
}

// INIT
loadSettings();
renderChat();

// ---- MOBILE: Keep input at bottom ----
window.addEventListener('resize', function() { setTimeout(() => window.scrollTo(0, 0), 100); });
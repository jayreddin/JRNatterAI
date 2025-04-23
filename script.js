// Initialize variables for app state
let currentChat = [];
let chatHistory = {};
let currentModel = 'gpt-4o-mini';
let isStreaming = false;
let responseCache = {};
let isMultiModel = false;
let selectedModels = [];
let allModels = {};
let openRouterModels = [];
let enabledModels = [];
let darkMode = false;
let customTheme = {
  background: '#fafafa',
  text: '#24292f',
  header: '#ffffff',
  footer: '#ffffff',
  popups: '#ffffff',
  borders: '#000000',
  userBubble: '#f3f4f6',
  modelBubble: '#ffffff',
  dropdowns: '#f9fafb'
};

// DOM Elements
const chatInput = document.getElementById('chat-input');
const chatForm = document.getElementById('chat-form');
const chatContainer = document.getElementById('chat-container');
const toggleModeBtn = document.getElementById('toggle-mode');
const modelSelect = document.getElementById('model-select');
const streamingToggle = document.getElementById('streaming-toggle');
const multiToggle = document.getElementById('multi-toggle');
const mainHeader = document.getElementById('main-header');
const openRouterToggle = document.getElementById('openrouter-toggle');
const speechVoiceSelect = document.getElementById('speech-voice-select');

// Initialize Puter SDK
async function initializePuter() {
  try {
    console.log("Initialization complete");

    // Load saved settings
    loadSettings();

    // Set up event listeners
    setupEventListeners();

    // Check if authenticated
    checkAuthStatus();

    // Initialize models list
    initializeModels();
  } catch (error) {
    console.error("Initialization error:", error);
  }
}

// Check if user is authenticated with Puter
async function checkAuthStatus() {
  try {
    const userInfo = await puter.auth.whoami();
    if (userInfo && userInfo.username) {
      const userInfoElement = document.getElementById('user-info');
      const usernameText = userInfoElement.querySelector('.username-text');
      
      if (usernameText) {
        usernameText.textContent = userInfo.username;
      } else {
        userInfoElement.innerHTML = `<i class="fa fa-user text-gray-600 dark:text-gray-400 mr-2"></i><span class="username-text">${userInfo.username}</span>`;
      }
      
      userInfoElement.classList.remove('hidden');
      document.getElementById('puter-login-btn').classList.add('hidden');
      document.getElementById('signout-btn').classList.remove('hidden');
    } else {
      document.getElementById('user-info').classList.add('hidden');
      document.getElementById('puter-login-btn').classList.remove('hidden');
      document.getElementById('signout-btn').classList.add('hidden');
    }
  } catch (error) {
    console.log("Not signed in:", error);
    document.getElementById('user-info').classList.add('hidden');
    document.getElementById('puter-login-btn').classList.remove('hidden');
    document.getElementById('signout-btn').classList.add('hidden');
  }
}

// Event Listeners
function setupEventListeners() {
  // Form submission
  chatForm.addEventListener('submit', handleChatSubmit);

  // Input auto-resize
  chatInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
  });

  // Toggle dark mode
  toggleModeBtn.addEventListener('click', toggleDarkMode);

  // Model selection
  if (modelSelect) {
    modelSelect.addEventListener('change', function() {
      currentModel = this.value;
      saveSettings();
    });
  }

  // Streaming toggle
  if (streamingToggle) {
    streamingToggle.addEventListener('change', toggleStreamingMode);
  }

  // Toggle multi model mode
  if (multiToggle) {
    multiToggle.addEventListener('change', function() {
      isMultiModel = this.checked;
      toggleMultiModel();
    });
  }
  
  // Initialize models list in settings
  populateModelsSettings();

  // Feature buttons
  document.getElementById('btn-new-chat').addEventListener('click', startNewChat);
  document.getElementById('btn-history').addEventListener('click', function() {
    togglePopup('history', true);
    displayChatHistory();
  });
  document.getElementById('btn-file').addEventListener('click', function() {
    togglePopup('file', true);
  });
  document.getElementById('btn-image').addEventListener('click', function() {
    togglePopup('image', true);
  });
  document.getElementById('btn-settings').addEventListener('click', function() {
    togglePopup('settings', true);
  });

  // Login button
  document.getElementById('puter-login-btn').addEventListener('click', async function() {
    try {
      // Try Replit login first
      window.addEventListener("message", authComplete);
      var h = 500;
      var w = 350;
      var left = screen.width / 2 - w / 2;
      var top = screen.height / 2 - h / 2;

      var authWindow = window.open(
        "https://replit.com/auth_with_repl_site?domain=" + location.host,
        "_blank",
        "modal=yes, toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=" +
          w +
          ", height=" +
          h +
          ", top=" +
          top +
          ", left=" +
          left
      );

      function authComplete(e) {
        if (e.data !== "auth_complete") {
          return;
        }
        window.removeEventListener("message", authComplete);
        authWindow.close();
        location.reload();
      }
    } catch (error) {
      console.error("Login error:", error);
      // Fallback to Puter login
      try {
        await puter.auth.signIn();
        checkAuthStatus();
      } catch (puterError) {
        console.error("Puter login error:", puterError);
      }
    }
  });

  // Sign out button
  document.getElementById('signout-btn').addEventListener('click', async function() {
    try {
      // Try both signout methods
      try {
        await puter.auth.signOut();
      } catch (e) {
        console.log("Puter signout error:", e);
      }

      document.getElementById('user-info').classList.add('hidden');
      document.getElementById('puter-login-btn').classList.remove('hidden');
      document.getElementById('signout-btn').classList.add('hidden');
      location.reload();
    } catch (error) {
      console.error("Signout error:", error);
    }
  });

  // OpenRouter toggle
  if (openRouterToggle) {
    openRouterToggle.addEventListener('change', toggleOpenRouter);
  }

  // Settings tabs
  const tabButtons = document.querySelectorAll('#settings-tabs button');
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');

      // Hide all tab contents
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
      });

      // Show selected tab content
      document.getElementById(tabId).classList.remove('hidden');

      // Toggle active state on tab buttons
      tabButtons.forEach(btn => {
        btn.classList.remove('active', 'border-blue-600');
        btn.classList.add('border-transparent');
      });

      this.classList.add('active', 'border-blue-600');
      this.classList.remove('border-transparent');
    });
  });

  // Text size slider
  const textSizeRange = document.getElementById('text-size-range');
  if (textSizeRange) {
    textSizeRange.addEventListener('input', function() {
      document.documentElement.style.fontSize = this.value + 'px';
      saveSettings();
    });
  }

  // Theme select
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    themeSelect.addEventListener('change', function() {
      applyTheme(this.value);
      saveSettings();
    });
  }

  // Speech voice select
  if (speechVoiceSelect) {
    speechVoiceSelect.addEventListener('change', function() {
      saveSettings();
    });
  }

  // Settings save button
  document.getElementById('settings-save-btn').addEventListener('click', function() {
    saveSettings();
    togglePopup('settings', false);
  });

  // Custom theme buttons
  document.getElementById('preview-custom-theme').addEventListener('click', previewCustomTheme);
  document.getElementById('reset-custom-theme').addEventListener('click', resetCustomTheme);

  // Show enabled models only button
  document.getElementById('show-enabled-only').addEventListener('click', toggleShowEnabledModels);

  // Model search
  const modelSearch = document.getElementById('model-search');
  if (modelSearch) {
    modelSearch.addEventListener('input', function() {
      filterModels(this.value);
    });
  }

  // Generate image button
  document.getElementById('generate-image-btn').addEventListener('click', generateImage);

  // Refresh image generation button
  document.getElementById('refresh-imggen-btn').addEventListener('click', function() {
    document.getElementById('image-gen-area').innerHTML = '';
  });
}

// Toggle dark mode
function toggleDarkMode() {
  const body = document.body;
  const moonIcon = document.getElementById('moon-icon');
  const sunIcon = document.getElementById('sun-icon');

  body.classList.toggle('dark-mode');
  darkMode = body.classList.contains('dark-mode');

  if (darkMode) {
    moonIcon.classList.add('hidden');
    sunIcon.classList.remove('hidden');
  } else {
    moonIcon.classList.remove('hidden');
    sunIcon.classList.add('hidden');
  }

  saveSettings();
}

// Toggle streaming mode
function toggleStreamingMode() {
  isStreaming = streamingToggle.checked;
  saveSettings();
  updateModelList();
}

// Toggle multi model mode
function toggleMultiModel() {
  isMultiModel = multiToggle.checked;

  if (isMultiModel) {
    // Hide main model select and show multi model UI
    document.getElementById('model-select-container').classList.add('hidden');
    document.getElementById('multi-model-container').classList.remove('hidden');
    
    // Initialize multi model interface if empty
    const multiModelList = document.getElementById('multi-model-list');
    if (multiModelList && multiModelList.children.length === 0) {
      // Add initial model dropdown
      addMultiModelSelect();
    }
  } else {
    // Show main model select and hide multi model UI
    document.getElementById('model-select-container').classList.remove('hidden');
    document.getElementById('multi-model-container').classList.add('hidden');
  }

  saveSettings();
}

// Add a new model select dropdown to the multi-model interface
function addMultiModelSelect() {
  const multiModelList = document.getElementById('multi-model-list');
  const multiModelActions = document.getElementById('multi-model-actions');
  
  if (!multiModelList || !multiModelActions) return;
  
  // Create model select container
  const selectContainer = document.createElement('div');
  selectContainer.className = 'flex items-center mb-2';
  
  // Create model select dropdown
  const select = document.createElement('select');
  select.className = 'bg-gray-50 border rounded-cool py-1 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 flat dark:bg-gray-800 mr-2 flex-1';
  
  // Populate with same options as main model select
  if (modelSelect) {
    const options = modelSelect.innerHTML;
    select.innerHTML = options;
  }
  
  // Create remove button
  const removeBtn = document.createElement('button');
  removeBtn.className = 'text-red-500 hover:text-red-700';
  removeBtn.innerHTML = '<i class="fa fa-times"></i>';
  removeBtn.addEventListener('click', function() {
    selectContainer.remove();
  });
  
  // Add elements to container
  selectContainer.appendChild(select);
  selectContainer.appendChild(removeBtn);
  multiModelList.appendChild(selectContainer);
  
  // Make sure the add button exists
  if (multiModelActions.children.length === 0) {
    const addBtn = document.createElement('button');
    addBtn.className = 'bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded-cool';
    addBtn.innerHTML = '<i class="fa fa-plus mr-1"></i> Add Model';
    addBtn.addEventListener('click', addMultiModelSelect);
    multiModelActions.appendChild(addBtn);
  }
}

// Toggle OpenRouter models
function toggleOpenRouter() {
  const isOpenRouter = openRouterToggle.checked;

  if (isOpenRouter) {
    // Show OpenRouter models
    populateModelSelect(true);
  } else {
    // Show standard models
    populateModelSelect(false);
  }
  
  // Update models settings list
  populateModelsSettings();

  saveSettings();
}

// Initialize models list
function initializeModels() {
  // Standard models initialization
  const standardModels = {};

  // Add standard model groups from HTML
  const optgroups = modelSelect.querySelectorAll('optgroup');
  optgroups.forEach(group => {
    const provider = group.label.trim().replace(/^[📊💬🔍🔰📘💨❇️]\s*/, '');
    if (provider && provider !== '') {
      standardModels[provider] = [];

      const options = group.querySelectorAll('option');
      options.forEach(option => {
        standardModels[provider].push({
          id: option.value,
          name: option.textContent,
          provider,
          enabled: true,
          streaming: true
        });
      });
    }
  });

  allModels = standardModels;

  // Initialize OpenRouter models
  initializeOpenRouterModels();
}

// Initialize OpenRouter models
function initializeOpenRouterModels() {
  openRouterModels = [];

  // Read from the attached_assets file for OpenRouter models
  const orModelsList = [
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
    "mistralai/Mixtral-8x7B-v0.1",
    "black-forest-labs/FLUX.1-dev-lora",
    "deepseek-ai/DeepSeek-R1"
  ];

  // Organize models by provider
  const orModels = {};

  orModelsList.forEach(model => {
    // Extract provider
    let provider = "OpenRouter";

    if (model.includes('/')) {
      provider = model.split('/')[0];
    } else if (model.startsWith('gpt-') || model.startsWith('o')) {
      provider = "Meta";
    } else if (model.startsWith('claude-')) {
      provider = "Anthropic";
    } else if (model.startsWith('gemma-')) {
      provider = "Google";
    } else if (model.startsWith('mistral')) {
      provider = "Mistral";
    }

    // Create provider category if it doesn't exist
    if (!orModels[provider]) {
      orModels[provider] = [];
    }

    // Add model to provider category
    orModels[provider].push({
      id: model,
      name: model,
      provider: `OR ${provider}`,
      enabled: false,
      streaming: true
    });
  });

  // Store the organized OpenRouter models
  openRouterModels = orModels;
}

// Populate model select dropdown
function populateModelSelect(showOpenRouter) {
  if (!modelSelect) return;

  // Clear existing options
  modelSelect.innerHTML = '';

  let models = {};

  if (showOpenRouter) {
    // Show OpenRouter models
    models = openRouterModels;
  } else {
    // Show standard models
    models = allModels;
  }

  // Only show providers with enabled models
  const providers = Object.keys(models).filter(provider => {
    return models[provider].some(model => model.enabled);
  });

  // Add options for each provider
  providers.forEach(provider => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = provider;

    // Only show enabled models if streaming filter is on
    const filteredModels = models[provider].filter(model => {
      return model.enabled && (!isStreaming || model.streaming);
    });

    filteredModels.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;

      if (model.id === currentModel) {
        option.selected = true;
      }

      optgroup.appendChild(option);
    });

    if (optgroup.children.length > 0) {
      modelSelect.appendChild(optgroup);
    }
  });
}

// Update model list based on current filters
function updateModelList() {
  populateModelSelect(openRouterToggle.checked);
}

// Populate models list in settings
function populateModelsSettings() {
  const modelsList = document.getElementById('models-list');
  if (!modelsList) return;
  
  // Clear existing items
  modelsList.innerHTML = '';
  
  // Get models based on OpenRouter toggle
  const isOpenRouter = openRouterToggle.checked;
  let modelsToShow = isOpenRouter ? openRouterModels : allModels;
  
  // Create model items for each provider and model
  for (const provider in modelsToShow) {
    // Provider header
    const providerHeader = document.createElement('div');
    providerHeader.className = 'font-medium text-sm border-b border-gray-200 dark:border-gray-700 py-2 mb-2';
    providerHeader.textContent = provider;
    modelsList.appendChild(providerHeader);
    
    // Models from this provider
    modelsToShow[provider].forEach(model => {
      const modelItem = document.createElement('div');
      modelItem.className = 'model-item flex justify-between items-center py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md';
      
      const modelInfo = document.createElement('div');
      modelInfo.className = 'flex-1';
      
      const modelName = document.createElement('div');
      modelName.className = 'model-name font-medium text-sm';
      modelName.textContent = model.name;
      
      const modelProvider = document.createElement('div');
      modelProvider.className = 'model-provider text-xs text-gray-500';
      modelProvider.textContent = model.provider;
      
      modelInfo.appendChild(modelName);
      modelInfo.appendChild(modelProvider);
      
      const modelToggles = document.createElement('div');
      modelToggles.className = 'flex items-center space-x-3';
      
      // Enabled toggle
      const enabledLabel = document.createElement('label');
      enabledLabel.className = 'flex items-center cursor-pointer';
      enabledLabel.title = 'Enable/Disable Model';
      
      const enabledCheckbox = document.createElement('input');
      enabledCheckbox.type = 'checkbox';
      enabledCheckbox.className = 'sr-only';
      enabledCheckbox.checked = model.enabled;
      enabledCheckbox.addEventListener('change', function() {
        model.enabled = this.checked;
        saveSettings();
        updateModelList();
      });
      
      const enabledToggle = document.createElement('div');
      enabledToggle.className = 'relative w-10 h-5 bg-gray-300 rounded-full transition';
      if (model.enabled) {
        enabledToggle.classList.add('bg-green-500');
      }
      
      const enabledDot = document.createElement('div');
      enabledDot.className = 'absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition';
      if (model.enabled) {
        enabledDot.style.transform = 'translateX(100%)';
      }
      
      enabledToggle.appendChild(enabledDot);
      enabledLabel.appendChild(enabledCheckbox);
      enabledLabel.appendChild(enabledToggle);
      
      // Streaming toggle
      const streamingLabel = document.createElement('label');
      streamingLabel.className = 'flex items-center cursor-pointer';
      streamingLabel.title = 'Streaming Support';
      
      const streamingCheckbox = document.createElement('input');
      streamingCheckbox.type = 'checkbox';
      streamingCheckbox.className = 'sr-only';
      streamingCheckbox.checked = model.streaming;
      streamingCheckbox.addEventListener('change', function() {
        model.streaming = this.checked;
        saveSettings();
        updateModelList();
      });
      
      const streamingToggle = document.createElement('div');
      streamingToggle.className = 'relative w-10 h-5 bg-gray-300 rounded-full transition';
      if (model.streaming) {
        streamingToggle.classList.add('bg-blue-500');
      }
      
      const streamingDot = document.createElement('div');
      streamingDot.className = 'absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition';
      if (model.streaming) {
        streamingDot.style.transform = 'translateX(100%)';
      }
      
      streamingToggle.appendChild(streamingDot);
      streamingLabel.appendChild(streamingCheckbox);
      streamingLabel.appendChild(streamingToggle);
      
      modelToggles.appendChild(enabledLabel);
      modelToggles.appendChild(streamingLabel);
      
      modelItem.appendChild(modelInfo);
      modelItem.appendChild(modelToggles);
      
      modelsList.appendChild(modelItem);
    });
  }
}

// Filter models in settings by search term
function filterModels(searchTerm) {
  const modelsList = document.getElementById('models-list');
  if (!modelsList) return;
  
  const items = modelsList.querySelectorAll('.model-item');
  const headers = modelsList.querySelectorAll('.font-medium.text-sm.border-b');

  searchTerm = searchTerm.toLowerCase();

  // Hide/show all headers initially
  headers.forEach(header => {
    header.style.display = 'none';
  });

  // Track which headers have visible items
  const visibleHeaders = new Set();

  items.forEach(item => {
    const modelName = item.querySelector('.model-name').textContent.toLowerCase();
    const modelProvider = item.querySelector('.model-provider').textContent.toLowerCase();
    const prevHeader = item.previousElementSibling;

    if (modelName.includes(searchTerm) || modelProvider.includes(searchTerm)) {
      item.style.display = 'flex';
      
      // Find the header for this item
      let header = item.previousElementSibling;
      while (header && !header.classList.contains('font-medium')) {
        header = header.previousElementSibling;
      }
      
      if (header) {
        visibleHeaders.add(header);
      }
    } else {
      item.style.display = 'none';
    }
  });

  // Show headers that have visible items
  visibleHeaders.forEach(header => {
    header.style.display = 'block';
  });
}

// Toggle show enabled models only
function toggleShowEnabledModels() {
  const button = document.getElementById('show-enabled-only');
  const showEnabledOnly = button.classList.contains('bg-blue-700');

  if (showEnabledOnly) {
    // Show all models
    button.classList.remove('bg-blue-700');
    button.classList.add('bg-gray-500');
    button.textContent = 'Show Enabled';

    const modelItems = document.querySelectorAll('.model-item');
    modelItems.forEach(item => {
      item.style.display = 'flex';
    });
  } else {
    // Show enabled models only
    button.classList.remove('bg-gray-500');
    button.classList.add('bg-blue-700');
    button.textContent = 'Show All';

    const modelItems = document.querySelectorAll('.model-item');
    modelItems.forEach(item => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (!checkbox.checked) {
        item.style.display = 'none';
      }
    });
  }
}

// Chat submission handler
async function handleChatSubmit(event) {
  event.preventDefault();

  const message = chatInput.value.trim();
  if (!message) return;

  // Add user message to chat
  const userMessageId = addMessageToChat('user', message);

  // Clear input and reset height
  chatInput.value = '';
  chatInput.style.height = 'auto';

  if (isMultiModel && selectedModels.length > 0) {
    // Send to multiple models
    for (const modelId of selectedModels) {
      await sendMessageToModel(message, modelId);
    }
  } else {
    // Send to single model
    await sendMessageToModel(message, currentModel);
  }

  // Save to history
  saveChatToHistory();
}

// Send message to model
async function sendMessageToModel(message, modelId) {
  // Add AI thinking message
  const aiMessageId = addMessageToChat('ai', '<div class="typing-animation">Thinking</div>', modelId);

  try {
    let aiResponse = '';

    if (isStreaming) {
      // Streaming response
      try {
        const stream = await puter.ai.chat({
          model: modelId,
          messages: [{ role: 'user', content: message }],
          stream: true
        });

        let streamContent = '';

        for await (const chunk of stream) {
          streamContent += chunk.choices[0]?.delta?.content || '';
          updateMessage(aiMessageId, formatAIResponse(streamContent), modelId);
        }

        aiResponse = streamContent;
      } catch (streamError) {
        console.log("Streaming error:", streamError);
        throw streamError;
      }
    } else {
      // Non-streaming response
      try {
        const response = await puter.ai.chat({
          model: modelId,
          messages: [{ role: 'user', content: message }]
        });

        if (response && response.choices && response.choices[0] && response.choices[0].message) {
          aiResponse = response.choices[0].message.content || 'No response';
        } else {
          aiResponse = 'Received invalid response format';
        }
        
        updateMessage(aiMessageId, formatAIResponse(aiResponse), modelId);
      } catch (responseError) {
        console.log("Response error:", responseError);
        throw responseError;
      }
    }

    // Cache the response
    responseCache[aiMessageId] = aiResponse;

    // Add action buttons to message
    addActionButtons(aiMessageId);
  } catch (error) {
    console.log("Response error:", error);
    updateMessage(aiMessageId, `<p class="text-red-500">Error: ${error.message || 'Failed to get response'}</p>`, modelId);
  }
}

// Add message to chat
function addMessageToChat(role, content, modelName = '') {
  const messageId = 'msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  const timestamp = new Date().toLocaleTimeString();

  const messageDiv = document.createElement('div');
  messageDiv.id = messageId;
  messageDiv.className = 'py-3 px-4 mb-4 rounded-cool';

  let messageHeader = '';

  if (role === 'user') {
    messageDiv.className += ' bg-gray-50 border ml-12';
    messageHeader = `<div class="flex justify-between mb-1">
      <span class="text-xs text-gray-500">You: ${timestamp}</span>
      <div class="message-actions">
        <button class="text-xs text-gray-400 hover:text-black mr-2 resend-btn" title="Resend">
          <i class="fa fa-rotate-right"></i>
        </button>
        <button class="text-xs text-gray-400 hover:text-black mr-2 copy-btn" title="Copy">
          <i class="fa fa-copy"></i>
        </button>
        <button class="text-xs text-gray-400 hover:text-black delete-btn" title="Delete">
          <i class="fa fa-trash"></i>
        </button>
      </div>
    </div>`;
  } else {
    messageDiv.className += ' bg-white border mr-12';
    let modelLabel = modelName ? `: ${modelName}` : '';
    messageHeader = `<div class="flex justify-between mb-1">
      <span class="text-xs text-gray-500">AI${modelLabel}: ${timestamp}</span>
      <div class="message-actions hidden">
        <!-- Action buttons will be added later -->
      </div>
    </div>`;
  }

  messageDiv.innerHTML = `
    ${messageHeader}
    <div class="message-content">${content}</div>
  `;

  // Add to currentChat array for history
  currentChat.push({
    id: messageId,
    role,
    content,
    timestamp,
    model: modelName
  });

  // Add to DOM
  chatContainer.appendChild(messageDiv);

  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;

  // Add event listeners for action buttons
  if (role === 'user') {
    const resendBtn = messageDiv.querySelector('.resend-btn');
    const copyBtn = messageDiv.querySelector('.copy-btn');
    const deleteBtn = messageDiv.querySelector('.delete-btn');

    if (resendBtn) {
      resendBtn.addEventListener('click', function() {
        chatInput.value = content;
        chatInput.focus();
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(content);
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', function() {
        messageDiv.remove();
        // Remove from currentChat
        const index = currentChat.findIndex(msg => msg.id === messageId);
        if (index !== -1) {
          currentChat.splice(index, 1);
          saveChatToHistory();
        }
      });
    }
  }

  return messageId;
}

// Update message content
function updateMessage(messageId, content, modelName = '') {
  const messageDiv = document.getElementById(messageId);
  if (!messageDiv) return;

  const contentDiv = messageDiv.querySelector('.message-content');
  if (contentDiv) {
    contentDiv.innerHTML = content;
  }

  if (modelName) {
    const headerSpan = messageDiv.querySelector('.text-xs.text-gray-500');
    if (headerSpan) {
      const timestamp = new Date().toLocaleTimeString();
      headerSpan.textContent = `AI: ${modelName} - ${timestamp}`;
    }
  }
}

// Add action buttons to AI message
function addActionButtons(messageId) {
  const messageDiv = document.getElementById(messageId);
  if (!messageDiv) return;

  const actionsDiv = messageDiv.querySelector('.message-actions');
  if (!actionsDiv) return;

  actionsDiv.classList.remove('hidden');
  actionsDiv.innerHTML = `
    <button class="text-xs text-gray-400 hover:text-black mr-2 copy-btn" title="Copy">
      <i class="fa fa-copy"></i>
    </button>
    <button class="text-xs text-gray-400 hover:text-black mr-2 delete-btn" title="Delete">
      <i class="fa fa-trash"></i>
    </button>
    <button class="text-xs text-gray-400 hover:text-black mr-2 speech-btn" title="Read Aloud">
      <i class="fa fa-volume-up"></i>
    </button>
  `;

  // Add event listeners
  const copyBtn = actionsDiv.querySelector('.copy-btn');
  const deleteBtn = actionsDiv.querySelector('.delete-btn');
  const speechBtn = actionsDiv.querySelector('.speech-btn');

  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      const content = responseCache[messageId] || messageDiv.querySelector('.message-content').textContent;
      navigator.clipboard.writeText(content);
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', function() {
      messageDiv.remove();
      // Remove from currentChat
      const index = currentChat.findIndex(msg => msg.id === messageId);
      if (index !== -1) {
        currentChat.splice(index, 1);
        saveChatToHistory();
      }
    });
  }

  if (speechBtn) {
    speechBtn.addEventListener('click', function() {
      const content = messageDiv.querySelector('.message-content').textContent;
      speakText(content);
    });
  }
}

// Text-to-speech function
async function speakText(text) {
  try {
    const lang = speechVoiceSelect ? speechVoiceSelect.value : 'en-US';

    const response = await puter.speech.synthesize({
      text,
      voice: lang,
      engine: 'premium'
    });

    if (response.success) {
      const audio = new Audio(response.url);
      audio.play();
    } else {
      console.log("Speech error:", response);

      // Try fallback to standard engine
      const fallbackResponse = await puter.speech.synthesize({
        text,
        voice: lang,
        engine: 'standard'
      });

      if (fallbackResponse.success) {
        const audio = new Audio(fallbackResponse.url);
        audio.play();
      } else {
        console.log("Fallback speech error:", fallbackResponse);
      }
    }
  } catch (error) {
    console.error("TTS error:", error);
  }
}

// Format AI response with markdown/code highlighting
function formatAIResponse(text) {
  // Replace markdown code blocks with HTML
  let formattedText = text.replace(/```(\w+)?\n([\s\S]*?)```/g, function(match, lang, code) {
    const language = lang || 'plaintext';
    // Use Prism for syntax highlighting
    return `<pre class="language-${language}"><code class="language-${language}">${code}</code></pre>`;
  });

  // Replace single line code
  formattedText = formattedText.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Replace bold text
  formattedText = formattedText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Replace italic text
  formattedText = formattedText.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Replace links
  formattedText = formattedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Replace lists
  formattedText = formattedText.replace(/^(\d+\.\s.+)$/gm, '<li>$1</li>');
  formattedText = formattedText.replace(/^(\*\s.+)$/gm, '<li>$1</li>');

  // Replace paragraphs
  formattedText = formattedText.replace(/(?:\r\n|\r|\n){2,}/g, '</p><p>');

  // Wrap in paragraph tags
  formattedText = '<p>' + formattedText + '</p>';

  return formattedText;
}

// Start a new chat
function startNewChat() {
  // Save current chat to history
  saveChatToHistory();

  // Clear current chat
  currentChat = [];
  chatContainer.innerHTML = '';

  // Generate a new chat ID
  const chatId = 'chat-' + Date.now();
  currentChatId = chatId;
}

// Save chat to history
function saveChatToHistory() {
  if (currentChat.length === 0) return;

  const chatId = 'chat-' + Date.now();
  const firstUserMessage = currentChat.find(msg => msg.role === 'user');
  const title = firstUserMessage ? firstUserMessage.content.slice(0, 30) + '...' : 'Untitled Chat';

  chatHistory[chatId] = {
    id: chatId,
    title,
    timestamp: new Date().toISOString(),
    messages: [...currentChat]
  };

  localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
}

// Display chat history
function displayChatHistory() {
  const historyList = document.getElementById('history-list');
  if (!historyList) return;

  historyList.innerHTML = '';

  // Get saved chat history
  const savedHistory = localStorage.getItem('chatHistory');
  if (savedHistory) {
    chatHistory = JSON.parse(savedHistory);
  }

  if (Object.keys(chatHistory).length === 0) {
    historyList.innerHTML = '<div class="text-center text-gray-500 py-4">No chat history yet</div>';
    return;
  }

  // Sort by timestamp (newest first)
  const sortedHistory = Object.values(chatHistory).sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  sortedHistory.forEach(chat => {
    const chatItem = document.createElement('div');
    chatItem.className = 'p-3 border rounded-cool hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition';

    const date = new Date(chat.timestamp).toLocaleDateString();
    const time = new Date(chat.timestamp).toLocaleTimeString();

    chatItem.innerHTML = `
      <div class="flex justify-between items-center">
        <div class="font-medium">${chat.title}</div>
        <button class="text-red-500 hover:text-red-700 delete-history" data-id="${chat.id}">
          <i class="fa fa-times"></i>
        </button>
      </div>
      <div class="text-xs text-gray-500">${date} ${time}</div>
    `;

    chatItem.addEventListener('click', function(e) {
      if (!e.target.closest('.delete-history')) {
        loadChatFromHistory(chat.id);
        togglePopup('history', false);
      }
    });

    historyList.appendChild(chatItem);
  });

  // Add delete event listeners
  const deleteButtons = historyList.querySelectorAll('.delete-history');
  deleteButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.stopPropagation();
      const chatId = this.getAttribute('data-id');
      deleteChatFromHistory(chatId);
      displayChatHistory();
    });
  });
}

// Load chat from history
function loadChatFromHistory(chatId) {
  if (!chatHistory[chatId]) return;

  // Save current chat
  saveChatToHistory();

  // Clear current chat
  currentChat = [];
  chatContainer.innerHTML = '';

  // Load selected chat
  const chat = chatHistory[chatId];

  chat.messages.forEach(msg => {
    const messageId = addMessageToChat(msg.role, msg.content, msg.model);

    if (msg.role === 'ai') {
      // Cache the response
      responseCache[messageId] = msg.content;

      // Add action buttons
      addActionButtons(messageId);
    }
  });

  currentChat = [...chat.messages];
}

// Delete chat from history
function deleteChatFromHistory(chatId) {
  if (chatHistory[chatId]) {
    delete chatHistory[chatId];
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  }
}

// Toggle popup visibility
function togglePopup(popupId, show) {
  const popup = document.getElementById('popup-' + popupId);
  const overlay = document.getElementById('popup-overlay');

  if (!popup || !overlay) return;

  if (show) {
    popup.classList.remove('hidden');
    overlay.classList.remove('hidden');
    
    // Add click outside to dismiss
    overlay.onclick = function(event) {
      if (event.target === overlay) {
        togglePopup(popupId, false);
      }
    };
  } else {
    popup.classList.add('hidden');
    overlay.classList.add('hidden');
  }
}

// Generate an image
async function generateImage() {
  const prompt = document.getElementById('image-gen-prompt').value.trim();
  if (!prompt) return;

  const imageGenArea = document.getElementById('image-gen-area');
  imageGenArea.innerHTML = '<div class="text-center py-4"><i class="fa fa-spinner fa-spin"></i> Generating...</div>';

  try {
    const response = await puter.ai.image.generate({
      prompt,
      n: 1
    });

    if (response && response.data && response.data.length > 0) {
      imageGenArea.innerHTML = '';

      response.data.forEach(img => {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'mb-4';

        const imgElement = document.createElement('img');
        imgElement.src = img.url;
        imgElement.className = 'w-full rounded-cool';
        imgElement.alt = prompt;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'flex justify-between mt-2';
        actionsDiv.innerHTML = `
          <button class="bg-blue-600 hover:bg-blue-700 text-base px-3 py-1 rounded-cool text-sm download-img">
            <i class="fa fa-download mr-1"></i> Download
          </button>
          <button class="bg-green-600 hover:bg-green-700 text-base px-3 py-1 rounded-cool text-sm send-to-chat">
            <i class="fa fa-paper-plane mr-1"></i> Send to Chat
          </button>
        `;

        imgContainer.appendChild(imgElement);
        imgContainer.appendChild(actionsDiv);
        imageGenArea.appendChild(imgContainer);

        // Add event listeners
        const downloadBtn = actionsDiv.querySelector('.download-img');
        const sendToChatBtn = actionsDiv.querySelector('.send-to-chat');

        downloadBtn.addEventListener('click', function() {
          const a = document.createElement('a');
          a.href = img.url;
          a.download = 'generated-image.png';
          a.click();
        });

        sendToChatBtn.addEventListener('click', function() {
          addMessageToChat('user', `<p>Generated image from prompt: "${prompt}"</p><img src="${img.url}" alt="${prompt}" />`);
          togglePopup('image', false);
        });
      });
    } else {
      imageGenArea.innerHTML = '<div class="text-center text-red-500 py-4">Failed to generate image</div>';
    }
  } catch (error) {
    console.error("Image generation error:", error);
    imageGenArea.innerHTML = `<div class="text-center text-red-500 py-4">Error: ${error.message || 'Failed to generate image'}</div>`;
  }
}

// File upload handler
document.getElementById('file-input-file').addEventListener('change', handleFileUpload);

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const previewBox = document.getElementById('file-preview-box');
  previewBox.innerHTML = '<div class="text-center py-4"><i class="fa fa-spinner fa-spin"></i> Processing...</div>';

  try {
    // Read file
    const reader = new FileReader();

    reader.onload = async function(e) {
      const content = e.target.result;

      // Create preview
      let preview = '';

      if (file.type.startsWith('image/')) {
        // Image file
        preview = `
          <div class="mb-4">
            <img src="${content}" alt="${file.name}" class="max-h-48 mx-auto rounded-cool" />
            <div class="text-center mt-2">
              <button class="bg-blue-600 hover:bg-blue-700 text-base px-3 py-1 rounded-cool text-sm mr-2 ocr-btn">
                <i class="fa fa-eye mr-1"></i> OCR
              </button>
              <button class="bg-green-600 hover:bg-green-700 text-base px-3 py-1 rounded-cool text-sm send-to-chat">
                <i class="fa fa-paper-plane mr-1"></i> Send to Chat
              </button>
            </div>
          </div>
        `;
      } else if (file.type === 'application/pdf') {
        // PDF file
        preview = `
          <div class="mb-4">
            <div class="bg-gray-100 dark:bg-gray-800 p-4 rounded-cool">
              <i class="fa fa-file-pdf text-red-500 text-4xl"></i>
              <div class="font-medium mt-2">${file.name}</div>
            </div>
            <div class="text-center mt-2">
              <button class="bg-green-600 hover:bg-green-700 text-base px-3 py-1 rounded-cool text-sm send-to-chat">
                <i class="fa fa-paper-plane mr-1"></i> Send to Chat
              </button>
            </div>
          </div>
        `;
      } else if (file.type === 'text/plain' || file.type === 'application/json' || file.type.includes('javascript') || file.type.includes('text/html')) {
        // Text file
        preview = `
          <div class="mb-4">
            <pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-cool overflow-auto max-h-48">${content}</pre>
            <div class="text-center mt-2">
              <button class="bg-green-600 hover:bg-green-700 text-base px-3 py-1 rounded-cool text-sm send-to-chat">
                <i class="fa fa-paper-plane mr-1"></i> Send to Chat
              </button>
            </div>
          </div>
        `;
      } else {
        // Other file types
        preview = `
          <div class="mb-4">
            <div class="bg-gray-100 dark:bg-gray-800 p-4 rounded-cool">
              <i class="fa fa-file text-gray-500 text-4xl"></i>
              <div class="font-medium mt-2">${file.name}</div>
            </div>
            <div class="text-center mt-2">
              <button class="bg-green-600 hover:bg-green-700 text-base px-3 py-1 rounded-cool text-sm send-to-chat">
                <i class="fa fa-paper-plane mr-1"></i> Send to Chat
              </button>
            </div>
          </div>
        `;
      }

      previewBox.innerHTML = preview;

      // Add event listeners
      const ocrBtn = previewBox.querySelector('.ocr-btn');
      if (ocrBtn) {
        ocrBtn.addEventListener('click', async function() {
          await performOCR(content);
        });
      }

      const sendToChatBtn = previewBox.querySelector('.send-to-chat');
      if (sendToChatBtn) {
        sendToChatBtn.addEventListener('click', function() {
          let messageContent = '';

          if (file.type.startsWith('image/')) {
            messageContent = `<p>Image: ${file.name}</p><img src="${content}" alt="${file.name}" />`;
          } else {
            messageContent = `<p>File: ${file.name}</p><pre class="bg-gray-100 dark:bg-gray-800 p-2 rounded-cool overflow-auto">${content}</pre>`;
          }

          addMessageToChat('user', messageContent);
          togglePopup('file', false);
        });
      }
    };

    if (file.type.startsWith('image/') || file.type === 'text/plain' || file.type === 'application/json' || file.type.includes('javascript') || file.type.includes('text/html')) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  } catch (error) {
    console.error("File upload error:", error);
    previewBox.innerHTML = `<div class="text-center text-red-500 py-4">Error: ${error.message || 'Failed to process file'}</div>`;
  }
}

// Perform OCR on image
async function performOCR(imageData) {
  const previewBox = document.getElementById('file-preview-box');

  try {
    const response = await puter.ocr.getText({
      image: imageData
    });

    if (response && response.text) {
      const ocrResult = document.createElement('div');
      ocrResult.className = 'mt-4';
      ocrResult.innerHTML = `
        <h3 class="font-medium mb-2">OCR Result:</h3>
        <div class="bg-gray-100 dark:bg-gray-800 p-3 rounded-cool">
          <pre>${response.text}</pre>
        </div>
        <div class="text-center mt-2">
          <button class="bg-green-600 hover:bg-green-700 text-base px-3 py-1 rounded-cool text-sm send-ocr-to-chat">
            <i class="fa fa-paper-plane mr-1"></i> Send OCR Result to Chat
          </button>
        </div>
      `;

      previewBox.appendChild(ocrResult);

      // Add event listener
      const sendOcrBtn = ocrResult.querySelector('.send-ocr-to-chat');
      if (sendOcrBtn) {
        sendOcrBtn.addEventListener('click', function() {
          addMessageToChat('user', `<p>OCR Result:</p><pre class="bg-gray-100 dark:bg-gray-800 p-2 rounded-cool">${response.text}</pre>`);
          togglePopup('file', false);
        });
      }
    } else {
      const ocrResult = document.createElement('div');
      ocrResult.className = 'mt-4 text-center text-red-500';
      ocrResult.textContent = 'No text detected in the image';
      previewBox.appendChild(ocrResult);
    }
  } catch (error) {
    console.error("OCR error:", error);
    const ocrResult = document.createElement('div');
    ocrResult.className = 'mt-4 text-center text-red-500';
    ocrResult.textContent = `OCR Error: ${error.message || 'Failed to perform OCR'}`;
    previewBox.appendChild(ocrResult);
  }
}

// Preview custom theme
function previewCustomTheme() {
  // Get values from custom theme editor
  customTheme.background = document.getElementById('custom-background').value;
  customTheme.text = document.getElementById('custom-text').value;
  customTheme.header = document.getElementById('custom-header').value;
  customTheme.footer = document.getElementById('custom-footer').value;
  customTheme.popups = document.getElementById('custom-popups').value;
  customTheme.borders = document.getElementById('custom-borders').value;
  customTheme.userBubble = document.getElementById('custom-user-bubble').value;
  customTheme.modelBubble = document.getElementById('custom-model-bubble').value;
  customTheme.dropdowns = document.getElementById('custom-dropdowns').value;

  // Apply the custom theme
  applyCustomTheme();
}

// Reset custom theme
function resetCustomTheme() {
  // Reset to defaults
  customTheme = {
    background: '#fafafa',
    text: '#24292f',
    header: '#ffffff',
    footer: '#ffffff',
    popups: '#ffffff',
    borders: '#000000',
    userBubble: '#f3f4f6',
    modelBubble: '#ffffff',
    dropdowns: '#f9fafb'
  };

  // Update color inputs
  document.getElementById('custom-background').value = customTheme.background;
  document.getElementById('custom-text').value = customTheme.text;
  document.getElementById('custom-header').value = customTheme.header;
  document.getElementById('custom-footer').value = customTheme.footer;
  document.getElementById('custom-popups').value = customTheme.popups;
  document.getElementById('custom-borders').value = customTheme.borders;
  document.getElementById('custom-user-bubble').value = customTheme.userBubble;
  document.getElementById('custom-model-bubble').value = customTheme.modelBubble;
  document.getElementById('custom-dropdowns').value = customTheme.dropdowns;

  // Apply the reset theme
  applyCustomTheme();
}

// Apply theme based on selection
function applyTheme(theme) {
  const body = document.body;
  const mainHeader = document.getElementById('main-header');
  const footer = document.querySelector('.w-full.max-w-3xl.mx-auto.fixed.bottom-0');

  // Remove all theme classes
  body.classList.remove('dark-mode', 'light-theme', 'sunset-theme', 'multicolored-theme', 'forest-theme', 'midnight-theme');

  // Add selected theme class
  switch (theme) {
    case 'dark':
      body.classList.add('dark-mode');
      break;
    case 'light':
      body.classList.add('light-theme');
      // Light theme styles
      body.style.background = '#ffffff';
      body.style.color = '#333333';
      if (mainHeader) mainHeader.style.background = '#f9fafb';
      if (footer) footer.style.background = '#f9fafb';
      break;
    case 'sunset':
      body.classList.add('sunset-theme');
      // Sunset theme styles
      body.style.background = 'linear-gradient(120deg,#ffecd2 0%,#fcb69f 100%)';
      body.style.color = '#46251a';
      if (mainHeader) mainHeader.style.background = '#ffecd2';
      if (footer) footer.style.background = '#ffecd2';
      break;
    case 'multicolored':
      body.classList.add('multicolored-theme');
      // Multicolored theme styles
      body.style.background = 'linear-gradient(120deg,#89f7fe 0%,#66a6ff 100%)';
      body.style.color = '#163253';
      if (mainHeader) mainHeader.style.background = '#89f7fe';
      if (footer) footer.style.background = '#89f7fe';
      break;
    case 'forest':
      body.classList.add('forest-theme');
      // Forest theme styles
      body.style.background = 'linear-gradient(120deg,#e3ffe7 0%,#d9e7ff 100%)';
      body.style.color = '#1e3a23';
      if (mainHeader) mainHeader.style.background = '#e3ffe7';
      if (footer) footer.style.background = '#e3ffe7';
      break;
    case 'midnight':
      body.classList.add('midnight-theme');
      // Midnight theme styles
      body.style.background = 'linear-gradient(120deg,#0f2027 0%,#203a43 50%,#2c5364 100%)';
      body.style.color = '#e0e0e0';
      if (mainHeader) mainHeader.style.background = '#0f2027';
      if (footer) footer.style.background = '#0f2027';
      break;
    case 'custom':
      // Apply custom theme
      applyCustomTheme();
      break;
    default: // default theme
      body.style.background = '#fafafa';
      body.style.color = '#24292f';
      if (mainHeader) mainHeader.style.background = '';
      if (footer) footer.style.background = '';
      break;
  }

  // Update theme select dropdown
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    themeSelect.value = theme;
  }

  // Update theme preview thumbnails
  const themeOptions = document.querySelectorAll('.theme-option');
  themeOptions.forEach(option => {
    option.classList.remove('active');
    if (option.getAttribute('data-theme') === theme) {
      option.classList.add('active');
    }
  });
}

// Apply custom theme
function applyCustomTheme() {
  const body = document.body;
  const mainHeader = document.getElementById('main-header');
  const footer = document.querySelector('.w-full.max-w-3xl.mx-auto.fixed.bottom-0');
  const popups = document.querySelectorAll('.popup-ptr .bg-white');

  // Apply custom styles
  body.style.background = customTheme.background;
  body.style.color = customTheme.text;

  if (mainHeader) mainHeader.style.background = customTheme.header;
  if (footer) footer.style.background = customTheme.footer;

  // Apply to popups
  popups.forEach(popup => {
    popup.style.background = customTheme.popups;
  });

  // Apply to chat bubbles
  document.querySelectorAll('#chat-container .bg-gray-50').forEach(bubble => {
    bubble.style.background = customTheme.userBubble;
  });

  document.querySelectorAll('#chat-container .bg-white').forEach(bubble => {
    bubble.style.background = customTheme.modelBubble;
  });

  // Apply to borders
  document.querySelectorAll('.border').forEach(element => {
    element.style.borderColor = customTheme.borders;
  });

  // Apply to dropdowns
  document.querySelectorAll('select').forEach(select => {
    select.style.background = customTheme.dropdowns;
  });
}

// Toggle custom theme editor
function toggleCustomThemeEditor() {
  const editor = document.getElementById('custom-theme-editor');
  editor.classList.toggle('hidden');

  // Select the custom theme option
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    themeSelect.value = 'custom';
  }

  // Update the color inputs with current custom theme values
  document.getElementById('custom-background').value = customTheme.background;
  document.getElementById('custom-text').value = customTheme.text;
  document.getElementById('custom-header').value = customTheme.header;
  document.getElementById('custom-footer').value = customTheme.footer;
  document.getElementById('custom-popups').value = customTheme.popups;
  document.getElementById('custom-borders').value = customTheme.borders;
  document.getElementById('custom-user-bubble').value = customTheme.userBubble;
  document.getElementById('custom-model-bubble').value = customTheme.modelBubble;
  document.getElementById('custom-dropdowns').value = customTheme.dropdowns;
}

// Select theme from preview thumbnails
function selectThemePreview(theme) {
  applyTheme(theme);

  if (theme === 'custom') {
    // Open custom theme editor popup instead
    togglePopup('custom-theme', true);
  }
}

// Open custom theme editor
function openCustomThemeEditor() {
  togglePopup('custom-theme', true);
  
  // Update the color inputs with current custom theme values
  document.getElementById('custom-background').value = customTheme.background;
  document.getElementById('custom-text').value = customTheme.text;
  document.getElementById('custom-header').value = customTheme.header;
  document.getElementById('custom-footer').value = customTheme.footer;
  document.getElementById('custom-popups').value = customTheme.popups;
  document.getElementById('custom-borders').value = customTheme.borders;
  document.getElementById('custom-user-bubble').value = customTheme.userBubble;
  document.getElementById('custom-model-bubble').value = customTheme.modelBubble;
  document.getElementById('custom-dropdowns').value = customTheme.dropdowns;
}

// Save settings to localStorage
function saveSettings() {
  const settings = {
    darkMode,
    currentModel,
    isStreaming,
    isMultiModel,
    selectedModels,
    enabledModels,
    customTheme,
    fontSize: document.getElementById('text-size-range').value,
    speechVoice: speechVoiceSelect ? speechVoiceSelect.value : 'en-US',
    theme: document.getElementById('theme-select').value
  };

  localStorage.setItem('chatAppSettings', JSON.stringify(settings));
}

// Load settings from localStorage
function loadSettings() {
  const savedSettings = localStorage.getItem('chatAppSettings');
  if (!savedSettings) return;

  const settings = JSON.parse(savedSettings);

  // Apply saved settings
  if (settings.darkMode) {
    toggleDarkMode();
  }

  if (settings.currentModel && modelSelect) {
    currentModel = settings.currentModel;
    modelSelect.value = currentModel;
  }

  if (settings.isStreaming && streamingToggle) {
    isStreaming = settings.isStreaming;
    streamingToggle.checked = isStreaming;
  }

  if (settings.isMultiModel && multiToggle) {
    isMultiModel = settings.isMultiModel;
    multiToggle.checked = isMultiModel;
    toggleMultiModel();
  }

  if (settings.selectedModels) {
    selectedModels = settings.selectedModels;
  }

  if (settings.enabledModels) {
    enabledModels = settings.enabledModels;
  }

  if (settings.customTheme) {
    customTheme = settings.customTheme;
  }

  if (settings.fontSize) {
    document.getElementById('text-size-range').value = settings.fontSize;
    document.documentElement.style.fontSize = settings.fontSize + 'px';
  }

  if (settings.speechVoice && speechVoiceSelect) {
    speechVoiceSelect.value = settings.speechVoice;
  }

  if (settings.theme) {
    applyTheme(settings.theme);
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', initializePuter);
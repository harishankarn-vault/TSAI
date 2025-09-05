(function() {
  // Theme toggle functionality
  const themeToggle = document.getElementById('theme-toggle');
  const body = document.body;
  
  // Load saved theme or default to light
  const savedTheme = localStorage.getItem('theme') || 'light';
  body.setAttribute('data-theme', savedTheme);
  updateThemeToggleText(savedTheme);
  
  themeToggle.addEventListener('click', () => {
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeToggleText(newTheme);
  });
  
  function updateThemeToggleText(theme) {
    themeToggle.textContent = theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
  }

  // Animal preview functionality
  const animalPreview = document.getElementById('animal-preview');
  const animalCheckboxes = Array.from(document.querySelectorAll('input[name="animal"]'));

  function setExclusiveSelection(chosen) {
    animalCheckboxes.forEach(cb => {
      cb.checked = cb === chosen ? cb.checked : false;
    });
  }

  function updateAnimalPreview() {
    const selected = animalCheckboxes.find(cb => cb.checked);
    if (!selected) {
      animalPreview.innerHTML = '';
      return;
    }
    const name = selected.value;
    const img = document.createElement('img');
    img.alt = name;
    img.src = `/static/images/${name}.jpg`;
    animalPreview.innerHTML = '';
    animalPreview.appendChild(img);
  }

  animalCheckboxes.forEach(cb => {
    cb.addEventListener('change', async (e) => {
      if (e.target.checked) {
        setExclusiveSelection(e.target);
        updateAnimalPreview();
        
        // Send animal selection to backend
        try {
          const response = await fetch('/select-animal', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ animal: e.target.value })
          });
          
          if (response.ok) {
            // Add a message to chat about the animal selection
            addMessage(`🐾 You selected: ${e.target.value}`, false);
          }
        } catch (err) {
          console.error('Error selecting animal:', err);
        }
      } else {
        updateAnimalPreview();
      }
    });
  });

  // File upload functionality with Gemini analysis
  const form = document.getElementById('upload-form');
  const fileInput = document.getElementById('file-input');
  const result = document.getElementById('upload-result');
  const geminiAnalysis = document.getElementById('gemini-analysis');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      result.textContent = 'Please choose a file first.';
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    result.textContent = 'Uploading and analyzing with Gemini...';
    geminiAnalysis.style.display = 'none';
    
    try {
      const res = await fetch('/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      
      result.textContent = `Name: ${data.name}\nSize (bytes): ${data.size_bytes}\nType: ${data.type}`;
      
      // Show Gemini analysis
      if (data.gemini_analysis) {
        geminiAnalysis.textContent = data.gemini_analysis;
        geminiAnalysis.style.display = 'block';
        
        // Add a message to chat about the file being added to context
        addMessage(`📁 File "${data.name}" analyzed and added to context!`, false);
      }
    } catch (err) {
      result.textContent = `Error: ${err.message}`;
    }
  });

  // Chat functionality
  const chatHeader = document.getElementById('chat-header');
  const chatContent = document.getElementById('chat-content');
  const chatToggle = document.getElementById('chat-toggle');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');
  const clearContextBtn = document.getElementById('clear-context-btn');

  let isChatOpen = false;

  chatHeader.addEventListener('click', (e) => {
    // Don't toggle if clicking on the clear button
    if (e.target === clearContextBtn) return;
    
    isChatOpen = !isChatOpen;
    chatContent.classList.toggle('active', isChatOpen);
    chatToggle.textContent = isChatOpen ? '▲' : '▼';
  });

  // Clear context functionality
  clearContextBtn.addEventListener('click', async (e) => {
    e.stopPropagation(); // Prevent chat toggle
    
    if (confirm('Are you sure you want to clear the conversation context? This will remove all uploaded file information and chat history.')) {
      try {
        const response = await fetch('/clear-context', { method: 'POST' });
        const data = await response.json();
        
        if (response.ok) {
          // Clear the chat messages except the initial welcome message
          chatMessages.innerHTML = '<div class="chat-message bot">Hello! I\'m Gemini AI. I can help you analyze files and answer questions. Upload a file or ask me anything!</div>';
          addMessage('🗑️ Conversation context cleared. Upload new files to start fresh!', false);
        } else {
          addMessage(`Error: ${data.error}`, false);
        }
      } catch (err) {
        addMessage(`Error clearing context: ${err.message}`, false);
      }
    }
  });

  function addMessage(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isUser ? 'user' : 'bot'}`;
    messageDiv.textContent = content;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    addMessage(message, true);
    chatInput.value = '';

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Chat failed');
      
      addMessage(data.response, false);
    } catch (err) {
      addMessage(`Error: ${err.message}`, false);
    }
  }

  chatSend.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
})();


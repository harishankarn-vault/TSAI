from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
import os
import google.generativeai as genai
import base64
from PIL import Image
import io
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Ensure upload folder exists
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Configure Gemini AI
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise RuntimeError("❌ No GEMINI_API_KEY found. Add it to .env or environment variables.")

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

# Global conversation context
conversation_context = {
    'uploaded_files': [],
    'chat_history': [],
    'selected_animal': None
}


def analyze_file_with_gemini(file_path, file_type, filename):
    """Analyze uploaded file with Gemini AI and store context"""
    try:
        print(f"Analyzing file: {filename}, type: {file_type}")  # Debug log
        file_size = os.path.getsize(file_path)
        
        if file_type.startswith('image/'):
            # For images, analyze the image
            print("Processing image file...")  # Debug log
            image = Image.open(file_path)
            response = model.generate_content([
                "Look at this image and give me a brief summary of what you see.",
                image
            ])
            analysis_text = response.text
        else:
            # For all other files, just give a simple summary based on file info
            print("Processing text/binary file...")  # Debug log
            file_info = f"File: {filename}\nType: {file_type}\nSize: {file_size} bytes"
            response = model.generate_content(f"Give me a brief summary of what this file might contain based on its name and type:\n\n{file_info}")
            analysis_text = response.text
        
        print(f"Analysis complete: {analysis_text[:100]}...")  # Debug log
        
        # Store file context for chat
        file_context = {
            'filename': filename,
            'type': file_type,
            'analysis': analysis_text,
            'timestamp': os.path.getmtime(file_path)
        }
        conversation_context['uploaded_files'].append(file_context)
        
        return f"📁 File analyzed! Here's what I found:\n\n{analysis_text}"
        
    except Exception as e:
        print(f"Error in file analysis: {str(e)}")  # Debug log
        return f"❌ File analysis failed: {str(e)}"


@app.get('/')
def index():
    return render_template('index.html')


@app.post('/upload')
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request.'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected.'}), 400

    filename = secure_filename(file.filename)
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

    try:
        file.save(save_path)
    except Exception as exc:
        return jsonify({'error': f'Failed to save file: {exc}'}), 500

    try:
        size_bytes = os.path.getsize(save_path)
    except OSError:
        size_bytes = None

    content_type = file.mimetype or 'application/octet-stream'

    # Analyze file with Gemini
    gemini_analysis = analyze_file_with_gemini(save_path, content_type, filename)

    return jsonify({
        'name': filename, 
        'size_bytes': size_bytes, 
        'type': content_type,
        'gemini_analysis': gemini_analysis
    })


@app.post('/chat')
def chat_with_gemini():
    """Chat endpoint for Gemini AI with file context"""
    try:
        data = request.get_json()
        message = data.get('message', '')
        
        if not message:
            return jsonify({'error': 'No message provided'}), 400
        
        # Build context-aware prompt
        context_prompt = build_context_prompt(message)
        
        # Store user message in chat history
        conversation_context['chat_history'].append({
            'role': 'user',
            'message': message,
            'timestamp': os.path.getmtime(__file__)
        })
        
        response = model.generate_content(context_prompt)
        response_text = response.text
        
        # Store bot response in chat history
        conversation_context['chat_history'].append({
            'role': 'bot',
            'message': response_text,
            'timestamp': os.path.getmtime(__file__)
        })
        
        return jsonify({'response': response_text})
        
    except Exception as e:
        return jsonify({'error': f'Chat failed: {str(e)}'}), 500


def build_context_prompt(user_message):
    """Build a context-aware prompt including uploaded files, selected animal, and chat history"""
    prompt_parts = []
    
    # Add context about selected animal
    if conversation_context['selected_animal']:
        prompt_parts.append(f"Context: The user has selected the animal: {conversation_context['selected_animal']}")
        prompt_parts.append("")
    
    # Add context about uploaded files
    if conversation_context['uploaded_files']:
        prompt_parts.append("Context: The user has uploaded the following files that I have analyzed:")
        for file_info in conversation_context['uploaded_files'][-5:]:  # Last 5 files
            prompt_parts.append(f"- {file_info['filename']} ({file_info['type']}): {file_info['analysis'][:200]}...")
        prompt_parts.append("")
    
    # Add recent chat history for context
    if conversation_context['chat_history']:
        prompt_parts.append("Recent conversation history:")
        for msg in conversation_context['chat_history'][-6:]:  # Last 6 messages
            role = "User" if msg['role'] == 'user' else "Assistant"
            prompt_parts.append(f"{role}: {msg['message'][:100]}...")
        prompt_parts.append("")
    
    # Add the current user message
    prompt_parts.append(f"Current user message: {user_message}")
    prompt_parts.append("")
    prompt_parts.append("Please respond to the user's message, taking into account the selected animal, uploaded files, and conversation context. Be helpful and friendly!")
    
    return "\n".join(prompt_parts)


@app.get('/context')
def get_context():
    """Get current conversation context"""
    return jsonify({
        'uploaded_files': conversation_context['uploaded_files'],
        'chat_history': conversation_context['chat_history']
    })


@app.post('/clear-context')
def clear_context():
    """Clear conversation context"""
    conversation_context['uploaded_files'] = []
    conversation_context['chat_history'] = []
    conversation_context['selected_animal'] = None
    return jsonify({'message': 'Context cleared successfully'})


@app.post('/select-animal')
def select_animal():
    """Update selected animal in context"""
    try:
        data = request.get_json()
        animal = data.get('animal', '')
        
        conversation_context['selected_animal'] = animal
        
        return jsonify({
            'message': f'Selected animal: {animal}',
            'animal': animal
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to select animal: {str(e)}'}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)


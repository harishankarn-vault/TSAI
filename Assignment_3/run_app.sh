#!/bin/bash

# Set the Gemini API key
export GEMINI_API_KEY='AIzaSyCn0KUxjRyAohBrfVdYIjUWEhuPAWMCQpc'

# Activate virtual environment
source venv/bin/activate

# Run the Flask application on port 5001 (5000 is used by macOS AirPlay)
echo "🚀 Starting Animal Picker & File Uploader with Gemini AI..."
echo "📱 Application will be available at: http://localhost:5001"
echo "💬 Click the chat header at the bottom to interact with Gemini AI"
echo "🌙 Use the theme toggle in the header to switch between light/dark modes"
echo ""
python app.py

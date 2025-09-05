#!/usr/bin/env python3
"""
Setup script for the Animal Picker & File Uploader with Gemini AI
"""

import subprocess
import sys
import os

def install_requirements():
    """Install required packages from requirements.txt"""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Successfully installed all requirements!")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error installing requirements: {e}")
        return False
    return True

def setup_environment():
    """Set up environment variables"""
    print("\n🔧 Environment Setup:")
    print("To use Gemini AI, you need to set your API key:")
    print("1. Get your API key from: https://makersuite.google.com/app/apikey")
    print("2. Set the environment variable:")
    print("   export GEMINI_API_KEY='your-api-key-here'")
    print("   or create a .env file with: GEMINI_API_KEY=your-api-key-here")
    print("\n🚀 To run the application:")
    print("   python app.py")
    print("   or use: ./run_app.sh")
    print("   Then visit: http://localhost:5001")
    print("   (Note: Port 5000 is used by macOS AirPlay, so we use 5001)")

if __name__ == "__main__":
    print("🐾 Animal Picker & File Uploader with Gemini AI Setup")
    print("=" * 50)
    
    if install_requirements():
        setup_environment()
        print("\n✨ Setup complete! You're ready to go!")
    else:
        print("\n❌ Setup failed. Please check the error messages above.")

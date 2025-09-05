#!/usr/bin/env python3
"""
Test script to demonstrate the context integration functionality
"""

import requests
import json

BASE_URL = "http://localhost:5001"

def test_context_integration():
    """Test the context integration between file uploads and chat"""
    
    print("🧪 Testing Context Integration")
    print("=" * 40)
    
    # Test 1: Upload a file
    print("\n1. Uploading a test file...")
    test_content = "This is a test document about machine learning and artificial intelligence."
    
    with open("test_document.txt", "w") as f:
        f.write(test_content)
    
    with open("test_document.txt", "rb") as f:
        files = {"file": ("test_document.txt", f, "text/plain")}
        response = requests.post(f"{BASE_URL}/upload", files=files)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ File uploaded: {data['name']}")
        print(f"📄 Analysis: {data['gemini_analysis'][:100]}...")
    else:
        print(f"❌ Upload failed: {response.text}")
        return
    
    # Test 2: Check context
    print("\n2. Checking conversation context...")
    response = requests.get(f"{BASE_URL}/context")
    if response.status_code == 200:
        context = response.json()
        print(f"📁 Files in context: {len(context['uploaded_files'])}")
        print(f"💬 Chat messages: {len(context['chat_history'])}")
    else:
        print(f"❌ Context check failed: {response.text}")
    
    # Test 3: Chat about the uploaded file
    print("\n3. Testing chat with file context...")
    chat_messages = [
        "What files do you know about?",
        "Tell me more about the test document I uploaded",
        "What was the main topic of that file?"
    ]
    
    for message in chat_messages:
        print(f"\n👤 User: {message}")
        response = requests.post(f"{BASE_URL}/chat", 
                               json={"message": message},
                               headers={"Content-Type": "application/json"})
        
        if response.status_code == 200:
            data = response.json()
            print(f"🤖 Gemini: {data['response'][:200]}...")
        else:
            print(f"❌ Chat failed: {response.text}")
    
    # Test 4: Clear context
    print("\n4. Testing context clear...")
    response = requests.post(f"{BASE_URL}/clear-context")
    if response.status_code == 200:
        print("✅ Context cleared successfully")
    else:
        print(f"❌ Clear context failed: {response.text}")
    
    # Cleanup
    import os
    if os.path.exists("test_document.txt"):
        os.remove("test_document.txt")
    
    print("\n🎉 Context integration test completed!")

if __name__ == "__main__":
    test_context_integration()

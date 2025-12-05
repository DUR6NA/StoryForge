"""
StoryForge - Offline-first Python Game Engine & Launcher
Required packages:
pip install fastapi uvicorn pywebview jinja2 toml pyttsx3 requests python-multipart aiofiles
"""

import os
from launcher.main import start_launcher

if __name__ == "__main__":
    # Ensure directories exist
    os.makedirs("library", exist_ok=True)
    os.makedirs("saves", exist_ok=True)
    os.makedirs("imports", exist_ok=True)
    
    start_launcher()

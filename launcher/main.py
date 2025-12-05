import threading
import uvicorn
import webview
from launcher.server import app

def start_server():
    # Run FastAPI server on localhost:14200
    uvicorn.run(app, host="127.0.0.1", port=14200, log_level="error")

def start_launcher():
    # Start the server in a separate thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Create the pywebview window
    webview.create_window(
        "StoryForge", 
        "http://127.0.0.1:14200/launcher", 
        width=1024, 
        height=768,
        min_size=(800, 600),
        background_color='#0f172a' # Slate-900
    )
    webview.start(debug=True)

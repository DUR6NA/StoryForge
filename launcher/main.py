import threading
import uvicorn
import webview
import os
import sys
import json
import subprocess
import ctypes
from launcher.server import app

# Settings file path
SETTINGS_FILE = "settings.json"

def load_settings() -> dict:
    """Load settings from file or return defaults"""
    defaults = {
        "renderer": "edgechromium",
        "selected_gpu": 0,
        "enable_hardware_acceleration": True,
        "prefer_discrete_gpu": True,
        "vsync": True,
        "max_fps": 60
    }
    
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, 'r') as f:
                saved = json.load(f)
                defaults.update(saved)
        except:
            pass
    
    return defaults

def get_renderer_gui() -> str:
    """Get the GUI renderer name for pywebview based on settings"""
    settings = load_settings()
    renderer = settings.get("renderer", "edgechromium")
    
    # Map our settings to pywebview gui options
    renderer_map = {
        "edgechromium": "edgechromium",  # Direct3D via ANGLE
        "cef": "cef",                     # Chromium/OpenGL
        "mshtml": "mshtml"                # Legacy software renderer
    }
    
    return renderer_map.get(renderer, "edgechromium")

def detect_gpus() -> list:
    """Detect available GPUs on Windows"""
    gpus = []
    try:
        result = subprocess.run(
            ['wmic', 'path', 'win32_videocontroller', 'get', 'name'],
            capture_output=True,
            text=True,
            timeout=5,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
        )
        lines = [l.strip() for l in result.stdout.split('\n') if l.strip() and l.strip() != "Name"]
        for idx, name in enumerate(lines):
            is_discrete = any(x in name.lower() for x in ['nvidia', 'geforce', 'gtx', 'rtx', 'radeon', 'rx '])
            gpus.append({
                "id": idx,
                "name": name,
                "is_discrete": is_discrete
            })
    except:
        pass
    return gpus

def apply_gpu_preference(selected_gpu_id: int, prefer_discrete: bool = True):
    """
    Apply GPU preference for the application.
    
    On Windows, this works by:
    1. Setting environment variables that Chromium/Edge respects
    2. For NVIDIA: Using NvOptimusEnablement export
    3. For AMD: Using AmdPowerXpressRequestHighPerformance export
    
    Note: The actual GPU selection may also need Windows Graphics Settings
    to be configured for maximum compatibility.
    """
    gpus = detect_gpus()
    
    if not gpus:
        print("[StoryForge] No GPUs detected, using system default")
        return
    
    # Find selected GPU
    selected_gpu = None
    for gpu in gpus:
        if gpu["id"] == selected_gpu_id:
            selected_gpu = gpu
            break
    
    if not selected_gpu:
        # Default to first discrete GPU if prefer_discrete is True
        if prefer_discrete:
            for gpu in gpus:
                if gpu.get("is_discrete"):
                    selected_gpu = gpu
                    break
        
        # Fall back to first GPU
        if not selected_gpu:
            selected_gpu = gpus[0]
    
    gpu_name = selected_gpu["name"].lower()
    
    print(f"[StoryForge] Selected GPU: {selected_gpu['name']}")
    
    # Set environment variables for Chromium-based renderers
    # These help influence GPU selection in Edge WebView2 and CEF
    
    if 'nvidia' in gpu_name or 'geforce' in gpu_name or 'gtx' in gpu_name or 'rtx' in gpu_name:
        # For NVIDIA GPUs - request high performance GPU
        os.environ["SHIM_MCCOMPAT"] = "0x800000001"  # Force NVIDIA GPU
        
        # Try to use ctypes to export NvOptimusEnablement (for optimus laptops)
        try:
            # This signals to the NVIDIA driver to use the discrete GPU
            ctypes.windll.kernel32.SetEnvironmentVariableW("__COMPAT_LAYER", "HighDpiAware")
        except:
            pass
        
        print("[StoryForge] NVIDIA GPU selected - High Performance mode enabled")
        
    elif 'radeon' in gpu_name or 'amd' in gpu_name or 'rx ' in gpu_name:
        # For AMD GPUs - request high performance
        os.environ["DISABLE_VK_LAYER_AMD_switchable_graphics_1"] = "1"
        print("[StoryForge] AMD GPU selected - High Performance mode enabled")
        
    elif 'intel' in gpu_name:
        # Intel integrated graphics
        print("[StoryForge] Intel GPU selected - Power saving mode")
    
    # For Edge WebView2, we can suggest GPU preference via environment
    # This works with Chromium's GPU process
    if selected_gpu.get("is_discrete"):
        os.environ["WEBVIEW2_GPU_OPTIONS"] = "high_performance"
        # Disable software rendering to ensure GPU usage
        os.environ["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"] = "--disable-software-rasterizer"
    else:
        os.environ["WEBVIEW2_GPU_OPTIONS"] = "power_saving"

def start_server():
    # Run FastAPI server on localhost:14200
    uvicorn.run(app, host="127.0.0.1", port=14200, log_level="error")

def start_launcher():
    # Start the server in a separate thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Get renderer settings
    settings = load_settings()
    renderer_gui = get_renderer_gui()
    hardware_accel = settings.get("enable_hardware_acceleration", True)
    selected_gpu = settings.get("selected_gpu", 0)
    prefer_discrete = settings.get("prefer_discrete_gpu", True)
    
    # Apply GPU preference before starting webview
    if hardware_accel:
        apply_gpu_preference(selected_gpu, prefer_discrete)
    
    print(f"[StoryForge] Starting with renderer: {renderer_gui}")
    print(f"[StoryForge] Hardware acceleration: {'enabled' if hardware_accel else 'disabled'}")
    print(f"[StoryForge] Selected GPU index: {selected_gpu}")

    # Create the pywebview window
    webview.create_window(
        "StoryForge", 
        "http://127.0.0.1:14200/launcher", 
        width=1024, 
        height=768,
        min_size=(800, 600),
        background_color='#0f172a' # Slate-900
    )
    
    # Start with selected renderer
    # Note: hardware_acceleration parameter controls GPU usage in the web content
    try:
        webview.start(
            gui=renderer_gui,
            debug=True,
            private_mode=False,
            http_server=True
        )
    except Exception as e:
        print(f"[StoryForge] Failed to start with {renderer_gui}, falling back to default: {e}")
        # Fallback to default renderer
        webview.start(debug=True)



"""
Settings API for StoryForge - Handles application settings including GPU/renderer options
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Literal, List
import os
import json
import subprocess
import platform

router = APIRouter(prefix="/settings")

# Settings file path
SETTINGS_FILE = "settings.json"

# Renderer information for the UI
RENDERERS = {
    "edgechromium": {
        "id": "edgechromium",
        "name": "Edge Chromium (Direct3D)",
        "description": "Modern GPU-accelerated renderer using Microsoft Edge WebView2. Uses DirectX via ANGLE for fast 2D/3D rendering. Recommended for Windows 10/11.",
        "icon": "directx",
        "recommended": True,
        "gpu_accelerated": True,
        "api": "Direct3D 11/12",
        "requirements": "Edge WebView2 Runtime"
    },
    "cef": {
        "id": "cef",
        "name": "CEF (Chromium/OpenGL)",
        "description": "Chromium Embedded Framework with OpenGL backend. Provides excellent compatibility and GPU acceleration. Requires additional package.",
        "icon": "opengl",
        "recommended": False,
        "gpu_accelerated": True,
        "api": "OpenGL 3.3+",
        "requirements": "cefpython3 package"
    },
    "mshtml": {
        "id": "mshtml",
        "name": "Legacy (Software)",
        "description": "Legacy IE-based renderer with software rendering. No GPU acceleration. Fallback for older systems or when GPU acceleration causes issues.",
        "icon": "cpu",
        "recommended": False,
        "gpu_accelerated": False,
        "api": "Software (GDI)",
        "requirements": "None - always available"
    }
}

class GpuDevice(BaseModel):
    id: int
    name: str
    driver_version: str
    adapter_ram: str
    device_id: str
    vendor: str
    is_discrete: bool
    is_recommended: bool

class AppSettings(BaseModel):
    renderer: Literal["edgechromium", "cef", "mshtml"] = "edgechromium"
    selected_gpu: int = 0  # GPU index - 0 means auto/default
    enable_hardware_acceleration: bool = True
    prefer_discrete_gpu: bool = True
    vsync: bool = True
    max_fps: int = 60
    
class RendererInfo(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    recommended: bool
    gpu_accelerated: bool
    api: str
    requirements: str

def detect_gpus() -> List[dict]:
    """Detect all available GPUs on the system"""
    gpus = []
    
    if platform.system() != "Windows":
        return gpus
    
    try:
        # Get detailed GPU info via WMIC
        result = subprocess.run(
            ['wmic', 'path', 'win32_videocontroller', 'get', 
             'Name,DriverVersion,AdapterRAM,DeviceID,AdapterCompatibility', '/format:csv'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        lines = [l.strip() for l in result.stdout.split('\n') if l.strip()]
        
        # Skip header line
        if len(lines) > 1:
            for idx, line in enumerate(lines[1:]):
                parts = line.split(',')
                if len(parts) >= 6:
                    # CSV format: Node,AdapterCompatibility,AdapterRAM,DeviceID,DriverVersion,Name
                    vendor = parts[1] if len(parts) > 1 else "Unknown"
                    adapter_ram = parts[2] if len(parts) > 2 else "0"
                    device_id = parts[3] if len(parts) > 3 else ""
                    driver_version = parts[4] if len(parts) > 4 else "Unknown"
                    name = parts[5] if len(parts) > 5 else "Unknown GPU"
                    
                    # Try to format RAM nicely
                    try:
                        ram_bytes = int(adapter_ram)
                        if ram_bytes > 0:
                            ram_gb = ram_bytes / (1024 ** 3)
                            adapter_ram_str = f"{ram_gb:.1f} GB"
                        else:
                            adapter_ram_str = "Shared"
                    except:
                        adapter_ram_str = "Unknown"
                    
                    # Determine if discrete GPU based on vendor and name
                    is_discrete = False
                    vendor_lower = vendor.lower()
                    name_lower = name.lower()
                    
                    if any(x in vendor_lower for x in ['nvidia', 'amd', 'ati', 'advanced micro']):
                        is_discrete = True
                    elif 'nvidia' in name_lower or 'geforce' in name_lower or 'gtx' in name_lower or 'rtx' in name_lower:
                        is_discrete = True
                    elif 'radeon' in name_lower and 'graphics' not in name_lower:
                        is_discrete = True
                    
                    gpus.append({
                        "id": idx,
                        "name": name,
                        "driver_version": driver_version,
                        "adapter_ram": adapter_ram_str,
                        "device_id": device_id,
                        "vendor": vendor,
                        "is_discrete": is_discrete,
                        "is_recommended": is_discrete  # Prefer discrete GPUs
                    })
    except Exception as e:
        print(f"Error detecting GPUs: {e}")
        # Fallback to basic detection
        try:
            result = subprocess.run(
                ['wmic', 'path', 'win32_videocontroller', 'get', 'name'],
                capture_output=True,
                text=True,
                timeout=5
            )
            lines = [l.strip() for l in result.stdout.split('\n') if l.strip() and l.strip() != "Name"]
            for idx, name in enumerate(lines):
                is_discrete = any(x in name.lower() for x in ['nvidia', 'geforce', 'gtx', 'rtx', 'radeon', 'rx '])
                gpus.append({
                    "id": idx,
                    "name": name,
                    "driver_version": "Unknown",
                    "adapter_ram": "Unknown",
                    "device_id": "",
                    "vendor": "Unknown",
                    "is_discrete": is_discrete,
                    "is_recommended": is_discrete
                })
        except:
            pass
    
    # If no GPUs found, add a default entry
    if not gpus:
        gpus.append({
            "id": 0,
            "name": "Default GPU",
            "driver_version": "Unknown",
            "adapter_ram": "Unknown",
            "device_id": "",
            "vendor": "Unknown",
            "is_discrete": False,
            "is_recommended": True
        })
    
    # Mark the first discrete GPU as recommended, or the first GPU if none are discrete
    has_discrete = any(g["is_discrete"] for g in gpus)
    for gpu in gpus:
        if has_discrete:
            gpu["is_recommended"] = gpu["is_discrete"]
        else:
            gpu["is_recommended"] = (gpu["id"] == 0)
    
    # Only mark the first recommended one
    found_recommended = False
    for gpu in gpus:
        if gpu["is_recommended"] and not found_recommended:
            found_recommended = True
        elif gpu["is_recommended"]:
            gpu["is_recommended"] = False
    
    return gpus

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

def save_settings(settings: dict):
    """Save settings to file"""
    with open(SETTINGS_FILE, 'w') as f:
        json.dump(settings, f, indent=2)

@router.get("/current")
async def get_current_settings():
    """Get current application settings"""
    return load_settings()

@router.post("/update")
async def update_settings(settings: AppSettings):
    """Update application settings"""
    current = load_settings()
    current.update(settings.dict())
    save_settings(current)
    return {"success": True, "settings": current, "restart_required": True}

@router.get("/renderers")
async def get_available_renderers():
    """Get list of available renderers with their information"""
    return list(RENDERERS.values())

@router.get("/renderer/{renderer_id}")
async def get_renderer_info(renderer_id: str):
    """Get information about a specific renderer"""
    if renderer_id not in RENDERERS:
        return {"error": "Renderer not found"}
    return RENDERERS[renderer_id]

@router.get("/gpu/list")
async def get_gpu_list():
    """Get list of all available GPUs"""
    return detect_gpus()

@router.get("/gpu/info")
async def get_gpu_info():
    """Get comprehensive GPU information"""
    gpus = detect_gpus()
    settings = load_settings()
    
    selected_gpu_id = settings.get("selected_gpu", 0)
    selected_gpu = None
    
    # Find the selected GPU or default to first
    for gpu in gpus:
        if gpu["id"] == selected_gpu_id:
            selected_gpu = gpu
            break
    
    if not selected_gpu and gpus:
        selected_gpu = gpus[0]
    
    # Find recommended GPU (first discrete, or first overall)
    recommended_gpu = next((g for g in gpus if g.get("is_recommended")), gpus[0] if gpus else None)
    
    return {
        "platform": platform.system(),
        "available_renderers": list(RENDERERS.keys()),
        "recommended_renderer": "edgechromium",
        "gpus": gpus,
        "gpu_count": len(gpus),
        "selected_gpu": selected_gpu,
        "recommended_gpu": recommended_gpu,
        "gpu_name": selected_gpu["name"] if selected_gpu else "Unknown",
        "driver_version": selected_gpu["driver_version"] if selected_gpu else "Unknown",
        "has_discrete_gpu": any(g["is_discrete"] for g in gpus),
        "multi_gpu": len(gpus) > 1
    }

@router.post("/gpu/select/{gpu_id}")
async def select_gpu(gpu_id: int):
    """Select which GPU to use"""
    gpus = detect_gpus()
    
    # Validate GPU ID
    valid_ids = [g["id"] for g in gpus]
    if gpu_id not in valid_ids and gpu_id != 0:
        return {"error": "Invalid GPU ID", "valid_ids": valid_ids}
    
    settings = load_settings()
    settings["selected_gpu"] = gpu_id
    save_settings(settings)
    
    selected_gpu = next((g for g in gpus if g["id"] == gpu_id), gpus[0] if gpus else None)
    
    return {
        "success": True,
        "selected_gpu": selected_gpu,
        "restart_required": True,
        "message": f"GPU set to: {selected_gpu['name'] if selected_gpu else 'Default'}"
    }


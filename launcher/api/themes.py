"""
Theme management API routes for StoryForge Launcher
Handles loading, saving, importing, and deleting themes
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import json
import shutil
import zipfile
import tempfile
import uuid

router = APIRouter(prefix="/themes", tags=["themes"])

THEMES_DIR = "themes"
USER_THEMES_DIR = os.path.join(THEMES_DIR, "user")
SETTINGS_FILE = os.path.join(THEMES_DIR, "settings.json")

# Ensure directories exist
os.makedirs(THEMES_DIR, exist_ok=True)
os.makedirs(USER_THEMES_DIR, exist_ok=True)


class ThemeMeta(BaseModel):
    id: str
    name: str
    author: str
    version: str
    description: str
    preview: Optional[str] = None
    isBuiltIn: bool = False


class ThemeSettings(BaseModel):
    activeTheme: str = "dark"
    enableSounds: bool = True
    masterVolume: float = 0.5


def load_settings() -> ThemeSettings:
    """Load theme settings from file"""
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return ThemeSettings(**data)
        except:
            pass
    return ThemeSettings()


def save_settings(settings: ThemeSettings):
    """Save theme settings to file"""
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings.model_dump(), f, indent=2)


def get_theme_path(theme_id: str) -> Optional[str]:
    """Get the path to a theme folder by ID"""
    # Check built-in themes first
    builtin_path = os.path.join(THEMES_DIR, theme_id)
    if os.path.exists(builtin_path) and os.path.isdir(builtin_path):
        return builtin_path
    
    # Check user themes
    user_path = os.path.join(USER_THEMES_DIR, theme_id)
    if os.path.exists(user_path) and os.path.isdir(user_path):
        return user_path
    
    return None


def load_theme_json(theme_path: str) -> Optional[Dict[str, Any]]:
    """Load theme.json from a theme folder"""
    theme_file = os.path.join(theme_path, "theme.json")
    if os.path.exists(theme_file):
        try:
            with open(theme_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            pass
    return None


@router.get("/list", response_model=List[Dict[str, Any]])
async def list_themes():
    """List all available themes (built-in and user)"""
    themes = []
    
    # Scan built-in themes
    for item in os.listdir(THEMES_DIR):
        if item == "user" or item == "settings.json" or item == "template":
            continue
        theme_path = os.path.join(THEMES_DIR, item)
        if os.path.isdir(theme_path):
            theme_data = load_theme_json(theme_path)
            if theme_data and "meta" in theme_data:
                meta = theme_data["meta"]
                meta["isBuiltIn"] = True
                themes.append({
                    "meta": meta,
                    "path": theme_path,
                    "colors": theme_data.get("colors", {})
                })
    
    # Scan user themes
    if os.path.exists(USER_THEMES_DIR):
        for item in os.listdir(USER_THEMES_DIR):
            theme_path = os.path.join(USER_THEMES_DIR, item)
            if os.path.isdir(theme_path):
                theme_data = load_theme_json(theme_path)
                if theme_data and "meta" in theme_data:
                    meta = theme_data["meta"]
                    meta["isBuiltIn"] = False
                    themes.append({
                        "meta": meta,
                        "path": theme_path,
                        "colors": theme_data.get("colors", {})
                    })
    
    return themes


@router.get("/active")
async def get_active_theme():
    """Get the currently active theme data"""
    settings = load_settings()
    theme_path = get_theme_path(settings.activeTheme)
    
    if not theme_path:
        # Fall back to dark theme
        theme_path = get_theme_path("dark")
        if not theme_path:
            raise HTTPException(status_code=404, detail="No themes found")
    
    theme_data = load_theme_json(theme_path)
    if not theme_data:
        raise HTTPException(status_code=500, detail="Failed to load theme")
    
    # Add path for asset resolution
    theme_data["_path"] = theme_path
    return theme_data


@router.get("/{theme_id}")
async def get_theme(theme_id: str):
    """Get a specific theme's data"""
    theme_path = get_theme_path(theme_id)
    if not theme_path:
        raise HTTPException(status_code=404, detail="Theme not found")
    
    theme_data = load_theme_json(theme_path)
    if not theme_data:
        raise HTTPException(status_code=500, detail="Failed to load theme")
    
    theme_data["_path"] = theme_path
    return theme_data


@router.post("/activate/{theme_id}")
async def activate_theme(theme_id: str):
    """Set a theme as the active theme"""
    theme_path = get_theme_path(theme_id)
    if not theme_path:
        raise HTTPException(status_code=404, detail="Theme not found")
    
    settings = load_settings()
    settings.activeTheme = theme_id
    save_settings(settings)
    
    return {"success": True, "activeTheme": theme_id}


@router.get("/settings/current")
async def get_theme_settings():
    """Get current theme settings"""
    return load_settings()


@router.post("/settings/update")
async def update_theme_settings(settings: ThemeSettings):
    """Update theme settings"""
    save_settings(settings)
    return {"success": True}


@router.post("/upload")
async def upload_theme(file: UploadFile = File(...)):
    """Upload a custom theme (zip file containing theme.json and assets)"""
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Theme must be a .zip file")
    
    # Save uploaded file temporarily
    temp_dir = tempfile.mkdtemp()
    temp_zip = os.path.join(temp_dir, "theme.zip")
    
    try:
        # Write uploaded content
        content = await file.read()
        with open(temp_zip, "wb") as f:
            f.write(content)
        
        # Extract zip
        extract_dir = os.path.join(temp_dir, "extracted")
        with zipfile.ZipFile(temp_zip, "r") as z:
            z.extractall(extract_dir)
        
        # Find theme.json
        theme_json_path = None
        theme_root = None
        
        for root, dirs, files in os.walk(extract_dir):
            if "theme.json" in files:
                theme_json_path = os.path.join(root, "theme.json")
                theme_root = root
                break
        
        if not theme_json_path:
            raise HTTPException(status_code=400, detail="theme.json not found in archive")
        
        # Load and validate theme
        with open(theme_json_path, "r", encoding="utf-8") as f:
            theme_data = json.load(f)
        
        if "meta" not in theme_data:
            raise HTTPException(status_code=400, detail="Invalid theme: missing 'meta' section")
        
        # Generate unique ID if needed
        theme_id = theme_data["meta"].get("id", str(uuid.uuid4())[:8])
        theme_data["meta"]["id"] = theme_id
        theme_data["meta"]["isBuiltIn"] = False
        
        # Copy to user themes directory
        dest_dir = os.path.join(USER_THEMES_DIR, theme_id)
        if os.path.exists(dest_dir):
            # Theme already exists, generate new ID
            theme_id = f"{theme_id}-{str(uuid.uuid4())[:4]}"
            theme_data["meta"]["id"] = theme_id
            dest_dir = os.path.join(USER_THEMES_DIR, theme_id)
        
        shutil.copytree(theme_root, dest_dir)
        
        # Update theme.json with new ID
        with open(os.path.join(dest_dir, "theme.json"), "w", encoding="utf-8") as f:
            json.dump(theme_data, f, indent=2)
        
        return {
            "success": True,
            "themeId": theme_id,
            "name": theme_data["meta"].get("name", "Unknown Theme")
        }
        
    finally:
        # Cleanup temp files
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.delete("/{theme_id}")
async def delete_theme(theme_id: str):
    """Delete a user-uploaded theme (cannot delete built-in themes)"""
    # Check if it's a user theme
    user_path = os.path.join(USER_THEMES_DIR, theme_id)
    if not os.path.exists(user_path):
        # Check if it's a built-in theme
        builtin_path = os.path.join(THEMES_DIR, theme_id)
        if os.path.exists(builtin_path):
            raise HTTPException(status_code=403, detail="Cannot delete built-in themes")
        raise HTTPException(status_code=404, detail="Theme not found")
    
    # Check if this is the active theme
    settings = load_settings()
    if settings.activeTheme == theme_id:
        # Switch to dark theme
        settings.activeTheme = "dark"
        save_settings(settings)
    
    # Delete theme folder
    shutil.rmtree(user_path)
    
    return {"success": True, "deleted": theme_id}


@router.get("/{theme_id}/asset/{asset_name:path}")
async def get_theme_asset(theme_id: str, asset_name: str):
    """Get a theme asset (image, video, sound file)"""
    theme_path = get_theme_path(theme_id)
    if not theme_path:
        raise HTTPException(status_code=404, detail="Theme not found")
    
    asset_path = os.path.join(theme_path, asset_name)
    if not os.path.exists(asset_path):
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Prevent directory traversal
    if not os.path.abspath(asset_path).startswith(os.path.abspath(theme_path)):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return FileResponse(asset_path)


@router.get("/template/download")
async def download_theme_template():
    """Download the theme template as a starting point for custom themes"""
    template_path = os.path.join(THEMES_DIR, "template", "theme.json")
    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template not found")
    
    return FileResponse(
        template_path,
        media_type="application/json",
        filename="theme-template.json"
    )

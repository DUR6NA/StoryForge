# StoryForge

StoryForge is an offline-first, data-driven game engine and launcher built with Python, FastAPI, and Tailwind/Alpine.js.

## Features

- **Launcher**: A beautiful desktop UI to manage your library.
- **Engine**: A robust text-adventure/RPG engine supporting:
  - TOML-based data (Locations, NPCs, Items, Quests)
  - Jinja2 templating for dynamic text
  - Time/Calendar system
  - Inventory and Flag management
  - Built-in TTS support
- **Modding**: Create games just by editing text files!

## Setup

1. Install Python 3.8+
2. Install dependencies:
   ```bash
   pip install fastapi uvicorn pywebview jinja2 toml pyttsx3 requests python-multipart aiofiles
   ```

## Running

Double-click `run.bat` or run:
```bash
python run.py
```

## Creating Games

1. Create a folder in `library/` (e.g., `library/MyGame`).
2. Create `world.toml` with metadata.
3. Add `locations/*.toml` files.
4. See `library/EternalRealms` for a complete example.

## Controls

- **F1**: Cheat Menu
- **F2**: Debug Console
- **Esc**: Menu

## Offline Usage

The UI currently uses CDN links for Tailwind and Alpine.js. For true offline usage, please download `tailwindcss.js` and `alpine.min.js` to `launcher/static/` and update the HTML files.

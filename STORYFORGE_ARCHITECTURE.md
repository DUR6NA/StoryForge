# StoryForge Engine Architecture

This document outlines the technical architecture of the StoryForge game engine.

## 1. System Overview

StoryForge is a hybrid application consisting of:
-   **Backend:** Python (FastAPI) for game logic and file serving.
-   **Frontend:** HTML/JS (Alpine.js + Tailwind) running in a `pywebview` window.
-   **Data Layer:** TOML files for game content.

## 2. Directory Structure

-   `engine/`: Core Python logic.
    -   `core/`: Main systems (State, World, Parser).
    -   `renderer/`: Handles output generation (HTML/JSON).
    -   `tts/`: Text-to-Speech integration.
-   `launcher/`: The game selection interface.
-   `library/`: User-created game content.

## 3. Core Components

### 3.1 World Loader (`engine.core.world`)
The `World` class is responsible for parsing the game directory. It iterates through `locations/`, `npcs/`, `items/`, and `quests/`, loading all `.toml` files into memory dictionaries keyed by ID.

### 3.2 Game State (`engine.core.state`)
The `GameState` class maintains the runtime state of a session. It includes:
-   `player`: Dictionary of stats, skills, and attributes.
-   `inventory`: List of items.
-   `flags`: Arbitrary key-value pairs for story logic.
-   `relationships`: Dictionary of NPC IDs to relationship values.
-   `time`: Current world time.

### 3.3 The Parser (`engine.core.parser`)
StoryForge uses **Jinja2** for dynamic content and logic execution.
-   **Context:** The Jinja environment is pre-loaded with `player`, `flags`, `time`, and `inventory`.
-   **Functions:** All functions in `engine.core.functions` are exposed as global functions in the template environment.
-   **Preprocessing:** The parser supports a simplified syntax `{{ func arg }}` which is regex-transformed into `{{ func(arg) }}` before rendering.

### 3.4 Function Registry (`engine.core.functions`)
A decorator-based registry (`@register`) maps string names to Python functions. These functions modify the `GameState` and return string feedback.

## 4. Data Flow

1.  **Initialization:** `run.py` starts the FastAPI server and opens the `pywebview` window.
2.  **Game Load:** The user selects a game. The server initializes a `World` instance for that game path.
3.  **Interaction:**
    -   The frontend sends an action (e.g., "move north", "click button") to the API.
    -   The API routes this to the engine.
    -   The engine processes the action, updates `GameState`, and renders the new view.
    -   The view is returned as JSON/HTML to the frontend.

## 5. Extensibility

-   **New Functions:** Add new Python functions in `engine/core/functions.py` and decorate them with `@register`.
-   **New Content Types:** Update `World.load_world` to parse new folders (e.g., `spells/`).

## 6. Future Roadmap

-   **Save/Load System:** Serialize `GameState` to JSON/Pickle.
-   **Combat System:** Turn-based logic hookable via `actions`.
-   **Plugin System:** Allow Python plugins in game folders.

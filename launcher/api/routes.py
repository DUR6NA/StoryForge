from fastapi import APIRouter, HTTPException, Body
import os
import toml
from typing import List, Optional, Dict
from pydantic import BaseModel
from engine.renderer.game_loop import GameEngine

router = APIRouter()

# Global store for active game sessions
# game_id -> GameEngine instance
ACTIVE_SESSIONS: Dict[str, GameEngine] = {}

class GameMetadata(BaseModel):
    id: str
    title: str
    author: str
    version: str
    description: str
    thumbnail: Optional[str] = None
    path: str

class ActionPayload(BaseModel):
    type: str
    action: Optional[str] = None
    text: Optional[str] = None

@router.get("/library", response_model=List[GameMetadata])
async def get_library():
    games = []
    library_path = "library"
    if not os.path.exists(library_path):
        return []
    
    for item in os.listdir(library_path):
        game_path = os.path.join(library_path, item)
        if os.path.isdir(game_path):
            world_file = os.path.join(game_path, "world.toml")
            title = item
            author = "Unknown"
            version = "1.0"
            description = "No description."
            thumbnail = None
            
            if os.path.exists(world_file):
                try:
                    data = toml.load(world_file)
                    meta = data.get("metadata", {})
                    title = meta.get("title", title)
                    author = meta.get("author", author)
                    version = meta.get("version", version)
                    description = meta.get("description", description)
                    thumbnail = meta.get("thumbnail")
                except:
                    pass
            
            games.append(GameMetadata(
                id=item,
                title=title,
                author=author,
                version=version,
                description=description,
                thumbnail=thumbnail,
                path=game_path
            ))
    return games

@router.get("/game/{game_id}/state")
async def get_game_state(game_id: str):
    if game_id not in ACTIVE_SESSIONS:
        # Initialize session
        game_path = os.path.join("library", game_id)
        if not os.path.exists(game_path):
            raise HTTPException(status_code=404, detail="Game not found")
        
        try:
            engine = GameEngine(game_path)
            ACTIVE_SESSIONS[game_id] = engine
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load game: {str(e)}")
            
    return ACTIVE_SESSIONS[game_id].get_render_data()

@router.post("/game/{game_id}/action")
async def post_game_action(game_id: str, payload: ActionPayload):
    if game_id not in ACTIVE_SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")
        
    engine = ACTIVE_SESSIONS[game_id]
    result = engine.handle_action(payload.type, payload.action)
    return result

@router.post("/game/{game_id}/save")
async def save_game(game_id: str, slot: str = "default"):
    if game_id not in ACTIVE_SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")
    
    engine = ACTIVE_SESSIONS[game_id]
    result = engine.save_state(slot)
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result.get("message", "Failed to save"))
    return result

@router.post("/game/{game_id}/load")
async def load_game(game_id: str, slot: str = "default"):
    if game_id not in ACTIVE_SESSIONS:
        # Create a new session for this game first
        game_path = os.path.join("library", game_id)
        if not os.path.exists(game_path):
            raise HTTPException(status_code=404, detail="Game not found")
        
        try:
            engine = GameEngine(game_path)
            ACTIVE_SESSIONS[game_id] = engine
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load game: {str(e)}")
    
    engine = ACTIVE_SESSIONS[game_id]
    result = engine.load_state(slot)
    if result["status"] == "error":
        raise HTTPException(status_code=404, detail=result.get("message", "Failed to load"))
    return result

@router.get("/game/{game_id}/saves")
async def list_saves(game_id: str):
    if game_id not in ACTIVE_SESSIONS:
        # Create a session to list saves
        game_path = os.path.join("library", game_id)
        if not os.path.exists(game_path):
            raise HTTPException(status_code=404, detail="Game not found")
        
        try:
            engine = GameEngine(game_path)
            ACTIVE_SESSIONS[game_id] = engine
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load game: {str(e)}")
    
    engine = ACTIVE_SESSIONS[game_id]
    return {"saves": engine.list_saves()}

@router.get("/game/{game_id}/export")
async def export_save(game_id: str, slot: str = "default"):
    """Export save data as JSON for the user to download."""
    if game_id not in ACTIVE_SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")
    
    engine = ACTIVE_SESSIONS[game_id]
    return engine.get_save_data(slot)

@router.post("/game/{game_id}/import")
async def import_save(game_id: str, save_data: dict = Body(...)):
    """Import save data from a user-uploaded JSON file."""
    if game_id not in ACTIVE_SESSIONS:
        game_path = os.path.join("library", game_id)
        if not os.path.exists(game_path):
            raise HTTPException(status_code=404, detail="Game not found")
        
        try:
            engine = GameEngine(game_path)
            ACTIVE_SESSIONS[game_id] = engine
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load game: {str(e)}")
    
    engine = ACTIVE_SESSIONS[game_id]
    result = engine.import_save_data(save_data)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to import"))
    return result

@router.delete("/game/{game_id}/save/{slot}")
async def delete_save(game_id: str, slot: str):
    """Delete a specific save slot."""
    saves_dir = "saves"
    save_path = os.path.join(saves_dir, f"{game_id}_{slot}.json")
    
    if not os.path.exists(save_path):
        raise HTTPException(status_code=404, detail="Save not found")
    
    try:
        os.remove(save_path)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

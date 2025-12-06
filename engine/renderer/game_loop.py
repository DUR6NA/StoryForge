from engine.core.state import GameState
from engine.core.world import World
from engine.core.parser import GameParser
import time
import json
import os

class GameEngine:
    def __init__(self, game_path):
        self.game_path = game_path
        self.game_id = os.path.basename(game_path)
        self.world = World(game_path)
        self.state = GameState()
        self.state = GameState()
        self.parser = GameParser(self.state)
        self.functions = {}
        
        # Load Mod Scripts
        context = {
            "engine": self,
            "world": self.world,
            "state": self.state,
            "register_function": self.register_function
        }
        # Access mod_manager from world since it's initialized there
        if hasattr(self.world, 'mod_manager'):
            self.world.mod_manager.load_active_mod_scripts(context)
        
    def register_function(self, name, callback):
        """Register a custom function for mods to use."""
        self.functions[name] = callback

    def get_save_path(self, slot: str = "default") -> str:
        """Get the path to a save file for this game."""
        saves_dir = "saves"
        os.makedirs(saves_dir, exist_ok=True)
        return os.path.join(saves_dir, f"{self.game_id}_{slot}.json")
    
    def save_state(self, slot: str = "default") -> dict:
        """Save the current game state to a file."""
        save_path = self.get_save_path(slot)
        save_data = {
            "game_id": self.game_id,
            "timestamp": time.time(),
            "state": self.state.to_dict()
        }
        try:
            with open(save_path, "w", encoding="utf-8") as f:
                json.dump(save_data, f, indent=2)
            return {"status": "ok", "path": save_path}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def load_state(self, slot: str = "default") -> dict:
        """Load a game state from a file."""
        save_path = self.get_save_path(slot)
        if not os.path.exists(save_path):
            return {"status": "error", "message": "Save file not found"}
        try:
            with open(save_path, "r", encoding="utf-8") as f:
                save_data = json.load(f)
            self.state = GameState.from_dict(save_data.get("state", {}))
            self.parser = GameParser(self.state)  # Re-init parser with new state
            return {"status": "ok", "timestamp": save_data.get("timestamp")}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def get_save_data(self, slot: str = "default") -> dict:
        """Get the current save data for export."""
        return {
            "game_id": self.game_id,
            "timestamp": time.time(),
            "state": self.state.to_dict()
        }
    
    def import_save_data(self, save_data: dict) -> dict:
        """Import save data from an external source."""
        try:
            if save_data.get("game_id") != self.game_id:
                return {"status": "error", "message": "Save file is for a different game"}
            self.state = GameState.from_dict(save_data.get("state", {}))
            self.parser = GameParser(self.state)
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def list_saves(self) -> list:
        """List all save files for this game."""
        saves_dir = "saves"
        if not os.path.exists(saves_dir):
            return []
        saves = []
        for filename in os.listdir(saves_dir):
            if filename.startswith(f"{self.game_id}_") and filename.endswith(".json"):
                slot = filename[len(self.game_id) + 1:-5]  # Extract slot name
                save_path = os.path.join(saves_dir, filename)
                try:
                    with open(save_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    saves.append({
                        "slot": slot,
                        "timestamp": data.get("timestamp", 0),
                        "filename": filename
                    })
                except:
                    pass
        return sorted(saves, key=lambda x: x["timestamp"], reverse=True)
        
    def get_render_data(self):
        # 1. Get current location
        loc_id = self.state.current_location_id
        location = self.world.get_location(loc_id)
        
        if not location:
            return {
                "error": f"Location {loc_id} not found",
                "state": self.state.to_dict()
            }
            
        # 2. Parse Description
        # Check for time-based descriptions or dynamic ones
        description = location.get("description", "No description.")
        # If description is a dict (time based), pick best match
        if isinstance(description, dict):
            # TODO: Implement time/condition based description picking
            # For now, just pick 'default' or first key
            description = description.get("default", list(description.values())[0])
            
        parsed_description = self.parser.parse(description)
        
        # 3. Process Choices/Actions
        choices = []
        if "choices" in location:
            for choice in location["choices"]:
                # Check conditions
                if "condition" in choice:
                    # TODO: Evaluate condition
                    pass
                
                choices.append({
                    "text": self.parser.parse(choice.get("text", "Go")),
                    "action": choice.get("target"), # Could be location ID or function
                    "type": "travel" if choice.get("type") != "function" else "function"
                })
                
        # 4. Process NPCs in location
        npcs = []
        if "npcs" in location:
            for npc_id in location["npcs"]:
                npc = self.world.get_npc(npc_id)
                if npc:
                    npcs.append({
                        "id": npc_id,
                        "name": npc.get("name", npc_id),
                        "description": self.parser.parse(npc.get("description", "")),
                        # TODO: Add interaction options
                    })
                    
        return {
            "location": {
                "id": loc_id,
                "name": location.get("name", "Unknown"),
                "description": parsed_description,
                "image": location.get("image"),
                "choices": choices,
                "npcs": npcs
            },
            "state": self.state.to_dict()
        }

    def handle_action(self, action_type, payload):
        if action_type == "travel":
            self.state.current_location_id = payload
            return {"status": "ok"}
        elif action_type == "function":
            # Execute function
            # payload might be "give_gold 10"
            if not payload:
                return {"status": "error", "message": "No function specified"}
                
            parts = str(payload).split(" ")
            func_name = parts[0]
            args = parts[1:]
            
            if func_name in self.functions:
                try:
                    result = self.functions[func_name](*args)
                    return {"status": "ok", "result": result}
                except Exception as e:
                    return {"status": "error", "message": f"Function error: {str(e)}"}
            else:
                 return {"status": "error", "message": f"Unknown function: {func_name}"}
        return {"status": "error", "message": "Unknown action"}

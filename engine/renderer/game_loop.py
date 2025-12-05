from engine.core.state import GameState
from engine.core.world import World
from engine.core.parser import GameParser
import time

class GameEngine:
    def __init__(self, game_path):
        self.world = World(game_path)
        self.state = GameState()
        self.parser = GameParser(self.state)
        
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
            pass
        return {"status": "error", "message": "Unknown action"}

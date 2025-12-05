from typing import Dict, List, Any, Optional
from engine.core.time import GameTime

class GameState:
    def __init__(self):
        self.player = {
            "name": "Player",
            "gold": 0,
            "health": 100,
            "max_health": 100,
            "stats": {},  # str, dex, int, etc.
            "skills": {}, # cooking, combat, etc.
            "kinks": {},  # mature content
        }
        self.inventory: List[Dict[str, Any]] = [] # List of item objects
        self.flags: Dict[str, Any] = {} # Global flags
        self.relationships: Dict[str, int] = {} # NPC ID -> value
        self.quests: Dict[str, Dict[str, Any]] = {} # Quest ID -> {stage: int, completed: bool}
        self.time = GameTime()
        self.current_location_id = "start"
        self.history: List[str] = [] # Log of events
        
    def to_dict(self):
        return {
            "player": self.player,
            "inventory": self.inventory,
            "flags": self.flags,
            "relationships": self.relationships,
            "quests": self.quests,
            "time": self.time.to_dict(),
            "current_location_id": self.current_location_id,
            "history": self.history
        }

    @classmethod
    def from_dict(cls, data):
        state = cls()
        state.player = data.get("player", state.player)
        state.inventory = data.get("inventory", [])
        state.flags = data.get("flags", {})
        state.relationships = data.get("relationships", {})
        state.quests = data.get("quests", {})
        if "time" in data:
            state.time = GameTime.from_dict(data["time"])
        state.current_location_id = data.get("current_location_id", "start")
        state.history = data.get("history", [])
        return state

    def get_flag(self, key, default=None):
        return self.flags.get(key, default)

    def set_flag(self, key, value):
        self.flags[key] = value

    def has_item(self, item_id, count=1):
        found = 0
        for item in self.inventory:
            if item.get("id") == item_id:
                found += item.get("count", 1)
        return found >= count

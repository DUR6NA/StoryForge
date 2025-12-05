import os
import toml
from typing import Dict, Any

class World:
    def __init__(self, game_path: str):
        self.game_path = game_path
        self.metadata = {}
        self.locations = {}
        self.npcs = {}
        self.items = {}
        self.quests = {}
        
        self.load_world()

    def load_world(self):
        # Load world.toml
        world_file = os.path.join(self.game_path, "world.toml")
        if os.path.exists(world_file):
            data = toml.load(world_file)
            self.metadata = data.get("metadata", {})
            
        # Load Locations
        loc_path = os.path.join(self.game_path, "locations")
        if os.path.exists(loc_path):
            for f in os.listdir(loc_path):
                if f.endswith(".toml"):
                    data = toml.load(os.path.join(loc_path, f))
                    # Support multiple locations in one file or one per file
                    # If file has "id", treat as single object
                    # If file has keys that are IDs, treat as collection
                    if "id" in data:
                        self.locations[data["id"]] = data
                    else:
                        for k, v in data.items():
                            if isinstance(v, dict):
                                v["id"] = k # Ensure ID exists
                                self.locations[k] = v

        # Load NPCs
        npc_path = os.path.join(self.game_path, "npcs")
        if os.path.exists(npc_path):
            for f in os.listdir(npc_path):
                if f.endswith(".toml"):
                    data = toml.load(os.path.join(npc_path, f))
                    if "id" in data:
                        self.npcs[data["id"]] = data
                    else:
                        for k, v in data.items():
                            if isinstance(v, dict):
                                v["id"] = k
                                self.npcs[k] = v

        # Load Items
        item_path = os.path.join(self.game_path, "items")
        if os.path.exists(item_path):
            for f in os.listdir(item_path):
                if f.endswith(".toml"):
                    data = toml.load(os.path.join(item_path, f))
                    if "id" in data:
                        self.items[data["id"]] = data
                    else:
                        for k, v in data.items():
                            if isinstance(v, dict):
                                v["id"] = k
                                self.items[k] = v

        # Load Quests
        quest_path = os.path.join(self.game_path, "quests")
        if os.path.exists(quest_path):
            for f in os.listdir(quest_path):
                if f.endswith(".toml"):
                    data = toml.load(os.path.join(quest_path, f))
                    if "id" in data:
                        self.quests[data["id"]] = data
                    else:
                        for k, v in data.items():
                            if isinstance(v, dict):
                                v["id"] = k
                                self.quests[k] = v

    def get_location(self, loc_id):
        return self.locations.get(loc_id)

    def get_npc(self, npc_id):
        return self.npcs.get(npc_id)

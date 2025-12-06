import os
import toml
from typing import Dict, Any
from engine.mods.manager import ModManager

class World:
    def __init__(self, game_path: str):
        self.game_path = game_path
        self.metadata = {}
        self.locations = {}
        self.npcs = {}
        self.items = {}
        self.quests = {}
        
        self.mod_manager = ModManager()
        self.load_world()

    def load_world(self):
        # 1. Load Base Game Content
        self._load_content_from_path(self.game_path, is_base=True)
        
        # 2. Load Active Mods (in priority order)
        active_mods = self.mod_manager.get_active_mods()
        for mod in active_mods:
            self._load_content_from_path(mod.path)

    def _load_content_from_path(self, base_path: str, is_base: bool = False):
        # Load world.toml (only for base game usually, but mods might override metadata?)
        if is_base:
            world_file = os.path.join(base_path, "world.toml")
            if os.path.exists(world_file):
                data = toml.load(world_file)
                self.metadata = data.get("metadata", {})
        
        # Helper to load directory of TOML files
        def load_dir(dirname, target_dict):
            path = os.path.join(base_path, dirname)
            if os.path.exists(path):
                for f in os.listdir(path):
                    if f.endswith(".toml"):
                        try:
                            data = toml.load(os.path.join(path, f))
                            if "id" in data:
                                target_dict[data["id"]] = data
                            else:
                                for k, v in data.items():
                                    if isinstance(v, dict):
                                        v["id"] = k
                                        target_dict[k] = v
                        except Exception as e:
                            print(f"Error loading {f} in {path}: {e}")

        load_dir("locations", self.locations)
        load_dir("npcs", self.npcs)
        load_dir("items", self.items)
        load_dir("quests", self.quests)

    def get_location(self, loc_id):
        return self.locations.get(loc_id)

    def get_npc(self, npc_id):
        return self.npcs.get(npc_id)


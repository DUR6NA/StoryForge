
import os
import json
import toml
import shutil
from typing import List, Dict, Any
from pydantic import BaseModel

class ModMetadata(BaseModel):
    id: str
    name: str 
    version: str
    author: str
    description: str
    enabled: bool = False
    priority: int = 0
    path: str

class ModManager:
    def __init__(self, mods_dir: str = "engine/mods"):
        self.mods_dir = mods_dir
        self.config_path = "mods_config.json"
        self.mods: Dict[str, ModMetadata] = {}
        self.config = {}
        self.load_config()
        self.discover_mods()

    def discover_mods(self):
        if not os.path.exists(self.mods_dir):
            os.makedirs(self.mods_dir)
        
        # Reset mods list but keep config
        self.mods = {}
        
        for item in os.listdir(self.mods_dir):
            mod_path = os.path.join(self.mods_dir, item)
            if os.path.isdir(mod_path):
                mod_file = os.path.join(mod_path, "mod.toml")
                if os.path.exists(mod_file):
                    try:
                        data = toml.load(mod_file)
                        meta = data.get("metadata", {})
                        mod_id = item # Use folder name as ID
                        
                        # Get config state if exists
                        config_state = self.config.get(mod_id, {})
                        
                        self.mods[mod_id] = ModMetadata(
                            id=mod_id,
                            name=meta.get("name", meta.get("title", mod_id)),
                            version=str(meta.get("version", "1.0")),
                            author=meta.get("author", "Unknown"),
                            description=meta.get("description", ""),
                            enabled=config_state.get("enabled", False),
                            priority=config_state.get("priority", 0),
                            path=mod_path
                        )
                    except Exception as e:
                        print(f"Error loading mod {item}: {e}")

    def load_config(self):
        self.config = {}
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r") as f:
                    self.config = json.load(f)
            except:
                pass

    def save_config(self):
        # Update config from memory
        new_config = {}
        for mod_id, mod in self.mods.items():
            new_config[mod_id] = {
                "enabled": mod.enabled,
                "priority": mod.priority
            }
        # Preserve config for unloaded mods? Maybe not needed.
        with open(self.config_path, "w") as f:
            json.dump(new_config, f, indent=2)
        self.config = new_config

    def get_all_mods(self) -> List[ModMetadata]:
        # Return sorted by priority
        return sorted(list(self.mods.values()), key=lambda x: x.priority)

    def get_active_mods(self) -> List[ModMetadata]:
        active = [m for m in self.mods.values() if m.enabled]
        # Return sorted by priority ascending (load lower priority first, higher priority overwrites)
        return sorted(active, key=lambda x: x.priority)

    def toggle_mod(self, mod_id: str, enabled: bool):
        if mod_id in self.mods:
            self.mods[mod_id].enabled = enabled
            self.save_config()
            return True
        return False

    def set_priority(self, mod_id: str, priority: int):
        if mod_id in self.mods:
            self.mods[mod_id].priority = priority
            self.save_config()
            return True
        return False
        
    def delete_mod(self, mod_id: str):
        if mod_id in self.mods:
            try:
                shutil.rmtree(self.mods[mod_id].path)
                del self.mods[mod_id]
                self.save_config()
                return True
            except Exception as e:
                print(f"Error deleting mod: {e}")
                return False
        return False

    def install_mod_from_zip(self, zip_path: str):
        import zipfile
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # Check for mod.toml at root or in a subdir
                file_list = zip_ref.namelist()
                root_mod_toml = "mod.toml" in file_list
                
                if root_mod_toml:
                    # Extract to a new folder named after zip
                    mod_name = os.path.splitext(os.path.basename(zip_path))[0]
                    target_dir = os.path.join(self.mods_dir, mod_name)
                    if os.path.exists(target_dir):
                        shutil.rmtree(target_dir) # Overwrite
                    os.makedirs(target_dir)
                    zip_ref.extractall(target_dir)
                else:
                    # Maybe it's inside a folder?
                    # simple heuristic: find the first file named mod.toml
                    mod_toml_path = next((f for f in file_list if f.endswith("mod.toml")), None)
                    if mod_toml_path:
                        # Extract the parent folder of this mod.toml
                        base_folder = os.path.dirname(mod_toml_path)
                        mod_name = os.path.splitext(os.path.basename(zip_path))[0]
                        target_dir = os.path.join(self.mods_dir, mod_name)
                        if os.path.exists(target_dir):
                            shutil.rmtree(target_dir)
                        os.makedirs(target_dir)
                        
                        # Extract only files starting with base_folder
                        for member in file_list:
                            if member.startswith(base_folder):
                                # Remove base_folder from path when extracting
                                target_path = os.path.join(target_dir, os.path.relpath(member, base_folder))
                                source = zip_ref.open(member)
                                if member.endswith('/'):
                                    os.makedirs(target_path, exist_ok=True)
                                else:
                                    os.makedirs(os.path.dirname(target_path), exist_ok=True)
                                    with open(target_path, "wb") as target_file:
                                        shutil.copyfileobj(source, target_file)
                    else:
                        return False # No mod.toml found
                    
            self.discover_mods()
            return True
        except Exception as e:
            print(f"Error installing mod: {e}")
            return False

    def load_active_mod_scripts(self, context: Dict[str, Any]):
        """
        Load main.py from active mods and execute them with the given context.
        Context usually contains 'engine', 'world', 'state'.
        """
        active_mods = self.get_active_mods()
        for mod in active_mods:
            script_path = os.path.join(mod.path, "main.py")
            if os.path.exists(script_path):
                try:
                    # Execute script
                    with open(script_path, "r") as f:
                        code = f.read()
                    
                    # Create a new local scope for the mod
                    # We pass context as globals so they are accessible
                    # We also pass a special 'register_function' helper if needed, 
                    # but exposing 'engine' directly allows engine.register_function(...)
                    mod_scope = {**context, "mod_id": mod.id}
                    exec(code, mod_scope)
                    print(f"Loaded script for mod {mod.id}")
                except Exception as e:
                    print(f"Error loading script for mod {mod.id}: {e}")


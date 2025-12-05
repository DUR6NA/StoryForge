import random
from engine.core.state import GameState

# Registry of all available functions
# Each function takes (game_state, *args)

REGISTRY = {}

def register(name):
    def decorator(func):
        REGISTRY[name] = func
        return func
    return decorator

@register("give_gold")
def give_gold(state: GameState, amount):
    state.player["gold"] += int(amount)
    return f"Received {amount} gold."

@register("take_gold")
def take_gold(state: GameState, amount):
    state.player["gold"] = max(0, state.player["gold"] - int(amount))
    return f"Lost {amount} gold."

@register("add_item")
def add_item(state: GameState, item_id, count=1):
    # Check if item exists in inventory (stackable?)
    # For simplicity, just append for now or simple stacking
    count = int(count)
    for item in state.inventory:
        if item["id"] == item_id:
            item["count"] = item.get("count", 1) + count
            return f"Added {count}x {item_id}."
    
    # Need to look up item definition ideally, but here we just add the ID
    state.inventory.append({"id": item_id, "count": count})
    return f"Received {item_id}."

@register("remove_item")
def remove_item(state: GameState, item_id, count=1):
    count = int(count)
    for item in state.inventory:
        if item["id"] == item_id:
            if item["count"] >= count:
                item["count"] -= count
                if item["count"] <= 0:
                    state.inventory.remove(item)
                return f"Removed {count}x {item_id}."
    return "Item not found."

@register("set_flag")
def set_flag(state: GameState, key, value):
    # Try to convert value to int/bool if possible
    if str(value).lower() == "true": value = True
    elif str(value).lower() == "false": value = False
    elif str(value).isdigit(): value = int(value)
    
    state.set_flag(key, value)
    return ""

@register("remove_flag")
def remove_flag(state: GameState, key):
    if key in state.flags:
        del state.flags[key]
    return ""

@register("modify_skill")
def modify_skill(state: GameState, skill, amount):
    current = state.player["skills"].get(skill, 0)
    state.player["skills"][skill] = current + int(amount)
    return f"{skill} skill {'increased' if int(amount)>0 else 'decreased'}."

@register("modify_relationship")
def modify_relationship(state: GameState, npc_id, amount):
    current = state.relationships.get(npc_id, 0)
    state.relationships[npc_id] = current + int(amount)
    return f"Relationship with {npc_id} changed."

@register("start_sex_scene")
def start_sex_scene(state: GameState, scene_id):
    # This would likely trigger a UI state change or redirect
    # For now, we set a flag that the renderer can pick up
    state.set_flag("_current_scene", scene_id)
    return "[Scene Started]"

@register("travel_to")
def travel_to(state: GameState, location_id):
    state.current_location_id = location_id
    return f"Traveled to {location_id}."

@register("advance_time")
def advance_time(state: GameState, minutes):
    state.time.advance(int(minutes))
    return f"Time passed: {minutes}m."

@register("unlock_gallery")
def unlock_gallery(state: GameState, image_id):
    unlocked = state.get_flag("gallery_unlocked", [])
    if image_id not in unlocked:
        unlocked.append(image_id)
        state.set_flag("gallery_unlocked", unlocked)
    return "Gallery image unlocked!"

@register("add_quest_stage")
def add_quest_stage(state: GameState, quest_id, stage):
    if quest_id not in state.quests:
        state.quests[quest_id] = {"stage": 0, "completed": False}
    state.quests[quest_id]["stage"] = int(stage)
    return f"Quest updated: {quest_id}"

@register("complete_quest")
def complete_quest(state: GameState, quest_id):
    if quest_id not in state.quests:
        state.quests[quest_id] = {"stage": 0}
    state.quests[quest_id]["completed"] = True
    return f"Quest completed: {quest_id}"

@register("heal_player")
def heal_player(state: GameState, amount):
    state.player["health"] = min(state.player["max_health"], state.player["health"] + int(amount))
    return f"Healed {amount} HP."

@register("damage_player")
def damage_player(state: GameState, amount):
    state.player["health"] = max(0, state.player["health"] - int(amount))
    return f"Took {amount} damage."

@register("teleport")
def teleport(state: GameState, location_id):
    return travel_to(state, location_id)

@register("cheat_menu")
def cheat_menu(state: GameState):
    # UI trigger
    return ""

@register("open_console")
def open_console(state: GameState):
    # UI trigger
    return ""

def execute(name, state: GameState, *args):
    if name in REGISTRY:
        return REGISTRY[name](state, *args)
    return f"Error: Function {name} not found."

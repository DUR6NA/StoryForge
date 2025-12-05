# StoryForge Game Creation Guide

Welcome to StoryForge! This guide will walk you through creating your own interactive narrative game using the StoryForge engine.

## 1. Project Structure

Each game lives in its own folder within the `library/` directory. The structure is as follows:

```text
library/
  └── MyNewGame/
      ├── world.toml          # Main configuration file
      ├── locations/          # Location definitions
      │   └── tavern.toml
      ├── npcs/               # NPC definitions
      │   └── viktor.toml
      ├── items/              # Item definitions
      │   └── potion.toml
      └── quests/             # Quest definitions
          └── main_quest.toml
```

## 2. The World File (`world.toml`)

This is the entry point for your game. It defines global settings and the player's starting state.

```toml
title = "My Epic Adventure"
author = "Your Name"
version = "0.1"
starting_location = "village_square" # ID of the starting location
default_theme = "fantasy"

[time]
ticks_per_minute = 15
start_date = "2025-01-01 08:00"

[player.stats]
strength = 10
intelligence = 10
gold = 100
```

## 3. Creating Locations

Locations are defined in `.toml` files within the `locations/` folder. You can have multiple locations in one file or one per file.

```toml
# locations/village.toml

[village_square]
name = "Village Square"
image = "assets/locations/square.jpg"
description = "A bustling square with a fountain in the center."

[village_square.exits]
north = "tavern"
east = "blacksmith"

[village_square.actions]
drink_water = "heal_player 5; speak('You drink from the fountain.')"
```

## 4. Creating NPCs

NPCs live in the `npcs/` folder.

```toml
# npcs/blacksmith.toml

name = "Garrick"
portrait = "assets/portraits/garrick.png"
personality = "gruff, hardworking"

# Simple schedule: "day_range location_id"
schedule = ["monday-friday blacksmith_shop", "saturday-sunday tavern"]

[relationship]
trust = 0

[[sex_scenes]]
id = "private_time"
requires = "trust >= 50"
actions = "start_sex_scene('garrick_private')"
```

## 5. Scripting and Logic

StoryForge uses a flexible scripting system based on Jinja2. You can use logic inside `actions`, dialogues, and conditions.

### Syntax
- **Standard:** `{{ give_gold(50) }}`
- **Simplified:** `{{ give_gold 50 }}`

### Common Functions
- `travel_to(location_id)`: Move the player.
- `give_gold(amount)` / `take_gold(amount)`: Manage currency.
- `add_item(item_id, count)` / `remove_item(item_id, count)`: Manage inventory.
- `set_flag(key, value)`: Set a game flag.
- `modify_skill(skill_name, amount)`: Change player stats.
- `modify_relationship(npc_id, amount)`: Change NPC relationship values.
- `speak(text)`: Display text to the player (implied in some contexts).

### Example: Complex Action
```toml
[tavern.actions]
buy_ale = """
{% if player.gold >= 5 %}
    {{ take_gold 5 }}
    {{ add_item 'ale' }}
    {{ speak('You buy a cold ale.') }}
{% else %}
    {{ speak('You cannot afford that.') }}
{% endif %}
"""
```

## 6. Testing Your Game

1.  Run `run.py` to start the StoryForge launcher.
2.  Select your game from the list.
3.  Click "Play" to launch the engine.

## 7. Advanced Features

-   **Time System:** The world advances automatically. NPCs move according to their schedules.
-   **Quests:** Define quest stages and update them using `add_quest_stage`.
-   **Gallery:** Unlock images using `unlock_gallery`.

Happy forging!

# StoryForge Development Log


## Session Summary: Editor Expansion & Project Loader
**Date**: December 8, 2024

### 1. Major Changes
*   **Editor Completed**:
    *   Implemented fully functional **Characters**, **Items & Quests**, and **Variables** tabs.
    *   Added dynamic forms supporting custom properties via JSON textareas (e.g., Character Stats, Item Effects).
    *   Replaced the native `prompt()` for project creation with a custom, styled Modal for a cohesive UX.
*   **Project Management**:
    *   **Auto-Library Integration**: New projects are now instantly added to the "Library" tab upon creation.
    *   **Dynamic Loading**: The Game Runtime (`game.html`) now accepts a `?project=Name` query parameter.
    *   **Data Adapter**: Implemented an adapter in `game.html` to convert the **Editor Data Format** (Arrays of objects) into the **Engine Core Format** (Maps of objects) on the fly.
*   **Engine Robustness**:
    *   Updated `core.js` to handle empty or new projects gracefully without crashing.
    *   Added fallback logic to display a "No scenes found" message for new projects instead of a blank screen.

### 2. Technical Learnings
*   **IPC Payload Limits**: Passing huge JSON objects via URL parameters is risky. We opted for passing the `projectName` string and letting the renderer process request the full data via IPC (`invoke('load-project-file')`). This keeps the launch command clean and performant.
*   **Data Structure Mismatch**: The Editor benefits from `Arrays` (easy to iterate/render lists), but the Game Engine requires `Objects/Maps` (O(1) lookups by ID). Instead of forcing one format, we implemented a conversion layer at load time. This allows the Editor to be "List-first" and the Engine to be "Lookup-first".
*   **Editor Safety**: Allowing users to input raw JSON for properties (`stats`, `effects`) provides infinite flexibility but requires careful error handling. `JSON.parse` is wrapped in try-catch blocks to prevent one typo from crashing the editor.

### 3. Current State
*   **Editor**: Fully capable of creating Scenes, Locations, Characters, Items, and Variables.
*   **Launcher**: Seamlessly creates, lists, and launches specific projects.
*   **Runtime**: Can load both the hardcoded "Demo" and dynamic user-created projects.

## Session Summary: Fixing the Demo & UI Overhaul
**Date**: December 8, 2024

### 1. Major Changes
*   **Engine Core Fixes**:
    *   Resolved a critical initialization bug where `currentLocation` defaulted to "home" instead of `null`, causing the demo game (starting at "bedroom") to fail loading.
    *   Updated `loadGame` logic to correctly map legacy `currentScene` data to the new location system.
*   **UI Architecture Overhaul**:
    *   Moved from a standard block layout to a **CSS Grid** (`100vh`) layout for the main game window.
    *   Redesigned the Dialogue Overlay using **Flexbox** positioning. This fixed issues where text boxes were cut off or floated incorrectly on different screen sizes.
    *   Implemented `pointer-events` logic: `none` for the overlay container (to allow clicking scene elements) but `auto` for the dialogue box itself.
*   **Feature Integration**:
    *   Added a **Tabbed Sidebar** for Inventory, Skills, Quests, Relationships, and Gallery.
    *   Integrated the **Paperdoll System**: Characters now render with layered images (Body, Clothes, Hair).
    *   Added **Toast Notifications** for non-intrusive feedback ("Item Added", "Relationship Changed").

### 2. Technical Learnings
*   **CSS Grid vs. Flexbox**: For full-screen applications like a game engine, `100vh` Grid layouts are superior to standard flow layouts because they prevent accidental scrolling and ensure specific panels (like the sidebar) always occupy the correct space.
*   **Debug Visibility**: When UI elements seem "invisible" despite existing in the DOM, using explicit high-contrast borders (`border: 5px solid red`) and logging `getBoundingClientRect()` is the fastest way to diagnose collapsed containers or zero-height parents.
*   **Event-Driven UI**: Decoupling the UI from the logic using Custom Events (`window.dispatchEvent(new CustomEvent('sf-sceneChanged'))`) made it significantly easier to debug. We could verify the *event* was firing even when the *rendering* was broken.
*   **Electron Security**: Encountered CSP (Content Security Policy) warnings. While currently disabled for development, future production builds will need strict CSP headers for security.

### 3. Current State
*   **The Demo ("The Awakening")**: Fully playable. The player can wake up, dress up (paperdoll change), check inventory/stats, and navigate scenes.
*   **Stability**: The layout is now robust against window resizing.
*   **Next Steps**: Focus on the Editor interface and expanding the "Action" system for more complex interactions (jobs, crafting).

## Session Summary: Visual Action Editor
**Date**: December 8, 2024

### 1. Major Changes
*   **Visual Choice Editor**:
    *   Replaced the complex raw JSON input for Scene Choices with a user-friendly Visual Editor.
    *   Implemented "Action Templates" for common tasks:
        *   **Navigate**: Simple scene switching.
        *   **Acquire Item**: Dropdown selection of existing items + quantity.
        *   **Edit Stat**: Input for stat name and value.
        *   **Edit Relation**: Dropdown for NPCs and value change.
        *   **Custom**: Fallback for advanced scripting.
    *   Added a Modal interface for editing choices to keep the main view clean.
*   **Engine Action Expansion**:
    *   Updated `core.js` to natively support `addItem`, `removeItem`, `modifyStat`, `modifySkill`, and `modifyRel` actions directly from choices.
    *   Refactored `handleChoice` to allow actions to chain into navigation (e.g., "Take Sword" -> Adds Item -> Navigates to "Taking Sword" scene).

### 2. Technical Learnings
*   **Editor-Engine Synergy**: By determining the core actions the Engine supports (`core.js`), we could rigidly define the "Templates" in the Editor. This prevents the user from creating invalid actions that the engine ignores.
*   **Hybrid Data Entry**: We kept the "Raw JSON" textarea available and synced it with the Visual Editor. This offers the best of both worlds: ease of use for beginners (Visual) and speed/power for power-users (Raw JSON).
*   **Dynamic Form Generation**: Using a `select` element to trigger a re-render of form inputs (`updateChoiceTemplateFields`) allows a single modal to handle vastly different types of data without visual clutter.

### 3. Current State
*   **Editor**: Now supports creating complex game logic (item rewards, stat checks) without writing a single line of JSON code.

## Session Summary: Merging Scenes & Locations - Unified Editor
**Date**: December 8, 2024

### 1. Major Changes
*   **Architecture Refactor (Scenes -> Locations)**:
    *   Deprecated the concept of "Scenes" as a separate entity.
    *   Promoted **Locations** to be the primary unit of gameplay. A Location now holds all data previously split between the two:
        *   **Narrative**: Text content and dialogue.
        *   **Logic**: Choices, actions, and navigation.
        *   **Visuals**: Background images (with day/night variants).
*   **Data Migration**:
    *   Updated the standard game data structure in `data.json`.
    *   Implemented an **Auto-Adapter** in `game.html` (Runtime) that detects legacy projects using the "story/scenes" array and automatically merges them into the "locations" map at runtime. This ensures old saves/projects don't break immediately.
*   **Editor Overhaul**:
    *   **Unified Tab**: Removed the "Story" tab. All narrative and flow editing now happens inside the **Locations** tab.
    *   **Features Ported**: The Visual Choice Editor and text management tools were successfully ported to the Location Editor form.

### 2. Technical Learnings
*   **Simplification of Mental Model**: treating the game world as a graph of "Locations" (nodes) is far more intuitive than managing two parallel lists ("Scenes" for flow, "Locations" for maps). It removes the question "Do I make a scene for this or a location?". Now, everything is a location.
*   **Runtime Adaptation vs. Static Migration**: We chose to implement a Runtime Adapter (`game.html`) rather than writing a script to permanently rewrite user files. This is safer during development as it's non-destructive. If the new format proves stable, we can write a permanent migration tool later.
*   **O(1) Data Structures**: Moving from an Array of Scenes (Editor default) to a Map of Locations (Engine default) significantly simplifies the core engine logic `gotoLocation(id)`.

### 3. Current State
*   **Engine**: Runs entirely on the new "Location" system.
*   **Editor**: Simplified interface. Users create a Location and immediately add choices/actions to it.

## Session Summary: Secure Project Deletion
**Date**: December 8, 2024

### 1. Major Changes
*   **Secure Deletion Workflow**:
    *   Added a high-friction deletion process to preventing accidental data loss of game projects.
    *   **Backend**: Implemented `handle('delete-project', ...)` in `main.js`. Crucially, it includes a security check (`startsWith(GAMES_DIR)`) to ensure malicious acts cannot delete system files.
    *   **Frontend**: Added a "Trash Bin" icon to game cards in the Library and Editor.
    *   **Confirmation Modal**: Created a two-step confirmation UI:
        1.  **Hold-to-Confirm**: User must hold a button for 2 seconds (visualized by a progress bar).
        2.  **Type-to-Confirm**: After unlocking, the user must explicitly type "delete" to enable the final button.

### 2. Technical Learnings
*   **Friction by Design**: Sometimes UI needs to be *difficult* to use. By adding a 2-second hold and a typing requirement, we force the user to switch from "System 1" (fast, intuitive) thinking to "System 2" (slow, deliberate) thinking, dramatically reducing accidental deletions.
*   **Path Traversal Prevention**: When implementing file deletion based on user input (even if the user is the owner), it is critical to validate that the target path resides within the intended sandbox (`GAMES_DIR`).

### 3. Current State
*   **Safety**: Projects can now be deleted from the launcher, but accidental clicks are effectively impossible.

## Session Summary: Visual Upgrade & Image Logic Refactor
**Date**: December 9, 2024

### 1. Major Changes
*   **Dynamic Asset Fixes**:
    *   Corrected file extension mismatches (.jpg vs .png) in game data that were causing broken images.
    *   Updated the Engine Core (core.js) to support dynamic background resolution based on in-game time (Dawn, Day, Dusk, Night), falling back to 'default' logic intelligently.
*   **Scene Layout Redesign**:
    *   **Img-First Approach**: Refactored the scene display to use a focused <img> element instead of a full-screen background-image.
    *   **Aspect Ratio Discipline**: The scene image is now constrained to a maximum width (800px) matching the dialogue box, with height: auto. This prevents the 'zoomed in' cropping effect of background-size: cover and ensures artwork is seen exactly as intended.
    *   **Clean Aesthetics**: Removed complex background blurring effects in favor of a clean, dark backdrop that keeps user focus on the art and the text.

### 2. Technical Learnings
*   **Img Tag vs Background CSS**: For 'content' images (like a specific location view where details matter), <img> tags are superior to background-image.
    *   *Why?* Background-size: cover is great for filling space but inevitably crops content. <img> guarantees the entire image is visible (object-fit: contain logic), which is critical for narrative games where visual clues might be hidden by a crop.
*   **Asset Management**: Mismatched file extensions are the #1 silent killer of game assets. Future editor improvements should include an 'Asset Validator' that checks if referenced files actually exist on disk.
*   **Layout Alignment**: Aligning the visual center of the game (the image) with the interactive center (the text/choices) creates a vertical stack that is easier for the eye to scan than a spread-out layout.

### 3. Current State
*   **Visuals**: Location images now display crisply, fully uncropped, and change dynamically based on the in-game clock.
*   **Stability**: The renderer now robustly handles relative paths for assets located within project folders.

## Session Summary: NPC Interaction Modal & UI Polish
**Date**: December 9, 2024

### 1. Major Changes
*   **NPC Interaction Modal Overhaul**:
    *   **New Layout**: Implemented a comprehensive **two-column modal design**.
        *   **Left Column**: Dedicated to the NPC's identity, featuring a fixed-size image container (250px), an Attributes/Stats box, and a Quest log placeholder.
        *   **Right Column**: Focused on interaction, containing the dialogue text area and a scrollable list of styled choice buttons.
    *   **Visual Refinements**:
        *   **Choice Buttons**: Redesigned as sleek, block-level elements with left-aligned text, subtle arrow indicators (`›`) and refined hover states (`#2a2a2a`).
        *   **Sizing**: Explicitly set button height to `auto` and disabled flex-grow to prevent them from awkwardly stretching to fill vertical space.
    *   **Functional Fixes**:
        *   **Close Button**: Exposed the `closeNPCInteraction` function to the global `window` scope, fixing the bug where the "X" button was unresponsive.
        *   **Stats Visibility**: Constrained the NPC image height to 250px to ensure the Stats box below it remains visible without requiring immediate scrolling.
*   **Editor Enhancement**:
    *   Added a specific **"NPC Interact"** action type to the Visual Choice Editor, allowing creators to easily link choices to the new modal system.

### 2. Technical Learnings
*   **Modal Scope Management**: When using inline `onclick` handlers in HTML injected via JavaScript, the referenced functions MUST be attached to the global `window` object. Defining them inside a `type="module"` script or a closure makes them inaccessible to the HTML element.
*   **Flexbox "Stretching"**: By default, Flexbox items stretch to fill the cross-axis. For a list of buttons, this often looks wrong (buttons becoming massive). Setting `align-items: flex-start` on the container or `height: auto` + `flex: 0 0 auto` on the items is necessary to maintain their natural size.
*   **Space Management**: In a modal with fixed height (e.g., `85vh`), vertical space is precious. Unconstrained images (`height: auto` or `flex: 1`) can aggressively consume space, pushing critical information (like stats) off-screen. Setting fixed heights for visual assets ensures information density remains balanced.

### 3. Current State
*   **NPC System**: Fully functional interaction loop. Players can click an NPC choice -> Open Modal -> See Name/Image/Stats -> Choose options -> Close.
*   **UI**: The dark-themed, professional aesthetic is consistent across the main game view and the new modal.

## Session Summary: Economy System & Project Settings
**Date**: December 10, 2024

### 1. Major Changes
*   **Custom Economy System**:
    *   **Editor**: Introduced a dedicated **Economy Tab** allowing creators to define custom currencies (e.g., Gold, Credits, Gems) with unique symbols and descriptions.
    *   **NPC Shops**: Updated the Character Editor to allow merchants to accept specific currencies. This enables complex economies (e.g., a "Black Market" vendor accepting only "Dark Tokens").
    *   **Game Engine**: The Player State (`core.js`) now features a **Multi-Currency Wallet**. The Sidebar UI displays all non-zero currencies dynamically.
    *   **Shop UI**: The in-game Shop Modal now adapts to the vendor's chosen currency, displaying prices and player balance in that specific unit.
*   **Project Customization**:
    *   **Settings Editor**: Added a new **Settings Tab** to the launcher. Creators can now set the Game Title, Version, and Menu Background Image.
    *   **Runtime Integration**: The game engine now respects these settings, dynamically updating the Start Menu title and version on load.
*   **Code Architecture**:
    *   **Wallet Logic**: Refactored `buyItem` and `addMoney` to support a `currencyId` parameter, defaulting to 'default' (standard money) for backward compatibility.
    *   **Observer Pattern**: Added `sf-walletChanged` and `sf-moneyChanged` events to keep the UI in sync with the complex state changes of multiple currencies.

### 2. Technical Learnings
*   **Backward Compatibility**: By defaulting the new `currencyId` parameter to `'default'` in all core functions, we ensured that all existing game logic (which assumes a single currency) remained functional without requiring a rewrite of old save files or scripts.
*   **UI Scalability**: Displaying a "Wallet" of potential infinite currencies requires careful UI design. We opted to only render currencies with a non-zero balance to keep the interface clean, while using tooltips to show full names.
*   **Scope Injection**: Overriding core window functions (`openShop`) before the main `init()` sequence allows us to inject sophisticated logic (like multi-currency lookups) without cluttering the initial `game.html` template.

### 3. Current State
*   **Economy**: Fully functional multi-currency support.
*   **Customization**: Games can now have their own identity (Title/Version).

## Session Summary: Graph Connection Logic & Visuals
**Date**: December 29, 2024

### 1. Major Changes
*   **Connection Logic Overhaul**:
    *   **Stable State Cycling**: Refactored `toggleConnectionDirection` to use a consistent cycling order (`A->B` -> `B->A` -> `Bidirectional` -> `A->B`). By sorting node IDs before processing, the cycle remains predictable regardless of which direction the user originally clicked.
    *   **Helpers**: Introduced `removeChoice` and updated `addChoice` (supporting specific port indices) to streamline connection management.
    *   **Bidirectional Logic**: Fixed issues where bidirectional connections were not correctly identified or persisted, ensuring the state machine can reliably reach state 3 (`A=B`).

*   **Visual Enhancements**:
    *   **Iconography**: Replaced the double-arrow icon with an equals sign (`=`) for clear, distinct representation of bidirectional connections.
    *   **Directional Arrows**: Ensured one-way connection arrows correctly point left or right based on the flow, handling cases where nodes are positioned right-to-left.
    *   **Visual Deduplication**: Updated `drawConnections` to prevent "ghosting" or double-drawing of bidirectional links. The renderer now skips the reverse entry of a bidirectional pair, drawing a single clean line and badge.
    *   **Port Awareness**: The ghost creation line now snaps to the correct side (Left/Right) of the source node based on mouse proximity, providing better feedback during the creation process.

### 2. Technical Learnings
*   **Visual vs. Logical Representation**: A graph connection often exists as two separate data entries (Node A has a choice to Node B, Node B has a choice to Node A). However, visually, this is a distinct "Bidirectional Connection". Rendering it as two overlapping lines creates ugly visual artifacts (z-fighting, aliasing). The solution is to filter the render loop: if `A <-> B` exists, only render it once (e.g., when processing A).
*   **State Machine Stability**: When cycling through N states (A->B, B->A, Both), relying on "current source" vs "current target" is flaky because the user might click the line from either perspective. Sorting the nodes by ID (`min(A,B)` and `max(A,B)`) creates a canonical reference frame, making the state transitions deterministic.

### 3. Current State
*   **Graph Editor**: Connections are now robust. Users can intuitively toggle directions, create bidirectional links, and the visual feedback is clean and accurate.

## Session Summary: Save System Bug Fix & Custom Prompt Modal
**Date**: December 30, 2024

### 1. Major Changes
*   **Critical Bug Fix - Save Functionality**:
    *   **Root Cause Identified**: The native JavaScript `prompt()` function is **not supported in Electron**. When users clicked Save, the game would silently fail because `prompt()` throws an error in Electron's renderer process.
    *   **Solution**: Implemented a **Custom Prompt Modal** (`#custom-prompt-modal`) as a drop-in replacement for the native `prompt()`.
    *   **Updated Functions**: Refactored `saveGameToSlot()` and `onOverwriteSlot()` to use the new `customPrompt()` function which returns a Promise.

*   **Game Startup Fix**:
    *   **Bug**: Projects without Character Creation enabled (e.g., The Wilsons, The Afterlife) would show only a background with no UI after clicking "New Game".
    *   **Cause**: The `startGame()` function was hiding the start menu but never calling `toggleSceneVisibility(true)` to reveal the game UI when character creation was disabled.
    *   **Fix**: Added `toggleSceneVisibility(true)` call in the non-character-creation branch of `startGame()`.

*   **Glass Mode Cleanup**:
    *   **Removed External Dependency**: Deleted the hardcoded Unsplash background image URL from `body.glass-mode` in `style.css`. This was causing an unexpected "trees and mountains" background to appear.
    *   **New Behavior**: Glass mode now uses a transparent background, allowing the theme's gradient or canvas effects to show through cleanly.

*   **Custom Prompt Modal Features**:
    *   **Z-Index Management**: Set `z-index: 20000` on the prompt modal to ensure it appears above the save-load-modal (`z-index: 10001`).
    *   **Modal Stacking**: When the prompt opens, the save-load-modal is hidden (`visibility: hidden`) to prevent visual clutter, then restored on close.
    *   **Event Handling**: Used `addEventListener` instead of direct property assignment for reliable keyboard (Enter/Escape) and button click handling.
    *   **Backdrop Click**: Clicking outside the prompt box (on the dark overlay) cancels the prompt.
    *   **Scene Visibility**: The prompt now calls `toggleSceneVisibility(false)` when opening and `toggleSceneVisibility(true)` when closing for better contrast.

*   **Scene Visibility Fix (Session 2)**:
    *   **Bug**: When opening the Save modal and then the name prompt, the main game scene would become visible behind the save modal after the prompt closed.
    *   **Root Cause**: The `customPrompt()` cleanup function was always calling `toggleSceneVisibility(true)`, restoring scene visibility even when the save-load modal was still open.
    *   **Solution**: 
        *   Track whether the scene was already hidden before the prompt opened.
        *   Track whether the save-load modal is still open when the prompt closes.
        *   Only restore scene visibility if BOTH conditions are met: scene wasn't hidden before AND save-load modal is closed.

*   **Pointer Events & Focus Improvements**:
    *   **Bug**: The input field in the custom prompt modal was not receiving focus automatically, requiring users to click on the window before typing.
    *   **Fixes Applied**:
        *   Added `pointer-events: auto` to the modal overlay, glass-content container, and input field.
        *   Added `cursor: text` to the input field for proper visual feedback.
        *   Added `tabindex="0"` and `autofocus` attributes to the input.
        *   Wrapped the focus call in `requestAnimationFrame()` + `setTimeout(100ms)` to ensure DOM is fully rendered.
    *   **Button Hover Effects**: Added inline `onmouseover`/`onmouseout` handlers with transitions for Cancel and OK buttons.

### 2. Technical Learnings
*   **Electron API Limitations**: Browser APIs like `prompt()`, `confirm()`, and `alert()` are intentionally disabled or limited in Electron. Any interactive dialogs must be implemented as custom HTML/CSS modals with JavaScript event handling.
*   **Z-Index Wars**: When layering multiple modals (save-load, in-game menu, start menu, prompt), a clear hierarchy is essential. We established: Start Menu (9999) < Save-Load Modal (10001) < Custom Prompt (20000).
*   **Event Handler Cleanup**: Using `addEventListener` requires corresponding `removeEventListener` calls to prevent memory leaks and duplicate handlers. Storing handler references in named functions (e.g., `handleOk`, `handleCancel`) makes cleanup straightforward.
*   **Promise-Based Modals**: Wrapping a modal in a `new Promise()` that resolves when the user confirms/cancels provides a clean async/await API for the calling code: `const name = await customPrompt("Enter name:", "Default");`.
*   **Modal State Tracking**: When modals can open on top of other modals, it's critical to track the pre-existing state (was scene hidden? was another modal open?) and only restore what was changed when closing.
*   **Focus in Dynamically Shown Elements**: Calling `.focus()` immediately after removing a `hidden` class often fails because the browser hasn't rendered the element yet. Using `requestAnimationFrame()` followed by a short `setTimeout()` ensures the DOM paint cycle completes before attempting focus.
*   **Pointer Events Cascade**: In complex layered UIs with glassmorphism effects, `pointer-events: none` on decorative layers (glass-filter, glass-overlay, glass-specular) must be paired with explicit `pointer-events: auto` on interactive layers (glass-content, inputs, buttons).

### 3. Current State
*   **Save System**: Fully functional. Players can save games with custom names using the new prompt modal.
*   **Game Launch**: All projects (with or without character creation) now launch correctly.
*   **UI**: The custom prompt modal appears cleanly above other UI elements with proper keyboard and mouse interaction.
*   **Scene Visibility**: The game scene correctly stays hidden when the save modal is open, even after using the name prompt.

## Session Summary: Fix Game Window Exit Logic
**Date**: December 30, 2024

### 1. Major Changes
*   **Window Management Fix**:
    *   **Bug**: Clicking "Exit to Desktop" within a launched game window would incorrectly navigate the window URL to the launcher (`index.html`) instead of closing the application window. This resulted in a "launcher within a launcher" scenario.
    *   **Solution**: Since the game runs in its own Electron `BrowserWindow` (spawned by the launcher), the correct behavior is to close the window itself.
    *   **Backend Implementation**: Added a new IPC handler `close-game` in `main.js` that listens for the event and calls `.close()` on the sending window.
    *   **API Exposure**: Updated `preload.js` to expose `electronAPI.closeGame()`.
    *   **Frontend Integration**: Updated the "Exit to Desktop" button in the in-game menu (`game.html`) to trigger this new API instead of changing `location.href`.

### 2. Technical Learnings
*   **BrowserWindow vs. Navigation**: In a multi-window Electron app, treating windows like browser tabs (navigating URLs) is often incorrect. When a window's purpose is finished (like a game session), it should be destroyed/closed to free resources, rather than repurposed.
*   **IPC for Window Control**: Renderer processes (the web page) cannot directly close their host window for security reasons. They must signal the main process via IPC to request closure.

### 3. Current State
*   **UX**: The "Exit to Desktop" button now cleanly closes the game window, returning the user's focus to the primary launcher window which remains open in the background.

## Session Summary: Fix Game Theme Application
**Date**: December 31, 2024

### 1. Major Changes
*   **Game Launch Theme Fix**:
    *   **Bug**: Changing the theme in the launcher settings did not update the theme passed to the game upon launch. The game would launch with whatever theme was active when the library was first loaded.
    *   **Root Cause**: The "Launch" button's `onclick` handler was capturing the `theme` and `glass-mode` variables at the time of *render* (closure), not at the time of the *click*.
    *   **Solution**: Updated `loadGameLibrary` in `renderer.js` to fetch `localStorage.getItem('sf-theme')` and `'sf-glass-enabled'` *inside* the click handler function.

### 2. Technical Learnings
*   **Closures in Event Handlers**: When defining `onclick` handlers in a loop (like generating list items), using `const` variables defined outside the handler creates a closure that "freezes" that value. If the value (like a global setting) can change, the handler must explicitly re-fetch it when executed, rather than relying on the captured variable.

### 3. Current State
*   **Theme System**: Fully dynamic. Changing the theme in the settings tab immediately ensures that any game launched afterwards will respect the new theme choice.

## Session Summary: Light Theme & Game Layout Fixes
**Date**: December 31, 2024

### 1. Major Changes
*   **Theme Visibility Fixes**:
    *   **Dynamic Modal Backdrops**: Resolved an issue where "Light" and "Nature" themes appeared dark due to hardcoded black overlays in modals. Introduced a new CSS variable `--modal-backdrop` that allows themes to define their own overlay color (e.g., semi-transparent white for light themes).
    *   **Glass Mode Fallback**: Updated `.glass-container` to use a solid background color (`var(--bg-secondary)`) by default. This ensures that if "Liquid Glass" effects are disabled, the UI remains readable and doesn't blend into the dark background.
    *   **Transparent Start Menu**: Changed the Start Menu background to `transparent`, allowing the theme's wallpaper and gradient to fully show through.

*   **Game Layout Cleanup**:
    *   **UI Separation**: Modified `game.html` to hide the main game layout (Sidebars, HUD) by default (`display: none`).
    *   **Logic Update**: The game layout is now only revealed programmatically after the player clicks "New Game" and completes (or skips) Character Creation. This prevents the in-game UI from bleeding through the Start Menu background.

### 2. Technical Learnings
*   **Visual Hierarchy**: When using transparent or "Glass" UIs, what sits *behind* the element is just as important as the element itself. Hardcoded black backgrounds often break the illusion of light themes. Using CSS variables for overlay colors (`--modal-backdrop`) ensures consistency across all themes.
*   **State-Based UI Visibility**: Relying on z-index to hide elements (like putting a menu over the game HUD) often leads to visual clutter if the background is transparent. It is cleaner to explicitly toggle `display: none` on the "Game Layer" when the "Menu Layer" is active.

### 3. Current State
*   **Aesthetics**: Light and Nature themes now look bright and airy as intended.
*   **Polish**: The transition from Start Menu -> Character Creation -> Game is clean, with no overlapping UI elements.

## Session Summary: In-Game Settings & Walkthrough System
**Date**: January 1, 2026

### 1. Major Changes
*   **In-Game Settings Modal**:
    *   **Feature**: The "Settings" button in the in-game menu now opens a fully functional settings modal.
    *   **Theme Selection**: Implemented a visual theme grid displaying all 8 default themes (Forge, Light, Nebula, Cyberpunk, Nature, Midnight, Matrix, Starry Sky) plus any custom themes the user has created.
    *   **Real-Time Updates**: Selecting a theme instantly applies it to the game without requiring a restart or reload.
    *   **Glass Mode Toggle**: Added a checkbox to enable/disable the "Liquid Glass" effects in real-time.
    *   **Placeholder Controls**: Added volume slider and text speed dropdown for future expansion.
    *   **Open-Ended Architecture**: The modal structure is designed to easily accommodate additional settings categories in the future.

*   **Walkthrough Editor (Launcher)**:
    *   **New Editor Tab**: Added a "Walkthrough" tab to the editor sidebar.
    *   **Chapter Management**: Users can create, rename, and delete chapters.
    *   **Page System**: Each chapter supports multiple pages with tabbed navigation.
    *   **Content Editor**: Large textarea for writing walkthrough content with markdown-style image support (`![alt](path)`).
    *   **Image Insertion**: "Insert Image" button provides a guided workflow for adding screenshots.
    *   **Auto-Save**: Content is saved automatically when the user finishes editing.

*   **In-Game Walkthrough Viewer**:
    *   **Feature**: The "Walkthrough" button in the in-game menu now opens a comprehensive walkthrough viewer.
    *   **Chapter Sidebar**: Clickable list of chapters for quick navigation.
    *   **Content Rendering**: Displays text content with support for embedded images.
    *   **Navigation Controls**: Previous/Next buttons at the bottom with page indicators.
    *   **Keyboard Support**: Arrow keys navigate between pages, Escape closes the modal.
    *   **Graceful Fallback**: Displays a helpful message when no walkthrough has been created by the game developer.

*   **Data Structure**:
    *   **New Property**: Added `walkthrough` object to project data structure containing a `chapters` array.
    *   **Chapter Format**: Each chapter has a `title` and `pages` array.
    *   **Page Format**: Each page has a `content` string supporting plain text and markdown-style images.

### 2. Technical Learnings
*   **Modal Layering Strategy**: When creating modals that open from the in-game menu, hiding the parent menu (`in-game-menu`) while showing the child modal (`in-game-settings-modal`) prevents visual clutter. On close, re-showing the parent provides a natural "back" navigation feel.
*   **Theme Application Chain**: The in-game theme system reuses the existing `applyGameTheme()` function but also updates `localStorage` to persist the choice. This ensures consistency between the launcher and game settings.
*   **Markdown-Lite Parsing**: For the walkthrough system, we implemented a minimal markdown parser that only handles image syntax (`![alt](url)`) and line breaks. This keeps the implementation simple while providing essential rich content support.
*   **Keyboard Event Management**: Adding keyboard listeners (`keydown`) on modal open and removing them on close prevents event handler accumulation that could cause performance issues or unexpected behavior in long game sessions.
*   **Content Editor UX**: Using `onchange` instead of `oninput` for the textarea prevents excessive saves while still capturing user edits when they finish typing (on blur or tab away).

### 3. Current State
*   **Settings**: Players can now change themes and glass mode effects during gameplay, with changes persisting across sessions.
*   **Walkthrough**: Game creators have a full chapter/page-based editor, and players have an intuitive viewer with navigation controls.
*   **UI Consistency**: Both new modals follow the established glassmorphic design language of the application.

## Session Summary: Location Deletion System
**Date**: January 4, 2026

### 1. Major Changes
*   **Location Delete Functionality**:
    *   **List View**: Added a 🗑 delete button to each location item in the Locations tab list. The button appears on the right side of each item with a subtle opacity that increases on hover (turning red).
    *   **Graph View**: Added a delete button to each node in the graph editor, displayed as an "X" symbol in the bottom-left corner of each location card.
    *   **Editor Form**: Added a "🗑 Delete" button next to the "Update Location" button in the location editor form for deleting the currently selected location.
    *   **Confirmation Modal**: Implemented a dedicated confirmation modal (`#modal-delete-location`) that asks users to confirm before deletion. Displays the location name and warns that the action cannot be undone.

*   **Deletion Logic**:
    *   **Connection Cleanup**: When a location is deleted, all choices in other locations that reference the deleted location are automatically removed. This prevents orphaned navigation links.
    *   **Index Management**: The active location index is properly adjusted after deletion to prevent form state corruption.
    *   **Form Reset**: If the currently selected location is deleted, the editor form is cleared.

*   **Graph Editor Canvas Fixes**:
    *   **Path Management**: Fixed a critical bug where the delete button icon only appeared on one node. The root cause was missing `beginPath()` calls before `roundRect()` operations, causing canvas path accumulation across multiple node drawings.
    *   **Symbol Rendering**: Replaced the emoji-based trash icon (🗑) with a canvas-drawn "X" symbol. Canvas `fillText()` with emojis renders inconsistently across platforms; stroke-based shapes are reliable everywhere.
    *   **Path Closure**: Added `closePath()` calls after each shape definition to ensure proper path termination before fill/stroke operations.

*   **UI Updates**:
    *   Updated the Graph Controls tooltip to mention the delete button functionality.

### 2. Technical Learnings
*   **Canvas Path State**: The HTML Canvas 2D API maintains a "current path" that accumulates across drawing operations. Functions like `roundRect()` and `rect()` add to this path but don't start a new one. Without explicit `beginPath()` calls before each shape, subsequent `fill()` or `stroke()` calls will render ALL accumulated path segments, causing visual artifacts like shapes appearing on wrong nodes or not appearing at all.
*   **Emoji Rendering on Canvas**: While `fillText()` technically supports emoji characters, the rendering is highly inconsistent across browsers, operating systems, and even font configurations. For reliable cross-platform graphics, prefer native canvas drawing operations (lines, arcs, rectangles) over emoji text.
*   **Reference Cleanup**: When deleting entities that other entities reference (like locations referenced by navigation choices), it's critical to cascade the deletion by cleaning up those references. Failure to do so creates "dangling pointers" that cause errors when the engine tries to navigate to non-existent locations.
*   **Index Shifting**: When deleting items from an array by index, all subsequent items shift down. If you're tracking an "active item index", you must adjust it accordingly: if deleted item is before active, decrement active index; if deleted item IS active, reset to -1.

### 3. Current State
*   **Location Management**: Full CRUD (Create, Read, Update, Delete) operations are now available for locations.
*   **Graph Editor**: Nodes display a reliable delete button that works across all browsers and platforms.
*   **Data Integrity**: Deleting a location automatically cleans up all navigation references to it, preventing orphaned links.

## Session Summary: NPC Dialogue System Overhaul
**Date**: January 4, 2026

### 1. Major Changes
*   **Dialogue Response System - Complete Redesign**:
    *   **Parity with Location Choices**: The NPC dialogue response system now uses the exact same mechanisms as the Location Choices system. Dialogue responses can now trigger ALL the same actions:
        *   **Next Dialogue Node**: Continue to another dialogue node (new action type).
        *   **Navigate (Location)**: Move the player to a location.
        *   **Acquire Item**: Give the player an item with quantity.
        *   **Modify Stat**: Change player statistics.
        *   **Modify Relationship**: Change NPC relationship values.
        *   **Interact with NPC**: Open another NPC's interaction modal.
        *   **Modify Paperdoll**: Change character appearance layers.
        *   **Custom / Script**: Execute custom game logic.
    *   **Visual Response List**: Dialogue responses now display in the same format as Location Choices - showing the response text, action type label (in parentheses), and target (with arrow indicator).

*   **Node Limitations Section**:
    *   **Moved from Responses**: The "Options" functionality previously available at the response level has been reorganized into a "Node Limitations" section for each dialogue node.
    *   **Collapsible Panel**: Each dialogue node now has a collapsible "⚙ Node Limitations" details section.
    *   **Available Limitations**:
        *   **Visibility Condition**: A JS expression that determines if the node is available.
        *   **Hide if Unavailable**: A toggle to hide the node entirely if the condition is not met.
        *   **Max Uses**: Limit how many times this dialogue node can be accessed.

*   **Response Editor Modal**:
    *   **Unified Modal**: Dialogue responses now use the same modal as Location Choices but with context-appropriate labeling.
    *   **Action Template Selection**: Users can select from all available action types via dropdown.
    *   **Dynamic Fields**: The modal dynamically shows relevant fields based on the selected action type.
    *   **Target Label Updates**: The target field label updates dynamically ("Next Dialogue Node ID" vs "Target Location ID") based on the action type selected.

*   **New Action Type - "Next Dialogue Node"**:
    *   Added `next_node` as a new action type specifically for dialogue responses.
    *   When selected, the target field is labeled "Next Dialogue Node ID".
    *   The `next` property is used in the data structure (vs `target` for locations).

*   **UI/UX Improvements**:
    *   **Clearer Labeling**: Updated section description to clarify that responses can trigger "outcomes like navigation, items, stats, and more - just like Location Choices."
    *   **Consistent Styling**: Response items now have consistent padding, hover effects, and click-to-edit behavior.
    *   **Action Type Recognition**: The visual list shows action labels including the new types (Next Node, Paperdoll, Custom).

### 2. Technical Learnings
*   **Code Reuse Strategy**: By leveraging the existing Choice Editor modal for dialogue responses, we achieved feature parity without duplicating UI code. The modal's behavior is controlled by a `dataset.context` attribute that switches between 'scene' and 'dialogue' modes.
*   **Data Structure Flexibility**: Dialogue responses now support both `next` (for dialogue node navigation) and `target` (for location navigation), allowing a single response to either continue a conversation or take the player to a new location.
*   **Action Template System**: The unified action template system makes it trivial to add new action types in the future - they automatically become available in both Location Choices and Dialogue Responses.
*   **Separation of Concerns**: Moving "Limitations" to the node level (rather than the response level) provides clearer mental model: a Node is a piece of dialogue that may have conditions, a Response is an action the player can take.

### 3. Current State
*   **Feature Parity**: NPC dialogue responses now have identical capabilities to Location Choices.
*   **Data Structure**: Each dialogue node stores `id`, `text`, `options` (array of responses with full action data), and optionally `limitations` (condition, hideIfUnavailable, maxUses).
*   **Backward Compatibility**: Existing dialogue data continues to work; the new `limitations` property is optional.
*   **Editor UX**: Creating complex dialogue trees with items, stat changes, and location transitions is now fully supported through the visual editor.

## Session Summary: Critical Bug Fixes & Launcher Stability
**Date**: January 8, 2026

### 1. Major Changes
*   **Launcher Script Corruption Fix**:
    *   **Root Cause Identified**: A corrupted line in `renderer.js` was causing a `SyntaxError` that prevented the entire launcher from loading properly.
    *   **Symptoms**: Only one game appeared in the library, tabs didn't work, and multiple `ReferenceError: switchTab is not defined` errors appeared in the console.
    *   **Solution**: Identified and removed the corrupted line, restoring full launcher functionality.

*   **Character Encoding (Mojibake) Fixes**:
    *   **Issue**: Various UI elements displayed garbled characters (e.g., `ðŸ—'`, `â–²`, `Ã—`) instead of proper emojis and symbols due to character encoding mismatches.
    *   **Affected Areas**:
        *   Game Library cards (trash icon, folder icon, game controller icon)
        *   Project List cards in the Editor
        *   Theme editor buttons (×, ✎)
        *   Paperdoll Composer arrows
        *   Layer management up/down arrows
        *   Various action type labels throughout the editor
    *   **Solution**: Created cleanup scripts that identified and replaced over 30 instances of corrupted UTF-8 sequences with their correct Unicode characters or ASCII equivalents.

*   **External Resource Fix**:
    *   **Issue**: A hardcoded reference to `placeholder.com` for game card images was causing `net::ERR_NAME_NOT_RESOLVED` errors.
    *   **Solution**: Replaced with local styling using emoji icons, matching the dynamic card style.

*   **Dialogue Node Editor Modal Fix**:
    *   **Issue**: The "Requirements & Limitations" and "Outcomes & Effects" sections were visually overlaying the graph editor canvas, appearing as floating text.
    *   **Root Cause**: These details sections were placed outside the `modal-content` div in the HTML structure.
    *   **Solution**: Corrected the HTML structure by moving the sections inside the modal content container.

*   **Paperdoll Data Access Fix**:
    *   **Issue**: Double-clicking dialogue nodes caused a crash with "Cannot read properties of undefined (reading '0')".
    *   **Root Cause**: The `createPaperdollControls` function accessed `currentProjectData.paperdolls[0]` without checking if the array existed.
    *   **Solution**: Added a safety check to gracefully handle projects without paperdoll definitions.

*   **Custom Prompt System (Electron Compatibility)**:
    *   **Critical Issue**: Electron's renderer process does NOT support the native JavaScript `prompt()` function. Any attempt to use it throws: `"prompt() is and will not be supported."`.
    *   **Impact**: Dialogue graph connections could not be created because the code relied on `prompt()` for entering choice text.
    *   **Solution**:
        *   Created a new **Custom Prompt Modal** (`#modal-custom-prompt`) in `index.html`.
        *   Implemented `customPrompt(title, defaultValue)` function in `renderer.js` that returns a Promise.
        *   Added `resolveCustomPrompt(value)` function for the modal buttons.
        *   Added keyboard support: `Enter` confirms, `Escape` cancels.
        *   Updated `DialogueGraphEditor.createConnection()` to be `async` and use `await customPrompt()` instead of the native `prompt()`.

### 2. Technical Learnings
*   **Character Encoding Vigilance**: When files pass through different systems (Git, editors, copy-paste from various sources), character encoding can silently corrupt. UTF-8 BOM markers (`ï»¿`) and double-encoding (UTF-8 interpreted as Windows-1252 then re-saved as UTF-8) are common culprits. Binary-level inspection and targeted replacement scripts are effective remediation tools.

*   **Electron API Limitations**: Browser APIs like `prompt()`, `confirm()`, and `alert()` are intentionally disabled in Electron's renderer process for security reasons. All interactive dialogs must be custom HTML/CSS modals with JavaScript event handling and Promise-based resolution.

*   **HTML Structure Matters for Modals**: When building complex modals with multiple sections (details, forms, buttons), ensure all interactive content is properly nested within the modal's content container. Misplaced elements can visually overlay other parts of the application.

*   **Defensive Data Access**: Always check for the existence of nested data structures before accessing them, especially in editor code where project data may be incomplete. Pattern: `(array && array.length > 0) ? array[0] : null`.

*   **Debug Logging Strategy**: Adding targeted `console.log()` statements at key points (function entry, conditional branches, data mutations) rapidly identifies where in a complex flow the code is failing.

### 3. Current State
*   **Launcher Stability**: Fully functional. All tabs load correctly, games appear in the library.
*   **Visual Integrity**: All UI icons and symbols display correctly without garbled characters.
*   **Dialogue Graph Editor**: Connections can now be created between nodes using the new custom prompt modal.
*   **Error Handling**: Improved robustness against missing or incomplete project data.
*   **Code Cleanliness**: Removed temporary cleanup scripts after successful remediation.

## Session Summary: Paperdoll Customization System & Project Cleanup
**Date**: January 8, 2026

### 1. Major Changes
*   **Enhanced Paperdoll Customization (In-Game)**:
    *   **Full Layer Controls**: The character creation Appearance tab now shows controls for ALL customizable layers, not just those with multiple images.
    *   **Image Cycling**: Players can cycle through available images for each layer with `◀ 1/3 ▶` style navigation buttons.
    *   **Colorway Selection**: Each layer now supports colorway cycling with separate controls showing `Base 1/2` or `Var 1 2/2` style navigation.
    *   **Visibility Toggle**: Layers marked as "removable" can be toggled on/off, displaying "None" when hidden or "On" when showing a single image.
    *   **Dynamic UI**: Colorway controls automatically hide when a layer is set to "None" and reappear when visible.
    *   **Retro Styling**: Controls use a cohesive green-themed aesthetic with dark translucent backgrounds, accent borders, and monospace fonts.

*   **Editor: Layer Permission System**:
    *   **Dual-Checkbox Grid**: The Player Tab now shows a grid with "Layer | Customize ☑ | Removable ☑" columns for each paperdoll layer.
    *   **Customizable Layers**: Determines which layers players can modify during character creation.
    *   **Removable Layers**: Determines which layers can be hidden/removed by players (e.g., accessories can be removed, but pants cannot).
    *   **Conditional State**: The "Removable" checkbox is disabled for layers that aren't marked "Customizable".
    *   **Data Structure**: Added new `removableLayers` array to player config alongside existing `customizableLayers`.

*   **Improved Initialization Logic**:
    *   **Fixed Colorway Defaults**: Corrected an issue where colorway index `-1` (base image) was being incorrectly treated as `0` due to the `||` operator's truthy evaluation.
    *   **Proper State Sync**: Layer appearance state now correctly initializes from paperdoll definition defaults.

*   **Project Cleanup**:
    *   **Removed Temporary Scripts**: Deleted 12 utility/debug JavaScript files from the project root:
        *   `clean_renderer.js`, `clean_renderer_blind.js`, `clean_renderer_final.js`, `clean_renderer_v2.js`, `clean_renderer_v3.js`
        *   `debug_launch.js`, `deep_search.js`, `fix_mojibake.js`
        *   `force_update_buttons.js`, `inspect_lines.js`, `read_cyclers.js`, `surgical_fix.js`
    *   **Clean Root Directory**: Project root now contains only essential files (package.json, README, DEVLOG, LICENSE, etc.).

### 2. Technical Learnings
*   **Negative Index Handling**: When using default values with `||`, remember that `0` and negative numbers are falsy. Use explicit checks like `value !== undefined ? value : default` to properly handle numeric indices that include -1 or 0 as valid values.

*   **Dynamic DOM Updates**: When cycling through options that change what controls are available (e.g., hiding colorway controls when a layer is hidden), storing element IDs at creation time and updating `display` styles dynamically is more efficient than re-rendering the entire control panel.

*   **Permission Layering**: A two-tier permission system (Customizable + Removable) provides game makers with fine-grained control. Required items like clothing can be customizable (change style) but not removable, while accessories can be both.

*   **UI State Reflection**: The disabled state of dependent checkboxes (Removable disabled when Customizable is unchecked) provides immediate visual feedback about the relationship between options.

### 3. Current State
*   **Character Creation**: Full paperdoll customization with image selection, colorway cycling, and optional layer visibility toggle.
*   **Editor Controls**: Game makers can precisely control which layers are customizable and which can be removed.
*   **Project Structure**: Clean repository with no temporary or debug scripts cluttering the root directory.
*   **Data Compatibility**: New features are backward-compatible; existing projects work without modification.

## Session Summary: Dialogue Graph Delete & Start Dialogue Action
**Date**: January 8, 2026

### 1. Major Changes
*   **Fixed Dialogue Graph Delete Button**:
    *   **Issue**: The delete button (X) on dialogue node cards in the graph editor was non-functional. Clicking it did nothing or called an undefined function.
    *   **Root Cause**: The `DialogueGraphEditor` class inherits from `GraphEditor`, which has `onMouseDown` handler that calls `window.openDeleteLocationModal()` for the delete button. This function is only defined for location nodes, not dialogue nodes.
    *   **Solution**: Overrode `onMouseDown` in `DialogueGraphEditor` to intercept delete button clicks and handle them appropriately.
    *   **New Method**: Added `deleteDialogueNode(node)` method that:
        *   Shows a confirmation prompt with the node text preview.
        *   Removes the node from the dialogue tree.
        *   Cleans up all `choices` in other nodes that reference the deleted node.
        *   Updates the `rootNodeId` if the root node was deleted.
        *   Reloads the tree and saves data.

*   **New Action Type: "Start Dialogue Tree"**:
    *   **Feature**: Added a new action type `start_dialogue` to allow NPC and Location interactions to trigger dialogue trees.
    *   **Use Case**: When a player interacts with an NPC or location, game makers can now trigger a specific dialogue tree to start, enabling complex character conversations to be managed separately from location choices.
    *   **Implementation**:
        *   Added option to the choice template dropdown in `index.html`.
        *   Added handler in `updateChoiceTemplateFields()` that shows a dropdown populated with all available dialogue trees.
        *   Updated `saveChoiceFromEditor()` to store `dialogueId` and `dialogueName`.
        *   Updated `getActionLabel()` to display "🗣️ Start Dialogue" label.
        *   Added to the multi-outcome system (outcome editor popup).
        *   Updated `updateOutcomeFields()` and `saveOutcome()` for multi-outcome support.
        *   Added `dialogueId` handling in the primary action object for multi-outcomes.

*   **Data Structure**:
    *   Choices with `action: 'start_dialogue'` store:
        *   `dialogueId`: The unique ID of the dialogue tree to start.
        *   `dialogueName`: Cached name for display purposes.

### 2. Technical Learnings
*   **Class Inheritance & Override Strategy**: When extending a base class, always check which methods make assumptions about the data type. The base `GraphEditor` assumed all nodes were "locations" - the subclass needs to override methods that have type-specific behavior.

*   **Delete Cascade**: When deleting nodes in a graph structure, it's essential to clean up all references to the deleted node. For dialogue nodes, this means scanning all other nodes' `choices` arrays and removing any that point to the deleted node's ID.

*   **Root Node Management**: In tree structures, deleting the root requires special handling. We implemented automatic root reassignment to the first remaining node, with fallback to `null` if the tree becomes empty.

*   **Feature Parity Across Systems**: Adding a new action type requires updates in multiple places:
    *   HTML dropdown options
    *   Template field generator function
    *   Save function (primary action)
    *   Multi-outcome popup options
    *   Multi-outcome field generator
    *   Multi-outcome save function
    *   Action label dictionary
    *   Primary action builder for multi-outcomes

*   **Visual Novel Dialogue Screen Implementation**:
    *   Added `start_dialogue` action type handler in `core.js` `processAction()` method.
    *   Added `sf-startDialogueTree` event listener in `game.html`.
    *   **New Dialogue Screen UI (Ren'Py-style)**:
        *   Full-screen overlay with background image support from dialogue tree.
        *   Speaker name display with accent color styling.
        *   Speaker image container (left side, visual novel layout).
        *   Scene/CG image support separate from speaker image.
        *   Text box with click-to-continue for linear dialogue.
        *   Choice buttons for branching paths.
        *   Forward/Back navigation buttons with history tracking.
        *   Close button to exit dialogue early.
    *   **Functions Created**:
        *   `openStandaloneDialogueTree()` - Opens the visual dialogue screen.
        *   `renderDialogueNode()` - Displays text, speaker, images, and choices.
        *   `renderDialogueChoices()` - Renders choice buttons.
        *   `advanceDialogue()` - Handles click-to-continue and linear paths.
        *   `goBackDialogue()` - Returns to previous node using history.
        *   `closeDialogueScreen()` - Closes and cleans up.
    *   **CSS Styles Added**: Full styling for `.dialogue-screen`, speaker container, text box, choice buttons, navigation buttons, and close button.

### 3. Current State
*   **Dialogue Graph Editor**: Delete button now works correctly, removing nodes and cleaning up connections.
*   **Interaction Outcomes**: Game makers can now trigger dialogue trees from NPC interactions and location choices.
*   **Multi-Outcome Support**: Start Dialogue works as both a primary action and an additional outcome in multi-action scenarios.
*   **Visual Novel Dialogue Screen**: Full Ren'Py-style dialogue display with speaker images, text boxes, choices, and navigation.

### 4. Bug Fixes (Visual Novel Dialogue Screen)
*   **NPC Interaction Start Dialogue**: Added `start_dialogue` action handler in `renderModalChoices` so NPC dialogue can trigger dialogue trees.
*   **Speaker Image Positioning**: Changed speaker container to use `top: 50px` instead of `bottom` positioning for proper visual novel layout.
*   **Player Paperdoll Support**: Added `renderDialoguePaperdoll()` function to composite paperdoll layers for speaker display.
*   **Player Appearance Lookup**: Fixed player speaker data to check `config.visualType` and `config.paperdollId` from game data.
*   **Character State Lookup**: Fixed `renderDialoguePaperdoll` to use `characterAppearance` state (matching character creation save location).
*   **Dialogues Loading**: Added `dialogues` array to gameData construction in `init()` function.
*   **Placeholder Text**: Removed "Loading scene data..." placeholder text to avoid confusion.

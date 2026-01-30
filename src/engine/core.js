class StoryForgeEngine {
    constructor() {
        this.gameState = {
            calendar: {
                minute: 0,
                hour: 8,
                day: 1,
                month: 1,
                year: 2024,
                season: 'Spring',
                weekday: 'Monday'
            },
            player: {
                name: 'Player',
                stats: {
                    strength: 10,
                    intelligence: 10,
                    charisma: 10
                },
                baseStats: { // Persistent base stats
                    strength: 10,
                    intelligence: 10,
                    charisma: 10
                },
                skills: {},
                inventory: [],
                money: 0,
                wallet: {}, // { currencyId: amount }
                appearance: {} // For paperdoll system
            },
            relationships: {}, // NPC ID -> { value, status }
            currentLocation: null,
            flags: {}, // General story flags
            interactionUsage: {}, // ID -> count
            gallery: [], // Unlocked image IDs
            characterAppearance: {} // Runtime overrides for paperdolls: { charId: { layerName: { img: 0, col: 0 } } }
        };

        this.world = {
            locations: {},
            npcs: {},
            items: {},
            quests: {}
        };
    }

    getInteractionCount(id) {
        if (!id) return 0;
        return this.gameState.interactionUsage[id] || 0;
    }

    incrementInteractionCount(id) {
        if (!id) return;
        if (!this.gameState.interactionUsage[id]) this.gameState.interactionUsage[id] = 0;
        this.gameState.interactionUsage[id]++;
    }

    get state() {
        return this.gameState;
    }

    getState() {
        // Return a deep copy to avoid reference issues
        return JSON.parse(JSON.stringify(this.gameState));
    }

    restoreState(savedState) {
        if (!savedState) return;

        // Deep merge or overwrite
        this.gameState = {
            ...this.gameState,
            ...savedState
        };

        // Re-emit all signals to update UI
        this.emit('timeChanged', this.gameState.calendar);
        this.emit('statsChanged', this.gameState.player);
        this.emit('inventoryChanged', this.gameState.player.inventory);
        this.emit('walletChanged', this.gameState.player.wallet);
        if (Object.keys(this.gameState.player.appearance).length > 0) {
            this.emit('appearanceChanged', this.gameState.player.appearance);
        }
        this.checkScheduledEvents(); // Update NPCs

        // Reload current location
        if (this.gameState.currentLocation) {
            this.gotoLocation(this.gameState.currentLocation);
        }

        this.notify("Game Loaded Successfully");
    }

    /**
     * Advance time in the game.
     * @param {number} minutes - Minutes to advance.
     */
    advanceTime(minutes) {
        let t = this.gameState.calendar;
        t.minute += minutes;

        while (t.minute >= 60) {
            t.minute -= 60;
            t.hour++;
        }

        while (t.hour >= 24) {
            t.hour -= 24;
            this.advanceDay();
        }

        this.emit('timeChanged', t);
        this.checkScheduledEvents();
    }

    advanceDay() {
        let t = this.gameState.calendar;
        t.day++;

        const daysInMonth = this.getDaysInMonth(t.month, t.year);

        if (t.day > daysInMonth) {
            t.day = 1;
            t.month++;
            this.updateSeason();
        }

        if (t.month > 12) {
            t.month = 1;
            t.year++;
        }
    }

    getDaysInMonth(month, year) {
        // Standard days per month
        const days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        // Leap year check for Feb
        if (month === 2 && ((year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0))) {
            return 29;
        }
        return days[month] || 30;
    }

    setAppearance(layer, url) {
        // Legacy player appearance
        this.gameState.player.appearance[layer] = url;
        this.emit('appearanceChanged', this.gameState.player.appearance);
        this.recalculateStats(); // Recalculate stats on appearance change
    }

    modifyPaperdoll(charId, layerName, settings) {
        // settings: { img: number, col: number }
        if (!this.gameState.characterAppearance[charId]) {
            this.gameState.characterAppearance[charId] = {};
        }
        if (!this.gameState.characterAppearance[charId][layerName]) {
            this.gameState.characterAppearance[charId][layerName] = {};
        }

        const layerState = this.gameState.characterAppearance[charId][layerName];
        if (settings.img !== undefined) layerState.img = settings.img;
        if (settings.col !== undefined) layerState.col = settings.col;

        this.emit('paperdollChanged', { charId, layerName });
        this.recalculateStats();
        this.notify(`Updated appearance of ${charId}`);
    }

    recalculateStats() {
        // Only recalc for player for now, NPCs usually don't have dynamic stats used by engine yet
        const player = this.gameState.player;

        // 1. Reset to Base Stats
        // If baseStats doesn't exist (legacy save), init it from current stats
        if (!player.baseStats) {
            player.baseStats = { ...player.stats };
        }

        const newStats = { ...player.baseStats };

        // 2. Add Paperdoll Modifiers
        // We need to check if player is using a paperdoll
        const appearance = player.appearance;
        if (appearance && appearance.type === 'paperdoll' && appearance.paperdollId) {
            const pdId = appearance.paperdollId;
            const pdDef = (this.gameData.paperdolls || []).find(p => p.id === pdId);

            if (pdDef) {
                // Get runtime override state
                const runtimeState = this.gameState.characterAppearance['player'] || {}; // override settings

                pdDef.layers.forEach(layer => {
                    let imgIdx = layer.selectedImageIdx || 0;

                    // Check override
                    if (runtimeState[layer.name] && runtimeState[layer.name].img !== undefined) {
                        imgIdx = runtimeState[layer.name].img;
                    }

                    // Get Image Stats
                    if (layer.images && layer.images[imgIdx]) {
                        const img = layer.images[imgIdx];
                        if (img.stats) {
                            Object.entries(img.stats).forEach(([statKeys, val]) => {
                                // statKeys might be comma separated or single
                                // Let's support single for now: "strength": 5
                                const sKey = statKeys.toLowerCase();
                                if (!newStats[sKey]) newStats[sKey] = 0;
                                newStats[sKey] += val;
                            });
                        }
                    }
                });
            }
        }

        player.stats = newStats;
        this.emit('statsChanged', player);
    }

    updateSeason() {
        const m = this.gameState.calendar.month;
        if (m >= 3 && m <= 5) this.gameState.calendar.season = 'Spring';
        else if (m >= 6 && m <= 8) this.gameState.calendar.season = 'Summer';
        else if (m >= 9 && m <= 11) this.gameState.calendar.season = 'Autumn';
        else this.gameState.calendar.season = 'Winter';
    }

    getMonthName(monthIndex) {
        const months = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return months[monthIndex] || "Unknown";
    }

    unlockImage(imageId) {
        if (!this.gameState.gallery.includes(imageId)) {
            this.gameState.gallery.push(imageId);
            this.emit('galleryChanged', this.gameState.gallery);
            this.notify("New Image Unlocked in Gallery!");
        }
    }

    // --- Player Management ---

    addMoney(amount) {
        this.addCurrency('default', amount);
    }

    removeMoney(amount) {
        return this.removeCurrency('default', amount);
    }

    addCurrency(currencyId, amount) {
        if (!currencyId || currencyId === 'default') {
            this.gameState.player.money += amount;
            this.emit('moneyChanged', this.gameState.player.money);
        }

        // Always track in wallet too for consistency if needed, but for now specific ID usually implies wallet
        if (!this.gameState.player.wallet) this.gameState.player.wallet = {};
        if (!this.gameState.player.wallet[currencyId]) this.gameState.player.wallet[currencyId] = 0;

        this.gameState.player.wallet[currencyId] += amount;
        this.emit('walletChanged', this.gameState.player.wallet);

        // Notify with symbol if possible (requires lookups, skipping for core simplicity unless provided)
        this.notify(`Received currency (${currencyId}): ${amount}`);
    }

    removeCurrency(currencyId, amount) {
        if (!currencyId || currencyId === 'default') {
            if (this.gameState.player.money >= amount) {
                this.gameState.player.money -= amount;

                // Sync wallet
                if (!this.gameState.player.wallet) this.gameState.player.wallet = {};
                if (!this.gameState.player.wallet['default']) this.gameState.player.wallet['default'] = 0;
                this.gameState.player.wallet['default'] = this.gameState.player.money;

                this.emit('moneyChanged', this.gameState.player.money);
                this.emit('walletChanged', this.gameState.player.wallet);
                return true;
            }
            return false;
        }

        if (!this.gameState.player.wallet) this.gameState.player.wallet = {};
        const current = this.gameState.player.wallet[currencyId] || 0;

        if (current >= amount) {
            this.gameState.player.wallet[currencyId] -= amount;
            this.emit('walletChanged', this.gameState.player.wallet);
            return true;
        }
        return false;
    }

    addItem(itemId, name, description = '', quantity = 1) {
        const inv = this.gameState.player.inventory;
        const existing = inv.find(i => i.id === itemId);
        if (existing) {
            existing.quantity += quantity;
        } else {
            inv.push({ id: itemId, name, description, quantity });
        }
        this.emit('inventoryChanged', inv);
        this.notify(`Added ${quantity}x ${name}`);
    }

    removeItem(itemId, quantity = 1) {
        const inv = this.gameState.player.inventory;
        const idx = inv.findIndex(i => i.id === itemId);
        if (idx !== -1) {
            inv[idx].quantity -= quantity;
            if (inv[idx].quantity <= 0) {
                inv.splice(idx, 1);
            }
            this.emit('inventoryChanged', inv);
            return true;
        }
        return false;
    }

    buyItem(item, price, currencyId = 'default') {
        if (this.removeCurrency(currencyId, price)) {
            this.addItem(item.id, item.name, item.description, 1);
            return true;
        } else {
            this.notify("Not enough funds!");
            return false;
        }
    }

    updateSkill(skillId, name, valueChange) {
        const skills = this.gameState.player.skills;
        if (!skills[skillId]) {
            skills[skillId] = { name, level: 0, progress: 0 };
        }
        skills[skillId].progress += valueChange;
        if (skills[skillId].progress >= 100) {
            skills[skillId].level++;
            skills[skillId].progress -= 100;
            this.notify(`Skill Level Up: ${name}!`);
        }
        this.emit('statsChanged', this.gameState.player);
    }

    updateRelationship(npcId, name, valueChange) {
        const rels = this.gameState.relationships || {};

        if (!this.gameState.relationships[npcId]) {
            this.gameState.relationships[npcId] = { name, value: 0, status: 'Neutral' };
        }

        const rel = this.gameState.relationships[npcId];
        rel.value += valueChange;

        if (rel.value > 50) rel.status = 'Friendly';
        if (rel.value > 80) rel.status = 'Close';

        this.emit('relationsChanged', this.gameState.relationships);
        this.notify(`Relationship with ${name} changed.`);
    }

    addQuest(questId, title, description) {
        if (!this.gameState.flags.quests) this.gameState.flags.quests = {};
        this.gameState.flags.quests[questId] = { title, description, status: 'active', objectives: [] };
        this.emit('questsChanged', this.gameState.flags.quests);
        this.notify(`New Quest: ${title}`);
    }

    // --- Interaction System ---

    loadGame(gameData) {
        this.gameData = gameData;
        console.log("Game Loaded:", gameData.meta ? gameData.meta.title : 'Untitled');

        // Merge initial state cautiously
        if (gameData.initialState) {
            // Partial Merge for Player to preserve structure (inventory, appearance)
            if (gameData.initialState.player) {
                // Ensure defaults exist
                const defPlayer = this.gameState.player;
                const newPlayer = gameData.initialState.player;

                this.gameState.player = {
                    ...defPlayer,
                    ...newPlayer,
                    stats: { ...defPlayer.stats, ...newPlayer.stats },
                    // Ensure arrays are not undefined
                    inventory: newPlayer.inventory || defPlayer.inventory || [],
                    skills: newPlayer.skills || defPlayer.skills || {},
                    wallet: newPlayer.wallet || defPlayer.wallet || {}, // Merge wallet
                    appearance: newPlayer.appearance || defPlayer.appearance || {},
                    relationships: newPlayer.relationships || defPlayer.relationships || {}
                };
            }

            // Merge other state roots
            if (gameData.initialState.calendar) this.gameState.calendar = { ...this.gameState.calendar, ...gameData.initialState.calendar };
            if (gameData.initialState.flags) this.gameState.flags = { ...this.gameState.flags, ...gameData.initialState.flags };
            if (gameData.initialState.variables) this.gameState.variables = { ...this.gameState.variables, ...gameData.initialState.variables };
            if (gameData.initialState.gallery) this.gameState.gallery = gameData.initialState.gallery;

            // Map legacy currentScene to currentLocation
            if (gameData.initialState.currentScene && !this.gameState.currentLocation) {
                this.gameState.currentLocation = gameData.initialState.currentScene;
            }
            // Valid Overwrite for specific location
            if (gameData.initialState.currentLocation) {
                this.gameState.currentLocation = gameData.initialState.currentLocation;
            }

        } else if (!this.gameState.currentLocation && this.gameData.locations) {
            // Default to first location if no state defined
            // Locations might be an array or object depending on loader. 
            // The editor saves them as array, but the loader in game.html might transform them.
            // Let's assume the loader provides them as an Object Map (id -> data) OR Array.
            // core.js works best with Maps for O(1) lookup.
            // checking if locations is Array or Object
            if (Array.isArray(this.gameData.locations)) {
                if (this.gameData.locations.length > 0) this.gameState.currentLocation = this.gameData.locations[0].id;
            } else {
                const keys = Object.keys(this.gameData.locations);
                if (keys.length > 0) this.gameState.currentLocation = keys[0];
            }
        }

        if (!this.gameState.currentLocation) {
            console.warn("No starting location found.");
            this.emit('dialogue', { text: "No locations found. Use the editor to create your first location!", speaker: "Engine" });
        } else {
            // Start game
            this.gotoLocation(this.gameState.currentLocation);
        }

        // Initial emits
        this.emit('timeChanged', this.gameState.calendar);
        this.emit('statsChanged', this.gameState.player);
        this.emit('inventoryChanged', this.gameState.player.inventory);
        if (Object.keys(this.gameState.player.appearance).length > 0) {
            this.emit('appearanceChanged', this.gameState.player.appearance);
        }
    }

    getTimeOfDay() {
        const h = this.gameState.calendar.hour;
        if (h >= 5 && h < 8) return 'dawn';
        if (h >= 8 && h < 18) return 'day';
        if (h >= 18 && h < 21) return 'dusk';
        return 'night';
    }

    gotoLocation(locationId) {
        let loc = null;
        if (Array.isArray(this.gameData.locations)) {
            loc = this.gameData.locations.find(l => l.id === locationId);
        } else {
            loc = this.gameData.locations[locationId];
        }

        if (!loc) {
            console.error(`Location ${locationId} not found`);
            return;
        }

        // Resolve Image
        if (loc.images) {
            const time = this.getTimeOfDay();
            let img = loc.images[time];
            if (!img && time === 'day') img = loc.images['default']; // 'default' usually maps to day
            if (!img) img = loc.images['default']; // Fallback
            if (img) loc.background = img;
        }

        this.gameState.currentLocation = locationId;
        this.emit('sceneChanged', loc);
    }

    handleChoice(choiceIndex) {
        let scene = null;
        if (Array.isArray(this.gameData.locations)) {
            scene = this.gameData.locations.find(l => l.id === this.gameState.currentLocation);
        } else {
            scene = this.gameData.locations[this.gameState.currentLocation];
        }

        if (!scene || !scene.choices) return;
        const choice = scene.choices[choiceIndex];

        if (!choice) return;

        // Support for 'actions' array (New Format) and legacy flat format
        const actions = choice.actions || [choice];

        actions.forEach(act => {
            this.processAction(act);
        });
    }

    processAction(act) {
        // Normalize 'type' (new) vs 'action' (legacy)
        const type = act.type || act.action;

        if (type === 'addItem') {
            const id = act.id || act.itemId;
            const name = act.name || act.itemName || 'Item';
            const qty = act.amount || act.quantity || 1;
            const desc = act.desc || '';
            this.addItem(id, name, desc, qty);
        } else if (type === 'removeItem') {
            const id = act.id || act.itemId;
            const qty = act.amount || act.quantity || 1;
            this.removeItem(id, qty);
        } else if (type === 'modifyStat' || type === 'stat') {
            const stat = act.stat;
            const value = act.amount || act.value || 0;
        } else if (type === 'modifyStat' || type === 'stat') {
            const stat = act.stat.toLowerCase();
            const value = act.amount || act.value || 0;
            // Modify BASE Stats
            if (!this.gameState.player.baseStats) {
                this.gameState.player.baseStats = { ...this.gameState.player.stats };
            }

            if (this.gameState.player.baseStats[stat] !== undefined) {
                this.gameState.player.baseStats[stat] += value;
            } else {
                this.gameState.player.baseStats[stat] = value;
            }
            this.recalculateStats();
            // Simple notification
            this.notify(`${stat} updated.`);
        } else if (type === 'modifySkill' || type === 'skill') {
            const skill = act.skill || act.id;
            const name = act.name || skill;
            const value = act.amount || act.value || 1;
            this.updateSkill(skill, name, value);
        } else if (type === 'modifyRel' || type === 'relationship') {
            const npcId = act.npcId || act.id;
            const npcName = act.npcName || act.name || 'NPC';
            const value = act.amount || act.value || 1;
            this.updateRelationship(npcId, npcName, value);
        } else if (type === 'time') {
            const minutes = act.minutes || 0;
            this.advanceTime(minutes);
        } else if (type === 'unlock_image') {
            this.unlockImage(act.id);
        } else if (type === 'appearance') {
            this.setAppearance(act.layer, act.url);
        } else if (type === 'notify') {
            this.notify(act.message);
        } else if (type === 'script') {
            if (typeof act.script === 'function') {
                act.script(this);
            }
        } else if (type === 'dialogue') {
            let text = act.content;
            if (text && typeof text === 'string' && text.includes('{time}')) {
                text = text.replace('{time}', this.getTimeString());
            }
            this.emit('dialogue', { text: text || '', speaker: act.speaker || 'System' });
        } else if (type === 'goto') {
            const target = act.target;
            if (target) {
                this.gotoLocation(target);
            }
        } else if (type === 'npc_interact') {
            const npcId = act.target || act.npcId;
            const npc = this.gameData.characters.find(c => c.id === npcId);
            if (npc) {
                this.emit('openNPCInteraction', npc);
            }
        } else if (type === 'modify_paperdoll') {
            const charId = act.target || act.charId;
            const layer = act.layer;
            const img = act.imageIndex !== undefined ? act.imageIndex : undefined;
            const col = act.colorIndex !== undefined ? act.colorIndex : undefined;
            this.modifyPaperdoll(charId, layer, { img, col });
        } else if (type === 'start_dialogue') {
            // Start a dialogue tree from the dialogues array
            const dialogueId = act.dialogueId;
            if (dialogueId) {
                this.emit('startDialogueTree', { dialogueId });
            }
        }


        // Legacy fallback
        if (type !== 'goto' && act.target) {
            this.advanceTime(5);
            this.gotoLocation(act.target);
        }
    }

    dialogue(text, speaker = 'System') {
        this.emit('dialogue', { text, speaker });
    }

    notify(msg) {
        // Simplified notification
        console.log("Notify:", msg);
        // Could emit 'notification' event
    }

    getTimeString() {
        const t = this.gameState.calendar;
        return `${t.hour.toString().padStart(2, '0')}:${t.minute.toString().padStart(2, '0')}`;
    }

    // Stub for event emitting
    emit(event, data) {
        console.log(`[Event: ${event}]`, data);
        // In real impl, dispatch to UI
        if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('sf-' + event, { detail: data }));
        }
    }

    checkScheduledEvents() {
        // Update NPC Locations based on Schedule
        if (!this.gameData.characters) return;

        // Ensure npcLocations state exists
        if (!this.gameState.npcLocations) this.gameState.npcLocations = {};

        const currentMinutes = this.gameState.calendar.hour * 60 + this.gameState.calendar.minute;

        this.gameData.characters.forEach(npc => {
            if (!npc.schedule || npc.schedule.length === 0) return;

            // Sort schedule by time
            // Assuming time is "HH:MM"
            let activeEvent = null;

            // Find the latest event that has passed
            for (const event of npc.schedule) {
                const [h, m] = event.time.split(':').map(Number);
                const eventMinutes = h * 60 + m;

                if (eventMinutes <= currentMinutes) {
                    if (!activeEvent || eventMinutes > activeEvent.minutes) {
                        activeEvent = { ...event, minutes: eventMinutes };
                    }
                }
            }

            // If found, update location
            if (activeEvent) {
                this.gameState.npcLocations[npc.id] = activeEvent.location;
            }
        });

        this.emit('npcsUpdated', this.gameState.npcLocations);
    }

    getNPCsAtLocation(locationId) {
        if (!this.gameData.characters) return [];
        const locs = this.gameState.npcLocations || {};

        return this.gameData.characters.filter(npc => {
            // Check dynamic location first
            if (locs[npc.id]) {
                return locs[npc.id] === locationId;
            }
            // Fallback: Check if they have a 'defaultLocation' property (optional)
            return false;
        });
    }
}

// Global instance
window.gameEngine = new StoryForgeEngine();

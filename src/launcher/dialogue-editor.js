
// Dialogue Editor Module

// State
let activeDialogueTreeIndex = -1;
let dialogueGraphEditor = null;
let isDialogueGraphMode = false;
let editingDialogueNode = null; // The node currently being editing in the modal

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
    // Initialize Graph Editor
    dialogueGraphEditor = new DialogueGraphEditor('diag-graph-canvas', 'diag-view-graph');
});

// --- List Management ---

function populateDialogueList() {
    const list = document.getElementById('dialogue-list-container');
    if (!list) return;
    list.innerHTML = '';

    // Ensure data exists
    if (!currentProjectData.dialogues) currentProjectData.dialogues = [];

    currentProjectData.dialogues.forEach((tree, index) => {
        const item = document.createElement('div');
        item.className = 'scene-item';
        item.style.position = 'relative';
        item.innerHTML = `
            <div class="scene-id">${tree.id}</div>
            <div class="scene-text">${tree.rootNodeId ? 'Has Root' : 'Empty Tree'}</div>
             <button class="location-delete-btn" onclick="openDeleteDialogueModal(${index}, event)" 
                title="Delete Tree"
                style="position:absolute; top:50%; right:8px; transform:translateY(-50%); background:transparent; border:none; color:var(--text-secondary); cursor:pointer; font-size:14px; padding:4px 8px; opacity:0.5; transition: opacity 0.2s, color 0.2s;"
                onmouseenter="this.style.opacity='1'; this.style.color='red';"
                onmouseleave="this.style.opacity='0.5'; this.style.color='var(--text-secondary)';">🗑</button>
        `;
        item.onclick = (e) => {
            if (e.target.classList.contains('location-delete-btn')) return;
            loadDialogueTreeToForm(index);
        };
        list.appendChild(item);
    });
}

function addNewDialogueTree() {
    const newTree = {
        id: `diag_${Date.now()}`,
        participants: ['player'],
        nodes: [],
        rootNodeId: null
    };
    currentProjectData.dialogues.push(newTree);
    saveData();
    populateDialogueList();
    loadDialogueTreeToForm(currentProjectData.dialogues.length - 1);
}

function loadDialogueTreeToForm(index) {
    activeDialogueTreeIndex = index;
    const tree = currentProjectData.dialogues[index];

    document.getElementById('diag-id').value = tree.id || '';
    document.getElementById('diag-participants').value = (tree.participants || []).join(', ');

    // Update Root Node Preview
    const rootPrev = document.getElementById('diag-root-node-preview');
    if (tree.rootNodeId) {
        rootPrev.innerText = `Root: ${tree.rootNodeId}`;
        rootPrev.style.color = '#fff';
    } else {
        rootPrev.innerText = "No root node set. Switch to Graph View to create one.";
        rootPrev.style.color = '#aaa';
    }

    if (dialogueGraphEditor) {
        dialogueGraphEditor.loadTree(tree);
    }
}

function saveCurrentDialogueTree() {
    if (activeDialogueTreeIndex === -1) return;

    const tree = currentProjectData.dialogues[activeDialogueTreeIndex];
    tree.id = document.getElementById('diag-id').value;
    tree.participants = document.getElementById('diag-participants').value.split(',').map(s => s.trim()).filter(s => s);

    saveData();
    populateDialogueList();
}

function deleteActiveDialogueTree() {
    if (activeDialogueTreeIndex === -1) return;
    if (!confirm("Are you sure you want to delete this dialogue tree?")) return;

    currentProjectData.dialogues.splice(activeDialogueTreeIndex, 1);
    activeDialogueTreeIndex = -1;
    saveData();
    populateDialogueList();

    // Clear Form
    document.getElementById('diag-id').value = '';
    document.getElementById('diag-participants').value = '';
}

function openDeleteDialogueModal(index, e) {
    e.stopPropagation();
    if (!confirm("Delete this dialogue tree?")) return;

    if (activeDialogueTreeIndex === index) activeDialogueTreeIndex = -1;
    currentProjectData.dialogues.splice(index, 1);
    saveData();
    populateDialogueList();
}


// --- Graph View Integration ---

function toggleDialogueViewMode() {
    const listContainer = document.getElementById('diag-view-list');
    const graphContainer = document.getElementById('diag-view-graph');
    const btn = document.getElementById('btn-diag-view-toggle');

    if (listContainer.classList.contains('hidden')) {
        // Switch to List
        listContainer.classList.remove('hidden');
        graphContainer.classList.add('hidden');
        btn.innerText = "Graph View";
        btn.classList.remove('primary-btn');
        btn.classList.add('secondary-btn');
        isDialogueGraphMode = false;
    } else {
        // Switch to Graph
        listContainer.classList.add('hidden');
        graphContainer.classList.remove('hidden');
        btn.innerText = "List View";
        btn.classList.remove('secondary-btn');
        btn.classList.add('primary-btn');
        isDialogueGraphMode = true;

        // Resize Graph
        if (dialogueGraphEditor) {
            dialogueGraphEditor.resize();
            if (activeDialogueTreeIndex !== -1) {
                dialogueGraphEditor.loadTree(currentProjectData.dialogues[activeDialogueTreeIndex]);
            }
        }
    }
}

// --- Dialogue Node Modal Editor ---

function openDialogueNodeEditorGlobal(node) {
    editingDialogueNode = node;
    const data = node.data;
    const tree = currentProjectData.dialogues[activeDialogueTreeIndex];

    // 1. Populate Speaker Select
    const select = document.getElementById('diag-node-speaker-select');
    select.innerHTML = '<option value="player">Player</option><option value="narrator">Narrator</option>';

    // Add logic to fetch all valid characters + local participants
    const participants = tree.participants || [];
    currentProjectData.characters.forEach(c => {
        if (participants.includes(c.id) || true) { // Just show all for now
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.innerText = `${c.name} (${c.id})`;
            select.appendChild(opt);
        }
    });

    // Set Values
    const speaker = data.speaker || 'player';
    select.value = speaker;
    if (select.value !== speaker) {
        // Custom/Manual value
        document.getElementById('diag-node-speaker-manual').value = speaker;
    } else {
        document.getElementById('diag-node-speaker-manual').value = speaker;
    }

    document.getElementById('diag-node-text').value = data.text || '';
    document.getElementById('diag-node-image').value = data.image || '';


    // Paperdoll Override Reset
    const pdDataInput = document.getElementById('diag-node-paperdoll-data');
    const pdStatus = document.getElementById('diag-node-paperdoll-status');

    if (data.paperdollOverride && typeof data.paperdollOverride === 'object') {
        pdDataInput.value = JSON.stringify(data.paperdollOverride);
        pdStatus.innerText = "Override Active";
        pdStatus.style.fontWeight = "bold";
        pdStatus.style.color = "var(--accent-color)";
    } else {
        pdDataInput.value = "";
        pdStatus.innerText = "No Override";
        pdStatus.style.fontWeight = "normal";
        pdStatus.style.color = "var(--text-secondary)";
    }

    // Requirements & Outcomes
    renderRequirementRows(data.requirements || []);
    renderOutcomeRows(data.outcomes || []);

    document.getElementById('modal-dialogue-node-editor').classList.remove('hidden');
}

function closeDialogueNodeEditor() {
    document.getElementById('modal-dialogue-node-editor').classList.add('hidden');
    editingDialogueNode = null;
}

function saveDialogueNodeFromEditor() {
    if (!editingDialogueNode) return;

    const speaker = document.getElementById('diag-node-speaker-manual').value || 'narrator';
    const text = document.getElementById('diag-node-text').value;

    editingDialogueNode.data.speaker = speaker;
    editingDialogueNode.data.text = text;
    editingDialogueNode.data.image = document.getElementById('diag-node-image').value;

    // Paperdoll Override
    const pdDataRaw = document.getElementById('diag-node-paperdoll-data').value;
    if (pdDataRaw) {
        try {
            editingDialogueNode.data.paperdollOverride = JSON.parse(pdDataRaw);
        } catch (e) {
            console.error("Failed to parse paperdoll data", e);
        }
    } else {
        delete editingDialogueNode.data.paperdollOverride;
    }
    // Remove legacy
    delete editingDialogueNode.data.paperdoll;

    // Save Req/Outcomes
    editingDialogueNode.data.requirements = scrapeRequirementsFromDOM();
    editingDialogueNode.data.outcomes = scrapeOutcomesFromDOM();

    // Update Label
    editingDialogueNode.name = `${speaker}: ${text.slice(0, 15)}...`;

    // Save
    saveData();
    dialogueGraphEditor.draw();
    closeDialogueNodeEditor();
}

// --- Paperdoll Composer Integration ---

function openDialoguePaperdollComposer() {
    const speakerId = document.getElementById('diag-node-speaker-manual').value || 'player';
    const currentDataRaw = document.getElementById('diag-node-paperdoll-data').value;
    let initialState = null;
    try { initialState = JSON.parse(currentDataRaw); } catch (e) { }

    window.openPaperdollComposer(initialState, speakerId, (newState) => {
        const input = document.getElementById('diag-node-paperdoll-data');
        const status = document.getElementById('diag-node-paperdoll-status');

        if (Object.keys(newState).length === 0) {
            input.value = "";
            status.innerText = "No Override";
            status.style.color = "var(--text-secondary)";
            status.style.fontWeight = "normal";
        } else {
            input.value = JSON.stringify(newState);
            status.innerText = "Override Active";
            status.style.color = "var(--accent-color)";
            status.style.fontWeight = "bold";
        }
    });
}

function clearDialoguePaperdoll() {
    document.getElementById('diag-node-paperdoll-data').value = "";
    const status = document.getElementById('diag-node-paperdoll-status');
    status.innerText = "No Override";
    status.style.fontWeight = "normal";
    status.style.color = "var(--text-secondary)";
}

// --- Universal Helpers (Stubbed) ---


function renderRequirementRows(reqs) {
    const container = document.getElementById('diag-node-req-list');
    container.innerHTML = '';
    reqs.forEach(req => container.appendChild(createRequirementRow(req)));
}

function renderOutcomeRows(outcomes) {
    const container = document.getElementById('diag-node-outcome-list');
    container.innerHTML = '';
    outcomes.forEach(out => container.appendChild(createOutcomeRow(out)));
}

function addDialogueNodeRequirement() {
    const list = document.getElementById('diag-node-req-list');
    list.appendChild(createRequirementRow({ type: 'stat_req', key: '', val: '' }));
}

function addDialogueNodeOutcome() {
    const list = document.getElementById('diag-node-outcome-list');
    list.appendChild(createOutcomeRow({ type: 'set_var', key: '', val: '' }));
}

// --- Smart Row Creators ---

const REQ_TYPES = {
    'stat_req': { label: 'Stat Level', keyLabel: 'Stat Name', valLabel: 'Min Value', keyType: 'stat', valType: 'number' },
    'item_req': { label: 'Has Item', keyLabel: 'Item', valLabel: 'Min Qty', keyType: 'item', valType: 'number' },
    'var_req': { label: 'Variable Check', keyLabel: 'Variable', valLabel: 'Value', keyType: 'variable', valType: 'text' },
    'npc_loc': { label: 'NPC Location', keyLabel: 'NPC', valLabel: 'Location', keyType: 'npc', valType: 'location' },
    'visited_loc': { label: 'Visited Location', keyLabel: 'Location ID', valLabel: 'Visited? (true/false)', keyType: 'location', valType: 'bool' }
};

const OUT_TYPES = {
    'set_var': { label: 'Set Variable', keyLabel: 'Variable', valLabel: 'Value', keyType: 'variable', valType: 'text' },
    'give_item': { label: 'Give/Take Item', keyLabel: 'Item', valLabel: 'Qty (+/-)', keyType: 'item', valType: 'number' },
    'mod_stat': { label: 'Modify Stat', keyLabel: 'Stat', valLabel: 'Change (+/-)', keyType: 'stat', valType: 'number' },
    'nav': { label: 'Navigate to', keyLabel: 'Location', valLabel: '', keyType: 'location', valType: 'none' },
    'mod_paperdoll': { label: 'Paperdoll Layer', keyLabel: 'Layer', valLabel: 'Image ID', keyType: 'layer', valType: 'image_select' }, // Specialized
    'add_money': { label: 'Add Money', keyLabel: 'Currency', valLabel: 'Amount', keyType: 'currency', valType: 'number' }
};

function createRequirementRow(data) {
    const div = document.createElement('div');
    div.className = 'setting-row smart-row';
    div.style.borderLeft = "2px solid var(--accent-color)";
    div.style.paddingLeft = "10px";
    div.style.marginBottom = "5px";
    div.style.background = "rgba(0,0,0,0.2)";
    div.style.padding = "5px";
    div.style.borderRadius = "4px";

    // Type Select
    const typeSelect = document.createElement('select');
    typeSelect.className = 'input-dark req-type';
    typeSelect.style.width = '120px';

    Object.keys(REQ_TYPES).forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.innerText = REQ_TYPES[k].label;
        if (data.type === k) opt.selected = true;
        typeSelect.appendChild(opt);
    });

    const inputsContainer = document.createElement('div');
    inputsContainer.style.flex = "1";
    inputsContainer.style.display = "flex";
    inputsContainer.style.gap = "5px";

    // Update Inputs Function
    const updateInputs = () => {
        inputsContainer.innerHTML = '';
        const type = typeSelect.value;
        const conf = REQ_TYPES[type] || REQ_TYPES['var_req'];

        // Key Input
        if (conf.keyType !== 'none') {
            const keyInput = createSmartInput(conf.keyType, data.key, 'req-key', conf.keyLabel);
            keyInput.style.flex = "1";
            inputsContainer.appendChild(keyInput);
        }

        // Value Input
        if (conf.valType !== 'none') {
            const valInput = createSmartInput(conf.valType, data.val, 'req-val', conf.valLabel);
            valInput.style.width = "100px";
            inputsContainer.appendChild(valInput);
        }
    };

    typeSelect.onchange = () => {
        // Reset data on type change to avoid confusion
        data.key = '';
        data.val = '';
        updateInputs();
    };

    updateInputs(); // Init

    div.appendChild(typeSelect);
    div.appendChild(inputsContainer);

    const delBtn = document.createElement('button');
    delBtn.className = 'secondary-btn';
    delBtn.innerText = '×';
    delBtn.style.color = 'red';
    delBtn.style.padding = '0 5px';
    delBtn.style.marginLeft = '5px';
    delBtn.onclick = () => div.remove();
    div.appendChild(delBtn);

    return div;
}

function createOutcomeRow(data) {
    const div = document.createElement('div');
    div.className = 'setting-row smart-row';
    div.style.borderLeft = "2px solid #28a745"; // Green
    div.style.paddingLeft = "10px";
    div.style.marginBottom = "5px";
    div.style.background = "rgba(0,0,0,0.2)";
    div.style.padding = "5px";
    div.style.borderRadius = "4px";

    const typeSelect = document.createElement('select');
    typeSelect.className = 'input-dark out-type';
    typeSelect.style.width = '120px';

    Object.keys(OUT_TYPES).forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.innerText = OUT_TYPES[k].label;
        if (data.type === k) opt.selected = true;
        typeSelect.appendChild(opt);
    });

    const inputsContainer = document.createElement('div');
    inputsContainer.style.flex = "1";
    inputsContainer.style.display = "flex";
    inputsContainer.style.gap = "5px";
    inputsContainer.style.alignItems = "center";

    const updateInputs = () => {
        inputsContainer.innerHTML = '';
        const type = typeSelect.value;
        const conf = OUT_TYPES[type] || OUT_TYPES['set_var'];

        // Special case for Paperdoll to handle Layer -> Image dependency
        if (type === 'mod_paperdoll') {
            createPaperdollControls(inputsContainer, data);
            return;
        }

        if (conf.keyType !== 'none') {
            const keyInput = createSmartInput(conf.keyType, data.key, 'out-key', conf.keyLabel);
            keyInput.style.flex = "1";
            inputsContainer.appendChild(keyInput);
        }

        if (conf.valType !== 'none') {
            const valInput = createSmartInput(conf.valType, data.val, 'out-val', conf.valLabel);
            valInput.style.width = "100px";
            inputsContainer.appendChild(valInput);
        }
    };

    typeSelect.onchange = () => {
        data.key = '';
        data.val = '';
        updateInputs();
    };

    updateInputs();

    div.appendChild(typeSelect);
    div.appendChild(inputsContainer);

    const delBtn = document.createElement('button');
    delBtn.className = 'secondary-btn';
    delBtn.innerText = '×';
    delBtn.style.color = 'red';
    delBtn.style.padding = '0 5px';
    delBtn.style.marginLeft = '5px';
    delBtn.onclick = () => div.remove();
    div.appendChild(delBtn);

    return div;
}

// --- Smart Input Generator ---

function createSmartInput(type, value, className, placeholder) {
    let input;

    if (type === 'item') {
        input = document.createElement('select');
        input.className = `input-dark ${className}`;
        input.innerHTML = `<option value="">-- Select Item --</option>`;
        (currentProjectData.items || []).forEach(i => {
            input.innerHTML += `<option value="${i.id}" ${i.id === value ? 'selected' : ''}>${i.name || i.id}</option>`;
        });
    } else if (type === 'stat') {
        input = document.createElement('select');
        input.className = `input-dark ${className}`;
        input.innerHTML = `<option value="">-- Select Stat --</option>`;
        // Try to infer stats from player config or use common ones
        const stats = new Set(['strength', 'intelligence', 'charisma', 'dexterity', 'points']);
        if (currentProjectData.player && currentProjectData.player.stats) {
            currentProjectData.player.stats.forEach(s => stats.add(s.id));
        }
        stats.forEach(s => {
            input.innerHTML += `<option value="${s}" ${s === value ? 'selected' : ''}>${s}</option>`;
        });
        // Allow adding custom
        const customOpt = document.createElement('option');
        customOpt.value = "custom";
        customOpt.innerText = "Custom/Other...";
        input.appendChild(customOpt);

        input.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                const manual = prompt("Enter Stat ID:");
                if (manual) {
                    const o = document.createElement('option');
                    o.value = manual;
                    o.innerText = manual;
                    o.selected = true;
                    input.insertBefore(o, customOpt);
                } else {
                    input.value = "";
                }
            }
        });

    } else if (type === 'variable') {
        input = document.createElement('input'); // Make this a datalist for flexibility?
        input.type = "text";
        input.setAttribute('list', 'var-list-' + Math.random());
        const datalist = document.createElement('datalist');
        datalist.id = input.getAttribute('list');
        Object.keys(currentProjectData.variables || {}).forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            datalist.appendChild(opt);
        });
        document.body.appendChild(datalist); // Append to body to work? Or just keep in DOM?
        input.className = `input-dark ${className}`;
        input.value = value || '';
        input.placeholder = placeholder;
    } else if (type === 'npc') {
        input = document.createElement('select');
        input.className = `input-dark ${className}`;
        input.innerHTML = `<option value="">-- Select NPC --</option>`;
        (currentProjectData.characters || []).forEach(c => {
            input.innerHTML += `<option value="${c.id}" ${c.id === value ? 'selected' : ''}>${c.name}</option>`;
        });
    } else if (type === 'location') {
        input = document.createElement('select');
        input.className = `input-dark ${className}`;
        input.innerHTML = `<option value="">-- Select Location --</option>`;
        (currentProjectData.locations || []).forEach(l => {
            input.innerHTML += `<option value="${l.id}" ${l.id === value ? 'selected' : ''}>${l.name}</option>`;
        });
    } else if (type === 'currency') {
        input = document.createElement('select');
        input.className = `input-dark ${className}`;
        (currentProjectData.currencies || []).forEach(c => {
            input.innerHTML += `<option value="${c.id}" ${c.id === value ? 'selected' : ''}>${c.name}</option>`;
        });
    } else if (type === 'bool') {
        input = document.createElement('select');
        input.className = `input-dark ${className}`;
        input.innerHTML = `
            <option value="true" ${value === 'true' || value === true ? 'selected' : ''}>True</option>
            <option value="false" ${value === 'false' || value === false ? 'selected' : ''}>False</option>
        `;
    } else if (type === 'number') {
        input = document.createElement('input');
        input.type = "number";
        input.className = `input-dark ${className}`;
        input.value = value || 0;
        input.placeholder = "0";
    } else {
        input = document.createElement('input');
        input.type = "text";
        input.className = `input-dark ${className}`;
        input.value = value || '';
        input.placeholder = placeholder;
    }

    return input;
}

function createPaperdollControls(container, data) {
    // 1. Layer Select
    // 2. Image Select (dependent on Layer)
    // 3. Color Select (dependent on Image)

    // We need to know WHICH character. Default to Player or Speaker? 
    // Let's add a "Target" select first (Player vs NPC).
    // Actually simplicity first: Target is usually Player or the Speaker.
    // Let's add a Target Select.

    const targetSel = document.createElement('select');
    targetSel.className = 'input-dark out-target';
    targetSel.style.width = '80px';
    targetSel.innerHTML = '<option value="player">Player</option>';
    (currentProjectData.characters || []).forEach(c => {
        targetSel.innerHTML += `<option value="${c.id}" ${data.target === c.id ? 'selected' : ''}>${c.name.slice(0, 10)}</option>`;
    });

    // Listen for target change to update layers?
    // Assuming paperdoll data is available.

    // Layer Select
    const layerSel = document.createElement('select');
    layerSel.className = 'input-dark out-key'; // Mapped to 'key' (Layer)
    layerSel.style.width = '100px';

    // Function to populate layers
    const populateLayers = (charId) => {
        layerSel.innerHTML = '<option value="">Layer</option>';
        // Find paperdoll for charId
        // Assuming paperdolls are linked to chars or just 'player_doll' logic
        // For now, let's grab the first paperdoll or iterate all layers if possible.
        // Or blindly use 'player' config if available.
        // Simplified: use a predefined list of common layers?
        ['body', 'hair_back', 'hair_front', 'eyes', 'mouth', 'top', 'bottom', 'outfit', 'shoe', 'accessory'].forEach(l => {
            layerSel.innerHTML += `<option value="${l}" ${data.key === l ? 'selected' : ''}>${l}</option>`;
        });
    };
    populateLayers('player');

    // Image Select
    const imgSel = document.createElement('select');
    imgSel.className = 'input-dark out-val'; // Mapped to 'val' (Image ID)
    imgSel.style.flex = "1";

    // Color Select (Stored in extra data?)
    // Our data structure for Outcome Row only has type, key, val.
    // We might need to encode color into val (e.g. "imageID:colorIndex") or add a hidden field.
    // Let's use a hidden field technique or data attribute.
    const colorSel = document.createElement('select');
    colorSel.className = 'input-dark out-extra-color';
    colorSel.style.width = '60px';
    colorSel.innerHTML = '<option value="0">#1</option>';

    // Populate Images based on Layer
    const populateImages = (layer) => {
        imgSel.innerHTML = '<option value="">-- Image --</option>';
        // We need to search `currentProjectData.paperdolls` for this layer.
        // For prototype, let's look at the first paperdoll found.
        const doll = (currentProjectData.paperdolls && currentProjectData.paperdolls.length > 0) ? currentProjectData.paperdolls[0] : null;
        if (doll && doll.layers) {
            const layerObj = doll.layers.find(l => l.id === layer || l.name === layer);
            if (layerObj && layerObj.items) {
                layerObj.items.forEach(item => {
                    imgSel.innerHTML += `<option value="${item.id}" ${data.val === item.id ? 'selected' : ''}>${item.id}</option>`;
                });
            }
        }
    };

    layerSel.onchange = () => populateImages(layerSel.value);
    if (data.key) populateImages(data.key);

    container.appendChild(targetSel);
    container.appendChild(layerSel);
    container.appendChild(imgSel);
    // container.appendChild(colorSel); // Add color later if needed
}

function scrapeRequirementsFromDOM() {
    return Array.from(document.querySelectorAll('#diag-node-req-list .smart-row')).map(row => {
        const type = row.querySelector('.req-type').value;
        const keyEl = row.querySelector('.req-key');
        const valEl = row.querySelector('.req-val');

        return {
            type: type,
            key: keyEl ? keyEl.value : '',
            val: valEl ? valEl.value : ''
        };
    });
}

function scrapeOutcomesFromDOM() {
    return Array.from(document.querySelectorAll('#diag-node-outcome-list .smart-row')).map(row => {
        const type = row.querySelector('.out-type').value;
        const keyEl = row.querySelector('.out-key');
        const valEl = row.querySelector('.out-val');
        const targetEl = row.querySelector('.out-target');

        let res = {
            type: type,
            key: keyEl ? keyEl.value : '',
            val: valEl ? valEl.value : ''
        };

        if (targetEl) res.target = targetEl.value;
        return res;
    });
}


// --- Extended Graph Editor ---

class DialogueGraphEditor extends GraphEditor {
    constructor(canvasId, containerId) {
        super(canvasId, containerId);
        this.colors.nodeBg = '#232338'; // Dark Purple/Blue
        this.colors.nodeBorder = '#556';
    }

    loadTree(tree) {
        this.tree = tree;

        // Convert nodes to editor format
        this.nodes = (tree.nodes || []).map((node, index) => {
            // Init node editor meta if missing
            if (!node.editor) node.editor = { x: 100 + (index * 150), y: 100 + (index * 50), w: 220, h: 140, ports: 1 };

            // Count ports based on choices
            const choiceCount = node.choices ? node.choices.length : 0;
            if (!node.editor.ports || node.editor.ports <= choiceCount) {
                node.editor.ports = Math.max(1, choiceCount);
            }

            return {
                id: node.id,
                name: node.speaker ? `${node.speaker}: ${node.text.slice(0, 15)}...` : node.text.slice(0, 20) + "...",
                text: node.text,
                x: node.editor.x,
                y: node.editor.y,
                width: node.editor.w || 220,
                height: node.editor.h || 140,
                portCount: node.editor.ports,
                data: node,
                index: index,
                isRoot: tree.rootNodeId === node.id
            };
        });

        this.updateConnections();
        this.draw();
    }

    updateConnections() {
        this.connections = [];
        this.nodes.forEach(node => {
            if (node.data.choices) {
                node.data.choices.forEach((choice, index) => {
                    if (choice.targetNodeId) {
                        const targetNode = this.nodes.find(n => n.id === choice.targetNodeId);
                        if (targetNode) {
                            this.connections.push({
                                from: node,
                                to: targetNode,
                                label: choice.text || 'Next',
                                type: 'one-way', // Dialogue flow is usually directed
                                choice: choice
                            });
                        }
                    }
                });
            }
        });
    }

    savePositions() {
        if (!this.tree) return;

        this.nodes.forEach(node => {
            node.data.editor = {
                x: node.x,
                y: node.y,
                w: node.width,
                h: node.height,
                ports: node.portCount
            };
        });
        saveData();
    }

    // Override Double Click to Edit Node
    onDoubleClick(e) {
        const { x, y } = this.getMousePos(e);

        // Check for node hit
        let clickedNode = null;
        for (let i = this.nodes.length - 1; i >= 0; i--) {
            const node = this.nodes[i];
            if (x >= node.x && x <= node.x + node.width &&
                y >= node.y && y <= node.y + node.height) {
                clickedNode = node;
                break;
            }
        }

        if (clickedNode) {
            // EDIT NODE w/ Modal
            openDialogueNodeEditorGlobal(clickedNode);
        } else {
            // CREATE NODE
            this.createNewNodeAt(x, y);
        }
    }

    createNewNodeAt(x, y) {
        if (!this.tree) return;

        const id = `node_${Date.now()}`;
        const newNode = {
            id: id,
            text: "Hello...",
            speaker: "player",
            choices: [],
            editor: { x, y, w: 220, h: 140, ports: 1 }
        };

        if (!this.tree.nodes) this.tree.nodes = [];
        this.tree.nodes.push(newNode);

        // If first node, make it root
        if (!this.tree.rootNodeId) {
            this.tree.rootNodeId = id;
        }

        this.loadTree(this.tree);
        saveData();
    }

    // Override Connection Creation
    async createConnection(source, target, portIndex = 0) {
        // In dialogue, a connection IS a choice
        console.log("DialogueGraphEditor.createConnection called:", { source: source.id, target: target.id, portIndex });

        const choiceText = await customPrompt("Option Text (what the player clicks):", "Continue");
        if (choiceText === null || choiceText.trim() === '') {
            console.log("Connection cancelled by user.");
            return;
        }

        if (!source.data.choices) source.data.choices = [];

        source.data.choices.push({
            text: choiceText,
            targetNodeId: target.id,
            portIndex: portIndex
        });

        console.log("Choice added:", source.data.choices);

        // Ensure Visual Port
        if (!source.data.editor) source.data.editor = {};
        if ((source.data.editor.ports || 1) <= portIndex) {
            source.data.editor.ports = portIndex + 1;
            source.portCount = source.data.editor.ports;
        }

        this.updateConnections();
        saveData();
        this.draw();
    }

    // Override onMouseDown to handle dialogue-specific delete behavior
    onMouseDown(e) {
        // Check for delete button click before calling parent
        if (e.button === 0) { // Left click only
            const { x, y } = this.getMousePos(e);

            // Check nodes for delete button hit
            for (let i = this.nodes.length - 1; i >= 0; i--) {
                const node = this.nodes[i];

                // Check Delete Button (bottom-left corner) - same coordinates as base GraphEditor
                if (x >= node.x + 5 && x <= node.x + 25 &&
                    y >= node.y + node.height - 25 && y <= node.y + node.height - 5) {
                    // Open delete confirmation for this dialogue node
                    this.deleteDialogueNode(node);
                    return;
                }
            }
        }

        // Call parent's onMouseDown for all other interactions
        super.onMouseDown(e);
    }

    deleteDialogueNode(node) {
        if (!this.tree) return;

        const nodeData = node.data;
        const nodeName = nodeData.text ? nodeData.text.slice(0, 30) + '...' : nodeData.id;

        if (!confirm(`Delete dialogue node "${nodeName}"?\n\nThis will remove the node and any connections to it.`)) {
            return;
        }

        // Find and remove the node from the tree
        const nodeIndex = this.tree.nodes.findIndex(n => n.id === nodeData.id);
        if (nodeIndex === -1) return;

        // Remove the node
        this.tree.nodes.splice(nodeIndex, 1);

        // Remove any choices pointing TO this node from other nodes
        this.tree.nodes.forEach(n => {
            if (n.choices) {
                n.choices = n.choices.filter(c => c.targetNodeId !== nodeData.id);
            }
        });

        // If deleted node was the root, update root to first remaining node
        if (this.tree.rootNodeId === nodeData.id) {
            this.tree.rootNodeId = this.tree.nodes.length > 0 ? this.tree.nodes[0].id : null;
        }

        // Reload the tree and save
        this.loadTree(this.tree);
        saveData();
    }

    deleteConnection(conn) {
        if (!confirm("Remove this connection?")) return;

        const source = conn.from;
        const target = conn.to;

        // Filter out choices pointing to target
        if (source.data.choices) {
            source.data.choices = source.data.choices.filter(c => c.targetNodeId !== target.id);
        }

        this.updateConnections();
        saveData();
        this.draw();
    }

    // Override Draw Node to show Root/Leaf status
    drawNode(node) {
        // Call super to draw base
        super.drawNode(node);

        const ctx = this.ctx;

        // Highlight Root Node
        if (node.isRoot) {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(node.x - 2, node.y - 2, node.width + 4, node.height + 4);

            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText("ROOT", node.x, node.y - 10);
        }

        // Draw Text Preview
        ctx.fillStyle = '#ccc';
        ctx.font = '12px "Inter", sans-serif';

        // Word wrap simple
        const words = node.text.split(' ');
        let line = '';
        let y = node.y + 60;
        const maxWidth = node.width - 20;

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                ctx.fillText(line, node.x + 10, y);
                line = words[n] + ' ';
                y += 15;
                if (y > node.y + node.height - 10) break; // Clip
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, node.x + 10, y);
    }
}

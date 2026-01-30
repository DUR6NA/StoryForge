
// State
let currentProject = null;
let currentProjectData = {
    story: [],
    locations: [],
    characters: [], // Changed to array for easier list management
    items: [],
    variables: {}, // Object is fine for variables { key: value }
    dialogues: [] // Dialogue trees
};

// --- Custom Prompt (Electron doesn't support native prompt()) ---
let customPromptResolver = null;

function customPrompt(title, defaultValue = '') {
    return new Promise((resolve) => {
        customPromptResolver = resolve;
        document.getElementById('custom-prompt-title').innerText = title;
        document.getElementById('custom-prompt-input').value = defaultValue;
        document.getElementById('modal-custom-prompt').classList.remove('hidden');
        document.getElementById('custom-prompt-input').focus();
        document.getElementById('custom-prompt-input').select();
    });
}

function resolveCustomPrompt(value) {
    document.getElementById('modal-custom-prompt').classList.add('hidden');
    if (customPromptResolver) {
        customPromptResolver(value);
        customPromptResolver = null;
    }
}

// Handle Enter key in custom prompt
document.addEventListener('keydown', (e) => {
    if (!document.getElementById('modal-custom-prompt').classList.contains('hidden')) {
        if (e.key === 'Enter') {
            resolveCustomPrompt(document.getElementById('custom-prompt-input').value);
        } else if (e.key === 'Escape') {
            resolveCustomPrompt(null);
        }
    }
});


// --- Navigation ---

function switchTab(tabName) {
    // 1. Update Navigation State
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active');
        if (el.innerText.trim().toLowerCase() === tabName ||
            (tabName === 'library' && el.innerText.trim().toLowerCase() === 'library')) {
            el.classList.add('active');
        }
    });

    // 2. Update Title
    document.getElementById('page-title').innerText = tabName.charAt(0).toUpperCase() + tabName.slice(1);

    // 3. Switch View
    const views = ['library', 'mods', 'editor', 'settings'];
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (v === tabName) {
            el.classList.remove('hidden');
            if (v === 'editor') {
                loadProjectList(); // Refresh project list when entering editor
            }
        } else {
            el.classList.add('hidden');
        }
    });
}

// --- Theme Management ---

const DEFAULT_THEME = 'forge';
const DEFAULT_THEMES = [
    { id: 'forge', name: 'Forge (Dark)', preview: 'linear-gradient(45deg, #121212, #2d2d2d)' },
    { id: 'light', name: 'Light (Modern)', preview: 'linear-gradient(135deg, #ffffff, #e2e8f0)' },
    { id: 'nebula', name: 'Nebula', preview: 'linear-gradient(125deg, #2b1055, #ff00cc)' },
    { id: 'cyberpunk', name: 'Cyberpunk', preview: 'linear-gradient(45deg, #050505, #ff0055)' },
    { id: 'nature', name: 'Nature', preview: 'linear-gradient(120deg, #f1f8e9, #7cb342)' },
    { id: 'midnight', name: 'Midnight', preview: 'linear-gradient(to right, #0f0c29, #ffd700)' },
    { id: 'matrix', name: 'Matrix', preview: 'linear-gradient(to bottom, #000, #003300)' },
    { id: 'stars', name: 'Starry Sky', preview: 'linear-gradient(to bottom, #050514, #101030)' }
];

function loadTheme() {
    // Load Custom Themes object: { id: { name, css, id } }
    let customThemes = {};
    try {
        customThemes = JSON.parse(localStorage.getItem('sf-custom-themes') || '{}');
    } catch (e) { console.error('Error loading custom themes', e); }

    // Inject all custom CSS (Still handled as style tags for now, unless we save them to files)
    // For separation, custom themes are still just "injected".
    Object.values(customThemes).forEach(t => injectCustomCSS(t.id, t.css));

    const saved = localStorage.getItem('sf-theme') || DEFAULT_THEME;

    // Render Grid
    renderThemeCards(saved, customThemes);

    applyTheme(saved, false);

    // Load Glass Mode
    const glassEnabled = localStorage.getItem('sf-glass-enabled') === 'true';
    toggleGlassMode(glassEnabled, false);
}

function renderThemeCards(currentThemeId, customThemes) {
    const list = document.getElementById('theme-list');
    if (!list) return;

    list.innerHTML = '';

    // 1. Default Themes
    DEFAULT_THEMES.forEach(t => {
        const card = createThemeCard(t, currentThemeId === t.id);
        list.appendChild(card);
    });

    // 2. Custom Themes
    Object.values(customThemes).forEach(t => {
        const card = createThemeCard({ ...t, preview: 'linear-gradient(45deg, #333, #666)' }, currentThemeId === t.id, true);
        list.appendChild(card);
    });

    // 3. Add New Button
    const addBtn = document.createElement('div');
    addBtn.className = 'theme-card add-theme';
    addBtn.innerHTML = '<div style="font-size:24px; margin-bottom:5px;">+</div><div>Install</div>';
    addBtn.onclick = handleThemeUpload;
    list.appendChild(addBtn);
}

function createThemeCard(theme, isActive, isCustom = false) {
    const div = document.createElement('div');
    div.className = `theme-card ${isActive ? 'active' : ''}`;
    div.dataset.id = theme.id;

    // Delete for custom
    let deleteBtn = '';
    let editBtn = '';
    if (isCustom) {
        deleteBtn = `<div onclick="deleteTheme('${theme.id}', event)" class="theme-action-btn delete" title="Delete">×</div>`;
        editBtn = `<div onclick="toggleThemeBuilder(true, '${theme.id}'); event.stopPropagation();" class="theme-action-btn edit" title="Edit">✎</div>`;
    } else {
        // Allow editing default themes as base
        editBtn = `<div onclick="toggleThemeBuilder(true, '${theme.id}'); event.stopPropagation();" class="theme-action-btn edit" title="Edit Copy">+</div>`;
    }

    div.innerHTML = `
        ${editBtn}
        ${deleteBtn}
        <div class="theme-preview" style="background: ${theme.preview}"></div>
        <div style="font-size:0.9em; font-weight:600;">${theme.name}</div>
    `;

    div.onclick = (e) => {
        if (e.target.closest('[onclick]')) return; // ignore delete clicks
        applyTheme(theme.id);
    };

    return div;
}

function deleteTheme(id, e) {
    e.stopPropagation();
    if (!confirm('Delete this theme?')) return;

    let customThemes = JSON.parse(localStorage.getItem('sf-custom-themes') || '{}');
    delete customThemes[id];
    localStorage.setItem('sf-custom-themes', JSON.stringify(customThemes));

    // Remove Stylesheet
    const el = document.getElementById(`style-${id}`);
    if (el) el.remove();

    // Switch to default if active
    if (localStorage.getItem('sf-theme') === id) {
        applyTheme(DEFAULT_THEME);
    } else {
        // Re-render
        loadTheme();
    }
}

function applyTheme(themeName, save = true) {
    // 1. Update <link> tag
    const link = document.getElementById('theme-stylesheet');
    const isCustom = themeName.startsWith('theme-custom-');

    if (!isCustom) {
        // Remove 'theme-' prefix if present (legacy compat)
        const folder = themeName.replace('theme-', '');
        // We assume we are in src/launcher/index.html or src/engine/game.html
        // Engine is in src/engine, so path to themes is ../themes
        // Launcher is in src/launcher, so path to themes is ../themes
        // Perfectly symmetric!
        link.href = `../themes/${folder}/style.css`;

        // Notify Effects (The effect script checks classList, but now we don't use classes)
        // We should add a generic class to body so effects know what to do
        document.body.className = document.body.className.replace(/theme-[\w-]+/g, ''); // Clear old
        document.body.classList.add(`theme-${folder}`);
    } else {
        // Custom themes are injected via <style> tags, so we unset the link or set to base
        link.href = '';
        // For custom themes, we might need a dummy class or just rely on the injected style
        document.body.className = document.body.className.replace(/theme-[\w-]+/g, '');
        document.body.classList.add(themeName);
    }

    if (save) {
        localStorage.setItem('sf-theme', themeName);
        let customThemes = {};
        try { customThemes = JSON.parse(localStorage.getItem('sf-custom-themes') || '{}'); } catch (e) { }
        renderThemeCards(themeName, customThemes);
    }
}

function toggleGlassMode(enabled, save = true) {
    if (enabled) {
        document.body.classList.add('glass-mode');
    } else {
        document.body.classList.remove('glass-mode');
    }

    if (save) {
        localStorage.setItem('sf-glass-enabled', enabled);
    }

    // Update Checkbox
    const cb = document.getElementById('glass-toggle');
    if (cb && cb.checked !== enabled) {
        cb.checked = enabled;
    }
}

function handleThemeUpload() {
    document.getElementById('theme-upload-input').click();
}

function processThemeUpload(input) {
    if (input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        const css = e.target.result;
        if (!css) return;

        // Generate unique ID
        const id = 'theme-custom-' + Date.now();
        const name = file.name.replace('.css', '') || 'Custom Theme';

        // Save
        let customThemes = JSON.parse(localStorage.getItem('sf-custom-themes') || '{}');
        customThemes[id] = { id, name, css };
        localStorage.setItem('sf-custom-themes', JSON.stringify(customThemes));

        injectCustomCSS(id, css);

        // Switch to it
        applyTheme(id);

        input.value = ''; // Reset
    };
    reader.readAsText(file);
}

function injectCustomCSS(id, css) {
    if (document.getElementById(`style-${id}`)) return;
    const style = document.createElement('style');
    style.id = `style-${id}`;

    // Ensure the CSS targets the specific class ID
    // If the user wrote .theme-custom { ... }, we might want to replace it with .id
    // But for simplicity, we assume they follow instructions OR we wrap it.
    // Making it robust: replace all .theme-custom with .[id]
    const scopedCSS = css.replace(/\.theme-custom/g, `.${id}`);

    style.innerHTML = scopedCSS;
    document.head.appendChild(style);
}

// --- Theme Creator ---

// --- Theme Creator ---

let editingThemeId = null;

function toggleThemeBuilder(editMode = false, themeId = null) {
    const panel = document.getElementById('theme-builder-panel');
    const wasHidden = panel.classList.contains('hidden');

    if (wasHidden) {
        panel.classList.remove('hidden');
    } else if (!editMode) {
        // Only close if not switching to edit mode while already open
        panel.classList.add('hidden');
    }

    if (!panel.classList.contains('hidden')) {
        if (editMode && themeId) {
            loadThemeToBuilder(themeId);
        } else if (wasHidden && !editingThemeId) {
            // New Theme mode - reset if freshly opened
            document.getElementById('tb-name').value = 'My Custom Theme';
        }
    } else {
        resetPreview();
        editingThemeId = null;
    }
}

function handleBgFileSelect(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('tb-bg-image').value = e.target.result;
            updateThemePreview();
        };
        reader.readAsDataURL(file);
    }
}

function loadThemeToBuilder(id) {
    editingThemeId = id;
    const theme = DEFAULT_THEMES.find(t => t.id === id);
    let customThemes = {};
    try { customThemes = JSON.parse(localStorage.getItem('sf-custom-themes') || '{}'); } catch (e) { }

    const cust = customThemes[id];
    const name = cust ? cust.name : (theme ? theme.name : 'Unknown');

    document.getElementById('tb-name').value = name;
    // Note: Parsing CSS to fill inputs is complex. We leave them as current defaults 
    // or previous values for now, allowing user to overwrite.
}

function updateThemePreview() {
    // This allows live preview by overriding the body style
    const bgP = document.getElementById('tb-bg-primary').value;
    const bgS = document.getElementById('tb-bg-secondary').value;
    const txt = document.getElementById('tb-text-primary').value;
    const acc = document.getElementById('tb-accent-color').value;
    const bord = document.getElementById('tb-border-color').value;
    const font = document.getElementById('tb-font-family').value;
    const bgImg = document.getElementById('tb-bg-image').value;

    // New controls
    const moveType = document.getElementById('tb-move-type').value;
    const duration = document.getElementById('tb-move-speed').value || 15;

    document.body.style.setProperty('--bg-primary', bgP);
    document.body.style.setProperty('--bg-secondary', bgS);
    document.body.style.setProperty('--text-primary', txt);
    document.body.style.setProperty('--accent-color', acc);
    document.body.style.setProperty('--accent-glow', acc + '66');
    document.body.style.setProperty('--border-color', bord);

    if (font) document.body.style.setProperty('--font-family', font);
    else document.body.style.removeProperty('--font-family');

    if (bgImg) {
        document.body.style.setProperty('--bg-gradient', `url('${bgImg}')`);
    } else {
        document.body.style.removeProperty('--bg-gradient');
    }

    const bgEl = document.getElementById('app-background');
    bgEl.style.animation = '';
    bgEl.style.backgroundSize = 'cover';

    // Effects
    document.body.classList.remove('theme-matrix', 'theme-stars');
    if (moveType === 'matrix') document.body.classList.add('theme-matrix');
    if (moveType === 'stars') document.body.classList.add('theme-stars');

    // Animations
    if (moveType === 'pan') {
        bgEl.style.backgroundSize = '200% 100%';
        bgEl.style.animation = `panMove ${duration}s linear infinite alternate`;
    } else if (moveType === 'pulse') {
        bgEl.style.animation = `pulseZoom ${duration}s ease-in-out infinite alternate`;
    }

    // Inject temporary keyframes if needed
    if (!document.getElementById('anim-styles')) {
        const style = document.createElement('style');
        style.id = 'anim-styles';
        style.innerHTML = `
            @keyframes panMove { 0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }
            @keyframes pulseZoom { 0% { transform: scale(1); } 100% { transform: scale(1.1); } }
        `;
        document.head.appendChild(style);
    }
}

function resetPreview() {
    document.body.style.removeProperty('--bg-primary');
    document.body.style.removeProperty('--bg-secondary');
    document.body.style.removeProperty('--text-primary');
    document.body.style.removeProperty('--accent-color');
    document.body.style.removeProperty('--accent-glow');
    document.body.style.removeProperty('--border-color');
    document.body.style.removeProperty('--font-family');
    document.body.style.removeProperty('--bg-gradient');

    const bgEl = document.getElementById('app-background');
    if (bgEl) {
        bgEl.style.backgroundSize = '';
        bgEl.style.animation = '';
    }
    document.body.classList.remove('theme-matrix', 'theme-stars');
}

function exportTheme() {
    const name = document.getElementById('tb-name').value || 'Custom Theme';
    const bgP = document.getElementById('tb-bg-primary').value;
    const bgS = document.getElementById('tb-bg-secondary').value;
    const txt = document.getElementById('tb-text-primary').value;
    const acc = document.getElementById('tb-accent-color').value;
    const bord = document.getElementById('tb-border-color').value;
    const font = document.getElementById('tb-font-family').value;
    const bgImg = document.getElementById('tb-bg-image').value;

    // New
    const moveType = document.getElementById('tb-move-type').value;
    const speed = document.getElementById('tb-move-speed').value || 15;

    // Generate ID
    const id = editingThemeId || 'theme-custom-' + Date.now();

    let extraCSS = '';
    let varsCSS = `    --bg-primary: ${bgP};
    --bg-secondary: ${bgS};
    --bg-tertiary: ${adjustColor(bgS, 20)};
    --text-primary: ${txt};
    --text-secondary: ${adjustColor(txt, -50)};
    --accent-color: ${acc};
    --accent-glow: ${acc}66;
    --accent-text: #ffffff;
    --border-color: ${bord};
    --panel-backdrop: none;
    --card-shadow: 0 4px 12px rgba(0,0,0,0.3);`;

    if (font) varsCSS += `\n    --font-family: ${font};`;

    if (bgImg) {
        varsCSS += `\n    --bg-gradient: url('${bgImg}');`;
    } else {
        varsCSS += `\n    --bg-gradient: linear-gradient(135deg, ${bgP}, ${bgS});`;
    }

    if (moveType === 'pan') {
        extraCSS += `
.theme-custom #app-background {
    background-size: 200% 100%;
    animation: panMove ${speed}s linear infinite alternate;
}
@keyframes panMove { 0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }
`;
    } else if (moveType === 'pulse') {
        extraCSS += `
.theme-custom #app-background {
    animation: pulseZoom ${speed}s ease-in-out infinite alternate;
}
@keyframes pulseZoom { 0% { transform: scale(1); } 100% { transform: scale(1.1); } }
`;
    } else if (moveType === 'matrix') {
        varsCSS += `\n    --theme-effect: "matrix";`;
    } else if (moveType === 'stars') {
        varsCSS += `\n    --theme-effect: "stars";`;
    }

    const css = `
/* Generated by StoryForge */
.theme-custom {
${varsCSS}
}
.theme-custom body {
    background: var(--bg-primary); 
}
${extraCSS}
`;

    // Download File (Standard .theme-custom for portability)
    const blob = new Blob([css], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name.replace(/\s+/g, '-').toLowerCase() + '.css';
    a.click();

    // Internal Install (scoped to ID)
    const scopedCSS = css.replace(/\.theme-custom/g, `.${id}`);

    let customThemes = JSON.parse(localStorage.getItem('sf-custom-themes') || '{}');
    customThemes[id] = { id, name, css: scopedCSS };
    localStorage.setItem('sf-custom-themes', JSON.stringify(customThemes));

    injectCustomCSS(id, scopedCSS);
    applyTheme(id);

    toggleThemeBuilder();
    alert('Theme saved and applied!');
}

// Simple color adjuster (Hex only)
function adjustColor(color, amount) {
    return color; // Placeholder, precise color math is complex to implement inline
}

function openThemeDocs() {
    const msg = `
    HOW TO CREATE A CUSTOM THEME
    =============================
    
    You can now use the "Open Creator" button to visually build themes with:
    - Custom colors for backgrounds, panels, and accents.
    - Custom Font Families (e.g. 'Roboto', 'Times New Roman').
    - Background Images (upload or URL).
    - Animated Backgrounds (Pan, Pulse, Matrix, Stars).

    ADVANCED MANUAL EDITING:
    If you manually edit a CSS file, you can use these new properties:
    
    --bg-gradient: url('image.jpg');  (Background override)
    --font-family: 'MyFont', sans-serif;
    --theme-effect: "matrix" | "stars"; (For full screen effects)
    
    Keyframes for animations (panMove, pulseZoom) can also be added.
    `;
    alert(msg);
}

// Initialize
window.addEventListener('DOMContentLoaded', loadTheme);

// --- Editor Navigation ---

function switchEditorTab(subTabName) {
    // 1. Update Sub-Navigation State
    document.querySelectorAll('.editor-nav-item').forEach(el => {
        el.classList.remove('active');
        if (el.getAttribute('onclick') && el.getAttribute('onclick').includes(`'${subTabName}'`)) {
            el.classList.add('active');
        }
    });

    // 2. Switch Sub-View
    const subViews = ['info', 'locations', 'characters', 'dialogues', 'player', 'paperdolls', 'items', 'vars', 'economy', 'walkthrough', 'settings'];
    subViews.forEach(v => {
        const el = document.getElementById(`editor-view-${v}`);
        if (el) {
            if (v === subTabName) {
                el.classList.remove('hidden');
                // Refresh list if needed
                if (v === 'locations') populateLocationList();
                if (v === 'characters') {
                    populateCharacterList();
                    updateShopCurrencyDropdown();
                }
                if (v === 'dialogues' && typeof populateDialogueList === 'function') populateDialogueList();
                if (v === 'player') populatePlayerTab();
                if (v === 'paperdolls') populatePaperdollList();
                if (v === 'items') populateItemList();
                if (v === 'vars') populateVariableList();
                if (v === 'economy') populateCurrencyList();
                if (v === 'walkthrough') populateWalkthroughEditor();
                if (v === 'settings') populateProjectSettings();
            } else {
                el.classList.add('hidden');
            }
        }
    });
}

function updateShopCurrencyDropdown() {
    const currSelect = document.getElementById('char-shop-currency');
    if (!currSelect) {
        console.warn("Currency dropdown not found in DOM");
        return;
    }
    const currentVal = currSelect.value;

    // Safety check for data
    if (!currentProjectData.currencies || !Array.isArray(currentProjectData.currencies)) {
        currentProjectData.currencies = [];
    }



    currSelect.innerHTML = '<option value="default">(Default) $</option>';

    currentProjectData.currencies.forEach(curr => {
        const opt = document.createElement('option');
        opt.value = curr.id;
        opt.innerText = `${curr.name} (${curr.symbol})`;
        currSelect.appendChild(opt);
    });

    // Try to restore previous selection
    if (currentVal) {
        currSelect.value = currentVal;
    }
}

// --- Project Management ---

async function loadProjectList() {
    const listContainer = document.getElementById('editor-project-list');
    // Keep the "New Project" card
    const createCard = listContainer.querySelector('.create-card');
    listContainer.innerHTML = '';
    listContainer.appendChild(createCard);

    const projects = await window.electronAPI.getProjects();

    projects.forEach(projectName => {
        const card = document.createElement('div');
        card.className = 'game-card';
        // Add relative positioning for delete button
        card.style.position = 'relative';

        card.innerHTML = `
            <div class="delete-btn" onclick="openDeleteModal('${projectName}', event)" 
                style="position:absolute; top:5px; right:5px; z-index:10; background:rgba(0,0,0,0.7); color:white; padding:5px 8px; border-radius:4px; font-size:12px; cursor:pointer;"
                title="Delete Project">🗑</div>
            <div class="card-image" style="background:var(--bg-tertiary);">
                <span style="font-size:40px; color:var(--text-secondary);">📁</span>
            </div>
            <div class="card-info">
                <div class="card-title">${projectName}</div>
                <div class="card-meta">Editable</div>
            </div>
        `;
        card.onclick = () => openProject(projectName);
        listContainer.appendChild(card);
    });
}


// --- Library Management ---

async function loadGameLibrary() {
    const grid = document.getElementById('game-grid');
    // Keep creation card
    const createCard = grid.querySelector('.create-card');
    grid.innerHTML = '';
    grid.appendChild(createCard);

    const projects = await window.electronAPI.getProjects();

    projects.forEach(projectName => {
        const card = document.createElement('div');
        card.className = 'game-card';
        // Add relative positioning for delete button
        card.style.position = 'relative';

        card.innerHTML = `
            <div class="delete-btn" onclick="openDeleteModal('${projectName}', event)" 
                style="position:absolute; top:5px; right:5px; z-index:10; background:rgba(0,0,0,0.7); color:white; padding:5px 8px; border-radius:4px; font-size:12px; cursor:pointer;"
                title="Delete Game">🗑</div>
            <div class="card-image" style="background:var(--bg-tertiary); display:flex; align-items:center; justify-content:center;">
                 <span style="font-size:40px; color:var(--text-secondary);">🎮</span>
            </div>
            <div class="card-info">
                <div class="card-title">${projectName}</div>
                <div class="card-meta">Ready to Play</div>
            </div>
        `;
        // Launch game with specific project
        card.onclick = () => {
            const currentTheme = localStorage.getItem('sf-theme') || 'theme-forge';
            const currentGlass = localStorage.getItem('sf-glass-enabled') === 'true';
            window.electronAPI.launchGame(projectName, currentTheme, currentGlass);
        };
        grid.appendChild(card);
    });
}

// Initial Load
loadGameLibrary();


function promptNewProject() {
    document.getElementById('modal-new-project').classList.remove('hidden');
    document.getElementById('new-project-name').value = '';
    document.getElementById('new-project-name').focus();
}

function closeNewProjectModal() {
    document.getElementById('modal-new-project').classList.add('hidden');
}

async function confirmNewProject() {
    const nameInput = document.getElementById('new-project-name');
    const name = nameInput.value.trim();
    if (!name) return;

    try {
        const result = await window.electronAPI.createProject(name);
        if (result.success) {
            closeNewProjectModal();
            loadProjectList();
            loadGameLibrary(); // Refresh main library
        } else {
            console.error("Create Project Error:", result.error);
            alert("Error creating project: " + result.error);
        }
    } catch (error) {
        console.error("IPC Error:", error);
        alert("An unexpected error occurred.");
    }
}


async function openProject(name) {
    currentProject = name;

    // Load Data
    try {
        const dataStr = await window.electronAPI.loadProjectFile(name, 'data.json');
        if (dataStr) {
            currentProjectData = JSON.parse(dataStr);
            // Ensure array types for new projects or migrations
            if (!Array.isArray(currentProjectData.characters)) currentProjectData.characters = [];
            if (!Array.isArray(currentProjectData.items)) currentProjectData.items = [];
            if (!currentProjectData.variables) currentProjectData.variables = {};
            if (!Array.isArray(currentProjectData.currencies)) currentProjectData.currencies = [];
            if (!Array.isArray(currentProjectData.dialogues)) currentProjectData.dialogues = [];
            if (!Array.isArray(currentProjectData.paperdolls)) currentProjectData.paperdolls = [];
            if (!currentProjectData.player) currentProjectData.player = { stats: [], config: { creationEnabled: false, visualType: 'none', defaultImage: '', openSections: { identity: true, appearance: true, stats: true, cheats: false }, startPoints: 10 } };
        } else {
            // New project default
            currentProjectData = { locations: [], characters: [], items: [], variables: {}, currencies: [], dialogues: [], player: { stats: [], config: { creationEnabled: false, visualType: 'none', defaultImage: '', openSections: { identity: true, appearance: true, stats: true, cheats: false }, startPoints: 10 } } };
        }
    } catch (e) {
        console.error("Failed to parse project data", e);
        alert("Failed to load project data.");
        return;
    }

    // Switch UI
    document.getElementById('editor-project-selector').classList.add('hidden');
    document.getElementById('editor-workspace').classList.remove('hidden');

    // Default to Info tab
    switchEditorTab('info');
}

function closeProject() {
    currentProject = null;
    currentProjectData = null;
    document.getElementById('editor-workspace').classList.add('hidden');
    document.getElementById('editor-project-selector').classList.remove('hidden');
    loadProjectList();
}

function populateLocationList() {
    const list = document.getElementById('location-list-container');
    if (!list) return;
    list.innerHTML = '';

    currentProjectData.locations.forEach((loc, index) => {
        const item = document.createElement('div');
        item.className = 'scene-item'; // Reuse style
        item.style.position = 'relative';
        item.innerHTML = `
            <div class="scene-id">${loc.id}</div>
            <div class="scene-text">${loc.name || 'Unknown'}</div>
            <button class="location-delete-btn" onclick="openDeleteLocationModal(${index}, event)" 
                title="Delete Location"
                style="position:absolute; top:50%; right:8px; transform:translateY(-50%); background:transparent; border:none; color:var(--text-secondary); cursor:pointer; font-size:14px; padding:4px 8px; opacity:0.5; transition: opacity 0.2s, color 0.2s;"
                onmouseenter="this.style.opacity='1'; this.style.color='red';"
                onmouseleave="this.style.opacity='0.5'; this.style.color='var(--text-secondary)';">🗑</button>
        `;
        item.onclick = (e) => {
            // Don't trigger if clicking delete button
            if (e.target.classList.contains('location-delete-btn')) return;
            loadLocationToForm(index);
        };
        list.appendChild(item);
    });
}

async function saveData() {
    if (!currentProject) return;
    try {
        await window.electronAPI.saveProjectFile(currentProject, 'data.json', JSON.stringify(currentProjectData, null, 4));
        console.log("Project saved.");
    } catch (e) {
        console.error("Failed to save project:", e);
        alert("Failed to save project changes!");
    }
}

let activeLocationIndex = -1;

function loadLocationToForm(index) {
    activeLocationIndex = index;
    const loc = currentProjectData.locations[index];
    document.getElementById('loc-id').value = loc.id || '';
    document.getElementById('loc-name').value = loc.name || '';
    document.getElementById('loc-text').value = loc.text || '';
    document.getElementById('loc-images').value = JSON.stringify(loc.images || {}, null, 4);

    // Load choices
    document.getElementById('scene-choices').value = JSON.stringify(loc.choices || [], null, 4);
    renderVisualChoices(loc.choices || []);
}

function addNewLocation() {
    // New location template
    const newLoc = {
        id: `loc_${Date.now()}`,
        name: "New Location",
        text: "You are in a new location.",
        images: {},
        choices: []
    };
    currentProjectData.locations.push(newLoc);
    saveData();
    populateLocationList();
    loadLocationToForm(currentProjectData.locations.length - 1);
    if (graphEditor) graphEditor.loadLocations(currentProjectData.locations);
}

function saveCurrentLocation() {
    if (activeLocationIndex === -1) return;

    const id = document.getElementById('loc-id').value;
    const name = document.getElementById('loc-name').value;
    const text = document.getElementById('loc-text').value;

    let images = {};
    try {
        images = JSON.parse(document.getElementById('loc-images').value);
    } catch (e) {
        alert("Invalid JSON for images");
        return;
    }

    let choices = [];
    try {
        choices = JSON.parse(document.getElementById('scene-choices').value);
    } catch (e) {
        alert("Invalid JSON for choices");
        return;
    }

    const oldLoc = currentProjectData.locations[activeLocationIndex];
    currentProjectData.locations[activeLocationIndex] = { ...oldLoc, id, name, text, images, choices };
    saveData();
    populateLocationList();
    if (graphEditor) graphEditor.loadLocations(currentProjectData.locations);
}

// --- Graph Editor Integration ---

let graphEditor = null;
let isGraphMode = false;

function toggleLocationViewMode() {
    isGraphMode = !isGraphMode;
    const btn = document.getElementById('btn-loc-view-toggle');
    const viewList = document.getElementById('loc-view-list');
    const viewGraph = document.getElementById('loc-view-graph');

    if (isGraphMode) {
        btn.innerText = "List View";
        viewList.classList.add('hidden');
        viewGraph.classList.remove('hidden');

        // Init if needed
        if (!graphEditor) {
            graphEditor = new GraphEditor('loc-graph-canvas', 'loc-view-graph');
        }
        graphEditor.loadLocations(currentProjectData.locations);
        graphEditor.resize();
    } else {
        btn.innerText = "Graph View";
        viewList.classList.remove('hidden');
        viewGraph.classList.add('hidden');
    }
}

window.addNewLocationAt = function (x, y) {
    const newLoc = {
        id: `loc_${Date.now()}`,
        name: "New Location",
        text: "You are in a new location.",
        images: {},
        choices: [],
        editor: { x: x, y: y }
    };
    currentProjectData.locations.push(newLoc);
    saveData();
    populateLocationList();
    if (graphEditor) graphEditor.loadLocations(currentProjectData.locations);
};

window.switchGraphToEdit = function () {
    // Switch back to list view to edit the selected node
    toggleLocationViewMode();
};

// --- Location Delete ---

let locationToDeleteIndex = -1;

function openDeleteLocationModal(index, event) {
    if (event) event.stopPropagation();
    locationToDeleteIndex = index;

    const loc = currentProjectData.locations[index];
    const modal = document.getElementById('modal-delete-location');
    const msg = document.getElementById('delete-location-msg');

    msg.innerText = `Are you sure you want to delete "${loc.name || loc.id}"?`;
    modal.classList.remove('hidden');
}

function closeDeleteLocationModal() {
    document.getElementById('modal-delete-location').classList.add('hidden');
    locationToDeleteIndex = -1;
}

function confirmDeleteLocation() {
    if (locationToDeleteIndex === -1) return;

    deleteLocation(locationToDeleteIndex);
    closeDeleteLocationModal();
}

function deleteLocation(index) {
    const locToDelete = currentProjectData.locations[index];
    if (!locToDelete) return;

    const locId = locToDelete.id;

    // Remove the location from the array
    currentProjectData.locations.splice(index, 1);

    // Clean up references to this location in other locations' choices
    currentProjectData.locations.forEach(loc => {
        if (loc.choices && Array.isArray(loc.choices)) {
            loc.choices = loc.choices.filter(choice => choice.target !== locId);
        }
    });

    // Reset active location if we deleted the currently selected one
    if (activeLocationIndex === index) {
        activeLocationIndex = -1;
        // Clear the form
        document.getElementById('loc-id').value = '';
        document.getElementById('loc-name').value = '';
        document.getElementById('loc-text').value = '';
        document.getElementById('loc-images').value = '{}';
        document.getElementById('scene-choices').value = '[]';
        const visualList = document.getElementById('visual-choices-list');
        if (visualList) visualList.innerHTML = '';
    } else if (activeLocationIndex > index) {
        // Adjust the active index if we deleted an item before it
        activeLocationIndex--;
    }

    saveData();
    populateLocationList();
    if (graphEditor) graphEditor.loadLocations(currentProjectData.locations);
}

// Expose to window for graph editor
window.openDeleteLocationModal = openDeleteLocationModal;
window.deleteLocation = deleteLocation;

function deleteActiveLocation() {
    if (activeLocationIndex === -1) {
        alert('No location is currently selected.');
        return;
    }
    openDeleteLocationModal(activeLocationIndex, null);
}

// --- Character Editor ---

// --- Character Editor ---

function populateCharacterList() {
    const list = document.getElementById('character-list-container');
    if (!list) return;
    list.innerHTML = '';

    currentProjectData.characters.forEach((char, index) => {
        const item = document.createElement('div');
        item.className = 'scene-item';
        item.innerHTML = `
            <div class="scene-id">${char.id}</div>
            <div class="scene-text">${char.name || 'Unnamed'}</div>
        `;
        item.onclick = () => loadCharacterToForm(index);
        list.appendChild(item);
    });
}

let activeCharacterIndex = -1;

function loadCharacterToForm(index) {
    activeCharacterIndex = index;
    const char = currentProjectData.characters[index];

    // Identity
    document.getElementById('char-id').value = char.id || '';
    document.getElementById('char-name').value = char.name || '';
    document.getElementById('char-description').value = char.description || '';
    document.getElementById('char-visibility').value = char.visibility || '';

    // Appearance
    const appearance = char.appearance || { type: 'image', path: '' }; // default
    document.getElementById('char-appearance-type').value = appearance.type || 'image';
    document.getElementById('char-image-path').value = appearance.path || '';

    // Populate select first if needed, though toggle does it too
    populatePaperdollSelect();
    document.getElementById('char-paperdoll-select').value = appearance.paperdollId || '';

    toggleCharAppearanceMode(); // Update visible fields

    // Shop
    const isShop = char.shop ? char.shop.enabled : false;
    document.getElementById('char-is-shop').checked = isShop;

    // Inventory Migration & Loading
    const shopContainer = document.getElementById('char-shop-items-container');
    shopContainer.innerHTML = '';

    let shopItems = [];
    if (char.shop && char.shop.items) {
        shopItems = char.shop.items;
    } else if (char.shop && char.shop.inventory) {
        // Migration from array of strings
        shopItems = char.shop.inventory.map(id => ({ id: id, price: 10, quantity: -1, condition: '' }));
    }

    shopItems.forEach(item => addShopItemRow(item));

    // Currency Select
    updateShopCurrencyDropdown();
    const currSelect = document.getElementById('char-shop-currency');
    currSelect.value = (char.shop && char.shop.currencyId) ? char.shop.currencyId : 'default';

    // Stats
    const statsContainer = document.getElementById('char-stats-container');
    statsContainer.innerHTML = '';
    const stats = char.stats || {};
    Object.keys(stats).forEach(key => addCharStatRow(key, stats[key]));

    // Schedule
    const schedContainer = document.getElementById('char-schedule-container');
    schedContainer.innerHTML = '';
    const schedule = char.schedule || [];
    schedule.forEach(event => addCharScheduleRow(event));

    // Dialogue
    const diagContainer = document.getElementById('char-dialogue-list');
    diagContainer.innerHTML = '';
    const dialogue = char.dialogue || [];
    dialogue.forEach(node => addCharDialogueNode(node));
}

function addNewCharacter() {
    const newChar = {
        id: `char_${Date.now()}`,
        name: "New Character",
        description: "",
        stats: { hp: 10, strength: 5 },
        schedule: [
            { time: "08:00", location: "", activity: "standing" }
        ],
        dialogue: [],
        shop: { enabled: false, inventory: [] },
        visibility: ""
    };
    currentProjectData.characters.push(newChar);
    saveData();
    populateCharacterList();
    loadCharacterToForm(currentProjectData.characters.length - 1);
}

function saveCurrentCharacter() {
    if (activeCharacterIndex === -1) return;

    // Identity
    const id = document.getElementById('char-id').value;
    const name = document.getElementById('char-name').value;
    const description = document.getElementById('char-description').value;
    const visibility = document.getElementById('char-visibility').value;

    // Appearance
    const appearanceType = document.getElementById('char-appearance-type').value;
    const appearance = {
        type: appearanceType,
        path: document.getElementById('char-image-path').value,
        paperdollId: document.getElementById('char-paperdoll-select').value
    };

    // Shop
    const isShop = document.getElementById('char-is-shop').checked;
    const currencyId = document.getElementById('char-shop-currency').value;

    const shopItems = [];
    document.querySelectorAll('#char-shop-items-container .shop-item-row').forEach(row => {
        const id = row.querySelector('.shop-item-id').value.trim();
        if (id) {
            const price = parseInt(row.querySelector('.shop-item-price').value) || 0;
            const quantity = parseInt(row.querySelector('.shop-item-qty').value); // NaN if empty, handle later or default
            const condition = row.querySelector('.shop-item-cond').value.trim();

            shopItems.push({
                id: id,
                price: price,
                quantity: isNaN(quantity) ? -1 : quantity,
                condition: condition
            });
        }
    });

    // Stats
    const stats = {};
    document.querySelectorAll('#char-stats-container .dynamic-item').forEach(row => {
        const key = row.querySelector('.stat-key').value.trim();
        const val = row.querySelector('.stat-val').value.trim();
        if (key) {
            stats[key] = !isNaN(Number(val)) ? Number(val) : val;
        }
    });

    // Schedule
    const schedule = [];
    document.querySelectorAll('#char-schedule-container .dynamic-item').forEach(row => {
        schedule.push({
            time: row.querySelector('.sched-time').value,
            location: row.querySelector('.sched-loc').value,
            activity: row.querySelector('.sched-act').value
        });
    });

    // Dialogue
    const dialogue = [];
    document.querySelectorAll('#char-dialogue-list .dynamic-item').forEach(row => {
        const dId = row.querySelector('.diag-id').value;
        const dText = row.querySelector('.diag-text').value;
        const dOpts = row.querySelector('.diag-opts-json').value;
        let options = [];
        try { options = JSON.parse(dOpts); } catch (e) { }

        // Capture limitations
        const limitations = {};
        const conditionEl = row.querySelector('.diag-condition');
        const hideUnavailableEl = row.querySelector('.diag-hide-unavailable');
        const maxUsesEl = row.querySelector('.diag-max-uses');

        if (conditionEl && conditionEl.value.trim()) {
            limitations.condition = conditionEl.value.trim();
        }
        if (hideUnavailableEl && hideUnavailableEl.checked) {
            limitations.hideIfUnavailable = true;
        }
        if (maxUsesEl && parseInt(maxUsesEl.value) > 0) {
            limitations.maxUses = parseInt(maxUsesEl.value);
        }

        const node = {
            id: dId,
            text: dText,
            options: options
        };

        // Only add limitations if there are any
        if (Object.keys(limitations).length > 0) {
            node.limitations = limitations;
        }

        dialogue.push(node);
    });

    // Save
    const oldChar = currentProjectData.characters[activeCharacterIndex];
    currentProjectData.characters[activeCharacterIndex] = {
        ...oldChar,
        id, name, description, visibility, appearance,
        stats, schedule, dialogue,
        shop: { enabled: isShop, items: shopItems, currencyId }
    };

    saveData();
    populateCharacterList();
}

// --- Character Editor Helpers ---

function addShopItemRow(data = {}) {
    const container = document.getElementById('char-shop-items-container');
    const row = document.createElement('div');
    row.className = 'shop-item-row';
    row.style.background = 'var(--bg-secondary)';
    row.style.padding = '10px';
    row.style.borderRadius = '4px';
    row.style.border = '1px solid var(--border-color)';

    row.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
            <label style="font-size:0.8em; opacity:0.7;">Item ID</label>
            <button class="item-delete-btn" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
        <input type="text" class="input-dark shop-item-id" placeholder="item_id" value="${data.id || ''}" style="width:100%; margin-bottom:5px;">
        
        <div style="display:flex; gap:10px; margin-bottom:5px;">
            <div style="flex:1;">
                <label style="font-size:0.8em; opacity:0.7;">Price</label>
                <input type="number" class="input-dark shop-item-price" placeholder="10" value="${data.price !== undefined ? data.price : 10}">
            </div>
            <div style="flex:1;">
                <label style="font-size:0.8em; opacity:0.7;">Stock (-1 for ∞)</label>
                <input type="number" class="input-dark shop-item-qty" placeholder="-1" value="${data.quantity !== undefined ? data.quantity : -1}">
            </div>
        </div>
        
        <div>
            <label style="font-size:0.8em; opacity:0.7;">Condition (JS)</label>
            <input type="text" class="input-dark shop-item-cond" placeholder="game.flags['can_buy']" value="${(data.condition || '').replace(/"/g, '&quot;')}">
        </div>
    `;
    container.appendChild(row);
}

function addCharStatRow(key = '', val = '') {
    const container = document.getElementById('char-stats-container');
    const row = document.createElement('div');
    row.className = 'dynamic-item';
    row.innerHTML = `
        <button class="item-delete-btn" onclick="this.parentElement.remove()">×</button>
        <div class="item-row">
            <input type="text" class="input-dark stat-key" placeholder="Stat Name (e.g. Strength)" value="${key}">
            <input type="text" class="input-dark stat-val" placeholder="Value" value="${val}">
        </div>
    `;
    container.appendChild(row);
}

function addCharScheduleRow(data = {}) {
    const container = document.getElementById('char-schedule-container');
    const row = document.createElement('div');
    row.className = 'dynamic-item';
    row.innerHTML = `
        <button class="item-delete-btn" onclick="this.parentElement.remove()">×</button>
        <div class="item-row">
            <label style="width:50px; font-size:0.8em;">Time:</label>
            <input type="time" class="input-dark sched-time" value="${data.time || '08:00'}">
        </div>
        <div class="item-row" style="margin-top:5px;">
            <label style="width:50px; font-size:0.8em;">Loc ID:</label>
            <input type="text" class="input-dark sched-loc" placeholder="Location ID" value="${data.location || ''}">
        </div>
        <div class="item-row" style="margin-top:5px;">
            <label style="width:50px; font-size:0.8em;">Action:</label>
            <input type="text" class="input-dark sched-act" placeholder="Activity (e.g. standing, sleeping)" value="${data.activity || ''}">
        </div>
    `;
    container.appendChild(row);
}

function addCharDialogueNode(data = {}) {
    const container = document.getElementById('char-dialogue-list');
    const row = document.createElement('div');
    row.className = 'dynamic-item';
    row.style.marginBottom = '15px';
    row.style.paddingBottom = '15px';
    row.style.borderBottom = '1px solid var(--border-color)';

    // Parse limitations from data
    const limitations = data.limitations || {};

    row.innerHTML = `
        <button class="item-delete-btn" onclick="this.parentElement.remove()">×</button>
        <div class="item-row">
            <span style="width:60px;">ID:</span>
            <input type="text" class="input-dark diag-id" placeholder="node_id" value="${data.id || 'start'}">
        </div>
        <div style="margin-top:5px;">
            <textarea class="input-dark diag-text" rows="2" placeholder="NPC says...">${data.text || ''}</textarea>
        </div>
        
        <!-- Limitations Section -->
        <details style="margin-top:10px; border:1px solid var(--border-color); border-radius:4px; padding:10px;">
            <summary style="cursor:pointer; font-weight:500; color:var(--accent-color);">⚡ Node Limitations</summary>
            <div style="margin-top:10px;">
                <div class="setting-row">
                    <label style="font-size:0.8em;">Visibility Condition (JS Expression)</label>
                    <input type="text" class="input-dark diag-condition" placeholder="e.g. variables.has_met_player == true" value="${limitations.condition || ''}">
                </div>
                <div class="setting-row" style="flex-direction:row; align-items:center; gap:10px;">
                    <input type="checkbox" class="diag-hide-unavailable" style="margin:0;" ${limitations.hideIfUnavailable ? 'checked' : ''}>
                    <label style="margin:0; font-size:0.8em;">Hide node if condition not met?</label>
                </div>
                <div class="setting-row">
                    <label style="font-size:0.8em;">Max Uses (0 = Infinite)</label>
                    <input type="number" class="input-dark diag-max-uses" placeholder="0" min="0" value="${limitations.maxUses || 0}">
                </div>
            </div>
        </details>
        
        <!-- Player Responses / Outcomes Section -->
        <div style="margin-top:10px;">
            <label style="font-size:0.9em; font-weight:500;">Player Responses / Outcomes</label>
            <p style="font-size:0.75em; opacity:0.6; margin:5px 0;">Add possible player responses. Each response can trigger actions like navigation, items, stats - just like Location Choices.</p>
            <!-- Hidden Input for Storage -->
            <input type="hidden" class="diag-opts-json" value='${JSON.stringify(data.options || [], null, 0).replace(/'/g, "&apos;")}'>
            
            <!-- Visual List -->
            <div class="diag-opts-visual-list" style="display:flex; flex-direction:column; gap:5px; margin-bottom:5px;"></div>
            
            <button class="secondary-btn" onclick="openDialogueOptionCreator(this)">+ Add Response</button>
        </div>
    `;
    container.appendChild(row);

    // Initial Render of Visuals
    const hiddenInput = row.querySelector('.diag-opts-json');
    const visualList = row.querySelector('.diag-opts-visual-list');
    renderDialogueOptionsVisuals(visualList, hiddenInput);
}

// --- Dialogue Option Visual Editor ---

let activeDialogueOptionsInput = null;
let activeDialogueVisualList = null;
let editingDialogueOptionIndex = -1;

function renderDialogueOptionsVisuals(visualList, hiddenInput) {
    let options = [];
    try { options = JSON.parse(hiddenInput.value); } catch (e) { }

    visualList.innerHTML = '';
    visualList.baseHiddenInput = hiddenInput;

    options.forEach((opt, index) => {
        const div = document.createElement('div');
        div.className = 'nav-item';
        div.style.background = 'var(--bg-tertiary)';
        div.style.padding = '8px 10px';
        div.style.fontSize = '0.9em';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.cursor = 'pointer';
        div.style.marginBottom = '3px';

        // Determine action label
        const actionLabel = opt.action === 'goto' ? 'Navigate' :
            opt.action === 'addItem' ? 'Get Item' :
                opt.action === 'modifyStat' ? 'Edit Stat' :
                    opt.action === 'modifyRel' ? 'Edit Relation' :
                        opt.action === 'npc_interact' ? 'Interact' :
                            opt.action === 'modify_paperdoll' ? 'Paperdoll' :
                                opt.action === 'unlock_image' ? 'Unlock Image' :
                                    opt.action === 'custom' ? 'Custom' :
                                        opt.next ? 'Next Node' : 'Response';

        // Target info: could be next node or target location
        const targetInfo = opt.target || opt.next || '';

        // Check for multi-outcomes
        const hasMultiOutcomes = opt.actions && Array.isArray(opt.actions) && opt.actions.length > 1;
        const multiLabel = hasMultiOutcomes ? `<span style="background: var(--accent-color); color: white; padding: 1px 5px; border-radius: 3px; font-size: 0.7em; margin-left: 5px;">+${opt.actions.length - 1}</span>` : '';

        div.innerHTML = `
            <span><b>${opt.text || 'Unnamed Response'}</b> <span style="opacity:0.6; font-size:0.8em">(${actionLabel})${multiLabel}</span></span>
            <span style="opacity:0.5; font-size:0.8em">${targetInfo ? '➔ ' + targetInfo : ''}</span>
        `;

        div.onclick = () => openDialogueOptionCreator(null, visualList, hiddenInput, index);
        visualList.appendChild(div);
    });
}

function openDialogueOptionCreator(btn, visualListRef, hiddenInputRef, index = -1) {
    if (btn) {
        // Called from Add Button
        const row = btn.parentElement;
        activeDialogueOptionsInput = row.querySelector('.diag-opts-json');
        activeDialogueVisualList = row.querySelector('.diag-opts-visual-list');
    } else {
        // Called from Edit Item
        activeDialogueOptionsInput = hiddenInputRef;
        activeDialogueVisualList = visualListRef;
    }

    editingDialogueOptionIndex = index;

    // Parse current data
    let options = [];
    try { options = JSON.parse(activeDialogueOptionsInput.value); } catch (e) { }
    let optionData = (index > -1) ? options[index] : {};

    // Reuse the Choice Editor Modal with FULL functionality
    const modal = document.getElementById('modal-choice-editor');
    modal.classList.remove('hidden');
    modal.dataset.context = 'dialogue'; // Set Context

    // Set Title
    document.getElementById('choice-title').innerText = index > -1 ? "Edit Response" : "Add Response";

    // Set ALL Fields (just like location choices)
    document.getElementById('choice-text-input').value = optionData.text || '';
    document.getElementById('choice-condition-input').value = optionData.condition || '';

    // For dialogue, we use 'next' for dialogue node navigation, and 'target' for location navigation
    // The target input will be used for location navigation when action is 'goto', otherwise for 'next' node
    document.getElementById('choice-target-input').value = optionData.target || optionData.next || '';

    // Determine template - default to 'next_node' for dialogue if no action set
    const template = optionData.action || 'next_node';
    document.getElementById('choice-template-select').value = template;

    // Advanced Limitations
    document.getElementById('choice-max-uses').value = optionData.maxUses || 0;
    document.getElementById('choice-hide-max').checked = optionData.hideAfterMax || false;
    document.getElementById('choice-req-var').value = optionData.reqVar || '';
    document.getElementById('choice-req-val').value = optionData.reqVal !== undefined ? optionData.reqVal : '';
    document.getElementById('choice-hide-unavailable').checked = optionData.hideIfUnavailable || false;

    // Set Variables
    document.getElementById('choice-set-var').value = optionData.setVar || '';
    document.getElementById('choice-set-val').value = optionData.setVal !== undefined ? optionData.setVal : '';

    // Show ALL UI elements (full choice editor)
    document.getElementById('choice-template-row').style.display = 'block';
    document.getElementById('choice-dynamic-fields').style.display = 'block';
    document.getElementById('choice-condition-row').style.display = 'flex';
    document.getElementById('choice-text-input').parentElement.style.display = '';
    document.getElementById('choice-target-input').parentElement.style.display = '';

    // Update target label for dialogue context
    document.getElementById('choice-target-label').innerText = "Target (Next Node ID or Location ID)";
    document.getElementById('choice-target-label').style.display = '';

    // Restore collapsible Advanced Limitations
    const details = document.getElementById('choice-adv-details');
    const summary = document.getElementById('choice-adv-summary');
    details.open = false;
    summary.style.display = 'list-item';
    details.style.border = '1px solid var(--border-color)';
    details.style.padding = '10px';

    // Update dynamic fields based on template
    updateChoiceTemplateFields(optionData);

    // Load existing multi-outcomes (actions array minus the primary action)
    currentOutcomes = [];
    if (optionData.actions && Array.isArray(optionData.actions)) {
        // The first action is the primary, the rest are additional outcomes
        currentOutcomes = optionData.actions.slice(1);
    }
    renderOutcomesList();
}

function saveDialogueOption() {
    // Called when context is 'dialogue'
    // Now saves ALL choice data just like location choices

    let options = [];
    try { options = JSON.parse(activeDialogueOptionsInput.value); } catch (e) { }

    const text = document.getElementById('choice-text-input').value;
    const condition = document.getElementById('choice-condition-input').value;
    const target = document.getElementById('choice-target-input').value;
    const action = document.getElementById('choice-template-select').value;

    let newOpt = { text, action };

    // Handle target/next based on action type
    if (action === 'next_node' && target) {
        newOpt.next = target; // For dialogue node navigation use 'next'
    } else if (target) {
        newOpt.target = target; // For location navigation use 'target'
    }

    if (condition) newOpt.condition = condition;

    // Advanced Limitations
    const maxUses = parseInt(document.getElementById('choice-max-uses').value) || 0;
    if (maxUses > 0) newOpt.maxUses = maxUses;

    if (document.getElementById('choice-hide-max').checked) newOpt.hideAfterMax = true;

    const reqVar = document.getElementById('choice-req-var').value.trim();
    if (reqVar) {
        newOpt.reqVar = reqVar;
        let reqVal = document.getElementById('choice-req-val').value.trim();
        if (reqVal === 'true') reqVal = true;
        else if (reqVal === 'false') reqVal = false;
        else if (!isNaN(Number(reqVal)) && reqVal !== '') reqVal = Number(reqVal);
        newOpt.reqVal = reqVal;
    }

    if (document.getElementById('choice-hide-unavailable').checked) newOpt.hideIfUnavailable = true;

    // Set Variables
    const setVar = document.getElementById('choice-set-var').value.trim();
    if (setVar) {
        newOpt.setVar = setVar;
        let setVal = document.getElementById('choice-set-val').value.trim();
        if (setVal === 'true') setVal = true;
        else if (setVal === 'false') setVal = false;
        else if (!isNaN(Number(setVal)) && setVal !== '') setVal = Number(setVal);
        newOpt.setVal = setVal;
    }

    // Action-specific data
    if (action === 'addItem') {
        const itemIdEl = document.getElementById('choice-item-id');
        if (itemIdEl) {
            const itemId = itemIdEl.value;
            if (itemId) {
                newOpt.itemId = itemId;
                newOpt.quantity = parseInt(document.getElementById('choice-item-qty').value) || 1;
                const item = currentProjectData.items.find(i => i.id === itemId);
                if (item) newOpt.itemName = item.name;
            }
        }
    } else if (action === 'modifyStat') {
        const statEl = document.getElementById('choice-stat-name');
        if (statEl) {
            newOpt.stat = statEl.value;
            newOpt.value = parseInt(document.getElementById('choice-stat-val').value) || 0;
        }
    } else if (action === 'modifyRel') {
        const npcIdEl = document.getElementById('choice-npc-id');
        if (npcIdEl) {
            newOpt.npcId = npcIdEl.value;
            const npc = currentProjectData.characters.find(c => c.id === newOpt.npcId);
            if (npc) newOpt.npcName = npc.name;
            newOpt.value = parseInt(document.getElementById('choice-npc-val').value) || 0;
        }
    } else if (action === 'modify_paperdoll') {
        const charIdEl = document.getElementById('choice-target-char');
        if (charIdEl) {
            newOpt.charId = charIdEl.value || 'player';
            newOpt.layer = document.getElementById('choice-layer').value;
            const imgIdx = document.getElementById('choice-img-idx').value;
            const colIdx = document.getElementById('choice-col-idx').value;
            if (imgIdx !== '') newOpt.imageIndex = parseInt(imgIdx);
            if (colIdx !== '') newOpt.colorIndex = parseInt(colIdx);
        }
    } else if (action === 'npc_interact') {
        const npcTargetEl = document.getElementById('choice-npc-target');
        if (npcTargetEl) {
            newOpt.target = npcTargetEl.value;
        }
    } else if (action === 'unlock_image') {
        const imageIdEl = document.getElementById('choice-unlock-image-id');
        if (imageIdEl) {
            newOpt.imageId = imageIdEl.value;
        }
    }

    // Build actions array if there are additional outcomes
    if (currentOutcomes && currentOutcomes.length > 0) {
        // Create primary action object from the main dialogue option data
        const primaryAction = { action: newOpt.action || 'next_node' };
        if (newOpt.next) primaryAction.next = newOpt.next;
        if (newOpt.target) primaryAction.target = newOpt.target;
        if (newOpt.itemId) {
            primaryAction.itemId = newOpt.itemId;
            primaryAction.quantity = newOpt.quantity;
            if (newOpt.itemName) primaryAction.itemName = newOpt.itemName;
        }
        if (newOpt.stat) {
            primaryAction.stat = newOpt.stat;
            primaryAction.value = newOpt.value;
        }
        if (newOpt.npcId) {
            primaryAction.npcId = newOpt.npcId;
            primaryAction.value = newOpt.value;
            if (newOpt.npcName) primaryAction.npcName = newOpt.npcName;
        }
        if (newOpt.imageId) primaryAction.imageId = newOpt.imageId;
        if (newOpt.charId) {
            primaryAction.charId = newOpt.charId;
            primaryAction.layer = newOpt.layer;
            if (newOpt.imageIndex !== undefined) primaryAction.imageIndex = newOpt.imageIndex;
            if (newOpt.colorIndex !== undefined) primaryAction.colorIndex = newOpt.colorIndex;
        }

        // Combine primary action with additional outcomes
        newOpt.actions = [primaryAction, ...currentOutcomes];
    }

    if (editingDialogueOptionIndex > -1) {
        options[editingDialogueOptionIndex] = newOpt;
    } else {
        options.push(newOpt);
    }

    activeDialogueOptionsInput.value = JSON.stringify(options);
    renderDialogueOptionsVisuals(activeDialogueVisualList, activeDialogueOptionsInput);
    closeChoiceEditor();
}

// --- Items Editor ---

function populateItemList() {
    const list = document.getElementById('item-list-container');
    if (!list) return;
    list.innerHTML = '';

    currentProjectData.items.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'scene-item';
        el.innerHTML = `
            <div class="scene-id">${item.id}</div>
            <div class="scene-text">${item.name || 'Unnamed Item'}</div>
        `;
        el.onclick = () => loadItemToForm(index);
        list.appendChild(el);
    });
}

let activeItemIndex = -1;

function loadItemToForm(index) {
    activeItemIndex = index;
    const item = currentProjectData.items[index];
    document.getElementById('item-id').value = item.id || '';
    document.getElementById('item-name').value = item.name || '';
    document.getElementById('item-type').value = item.type || 'item';
    document.getElementById('item-effects').value = JSON.stringify(item.effects || {}, null, 4);
}

function addNewItem() {
    const newItem = { id: `item_${Date.now()}`, name: "New Item", type: "item", effects: {} };
    currentProjectData.items.push(newItem);
    saveData();
    populateItemList();
    loadItemToForm(currentProjectData.items.length - 1);
}

function saveCurrentItem() {
    if (activeItemIndex === -1) return;

    const id = document.getElementById('item-id').value;
    const name = document.getElementById('item-name').value;
    const type = document.getElementById('item-type').value;
    let effects = {};
    try {
        effects = JSON.parse(document.getElementById('item-effects').value);
    } catch (e) {
        alert("Invalid JSON for effects");
        return;
    }

    const oldItem = currentProjectData.items[activeItemIndex];
    currentProjectData.items[activeItemIndex] = { ...oldItem, id, name, type, effects };
    saveData();
    populateItemList();
}

// --- Variables Editor ---

function populateVariableList() {
    const container = document.getElementById('vars-list-container');
    if (!container) return;
    container.innerHTML = '';

    if (!currentProjectData.variables) currentProjectData.variables = {};

    // Create a simple table or list of inputs
    Object.keys(currentProjectData.variables).forEach(key => {
        const val = currentProjectData.variables[key];
        const row = document.createElement('div');
        row.className = 'setting-row';
        row.style.flexDirection = 'row';
        row.style.alignItems = 'center';
        row.innerHTML = `
            <input type="text" value="${key}" readonly style="width:150px; background:var(--bg-tertiary); color:var(--text-secondary); border:1px solid var(--border-color); padding:5px; margin-right:10px;">
            <input type="text" value="${val}" onchange="updateVariable('${key}', this.value)" style="flex:1; background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border-color); padding:5px;">
            <button class="secondary-btn" onclick="deleteVariable('${key}')" style="margin-left:10px; color:red; border-color:red;">X</button>
        `;
        container.appendChild(row);
    });
}

function updateVariable(key, value) {
    // Try to parse numbers/booleans
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (!isNaN(Number(value)) && value !== '') value = Number(value);

    currentProjectData.variables[key] = value;
    saveData();
}

function addNewVariable() {
    document.getElementById('modal-new-variable').classList.remove('hidden');
    document.getElementById('new-variable-name').value = '';
    document.getElementById('new-variable-name').focus();
}

function closeNewVariableModal() {
    document.getElementById('modal-new-variable').classList.add('hidden');
}

function confirmNewVariable() {
    const nameInput = document.getElementById('new-variable-name');
    const name = nameInput.value.trim();
    if (!name) return;

    if (!currentProjectData.variables) currentProjectData.variables = {};

    if (currentProjectData.variables.hasOwnProperty(name)) {
        alert("Variable already exists!");
        return;
    }

    currentProjectData.variables[name] = false; // Default value
    saveData();
    populateVariableList();
    closeNewVariableModal();
}

function deleteVariable(key) {
    if (confirm(`Delete variable '${key}'?`)) {
        delete currentProjectData.variables[key];
        saveData();
        populateVariableList();
    }
}

// --- Visual Choice Editor Logic ---

let editingChoiceIndex = -1;

function parseChoicesFromJSON() {
    try {
        const raw = document.getElementById('scene-choices').value;
        const choices = JSON.parse(raw);
        renderVisualChoices(choices);
    } catch (e) {
        // Ignore JSON errors while typing
    }
}

function renderVisualChoices(choices) {
    const list = document.getElementById('visual-choices-list');
    list.innerHTML = '';
    choices.forEach((c, i) => {
        const row = document.createElement('div');
        row.className = 'nav-item'; // Reuse existing style for hover effect
        row.style.background = 'var(--bg-tertiary)';
        row.style.marginBottom = '5px';
        row.style.justifyContent = 'space-between';

        const actionLabel = c.action === 'goto' ? 'Navigate' :
            c.action === 'next_node' ? 'Next Node' :
                c.action === 'addItem' ? 'Get Item' :
                    c.action === 'modifyStat' ? 'Edit Stat' :
                        c.action === 'modifyRel' ? 'Edit Relation' :
                            c.action === 'npc_interact' ? 'Interact' :
                                c.action === 'start_dialogue' ? 'Start Dialogue' :
                                    c.action === 'modify_paperdoll' ? 'Paperdoll' :
                                        c.action === 'unlock_image' ? 'Unlock Image' :
                                            c.action === 'custom' ? 'Custom' :
                                                c.action || 'Navigate';

        // Check for multi-outcomes
        const hasMultiOutcomes = c.actions && Array.isArray(c.actions) && c.actions.length > 1;
        const multiLabel = hasMultiOutcomes ? `<span style="background: var(--accent-color); color: white; padding: 1px 5px; border-radius: 3px; font-size: 0.7em; margin-left: 5px;">+${c.actions.length - 1}</span>` : '';

        row.innerHTML = `
            <span><b>${c.text || 'Unnamed'}</b> <span style="opacity:0.6; font-size:0.8em">(${actionLabel})${multiLabel}</span></span>
            <span style="opacity:0.5; font-size:0.8em">➔ ${c.target || 'None'}</span>
        `;
        row.onclick = () => openChoiceEditor(i);
        list.appendChild(row);
    });
}

function openChoiceEditor(index = -1) {
    editingChoiceIndex = index;
    const modal = document.getElementById('modal-choice-editor');
    modal.classList.remove('hidden');
    modal.dataset.context = 'scene'; // Default context

    let choice = {};
    if (index > -1) {
        try {
            const choices = JSON.parse(document.getElementById('scene-choices').value);
            choice = choices[index];
        } catch (e) { }
    }

    document.getElementById('choice-text-input').value = choice.text || '';
    document.getElementById('choice-condition-input').value = choice.condition || '';
    document.getElementById('choice-target-input').value = choice.target || '';

    // Advanced Limitations
    document.getElementById('choice-max-uses').value = choice.maxUses || 0;
    document.getElementById('choice-hide-max').checked = choice.hideAfterMax || false;
    document.getElementById('choice-req-var').value = choice.reqVar || '';
    document.getElementById('choice-req-val').value = choice.reqVal !== undefined ? choice.reqVal : '';
    document.getElementById('choice-hide-unavailable').checked = choice.hideIfUnavailable || false;

    // Set Variables (Reset for safe measure, though Scene Choices don't use them yet? 
    // Actually, Scene Choices DO handle 'modifyStat' or custom scripts, but simple SetVar isn't exposed in UI for scene choices unless via specific template.
    // Let's clear them just in case.)
    document.getElementById('choice-set-var').value = '';
    document.getElementById('choice-set-val').value = '';

    // Determine template
    const template = choice.action || 'goto';
    document.getElementById('choice-template-select').value = template;

    updateChoiceTemplateFields(choice);

    // UI Reset for Standard Context
    document.getElementById('choice-template-row').style.display = 'block';
    document.getElementById('choice-target-label').innerText = "Target Scene ID (Consequent Navigation)";
    document.getElementById('choice-title').innerText = "Edit Choice";

    // Restore collapsible Advanced Limitations
    const details = document.getElementById('choice-adv-details');
    const summary = document.getElementById('choice-adv-summary');
    details.open = false; // Closed by default
    summary.style.display = 'list-item'; // Restore summary
    details.style.border = '1px solid var(--border-color)';
    details.style.padding = '10px';

    // Restore Standard Fields
    document.getElementById('choice-dynamic-fields').style.display = 'block';
    document.getElementById('choice-condition-row').style.display = 'flex';
    document.getElementById('choice-text-input').parentElement.style.display = '';
    document.getElementById('choice-target-input').parentElement.style.display = '';

    // Load existing multi-outcomes (actions array minus the primary action)
    currentOutcomes = [];
    if (choice.actions && Array.isArray(choice.actions)) {
        // The first action is the primary, the rest are additional outcomes
        currentOutcomes = choice.actions.slice(1);
    }
    renderOutcomesList();
}

function closeChoiceEditor() {
    document.getElementById('modal-choice-editor').classList.add('hidden');
}

// --- Helpers ---
window.openImagePicker = function (callback) {
    // Create a hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // In a real electron app, we'd get the full path. 
            // Here due to browser security restrictions in some contexts, we might get a fake path.
            // However, since this is Electron context (renderer), we usually get 'path'.
            // If we are in 'web' mode, we might just use the name or object URL (not persistent).
            // Assuming Electron environment as per 'renderer.js'.
            let path = file.path;
            // Try to make relative to project path if possible? 
            // We don't have project path easily here.
            // Just return name or relative path if inside assets.
            // For now, let's just use the name for simplicity if path is absolute/hidden.
            if (!path) path = "assets/" + file.name;

            // Simplistic relative path conversion if path contains 'assets'
            if (path.includes('assets')) {
                path = 'assets' + path.split('assets')[1];
            }
            path = path.replace(/\\/g, '/'); // Normalize slashes

            callback(path);
        }
        document.body.removeChild(input);
    };

    input.click();
};

function updateChoiceTemplateFields(existingData = {}) {
    // If called from event, existingData might be the event object, so check it
    if (existingData.target || existingData.type === 'change') existingData = {};

    const type = document.getElementById('choice-template-select').value;
    const container = document.getElementById('choice-dynamic-fields');
    container.innerHTML = '';

    // Styles
    const inputStyle = "width:100%; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); padding:8px; margin-bottom:5px;";

    if (type === 'addItem') {
        // Item Select
        const label = document.createElement('label');
        label.innerText = "Select Item to Give:";
        container.appendChild(label);

        const sel = document.createElement('select');
        sel.id = 'choice-item-id';
        sel.style = inputStyle;

        // Add empty option
        const empty = document.createElement('option');
        empty.value = "";
        empty.innerText = "-- Select Item --";
        sel.appendChild(empty);

        currentProjectData.items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.innerText = (item.name || 'Unnamed') + ` (${item.id})`;
            if (existingData.itemId === item.id) opt.selected = true;
            sel.appendChild(opt);
        });
        container.appendChild(sel);

        // Quantity
        const qtyLabel = document.createElement('label');
        qtyLabel.innerText = "Quantity:";
        container.appendChild(qtyLabel);

        const qty = document.createElement('input');
        qty.type = 'number';
        qty.id = 'choice-item-qty';
        qty.placeholder = '1';
        qty.value = existingData.quantity || 1;
        qty.style = inputStyle;
        container.appendChild(qty);

    } else if (type === 'modifyStat') {
        const lbl1 = document.createElement('label');
        lbl1.innerText = "Stat Name (e.g., strength, intelligence):";
        container.appendChild(lbl1);

        const stat = document.createElement('input');
        stat.id = 'choice-stat-name';
        stat.placeholder = 'strength';
        stat.value = existingData.stat || '';
        stat.style = inputStyle;
        container.appendChild(stat);

        const lbl2 = document.createElement('label');
        lbl2.innerText = "Value Change (can be negative):";
        container.appendChild(lbl2);

        const val = document.createElement('input');
        val.type = 'number';
        val.id = 'choice-stat-val';
        val.placeholder = '1';
        val.value = existingData.value !== undefined ? existingData.value : 1;
        val.style = inputStyle;
        container.appendChild(val);

    } else if (type === 'modifyRel') {
        const lbl1 = document.createElement('label');
        lbl1.innerText = "Select Character:";
        container.appendChild(lbl1);

        // NPC Select
        const sel = document.createElement('select');
        sel.id = 'choice-npc-id';
        sel.style = inputStyle;

        currentProjectData.characters.forEach(char => {
            const opt = document.createElement('option');
            opt.value = char.id;
            opt.innerText = (char.name || 'Unnamed') + ` (${char.id})`;
            if (existingData.npcId === char.id) opt.selected = true;
            sel.appendChild(opt);
        });
        container.appendChild(sel);

        const lbl2 = document.createElement('label');
        lbl2.innerText = "Relationship Change:";
        container.appendChild(lbl2);

        const val = document.createElement('input');
        val.type = 'number';
        val.id = 'choice-npc-val';
        val.placeholder = '5';
        val.value = existingData.value !== undefined ? existingData.value : 5;
        val.style = inputStyle;
        container.appendChild(val);
    } else if (type === 'npc_interact') {
        const lbl = document.createElement('label');
        lbl.innerText = "Select Character to Interact With:";
        container.appendChild(lbl);

        const sel = document.createElement('select');
        sel.id = 'choice-npc-target'; // Different ID
        sel.style = inputStyle;

        currentProjectData.characters.forEach(char => {
            const opt = document.createElement('option');
            opt.value = char.id;
            opt.innerText = (char.name || 'Unnamed') + ` (${char.id})`;
            // Check 'target' property for this type
            if (existingData.target === char.id) opt.selected = true;
            sel.appendChild(opt);
        });
        container.appendChild(sel);
    } else if (type === 'ui_event') {
        const lbl1 = document.createElement('label');
        lbl1.innerText = "Event Description (Modal Text):";
        container.appendChild(lbl1);

        const desc = document.createElement('textarea');
        desc.id = 'choice-event-desc';
        desc.rows = 3;
        desc.style = inputStyle;
        desc.value = existingData.eventDescription || '';
        container.appendChild(desc);

        const lbl2 = document.createElement('label');
        lbl2.innerText = "Event Image (Optional):";
        container.appendChild(lbl2);

        const imgDiv = document.createElement('div');
        imgDiv.style = "display:flex; gap:5px;";

        const img = document.createElement('input');
        img.id = 'choice-event-image';
        img.type = 'text';
        img.style = "flex:1; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); padding:8px;";
        img.placeholder = 'assets/events/gym.jpg';
        img.value = existingData.eventImage || '';
        imgDiv.appendChild(img);

        const browseBtn = document.createElement('button');
        browseBtn.className = 'secondary-btn';
        browseBtn.innerText = 'Browse';
        browseBtn.onclick = () => window.openImagePicker && window.openImagePicker((path) => img.value = path);
        imgDiv.appendChild(browseBtn);

        container.appendChild(imgDiv);

    } else if (type === 'next_node') {
        container.innerHTML = '<p style="opacity:0.7; font-size:0.9em; padding:5px;">Move to the next dialogue node. Set the target Node ID below.</p>';
        document.getElementById('choice-target-label').innerText = "Next Dialogue Node ID";
    } else if (type === 'goto') {
        container.innerHTML = '<p style="opacity:0.7; font-size:0.9em; padding:5px;">Navigate to a location. Set the target Location ID below.</p>';
        document.getElementById('choice-target-label').innerText = "Target Location ID";
    } else if (type === 'modify_paperdoll') {
        // IMPROVED PAPERDOLL CONTROLS
        const lbl1 = document.createElement('label');
        lbl1.innerText = "Target Character:";
        container.appendChild(lbl1);

        const charSel = document.createElement('select');
        charSel.id = 'choice-target-char';
        charSel.style = inputStyle;
        charSel.innerHTML = '<option value="player">Player</option>';
        currentProjectData.characters.forEach(c => {
            charSel.innerHTML += `<option value="${c.id}" ${existingData.charId === c.id ? 'selected' : ''}>${c.name}</option>`;
        });
        container.appendChild(charSel);

        const lbl2 = document.createElement('label');
        lbl2.innerText = "Layer to Modify:";
        container.appendChild(lbl2);

        const layerSel = document.createElement('select');
        layerSel.id = 'choice-layer';
        layerSel.style = inputStyle;
        ['body', 'hair_back', 'hair_front', 'eyes', 'mouth', 'top', 'bottom', 'outfit', 'shoe', 'accessory'].forEach(l => {
            layerSel.innerHTML += `<option value="${l}" ${existingData.layer === l ? 'selected' : ''}>${l}</option>`;
        });
        container.appendChild(layerSel);

        const lbl3 = document.createElement('label');
        lbl3.innerText = "Image ID:";
        container.appendChild(lbl3);

        const imgSel = document.createElement('select');
        imgSel.id = 'choice-img-idx';
        imgSel.style = inputStyle;

        const populateImages = () => {
            imgSel.innerHTML = '<option value="">-- No Change / Select --</option>';
            // Prototype: assume player doll
            const doll = currentProjectData.paperdolls && currentProjectData.paperdolls[0];
            if (doll) {
                const layerObj = doll.layers.find(l => l.id === layerSel.value || l.name === layerSel.value);
                if (layerObj && layerObj.items) {
                    layerObj.items.forEach(i => {
                        imgSel.innerHTML += `<option value="${i.id}" ${existingData.imageIndex == i.id ? 'selected' : ''}>${i.id}</option>`;
                    });
                }
            }
        };
        layerSel.onchange = populateImages;
        populateImages();
        container.appendChild(imgSel);

        const lbl4 = document.createElement('label');
        lbl4.innerText = "Color Index (Number, Optional):";
        container.appendChild(lbl4);

        const colInput = document.createElement('input');
        colInput.type = 'number';
        colInput.id = 'choice-col-idx';
        colInput.placeholder = '0';
        colInput.value = existingData.colorIndex !== undefined ? existingData.colorIndex : '';
        colInput.style = inputStyle;
        container.appendChild(colInput);

        // Hide standard target for this action
        document.getElementById('choice-target-input').parentElement.style.display = 'none';
    } else if (type === 'unlock_image') {
        const lbl = document.createElement('label');
        lbl.innerText = "Image ID to Unlock:";
        container.appendChild(lbl);

        const imgDiv = document.createElement('div');
        imgDiv.style = "display:flex; gap:5px;";

        const img = document.createElement('input');
        img.id = 'choice-unlock-image-id';
        img.type = 'text';
        img.style = "flex:1; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); padding:8px;";
        img.placeholder = 'assets/cg/scene_1.jpg';
        img.value = existingData.imageId || '';
        imgDiv.appendChild(img);

        const browseBtn = document.createElement('button');
        browseBtn.className = 'secondary-btn';
        browseBtn.innerText = 'Browse';
        browseBtn.onclick = () => window.openImagePicker && window.openImagePicker((path) => img.value = path);
        imgDiv.appendChild(browseBtn);

        container.appendChild(imgDiv);

        // Hide standard target for this action
        document.getElementById('choice-target-input').parentElement.style.display = 'none';
    } else if (type === 'start_dialogue') {
        const lbl = document.createElement('label');
        lbl.innerText = "Select Dialogue Tree to Start:";
        container.appendChild(lbl);

        const sel = document.createElement('select');
        sel.id = 'choice-dialogue-tree';
        sel.style = inputStyle;

        // Add empty option
        const empty = document.createElement('option');
        empty.value = "";
        empty.innerText = "-- Select Dialogue Tree --";
        sel.appendChild(empty);

        // Populate with dialogue trees
        (currentProjectData.dialogues || []).forEach(dialogue => {
            const opt = document.createElement('option');
            opt.value = dialogue.id;
            opt.innerText = (dialogue.name || 'Unnamed Dialogue') + ` (${dialogue.id})`;
            if (existingData.dialogueId === dialogue.id) opt.selected = true;
            sel.appendChild(opt);
        });
        container.appendChild(sel);

        // Hide standard target for this action
        document.getElementById('choice-target-input').parentElement.style.display = 'none';
    }
}

// --- Multi-Outcome System ---

let currentOutcomes = []; // Stores additional outcomes for the current choice

function renderOutcomesList() {
    const container = document.getElementById('choice-outcomes-list');
    if (!container) return;

    container.innerHTML = '';

    currentOutcomes.forEach((outcome, index) => {
        const div = document.createElement('div');
        div.className = 'outcome-item';
        div.style.cssText = 'background: var(--bg-tertiary); padding: 10px; border-radius: 4px; border: 1px solid var(--border-color); position: relative;';

        // Determine action label
        const actionLabel = getActionLabel(outcome.action || outcome.type);
        const targetInfo = outcome.target || outcome.imageId || outcome.itemId || outcome.stat || '';

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="font-weight: 500; color: var(--accent-color);">${actionLabel}</span>
                    ${targetInfo ? `<span style="opacity: 0.7; font-size: 0.85em;"> ➡️ ${targetInfo}</span>` : ''}
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="secondary-btn" style="padding: 2px 8px; font-size: 0.8em;" onclick="editChoiceOutcome(${index})">Edit</button>
                    <button class="secondary-btn" style="padding: 2px 8px; font-size: 0.8em; color: red; border-color: red;" onclick="removeChoiceOutcome(${index})">×</button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function getActionLabel(action) {
    const labels = {
        'goto': '📍 Navigate',
        'addItem': '📦 Add Item',
        'modifyStat': '📊 Modify Stat',
        'modifyRel': '❤️ Modify Relation',
        'npc_interact': '💬 NPC Interact',
        'start_dialogue': '🗣️ Start Dialogue',
        'modify_paperdoll': '👤 Paperdoll',
        'unlock_image': '🖼️ Unlock Image',
        'custom': '⚡ Custom',
        'next_node': '➡️ Next Node'
    };
    return labels[action] || action || 'Action';
}

function addChoiceOutcome() {
    // Add a new empty outcome
    currentOutcomes.push({
        action: 'addItem',
        itemId: '',
        quantity: 1
    });
    renderOutcomesList();
    editChoiceOutcome(currentOutcomes.length - 1);
}

function editChoiceOutcome(index) {
    const outcome = currentOutcomes[index];
    if (!outcome) return;

    // Simple inline edit: show a small modal/popup for editing the outcome
    const existingModal = document.getElementById('outcome-edit-popup');
    if (existingModal) existingModal.remove();
    const existingOverlay = document.getElementById('outcome-edit-overlay');
    if (existingOverlay) existingOverlay.remove();

    // Create dark overlay
    const overlay = document.createElement('div');
    overlay.id = 'outcome-edit-overlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 2050;';
    overlay.onclick = closeOutcomePopup;
    document.body.appendChild(overlay);

    // Determine if we're in a light theme
    const isLightTheme = document.body.classList.contains('theme-light') || document.body.classList.contains('theme-nature');
    const bgColor = isLightTheme ? '#ffffff' : '#1e1e1e';
    const textColor = isLightTheme ? '#1d1d1f' : '#e0e0e0';
    const labelColor = isLightTheme ? '#475569' : '#a0a0a0';
    const inputBg = isLightTheme ? '#f1f5f9' : '#2d2d2d';
    const borderColor = isLightTheme ? '#e2e8f0' : '#333333';

    const popup = document.createElement('div');
    popup.id = 'outcome-edit-popup';
    popup.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: ${bgColor}; color: ${textColor}; border: 2px solid var(--accent-color); border-radius: 8px; padding: 20px; z-index: 2100; min-width: 350px; box-shadow: 0 10px 30px rgba(0,0,0,0.8);`;

    popup.innerHTML = `
        <h4 style="margin: 0 0 15px; color: var(--accent-color);">Edit Outcome</h4>
        <div class="setting-row">
            <label>Action Type</label>
            <select id="outcome-action-type" class="input-dark" onchange="updateOutcomeFields(${index})">
                <option value="goto" ${outcome.action === 'goto' ? 'selected' : ''}>Navigate</option>
                <option value="addItem" ${outcome.action === 'addItem' ? 'selected' : ''}>Add Item</option>
                <option value="modifyStat" ${outcome.action === 'modifyStat' ? 'selected' : ''}>Modify Stat</option>
                <option value="modifyRel" ${outcome.action === 'modifyRel' ? 'selected' : ''}>Modify Relationship</option>
                <option value="start_dialogue" ${outcome.action === 'start_dialogue' ? 'selected' : ''}>Start Dialogue Tree</option>
                <option value="unlock_image" ${outcome.action === 'unlock_image' ? 'selected' : ''}>Unlock Gallery Image</option>
                <option value="modify_paperdoll" ${outcome.action === 'modify_paperdoll' ? 'selected' : ''}>Modify Paperdoll</option>
            </select>
        </div>
        <div id="outcome-dynamic-fields"></div>
        <div class="modal-actions" style="margin-top: 15px;">
            <button class="secondary-btn" onclick="closeOutcomePopup()">Cancel</button>
            <button class="primary-btn" onclick="saveOutcome(${index})">Save</button>
        </div>
    `;

    document.body.appendChild(popup);
    updateOutcomeFields(index);
}

function updateOutcomeFields(index) {
    const container = document.getElementById('outcome-dynamic-fields');
    const actionType = document.getElementById('outcome-action-type').value;
    const outcome = currentOutcomes[index] || {};

    // Determine theme-appropriate colors
    const isLightTheme = document.body.classList.contains('theme-light') || document.body.classList.contains('theme-nature');
    const inputBg = isLightTheme ? '#f1f5f9' : '#2d2d2d';
    const inputColor = isLightTheme ? '#0f172a' : '#e0e0e0';
    const inputBorder = isLightTheme ? '#e2e8f0' : '#444444';

    const inputStyle = `width:100%; background:${inputBg}; color:${inputColor}; border:1px solid ${inputBorder}; padding:8px; margin-top:5px; border-radius:4px;`;

    let html = '';

    if (actionType === 'goto') {
        html = `
            <div class="setting-row">
                <label>Target Location ID</label>
                <input type="text" id="outcome-target" class="input-dark" placeholder="location_id" value="${outcome.target || ''}" style="${inputStyle}">
            </div>
        `;
    } else if (actionType === 'addItem') {
        html = `
            <div class="setting-row">
                <label>Item ID</label>
                <select id="outcome-item-id" class="input-dark" style="${inputStyle}">
                    <option value="">-- Select Item --</option>
                    ${currentProjectData.items.map(item =>
            `<option value="${item.id}" ${outcome.itemId === item.id ? 'selected' : ''}>${item.name || 'Unnamed'} (${item.id})</option>`
        ).join('')}
                </select>
            </div>
            <div class="setting-row">
                <label>Quantity</label>
                <input type="number" id="outcome-item-qty" class="input-dark" placeholder="1" value="${outcome.quantity || 1}" style="${inputStyle}">
            </div>
        `;
    } else if (actionType === 'modifyStat') {
        html = `
            <div class="setting-row">
                <label>Stat Name</label>
                <input type="text" id="outcome-stat-name" class="input-dark" placeholder="strength" value="${outcome.stat || ''}" style="${inputStyle}">
            </div>
            <div class="setting-row">
                <label>Value Change</label>
                <input type="number" id="outcome-stat-value" class="input-dark" placeholder="1" value="${outcome.value || 0}" style="${inputStyle}">
            </div>
        `;
    } else if (actionType === 'modifyRel') {
        html = `
            <div class="setting-row">
                <label>Character</label>
                <select id="outcome-npc-id" class="input-dark" style="${inputStyle}">
                    ${currentProjectData.characters.map(char =>
            `<option value="${char.id}" ${outcome.npcId === char.id ? 'selected' : ''}>${char.name || 'Unnamed'} (${char.id})</option>`
        ).join('')}
                </select>
            </div>
            <div class="setting-row">
                <label>Relationship Change</label>
                <input type="number" id="outcome-npc-value" class="input-dark" placeholder="5" value="${outcome.value || 0}" style="${inputStyle}">
            </div>
        `;
    } else if (actionType === 'unlock_image') {
        html = `
            <div class="setting-row">
                <label>Image ID / Path</label>
                <input type="text" id="outcome-image-id" class="input-dark" placeholder="gallery/secret.jpg" value="${outcome.imageId || ''}" style="${inputStyle}">
            </div>
        `;
    } else if (actionType === 'start_dialogue') {
        html = `
            <div class="setting-row">
                <label>Dialogue Tree</label>
                <select id="outcome-dialogue-id" class="input-dark" style="${inputStyle}">
                    <option value="">-- Select Dialogue Tree --</option>
                    ${(currentProjectData.dialogues || []).map(d =>
            `<option value="${d.id}" ${outcome.dialogueId === d.id ? 'selected' : ''}>${d.name || 'Unnamed'} (${d.id})</option>`
        ).join('')}
                </select>
            </div>
        `;
    } else if (actionType === 'modify_paperdoll') {
        html = `
            <div class="setting-row">
                <label>Character ID</label>
                <input type="text" id="outcome-char-id" class="input-dark" placeholder="player" value="${outcome.charId || 'player'}" style="${inputStyle}">
            </div>
            <div class="setting-row">
                <label>Layer Name</label>
                <input type="text" id="outcome-layer" class="input-dark" placeholder="Clothes" value="${outcome.layer || ''}" style="${inputStyle}">
            </div>
            <div class="setting-row">
                <label>Image Index</label>
                <input type="number" id="outcome-img-idx" class="input-dark" placeholder="0" value="${outcome.imageIndex !== undefined ? outcome.imageIndex : ''}" style="${inputStyle}">
            </div>
        `;
    }

    container.innerHTML = html;
}

function saveOutcome(index) {
    const actionType = document.getElementById('outcome-action-type').value;

    let newOutcome = { action: actionType };

    if (actionType === 'goto') {
        newOutcome.target = document.getElementById('outcome-target').value;
    } else if (actionType === 'addItem') {
        newOutcome.itemId = document.getElementById('outcome-item-id').value;
        newOutcome.quantity = parseInt(document.getElementById('outcome-item-qty').value) || 1;
        const item = currentProjectData.items.find(i => i.id === newOutcome.itemId);
        if (item) newOutcome.itemName = item.name;
    } else if (actionType === 'modifyStat') {
        newOutcome.stat = document.getElementById('outcome-stat-name').value;
        newOutcome.value = parseInt(document.getElementById('outcome-stat-value').value) || 0;
    } else if (actionType === 'modifyRel') {
        newOutcome.npcId = document.getElementById('outcome-npc-id').value;
        newOutcome.value = parseInt(document.getElementById('outcome-npc-value').value) || 0;
        const npc = currentProjectData.characters.find(c => c.id === newOutcome.npcId);
        if (npc) newOutcome.npcName = npc.name;
    } else if (actionType === 'unlock_image') {
        newOutcome.imageId = document.getElementById('outcome-image-id').value;
    } else if (actionType === 'start_dialogue') {
        newOutcome.dialogueId = document.getElementById('outcome-dialogue-id').value;
        const dialogue = currentProjectData.dialogues.find(d => d.id === newOutcome.dialogueId);
        if (dialogue) newOutcome.dialogueName = dialogue.name;
    } else if (actionType === 'modify_paperdoll') {
        newOutcome.charId = document.getElementById('outcome-char-id').value || 'player';
        newOutcome.layer = document.getElementById('outcome-layer').value;
        const imgIdx = document.getElementById('outcome-img-idx').value;
        if (imgIdx !== '') newOutcome.imageIndex = parseInt(imgIdx);
    }

    currentOutcomes[index] = newOutcome;
    closeOutcomePopup();
    renderOutcomesList();
}

function removeChoiceOutcome(index) {
    currentOutcomes.splice(index, 1);
    renderOutcomesList();
}

function closeOutcomePopup() {
    const popup = document.getElementById('outcome-edit-popup');
    if (popup) popup.remove();
    const overlay = document.getElementById('outcome-edit-overlay');
    if (overlay) overlay.remove();
}

function saveChoiceFromEditor() {
    const modal = document.getElementById('modal-choice-editor');
    if (modal.dataset.context === 'dialogue') {
        saveDialogueOption();
        return;
    }

    const text = document.getElementById('choice-text-input').value;
    const condition = document.getElementById('choice-condition-input').value;
    const target = document.getElementById('choice-target-input').value;
    const action = document.getElementById('choice-template-select').value;

    let newChoice = { text, action };
    if (target) newChoice.target = target;
    if (condition) newChoice.condition = condition;

    // Advanced Limitations
    const maxUses = parseInt(document.getElementById('choice-max-uses').value) || 0;
    if (maxUses > 0) newChoice.maxUses = maxUses;

    if (document.getElementById('choice-hide-max').checked) newChoice.hideAfterMax = true;

    const reqVar = document.getElementById('choice-req-var').value.trim();
    if (reqVar) {
        newChoice.reqVar = reqVar;
        let reqVal = document.getElementById('choice-req-val').value.trim();
        // Type inference
        if (reqVal === 'true') reqVal = true;
        else if (reqVal === 'false') reqVal = false;
        else if (!isNaN(Number(reqVal)) && reqVal !== '') reqVal = Number(reqVal);

        newChoice.reqVal = reqVal;
    }

    if (document.getElementById('choice-hide-unavailable').checked) newChoice.hideIfUnavailable = true;

    if (action === 'addItem') {
        const itemId = document.getElementById('choice-item-id').value;
        if (itemId) {
            newChoice.itemId = itemId;
            newChoice.quantity = parseInt(document.getElementById('choice-item-qty').value) || 1;
            // Find name for cache
            const item = currentProjectData.items.find(i => i.id === itemId);
            if (item) newChoice.itemName = item.name;
        }
    } else if (action === 'modifyStat') {
        newChoice.stat = document.getElementById('choice-stat-name').value;
        newChoice.value = parseInt(document.getElementById('choice-stat-val').value) || 0;
    } else if (action === 'modifyRel') {
        newChoice.npcId = document.getElementById('choice-npc-id').value;
        const npc = currentProjectData.characters.find(c => c.id === newChoice.npcId);
        if (npc) newChoice.npcName = npc.name;
        newChoice.value = parseInt(document.getElementById('choice-npc-val').value) || 0;
    } else if (action === 'modify_paperdoll') {
        newChoice.charId = document.getElementById('choice-target-char').value || 'player';
        newChoice.layer = document.getElementById('choice-layer').value;
        const imgIdx = document.getElementById('choice-img-idx').value;
        const colIdx = document.getElementById('choice-col-idx').value;
        if (imgIdx !== '') newChoice.imageIndex = parseInt(imgIdx);
        if (colIdx !== '') newChoice.colorIndex = parseInt(colIdx);
    } else if (action === 'npc_interact') {
        // Save the selected NPC ID as the 'target'
        newChoice.target = document.getElementById('choice-npc-target').value;
    } else if (action === 'unlock_image') {
        const imageIdEl = document.getElementById('choice-unlock-image-id');
        if (imageIdEl) {
            newChoice.imageId = imageIdEl.value;
        }
    } else if (action === 'start_dialogue') {
        const dialogueTreeEl = document.getElementById('choice-dialogue-tree');
        if (dialogueTreeEl) {
            newChoice.dialogueId = dialogueTreeEl.value;
            // Store dialogue name for reference
            const dialogue = currentProjectData.dialogues.find(d => d.id === newChoice.dialogueId);
            if (dialogue) newChoice.dialogueName = dialogue.name;
        }
    } else if (action === 'ui_event') {
        newChoice.eventDescription = document.getElementById('choice-event-desc').value;
        newChoice.eventImage = document.getElementById('choice-event-image').value;
    }

    // Build actions array if there are additional outcomes
    if (currentOutcomes && currentOutcomes.length > 0) {
        // Create primary action object from the main choice data
        const primaryAction = { action: newChoice.action || 'goto' };
        if (newChoice.target) primaryAction.target = newChoice.target;
        if (newChoice.itemId) {
            primaryAction.itemId = newChoice.itemId;
            primaryAction.quantity = newChoice.quantity;
            if (newChoice.itemName) primaryAction.itemName = newChoice.itemName;
        }
        if (newChoice.stat) {
            primaryAction.stat = newChoice.stat;
            primaryAction.value = newChoice.value;
        }
        if (newChoice.npcId) {
            primaryAction.npcId = newChoice.npcId;
            primaryAction.value = newChoice.value;
            if (newChoice.npcName) primaryAction.npcName = newChoice.npcName;
        }
        if (newChoice.imageId) primaryAction.imageId = newChoice.imageId;
        if (newChoice.charId) {
            primaryAction.charId = newChoice.charId;
            primaryAction.layer = newChoice.layer;
            if (newChoice.imageIndex !== undefined) primaryAction.imageIndex = newChoice.imageIndex;
            if (newChoice.colorIndex !== undefined) primaryAction.colorIndex = newChoice.colorIndex;
        }
        if (newChoice.dialogueId) {
            primaryAction.dialogueId = newChoice.dialogueId;
            if (newChoice.dialogueName) primaryAction.dialogueName = newChoice.dialogueName;
        }

        // Combine primary action with additional outcomes
        newChoice.actions = [primaryAction, ...currentOutcomes];
    }

    // Update List
    let choices = [];
    try {
        choices = JSON.parse(document.getElementById('scene-choices').value);
    } catch (e) { }

    if (editingChoiceIndex > -1) {
        choices[editingChoiceIndex] = newChoice;
    } else {
        choices.push(newChoice);
    }

    document.getElementById('scene-choices').value = JSON.stringify(choices, null, 4);
    closeChoiceEditor();
    renderVisualChoices(choices);
}

function deleteChoiceFromEditor() {
    const modal = document.getElementById('modal-choice-editor');
    if (modal.dataset.context === 'dialogue') {
        if (editingDialogueOptionIndex > -1) {
            if (!confirm("Delete this option?")) return;
            let options = [];
            try { options = JSON.parse(activeDialogueOptionsInput.value); } catch (e) { }
            options.splice(editingDialogueOptionIndex, 1);
            activeDialogueOptionsInput.value = JSON.stringify(options);
            renderDialogueOptionsVisuals(activeDialogueVisualList, activeDialogueOptionsInput);
        }
        closeChoiceEditor();
        return;
    }

    if (editingChoiceIndex > -1) {
        if (!confirm("Delete this choice?")) return;
        let choices = [];
        try {
            choices = JSON.parse(document.getElementById('scene-choices').value);
            choices.splice(editingChoiceIndex, 1);
            document.getElementById('scene-choices').value = JSON.stringify(choices, null, 4);
            renderVisualChoices(choices);
        } catch (e) { }
    }
    closeChoiceEditor();
}

// --- Delete Game Logic ---

let projectToDelete = null;
let deleteHoldTimer = null;
let deleteHoldStart = 0;
const deleteHoldDuration = 2000; // 2 seconds

function openDeleteModal(projectName, event) {
    if (event) event.stopPropagation();
    projectToDelete = projectName;

    const modal = document.getElementById('modal-delete-confirm');
    modal.classList.remove('hidden');

    // Reset State
    document.getElementById('delete-step-one').classList.remove('hidden');
    document.getElementById('delete-step-two').classList.add('hidden');
    document.getElementById('delete-hold-progress').style.width = '0%';
    document.getElementById('delete-confirm-input').value = '';
    document.getElementById('btn-final-delete').disabled = true;
    document.getElementById('btn-final-delete').style.opacity = '0.5';
    document.getElementById('btn-final-delete').style.cursor = 'not-allowed';

    document.getElementById('delete-modal-msg').innerText = `Are you sure you want to delete "${projectName}"? This cannot be undone.`;
}

function closeDeleteModal() {
    document.getElementById('modal-delete-confirm').classList.add('hidden');
    projectToDelete = null;
    cancelDeleteHold();
}

function startDeleteHold() {
    deleteHoldStart = Date.now();
    const progressBar = document.getElementById('delete-hold-progress');

    deleteHoldTimer = setInterval(() => {
        const elapsed = Date.now() - deleteHoldStart;
        const progress = Math.min((elapsed / deleteHoldDuration) * 100, 100);
        progressBar.style.width = `${progress}%`;

        if (elapsed >= deleteHoldDuration) {
            clearInterval(deleteHoldTimer);
            unlockDeleteStepTwo();
        }
    }, 50);
}

function cancelDeleteHold() {
    if (deleteHoldTimer) {
        clearInterval(deleteHoldTimer);
        deleteHoldTimer = null;
    }
    const progressBar = document.getElementById('delete-hold-progress');
    if (progressBar) progressBar.style.width = '0%';
}

function unlockDeleteStepTwo() {
    document.getElementById('delete-step-one').classList.add('hidden');
    document.getElementById('delete-step-two').classList.remove('hidden');
    document.getElementById('delete-confirm-input').focus();
}

function checkDeleteInput() {
    const val = document.getElementById('delete-confirm-input').value;
    const btn = document.getElementById('btn-final-delete');

    if (val === 'delete') {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    } else {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    }
}

async function executeDelete() {
    if (!projectToDelete) return;

    const result = await window.electronAPI.deleteProject(projectToDelete);
    if (result.success) {
        closeDeleteModal();
        // Refresh Lists
        loadProjectList();
        loadGameLibrary();
    } else {
        alert("Failed to delete project: " + result.error);
    }
}



// --- Economy/Currency Editor ---

function populateCurrencyList() {
    const list = document.getElementById('currency-list-container');
    if (!list) return;
    list.innerHTML = '';

    if (!currentProjectData.currencies) currentProjectData.currencies = [];

    currentProjectData.currencies.forEach((curr, index) => {
        const item = document.createElement('div');
        item.className = 'scene-item';
        item.innerHTML = `
            <div class="scene-id">${curr.symbol || '$'} ${curr.id}</div>
            <div class="scene-text">${curr.name || 'Unnamed'}</div>
        `;
        item.onclick = () => loadCurrencyToForm(index);
        list.appendChild(item);
    });
}

let activeCurrencyIndex = -1;

function loadCurrencyToForm(index) {
    activeCurrencyIndex = index;
    const curr = currentProjectData.currencies[index];

    document.getElementById('curr-id').value = curr.id || '';
    document.getElementById('curr-name').value = curr.name || '';
    document.getElementById('curr-symbol').value = curr.symbol || '';
    document.getElementById('curr-desc').value = curr.description || '';
}

function addNewCurrency() {
    if (!currentProjectData.currencies) currentProjectData.currencies = [];

    const newCurr = {
        id: `curr_${Date.now()}`,
        name: "New Currency",
        symbol: "🪙",
        description: ""
    };
    currentProjectData.currencies.push(newCurr);
    saveData();
    populateCurrencyList();
    loadCurrencyToForm(currentProjectData.currencies.length - 1);
    updateShopCurrencyDropdown();
}

function saveCurrentCurrency() {
    if (activeCurrencyIndex === -1) return;

    const id = document.getElementById('curr-id').value;
    const name = document.getElementById('curr-name').value;
    const symbol = document.getElementById('curr-symbol').value;
    const description = document.getElementById('curr-desc').value;

    currentProjectData.currencies[activeCurrencyIndex] = {
        id, name, symbol, description
    };

    saveData();
    populateCurrencyList();

    // Also update the shop currency dropdown if it exists (e.g. if tabs are switched)
    // Though it's in another tab, updating here ensures consistency if the UI is cached or reused.
    // However, since switchEditorTab calls updateShopCurrencyDropdown when entering the char tab,
    // this is strictly redundant but good for immediate feedback if we had split view.
    // We'll leave it out to keep it clean, relying on switchEditorTab.
    // Wait, the USER complained "doesn't show". This implies they added one and then went to char tab and it wasn't there.
    // My previous fix `switchEditorTab` logic specifically adds `updateShopCurrencyDropdown()` when entering Characters tab.
    // So if they add a currency here, save it, then switch tabs, it SHOULD work now.

    // BUT if they are looking at the dropdown *while* modifying currencies (impossible as it's a different tab).
    // The only edge case is if `updateShopCurrencyDropdown` isn't actually populating correctly due to data structure issues.
    // I added logging to `updateShopCurrencyDropdown` in previous step.

    // Let's force an update just in case.
    updateShopCurrencyDropdown();
}


// --- Project Settings Editor ---

function populateProjectSettings() {
    if (!currentProjectData.settings) currentProjectData.settings = {};
    const s = currentProjectData.settings;

    document.getElementById('setting-title').value = s.title || '';
    document.getElementById('setting-version').value = s.version || '';
    document.getElementById('setting-bg').value = s.menuBackground || '';
}

function saveProjectSettings() {
    if (!currentProjectData.settings) currentProjectData.settings = {};

    currentProjectData.settings.title = document.getElementById('setting-title').value;
    currentProjectData.settings.version = document.getElementById('setting-version').value;
    currentProjectData.settings.menuBackground = document.getElementById('setting-bg').value;

    saveData();
    alert("Settings Saved!");
}

// --- Paperdoll Editor ---

function updatePaperdollName(name) {
    if (activePaperdollIndex === -1) return;
    currentProjectData.paperdolls[activePaperdollIndex].name = name;
    populatePaperdollList(); // Refresh sidebar to show new name
    saveData();
}

function updatePaperdollId(id) {
    if (activePaperdollIndex === -1) return;
    currentProjectData.paperdolls[activePaperdollIndex].id = id;
    populatePaperdollList();
    saveData();
}

function updateLayerStats(jsonStr) {
    if (activePaperdollIndex === -1 || activeLayerIndex === -1) return;
    const layer = currentProjectData.paperdolls[activePaperdollIndex].layers[activeLayerIndex];

    // Stats are attached to the *selected image* in the layer
    if (!layer.images || layer.images.length === 0) return;
    const imgObj = layer.images[layer.selectedImageIdx || 0];

    try {
        const stats = jsonStr ? JSON.parse(jsonStr) : {};
        imgObj.stats = stats;
        saveCurrentPaperdoll();
    } catch (e) {
        alert("Invalid JSON for stats");
    }
}

function populatePaperdollList() {
    const list = document.getElementById('paperdoll-list-container');
    if (!list) return;
    list.innerHTML = '';

    if (!currentProjectData.paperdolls) currentProjectData.paperdolls = [];

    currentProjectData.paperdolls.forEach((pd, index) => {
        const item = document.createElement('div');
        item.className = 'scene-item';
        item.innerHTML = `
            <div class="scene-id">${pd.id}</div>
            <div class="scene-text">${pd.name || 'Unnamed'}</div>
        `;
        item.onclick = () => loadPaperdollToForm(index);
        list.appendChild(item);
    });
}

function addNewPaperdoll() {
    const newPd = {
        id: `pd_${Date.now()}`,
        name: "New Paperdoll",
        layers: [
            // Default Layers
            { name: "Body", zIndex: 0, images: [] },
            { name: "Head", zIndex: 1, images: [] },
            { name: "Eyes", zIndex: 2, images: [] },
            { name: "Hair", zIndex: 3, images: [] }
        ]
    };
    currentProjectData.paperdolls.push(newPd);
    saveData();
    populatePaperdollList();
    loadPaperdollToForm(currentProjectData.paperdolls.length - 1);
}

let activePaperdollIndex = -1;
let activeLayerIndex = -1; // Index in the currently loaded paperdoll's layers array

function loadPaperdollToForm(index) {
    activePaperdollIndex = index;
    activeLayerIndex = -1;
    const pd = currentProjectData.paperdolls[index];

    document.getElementById('pd-id').value = pd.id;

    renderLayerList();
    document.getElementById('pd-layer-controls').classList.add('hidden');
    renderPaperdollPreview();
}

function renderLayerList() {
    const pd = currentProjectData.paperdolls[activePaperdollIndex];
    const list = document.getElementById('pd-layer-list');
    list.innerHTML = '';

    // Render in visual order (Top z-index first, or drag order)
    // We'll render index 0 at top, assuming array order IS z-order for simplicity (or reverse?)
    // Usually painting is 0..N. So N is on top.
    // In UI list, usually Top item is Top layer. So we iterate backwards.

    // Copy and create map to original indices
    const layersWithIdx = pd.layers.map((l, i) => ({ ...l, originalIdx: i }));
    // Reverse for UI (Top of list = Top layer)
    layersWithIdx.reverse().forEach((layer, uiIndex) => {
        const item = document.createElement('div');
        item.className = `nav-item ${layer.originalIdx === activeLayerIndex ? 'active' : ''}`;
        item.style.cursor = 'pointer';
        item.style.marginBottom = '2px';
        item.innerHTML = `
            <span style="font-weight:bold;">${layer.name}</span>
            <div style="font-size:0.8em; opacity:0.7;">
                <button class="secondary-btn" style="padding:2px 5px;" onclick="moveLayer(event, ${layer.originalIdx}, 1)">^</button>
                <button class="secondary-btn" style="padding:2px 5px;" onclick="moveLayer(event, ${layer.originalIdx}, -1)">v</button>
            </div>
        `;
        item.onclick = () => selectLayer(layer.originalIdx);
        list.appendChild(item);
    });
}

function selectLayer(index) {
    activeLayerIndex = index;
    renderLayerList(); // Redraw highlight

    const pd = currentProjectData.paperdolls[activePaperdollIndex];
    const layer = pd.layers[index];

    document.getElementById('pd-layer-controls').classList.remove('hidden');
    document.getElementById('pd-selected-layer-name').innerText = layer.name;
    document.getElementById('pd-layer-name').value = layer.name;

    updateLayerControlState();
}

function updateLayerControlState() {
    const pd = currentProjectData.paperdolls[activePaperdollIndex];
    const layer = pd.layers[activeLayerIndex];

    // Ensure state
    if (!layer.images) layer.images = [];
    if (typeof layer.selectedImageIdx === 'undefined') layer.selectedImageIdx = 0;
    if (typeof layer.selectedColorwayIdx === 'undefined') layer.selectedColorwayIdx = -1; // -1 = base

    const imgCount = layer.images.length;
    document.getElementById('pd-layer-img-count').innerText = imgCount > 0 ? `${layer.selectedImageIdx + 1}/${imgCount}` : "None";

    // Colorway
    let colorText = "Default";
    if (imgCount > 0) {
        const img = layer.images[layer.selectedImageIdx];
        if (img.colorways && img.colorways.length > 0) {
            const cIdx = layer.selectedColorwayIdx;
            colorText = cIdx === -1 ? "Original" : `Var ${cIdx + 1}/${img.colorways.length}`;
        }
    }
    document.getElementById('pd-layer-color-count').innerText = colorText;

    // Stats
    const statsInput = document.getElementById('pd-layer-stats');
    if (imgCount > 0) {
        const img = layer.images[layer.selectedImageIdx];
        statsInput.value = img.stats ? JSON.stringify(img.stats) : '';
    } else {
        statsInput.value = '';
    }
}

function updateSelectedLayerName(name) {
    if (activePaperdollIndex === -1 || activeLayerIndex === -1) return;
    currentProjectData.paperdolls[activePaperdollIndex].layers[activeLayerIndex].name = name;
    renderLayerList();
    document.getElementById('pd-selected-layer-name').innerText = name;
}

function moveLayer(e, index, dir) {
    e.stopPropagation();
    const pd = currentProjectData.paperdolls[activePaperdollIndex];
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= pd.layers.length) return;

    // Swap
    const temp = pd.layers[index];
    pd.layers[index] = pd.layers[newIndex];
    pd.layers[newIndex] = temp;

    // If active was moved
    if (activeLayerIndex === index) activeLayerIndex = newIndex;
    else if (activeLayerIndex === newIndex) activeLayerIndex = index;

    renderLayerList();
    renderPaperdollPreview();
}

function addPaperdollLayer() {
    const pd = currentProjectData.paperdolls[activePaperdollIndex];
    pd.layers.push({
        name: "New Layer",
        images: [],
        selectedImageIdx: 0,
        selectedColorwayIdx: -1
    });
    renderLayerList();
    selectLayer(pd.layers.length - 1);
}

function deleteSelectedLayer() {
    if (activeLayerIndex === -1) return;
    if (!confirm("Delete this layer?")) return;

    currentProjectData.paperdolls[activePaperdollIndex].layers.splice(activeLayerIndex, 1);
    activeLayerIndex = -1;
    document.getElementById('pd-layer-controls').classList.add('hidden');
    renderLayerList();
    renderPaperdollPreview();
}

// Helpers for async file reading/saving
async function uploadAndSaveAsset(fileInput) {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            if (e.target.files.length === 0) {
                resolve(null);
                return;
            }
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const base64Raw = ev.target.result;
                const base64Data = base64Raw.split(',')[1];
                const ext = file.name.split('.').pop();
                const filename = `assets/paperdolls/${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;

                try {
                    const res = await window.electronAPI.saveAsset(currentProject, filename, base64Data);
                    if (res.success) {
                        resolve(res.path);
                    } else {
                        alert("Save failed: " + res.error);
                        resolve(null);
                    }
                } catch (err) {
                    console.error(err);
                    resolve(null);
                }
            };
            reader.readAsDataURL(file);
        };
        input.click();
    });
}

function uploadCharImage() {
    uploadAndSaveAsset().then(path => {
        if (path) document.getElementById('char-image-path').value = path;
    });
}

// Layer Image Management
async function uploadLayerImage() {
    if (activePaperdollIndex === -1 || activeLayerIndex === -1) return;
    const path = await uploadAndSaveAsset();
    if (path) {
        const layer = currentProjectData.paperdolls[activePaperdollIndex].layers[activeLayerIndex];
        layer.images.push({
            base: path,
            colorways: []
        });
        layer.selectedImageIdx = layer.images.length - 1;
        layer.selectedColorwayIdx = -1;
        updateLayerControlState();
        renderPaperdollPreview();
    }
}

async function uploadLayerColorway() {
    if (activePaperdollIndex === -1 || activeLayerIndex === -1) return;
    const layer = currentProjectData.paperdolls[activePaperdollIndex].layers[activeLayerIndex];
    if (layer.images.length === 0) return alert("Upload a base image first.");

    const path = await uploadAndSaveAsset();
    if (path) {
        const img = layer.images[layer.selectedImageIdx];
        if (!img.colorways) img.colorways = [];
        img.colorways.push(path);
        layer.selectedColorwayIdx = img.colorways.length - 1;
        updateLayerControlState();
        renderPaperdollPreview();
    }
}

function cycleLayerImage(dir) {
    if (activePaperdollIndex === -1 || activeLayerIndex === -1) return;
    const layer = currentProjectData.paperdolls[activePaperdollIndex].layers[activeLayerIndex];
    if (layer.images.length === 0) return;

    layer.selectedImageIdx += dir;
    if (layer.selectedImageIdx >= layer.images.length) layer.selectedImageIdx = 0;
    if (layer.selectedImageIdx < 0) layer.selectedImageIdx = layer.images.length - 1;

    layer.selectedColorwayIdx = -1; // Reset colorway on image switch
    updateLayerControlState();
    renderPaperdollPreview();
}

function cycleLayerColor(dir) {
    if (activePaperdollIndex === -1 || activeLayerIndex === -1) return;
    const layer = currentProjectData.paperdolls[activePaperdollIndex].layers[activeLayerIndex];
    if (layer.images.length === 0) return;
    const img = layer.images[layer.selectedImageIdx];
    if (!img.colorways || img.colorways.length === 0) return;

    // Including -1 (Original)
    // Range: -1 to length-1
    layer.selectedColorwayIdx += dir;
    if (layer.selectedColorwayIdx >= img.colorways.length) layer.selectedColorwayIdx = -1;
    if (layer.selectedColorwayIdx < -1) layer.selectedColorwayIdx = img.colorways.length - 1;

    updateLayerControlState();
    renderPaperdollPreview();
}

function renderPaperdollPreview() {
    const canvas = document.getElementById('pd-canvas');
    canvas.innerHTML = '';

    if (activePaperdollIndex === -1) return;
    const pd = currentProjectData.paperdolls[activePaperdollIndex];

    pd.layers.forEach(layer => {
        if (!layer.images || layer.images.length === 0) return;
        const imgObj = layer.images[layer.selectedImageIdx || 0];
        if (!imgObj) return;

        let src = imgObj.base;
        if (layer.selectedColorwayIdx > -1 && imgObj.colorways && imgObj.colorways[layer.selectedColorwayIdx]) {
            src = imgObj.colorways[layer.selectedColorwayIdx];
        }

        const el = document.createElement('img');
        // Fix path for local loading - 'assets/' is relative to project.
        // In renderer, we don't know absolute path easily.
        // We can just rely on file:// if we knew the base.
        // HACK: We use 'games/[project]/[path]' assuming relative to renderer location?
        // No, renderer is in launcher/. Games are in ../games/.
        el.src = `../games/${currentProject}/${src}`;

        el.style.position = 'absolute';
        el.style.top = '0';
        el.style.left = '0';
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.objectFit = 'contain';
        el.style.pointerEvents = 'none';
        canvas.appendChild(el);
    });
}

function saveCurrentPaperdoll() {
    // Already updating currentProjectData in real-time memory
    saveData();
    populatePaperdollList();
    alert("Paperdoll Saved!");
}

// --- Character Appearance Helpers ---

function toggleCharAppearanceMode() {
    const mode = document.getElementById('char-appearance-type').value;
    const imgRow = document.getElementById('char-image-row');
    const pdRow = document.getElementById('char-paperdoll-row');

    if (mode === 'paperdoll') {
        imgRow.classList.add('hidden');
        pdRow.classList.remove('hidden');
        populatePaperdollSelect();
    } else {
        imgRow.classList.remove('hidden');
        pdRow.classList.add('hidden');
    }
}

function populatePaperdollSelect() {
    const sel = document.getElementById('char-paperdoll-select');
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">-- Select --</option>';
    if (currentProjectData.paperdolls) {
        currentProjectData.paperdolls.forEach(pd => {
            const opt = document.createElement('option');
            opt.value = pd.id;
            opt.innerText = pd.name;
            sel.appendChild(opt);
        });
    }
    sel.value = currentVal;
}

// --- Player Editor ---

function populatePlayerTab() {
    // Ensure player object exists if not fully initialized
    if (!currentProjectData.player) {
        currentProjectData.player = { stats: [], config: { creationEnabled: false, visualType: 'none', defaultImage: '', openSections: { identity: true, appearance: true, stats: true, cheats: false }, startPoints: 10 } };
    }
    const p = currentProjectData.player;

    // Config
    document.getElementById('player-enable-creation').checked = p.config.creationEnabled || false;
    document.getElementById('player-visual-type').value = p.config.visualType || 'none';

    // Visuals
    togglePlayerVisualSettings();
    document.getElementById('player-default-image').value = p.config.defaultImage || '';

    // Stats List
    const list = document.getElementById('player-stats-list');
    list.innerHTML = '';
    (p.stats || []).forEach((stat, idx) => {
        const row = document.createElement('div');
        row.className = 'setting-row';
        row.style.background = 'var(--bg-tertiary)';
        row.style.padding = '10px';
        row.style.marginBottom = '5px';
        row.innerHTML = `
            <div style="display:flex; gap:10px; margin-bottom:5px;">
                <input type="text" placeholder="Stat ID (e.g. str)" value="${stat.id}" onchange="updatePlayerStat(${idx}, 'id', this.value)" class="input-dark" style="flex:1;">
                <input type="text" placeholder="Display Name" value="${stat.name}" onchange="updatePlayerStat(${idx}, 'name', this.value)" class="input-dark" style="flex:1;">
                <button class="secondary-btn" onclick="deletePlayerStat(${idx})" style="color:red;">×</button>
            </div>
            <div style="display:flex; gap:10px;">
                <select class="input-dark" onchange="updatePlayerStat(${idx}, 'type', this.value)" style="width:100px;">
                    <option value="number" ${stat.type === 'number' ? 'selected' : ''}>Number</option>
                    <option value="text" ${stat.type === 'text' ? 'selected' : ''}>Text</option>
                    <option value="boolean" ${stat.type === 'boolean' ? 'selected' : ''}>Boolean</option>
                </select>
                <input type="text" placeholder="Default Value" value="${stat.default}" onchange="updatePlayerStat(${idx}, 'default', this.value)" class="input-dark" style="flex:1;">
                 <input type="number" placeholder="Cost" value="${stat.cost || 1}" onchange="updatePlayerStat(${idx}, 'cost', this.value)" class="input-dark" style="width:60px;" title="Point Cost">
            </div>
        `;
        list.appendChild(row);
    });

    // Content Toggles
    const sec = p.config.openSections || {};
    document.getElementById('creation-show-identity').checked = sec.identity !== false;
    document.getElementById('creation-show-appearance').checked = sec.appearance !== false;
    document.getElementById('creation-show-stats').checked = sec.stats !== false;
    document.getElementById('creation-show-cheats').checked = sec.cheats === true; // Default false
    document.getElementById('creation-stat-points').value = p.config.startPoints || 10;

    // Paperdoll Select
    populatePlayerPaperdollLayers();
}

function populatePlayerPaperdollLayers() {
    const p = currentProjectData.player;
    if (!p) return;

    const pdSelect = document.getElementById('player-paperdoll-select');
    // Only populate select if empty or needs refresh? No, easier to just rebuild or check.
    // If we rebuild select every time, we lose selection if we don't save it.
    // But this is called from populatePlayerTab which is init.

    // Check if select is empty (except default)
    if (pdSelect.options.length <= 1) {
        pdSelect.innerHTML = '<option value="">-- Select a Paperdoll --</option>';
        if (currentProjectData.paperdolls) {
            currentProjectData.paperdolls.forEach(pd => {
                const opt = document.createElement('option');
                opt.value = pd.id;
                opt.innerText = pd.name;
                if (p.config.paperdollId === pd.id) opt.selected = true;
                pdSelect.appendChild(opt);
            });
        }
    } else {
        // Just ensure selected is correct
        pdSelect.value = p.config.paperdollId;
    }

    // Customizable Layers List
    const pdSettings = document.getElementById('player-visual-paperdoll-settings');
    let layerList = document.getElementById('player-pd-layer-list');
    if (!layerList) {
        layerList = document.createElement('div');
        layerList.id = 'player-pd-layer-list';
        layerList.style.marginTop = '10px';
        layerList.style.padding = '10px';
        layerList.style.background = 'var(--bg-primary)';
        layerList.style.borderRadius = '4px';
        layerList.style.maxHeight = '200px';
        layerList.style.overflowY = 'auto';
        pdSettings.appendChild(layerList);
    }

    // Clear old list? Yes.
    layerList.innerHTML = `
        <div style="font-size:0.8em; color:var(--text-secondary); margin-bottom:5px;">Select layers the player can customize:</div>
        <div style="display:grid; grid-template-columns: 1fr auto auto; gap: 5px; font-size:0.75em; color:var(--text-secondary); padding-bottom:5px; border-bottom: 1px solid var(--border-color); margin-bottom:5px;">
            <span>Layer</span>
            <span style="text-align:center;">Customize</span>
            <span style="text-align:center;">Removable</span>
        </div>
    `;

    if (p.config.paperdollId) {
        const pd = currentProjectData.paperdolls.find(x => x.id === p.config.paperdollId);
        if (pd && pd.layers) {
            // Get saved config - support both old array format and new object format
            const savedLayers = p.config.customizableLayers || [];
            const savedRemovable = p.config.removableLayers || [];

            pd.layers.forEach(layer => {
                // Check if this layer is customizable (support old string array format)
                const isCustomizable = savedLayers.includes(layer.name);
                // Check if this layer is removable
                const isRemovable = savedRemovable.includes(layer.name);

                const div = document.createElement('div');
                div.style.cssText = 'display:grid; grid-template-columns: 1fr auto auto; gap: 5px; align-items: center; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.05);';
                div.innerHTML = `
                    <span style="color:var(--text-primary); text-transform:capitalize;">${layer.name}</span>
                    <label style="display:flex; justify-content:center; cursor:pointer;">
                        <input type="checkbox" class="pd-layer-check" value="${layer.name}" ${isCustomizable ? 'checked' : ''} onchange="savePlayerConfig()">
                    </label>
                    <label style="display:flex; justify-content:center; cursor:pointer;" title="Allow player to hide/remove this layer">
                        <input type="checkbox" class="pd-layer-removable" value="${layer.name}" ${isRemovable ? 'checked' : ''} onchange="savePlayerConfig()" ${!isCustomizable ? 'disabled' : ''}>
                    </label>
                 `;
                layerList.appendChild(div);
            });
        }
    } else {
        layerList.innerHTML += '<div style="font-style:italic; opacity:0.5;">No paperdoll selected.</div>';
    }
}

function savePlayerConfig() {
    const p = currentProjectData.player;

    // Capture Config
    p.config.creationEnabled = document.getElementById('player-enable-creation').checked;
    p.config.visualType = document.getElementById('player-visual-type').value;
    p.config.defaultImage = document.getElementById('player-default-image').value;

    const prevPdId = p.config.paperdollId;
    p.config.paperdollId = document.getElementById('player-paperdoll-select').value;

    // If PD changed, refresh UI to show new layers
    if (prevPdId !== p.config.paperdollId) {
        // CLEAR Customizable Layers if PD changed
        p.config.customizableLayers = [];
        p.config.removableLayers = [];
        populatePlayerPaperdollLayers();
    } else {
        // Collect customizable checkboxes
        const checkboxes = document.querySelectorAll('.pd-layer-check');
        const customizable = [];
        checkboxes.forEach(cb => {
            if (cb.checked) customizable.push(cb.value);
        });
        p.config.customizableLayers = customizable;

        // Collect removable checkboxes
        const removableCheckboxes = document.querySelectorAll('.pd-layer-removable');
        const removable = [];
        removableCheckboxes.forEach(cb => {
            if (cb.checked && customizable.includes(cb.value)) {
                removable.push(cb.value);
            }
        });
        p.config.removableLayers = removable;

        // Refresh UI to update disabled states
        populatePlayerPaperdollLayers();
    }

    p.config.openSections = {
        identity: document.getElementById('creation-show-identity').checked,
        appearance: document.getElementById('creation-show-appearance').checked,
        stats: document.getElementById('creation-show-stats').checked,
        cheats: document.getElementById('creation-show-cheats').checked
    };
    p.config.startPoints = parseInt(document.getElementById('creation-stat-points').value) || 0;

    saveData();
}

function togglePlayerVisualSettings() {
    const type = document.getElementById('player-visual-type').value;
    const imgSettings = document.getElementById('player-visual-image-settings');
    const pdSettings = document.getElementById('player-visual-paperdoll-settings');

    if (type === 'image') {
        imgSettings.classList.remove('hidden');
        pdSettings.classList.add('hidden');
    } else if (type === 'paperdoll') {
        imgSettings.classList.add('hidden');
        pdSettings.classList.remove('hidden');
        // Ensure layer list is visible/updated
        populatePlayerPaperdollLayers();
    } else {
        imgSettings.classList.add('hidden');
        pdSettings.classList.add('hidden');
    }
}

function addPlayerStat() {
    if (!currentProjectData.player.stats) currentProjectData.player.stats = [];
    currentProjectData.player.stats.push({
        id: 'new_stat',
        name: 'New Stat',
        type: 'number',
        default: 0,
        cost: 1
    });
    saveData();
    populatePlayerTab();
}

function updatePlayerStat(index, field, value) {
    const stat = currentProjectData.player.stats[index];
    if (field === 'cost') value = parseInt(value) || 1;
    stat[field] = value;
    saveData();
}

function deletePlayerStat(index) {
    currentProjectData.player.stats.splice(index, 1);
    saveData();
    populatePlayerTab();
}

function uploadPlayerImage() {
    // Reuse existing logic or simple prompt
    const url = prompt("Enter prompt for image (or local path):");
    if (url) {
        document.getElementById('player-default-image').value = url;
        savePlayerConfig();
    }
}

// --- WALKTHROUGH EDITOR ---

let activeWalkthroughChapterIndex = -1;
let activeWalkthroughPageIndex = -1;

function populateWalkthroughEditor() {
    // Ensure walkthrough data structure exists
    if (!currentProjectData.walkthrough) {
        currentProjectData.walkthrough = { chapters: [] };
    }

    renderWalkthroughChapterList();

    // Reset editor content
    activeWalkthroughChapterIndex = -1;
    activeWalkthroughPageIndex = -1;

    const contentArea = document.getElementById('walkthrough-editor-content');
    contentArea.innerHTML = `
        <div style="text-align:center; color:var(--text-secondary); padding:40px;">
            <p style="font-size:2em;">📖</p>
            <p>Select a chapter to edit, or create a new one.</p>
            <p style="font-size:0.9em; opacity:0.7;">Walkthroughs help players who get stuck find their way through your game.</p>
        </div>
    `;
}

function renderWalkthroughChapterList() {
    const listContainer = document.getElementById('walkthrough-chapter-editor-list');
    if (!listContainer) return;

    const chapters = currentProjectData.walkthrough?.chapters || [];

    if (chapters.length === 0) {
        listContainer.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:20px; font-size:0.9em;">No chapters yet. Click "+ New Chapter" to create one.</div>';
        return;
    }

    listContainer.innerHTML = '';

    chapters.forEach((chapter, index) => {
        const item = document.createElement('div');
        item.style.cssText = `
            padding: 10px 12px;
            border-radius: 6px;
            cursor: pointer;
            background: ${index === activeWalkthroughChapterIndex ? 'var(--accent-color)' : 'var(--bg-tertiary)'};
            color: ${index === activeWalkthroughChapterIndex ? 'white' : 'var(--text-primary)'};
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s;
        `;

        item.innerHTML = `
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${chapter.title || `Chapter ${index + 1}`}</span>
            <span onclick="deleteWalkthroughChapter(${index}, event)" style="opacity:0.5; cursor:pointer; padding:2px 6px;" title="Delete Chapter">×</span>
        `;

        item.onclick = () => selectWalkthroughChapter(index);

        item.onmouseenter = () => {
            if (index !== activeWalkthroughChapterIndex) {
                item.style.background = 'var(--bg-secondary)';
            }
        };
        item.onmouseleave = () => {
            if (index !== activeWalkthroughChapterIndex) {
                item.style.background = 'var(--bg-tertiary)';
            }
        };

        listContainer.appendChild(item);
    });
}

function addWalkthroughChapter() {
    if (!currentProjectData.walkthrough) {
        currentProjectData.walkthrough = { chapters: [] };
    }

    const newChapter = {
        title: `Chapter ${currentProjectData.walkthrough.chapters.length + 1}`,
        pages: [{
            content: 'Start writing your walkthrough here...\n\nYou can use ![alt text](image_path.jpg) to insert images.'
        }]
    };

    currentProjectData.walkthrough.chapters.push(newChapter);
    saveData();
    renderWalkthroughChapterList();

    // Select the new chapter
    selectWalkthroughChapter(currentProjectData.walkthrough.chapters.length - 1);
}

function deleteWalkthroughChapter(index, event) {
    event.stopPropagation();

    if (!confirm('Delete this chapter and all its pages?')) return;

    currentProjectData.walkthrough.chapters.splice(index, 1);
    saveData();

    activeWalkthroughChapterIndex = -1;
    activeWalkthroughPageIndex = -1;

    populateWalkthroughEditor();
}

function selectWalkthroughChapter(index) {
    activeWalkthroughChapterIndex = index;
    activeWalkthroughPageIndex = 0;

    renderWalkthroughChapterList();
    renderChapterEditor();
}

function renderChapterEditor() {
    const contentArea = document.getElementById('walkthrough-editor-content');
    const chapter = currentProjectData.walkthrough.chapters[activeWalkthroughChapterIndex];

    if (!chapter) {
        contentArea.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:40px;">Select a chapter</div>';
        return;
    }

    const pages = chapter.pages || [];

    contentArea.innerHTML = `
        <div style="display:flex; gap:10px; margin-bottom:15px; align-items:center;">
            <label style="color:var(--text-secondary); white-space:nowrap;">Chapter Title:</label>
            <input type="text" id="wt-chapter-title" class="input-dark" value="${escapeHtml(chapter.title || '')}" 
                   onchange="updateWalkthroughChapterTitle(this.value)"
                   style="flex:1; padding:8px;">
        </div>
        
        <div style="display:flex; margin-bottom:15px; gap:10px; align-items:center; flex-wrap:wrap;">
            <span style="color:var(--text-secondary);">Pages:</span>
            <div id="wt-page-tabs" style="display:flex; gap:5px; flex-wrap:wrap;"></div>
            <button class="secondary-btn" onclick="addWalkthroughPage()" style="padding:4px 12px; font-size:0.85em;">+ Page</button>
        </div>
        
        <div style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="color:var(--text-secondary); font-size:0.9em;">
                    Page Content (supports text and images: ![alt](path))
                </span>
                <button class="secondary-btn" onclick="insertWalkthroughImage()" style="padding:4px 10px; font-size:0.85em;">📷 Insert Image</button>
            </div>
            <textarea id="wt-page-content" 
                      style="flex:1; min-height:300px; resize:none; padding:15px; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:6px; font-size:1em; line-height:1.6; font-family:inherit;"
                      onchange="updateWalkthroughPageContent(this.value)"
                      placeholder="Write your walkthrough content here..."></textarea>
        </div>
        
        ${pages.length > 1 ? `
            <div style="margin-top:15px; text-align:right;">
                <button class="secondary-btn" onclick="deleteWalkthroughPage()" style="color:red; border-color:rgba(255,0,0,0.3);">Delete This Page</button>
            </div>
        ` : ''}
    `;

    renderPageTabs();
    loadPageContent();
}

function renderPageTabs() {
    const tabsContainer = document.getElementById('wt-page-tabs');
    if (!tabsContainer) return;

    const chapter = currentProjectData.walkthrough.chapters[activeWalkthroughChapterIndex];
    const pages = chapter?.pages || [];

    tabsContainer.innerHTML = '';

    pages.forEach((_, index) => {
        const tab = document.createElement('button');
        const isActive = index === activeWalkthroughPageIndex;
        tab.style.cssText = `
            padding: 5px 12px;
            border-radius: 4px;
            cursor: pointer;
            border: 1px solid ${isActive ? 'var(--accent-color)' : 'var(--border-color)'};
            background: ${isActive ? 'var(--accent-color)' : 'var(--bg-tertiary)'};
            color: ${isActive ? 'white' : 'var(--text-primary)'};
            font-size: 0.85em;
            transition: all 0.2s;
        `;
        tab.textContent = `${index + 1}`;
        tab.onclick = () => {
            activeWalkthroughPageIndex = index;
            renderPageTabs();
            loadPageContent();
        };
        tabsContainer.appendChild(tab);
    });
}

function loadPageContent() {
    const textarea = document.getElementById('wt-page-content');
    if (!textarea) return;

    const chapter = currentProjectData.walkthrough.chapters[activeWalkthroughChapterIndex];
    const page = chapter?.pages?.[activeWalkthroughPageIndex];

    textarea.value = page?.content || '';
}

function updateWalkthroughChapterTitle(title) {
    const chapter = currentProjectData.walkthrough.chapters[activeWalkthroughChapterIndex];
    if (chapter) {
        chapter.title = title;
        saveData();
        renderWalkthroughChapterList();
    }
}

function updateWalkthroughPageContent(content) {
    const chapter = currentProjectData.walkthrough.chapters[activeWalkthroughChapterIndex];
    if (chapter && chapter.pages && chapter.pages[activeWalkthroughPageIndex]) {
        chapter.pages[activeWalkthroughPageIndex].content = content;
        saveData();
    }
}

function addWalkthroughPage() {
    const chapter = currentProjectData.walkthrough.chapters[activeWalkthroughChapterIndex];
    if (!chapter) return;

    if (!chapter.pages) chapter.pages = [];

    chapter.pages.push({
        content: ''
    });

    saveData();
    activeWalkthroughPageIndex = chapter.pages.length - 1;
    renderChapterEditor();
}

function deleteWalkthroughPage() {
    const chapter = currentProjectData.walkthrough.chapters[activeWalkthroughChapterIndex];
    if (!chapter || !chapter.pages || chapter.pages.length <= 1) {
        alert("Cannot delete the only page in a chapter.");
        return;
    }

    if (!confirm('Delete this page?')) return;

    chapter.pages.splice(activeWalkthroughPageIndex, 1);
    saveData();

    if (activeWalkthroughPageIndex >= chapter.pages.length) {
        activeWalkthroughPageIndex = chapter.pages.length - 1;
    }

    renderChapterEditor();
}

function insertWalkthroughImage() {
    const imagePath = prompt("Enter the image path (relative to project folder):\n\nExample: assets/walkthrough/step1.jpg");
    if (!imagePath) return;

    const altText = prompt("Enter alt text for the image (optional):", "Screenshot");

    const textarea = document.getElementById('wt-page-content');
    if (!textarea) return;

    const imageMarkdown = `![${altText || 'Image'}](${imagePath})`;

    // Insert at cursor position
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    textarea.value = text.substring(0, start) + '\n' + imageMarkdown + '\n' + text.substring(end);

    // Trigger save
    updateWalkthroughPageContent(textarea.value);

    // Restore focus
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + imageMarkdown.length + 2;
}

function saveWalkthrough() {
    saveData();
    alert('Walkthrough saved!');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
// --- Paperdoll Composer System ---

let activeComposerCallback = null;
let currentComposerState = {}; // { layerName: { img: 0, col: -1 } }
let activeComposerCharId = null;

window.openPaperdollComposer = function (initialState, charId, callback) {
    activeComposerCallback = callback;
    activeComposerCharId = charId || 'player';

    // Deep copy initial state or init empty
    currentComposerState = initialState ? JSON.parse(JSON.stringify(initialState)) : {};

    // Populate Character Select
    const charSel = document.getElementById('pd-composer-char-select');
    charSel.innerHTML = '<option value="player">Player</option>';
    (currentProjectData.characters || []).forEach(c => {
        charSel.innerHTML += `<option value="${c.id}" ${c.id === activeComposerCharId ? 'selected' : ''}>${c.name}</option>`;
    });
    charSel.value = activeComposerCharId;

    // Show Modal
    const modal = document.getElementById('modal-paperdoll-composer');
    modal.classList.remove('hidden');

    // Load Paperdoll Data for Character
    loadPaperdollComposer(activeComposerCharId);
};

window.closePaperdollComposer = function () {
    document.getElementById('modal-paperdoll-composer').classList.add('hidden');
    activeComposerCallback = null;
    activeComposerCharId = null;
};

window.savePaperdollComposerState = function () {
    if (activeComposerCallback) {
        // Filter out empty states? Or keep all for override.
        // We will return the object exactly as is.
        activeComposerCallback(currentComposerState);
    }
    closePaperdollComposer();
};

window.loadPaperdollComposer = function (charId) {
    activeComposerCharId = charId;
    const previewContainer = document.getElementById('pd-composer-preview');
    const controlsContainer = document.getElementById('pd-composer-controls');

    previewContainer.innerHTML = '';
    controlsContainer.innerHTML = '';

    // 1. Find the Paperdoll Definition
    let pdId = null;

    if (charId === 'player') {
        const pConfig = currentProjectData.player ? currentProjectData.player.config : null;
        if (pConfig && pConfig.visualType === 'paperdoll') {
            pdId = pConfig.paperdollId;
        }
    } else {
        // For NPCs, we need to find their config. 
        // Currently NPCs might just link to a paperdoll directly or we assume a shared one?
        // Let's assume for now `character.paperdollId` exists or check `paperdolls` for matching?
        // Simpler: Just grab the first paperdoll or look for one named after it.
        // TODO: Add `paperdollId` to Character Model efficiently.
        const char = currentProjectData.characters.find(c => c.id === charId);
        if (char && char.paperdollId) pdId = char.paperdollId;
    }

    // Fallback: Use first paperdoll if only one exists (common for single-protagonist games)
    if (!pdId && currentProjectData.paperdolls && currentProjectData.paperdolls.length > 0) {
        pdId = currentProjectData.paperdolls[0].id;
    }

    if (!pdId) {
        controlsContainer.innerHTML = '<p style="color:#aaa; text-align:center;">No Paperdoll assigned to this character.</p>';
        return;
    }

    const pdDef = currentProjectData.paperdolls.find(p => p.id === pdId);
    if (!pdDef) {
        controlsContainer.innerHTML = '<p style="color:red;">Paperdoll definition not found.</p>';
        return;
    }

    // 2. Render Controls
    renderComposerControls(pdDef, controlsContainer);

    // 3. Render Preview
    renderComposerPreview(pdDef, previewContainer);
};

function renderComposerControls(pdDef, container) {
    if (!pdDef.layers) return;

    // Reverse logic? Painter order is usually Bottom to Top. Controls often Top to Bottom.
    // Let's iterate normally.
    pdDef.layers.forEach(layer => {
        const row = document.createElement('div');
        row.style.marginBottom = "15px";
        row.style.background = "rgba(0,0,0,0.2)";
        row.style.padding = "10px";
        row.style.borderRadius = "4px";

        const label = document.createElement('div');
        label.innerText = layer.name;
        label.style.fontWeight = "bold";
        label.style.marginBottom = "5px";
        label.style.textTransform = "capitalize";
        row.appendChild(label);

        // Image Cycler
        const imgControls = document.createElement('div');
        imgControls.style.display = "flex";
        imgControls.style.alignItems = "center";
        imgControls.style.justifyContent = "space-between";

        const currentImgIdx = currentComposerState[layer.name] ? currentComposerState[layer.name].img : 0;
        const imgCount = layer.images ? layer.images.length : 0;

        // Display Text
        const disp = document.createElement('span');
        disp.innerText = (currentImgIdx < 0) ? 'None' : `${currentImgIdx + 1}/${imgCount}`;
        disp.style.fontFamily = "monospace";

        const btnLeft = document.createElement('button');
        btnLeft.className = "secondary-btn";
        btnLeft.innerText = "[<]";
        btnLeft.onclick = () => cycleComposerImage(layer.name, -1, pdDef);

        const btnRight = document.createElement('button');
        btnRight.className = "secondary-btn";
        btnRight.innerText = "[>]";
        btnRight.onclick = () => cycleComposerImage(layer.name, 1, pdDef);

        imgControls.appendChild(btnLeft);
        imgControls.appendChild(disp);
        imgControls.appendChild(btnRight);

        row.appendChild(imgControls);

        // Color Cycler (if applicable)
        // Check if current image has colorways
        const currentImg = (layer.images && currentImgIdx >= 0) ? layer.images[currentImgIdx] : null;
        if (currentImg && currentImg.colorways && currentImg.colorways.length > 0) {
            const colRow = document.createElement('div');
            colRow.style.marginTop = "5px";
            colRow.style.display = "flex";
            colRow.style.alignItems = "center";
            colRow.style.justifyContent = "space-between";

            const currentColIdx = currentComposerState[layer.name] ? currentComposerState[layer.name].col : -1;
            const colCount = currentImg.colorways.length;

            const colDisp = document.createElement('span');
            colDisp.innerText = (currentColIdx === -1) ? 'Base' : `Var ${currentColIdx + 1}`;
            colDisp.style.fontSize = "0.9em";
            colDisp.style.opacity = "0.8";

            const cBtnLeft = document.createElement('button');
            cBtnLeft.className = "secondary-btn";
            cBtnLeft.style.padding = "2px 8px";
            cBtnLeft.innerText = "[<]";
            cBtnLeft.onclick = () => cycleComposerColor(layer.name, -1, pdDef);

            const cBtnRight = document.createElement('button');
            cBtnRight.className = "secondary-btn";
            cBtnRight.style.padding = "2px 8px";
            cBtnRight.innerText = "[>]";
            cBtnRight.onclick = () => cycleComposerColor(layer.name, 1, pdDef);

            colRow.appendChild(cBtnLeft);
            colRow.appendChild(colDisp);
            colRow.appendChild(cBtnRight);
            row.appendChild(colRow);
        }

        container.appendChild(row);
    });
}

function cycleComposerImage(layerName, dir, pdDef) {
    const layer = pdDef.layers.find(l => l.name === layerName);
    if (!layer || !layer.images) return;

    // Init state if missing
    if (!currentComposerState[layerName]) currentComposerState[layerName] = { img: 0, col: -1 };

    let current = currentComposerState[layerName].img;
    const max = layer.images.length - 1;
    const min = -1; // Allow 'None' (hidden)

    current += dir;
    if (current > max) current = min;
    if (current < min) current = max;

    currentComposerState[layerName].img = current;
    currentComposerState[layerName].col = -1; // Reset color logic

    // Refresh
    loadPaperdollComposer(activeComposerCharId);
}

function cycleComposerColor(layerName, dir, pdDef) {
    const layer = pdDef.layers.find(l => l.name === layerName);
    if (!layer) return;

    // Check image
    const imgIdx = currentComposerState[layerName] ? currentComposerState[layerName].img : 0;
    if (imgIdx < 0) return; // No image, no color

    const img = layer.images[imgIdx];
    if (!img.colorways) return;

    let current = currentComposerState[layerName] ? currentComposerState[layerName].col : -1;
    const max = img.colorways.length - 1;
    const min = -1; // Base

    current += dir;
    if (current > max) current = min;
    if (current < min) current = max;

    currentComposerState[layerName].col = current;

    loadPaperdollComposer(activeComposerCharId);
}

function renderComposerPreview(pdDef, container) {
    container.innerHTML = '';

    pdDef.layers.forEach(layer => {
        // State or Default
        // If state is not set, default to 0? Or do we want to preview defaults vs. our changes?
        // The composer should ideally show the FULL paperdoll. 
        // So if state is missing, use default 0.

        let imgIdx = 0;
        let colIdx = -1;

        if (currentComposerState[layer.name]) {
            imgIdx = currentComposerState[layer.name].img;
            colIdx = currentComposerState[layer.name].col;
        } else {
            // Check default?
            if (layer.selectedImageIdx !== undefined) imgIdx = layer.selectedImageIdx;
        }

        if (imgIdx < 0) return; // Hidden
        if (!layer.images || !layer.images[imgIdx]) return;

        const imgObj = layer.images[imgIdx];
        let src = imgObj.base;
        if (colIdx > -1 && imgObj.colorways && imgObj.colorways[colIdx]) {
            src = imgObj.colorways[colIdx];
        }

        const img = document.createElement('img');
        img.src = src; // These paths are relative to project
        img.style.position = "absolute";
        img.style.top = 0;
        img.style.left = 0;
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "contain";
        if (layer.zIndex) img.style.zIndex = layer.zIndex;

        container.appendChild(img);
    });
}

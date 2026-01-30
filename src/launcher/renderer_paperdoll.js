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
        btnLeft.innerText = "◀";
        btnLeft.onclick = () => cycleComposerImage(layer.name, -1, pdDef);

        const btnRight = document.createElement('button');
        btnRight.className = "secondary-btn";
        btnRight.innerText = "▶";
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
            cBtnLeft.innerText = "<";
            cBtnLeft.onclick = () => cycleComposerColor(layer.name, -1, pdDef);

            const cBtnRight = document.createElement('button');
            cBtnRight.className = "secondary-btn";
            cBtnRight.style.padding = "2px 8px";
            cBtnRight.innerText = ">";
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

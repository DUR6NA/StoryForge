
class GraphEditor {
    constructor(canvasId, containerId) {
        this.canvas = document.getElementById(canvasId);
        this.container = document.getElementById(containerId);
        this.ctx = this.canvas.getContext('2d');

        this.nodes = [];
        this.connections = [];
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        this.isDragging = false;
        this.draggedNode = null;
        this.isResizing = false;

        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Colors
        this.colors = {
            bg: '#1e1e1e', // Grid bg
            nodeBg: '#2d2d2d',
            nodeBorder: '#444',
            nodeSelected: '#0A84FF',
            text: '#fff',
            line: '#666',
            lineActive: '#fff'
        };

        this.initListeners();
    }

    initListeners() {
        // Resize observer
        new ResizeObserver(() => this.resize()).observe(this.container);

        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));

        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));

        // Context Menu (Right Click)
        this.canvas.addEventListener('contextmenu', (e) => this.onContextMenu(e));
    }

    resize() {
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.container.clientHeight;
        this.draw();
    }

    // Data Sync
    loadLocations(locations) {
        this.locations = locations;
        // Convert locations to nodes
        this.nodes = locations.map((loc, index) => {
            // Default pos if not set
            if (!loc.editor) loc.editor = { x: 100 + (index * 250), y: 100, w: 200, h: 120, ports: 1 };

            // Ensure visual port count exists
            if (!loc.editor.ports) loc.editor.ports = Math.max(1, loc.choices ? loc.choices.length : 1);

            return {
                id: loc.id,
                name: loc.name,
                x: loc.editor.x,
                y: loc.editor.y,
                width: loc.editor.w || 200,
                height: loc.editor.h || 120,
                portCount: loc.editor.ports,
                data: loc,
                index: index
            };
        });

        // Rebuild connections
        this.updateConnections();
        this.draw();
    }

    updateConnections() {
        this.connections = [];
        this.nodes.forEach(node => {
            if (node.data.choices) {
                node.data.choices.forEach((choice, index) => {
                    if (choice.action === 'navigate' && choice.target) {
                        const targetNode = this.nodes.find(n => n.id === choice.target);
                        if (targetNode) {
                            let type = 'one-way';
                            if (targetNode.data.choices && targetNode.data.choices.some(c => c.target === node.id)) {
                                type = 'bi-directional';
                            }

                            this.connections.push({
                                from: node,
                                to: targetNode,
                                label: choice.text,
                                type: type,
                                choice: choice
                            });
                        }
                    }
                });
            }
        });
    }

    savePositions() {
        // Update the source data
        this.nodes.forEach(node => {
            node.data.editor = {
                x: node.x,
                y: node.y,
                w: node.width,
                h: node.height,
                ports: node.portCount
            };
        });
        if (window.saveData) window.saveData();
    }

    // Helper to get connection bounds for hit testing
    getConnectionHitBox(conn) {
        // Recalculate start/end points dynamically based on relative position
        const { startX, startY, endX, endY } = this.calculateConnectionPoints(conn.from, conn.to, conn.choice ? conn.choice.portIndex : 0);

        // Midpoint
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        return { x: midX, y: midY, r: 20 };
    }

    // Determine connection points based on relative position (Left/Right)
    calculateConnectionPoints(source, target, portIndex = 0) {
        // Find center points
        const sourceCx = source.x + source.width / 2;
        const targetCx = target.x + target.width / 2;

        // Determine Direction
        // If Target is to the Right -> Connect Source Right to Target Left (Standard)
        // If Target is to the Left -> Connect Source Left to Target Right (Reversed)
        const isTargetRight = targetCx > sourceCx;

        // Source Port
        // Visually clamp port index
        const pIndex = Math.min(portIndex || 0, source.portCount - 1);
        const portHeader = 30;
        const availableHeight = source.height - portHeader;
        const portSpacing = availableHeight / (source.portCount + 1);
        const portY = source.y + portHeader + (portSpacing * (pIndex + 1));

        let startX, startY, endX, endY;

        if (isTargetRight) {
            // Standard: Source Right -> Target Left
            startX = source.x + source.width;
            startY = portY;
            endX = target.x;
            endY = target.y + (target.height / 2); // Target Center-Left
        } else {
            // Reversed: Source Left -> Target Right
            startX = source.x; // Left side
            startY = portY;
            endX = target.x + target.width; // Right side
            endY = target.y + (target.height / 2); // Target Center-Right
        }

        return { startX, startY, endX, endY };
    }

    // Interaction
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.offsetX) / this.scale;
        const y = (e.clientY - rect.top - this.offsetY) / this.scale;
        return { x, y, rawX: e.clientX - rect.left, rawY: e.clientY - rect.top };
    }

    onMouseDown(e) {
        // Middle Click (Button 1) - Delete Connection
        if (e.button === 1) {
            e.preventDefault();
            const { x, y } = this.getMousePos(e);

            // Hit test connections
            let clickedConn = null;
            for (const conn of this.connections) {
                const hit = this.getConnectionHitBox(conn);
                if (Math.hypot(x - hit.x, y - hit.y) < hit.r) {
                    clickedConn = conn;
                    break;
                }
            }

            if (clickedConn) {
                this.deleteConnection(clickedConn);
                return;
            }
            return;
        }

        if (e.button === 2) return; // Right click handled elsewhere

        const { x, y, rawX, rawY } = this.getMousePos(e);

        // Reverse iterate for top nodes
        for (let i = this.nodes.length - 1; i >= 0; i--) {
            const node = this.nodes[i];

            // 1. Check Resize Handle (Bottom-Right)
            if (x >= node.x + node.width - 15 && x <= node.x + node.width &&
                y >= node.y + node.height - 15 && y <= node.y + node.height) {
                this.draggedNode = node;
                this.isResizing = true;
                return;
            }

            // 2. Check Delete Button (top-left, after title area)
            if (x >= node.x + 5 && x <= node.x + 25 && y >= node.y + node.height - 25 && y <= node.y + node.height - 5) {
                // Open delete confirmation modal
                if (window.openDeleteLocationModal) {
                    window.openDeleteLocationModal(node.index, null);
                }
                return;
            }

            // 3. Check Plus/Minus
            if (x >= node.x + node.width - 25 && x <= node.x + node.width - 5 && y >= node.y + 5 && y <= node.y + 20) {
                node.portCount++;
                this.savePositions();
                this.draw();
                return;
            }
            if (x >= node.x + node.width - 50 && x <= node.x + node.width - 30 && y >= node.y + 5 && y <= node.y + 20) {
                if (node.portCount > 1) {
                    node.portCount--;
                    this.savePositions();
                    this.draw();
                }
                return;
            }

            // 4. Check Ports (Both Sides)
            const portHeader = 30;
            const availableHeight = node.height - portHeader;
            const portSpacing = availableHeight / (node.portCount + 1);

            for (let p = 0; p < node.portCount; p++) {
                const Py = node.y + portHeader + (portSpacing * (p + 1));

                // Right Port
                const PxRight = node.x + node.width;
                if (Math.hypot(x - PxRight, y - Py) < 10) {
                    this.connectingNode = node;
                    this.isConnecting = true;
                    this.connectingPortIndex = p;
                    return;
                }

                // Left Port
                const PxLeft = node.x;
                if (Math.hypot(x - PxLeft, y - Py) < 10) {
                    this.connectingNode = node;
                    this.isConnecting = true;
                    this.connectingPortIndex = p;
                    return;
                }
            }

            // 5. Check Body (Drag)
            if (x >= node.x && x <= node.x + node.width &&
                y >= node.y && y <= node.y + node.height) {
                this.draggedNode = node;
                this.isDragging = true;
                this.selectNode(node);
                return;
            }
        }

        this.isPanning = true;
        this.lastMouseX = rawX;
        this.lastMouseY = rawY;
    }

    onMouseMove(e) {
        const { x, y, rawX, rawY } = this.getMousePos(e);
        this.mousePos = { x, y };

        if (this.isResizing && this.draggedNode) {
            this.draggedNode.width = Math.max(100, x - this.draggedNode.x);
            this.draggedNode.height = Math.max(80, y - this.draggedNode.y);
            this.draw();
        } else if (this.isConnecting) {
            this.draw();
        } else if (this.isDragging && this.draggedNode) {
            this.draggedNode.x = x - (this.draggedNode.width / 2);
            this.draggedNode.y = y - (this.draggedNode.height / 2);
            this.draw();
        } else if (this.isPanning) {
            const dx = rawX - this.lastMouseX;
            const dy = rawY - this.lastMouseY;
            this.offsetX += dx;
            this.offsetY += dy;
            this.lastMouseX = rawX;
            this.lastMouseY = rawY;
            this.draw();
        }
    }

    onMouseUp(e) {
        const { x, y } = this.getMousePos(e);

        if (this.isConnecting && this.connectingNode) {
            console.log("onMouseUp: isConnecting=true, looking for target node at", { x, y });
            // Find target (Any node hit)
            let foundTarget = false;
            for (let i = this.nodes.length - 1; i >= 0; i--) {
                const targetNode = this.nodes[i];
                if (targetNode !== this.connectingNode &&
                    x >= targetNode.x - 20 && x <= targetNode.x + targetNode.width + 20 &&
                    y >= targetNode.y && y <= targetNode.y + targetNode.height) {

                    console.log("Target node found:", targetNode.id);
                    this.createConnection(this.connectingNode, targetNode, this.connectingPortIndex);
                    foundTarget = true;
                    break;
                }
            }
            if (!foundTarget) {
                console.log("No target node found at release position.");
            }
        }

        if (this.isDragging || this.isResizing) {
            this.savePositions();
        }
        this.isDragging = false;
        this.isResizing = false;
        this.isPanning = false;
        this.isConnecting = false;
        this.draggedNode = null;
        this.connectingNode = null;
        this.draw();
    }

    onContextMenu(e) {
        e.preventDefault();
        const { x, y } = this.getMousePos(e);

        let clickedConn = null;
        for (const conn of this.connections) {
            const hit = this.getConnectionHitBox(conn);
            if (Math.hypot(x - hit.x, y - hit.y) < hit.r) {
                clickedConn = conn;
                break;
            }
        }

        if (clickedConn) {
            this.toggleConnectionDirection(clickedConn);
        }
    }

    deleteConnection(conn) {
        const A = conn.from;
        const B = conn.to;

        if (A.data.choices) A.data.choices = A.data.choices.filter(c => c.target !== B.id);
        if (B.data.choices) B.data.choices = B.data.choices.filter(c => c.target !== A.id);

        this.updateConnections();
        if (window.saveData) window.saveData();
        this.draw();
    }

    addChoice(source, target, portIndex = 0) {
        if (!source.data.choices) source.data.choices = [];
        const exists = source.data.choices.some(c => c.target === target.id);
        if (exists) return;
        source.data.choices.push({
            text: `Go to ${target.name}`,
            action: 'navigate',
            target: target.id,
            portIndex: portIndex
        });
    }

    removeChoice(source, target) {
        if (!source.data.choices) return;
        source.data.choices = source.data.choices.filter(c => c.target !== target.id);
    }

    toggleConnectionDirection(conn) {
        const n1 = conn.from.id < conn.to.id ? conn.from : conn.to;
        const n2 = conn.from.id < conn.to.id ? conn.to : conn.from;

        const c1 = n1.data.choices?.find(c => c.target === n2.id);
        const c2 = n2.data.choices?.find(c => c.target === n1.id);

        const hasN1toN2 = !!c1;
        const hasN2toN1 = !!c2;

        if (hasN1toN2 && !hasN2toN1) {
            // State 1: A -> B. Switch to B -> A
            this.removeChoice(n1, n2);
            this.addChoice(n2, n1, 0);
        } else if (!hasN1toN2 && hasN2toN1) {
            // State 2: B -> A. Switch to Bi-directional
            this.addChoice(n1, n2, 0);
        } else if (hasN1toN2 && hasN2toN1) {
            // State 3: Both. Switch to A -> B
            this.removeChoice(n2, n1);
        } else {
            // Default
            this.addChoice(n1, n2, 0);
        }

        this.updateConnections();
        if (window.saveData) window.saveData();
        this.draw();
    }

    createConnection(source, target, portIndex = 0) {
        if (!source.data.choices) source.data.choices = [];
        const exists = source.data.choices.some(c => c.target === target.id);
        if (exists) return;

        source.data.choices.push({
            text: `Go to ${target.name}`,
            action: 'navigate',
            target: target.id,
            portIndex: portIndex
        });

        // Ensure source has enough ports visually
        if (!source.data.editor) source.data.editor = {};
        if ((source.data.editor.ports || 1) <= portIndex) {
            source.data.editor.ports = portIndex + 1;
            source.portCount = source.data.editor.ports;
        }

        this.updateConnections();
        if (window.saveData) window.saveData();
        this.draw();
    }

    onWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.scale *= delta;
        // Clamp scale
        this.scale = Math.min(Math.max(0.1, this.scale), 5);
        this.draw();
    }

    onDoubleClick(e) {
        const { x, y } = this.getMousePos(e);

        // Find top-most node (reverse iterate)
        let clickedNode = null;
        for (let i = this.nodes.length - 1; i >= 0; i--) {
            const node = this.nodes[i];
            if (x >= node.x && x <= node.x + node.width &&
                y >= node.y && y <= node.y + node.height) {
                clickedNode = node;
                break;
            }
        }

        if (!clickedNode && window.addNewLocationAt) {
            window.addNewLocationAt(x, y);
        } else if (clickedNode) {
            // Header Hit Test for Quick Rename
            // Header is top 30px
            if (y >= clickedNode.y && y <= clickedNode.y + 30) {
                this.showRenameInput(clickedNode);
                return;
            }

            // Normal Edit
            if (window.loadLocationToForm && window.switchGraphToEdit) {
                window.loadLocationToForm(clickedNode.index);
                window.switchGraphToEdit();
            }
        }
    }

    showRenameInput(node) {
        // Calculate screen position for the input
        // x, y are in world space. Need to convert to screen space (relative to container).
        // screenX = (worldX * scale) + offsetX
        const screenX = (node.x * this.scale) + this.offsetX;
        const screenY = (node.y * this.scale) + this.offsetY;
        const width = node.width * this.scale;
        const height = 30 * this.scale; // Header height

        // Create Input
        const input = document.createElement('input');
        input.type = 'text';
        input.value = node.name;
        input.style.position = 'absolute';
        input.style.left = `${screenX}px`;
        input.style.top = `${screenY}px`;
        input.style.width = `${width}px`;
        input.style.height = `${height}px`;
        input.style.background = '#1e1e1e';
        input.style.color = '#fff';
        input.style.border = '2px solid #0A84FF';
        input.style.borderRadius = '4px 4px 0 0';
        input.style.padding = '0 5px';
        input.style.fontFamily = '"Inter", sans-serif';
        input.style.fontSize = `${14 * this.scale}px`; // Scale font slightly?
        input.style.fontWeight = 'bold';
        input.style.zIndex = '1000';
        input.style.outline = 'none';

        this.container.appendChild(input);
        input.focus();
        input.select(); // Highlight text so user sees "marker" / selection

        const saveAndClose = () => {
            const newName = input.value.trim();
            if (newName) {
                node.data.name = newName;
                node.name = newName;
                if (window.saveData) window.saveData();
                if (window.populateLocationList) window.populateLocationList();
                this.draw();
            }
            if (input.parentNode) input.parentNode.removeChild(input);
        };

        // Events
        input.addEventListener('blur', saveAndClose);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveAndClose();
            }
            e.stopPropagation(); // Prevent other graph shortcuts if any
        });

        // Prevent canvas interaction while editing
        this.isEditingText = true;

        // Cleanup helper
        const cleanup = () => {
            this.isEditingText = false;
        };
        input.addEventListener('blur', cleanup);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') cleanup(); });
    }

    selectNode(node) {
        this.selectedNode = node;
        if (window.loadLocationToForm) {
            window.loadLocationToForm(node.index);
        }
        this.draw();
    }

    // Drawing
    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // Grid
        this.drawGrid();

        // Connections
        this.drawConnections();

        // Temp Line
        if (this.isConnecting && this.connectingNode && this.mousePos) {
            // Anchor from port
            // We need to know WHICH side we started connecting from?
            // Currently onMouseDown sets connectingPortIndex, but not SIDE?
            // Just use the side closer to the mouse?

            // Re-calculate closest side for feedback
            const node = this.connectingNode;
            const portHeader = 30;
            const availableHeight = node.height - portHeader;
            const portSpacing = availableHeight / (node.portCount + 1);
            let pIndex = this.connectingPortIndex ?? 0;
            const Py = node.y + portHeader + (portSpacing * (pIndex + 1));

            // Check Distances
            // But we don't know start X? 
            // Assumption: we want to draw from the "Left/Right" based on cursor position relative to node center
            const isRight = this.mousePos.x > (node.x + node.width / 2);
            const startX = isRight ? node.x + node.width : node.x;

            this.ctx.beginPath();
            this.ctx.moveTo(startX, Py);
            this.ctx.lineTo(this.mousePos.x, this.mousePos.y);
            this.ctx.strokeStyle = '#fff';
            this.ctx.setLineDash([5, 5]);
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        // Nodes
        this.nodes.forEach(node => this.drawNode(node));

        this.ctx.restore();
    }

    drawGrid() {
        const step = 50;
        const left = -this.offsetX / this.scale;
        const top = -this.offsetY / this.scale;
        const right = left + (this.canvas.width / this.scale);
        const bottom = top + (this.canvas.height / this.scale);

        this.ctx.lineWidth = 1;

        // Small grid
        this.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        this.ctx.beginPath();
        for (let x = Math.floor(left / step) * step; x < right; x += step) {
            this.ctx.moveTo(x, top);
            this.ctx.lineTo(x, bottom);
        }
        for (let y = Math.floor(top / step) * step; y < bottom; y += step) {
            this.ctx.moveTo(left, y);
            this.ctx.lineTo(right, y);
        }
        this.ctx.stroke();
    }

    drawConnections() {
        this.connections.forEach((conn, i) => {
            // Deduplicate bidirectional connections
            // Only draw the one where from.id < to.id
            if (conn.type === 'bi-directional' && conn.from.id > conn.to.id) return;

            const { startX, startY, endX, endY } = this.calculateConnectionPoints(conn.from, conn.to, conn.choice ? conn.choice.portIndex : 0);

            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);

            const dist = Math.abs(endX - startX);
            const cpOffset = Math.max(dist / 2, 50);

            let cp1X, cp1Y, cp2X, cp2Y;

            // Determine direction for control points
            const isSourceRight = startX > conn.from.x + (conn.from.width / 2);

            // Source is Right Side -> CP goes Right (+offset)
            // Source is Left Side -> CP goes Left (-offset)
            cp1X = isSourceRight ? startX + cpOffset : startX - cpOffset;
            cp1Y = startY;

            // Target is Right Side -> CP goes Right (+offset) (Meaning coming from right)
            // Target is Left Side -> CP goes Left (-offset) (Meaning coming from left)
            // But wait, calculateConnectionPoints returns endX on the EDGE.

            const targetIsLeftEdge = endX === conn.to.x;
            cp2X = targetIsLeftEdge ? endX - cpOffset : endX + cpOffset;
            cp2Y = endY;

            this.ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);

            this.ctx.strokeStyle = '#888';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();

            // Badge
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            // Draw Background Circle 
            this.ctx.fillStyle = '#222';
            this.ctx.strokeStyle = '#aaa';
            this.ctx.lineWidth = 2;

            this.ctx.beginPath();
            this.ctx.arc(midX, midY, 12, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            // Draw Symbol
            this.ctx.fillStyle = '#fff';

            if (conn.type === 'bi-directional') {
                // Equals Sign (=)
                this.ctx.fillRect(midX - 5, midY - 3, 10, 2);
                this.ctx.fillRect(midX - 5, midY + 1, 10, 2);
            } else {
                // Check if line goes "backwards" visually (End X < Start X)
                const flowsLeft = endX < startX;

                this.ctx.beginPath();
                if (flowsLeft) {
                    // Point Left
                    this.ctx.moveTo(midX - 3, midY);
                    this.ctx.lineTo(midX + 3, midY - 4);
                    this.ctx.lineTo(midX + 3, midY + 4);
                } else {
                    // Point Right
                    this.ctx.moveTo(midX + 3, midY);
                    this.ctx.lineTo(midX - 3, midY - 4);
                    this.ctx.lineTo(midX - 3, midY + 4);
                }
                this.ctx.fill();
            }
        });
    }

    drawNode(node) {
        // Shadow
        this.ctx.shadowBlur = (this.selectedNode === node) ? 15 : 5;
        this.ctx.shadowColor = 'rgba(0,0,0,0.5)';

        // Box
        this.ctx.fillStyle = this.colors.nodeBg;
        this.ctx.strokeStyle = (this.selectedNode === node) ? this.colors.nodeSelected : this.colors.nodeBorder;
        this.ctx.lineWidth = 2;

        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(node.x, node.y, node.width, node.height, 8);
        } else {
            this.ctx.rect(node.x, node.y, node.width, node.height);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.shadowBlur = 0;

        // Header Background
        this.ctx.fillStyle = 'rgba(255,255,255,0.05)';
        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(node.x, node.y, node.width, 30, [8, 8, 0, 0]);
        } else {
            this.ctx.rect(node.x, node.y, node.width, 30);
        }
        this.ctx.closePath();
        this.ctx.fill();

        // Title
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = 'bold 14px "Inter", sans-serif';
        this.ctx.fillText(node.name || node.id, node.x + 10, node.y + 20);

        // +/- Buttons
        this.ctx.fillStyle = '#444';
        this.ctx.fillRect(node.x + node.width - 50, node.y + 5, 20, 15);
        this.ctx.fillRect(node.x + node.width - 25, node.y + 5, 20, 15);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 12px monospace';
        this.ctx.fillText("-", node.x + node.width - 44, node.y + 16);
        this.ctx.fillText("+", node.x + node.width - 19, node.y + 16);

        // ID
        this.ctx.fillStyle = '#888';
        this.ctx.font = '10px monospace';
        this.ctx.fillText(node.id, node.x + 10, node.y + 45);

        // Ports (Both Sides)
        const portHeader = 30;
        const availableHeight = node.height - portHeader;
        const portSpacing = availableHeight / (node.portCount + 1);

        for (let p = 0; p < node.portCount; p++) {
            const Py = node.y + portHeader + (portSpacing * (p + 1));

            // Right Port
            this.ctx.fillStyle = '#666';
            this.ctx.beginPath();
            this.ctx.arc(node.x + node.width, Py, 5, 0, Math.PI * 2);
            this.ctx.fill();

            // Left Port
            this.ctx.beginPath();
            this.ctx.arc(node.x, Py, 5, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Resize Handle
        this.ctx.fillStyle = '#666';
        this.ctx.beginPath();
        this.ctx.moveTo(node.x + node.width - 10, node.y + node.height);
        this.ctx.lineTo(node.x + node.width, node.y + node.height);
        this.ctx.lineTo(node.x + node.width, node.y + node.height - 10);
        this.ctx.closePath();
        this.ctx.fill();

        // Delete Button (bottom-left corner)
        const delX = node.x + 5;
        const delY = node.y + node.height - 25;
        const delSize = 20;

        // Draw button background
        this.ctx.fillStyle = 'rgba(100, 50, 50, 0.8)';
        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(delX, delY, delSize, delSize, 4);
        } else {
            this.ctx.rect(delX, delY, delSize, delSize);
        }
        this.ctx.closePath();
        this.ctx.fill();

        // Draw X symbol for delete
        this.ctx.strokeStyle = '#ff6666';
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        // Draw X
        this.ctx.moveTo(delX + 5, delY + 5);
        this.ctx.lineTo(delX + delSize - 5, delY + delSize - 5);
        this.ctx.moveTo(delX + delSize - 5, delY + 5);
        this.ctx.lineTo(delX + 5, delY + delSize - 5);
        this.ctx.stroke();
    }
}

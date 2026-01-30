const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const fsPromises = require('fs').promises

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        title: 'StoryForge',
        backgroundColor: '#121212'
    })

    win.loadFile(path.join(__dirname, 'launcher/index.html'))
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// --- IPC Handlers ---

const GAMES_DIR = path.join(__dirname, 'games')

// Ensure games directory exists
if (!fs.existsSync(GAMES_DIR)) {
    fs.mkdirSync(GAMES_DIR);
}

ipcMain.handle('get-projects', async () => {
    try {
        const dirents = await fsPromises.readdir(GAMES_DIR, { withFileTypes: true });
        return dirents
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
    } catch (error) {
        console.error('Failed to get projects:', error);
        return [];
    }
})

ipcMain.handle('create-project', async (event, projectName) => {
    try {
        const projectPath = path.join(GAMES_DIR, projectName);
        if (fs.existsSync(projectPath)) {
            return { success: false, error: 'Project already exists' };
        }
        await fsPromises.mkdir(projectPath);

        // Create basic structure
        const initialData = {
            story: [],
            locations: [],
            characters: [],
            variables: {}
        };

        await fsPromises.writeFile(
            path.join(projectPath, 'data.json'),
            JSON.stringify(initialData, null, 4)
        );

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
})

ipcMain.handle('load-project-file', async (event, projectName, fileName) => {
    try {
        const filePath = path.join(GAMES_DIR, projectName, fileName);
        if (!fs.existsSync(filePath)) return null;

        const content = await fsPromises.readFile(filePath, 'utf-8');
        return content;
    } catch (error) {
        console.error('Failed to load file:', error);
        throw error;
    }
})

ipcMain.handle('save-project-file', async (event, projectName, fileName, content) => {
    try {
        const filePath = path.join(GAMES_DIR, projectName, fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            await fsPromises.mkdir(dir, { recursive: true });
        }

        await fsPromises.writeFile(filePath, content, 'utf-8');
        return { success: true };
    } catch (error) {
        console.error('Failed to save file:', error);
        return { success: false, error: error.message };
    }
})

ipcMain.handle('save-asset', async (event, projectName, fileName, base64Data) => {
    try {
        const filePath = path.join(GAMES_DIR, projectName, fileName);
        const buffer = Buffer.from(base64Data, 'base64');

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            await fsPromises.mkdir(dir, { recursive: true });
        }

        await fsPromises.writeFile(filePath, buffer);
        return { success: true, path: fileName };
    } catch (error) {
        console.error('Failed to save asset:', error);
        return { success: false, error: error.message };
    }
})

ipcMain.handle('delete-project', async (event, projectName) => {
    try {
        const projectPath = path.join(GAMES_DIR, projectName);
        // Security check: Ensure we only delete inside GAMES_DIR
        if (!projectPath.startsWith(GAMES_DIR)) {
            throw new Error("Invalid path");
        }

        if (!fs.existsSync(projectPath)) {
            return { success: false, error: 'Project not found' };
        }

        await fsPromises.rm(projectPath, { recursive: true, force: true });
        return { success: true };
    } catch (error) {
        console.error('Failed to delete project:', error);
        return { success: false, error: error.message };
    }
})

ipcMain.handle('delete-project-file', async (event, projectName, fileName) => {
    try {
        const filePath = path.join(GAMES_DIR, projectName, fileName);
        // Security check
        if (!filePath.startsWith(GAMES_DIR)) throw new Error("Invalid path");

        if (fs.existsSync(filePath)) {
            await fsPromises.unlink(filePath);
        }
        return { success: true };
    } catch (error) {
        console.error('Failed to delete file:', error);
        return { success: false, error: error.message };
    }
})


ipcMain.on('launch-game', (event, projectName, theme, glass) => {
    const gameWin = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        },
        title: `StoryForge - ${projectName || 'Game'}`,
        backgroundColor: '#000000'
    })

    const query = { project: projectName };
    if (theme) query.theme = theme;
    if (glass) query.glass = glass;

    gameWin.loadFile(path.join(__dirname, 'engine/game.html'), { query: query });
})

ipcMain.on('close-game', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
})

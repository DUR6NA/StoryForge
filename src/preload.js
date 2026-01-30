const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    launchGame: (projectName, theme, glass) => ipcRenderer.send('launch-game', projectName, theme, glass),
    getProjects: () => ipcRenderer.invoke('get-projects'),
    createProject: (name) => ipcRenderer.invoke('create-project', name),
    loadProjectFile: (project, file) => ipcRenderer.invoke('load-project-file', project, file),
    saveProjectFile: (project, file, content) => ipcRenderer.invoke('save-project-file', project, file, content),
    saveAsset: (project, file, data) => ipcRenderer.invoke('save-asset', project, file, data),
    deleteProject: (project) => ipcRenderer.invoke('delete-project', project),
    deleteProjectFile: (project, file) => ipcRenderer.invoke('delete-project-file', project, file),
    closeGame: () => ipcRenderer.send('close-game')
})

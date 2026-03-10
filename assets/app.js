const state = {
    roots: Array.isArray(window.APP_CONFIG?.roots) ? window.APP_CONFIG.roots : [],
    currentRoot: '',
    tree: [],
    openTabs: [],
    activePath: '',
    expandedDirs: new Set(),
    editor: null,
    suppressModelChange: false,
    workspaceCollapsed: false,
};

const els = {
    fileMenuBtn: document.getElementById('fileMenuBtn'),
    fileMenu: document.getElementById('fileMenu'),
    openFolderMenuItem: document.getElementById('openFolderMenuItem'),
    folderDialog: document.getElementById('folderDialog'),
    closeFolderDialogBtn: document.getElementById('closeFolderDialogBtn'),
    cancelFolderDialogBtn: document.getElementById('cancelFolderDialogBtn'),
    rootSelect: document.getElementById('rootSelect'),
    openRootBtn: document.getElementById('openRootBtn'),
    customRootInput: document.getElementById('customRootInput'),
    currentRootLabel: document.getElementById('currentRootLabel'),
    workspaceRootBar: document.getElementById('workspaceRootBar'),
    workspaceCollapseBtn: document.getElementById('workspaceCollapseBtn'),
    workspaceNewFileBtn: document.getElementById('workspaceNewFileBtn'),
    workspaceNewFolderBtn: document.getElementById('workspaceNewFolderBtn'),
    workspaceUploadBtn: document.getElementById('workspaceUploadBtn'),
    fileTree: document.getElementById('fileTree'),
    tabs: document.getElementById('tabs'),
    monacoEditor: document.getElementById('monacoEditor'),
    activeFilePath: document.getElementById('activeFilePath'),
    saveStatus: document.getElementById('saveStatus'),
    saveBtn: document.getElementById('saveBtn'),
    refreshTreeBtn: document.getElementById('refreshTreeBtn'),
    uploadInput: document.getElementById('uploadInput'),
    statusMessage: document.getElementById('statusMessage'),
    welcomeView: document.getElementById('welcomeView'),
    editorView: document.getElementById('editorView'),
};

function setStatus(message, type = 'info') {
    els.statusMessage.textContent = message;
    els.saveStatus.textContent = type === 'error' ? 'Error' : message;
}

function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function api(action, options = {}) {
    const method = options.method || 'GET';
    const params = options.params || {};
    const body = options.body || null;
    const formData = options.formData || null;
    const url = new URL('api.php', window.location.href);
    url.searchParams.set('action', action);

    if (method === 'GET') {
        Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    }

    const fetchOptions = { method };

    if (formData) {
        fetchOptions.body = formData;
    } else if (body) {
        const encoded = new URLSearchParams({ action, ...body });
        fetchOptions.body = encoded;
        fetchOptions.headers = {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        };
    }

    const response = await fetch(method === 'GET' ? url : 'api.php', fetchOptions);
    const data = await response.json();
    if (!response.ok || !data.ok) {
        throw new Error(data.message || 'Request failed.');
    }
    return data;
}

function populateRoots() {
    els.rootSelect.innerHTML = state.roots
        .map((root) => `<option value="${escapeHtml(root)}">${escapeHtml(root)}</option>`)
        .join('');

    if (!state.currentRoot && state.roots.length) {
        state.currentRoot = state.roots[0];
        els.rootSelect.value = state.currentRoot;
    }
}

function getLanguageFromPath(path) {
    const extension = path.split('.').pop()?.toLowerCase() || '';
    const map = {
        php: 'php',
        js: 'javascript',
        mjs: 'javascript',
        cjs: 'javascript',
        ts: 'typescript',
        json: 'json',
        html: 'html',
        css: 'css',
        scss: 'scss',
        md: 'markdown',
        xml: 'xml',
        yml: 'yaml',
        yaml: 'yaml',
        sql: 'sql',
        py: 'python',
        java: 'java',
        cpp: 'cpp',
        c: 'c',
        cs: 'csharp',
        sh: 'shell',
        txt: 'plaintext',
    };
    return map[extension] || 'plaintext';
}

function buildModelUri(path) {
    const normalized = path.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1');
    return window.monaco.Uri.parse(`file://${normalized}`);
}

function ensureMonaco() {
    return new Promise((resolve, reject) => {
        if (window.monaco?.editor) {
            resolve();
            return;
        }
        if (typeof window.require !== 'function') {
            reject(new Error('Monaco loader is not available.'));
            return;
        }
        window.require.config({
            paths: {
                vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs',
            },
        });
        window.require(['vs/editor/editor.main'], () => resolve(), reject);
    });
}

async function initEditor() {
    await ensureMonaco();
    if (state.editor) {
        return;
    }

    state.editor = window.monaco.editor.create(els.monacoEditor, {
        value: '',
        language: 'plaintext',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: true },
        fontSize: 14,
        fontFamily: 'Consolas, Monaco, monospace',
        tabSize: 4,
        insertSpaces: true,
        wordWrap: 'off',
        smoothScrolling: true,
        scrollBeyondLastLine: false,
        renderWhitespace: 'selection',
    });

    state.editor.onDidChangeModelContent(() => {
        if (state.suppressModelChange) {
            return;
        }
        const tab = getActiveTab();
        if (!tab || !state.editor) {
            return;
        }
        tab.content = state.editor.getValue();
        tab.dirty = true;
        renderTabs();
        els.saveStatus.textContent = 'Unsaved changes';
    });

    window.addEventListener('resize', () => {
        state.editor?.layout();
    });
}

function getActiveTab() {
    return state.openTabs.find((tab) => tab.path === state.activePath) || null;
}

function getBasename(path) {
    return path.split(/[/\\]/).pop() || path;
}

function getDisplayRootName(path) {
    return path ? getBasename(path) : 'No folder selected';
}

function openFolderDialog() {
    els.folderDialog.classList.remove('hidden');
    els.fileMenu.classList.add('hidden');
    els.rootSelect.value = state.currentRoot || state.roots[0] || '';
    els.customRootInput.value = state.currentRoot || els.rootSelect.value || '';
}

function closeFolderDialog() {
    els.folderDialog.classList.add('hidden');
}

function updateWorkspaceHeader() {
    els.currentRootLabel.textContent = getDisplayRootName(state.currentRoot);
    els.currentRootLabel.title = state.currentRoot || 'No folder selected';
    els.workspaceCollapseBtn.innerHTML = state.workspaceCollapsed
        ? '<i class="fa-solid fa-chevron-right"></i>'
        : '<i class="fa-solid fa-chevron-down"></i>';
}

function renderTabs() {
    els.tabs.innerHTML = state.openTabs.map((tab) => `
        <div class="tab ${tab.path === state.activePath ? 'active' : ''} ${tab.dirty ? 'is-dirty' : ''}" data-path="${escapeHtml(tab.path)}">
            <span class="tab-name">${escapeHtml(tab.name)}</span>
            <button class="tab-close" data-close="${escapeHtml(tab.path)}">×</button>
        </div>
    `).join('');
}

function renderEditor() {
    const tab = getActiveTab();
    if (!tab) {
        els.welcomeView.classList.remove('hidden');
        els.editorView.classList.add('hidden');
        els.activeFilePath.textContent = 'No file selected';
        if (state.editor) {
            state.suppressModelChange = true;
            state.editor.setModel(null);
            state.suppressModelChange = false;
        }
        return;
    }

    els.welcomeView.classList.add('hidden');
    els.editorView.classList.remove('hidden');
    els.activeFilePath.textContent = tab.path;
    if (state.editor && tab.model) {
        state.suppressModelChange = true;
        state.editor.setModel(tab.model);
        state.suppressModelChange = false;
        state.editor.focus();
        state.editor.layout();
    }
    els.saveStatus.textContent = tab.dirty ? 'Unsaved changes' : 'Saved';
}

function renderTree() {
    updateWorkspaceHeader();

    if (!state.currentRoot || state.workspaceCollapsed) {
        els.fileTree.innerHTML = '';
        return;
    }

    const renderNode = (node) => {
        const isDir = node.type === 'directory';
        const expanded = isDir && state.expandedDirs.has(node.path);
        return `
            <div class="tree-node">
                <div class="tree-row ${node.path === state.activePath ? 'active' : ''}" data-path="${escapeHtml(node.path)}" data-type="${node.type}">
                    <span class="tree-toggle">${isDir ? (expanded ? '<i class="fa-solid fa-chevron-down"></i>' : '<i class="fa-solid fa-chevron-right"></i>') : ''}</span>
                    <span class="tree-icon">${isDir ? '<i class="fa-regular fa-folder"></i>' : '<i class="fa-regular fa-file-code"></i>'}</span>
                    <span class="tree-name">${escapeHtml(node.name)}</span>
                    <span class="tree-actions">
                        ${isDir ? `<button data-action="create-file" data-path="${escapeHtml(node.path)}" title="New File"><i class="fa-regular fa-file"></i></button>
                        <button data-action="create-folder" data-path="${escapeHtml(node.path)}" title="New Folder"><i class="fa-regular fa-folder"></i></button>
                        <button data-action="upload" data-path="${escapeHtml(node.path)}" title="Upload"><i class="fa-solid fa-arrow-up-from-bracket"></i></button>` : ''}
                        <button data-action="rename" data-path="${escapeHtml(node.path)}" title="Rename"><i class="fa-regular fa-pen-to-square"></i></button>
                        <button data-action="move" data-path="${escapeHtml(node.path)}" title="Move"><i class="fa-solid fa-right-left"></i></button>
                        <button data-action="delete" data-path="${escapeHtml(node.path)}" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
                    </span>
                </div>
                ${isDir && expanded ? `<div class="tree-children">${node.children.map(renderNode).join('')}</div>` : ''}
            </div>
        `;
    };

    els.fileTree.innerHTML = state.tree.map(renderNode).join('');
}

async function loadTree() {
    if (!state.currentRoot) {
        return;
    }
    const data = await api('tree', {
        method: 'GET',
        params: { root: state.currentRoot },
    });
    state.currentRoot = data.root;
    if (!state.expandedDirs.has(state.currentRoot)) {
        state.expandedDirs.add(state.currentRoot);
    }
    state.tree = data.tree;
    els.rootSelect.value = state.currentRoot;
    els.customRootInput.value = state.currentRoot;
    renderTree();
    setStatus('Folder loaded');
}

async function openFile(path) {
    const existing = state.openTabs.find((tab) => tab.path === path);
    if (existing) {
        state.activePath = path;
        renderTabs();
        renderEditor();
        return;
    }

    const data = await api('read', {
        method: 'GET',
        params: { path },
    });

    state.openTabs.push({
        path: data.path,
        name: data.path.split(/[/\\]/).pop(),
        content: data.content,
        dirty: false,
        model: window.monaco.editor.createModel(
            data.content,
            getLanguageFromPath(data.path),
            buildModelUri(data.path)
        ),
    });
    state.activePath = data.path;
    renderTabs();
    renderEditor();
    renderTree();
    setStatus('File opened');
}

function closeTab(path) {
    const index = state.openTabs.findIndex((tab) => tab.path === path);
    if (index === -1) {
        return;
    }
    const tab = state.openTabs[index];
    tab.model?.dispose();
    state.openTabs.splice(index, 1);
    if (state.activePath === path) {
        state.activePath = state.openTabs[index]?.path || state.openTabs[index - 1]?.path || '';
    }
    renderTabs();
    renderEditor();
    renderTree();
}

async function saveActiveFile() {
    const tab = getActiveTab();
    if (!tab) {
        setStatus('No active file to save');
        return;
    }
    const content = state.editor ? state.editor.getValue() : tab.content;
    await api('save', {
        method: 'POST',
        body: { path: tab.path, content },
    });
    tab.content = content;
    tab.dirty = false;
    renderTabs();
    renderEditor();
    setStatus('File saved');
}

async function createItem(type) {
    return createItemInDirectory(state.currentRoot, type);
}

async function createItemInDirectory(baseDir, type) {
    if (!state.currentRoot) {
        setStatus('Open a folder first', 'error');
        return;
    }
    const name = prompt(`Enter ${type} name`);
    if (!name) {
        return;
    }
    const fullPath = `${baseDir.replace(/[\\/]+$/, '')}/${name}`;
    await api(type === 'file' ? 'create-file' : 'create-folder', {
        method: 'POST',
        body: { path: fullPath },
    });
    await loadTree();
    setStatus(`${type === 'file' ? 'File' : 'Folder'} created`);
}

async function renameItem(path) {
    const currentName = path.split(/[/\\]/).pop();
    const newName = prompt('New name', currentName);
    if (!newName || newName === currentName) {
        return;
    }
    const data = await api('rename', {
        method: 'POST',
        body: { path, newName },
    });
    const tab = state.openTabs.find((item) => item.path === path);
    if (tab) {
        tab.path = data.path;
        tab.name = data.path.split(/[/\\]/).pop();
        const value = tab.model ? tab.model.getValue() : tab.content;
        tab.model?.dispose();
        tab.model = window.monaco.editor.createModel(
            value,
            getLanguageFromPath(data.path),
            buildModelUri(data.path)
        );
        if (state.activePath === path) {
            state.activePath = data.path;
        }
    }
    await loadTree();
    renderTabs();
    renderEditor();
    setStatus('Renamed successfully');
}

async function moveItem(path) {
    const destinationDir = prompt('Move to folder', state.currentRoot);
    if (!destinationDir) {
        return;
    }
    const data = await api('move', {
        method: 'POST',
        body: { path, destinationDir },
    });
    const tab = state.openTabs.find((item) => item.path === path);
    if (tab) {
        tab.path = data.path;
        tab.name = data.path.split(/[/\\]/).pop();
        const value = tab.model ? tab.model.getValue() : tab.content;
        tab.model?.dispose();
        tab.model = window.monaco.editor.createModel(
            value,
            getLanguageFromPath(data.path),
            buildModelUri(data.path)
        );
        if (state.activePath === path) {
            state.activePath = data.path;
        }
    }
    await loadTree();
    renderTabs();
    renderEditor();
    setStatus('Moved successfully');
}

async function deleteItem(path) {
    if (!confirm(`Delete this item?\n${path}`)) {
        return;
    }
    await api('delete', {
        method: 'POST',
        body: { path },
    });
    closeTab(path);
    await loadTree();
    setStatus('Deleted successfully');
}

async function uploadFiles(files, destinationDir = state.currentRoot) {
    if (!files.length || !state.currentRoot) {
        return;
    }
    const formData = new FormData();
    formData.append('action', 'upload');
    formData.append('destinationDir', destinationDir);
    Array.from(files).forEach((file) => formData.append('files[]', file));
    await api('upload', {
        method: 'POST',
        formData,
    });
    els.uploadInput.value = '';
    await loadTree();
    setStatus('Upload complete');
}

function setRoot(root) {
    if (!root) {
        return;
    }
    state.currentRoot = root;
    state.expandedDirs.add(root);
    closeFolderDialog();
    loadTree().catch(handleError);
}

function handleError(error) {
    console.error(error);
    setStatus(error.message || 'Something went wrong', 'error');
}

document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveActiveFile().catch(handleError);
    }
    if (event.key === 'Escape') {
        els.fileMenu.classList.add('hidden');
        closeFolderDialog();
    }
});

document.addEventListener('click', (event) => {
    if (!event.target.closest('#fileMenuBtn') && !event.target.closest('#fileMenu')) {
        els.fileMenu.classList.add('hidden');
    }
    if (event.target === els.folderDialog) {
        closeFolderDialog();
    }
});

els.fileMenuBtn.addEventListener('click', () => {
    els.fileMenu.classList.toggle('hidden');
});
els.openFolderMenuItem.addEventListener('click', openFolderDialog);
els.closeFolderDialogBtn.addEventListener('click', closeFolderDialog);
els.cancelFolderDialogBtn.addEventListener('click', closeFolderDialog);
els.rootSelect.addEventListener('change', () => {
    if (!els.customRootInput.value || state.roots.includes(els.customRootInput.value)) {
        els.customRootInput.value = els.rootSelect.value;
    }
});
els.openRootBtn.addEventListener('click', () => setRoot(els.customRootInput.value.trim() || els.rootSelect.value));
els.refreshTreeBtn.addEventListener('click', () => loadTree().catch(handleError));
els.workspaceCollapseBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    state.workspaceCollapsed = !state.workspaceCollapsed;
    renderTree();
});
els.workspaceRootBar.addEventListener('click', () => {
    if (!state.currentRoot) {
        openFolderDialog();
        return;
    }
    state.workspaceCollapsed = !state.workspaceCollapsed;
    renderTree();
});
els.workspaceNewFileBtn.addEventListener('click', () => createItem('file').catch(handleError));
els.workspaceNewFolderBtn.addEventListener('click', () => createItem('folder').catch(handleError));
els.workspaceUploadBtn.addEventListener('click', () => {
    els.uploadInput.dataset.destinationDir = state.currentRoot;
    els.uploadInput.click();
});
els.uploadInput.addEventListener('change', (event) => {
    const destinationDir = els.uploadInput.dataset.destinationDir || state.currentRoot;
    uploadFiles(event.target.files, destinationDir).catch(handleError);
    delete els.uploadInput.dataset.destinationDir;
});
els.saveBtn.addEventListener('click', () => saveActiveFile().catch(handleError));

els.tabs.addEventListener('click', (event) => {
    const closePath = event.target.getAttribute('data-close');
    if (closePath) {
        closeTab(closePath);
        return;
    }
    const tab = event.target.closest('.tab');
    if (!tab) {
        return;
    }
    state.activePath = tab.getAttribute('data-path');
    renderTabs();
    renderEditor();
    renderTree();
});

els.fileTree.addEventListener('click', (event) => {
    const actionBtn = event.target.closest('[data-action]');
    if (actionBtn) {
        const action = actionBtn.getAttribute('data-action');
        const path = actionBtn.getAttribute('data-path');
        event.stopPropagation();
        if (action === 'create-file') {
            createItemInDirectory(path, 'file').catch(handleError);
        }
        if (action === 'create-folder') {
            createItemInDirectory(path, 'folder').catch(handleError);
        }
        if (action === 'upload') {
            els.uploadInput.dataset.destinationDir = path;
            els.uploadInput.click();
        }
        if (action === 'rename') {
            renameItem(path).catch(handleError);
        }
        if (action === 'move') {
            moveItem(path).catch(handleError);
        }
        if (action === 'delete') {
            deleteItem(path).catch(handleError);
        }
        return;
    }

    const row = event.target.closest('.tree-row');
    if (!row) {
        return;
    }
    const path = row.getAttribute('data-path');
    const type = row.getAttribute('data-type');
    if (type === 'directory') {
        if (state.expandedDirs.has(path)) {
            state.expandedDirs.delete(path);
        } else {
            state.expandedDirs.add(path);
        }
        renderTree();
        return;
    }
    openFile(path).catch(handleError);
});

populateRoots();
updateWorkspaceHeader();
initEditor()
    .then(() => {
        renderTabs();
        renderEditor();
        if (state.currentRoot) {
            loadTree().catch(handleError);
        }
    })
    .catch(handleError);

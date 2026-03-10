<?php
$defaultRoots = [];
$projectRoot = realpath(__DIR__);
if ($projectRoot !== false) {
    $defaultRoots[] = $projectRoot;
}
$htdocsRoot = realpath(dirname(__DIR__));
if ($htdocsRoot !== false && !in_array($htdocsRoot, $defaultRoots, true)) {
    $defaultRoots[] = $htdocsRoot;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Server Code Editor</title>
    <link rel="icon" type="image/png" href="./assets/favicon.png">
    <link rel="stylesheet" href="assets/styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css">
</head>
<body>
    <header class="menu-bar">
        <div class="menu-left">
            <button class="menu-icon-btn" aria-label="Explorer">
                <i class="fa-solid fa-bars"></i>
            </button>
            <nav class="menu-nav">
                <button class="menu-item" id="fileMenuBtn">File</button>
            </nav>
        </div>
        <div class="menu-center">
            <div class="titlebar-search"><span>Espace de travail</span></div>
        </div>
    </header>

    <div id="fileMenu" class="menu-dropdown hidden">
        <button class="menu-dropdown-item" id="openFolderMenuItem">
            <i class="fa-regular fa-folder-open"></i>
            <span>Open Folder from Server...</span>
        </button>
    </div>

    <div class="app-shell">
        <aside class="activity-bar">
            <button class="activity-btn active"><i class="fa-regular fa-file"></i></button>
        </aside>

        <aside class="sidebar">
            <div class="sidebar-header">
                <div>
                    <h1>EXPLORATEUR</h1>
                </div>
            </div>

            <div class="explorer-section">
                <div class="explorer-section-title">ESPACE DE TRAVAIL</div>
                <div id="workspaceRootBar" class="workspace-root-bar">
                    <button id="workspaceCollapseBtn" class="workspace-caret"><i class="fa-solid fa-chevron-down"></i></button>
                    <span id="currentRootLabel" class="workspace-root-name">No folder selected</span>
                    <div class="workspace-root-actions">
                        <button id="workspaceNewFileBtn" title="New File"><i class="fa-regular fa-file"></i></button>
                        <button id="workspaceNewFolderBtn" title="New Folder"><i class="fa-regular fa-folder"></i></button>
                        <button id="workspaceUploadBtn" title="Upload Files"><i class="fa-solid fa-arrow-up-from-bracket"></i></button>
                        <button id="refreshTreeBtn" title="Refresh"><i class="fa-solid fa-rotate-right"></i></button>
                    </div>
                </div>
                <div id="fileTree" class="file-tree"></div>
            </div>
            <input id="uploadInput" type="file" hidden multiple>
        </aside>

        <main class="main-panel">
            <div id="tabs" class="tabs"></div>

            <section class="editor-area">
                <div id="welcomeView" class="welcome-view">
                    <h2>Server Code Editor</h2>
                    <p>Open a folder from the File menu, then browse, edit, upload, rename, move, or delete files.</p>
                </div>
                <div id="editorView" class="editor-view hidden">
                    <div class="editor-meta">
                        <span id="activeFilePath">No file selected</span>
                        <div class="editor-meta-actions">
                            <span id="saveStatus">Ready</span>
                            <button id="saveBtn" class="save-btn"><i class="fa-regular fa-floppy-disk"></i><span>Save</span></button>
                        </div>
                    </div>
                    <div id="monacoEditor" class="monaco-editor-host"></div>
                </div>
            </section>

            <footer class="statusbar">
                <span id="statusMessage">Ready</span>
                <span>PHP / JavaScript Online Editor</span>
            </footer>
        </main>
    </div>

    <div id="folderDialog" class="dialog-backdrop hidden">
        <div class="dialog-panel">
            <div class="dialog-header">
                <h2>Open Folder from Server</h2>
                <button id="closeFolderDialogBtn" class="dialog-close-btn"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="dialog-body">
                <label for="rootSelect">Allowed root</label>
                <select id="rootSelect"></select>
                <label for="customRootInput">Folder path</label>
                <input id="customRootInput" type="text" placeholder="Choose a root or enter a folder path inside it">
                <p class="dialog-hint">Allowed roots: current project folder and its parent web root.</p>
            </div>
            <div class="dialog-footer">
                <button id="cancelFolderDialogBtn" class="dialog-btn secondary">Cancel</button>
                <button id="openRootBtn" class="dialog-btn primary">Open Folder</button>
            </div>
        </div>
    </div>

    <script>
        window.APP_CONFIG = {
            roots: <?php echo json_encode(array_values($defaultRoots), JSON_UNESCAPED_SLASHES); ?>
        };
    </script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs/loader.min.js"></script>
    <script src="assets/app.js"></script>
</body>
</html>

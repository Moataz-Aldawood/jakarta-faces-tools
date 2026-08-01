"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const JsfDefinitionProvider_1 = require("./providers/JsfDefinitionProvider");
const JsfCompletionProvider_1 = require("./providers/JsfCompletionProvider");
const JsfHoverProvider_1 = require("./providers/JsfHoverProvider");
const JsfDiagnostics_1 = require("./providers/JsfDiagnostics");
const JsfELHighlighter_1 = require("./providers/JsfELHighlighter");
const JsfElCompletionProvider_1 = require("./providers/JsfElCompletionProvider");
const JsfIdHighlightProvider_1 = require("./providers/JsfIdHighlightProvider");
function activate(context) {
    console.log('Congratulations, your extension "jakarta-ee-tools" is now active!');
    const jsfDefinitionProvider = new JsfDefinitionProvider_1.JsfDefinitionProvider();
    const jsfCompletionProvider = new JsfCompletionProvider_1.JsfCompletionProvider();
    const jsfHoverProvider = new JsfHoverProvider_1.JsfHoverProvider();
    const jsfElCompletionProvider = new JsfElCompletionProvider_1.JsfElCompletionProvider();
    const jsfIdHighlightProvider = new JsfIdHighlightProvider_1.JsfIdHighlightProvider();
    const elHighlighter = new JsfELHighlighter_1.JsfELHighlighter();
    const documentSelector = [
        { language: 'jsf' }, { language: 'html' }, { language: 'xml' }
    ];
    const jsfDiagnostics = vscode.languages.createDiagnosticCollection('jsf');
    context.subscriptions.push(jsfDiagnostics);
    (0, JsfDiagnostics_1.subscribeToDocumentChanges)(context, jsfDiagnostics);
    const onCacheUpdated = () => {
        for (const editor of vscode.window.visibleTextEditors) {
            (0, JsfDiagnostics_1.refreshDiagnostics)(editor.document, jsfDiagnostics);
        }
    };
    // Status Bar Item UI for rebuilding JSF Cache (Beta Feature)
    let elStatusBarItem;
    const updateStatusBarVisibility = () => {
        const config = vscode.workspace.getConfiguration('jakartaFacesTools');
        const enabled = config.get('enableELAutocomplete', true);
        const showButton = config.get('showRebuildCacheButton', true);
        const positionStr = config.get('rebuildCacheButtonPosition', 'Right');
        const alignment = positionStr === 'Left' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right;
        // Dispose existing item if alignment changed
        if (elStatusBarItem && elStatusBarItem.alignment !== alignment) {
            elStatusBarItem.dispose();
            elStatusBarItem = undefined;
        }
        if (!elStatusBarItem) {
            elStatusBarItem = vscode.window.createStatusBarItem(alignment, 100);
            elStatusBarItem.text = '$(coffee) Rebuild JSF Cache';
            elStatusBarItem.tooltip = 'Jakarta Faces Tools [Beta Feature]: Click to rebuild the in-memory Expression Language (EL) Managed Bean cache. Useful if Java beans were added or modified outside of normal edits.';
            elStatusBarItem.command = 'jakartaFacesTools.rebuildJsfCache';
            context.subscriptions.push(elStatusBarItem);
        }
        if (enabled && showButton) {
            elStatusBarItem.show();
        }
        else {
            elStatusBarItem.hide();
        }
    };
    updateStatusBarVisibility();
    const rebuildCacheCommand = vscode.commands.registerCommand('jakartaFacesTools.rebuildJsfCache', async () => {
        (0, JsfElCompletionProvider_1.rebuildJsfCache)(false);
        await jsfElCompletionProvider.ensureBeansCached();
        onCacheUpdated();
        vscode.window.showInformationMessage('Jakarta Faces Tools: JSF Cache rebuilt successfully!');
    });
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(documentSelector, jsfDefinitionProvider), vscode.languages.registerCompletionItemProvider(documentSelector, jsfCompletionProvider, '<', ' ', ':', '"', "'"), vscode.languages.registerCompletionItemProvider(documentSelector, jsfElCompletionProvider, '.', '{', '"', "'", '#', '='), vscode.languages.registerHoverProvider(documentSelector, jsfHoverProvider), vscode.languages.registerDocumentHighlightProvider(documentSelector, jsfIdHighlightProvider), elHighlighter, rebuildCacheCommand);
    // Dynamic configuration listener for status bar visibility & cache cleanup
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('jakartaFacesTools')) {
            updateStatusBarVisibility();
            if (!vscode.workspace.getConfiguration('jakartaFacesTools').get('enableELAutocomplete', true)) {
                (0, JsfElCompletionProvider_1.rebuildJsfCache)(false);
                onCacheUpdated();
            }
        }
    }));
    // Incremental Bean Caching via File Watchers (create, change, delete .java files)
    (0, JsfElCompletionProvider_1.startJavaFileWatcher)(context, onCacheUpdated);
    // Also update cache incrementally when .java files are saved in the editor
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async (doc) => {
        if (!vscode.workspace.getConfiguration('jakartaFacesTools').get('enableIncrementalCache', true)) {
            return;
        }
        if (doc.uri.fsPath.endsWith('.java')) {
            await (0, JsfElCompletionProvider_1.updateJavaBeanInCache)(doc.uri);
            onCacheUpdated();
        }
    }));
}
function deactivate() {
    (0, JsfElCompletionProvider_1.rebuildJsfCache)(false);
}
//# sourceMappingURL=extension.js.map
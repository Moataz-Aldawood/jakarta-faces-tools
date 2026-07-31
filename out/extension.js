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
function activate(context) {
    console.log('Congratulations, your extension "jakarta-ee-tools" is now active!');
    const jsfDefinitionProvider = new JsfDefinitionProvider_1.JsfDefinitionProvider();
    const jsfCompletionProvider = new JsfCompletionProvider_1.JsfCompletionProvider();
    const jsfHoverProvider = new JsfHoverProvider_1.JsfHoverProvider();
    const jsfElCompletionProvider = new JsfElCompletionProvider_1.JsfElCompletionProvider();
    const elHighlighter = new JsfELHighlighter_1.JsfELHighlighter();
    const documentSelector = [
        { language: 'jsf' }, { language: 'html' }, { language: 'xml' }
    ];
    // Status Bar Item UI for rebuilding JSF Cache (Beta Feature)
    let elStatusBarItem;
    const updateStatusBarVisibility = () => {
        const config = vscode.workspace.getConfiguration('jakartaFacesTools');
        const enabled = config.get('enableExpressionLanguageAutocomplete', false);
        const showButton = config.get('showRebuildCacheButton', true);
        const positionStr = config.get('rebuildCacheButtonPosition', 'Left');
        const alignment = positionStr === 'Right' ? vscode.StatusBarAlignment.Right : vscode.StatusBarAlignment.Left;
        // Dispose existing item if alignment changed
        if (elStatusBarItem && elStatusBarItem.alignment !== alignment) {
            elStatusBarItem.dispose();
            elStatusBarItem = undefined;
        }
        if (!elStatusBarItem) {
            elStatusBarItem = vscode.window.createStatusBarItem(alignment, 100);
            elStatusBarItem.text = '$(coffee) Rebuild JSF Cache';
            elStatusBarItem.tooltip = 'Jakarta Faces Tools (Beta Feature): Click to rebuild the in-memory Jakarta Faces / JSF Managed Bean cache';
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
    const rebuildCacheCommand = vscode.commands.registerCommand('jakartaFacesTools.rebuildJsfCache', () => {
        (0, JsfElCompletionProvider_1.rebuildJsfCache)(true);
    });
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(documentSelector, jsfDefinitionProvider), vscode.languages.registerCompletionItemProvider(documentSelector, jsfCompletionProvider, '<', ' ', ':'), vscode.languages.registerCompletionItemProvider(documentSelector, jsfElCompletionProvider, '.', '{'), vscode.languages.registerHoverProvider(documentSelector, jsfHoverProvider), elHighlighter, rebuildCacheCommand);
    // Dynamic configuration listener for status bar visibility & cache cleanup
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('jakartaFacesTools.enableExpressionLanguageAutocomplete') ||
            e.affectsConfiguration('jakartaFacesTools.showRebuildCacheButton') ||
            e.affectsConfiguration('jakartaFacesTools.rebuildCacheButtonPosition')) {
            updateStatusBarVisibility();
            if (!vscode.workspace.getConfiguration('jakartaFacesTools').get('enableExpressionLanguageAutocomplete', false)) {
                (0, JsfElCompletionProvider_1.rebuildJsfCache)(false);
            }
        }
    }));
    // Auto-invalidate EL cache when Java files are saved
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
        if (doc.uri.fsPath.endsWith('.java')) {
            (0, JsfElCompletionProvider_1.rebuildJsfCache)(false);
        }
    }));
    const jsfDiagnostics = vscode.languages.createDiagnosticCollection('jsf');
    context.subscriptions.push(jsfDiagnostics);
    (0, JsfDiagnostics_1.subscribeToDocumentChanges)(context, jsfDiagnostics);
}
function deactivate() {
    (0, JsfElCompletionProvider_1.rebuildJsfCache)(false);
}
//# sourceMappingURL=extension.js.map
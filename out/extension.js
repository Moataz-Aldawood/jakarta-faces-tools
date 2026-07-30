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
    // Status Bar Item UI for clearing EL Cache (Beta Feature)
    const elStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    elStatusBarItem.text = '$(trash) Clear EL Cache';
    elStatusBarItem.tooltip = 'Jakarta Faces Tools (Beta Feature): Click to clear EL Auto-Complete in-memory cache';
    elStatusBarItem.command = 'jakartaFacesTools.clearElCache';
    context.subscriptions.push(elStatusBarItem);
    const updateStatusBarVisibility = () => {
        const config = vscode.workspace.getConfiguration('jakartaFacesTools.elAutocomplete');
        const enabled = config.get('enable', false);
        const showButton = config.get('showStatusBarButton', true);
        if (enabled && showButton) {
            elStatusBarItem.show();
        }
        else {
            elStatusBarItem.hide();
        }
    };
    updateStatusBarVisibility();
    const clearCacheCommand = vscode.commands.registerCommand('jakartaFacesTools.clearElCache', () => {
        (0, JsfElCompletionProvider_1.clearElCache)(true);
    });
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(documentSelector, jsfDefinitionProvider), vscode.languages.registerCompletionItemProvider(documentSelector, jsfCompletionProvider, '<', ' ', ':'), vscode.languages.registerCompletionItemProvider(documentSelector, jsfElCompletionProvider, '.', '{'), vscode.languages.registerHoverProvider(documentSelector, jsfHoverProvider), elHighlighter, clearCacheCommand);
    // Dynamic configuration listener for status bar visibility & cache cleanup
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('jakartaFacesTools.elAutocomplete')) {
            updateStatusBarVisibility();
            if (!vscode.workspace.getConfiguration('jakartaFacesTools.elAutocomplete').get('enable', false)) {
                (0, JsfElCompletionProvider_1.clearElCache)(false);
            }
        }
    }));
    // Auto-invalidate EL cache when Java files are saved
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
        if (doc.uri.fsPath.endsWith('.java')) {
            (0, JsfElCompletionProvider_1.clearElCache)(false);
        }
    }));
    const jsfDiagnostics = vscode.languages.createDiagnosticCollection('jsf');
    context.subscriptions.push(jsfDiagnostics);
    (0, JsfDiagnostics_1.subscribeToDocumentChanges)(context, jsfDiagnostics);
}
function deactivate() {
    (0, JsfElCompletionProvider_1.clearElCache)(false);
}
//# sourceMappingURL=extension.js.map
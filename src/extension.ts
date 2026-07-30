import * as vscode from 'vscode';
import { JsfDefinitionProvider } from './providers/JsfDefinitionProvider';
import { JsfCompletionProvider } from './providers/JsfCompletionProvider';
import { JsfHoverProvider } from './providers/JsfHoverProvider';
import { subscribeToDocumentChanges } from './providers/JsfDiagnostics';
import { JsfELHighlighter } from './providers/JsfELHighlighter';
import { JsfElCompletionProvider, clearElCache } from './providers/JsfElCompletionProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "jakarta-ee-tools" is now active!');

    const jsfDefinitionProvider = new JsfDefinitionProvider();
    const jsfCompletionProvider = new JsfCompletionProvider();
    const jsfHoverProvider = new JsfHoverProvider();
    const jsfElCompletionProvider = new JsfElCompletionProvider();
    const elHighlighter = new JsfELHighlighter();
    
    const documentSelector: vscode.DocumentSelector = [
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
        const enabled = config.get<boolean>('enable', false);
        const showButton = config.get<boolean>('showStatusBarButton', true);
        if (enabled && showButton) {
            elStatusBarItem.show();
        } else {
            elStatusBarItem.hide();
        }
    };

    updateStatusBarVisibility();

    const clearCacheCommand = vscode.commands.registerCommand('jakartaFacesTools.clearElCache', () => {
        clearElCache(true);
    });

    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(documentSelector, jsfDefinitionProvider),
        vscode.languages.registerCompletionItemProvider(documentSelector, jsfCompletionProvider, '<', ' ', ':'),
        vscode.languages.registerCompletionItemProvider(documentSelector, jsfElCompletionProvider, '.', '{'),
        vscode.languages.registerHoverProvider(documentSelector, jsfHoverProvider),
        elHighlighter,
        clearCacheCommand
    );

    // Dynamic configuration listener for status bar visibility & cache cleanup
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('jakartaFacesTools.elAutocomplete')) {
                updateStatusBarVisibility();
                if (!vscode.workspace.getConfiguration('jakartaFacesTools.elAutocomplete').get<boolean>('enable', false)) {
                    clearElCache(false);
                }
            }
        })
    );

    // Auto-invalidate EL cache when Java files are saved
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (doc.uri.fsPath.endsWith('.java')) {
                clearElCache(false);
            }
        })
    );

    const jsfDiagnostics = vscode.languages.createDiagnosticCollection('jsf');
    context.subscriptions.push(jsfDiagnostics);
    subscribeToDocumentChanges(context, jsfDiagnostics);
}

export function deactivate() {
    clearElCache(false);
}


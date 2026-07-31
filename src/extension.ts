import * as vscode from 'vscode';
import { JsfDefinitionProvider } from './providers/JsfDefinitionProvider';
import { JsfCompletionProvider } from './providers/JsfCompletionProvider';
import { JsfHoverProvider } from './providers/JsfHoverProvider';
import { subscribeToDocumentChanges } from './providers/JsfDiagnostics';
import { JsfELHighlighter } from './providers/JsfELHighlighter';
import { JsfElCompletionProvider, rebuildJsfCache } from './providers/JsfElCompletionProvider';

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

    // Status Bar Item UI for rebuilding JSF Cache (Beta Feature)
    let elStatusBarItem: vscode.StatusBarItem | undefined;

    const updateStatusBarVisibility = () => {
        const config = vscode.workspace.getConfiguration('jakartaFacesTools.betaFeature');
        const enabled = config.get<boolean>('enableElAutocomplete', false);
        const showButton = config.get<boolean>('showRebuildCacheButton', true);
        const positionStr = config.get<string>('rebuildCacheButtonPosition', 'Left');
        const alignment = positionStr === 'Right' ? vscode.StatusBarAlignment.Right : vscode.StatusBarAlignment.Left;

        // Dispose existing item if alignment changed
        if (elStatusBarItem && elStatusBarItem.alignment !== alignment) {
            elStatusBarItem.dispose();
            elStatusBarItem = undefined;
        }

        if (!elStatusBarItem) {
            elStatusBarItem = vscode.window.createStatusBarItem(alignment, 100);
            elStatusBarItem.text = '$(flame) Rebuild JSF Cache';
            elStatusBarItem.tooltip = 'Jakarta Faces Tools (Beta Feature): Click to rebuild the in-memory Jakarta Faces / JSF Managed Bean cache';
            elStatusBarItem.command = 'jakartaFacesTools.rebuildJsfCache';
            context.subscriptions.push(elStatusBarItem);
        }

        if (enabled && showButton) {
            elStatusBarItem.show();
        } else {
            elStatusBarItem.hide();
        }
    };

    updateStatusBarVisibility();

    const rebuildCacheCommand = vscode.commands.registerCommand('jakartaFacesTools.rebuildJsfCache', () => {
        rebuildJsfCache(true);
    });

    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(documentSelector, jsfDefinitionProvider),
        vscode.languages.registerCompletionItemProvider(documentSelector, jsfCompletionProvider, '<', ' ', ':'),
        vscode.languages.registerCompletionItemProvider(documentSelector, jsfElCompletionProvider, '.', '{'),
        vscode.languages.registerHoverProvider(documentSelector, jsfHoverProvider),
        elHighlighter,
        rebuildCacheCommand
    );

    // Dynamic configuration listener for status bar visibility & cache cleanup
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('jakartaFacesTools.betaFeature')) {
                updateStatusBarVisibility();
                if (!vscode.workspace.getConfiguration('jakartaFacesTools.betaFeature').get<boolean>('enableElAutocomplete', false)) {
                    rebuildJsfCache(false);
                }
            }
        })
    );

    // Auto-invalidate EL cache when Java files are saved
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (doc.uri.fsPath.endsWith('.java')) {
                rebuildJsfCache(false);
            }
        })
    );

    const jsfDiagnostics = vscode.languages.createDiagnosticCollection('jsf');
    context.subscriptions.push(jsfDiagnostics);
    subscribeToDocumentChanges(context, jsfDiagnostics);
}

export function deactivate() {
    rebuildJsfCache(false);
}


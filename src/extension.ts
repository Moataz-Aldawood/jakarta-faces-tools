import * as vscode from 'vscode';
import { JsfDefinitionProvider } from './providers/JsfDefinitionProvider';
import { JsfCompletionProvider } from './providers/JsfCompletionProvider';
import { JsfHoverProvider } from './providers/JsfHoverProvider';
import { refreshDiagnostics, subscribeToDocumentChanges } from './providers/JsfDiagnostics';
import { JsfELHighlighter } from './providers/JsfELHighlighter';
import { JsfElCompletionProvider, rebuildJsfCache, startJavaFileWatcher, updateJavaBeanInCache } from './providers/JsfElCompletionProvider';
import { JsfIdHighlightProvider } from './providers/JsfIdHighlightProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "jakarta-ee-tools" is now active!');

    const jsfDefinitionProvider = new JsfDefinitionProvider();
    const jsfCompletionProvider = new JsfCompletionProvider();
    const jsfHoverProvider = new JsfHoverProvider();
    const jsfElCompletionProvider = new JsfElCompletionProvider();
    const jsfIdHighlightProvider = new JsfIdHighlightProvider();
    const elHighlighter = new JsfELHighlighter();
    
    const documentSelector: vscode.DocumentSelector = [
        { language: 'jsf' }, { language: 'html' }, { language: 'xml' }
    ];

    // Status Bar Item UI for rebuilding JSF Cache (Beta Feature)
    let elStatusBarItem: vscode.StatusBarItem | undefined;

    const updateStatusBarVisibility = () => {
        const config = vscode.workspace.getConfiguration('jakartaFacesTools');
        const enabled = config.get<boolean>('enableELAutocomplete', false);
        const showButton = config.get<boolean>('showRebuildCacheButton', true);
        const positionStr = config.get<string>('rebuildCacheButtonPosition', 'Right');
        const alignment = positionStr === 'Right' ? vscode.StatusBarAlignment.Right : vscode.StatusBarAlignment.Left;

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
        vscode.languages.registerDocumentHighlightProvider(documentSelector, jsfIdHighlightProvider),
        elHighlighter,
        rebuildCacheCommand
    );

    // Dynamic configuration listener for status bar visibility & cache cleanup
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('jakartaFacesTools.enableELAutocomplete') ||
                e.affectsConfiguration('jakartaFacesTools.showRebuildCacheButton') ||
                e.affectsConfiguration('jakartaFacesTools.rebuildCacheButtonPosition')) {
                updateStatusBarVisibility();
                if (!vscode.workspace.getConfiguration('jakartaFacesTools').get<boolean>('enableELAutocomplete', false)) {
                    rebuildJsfCache(false);
                }
            }
        })
    );

    const jsfDiagnostics = vscode.languages.createDiagnosticCollection('jsf');
    context.subscriptions.push(jsfDiagnostics);
    subscribeToDocumentChanges(context, jsfDiagnostics);

    const onCacheUpdated = () => {
        for (const editor of vscode.window.visibleTextEditors) {
            refreshDiagnostics(editor.document, jsfDiagnostics);
        }
    };

    // Incremental Bean Caching via File Watchers (create, change, delete .java files)
    startJavaFileWatcher(context, onCacheUpdated);

    // Also update cache incrementally when .java files are saved in the editor
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async doc => {
            if (!vscode.workspace.getConfiguration('jakartaFacesTools').get<boolean>('enableIncrementalCache', true)) {
                return;
            }
            if (doc.uri.fsPath.endsWith('.java')) {
                await updateJavaBeanInCache(doc.uri);
                onCacheUpdated();
            }
        })
    );
}

export function deactivate() {
    rebuildJsfCache(false);
}


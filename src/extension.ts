import * as vscode from 'vscode';
import { JsfDefinitionProvider } from './providers/JsfDefinitionProvider';
import { JsfCompletionProvider } from './providers/JsfCompletionProvider';
import { JsfHoverProvider } from './providers/JsfHoverProvider';
import { refreshDiagnostics, subscribeToDocumentChanges, scanEntireWorkspace } from './providers/JsfDiagnostics';
import { JsfELHighlighter } from './providers/JsfELHighlighter';
import { JsfElCompletionProvider, rebuildJsfCache, startJavaFileWatcher, updateJavaBeanInCache } from './providers/JsfElCompletionProvider';
import { JsfIdHighlightProvider } from './providers/JsfIdHighlightProvider';
import { JsfInlayHintsProvider } from './providers/JsfInlayHintsProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "jakarta-ee-tools" is now active!');

    const jsfDefinitionProvider = new JsfDefinitionProvider();
    const jsfCompletionProvider = new JsfCompletionProvider();
    const jsfHoverProvider = new JsfHoverProvider();
    const jsfElCompletionProvider = new JsfElCompletionProvider();
    const jsfIdHighlightProvider = new JsfIdHighlightProvider();
    const jsfInlayHintsProvider = new JsfInlayHintsProvider(jsfElCompletionProvider);
    const elHighlighter = new JsfELHighlighter();
    
    const documentSelector: vscode.DocumentSelector = [
        { language: 'jsf' },
        { language: 'html' },
        { language: 'xml' },
        { language: 'xhtml' },
        { pattern: '**/*.xhtml' },
        { pattern: '**/*.jsf' }
    ];

    const jsfDiagnostics = vscode.languages.createDiagnosticCollection('jsf');
    context.subscriptions.push(jsfDiagnostics);
    subscribeToDocumentChanges(context, jsfDiagnostics);

    const onCacheUpdated = () => {
        for (const editor of vscode.window.visibleTextEditors) {
            refreshDiagnostics(editor.document, jsfDiagnostics);
        }
    };

    // Status Bar Item UI for rebuilding JSF Cache (Beta Feature)
    let elStatusBarItem: vscode.StatusBarItem | undefined;
    let scanStatusBarItem: vscode.StatusBarItem | undefined;

    const updateStatusBarVisibility = () => {
        const config = vscode.workspace.getConfiguration('jakartaFacesTools');
        const enabled = config.get<boolean>('enableELAutocomplete', true);
        const showButton = config.get<boolean>('showRebuildCacheButton', true);
        const positionStr = config.get<string>('rebuildCacheButtonPosition', 'Right');
        const alignment = positionStr === 'Left' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right;

        // Dispose existing item if alignment changed
        if (elStatusBarItem && elStatusBarItem.alignment !== alignment) {
            elStatusBarItem.dispose();
            elStatusBarItem = undefined;
        }
        if (scanStatusBarItem && scanStatusBarItem.alignment !== alignment) {
            scanStatusBarItem.dispose();
            scanStatusBarItem = undefined;
        }

        if (!elStatusBarItem) {
            elStatusBarItem = vscode.window.createStatusBarItem(alignment, 100);
            elStatusBarItem.text = '$(coffee) Rebuild JSF Cache';
            elStatusBarItem.tooltip = 'Jakarta Faces Tools [Beta Feature]: Click to rebuild the in-memory Expression Language (EL) Managed Bean cache. Useful if Java beans were added or modified outside of normal edits.';
            elStatusBarItem.command = 'jakartaFacesTools.rebuildJsfCache';
            context.subscriptions.push(elStatusBarItem);
        }

        if (!scanStatusBarItem) {
            scanStatusBarItem = vscode.window.createStatusBarItem(alignment, 99);
            scanStatusBarItem.text = '$(search-view-icon) Scan JSF Workspace';
            scanStatusBarItem.tooltip = 'Jakarta Faces Tools: Click to scan all JSF files in the workspace and populate the Problems panel.';
            scanStatusBarItem.command = 'jakartaFacesTools.scanWorkspace';
            context.subscriptions.push(scanStatusBarItem);
        }

        if (enabled && showButton) {
            elStatusBarItem.show();
        } else {
            elStatusBarItem.hide();
        }
        
        const showScanButton = config.get<boolean>('showScanWorkspaceButton', true);
        if (showScanButton) {
            scanStatusBarItem.show();
        } else {
            scanStatusBarItem.hide();
        }
    };

    updateStatusBarVisibility();

    const rebuildCacheCommand = vscode.commands.registerCommand('jakartaFacesTools.rebuildJsfCache', async () => {
        rebuildJsfCache(false);
        await jsfElCompletionProvider.ensureBeansCached();
        onCacheUpdated();
        vscode.window.showInformationMessage('Jakarta Faces Tools: JSF Cache rebuilt successfully!');
    });

    const scanWorkspaceCommand = vscode.commands.registerCommand('jakartaFacesTools.scanWorkspace', async () => {
        await scanEntireWorkspace(jsfDiagnostics);
        vscode.window.showInformationMessage('Jakarta Faces Tools: Workspace scan completed!');
    });

    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(documentSelector, jsfDefinitionProvider),
        vscode.languages.registerCompletionItemProvider(documentSelector, jsfCompletionProvider, '<', ' ', ':', '"', "'"),
        vscode.languages.registerCompletionItemProvider(documentSelector, jsfElCompletionProvider, '.', '{', '#'),
        vscode.languages.registerHoverProvider(documentSelector, jsfHoverProvider),
        vscode.languages.registerDocumentHighlightProvider(documentSelector, jsfIdHighlightProvider),
        vscode.languages.registerInlayHintsProvider(documentSelector, jsfInlayHintsProvider),
        elHighlighter,
        rebuildCacheCommand,
        scanWorkspaceCommand
    );

    // Dynamic configuration listener for status bar visibility & cache cleanup
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('jakartaFacesTools')) {
                updateStatusBarVisibility();
                if (!vscode.workspace.getConfiguration('jakartaFacesTools').get<boolean>('enableELAutocomplete', true)) {
                    rebuildJsfCache(false);
                    onCacheUpdated();
                }
            }
        })
    );

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

    // Eagerly initialize Java Managed Beans cache on startup so Inlay Hints, Hovers, and Diagnostics work immediately
    jsfElCompletionProvider.ensureBeansCached().then(() => {
        onCacheUpdated();
        
        if (vscode.workspace.getConfiguration('jakartaFacesTools').get<boolean>('validateEntireWorkspace', false)) {
            scanEntireWorkspace(jsfDiagnostics);
        }
    });
}

export function deactivate() {
    rebuildJsfCache(false);
}


import * as vscode from 'vscode';

export class JsfELHighlighter {
    private decorationType: vscode.TextEditorDecorationType | undefined;
    private subscriptions: vscode.Disposable[] = [];

    constructor() {
        this.updateDecorationType();
        this.registerListeners();
        this.triggerUpdateDecorations();
    }

    private getConfig<T>(key: string, defaultValue: T): T {
        const newConfig = vscode.workspace.getConfiguration('jakartaFacesTools.ELHighlighting');
        const oldConfig = vscode.workspace.getConfiguration('jakartaFacesTools.elHighlight');

        // Check if user explicitly set the new key
        const newInspect = newConfig.inspect<T>(key);
        if (newInspect && (newInspect.globalValue !== undefined || newInspect.workspaceValue !== undefined || newInspect.workspaceFolderValue !== undefined)) {
            return newConfig.get<T>(key, defaultValue);
        }

        // Check if user explicitly set the old key (backward compatibility for existing users)
        const oldInspect = oldConfig.inspect<T>(key);
        if (oldInspect && (oldInspect.globalValue !== undefined || oldInspect.workspaceValue !== undefined || oldInspect.workspaceFolderValue !== undefined)) {
            return oldConfig.get<T>(key, defaultValue);
        }

        return newConfig.get<T>(key, defaultValue);
    }

    private updateDecorationType() {
        if (this.decorationType) {
            this.decorationType.dispose();
        }

        const enable = this.getConfig<boolean>('enable', true);

        if (!enable) {
            this.decorationType = undefined;
            return;
        }

        const backgroundColor = this.getConfig<string>('backgroundColor', 'rgba(100, 150, 255, 0.15)');
        const color = this.getConfig<string>('color', '');
        const border = this.getConfig<string>('border', '1px solid rgba(100, 150, 255, 0.3)');
        const borderRadius = this.getConfig<string>('borderRadius', '3px');

        const decorationOptions: vscode.DecorationRenderOptions = {
            backgroundColor: backgroundColor || undefined,
            color: color || undefined,
            border: border || undefined,
            borderRadius: borderRadius || undefined,
        };

        this.decorationType = vscode.window.createTextEditorDecorationType(decorationOptions);
    }

    private registerListeners() {
        // Handle active editor changes
        this.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this.triggerUpdateDecorations(editor);
            }
        }));

        // Handle text changes
        this.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
            const editor = vscode.window.activeTextEditor;
            if (editor && event.document === editor.document) {
                this.triggerUpdateDecorations(editor);
            }
        }));

        // Handle configuration changes
        this.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('jakartaFacesTools.ELHighlighting') || event.affectsConfiguration('jakartaFacesTools.elHighlight')) {
                this.updateDecorationType();
                // Clear decorations from active editor if disabled
                if (!this.getConfig<boolean>('enable', true)) {
                    if (vscode.window.activeTextEditor && this.decorationType) {
                        vscode.window.activeTextEditor.setDecorations(this.decorationType, []);
                    }
                }
                this.triggerUpdateDecorations();
            }
        }));
    }

    private timeout: NodeJS.Timeout | undefined = undefined;

    private triggerUpdateDecorations(editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor) {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }
        this.timeout = setTimeout(() => this.updateDecorations(editor), 100);
    }

    private updateDecorations(editor: vscode.TextEditor | undefined) {
        if (!editor || !this.decorationType) {
            return;
        }

        const langId = editor.document.languageId;
        if (langId !== 'jsf' && langId !== 'html' && langId !== 'xml') {
            return;
        }

        const text = editor.document.getText();
        const elRegex = /#\{([^}]+)\}/g;
        const decorations: vscode.DecorationOptions[] = [];
        let match;

        while ((match = elRegex.exec(text))) {
            const startPos = editor.document.positionAt(match.index);
            const endPos = editor.document.positionAt(match.index + match[0].length);
            const decoration = { range: new vscode.Range(startPos, endPos) };
            decorations.push(decoration);
        }

        editor.setDecorations(this.decorationType, decorations);
    }

    public dispose() {
        if (this.decorationType) {
            this.decorationType.dispose();
        }
        this.subscriptions.forEach(d => d.dispose());
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
    }
}

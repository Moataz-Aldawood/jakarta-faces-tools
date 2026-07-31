"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsfELHighlighter = void 0;
const vscode = require("vscode");
class JsfELHighlighter {
    decorationType;
    subscriptions = [];
    constructor() {
        this.updateDecorationType();
        this.registerListeners();
        this.triggerUpdateDecorations();
    }
    getConfig(key, defaultValue) {
        const newConfig = vscode.workspace.getConfiguration('jakartaFacesTools.ELHighlighting');
        const oldConfig = vscode.workspace.getConfiguration('jakartaFacesTools.elHighlight');
        // Check if user explicitly set the new key
        const newInspect = newConfig.inspect(key);
        if (newInspect && (newInspect.globalValue !== undefined || newInspect.workspaceValue !== undefined || newInspect.workspaceFolderValue !== undefined)) {
            return newConfig.get(key, defaultValue);
        }
        // Check if user explicitly set the old key (backward compatibility for existing users)
        const oldInspect = oldConfig.inspect(key);
        if (oldInspect && (oldInspect.globalValue !== undefined || oldInspect.workspaceValue !== undefined || oldInspect.workspaceFolderValue !== undefined)) {
            return oldConfig.get(key, defaultValue);
        }
        return newConfig.get(key, defaultValue);
    }
    updateDecorationType() {
        if (this.decorationType) {
            this.decorationType.dispose();
        }
        const enable = this.getConfig('enable', true);
        if (!enable) {
            this.decorationType = undefined;
            return;
        }
        const backgroundColor = this.getConfig('backgroundColor', 'rgba(100, 150, 255, 0.15)');
        const color = this.getConfig('color', '');
        const border = this.getConfig('border', '1px solid rgba(100, 150, 255, 0.3)');
        const borderRadius = this.getConfig('borderRadius', '3px');
        const decorationOptions = {
            backgroundColor: backgroundColor || undefined,
            color: color || undefined,
            border: border || undefined,
            borderRadius: borderRadius || undefined,
        };
        this.decorationType = vscode.window.createTextEditorDecorationType(decorationOptions);
    }
    registerListeners() {
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
                if (!this.getConfig('enable', true)) {
                    if (vscode.window.activeTextEditor && this.decorationType) {
                        vscode.window.activeTextEditor.setDecorations(this.decorationType, []);
                    }
                }
                this.triggerUpdateDecorations();
            }
        }));
    }
    timeout = undefined;
    triggerUpdateDecorations(editor = vscode.window.activeTextEditor) {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }
        this.timeout = setTimeout(() => this.updateDecorations(editor), 100);
    }
    updateDecorations(editor) {
        if (!editor || !this.decorationType) {
            return;
        }
        const langId = editor.document.languageId;
        if (langId !== 'jsf' && langId !== 'html' && langId !== 'xml') {
            return;
        }
        const text = editor.document.getText();
        const elRegex = /#\{([^}]+)\}/g;
        const decorations = [];
        let match;
        while ((match = elRegex.exec(text))) {
            const startPos = editor.document.positionAt(match.index);
            const endPos = editor.document.positionAt(match.index + match[0].length);
            const decoration = { range: new vscode.Range(startPos, endPos) };
            decorations.push(decoration);
        }
        editor.setDecorations(this.decorationType, decorations);
    }
    dispose() {
        if (this.decorationType) {
            this.decorationType.dispose();
        }
        this.subscriptions.forEach(d => d.dispose());
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
    }
}
exports.JsfELHighlighter = JsfELHighlighter;
//# sourceMappingURL=JsfELHighlighter.js.map
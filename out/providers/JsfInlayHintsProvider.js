"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsfInlayHintsProvider = void 0;
const vscode = require("vscode");
const JsfElCompletionProvider_1 = require("./JsfElCompletionProvider");
class JsfInlayHintsProvider {
    elProvider;
    constructor(elProvider) {
        this.elProvider = elProvider;
    }
    async provideInlayHints(document, range, token) {
        const config = vscode.workspace.getConfiguration('jakartaFacesTools');
        if (!config.get('showInlineBeanScopes', true)) {
            return undefined;
        }
        if (this.elProvider) {
            await this.elProvider.ensureBeansCached();
        }
        const hints = [];
        const beanMap = (0, JsfElCompletionProvider_1.getSharedBeanMap)();
        if (beanMap.size === 0) {
            return undefined;
        }
        const startLine = range.start.line;
        const endLine = range.end.line;
        for (let lineIdx = startLine; lineIdx <= endLine; lineIdx++) {
            if (token && token.isCancellationRequested) {
                break;
            }
            const lineText = document.lineAt(lineIdx).text;
            // Find all EL expressions #{...} or ${...} on this line
            const elRegex = /([#$])\{([^}]+)\}/g;
            let elMatch;
            while ((elMatch = elRegex.exec(lineText)) !== null) {
                const exprContent = elMatch[2];
                const exprStartOffset = elMatch.index + 2; // after #{ or ${
                // Find all identifiers in the expression
                const identRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g;
                let identMatch;
                while ((identMatch = identRegex.exec(exprContent)) !== null) {
                    const word = identMatch[0];
                    const beanMeta = beanMap.get(word);
                    if (beanMeta) {
                        const position = new vscode.Position(lineIdx, elMatch.index);
                        const scopeDisplay = beanMeta.scope || '@RequestScoped';
                        const hint = new vscode.InlayHint(position, `${scopeDisplay} : `, vscode.InlayHintKind.Type);
                        hint.paddingLeft = false;
                        hint.paddingRight = false;
                        if (config.get('enableHoverCards', true)) {
                            const tooltip = new vscode.MarkdownString();
                            tooltip.supportThemeIcons = true;
                            tooltip.appendMarkdown(`**$(coffee) Jakarta Managed Bean: \`${beanMeta.beanName}\`**\n\n`);
                            tooltip.appendMarkdown(`- **Class:** \`${beanMeta.className}\`\n`);
                            tooltip.appendMarkdown(`- **Scope:** \`${(0, JsfElCompletionProvider_1.getScopeBadge)(scopeDisplay)}\` ${beanMeta.scopePackage ? `(\`${beanMeta.scopePackage}\`)` : ''}\n`);
                            tooltip.appendMarkdown(`- **Lifecycle:** ${(0, JsfElCompletionProvider_1.getScopeLifecycleDescription)(scopeDisplay)}\n\n`);
                            tooltip.appendMarkdown(`---\n*$(coffee) Jakarta Faces Tools*`);
                            hint.tooltip = tooltip;
                        }
                        hints.push(hint);
                        break; // Display scope annotation badge cleanly before #{ for the primary Managed Bean
                    }
                }
            }
        }
        return hints;
    }
}
exports.JsfInlayHintsProvider = JsfInlayHintsProvider;
//# sourceMappingURL=JsfInlayHintsProvider.js.map
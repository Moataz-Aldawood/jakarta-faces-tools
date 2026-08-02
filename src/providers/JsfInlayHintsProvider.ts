import * as vscode from 'vscode';
import { getSharedBeanMap, getScopeBadge, getScopeLifecycleDescription } from './JsfElCompletionProvider';

export class JsfInlayHintsProvider implements vscode.InlayHintsProvider {
    constructor(private readonly elProvider?: { ensureBeansCached(): Promise<void> }) {}

    public async provideInlayHints(
        document: vscode.TextDocument,
        range: vscode.Range,
        token: vscode.CancellationToken
    ): Promise<vscode.InlayHint[] | undefined> {
        const config = vscode.workspace && vscode.workspace.getConfiguration ? vscode.workspace.getConfiguration('jakartaFacesTools') : null;
        if (config && !config.get<boolean>('showInlineBeanScopes', true)) {
            return undefined;
        }

        if (this.elProvider) {
            await this.elProvider.ensureBeansCached();
        }

        const hints: vscode.InlayHint[] = [];
        const beanMap = getSharedBeanMap();
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
                        const positionPref = config ? config.get<string>('inlineBeanScopesPosition', 'Pre-EL') : 'Pre-EL';
                        const scopeDisplay = beanMeta.scope || '@RequestScoped';
                        let position: vscode.Position;
                        let label: string;

                        if (positionPref === 'Post-EL') {
                            const endChar = elMatch.index + elMatch[0].length;
                            position = new vscode.Position(lineIdx, endChar);
                            label = ` : ${scopeDisplay}`;
                        } else {
                            position = new vscode.Position(lineIdx, elMatch.index);
                            label = `${scopeDisplay} : `;
                        }

                        const hint = new vscode.InlayHint(
                            position,
                            label,
                            vscode.InlayHintKind.Type
                        );
                        hint.paddingLeft = false;
                        hint.paddingRight = false;

                        if (!config || config.get<boolean>('enableHoverCards', true)) {
                            const tooltip = new vscode.MarkdownString();
                            tooltip.supportThemeIcons = true;
                            tooltip.appendMarkdown(`**$(coffee) Jakarta Managed Bean: \`${beanMeta.beanName}\`**\n\n`);
                            tooltip.appendMarkdown(`- **Class:** \`${beanMeta.className}\`\n`);
                            tooltip.appendMarkdown(`- **Scope:** \`${getScopeBadge(scopeDisplay)}\` ${beanMeta.scopePackage ? `(\`${beanMeta.scopePackage}\`)` : ''}\n`);
                            tooltip.appendMarkdown(`- **Lifecycle:** ${getScopeLifecycleDescription(scopeDisplay)}\n\n`);
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

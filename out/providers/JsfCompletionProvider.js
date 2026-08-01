"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsfCompletionProvider = void 0;
const vscode = require("vscode");
const jsfCatalog_1 = require("./jsfCatalog");
const namespaceParser_1 = require("./namespaceParser");
const tagParser_1 = require("./tagParser");
const ThirdPartyCatalogs_1 = require("./ThirdPartyCatalogs");
const JsfIdHighlightProvider_1 = require("./JsfIdHighlightProvider");
class JsfCompletionProvider {
    async provideCompletionItems(document, position, token, context) {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        // Check if typing inside for="..." or target="..." (Component ID Auto-complete)
        const idAttrMatch = /\b(for|target)\s*=\s*(['"])([^'"]*)$/.exec(linePrefix);
        if (idAttrMatch) {
            const typedIdPrefix = idAttrMatch[3];
            const foundIds = (0, JsfIdHighlightProvider_1.findComponentIds)(document);
            const items = [];
            for (const item of foundIds) {
                if (typedIdPrefix && !item.id.startsWith(typedIdPrefix)) {
                    continue;
                }
                const compItem = new vscode.CompletionItem({
                    label: item.id,
                    description: ` : ${item.tagName}`
                }, vscode.CompletionItemKind.Reference);
                compItem.detail = `Component ID (from <${item.tagName}>)`;
                const md = new vscode.MarkdownString(`**JSF Component ID: \`${item.id}\`**\n\n` +
                    `- Tag Name: \`<${item.tagName}>\`\n` +
                    `- Declared at line ${item.range.start.line + 1}\n\n` +
                    `---\n*$(coffee) Jakarta Faces Tools*`);
                md.supportThemeIcons = true;
                compItem.documentation = md;
                compItem.insertText = item.id;
                items.push(compItem);
            }
            return items;
        }
        const docText = document.getText();
        const namespaces = (0, namespaceParser_1.getCompositeNamespaces)(docText);
        // Check if we are typing inside a tag (e.g., <h:out or <tc:lab)
        // Match < followed by optional namespace and tag prefix
        const tagMatch = /<([a-zA-Z0-9_:-]*)$/.exec(linePrefix);
        if (tagMatch) {
            const items = [];
            const activeCatalogs = { ...jsfCatalog_1.JSF_CATALOG, ...(0, ThirdPartyCatalogs_1.getActiveThirdPartyCatalogs)(docText) };
            const typedPrefix = tagMatch[1];
            // 1. Standard and 3rd-party tags from catalogs
            for (const tagName in activeCatalogs) {
                if (typedPrefix && !tagName.startsWith(typedPrefix))
                    continue;
                const tag = activeCatalogs[tagName];
                const item = new vscode.CompletionItem(tagName, vscode.CompletionItemKind.Class);
                if (typedPrefix) {
                    item.range = new vscode.Range(position.with(undefined, position.character - typedPrefix.length), position);
                }
                item.detail = 'JSF Tag';
                const parts = tagName.split(':');
                const prefix = parts.length > 1 ? parts[0] : '';
                const baseName = parts.length > 1 ? parts[1] : tagName;
                let docUrl = '';
                if (prefix === 'p') {
                    docUrl = `https://primefaces.github.io/primefaces/15_0_0/#/components/${baseName.toLowerCase()}`;
                }
                else {
                    docUrl = `https://jakarta.ee/specifications/faces/4.1/vdldoc/${prefix}/${baseName}.html`;
                }
                const markdown = new vscode.MarkdownString();
                markdown.supportThemeIcons = true;
                markdown.appendMarkdown(`${tag.description}\n\n`);
                markdown.appendMarkdown(`[Read full documentation](${docUrl})\n\n`);
                markdown.appendMarkdown(`---\n*$(coffee) Jakarta Faces Tools*`);
                item.documentation = markdown;
                items.push(item);
            }
            // 2. Custom tags from namespaces
            for (const prefix of Object.keys(namespaces)) {
                const folder = namespaces[prefix];
                const searchPattern = `**/resources/${folder}/*.xhtml`;
                const files = await vscode.workspace.findFiles(searchPattern, '**/node_modules/**');
                for (const file of files) {
                    // Extract basename without .xhtml
                    const baseName = file.path.split('/').pop()?.replace('.xhtml', '');
                    if (baseName) {
                        const tagName = `${prefix}:${baseName}`;
                        if (typedPrefix && !tagName.startsWith(typedPrefix))
                            continue;
                        const item = new vscode.CompletionItem(tagName, vscode.CompletionItemKind.Class);
                        if (typedPrefix) {
                            item.range = new vscode.Range(position.with(undefined, position.character - typedPrefix.length), position);
                        }
                        item.detail = `Custom Composite Component (${folder})`;
                        const md = new vscode.MarkdownString(`Custom JSF component loaded from resources/${folder}/${baseName}.xhtml\n\n`);
                        md.supportThemeIcons = true;
                        md.appendMarkdown(`---\n*$(coffee) Jakarta Faces Tools*`);
                        item.documentation = md;
                        items.push(item);
                    }
                }
            }
            return items;
        }
        // Check if we are inside an existing tag to suggest attributes
        const tagInfo = (0, tagParser_1.getEnclosingTag)(document, position);
        if (tagInfo) {
            const tagName = tagInfo.tagName;
            // 1. Standard Tag Attributes
            const activeCatalogs = { ...jsfCatalog_1.JSF_CATALOG, ...(0, ThirdPartyCatalogs_1.getActiveThirdPartyCatalogs)(docText) };
            const tag = activeCatalogs[tagName];
            if (tag) {
                const items = [];
                for (const attr of tag.attributes) {
                    const item = new vscode.CompletionItem({
                        label: attr.name,
                        description: attr.type ? ` : ${attr.type}` : ''
                    }, vscode.CompletionItemKind.Property);
                    item.detail = attr.type ? `JSF Attribute (${attr.type})` : 'JSF Attribute';
                    const md = new vscode.MarkdownString();
                    md.supportThemeIcons = true;
                    md.appendMarkdown(`### \`${attr.name}\` *(Attribute)*\n\n`);
                    if (attr.type) {
                        md.appendMarkdown(`**Type:** \`${attr.type}\`\n\n`);
                    }
                    md.appendMarkdown(`${this.cleanHtmlDescription(attr.description)}\n\n`);
                    md.appendMarkdown(`---\n*$(coffee) Jakarta Faces Tools*`);
                    item.documentation = md;
                    item.insertText = new vscode.SnippetString(`${attr.name}="$1"`);
                    items.push(item);
                }
                return items;
            }
            // 2. Custom Component Attributes
            if (tagInfo.prefix && tagInfo.componentName) {
                const folder = namespaces[tagInfo.prefix];
                if (folder) {
                    const componentUri = await (0, namespaceParser_1.resolveCompositeComponent)(folder, tagInfo.componentName);
                    if (componentUri) {
                        const items = [];
                        const customAttrs = await (0, namespaceParser_1.getCompositeAttributes)(componentUri);
                        // Add base component attributes that apply to all custom components
                        customAttrs.push({ name: 'id', type: 'String', description: 'Component identifier' });
                        customAttrs.push({ name: 'rendered', type: 'boolean', description: 'Flag indicating whether or not this component should be rendered' });
                        for (const attr of customAttrs) {
                            const item = new vscode.CompletionItem({
                                label: attr.name,
                                description: attr.type ? ` : ${attr.type}` : ''
                            }, vscode.CompletionItemKind.Property);
                            item.detail = attr.type ? `Custom Attribute (${attr.type})` : 'Custom Attribute';
                            const md = new vscode.MarkdownString();
                            md.supportThemeIcons = true;
                            md.appendMarkdown(`### \`${attr.name}\` *(Custom Attribute)*\n\n`);
                            if (attr.type) {
                                md.appendMarkdown(`**Type:** \`${attr.type}\`\n\n`);
                            }
                            md.appendMarkdown(`${this.cleanHtmlDescription(attr.description)}\n\n`);
                            md.appendMarkdown(`---\n*$(coffee) Jakarta Faces Tools*`);
                            item.documentation = md;
                            item.insertText = new vscode.SnippetString(`${attr.name}="$1"`);
                            items.push(item);
                        }
                        return items;
                    }
                }
            }
        }
        return undefined;
    }
    cleanHtmlDescription(desc) {
        if (!desc)
            return '';
        let cleaned = desc.replace(/<\/?p>/gi, '\n\n')
            .replace(/<\/?code>/gi, '`')
            .replace(/<\/?b>/gi, '**')
            .replace(/<\/?i>/gi, '*')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        return cleaned;
    }
}
exports.JsfCompletionProvider = JsfCompletionProvider;
//# sourceMappingURL=JsfCompletionProvider.js.map
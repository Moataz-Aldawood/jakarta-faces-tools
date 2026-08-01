import * as vscode from 'vscode';
import * as fs from 'fs';
import { findEnclosingIterationVariables, findIterationVariableByName } from './iterationParser';

export interface ElBeanMetadata {
    beanName: string;
    className: string;
    uri: vscode.Uri;
    properties: ElPropertyMetadata[];
}

export interface ElPropertyMetadata {
    name: string;
    type: string;
    isMethod: boolean;
    description: string;
}

// In-memory cache for Managed Beans
const beanMap: Map<string, ElBeanMetadata> = new Map();
const classUriCache: Map<string, vscode.Uri> = new Map();
let isCacheInitialized = false;

export function rebuildJsfCache(showToast: boolean = true): void {
    beanMap.clear();
    classUriCache.clear();
    isCacheInitialized = false;
    if (showToast) {
        vscode.window.showInformationMessage('Jakarta Faces Tools: JSF Cache rebuilt successfully!');
    }
}

export class JsfElCompletionProvider implements vscode.CompletionItemProvider {

    public async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | undefined> {

        // Step 1: Check Beta Feature Configuration Toggle
        const elAutocompleteEnabled = vscode.workspace.getConfiguration('jakartaFacesTools').get<boolean>('enableELAutocomplete', false);
        if (!elAutocompleteEnabled) {
            return undefined;
        }

        // Step 2: Ensure we are inside an EL expression #{...} or ${...}
        const linePrefix = document.lineAt(position.line).text.substring(0, position.character);
        const lastElOpen = Math.max(linePrefix.lastIndexOf('#{'), linePrefix.lastIndexOf('${'));
        if (lastElOpen === -1) {
            return undefined;
        }

        const elExpressionPrefix = linePrefix.substring(lastElOpen + 2);
        if (elExpressionPrefix.includes('}')) {
            // Already closed before cursor
            return undefined;
        }

        // Step 3: Populate cache if not already done
        await this.ensureBeansCached();

        const parts = elExpressionPrefix.split('.');

        // Case 1: Root Bean Completion (e.g. #{user| or #{|)
        if (parts.length === 1) {
            const completions: vscode.CompletionItem[] = [];
            for (const [beanName, meta] of beanMap.entries()) {
                const item = new vscode.CompletionItem({
                    label: beanName,
                    description: ` : ${meta.className}`
                }, vscode.CompletionItemKind.Variable);
                item.insertText = beanName;
                item.detail = `Managed Bean: ${meta.className}`;
                item.documentation = new vscode.MarkdownString(
                    `**Jakarta Managed Bean: \`${beanName}\`**\n\n` +
                    `- Class: \`${meta.className}\`\n` +
                    `- File: \`${vscode.workspace.asRelativePath(meta.uri)}\`\n\n` +
                    `---\n*☕ Jakarta Faces Tools*`
                );
                completions.push(item);
            }

            // Also suggest iteration variables in scope (e.g., u in <ui:repeat var="u">)
            const iterVars = findEnclosingIterationVariables(document, position);
            for (const v of iterVars) {
                const item = new vscode.CompletionItem({
                    label: v.varName,
                    description: ` : var (${v.collectionEl})`
                }, vscode.CompletionItemKind.Variable);
                item.insertText = v.varName;
                item.detail = `Iteration Variable (from #{${v.collectionEl}})`;
                item.documentation = new vscode.MarkdownString(
                    `**JSF Iteration Variable: \`${v.varName}\`**\n\n` +
                    `- Iterates over collection: \`#{${v.collectionEl}}\`\n` +
                    `- Enclosing Scope: Tag at line ${v.tagRange.start.line + 1}\n\n` +
                    `---\n*☕ Jakarta Faces Tools*`
                );
                completions.push(item);
            }

            return completions;
        }

        // Case 2: Property & Method Completion after dot (e.g. #{c_UserRegistration.newUser.| or #{u.|)
        const rootBeanName = parts[0];
        let meta = beanMap.get(rootBeanName);
        let currentUri: vscode.Uri | null = null;

        if (meta) {
            currentUri = meta.uri;
        } else {
            // Check if rootBeanName is an iteration variable in scope (e.g. var="u")
            const iterVar = findIterationVariableByName(document, position, rootBeanName);
            if (iterVar) {
                currentUri = await this.resolveIterationVariableElementUri(iterVar.collectionEl);
            }
        }

        if (!currentUri) {
            return undefined;
        }

        // Traverse intermediate properties in the chain (e.g., in #{bean.user.address.}, step through 'user')
        for (let i = 1; i < parts.length - 1; i++) {
            let propName = parts[i];
            if (propName.endsWith('()')) {
                propName = propName.substring(0, propName.length - 2);
            }

            const content = await this.readFile(currentUri);
            const returnType = this.findPropertyTypeInContent(content, propName);
            if (!returnType) {
                return undefined;
            }

            const nextUri = await this.findJavaClassUri(returnType);
            if (!nextUri) {
                return undefined;
            }
            currentUri = nextUri;
        }

        // Now we are at the target class file: parse all available properties and methods!
        const targetContent = await this.readFile(currentUri);
        const properties = this.extractClassPropertiesAndMethods(targetContent);

        const completions: vscode.CompletionItem[] = [];
        for (const prop of properties) {
            const kind = prop.isMethod ? vscode.CompletionItemKind.Method : vscode.CompletionItemKind.Property;
            const item = new vscode.CompletionItem({
                label: prop.name,
                detail: prop.isMethod ? '()' : '',
                description: ` : ${prop.type}`
            }, kind);
            item.detail = `${prop.isMethod ? 'Method' : 'Property'} : ${prop.type}`;
            if (prop.isMethod) {
                item.insertText = new vscode.SnippetString(`${prop.name}($0)`);
            } else {
                item.insertText = prop.name;
            }
            item.documentation = new vscode.MarkdownString(
                `**${prop.name}**\n\n\`${prop.description}\` -> \`${prop.type}\`\n\n` +
                `---\n*☕ Jakarta Faces Tools*`
            );
            completions.push(item);
        }

        return completions;
    }

    private async resolveIterationVariableElementUri(collectionEl: string): Promise<vscode.Uri | null> {
        await this.ensureBeansCached();
        const chain = collectionEl.split('.');
        const rootBeanName = chain[0];
        let currentUri: vscode.Uri | null = null;
        const meta = beanMap.get(rootBeanName);
        if (meta) {
            currentUri = meta.uri;
        } else {
            const capitalizedName = rootBeanName.charAt(0).toUpperCase() + rootBeanName.slice(1);
            currentUri = await this.findJavaClassUri(capitalizedName);
        }

        if (!currentUri) {
            return null;
        }

        for (let i = 1; i < chain.length; i++) {
            let propName = chain[i].trim();
            if (propName.endsWith('()')) {
                propName = propName.substring(0, propName.length - 2).trim();
            }

            const content = await this.readFile(currentUri);
            const returnType = this.findPropertyTypeInContent(content, propName);
            if (!returnType) {
                return null;
            }

            const nextUri = await this.findJavaClassUri(returnType);
            if (!nextUri) {
                return null;
            }
            currentUri = nextUri;
        }

        return currentUri;
    }

    private async ensureBeansCached(): Promise<void> {
        if (isCacheInitialized) {
            return;
        }

        const javaFiles = await vscode.workspace.findFiles('**/*.java', '**/node_modules/**');

        for (const file of javaFiles) {
            const rawContent = await this.readFile(file);
            const content = this.stripJavaComments(rawContent);

            // Check for explicit @Named("foo") or @ManagedBean(name="foo")
            const explicitRegex = /@(Named|ManagedBean|Controller|Component)\s*\(\s*(?:value\s*=\s*|name\s*=\s*)?"([a-zA-Z0-9_-]+)"\s*\)/g;
            let match;
            while ((match = explicitRegex.exec(content)) !== null) {
                const beanName = match[2];
                const className = this.extractClassName(content) || beanName;
                beanMap.set(beanName, {
                    beanName,
                    className,
                    uri: file,
                    properties: []
                });
            }

            // Check for implicit @Named or @ManagedBean without value
            const implicitRegex = /@(Named|ManagedBean|Controller|Component)(?!\s*\()/g;
            if (implicitRegex.test(content)) {
                const className = this.extractClassName(content);
                if (className) {
                    const beanName = className.charAt(0).toLowerCase() + className.slice(1);
                    beanMap.set(beanName, {
                        beanName,
                        className,
                        uri: file,
                        properties: []
                    });
                }
            }

            // Also cache className -> uri mapping for fast lookup
            const className = this.extractClassName(content);
            if (className) {
                classUriCache.set(className, file);
            }
        }

        isCacheInitialized = true;
    }

    private extractClassName(content: string): string | null {
        const classMatch = /(?:public|protected|private|abstract)?\s*class\s+([A-Za-z0-9_]+)/.exec(content);
        return classMatch ? classMatch[1] : null;
    }

    private stripJavaComments(content: string): string {
        // Replace block comments /* ... */ with spaces (preserving newlines for accurate offsets)
        let clean = content.replace(/\/\*[\s\S]*?\*\//g, (match) => {
            return match.replace(/[^\n]/g, ' ');
        });
        // Replace single-line comments // ... with spaces
        clean = clean.replace(/\/\/.*$/gm, (match) => {
            return ' '.repeat(match.length);
        });
        return clean;
    }

    private extractClassPropertiesAndMethods(content: string): ElPropertyMetadata[] {
        const cleanContent = this.stripJavaComments(content);
        const results: ElPropertyMetadata[] = [];
        const seenNames = new Set<string>();

        // 1. Getters: public String getFoo() or public boolean isBar()
        const getterRegex = /public\s+([\w<>\[\]\?,\s]+?)\s+(get|is)([A-Z]\w*)\s*\(/g;
        let getterMatch;
        while ((getterMatch = getterRegex.exec(cleanContent)) !== null) {
            const rawType = getterMatch[1].trim();
            const propName = getterMatch[3].charAt(0).toLowerCase() + getterMatch[3].slice(1);
            if (!seenNames.has(propName)) {
                seenNames.add(propName);
                results.push({
                    name: propName,
                    type: this.cleanType(rawType),
                    isMethod: false,
                    description: `getter: ${getterMatch[2]}${getterMatch[3]}()`
                });
            }
        }

        // 2. Public Methods (action / listener methods e.g. public String save() or public void doSomething())
        const methodRegex = /public\s+([\w<>\[\]\?,\s]+?)\s+([a-z]\w*)\s*\([^)]*\)/g;
        let methodMatch;
        while ((methodMatch = methodRegex.exec(cleanContent)) !== null) {
            const rawType = methodMatch[1].trim();
            const methodName = methodMatch[2];
            // Skip standard Object methods, or zero-arg getters (get.../is...) per JSF standard / NetBeans convention
            if (['equals', 'hashCode', 'toString', 'getClass', 'notify', 'notifyAll', 'wait'].includes(methodName)) {
                continue;
            }
            if (/^(get|is)[A-Z]/.test(methodName)) {
                continue;
            }
            if (!seenNames.has(methodName) && !seenNames.has(methodName + '()')) {
                seenNames.add(methodName);
                results.push({
                    name: methodName,
                    type: this.cleanType(rawType),
                    isMethod: true,
                    description: `method: ${methodName}()`
                });
            }
        }

        return results;
    }

    private findPropertyTypeInContent(content: string, propertyName: string): string | null {
        const cleanContent = this.stripJavaComments(content);
        let prop = propertyName.trim();
        if (prop.endsWith('()')) {
            prop = prop.substring(0, prop.length - 2).trim();
        }

        // 1. Check for exact method name match: public ReturnType methodName(
        const methodRegex = new RegExp(`public\\s+([\\w<>\\[\\]\\?,\\s]+?)\\s+${prop}\\s*\\(`);
        const methodMatch = methodRegex.exec(cleanContent);
        if (methodMatch && methodMatch[1]) {
            return this.extractBaseType(methodMatch[1].trim());
        }

        // 2. Try getter: public ReturnType getPropertyName() or isPropertyName()
        const capitalized = prop.charAt(0).toUpperCase() + prop.slice(1);
        const getterRegex = new RegExp(`public\\s+([\\w<>\\[\\]\\?,\\s]+?)\\s+(get|is)${capitalized}\\s*\\(`);
        const getterMatch = getterRegex.exec(cleanContent);
        if (getterMatch && getterMatch[1]) {
            return this.extractBaseType(getterMatch[1].trim());
        }

        // 3. Try field: private FieldType propertyName;
        const fieldRegex = new RegExp(`(?:private|protected|public)?\\s+([\\w<>\\[\\]\\?,\\s]+?)\\s+${prop}\\s*[;=]`);
        const fieldMatch = fieldRegex.exec(cleanContent);
        if (fieldMatch && fieldMatch[1]) {
            return this.extractBaseType(fieldMatch[1].trim());
        }

        return null;
    }

    private extractBaseType(rawType: string): string {
        const genericMatch = /<([^>]+)>/.exec(rawType);
        if (genericMatch) {
            const parts = genericMatch[1].split(',');
            return parts[parts.length - 1].trim();
        }
        return rawType.replace(/\[\]/g, '').trim();
    }

    private cleanType(rawType: string): string {
        return rawType.replace(/\s+/g, ' ').trim();
    }

    private async findJavaClassUri(className: string): Promise<vscode.Uri | null> {
        if (classUriCache.has(className)) {
            return classUriCache.get(className)!;
        }

        const files = await vscode.workspace.findFiles(`**/${className}.java`, '**/node_modules/**');
        if (files.length > 0) {
            classUriCache.set(className, files[0]);
            return files[0];
        }
        return null;
    }

    private readFile(uri: vscode.Uri): Promise<string> {
        return new Promise((resolve) => {
            fs.readFile(uri.fsPath, 'utf8', (err, data) => {
                if (err) {
                    resolve('');
                } else {
                    resolve(data);
                }
            });
        });
    }
}

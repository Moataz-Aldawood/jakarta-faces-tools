"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsfElCompletionProvider = void 0;
exports.rebuildJsfCache = rebuildJsfCache;
exports.getSharedBeanMap = getSharedBeanMap;
exports.getSharedClassUriCache = getSharedClassUriCache;
exports.isJsfCacheInitialized = isJsfCacheInitialized;
exports.setCacheInitializedForTest = setCacheInitializedForTest;
exports.removeJavaBeanFromCache = removeJavaBeanFromCache;
exports.updateJavaBeanInCache = updateJavaBeanInCache;
exports.startJavaFileWatcher = startJavaFileWatcher;
const vscode = require("vscode");
const fs = require("fs");
const iterationParser_1 = require("./iterationParser");
// In-memory cache for Managed Beans
const beanMap = new Map();
const classUriCache = new Map();
let isCacheInitialized = false;
function rebuildJsfCache(showToast = true) {
    beanMap.clear();
    classUriCache.clear();
    isCacheInitialized = false;
    if (showToast) {
        vscode.window.showInformationMessage('Jakarta Faces Tools: JSF Cache rebuilt successfully!');
    }
}
function getSharedBeanMap() {
    return beanMap;
}
function getSharedClassUriCache() {
    return classUriCache;
}
function isJsfCacheInitialized() {
    return isCacheInitialized;
}
function setCacheInitializedForTest(val) {
    isCacheInitialized = val;
}
function removeJavaBeanFromCache(uri) {
    const fsPath = uri.fsPath || uri.toString();
    for (const [beanName, meta] of beanMap.entries()) {
        const metaPath = meta.uri.fsPath || meta.uri.toString();
        if (metaPath === fsPath) {
            beanMap.delete(beanName);
        }
    }
    for (const [className, cachedUri] of classUriCache.entries()) {
        const cachedPath = cachedUri.fsPath || cachedUri.toString();
        if (cachedPath === fsPath) {
            classUriCache.delete(className);
        }
    }
}
async function updateJavaBeanInCache(uri, readFileFn) {
    if (!isCacheInitialized) {
        return;
    }
    removeJavaBeanFromCache(uri);
    try {
        let rawContent;
        if (readFileFn) {
            rawContent = await readFileFn(uri);
        }
        else if (vscode.workspace && vscode.workspace.fs) {
            const buf = await vscode.workspace.fs.readFile(uri);
            rawContent = new TextDecoder().decode(buf);
        }
        else {
            rawContent = await fs.promises.readFile(uri.fsPath, 'utf8');
        }
        const provider = new JsfElCompletionProvider();
        const content = provider.stripJavaComments(rawContent);
        const explicitRegex = /@(Named|ManagedBean|Controller|Component)\s*\(\s*(?:value\s*=\s*|name\s*=\s*)?"([a-zA-Z0-9_-]+)"\s*\)/g;
        let match;
        while ((match = explicitRegex.exec(content)) !== null) {
            const beanName = match[2];
            const className = provider.extractClassName(content) || beanName;
            beanMap.set(beanName, {
                beanName,
                className,
                uri: uri,
                properties: []
            });
        }
        const implicitRegex = /@(Named|ManagedBean|Controller|Component)(?!\s*\()/g;
        if (implicitRegex.test(content)) {
            const className = provider.extractClassName(content);
            if (className) {
                const beanName = className.charAt(0).toLowerCase() + className.slice(1);
                beanMap.set(beanName, {
                    beanName,
                    className,
                    uri: uri,
                    properties: []
                });
            }
        }
        const className = provider.extractClassName(content);
        if (className) {
            classUriCache.set(className, uri);
        }
    }
    catch (e) {
        // Ignore read error if file was deleted simultaneously
    }
}
function startJavaFileWatcher(context, onCacheUpdated) {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.java');
    watcher.onDidCreate(async (uri) => {
        if (!vscode.workspace.getConfiguration('jakartaFacesTools').get('enableIncrementalCache', true)) {
            return;
        }
        await updateJavaBeanInCache(uri);
        onCacheUpdated?.();
    });
    watcher.onDidChange(async (uri) => {
        if (!vscode.workspace.getConfiguration('jakartaFacesTools').get('enableIncrementalCache', true)) {
            return;
        }
        await updateJavaBeanInCache(uri);
        onCacheUpdated?.();
    });
    watcher.onDidDelete((uri) => {
        if (!vscode.workspace.getConfiguration('jakartaFacesTools').get('enableIncrementalCache', true)) {
            return;
        }
        removeJavaBeanFromCache(uri);
        onCacheUpdated?.();
    });
    context.subscriptions.push(watcher);
}
class JsfElCompletionProvider {
    async provideCompletionItems(document, position, token, context) {
        // Step 1: Check Beta Feature Configuration Toggle
        const elAutocompleteEnabled = vscode.workspace.getConfiguration('jakartaFacesTools').get('enableELAutocomplete', true);
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
            const completions = [];
            for (const [beanName, meta] of beanMap.entries()) {
                const item = new vscode.CompletionItem({
                    label: beanName,
                    description: ` : ${meta.className}`
                }, vscode.CompletionItemKind.Class);
                item.insertText = new vscode.SnippetString(`${beanName}$0`);
                item.detail = `Managed Bean: ${meta.className}`;
                const md = new vscode.MarkdownString(`**Jakarta Managed Bean: \`${beanName}\`**\n\n` +
                    `- Class: \`${meta.className}\`\n` +
                    `- File: \`${vscode.workspace.asRelativePath(meta.uri)}\`\n\n` +
                    `---\n*$(coffee) Jakarta Faces Tools*`);
                md.supportThemeIcons = true;
                item.documentation = md;
                completions.push(item);
            }
            // Also suggest iteration variables in scope (e.g., u in <ui:repeat var="u">)
            const iterVars = (0, iterationParser_1.findEnclosingIterationVariables)(document, position);
            for (const v of iterVars) {
                const item = new vscode.CompletionItem({
                    label: v.varName,
                    description: ` : var (${v.collectionEl})`
                }, vscode.CompletionItemKind.Variable);
                item.insertText = new vscode.SnippetString(`${v.varName}$0`);
                item.detail = `Iteration Variable (from #{${v.collectionEl}})`;
                const md = new vscode.MarkdownString(`**JSF Iteration Variable: \`${v.varName}\`**\n\n` +
                    `- Iterates over collection: \`#{${v.collectionEl}}\`\n` +
                    `- Enclosing Scope: Tag at line ${v.tagRange.start.line + 1}\n\n` +
                    `---\n*$(coffee) Jakarta Faces Tools*`);
                md.supportThemeIcons = true;
                item.documentation = md;
                completions.push(item);
            }
            return completions;
        }
        // Case 2: Property & Method Completion after dot (e.g. #{c_UserRegistration.newUser.| or #{u.|)
        const rootBeanName = parts[0];
        let meta = beanMap.get(rootBeanName);
        let currentUri = null;
        if (meta) {
            currentUri = meta.uri;
        }
        else {
            // Check if rootBeanName is an iteration variable in scope (e.g. var="u")
            const iterVar = (0, iterationParser_1.findIterationVariableByName)(document, position, rootBeanName);
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
        const completions = [];
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
            }
            else {
                item.insertText = prop.name;
            }
            const md = new vscode.MarkdownString(`**${prop.name}**\n\n\`${prop.description}\` -> \`${prop.type}\`\n\n` +
                `---\n*$(coffee) Jakarta Faces Tools*`);
            md.supportThemeIcons = true;
            item.documentation = md;
            completions.push(item);
        }
        return completions;
    }
    async resolveIterationVariableElementUri(collectionEl) {
        await this.ensureBeansCached();
        const chain = collectionEl.split('.');
        const rootBeanName = chain[0];
        let currentUri = null;
        const meta = beanMap.get(rootBeanName);
        if (meta) {
            currentUri = meta.uri;
        }
        else {
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
    async ensureBeansCached() {
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
    extractClassName(content) {
        const classMatch = /(?:public|protected|private|abstract)?\s*class\s+([A-Za-z0-9_]+)/.exec(content);
        return classMatch ? classMatch[1] : null;
    }
    stripJavaComments(content) {
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
    extractClassPropertiesAndMethods(content) {
        const cleanContent = this.stripJavaComments(content);
        const results = [];
        const seenNames = new Set();
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
        // 3. Lombok properties from non-static fields (@Data, @Getter, @Value, @Builder, or field-level @Getter)
        const classMatchIdx = cleanContent.search(/\b(class|record|enum|interface)\b/);
        const firstBrace = classMatchIdx !== -1 ? cleanContent.indexOf('{', classMatchIdx) : cleanContent.indexOf('{');
        const classHeader = firstBrace !== -1 ? cleanContent.substring(0, firstBrace) : cleanContent;
        const hasClassLombokGetter = /@(?:lombok\.)?(Data|Getter|Value|Builder)\b/.test(classHeader);
        const fields = this.extractFieldsFromContent(content);
        for (const field of fields) {
            if (hasClassLombokGetter || field.hasGetterAnnotation) {
                let propName = field.name;
                let getterPrefix = 'get';
                if (/^boolean$/.test(field.type)) {
                    if (/^is[A-Z]/.test(field.name)) {
                        propName = field.name.charAt(2).toLowerCase() + field.name.slice(3);
                        getterPrefix = 'is';
                    }
                    else {
                        getterPrefix = 'is';
                    }
                }
                if (!seenNames.has(propName)) {
                    seenNames.add(propName);
                    const capitalized = propName.charAt(0).toUpperCase() + propName.slice(1);
                    results.push({
                        name: propName,
                        type: this.cleanType(field.type),
                        isMethod: false,
                        description: `getter: ${getterPrefix}${capitalized}() (Lombok)`
                    });
                }
            }
        }
        return results;
    }
    splitTopLevelCommas(input) {
        const result = [];
        let current = '';
        let depth = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input[i];
            if (char === '<' || char === '(' || char === '[') {
                depth++;
                current += char;
            }
            else if (char === '>' || char === ')' || char === ']') {
                depth = Math.max(0, depth - 1);
                current += char;
            }
            else if (char === ',' && depth === 0) {
                result.push(current.trim());
                current = '';
            }
            else {
                current += char;
            }
        }
        if (current.trim()) {
            result.push(current.trim());
        }
        return result;
    }
    extractFieldsFromContent(content) {
        const cleanContent = this.stripJavaComments(content);
        const classMatchIdx = cleanContent.search(/\b(class|record|enum|interface)\b/);
        const firstBrace = classMatchIdx !== -1 ? cleanContent.indexOf('{', classMatchIdx) : cleanContent.indexOf('{');
        const lastBrace = cleanContent.lastIndexOf('}');
        const body = (firstBrace !== -1 && lastBrace !== -1) ? cleanContent.substring(firstBrace + 1, lastBrace) : cleanContent;
        const statements = body.split(';');
        const fields = [];
        for (const stmt of statements) {
            if (/\bstatic\b/.test(stmt) || /\bclass\b/.test(stmt) || /\breturn\b/.test(stmt) || /{/.test(stmt) || /}/.test(stmt)) {
                continue;
            }
            const eqIdx = stmt.indexOf('=');
            const leftSide = eqIdx !== -1 ? stmt.substring(0, eqIdx) : stmt;
            const trimmed = leftSide.trim();
            if (!trimmed) {
                continue;
            }
            const hasGetterAnnotation = /@(?:lombok\.)?Getter\b/.test(trimmed);
            let cleanLeft = trimmed.replace(/@[A-Za-z0-9_.]+(?:\([^)]*\))?/g, '').trim();
            cleanLeft = cleanLeft.replace(/\b(public|protected|private|final|transient|volatile)\b/g, '').trim();
            if (!cleanLeft || cleanLeft.includes('(')) {
                continue;
            }
            const parts = this.splitTopLevelCommas(cleanLeft);
            if (parts.length === 0) {
                continue;
            }
            const firstTokens = parts[0].trim().split(/\s+/);
            if (firstTokens.length >= 2) {
                const firstVarName = firstTokens[firstTokens.length - 1];
                const typeName = parts[0].trim().substring(0, parts[0].trim().lastIndexOf(firstVarName)).trim();
                if (typeName && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(firstVarName)) {
                    fields.push({ name: firstVarName, type: typeName, hasGetterAnnotation });
                    for (let i = 1; i < parts.length; i++) {
                        const nextVarName = parts[i].trim();
                        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(nextVarName)) {
                            fields.push({ name: nextVarName, type: typeName, hasGetterAnnotation });
                        }
                    }
                }
            }
        }
        return fields;
    }
    findPropertyTypeInContent(content, propertyName) {
        const cleanContent = this.stripJavaComments(content);
        let prop = propertyName.trim();
        const parenIdx = prop.indexOf('(');
        if (parenIdx !== -1) {
            prop = prop.substring(0, parenIdx).trim();
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
        // 3. Try Lombok / standard fields using robust field extraction
        const fields = this.extractFieldsFromContent(content);
        for (const field of fields) {
            if (field.name === prop) {
                return this.extractBaseType(field.type);
            }
            if (/^boolean$/.test(field.type) && field.name === 'is' + capitalized) {
                return this.extractBaseType(field.type);
            }
        }
        return null;
    }
    extractBaseType(rawType) {
        let cleaned = rawType.replace(/@[A-Za-z0-9_.]+(?:\([^)]*\))?\s*/g, '').trim();
        cleaned = cleaned.replace(/\b(public|protected|private|static|final|transient|volatile)\b\s*/g, '').trim();
        const genericMatch = /<([^>]+)>/.exec(cleaned);
        if (genericMatch) {
            const parts = genericMatch[1].split(',');
            return parts[parts.length - 1].trim();
        }
        return cleaned.replace(/\[\]/g, '').trim();
    }
    cleanType(rawType) {
        return rawType.replace(/\s+/g, ' ').trim();
    }
    async findJavaClassUri(className) {
        if (classUriCache.has(className)) {
            return classUriCache.get(className);
        }
        const files = await vscode.workspace.findFiles(`**/${className}.java`, '**/node_modules/**');
        if (files.length > 0) {
            classUriCache.set(className, files[0]);
            return files[0];
        }
        return null;
    }
    readFile(uri) {
        return new Promise((resolve) => {
            fs.readFile(uri.fsPath, 'utf8', (err, data) => {
                if (err) {
                    resolve('');
                }
                else {
                    resolve(data);
                }
            });
        });
    }
}
exports.JsfElCompletionProvider = JsfElCompletionProvider;
//# sourceMappingURL=JsfElCompletionProvider.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeElDiagnostics = computeElDiagnostics;
exports.refreshDiagnostics = refreshDiagnostics;
exports.subscribeToDocumentChanges = subscribeToDocumentChanges;
const vscode = require("vscode");
const jsfCatalog_1 = require("./jsfCatalog");
const namespaceParser_1 = require("./namespaceParser");
const ThirdPartyCatalogs_1 = require("./ThirdPartyCatalogs");
const JsfElCompletionProvider_1 = require("./JsfElCompletionProvider");
const iterationParser_1 = require("./iterationParser");
const tagParser_1 = require("./tagParser");
const STATEFUL_DATA_TAGS = new Set([
    'h:dataTable', 'p:dataTable', 'p:dataList', 'p:dataGrid', 'p:carousel', 'ui:repeat'
]);
const EL_IMPLICIT_OBJECTS = new Set([
    'param', 'paramValues', 'header', 'headerValues', 'cookie', 'initParam',
    'request', 'response', 'session', 'application', 'facesContext',
    'view', 'component', 'resource', 'cc', 'requestScope', 'sessionScope',
    'applicationScope', 'flash', 'flowScope',
    'true', 'false', 'null', 'not', 'empty', 'and', 'or', 'eq', 'ne',
    'lt', 'gt', 'le', 'ge', 'mod', 'div', 'instanceof'
]);
const OBJECT_METHODS = new Set(['class', 'classLoader', 'classReference', 'equals', 'hashCode', 'toString']);
async function computeElDiagnostics(document, beanMap, elProvider) {
    const config = vscode.workspace && vscode.workspace.getConfiguration ? vscode.workspace.getConfiguration('jakartaFacesTools') : null;
    const scopeWarningsEnabled = config ? config.get('enableScopeWarnings', true) : true;
    const docVersion = document.version;
    const diagnostics = [];
    const text = document.getText();
    const elRegex = /#\{([^\}]+)\}/g;
    let elMatch;
    while ((elMatch = elRegex.exec(text)) !== null) {
        const rawEl = elMatch[1];
        const elStartOffset = elMatch.index + 2; // +2 for #{
        // Replace string literals ('...' or "...") with spaces to prevent false matches inside strings
        const noStrings = rawEl.replace(/(['"])(?:(?!\1)[^\\]|\\.)*\1/g, match => ' '.repeat(match.length));
        // Find identifier chains separated by dot
        const chainRegex = /[a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)+|[a-zA-Z_$][a-zA-Z0-9_$]*/g;
        let chainMatch;
        while ((chainMatch = chainRegex.exec(noStrings)) !== null) {
            const chain = chainMatch[0];
            const chainOffset = elStartOffset + chainMatch.index;
            const parts = chain.split('.');
            const rootName = parts[0];
            // Ignore implicit objects, keywords, literals
            if (EL_IMPLICIT_OBJECTS.has(rootName)) {
                continue;
            }
            // Check if it is an iteration variable in scope (e.g., <ui:repeat var="u">)
            const startPos = document.positionAt(chainOffset);
            const iterVar = (0, iterationParser_1.findIterationVariableByName)(document, startPos, rootName);
            if (iterVar) {
                continue; // Valid iteration variable
            }
            // Check if rootName is a known Managed Bean
            if (!beanMap.has(rootName)) {
                const endPos = document.positionAt(chainOffset + rootName.length);
                const range = new vscode.Range(startPos, endPos);
                const diagnostic = new vscode.Diagnostic(range, `Jakarta Faces: Unknown Managed Bean or EL variable '${rootName}'.`, vscode.DiagnosticSeverity.Warning);
                diagnostic.source = 'Jakarta Faces Tools';
                diagnostics.push(diagnostic);
                continue;
            }
            // If rootName IS a known Managed Bean, check for dangerous scope bindings and validate property chain
            if (parts.length >= 2) {
                const bean = beanMap.get(rootName);
                // Scope-Aware Best-Practice Check: Warn if binding a stateful data tag to @RequestScoped bean (experimental feature, disabled by default)
                if (scopeWarningsEnabled && bean.scope === '@RequestScoped') {
                    const enclosingTag = (0, tagParser_1.getEnclosingTag)(document, startPos);
                    if (enclosingTag && STATEFUL_DATA_TAGS.has(enclosingTag.tagName)) {
                        const endPos = document.positionAt(chainOffset + rootName.length);
                        const range = new vscode.Range(startPos, endPos);
                        const diagnostic = new vscode.Diagnostic(range, `Jakarta Faces Best Practice: '<${enclosingTag.tagName}>' is bound to '@RequestScoped' bean '${rootName}'. Pagination, sorting, and state selection may fail on postback. Consider changing '${rootName}' to '@ViewScoped'.`, vscode.DiagnosticSeverity.Information);
                        diagnostic.source = 'Jakarta Faces Tools';
                        diagnostics.push(diagnostic);
                    }
                }
                let currentUri = bean.uri;
                let currentClassName = bean.className;
                let currentOffset = chainOffset + rootName.length + 1; // +1 for '.'
                for (let i = 1; i < parts.length; i++) {
                    const propName = parts[i];
                    if (OBJECT_METHODS.has(propName)) {
                        break; // Standard Object method, valid
                    }
                    if (!currentUri) {
                        break; // Cannot check source of external or JDK library class
                    }
                    const beanContent = await elProvider.readFile(currentUri);
                    if (document.version !== undefined && document.version !== docVersion) {
                        return diagnostics;
                    }
                    const returnType = elProvider.findPropertyTypeInContent(beanContent, propName);
                    if (!returnType) {
                        const propStartPos = document.positionAt(currentOffset);
                        const propEndPos = document.positionAt(currentOffset + propName.length);
                        const range = new vscode.Range(propStartPos, propEndPos);
                        const diagnostic = new vscode.Diagnostic(range, `Jakarta Faces: Property '${propName}' not found in Managed Bean '${rootName}' (${currentClassName}).`, vscode.DiagnosticSeverity.Warning);
                        diagnostic.source = 'Jakarta Faces Tools';
                        diagnostics.push(diagnostic);
                        break; // Stop checking deeper segments if this property failed
                    }
                    // Move to the return type class for the next property segment in the chain
                    currentClassName = returnType;
                    if (elProvider.findJavaClassUri) {
                        currentUri = await elProvider.findJavaClassUri(returnType);
                    }
                    else {
                        currentUri = null;
                    }
                    currentOffset += propName.length + 1; // +1 for '.'
                }
            }
        }
    }
    return diagnostics;
}
async function refreshDiagnostics(document, jsfDiagnostics) {
    if (document.languageId !== 'jsf' && document.languageId !== 'html' && document.languageId !== 'xml' && document.languageId !== 'xhtml') {
        return;
    }
    // We only want to analyze files with jsf/xhtml extensions to avoid polluting pure xml/html files
    if (!document.fileName.endsWith('.xhtml') && !document.fileName.endsWith('.jsf')) {
        return;
    }
    const docVersion = document.version;
    const diagnostics = [];
    const text = document.getText();
    const config = vscode.workspace && vscode.workspace.getConfiguration ? vscode.workspace.getConfiguration('jakartaFacesTools') : null;
    const enableJSFDiagnostics = config ? config.get('enableJSFDiagnostics', true) : true;
    if (enableJSFDiagnostics) {
        // 1. Check for unclosed EL expressions
        let elIndex = 0;
        while ((elIndex = text.indexOf('#{', elIndex)) !== -1) {
            const nextClosing = text.indexOf('}', elIndex);
            const nextOpening = text.indexOf('#{', elIndex + 2);
            // If there's no closing bracket, or if the next opening bracket is BEFORE the closing bracket
            // (meaning we started a new one without closing the previous one)
            if (nextClosing === -1 || (nextOpening !== -1 && nextOpening < nextClosing)) {
                const startPos = document.positionAt(elIndex);
                // We'll just highlight the #{
                const endPos = document.positionAt(elIndex + 2);
                const range = new vscode.Range(startPos, endPos);
                const diagnostic = new vscode.Diagnostic(range, "Unclosed Expression Language (EL) block. Missing '}'", vscode.DiagnosticSeverity.Error);
                diagnostic.source = 'Jakarta Faces Tools';
                diagnostics.push(diagnostic);
                // Move index forward to avoid infinite loop
                elIndex += 2;
            }
            else {
                // It's closed properly, move index past the closing bracket
                elIndex = nextClosing + 1;
            }
        }
        // 2. Check for unknown standard and 3rd-party tags
        const activeCatalogs = { ...jsfCatalog_1.JSF_CATALOG, ...(0, ThirdPartyCatalogs_1.getActiveThirdPartyCatalogs)(text) };
        const compositeNamespaces = (0, namespaceParser_1.getCompositeNamespaces)(text);
        // We look for any namespaced tag <prefix:basename
        const tagRegex = /<([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)/g;
        let match;
        while ((match = tagRegex.exec(text)) !== null) {
            const prefix = match[1];
            const fullTagName = `${prefix}:${match[2]}`;
            // Skip composite component prefixes
            if (compositeNamespaces[prefix]) {
                continue;
            }
            // Check if the prefix belongs to one of our active catalogs
            const isManagedPrefix = Object.keys(activeCatalogs).some(k => k.startsWith(prefix + ':'));
            if (isManagedPrefix) {
                if (!activeCatalogs[fullTagName]) {
                    const startPos = document.positionAt(match.index + 1); // +1 to skip '<'
                    const endPos = document.positionAt(match.index + 1 + fullTagName.length);
                    const range = new vscode.Range(startPos, endPos);
                    const diagnostic = new vscode.Diagnostic(range, `Unknown JSF tag '${fullTagName}'.`, vscode.DiagnosticSeverity.Warning);
                    diagnostic.source = 'Jakarta Faces Tools';
                    diagnostics.push(diagnostic);
                }
            }
        }
        // 3. Check for unknown attributes in known tags
        const tagBodyRegex = /<([a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+)([\s\S]*?)>/g;
        let bodyMatch;
        while ((bodyMatch = tagBodyRegex.exec(text)) !== null) {
            const fullTagName = bodyMatch[1];
            const tagBody = bodyMatch[2];
            const tag = activeCatalogs[fullTagName];
            if (tag) {
                // Find attributes: space followed by name="value" or name='value'
                const attrRegex = /\s+([a-zA-Z0-9_:-]+)\s*=\s*(['"])([\s\S]*?)\2/g;
                let attrMatch;
                const validAttrs = new Set(tag.attributes.map(a => a.name));
                // Global standard attributes
                validAttrs.add('id');
                validAttrs.add('rendered');
                validAttrs.add('binding');
                while ((attrMatch = attrRegex.exec(tagBody)) !== null) {
                    const attrName = attrMatch[1];
                    // Ignore namespaces (xmlns:*) and pass-through attributes (pt:*) which contain colons
                    if (attrName.includes(':') || attrName === 'xmlns') {
                        continue;
                    }
                    if (!validAttrs.has(attrName)) {
                        // Locate attrName in tagBody
                        const attrIndex = tagBody.indexOf(attrName, attrMatch.index);
                        const tagStartOffset = bodyMatch.index + fullTagName.length + 1; // after <h:outputText
                        const absStart = tagStartOffset + attrIndex;
                        const startPos = document.positionAt(absStart);
                        const endPos = document.positionAt(absStart + attrName.length);
                        const range = new vscode.Range(startPos, endPos);
                        const diagnostic = new vscode.Diagnostic(range, `Unknown attribute '${attrName}' for tag '${fullTagName}'.`, vscode.DiagnosticSeverity.Warning);
                        diagnostic.source = 'Jakarta Faces Tools';
                        diagnostics.push(diagnostic);
                    }
                }
            }
        }
    }
    // 4. Check for EL Semantic Validation (unknown Managed Beans and mistyped properties)
    const enableELDiagnostics = config ? config.get('enableELDiagnostics', true) : true;
    if (enableELDiagnostics) {
        try {
            const elProvider = new JsfElCompletionProvider_1.JsfElCompletionProvider();
            await elProvider.ensureBeansCached();
            if (document.version !== undefined && document.version !== docVersion) {
                return;
            }
            const beanMap = (0, JsfElCompletionProvider_1.getSharedBeanMap)();
            const elDiagnostics = await computeElDiagnostics(document, beanMap, elProvider);
            if (document.version !== undefined && document.version !== docVersion) {
                return;
            }
            diagnostics.push(...elDiagnostics);
        }
        catch (e) {
            // Keep existing diagnostics even if EL check encounters an issue
        }
    }
    if (document.version !== undefined && document.version !== docVersion) {
        return;
    }
    jsfDiagnostics.set(document.uri, diagnostics);
}
function subscribeToDocumentChanges(context, jsfDiagnostics) {
    const debounceTimers = new Map();
    const debouncedRefresh = (doc) => {
        const key = doc.uri.toString();
        const existing = debounceTimers.get(key);
        if (existing) {
            clearTimeout(existing);
        }
        const timer = setTimeout(() => {
            debounceTimers.delete(key);
            refreshDiagnostics(doc, jsfDiagnostics);
        }, 250);
        debounceTimers.set(key, timer);
    };
    if (vscode.window.activeTextEditor) {
        refreshDiagnostics(vscode.window.activeTextEditor.document, jsfDiagnostics);
    }
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            refreshDiagnostics(editor.document, jsfDiagnostics);
        }
    }));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => debouncedRefresh(e.document)));
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(doc => {
        const key = doc.uri.toString();
        const existing = debounceTimers.get(key);
        if (existing) {
            clearTimeout(existing);
            debounceTimers.delete(key);
        }
        jsfDiagnostics.delete(doc.uri);
    }));
}
//# sourceMappingURL=JsfDiagnostics.js.map
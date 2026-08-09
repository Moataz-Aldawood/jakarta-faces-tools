import * as vscode from 'vscode';
import { JSF_CATALOG } from './jsfCatalog';
import { getCompositeNamespaces, resolveCompositeComponent, getCompositeAttributes } from './namespaceParser';
import { getActiveThirdPartyCatalogs } from './ThirdPartyCatalogs';
import { JsfElCompletionProvider, getSharedBeanMap, ElBeanMetadata } from './JsfElCompletionProvider';
import { findIterationVariableByName } from './iterationParser';
import { getEnclosingTag } from './tagParser';

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

export interface IElProvider {
    readFile(uri: vscode.Uri): Promise<string>;
    findPropertyTypeInContent(content: string, propertyName: string): string | null;
    findJavaClassUri?(className: string): Promise<vscode.Uri | null>;
}

export async function computeElDiagnostics(
    document: vscode.TextDocument,
    beanMap: Map<string, ElBeanMetadata>,
    elProvider: IElProvider
): Promise<vscode.Diagnostic[]> {
    const config = vscode.workspace && vscode.workspace.getConfiguration ? vscode.workspace.getConfiguration('jakartaFacesTools') : null;
    const scopeWarningsEnabled = config ? config.get<boolean>('enableScopeWarnings', true) : true;
    const docVersion = document.version;
    const diagnostics: vscode.Diagnostic[] = [];
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
            const iterVar = findIterationVariableByName(document, startPos, rootName);
            if (iterVar) {
                continue; // Valid iteration variable
            }

            // Check if rootName is a known Managed Bean
            if (!beanMap.has(rootName)) {
                const endPos = document.positionAt(chainOffset + rootName.length);
                const range = new vscode.Range(startPos, endPos);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Jakarta Faces: Unknown Managed Bean or EL variable '${rootName}'.`,
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.source = 'Jakarta Faces Tools';
                diagnostics.push(diagnostic);
                continue;
            }

            // If rootName IS a known Managed Bean, check for dangerous scope bindings and validate property chain
            if (parts.length >= 2) {
                const bean = beanMap.get(rootName)!;

                // Scope-Aware Best-Practice Check: Warn if binding a stateful data tag to @RequestScoped bean (experimental feature, disabled by default)
                if (scopeWarningsEnabled && bean.scope === '@RequestScoped') {
                    const enclosingTag = getEnclosingTag(document, startPos);
                    if (enclosingTag && STATEFUL_DATA_TAGS.has(enclosingTag.tagName)) {
                        const endPos = document.positionAt(chainOffset + rootName.length);
                        const range = new vscode.Range(startPos, endPos);
                        const diagnostic = new vscode.Diagnostic(
                            range,
                            `Jakarta Faces Best Practice: '<${enclosingTag.tagName}>' is bound to '@RequestScoped' bean '${rootName}'. Pagination, sorting, and state selection may fail on postback. Consider changing '${rootName}' to '@ViewScoped'.`,
                            vscode.DiagnosticSeverity.Information
                        );
                        diagnostic.source = 'Jakarta Faces Tools';
                        diagnostics.push(diagnostic);
                    }
                }

                let currentUri: vscode.Uri | null = bean.uri;
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
                        const diagnostic = new vscode.Diagnostic(
                            range,
                            `Jakarta Faces: Property '${propName}' not found in Managed Bean '${rootName}' (${currentClassName}).`,
                            vscode.DiagnosticSeverity.Warning
                        );
                        diagnostic.source = 'Jakarta Faces Tools';
                        diagnostics.push(diagnostic);
                        break; // Stop checking deeper segments if this property failed
                    }

                    // Move to the return type class for the next property segment in the chain
                    currentClassName = returnType;
                    if (elProvider.findJavaClassUri) {
                        currentUri = await elProvider.findJavaClassUri(returnType);
                    } else {
                        currentUri = null;
                    }
                    currentOffset += propName.length + 1; // +1 for '.'
                }
            }
        }
    }

    return diagnostics;
}

export async function refreshDiagnostics(document: vscode.TextDocument, jsfDiagnostics: vscode.DiagnosticCollection): Promise<void> {
    if (document.languageId !== 'jsf' && document.languageId !== 'html' && document.languageId !== 'xml' && document.languageId !== 'xhtml') {
        return;
    }
    
    // We only want to analyze files with jsf/xhtml extensions to avoid polluting pure xml/html files
    if (!document.fileName.endsWith('.xhtml') && !document.fileName.endsWith('.jsf')) {
        return;
    }

    const docVersion = document.version;
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();

    const config = vscode.workspace && vscode.workspace.getConfiguration ? vscode.workspace.getConfiguration('jakartaFacesTools') : null;
    const enableJSFDiagnostics = config ? config.get<boolean>('enableJSFDiagnostics', true) : true;

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
                const diagnostic = new vscode.Diagnostic(
                    range, 
                    "Unclosed Expression Language (EL) block. Missing '}'", 
                    vscode.DiagnosticSeverity.Error
                );
                diagnostic.source = 'Jakarta Faces Tools';
                diagnostics.push(diagnostic);
                
                // Move index forward to avoid infinite loop
                elIndex += 2;
            } else {
                // It's closed properly, move index past the closing bracket
                elIndex = nextClosing + 1;
            }
        }

        // 2. Check for unknown standard and 3rd-party tags
        const activeCatalogs = { ...JSF_CATALOG, ...getActiveThirdPartyCatalogs(text) };
        const compositeNamespaces = getCompositeNamespaces(text);
        const compositeCache = new Map<string, any>();
        
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
                    
                    const diagnostic = new vscode.Diagnostic(
                        range, 
                        `Unknown JSF tag '${fullTagName}'.`, 
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = 'Jakarta Faces Tools';
                    diagnostics.push(diagnostic);
                }
            }
        }

        // 3. Check for unknown attributes and missing required attributes
        const tagBodyRegex = /<([a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+)([\s\S]*?)>/g;
        let bodyMatch;
        while ((bodyMatch = tagBodyRegex.exec(text)) !== null) {
            const fullTagName = bodyMatch[1];
            const tagBody = bodyMatch[2];
            let tag = activeCatalogs[fullTagName];
            
            if (!tag) {
                const parts = fullTagName.split(':');
                if (parts.length === 2) {
                    const prefix = parts[0];
                    const baseName = parts[1];
                    const folder = compositeNamespaces[prefix];
                    if (folder) {
                        if (compositeCache.has(fullTagName)) {
                            tag = compositeCache.get(fullTagName);
                        } else {
                            const uri = await resolveCompositeComponent(folder, baseName);
                            if (uri) {
                                const attrs = await getCompositeAttributes(uri);
                                tag = {
                                    name: fullTagName,
                                    description: `Composite Component: ${baseName}`,
                                    attributes: attrs
                                } as any;
                                compositeCache.set(fullTagName, tag);
                            }
                        }
                    }
                }
            }
            
            if (tag) {
                // Find attributes: space followed by name="value" or name='value'
                const attrRegex = /\s+([a-zA-Z0-9_:-]+)\s*=\s*(['"])([\s\S]*?)\2/g;
                let attrMatch;
                
                const validAttrs = new Set(tag.attributes.map(a => a.name));
                const providedAttrs = new Set<string>();
                
                // Global standard attributes
                validAttrs.add('id');
                validAttrs.add('rendered');
                validAttrs.add('binding');
                
                while ((attrMatch = attrRegex.exec(tagBody)) !== null) {
                    const attrName = attrMatch[1];
                    providedAttrs.add(attrName);
                    
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
                        
                        const diagnostic = new vscode.Diagnostic(
                            range, 
                            `Unknown attribute '${attrName}' for tag '${fullTagName}'.`, 
                            vscode.DiagnosticSeverity.Warning
                        );
                        diagnostic.source = 'Jakarta Faces Tools';
                        diagnostics.push(diagnostic);
                    }
                }

                // Check for missing required attributes
                const requiredAttrs = tag.attributes.filter(a => a.required);
                for (const reqAttr of requiredAttrs) {
                    if (!providedAttrs.has(reqAttr.name)) {
                        const startPos = document.positionAt(bodyMatch.index + 1); // +1 to skip <
                        const endPos = document.positionAt(bodyMatch.index + 1 + fullTagName.length);
                        const range = new vscode.Range(startPos, endPos);
                        
                        const diagnostic = new vscode.Diagnostic(
                            range,
                            `The required attribute '${reqAttr.name}' is missing.`,
                            vscode.DiagnosticSeverity.Warning
                        );
                        diagnostic.source = 'Jakarta Faces Tools';
                        diagnostics.push(diagnostic);
                    }
                }
            }
        }
    }

    // 4. Check for EL Semantic Validation (unknown Managed Beans and mistyped properties)
    const enableELDiagnostics = config ? config.get<boolean>('enableELDiagnostics', true) : true;
    if (enableELDiagnostics) {
        try {
            const elProvider = new JsfElCompletionProvider();
            await elProvider.ensureBeansCached();
            if (document.version !== undefined && document.version !== docVersion) {
                return;
            }
            const beanMap = getSharedBeanMap();
            const elDiagnostics = await computeElDiagnostics(document, beanMap, elProvider);
            if (document.version !== undefined && document.version !== docVersion) {
                return;
            }
            diagnostics.push(...elDiagnostics);
        } catch (e) {
            // Keep existing diagnostics even if EL check encounters an issue
        }
    }

    if (document.version !== undefined && document.version !== docVersion) {
        return;
    }
    jsfDiagnostics.set(document.uri, diagnostics);
}

export function subscribeToDocumentChanges(context: vscode.ExtensionContext, jsfDiagnostics: vscode.DiagnosticCollection): void {
    const debounceTimers = new Map<string, NodeJS.Timeout>();
    const debouncedRefresh = (doc: vscode.TextDocument) => {
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
    
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                refreshDiagnostics(editor.document, jsfDiagnostics);
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(e => debouncedRefresh(e.document))
    );

    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(doc => {
            const key = doc.uri.toString();
            const existing = debounceTimers.get(key);
            if (existing) {
                clearTimeout(existing);
                debounceTimers.delete(key);
            }
            const config = vscode.workspace.getConfiguration('jakartaFacesTools');
            const validateAll = config.get<boolean>('validateEntireWorkspace', false);
            if (!validateAll) {
                jsfDiagnostics.delete(doc.uri);
            }
        })
    );
}

export async function scanEntireWorkspace(jsfDiagnostics: vscode.DiagnosticCollection): Promise<void> {
    const files = await vscode.workspace.findFiles('**/*.{xhtml,jsf}', '**/node_modules/**');
    if (files.length === 0) {
        vscode.window.showInformationMessage('No JSF files found in workspace.');
        return;
    }
    
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Scanning JSF Workspace",
        cancellable: true
    }, async (progress, token) => {
        let count = 0;
        for (const uri of files) {
            if (token.isCancellationRequested) {
                break;
            }
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                refreshDiagnostics(doc, jsfDiagnostics);
            } catch (e) {
                console.error(`Failed to scan ${uri.fsPath}`, e);
            }
            count++;
            progress.report({ 
                increment: 100 / files.length, 
                message: `Parsed ${count}/${files.length} files` 
            });
        }
    });
}

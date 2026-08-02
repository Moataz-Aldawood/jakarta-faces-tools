const assert = require('assert');
const Module = require('module');
const path = require('path');

// Mock vscode module for standalone node testing
class MockCompletionItem {
    constructor(label, kind) {
        if (typeof label === 'object') {
            this.label = label.label;
            this.description = label.description;
        } else {
            this.label = label;
        }
        this.kind = kind;
    }
}

class MockMarkdownString {
    constructor(val = '') {
        this.value = val;
    }
    appendMarkdown(val) {
        this.value += val;
        return this;
    }
    appendCodeblock(val, lang) {
        this.value += `\n\`\`\`${lang || ''}\n${val}\n\`\`\`\n`;
        return this;
    }
}

class MockDiagnostic {
    constructor(range, message, severity) {
        this.range = range;
        this.message = message;
        this.severity = severity;
    }
}

const mockVscode = {
    CompletionItem: MockCompletionItem,
    CompletionItemKind: {
        Reference: 1,
        Variable: 2,
        Snippet: 3,
        Property: 4,
        Method: 5,
        Class: 6
    },
    MarkdownString: MockMarkdownString,
    SnippetString: class {
        constructor(val) {
            this.value = val;
        }
    },
    Uri: {
        file: (path) => ({ fsPath: path, toString: () => path })
    },
    Range: class {
        constructor(startLine, startChar, endLine, endChar) {
            if (typeof startLine === 'object' && typeof startChar === 'object') {
                this.start = startLine;
                this.end = startChar;
            } else {
                this.start = { line: startLine, character: startChar };
                this.end = { line: endLine, character: endChar };
            }
        }
    },
    Position: class {
        constructor(line, char) {
            this.line = line;
            this.character = char;
        }
    },
    Hover: class {
        constructor(contents, range) {
            this.contents = contents;
            this.range = range;
        }
    },
    Diagnostic: MockDiagnostic,
    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3
    },
    workspace: {
        getConfiguration: () => ({ get: (k, d) => d }),
        findFiles: async () => [],
        asRelativePath: (uri) => uri.fsPath || uri.toString(),
        createFileSystemWatcher: () => ({
            onDidCreate: () => {},
            onDidChange: () => {},
            onDidDelete: () => {}
        })
    },
    window: {
        showInformationMessage: () => {}
    }
};

// Intercept require('vscode')
const originalRequire = Module.prototype.require;
Module.prototype.require = function(path) {
    if (path === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, arguments);
};

// Load compiled TS modules
const elProviderModule = require('./out/providers/JsfElCompletionProvider');
const diagModule = require('./out/providers/JsfDiagnostics');

console.log('==============================================');
console.log('RUNNING MANAGED BEAN SCOPE AWARENESS & LIFECYCLE TESTS');
console.log('==============================================');

// Test 1: extractBeanScope for @ViewScoped
console.log('Testing extractBeanScope for @ViewScoped...');
const viewScopedJava = `
package com.example;
import jakarta.faces.view.ViewScoped;
import jakarta.inject.Named;

@Named("userBean")
@ViewScoped
public class UserBean {
}
`;
const viewScopeInfo = elProviderModule.extractBeanScope(viewScopedJava);
assert.strictEqual(viewScopeInfo.scope, '@ViewScoped');
assert.strictEqual(viewScopeInfo.scopePackage, 'jakarta.faces.view.ViewScoped');
console.log('  [PASS] Correctly extracted @ViewScoped and package.');

// Test 2: extractBeanScope for @RequestScoped
console.log('Testing extractBeanScope for @RequestScoped...');
const reqScopedJava = `
package com.example;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Named;

@Named("reqBean")
@RequestScoped
public class ReqBean {
}
`;
const reqScopeInfo = elProviderModule.extractBeanScope(reqScopedJava);
assert.strictEqual(reqScopeInfo.scope, '@RequestScoped');
assert.strictEqual(reqScopeInfo.scopePackage, 'jakarta.enterprise.context.RequestScoped');
console.log('  [PASS] Correctly extracted @RequestScoped and package.');

// Test 3: getScopeBadge and getScopeLifecycleDescription
console.log('Testing scope badges and lifecycle descriptions...');
assert.strictEqual(elProviderModule.getScopeBadge('@ViewScoped'), '🟢 @ViewScoped');
assert.strictEqual(elProviderModule.getScopeBadge('@RequestScoped'), '🟡 @RequestScoped');
assert.strictEqual(elProviderModule.getScopeBadge('@SessionScoped'), '🔵 @SessionScoped');
assert.ok(elProviderModule.getScopeLifecycleDescription('@ViewScoped').includes('AJAX postbacks'));
console.log('  [PASS] Badges and lifecycle descriptions match standards.');

// Test 4: Scope-Aware Best-Practice Diagnostic for @RequestScoped bound to <p:dataTable>
console.log('Testing Scope-Aware Best-Practice Diagnostic for <p:dataTable value="#{reqBean.list}">...');
async function testBestPracticeDiagnostic() {
    elProviderModule.rebuildJsfCache(false);
    elProviderModule.setCacheInitializedForTest(true);

    const beanMap = elProviderModule.getSharedBeanMap();
    beanMap.set('reqBean', {
        beanName: 'reqBean',
        className: 'ReqBean',
        scope: '@RequestScoped',
        scopePackage: 'jakarta.enterprise.context.RequestScoped',
        uri: { fsPath: '/path/to/ReqBean.java' },
        properties: []
    });

    const mockDoc = {
        version: 1,
        getText: () => '<p:dataTable value="#{reqBean.list}" var="item">',
        positionAt: (offset) => ({ line: 0, character: offset }),
        offsetAt: (pos) => pos.character,
        lineAt: (line) => ({ text: '<p:dataTable value="#{reqBean.list}" var="item">' })
    };

    const mockElProvider = {
        readFile: async () => 'public class ReqBean { public java.util.List getList() { return null; } }',
        findPropertyTypeInContent: () => 'java.util.List',
        findJavaClassUri: async () => null
    };

    const diagnostics = await diagModule.computeElDiagnostics(mockDoc, beanMap, mockElProvider);
    const bestPracticeDiag = diagnostics.find(d => d.message && d.message.includes('Jakarta Faces Best Practice'));
    assert.ok(bestPracticeDiag, 'Expected Best Practice diagnostic warning for @RequestScoped bean bound to <p:dataTable>');
    assert.ok(bestPracticeDiag.message.includes('@RequestScoped'), 'Diagnostic message should mention @RequestScoped');
    assert.ok(bestPracticeDiag.message.includes('reqBean'), 'Diagnostic message should mention bean name');
    console.log('  [PASS] Correctly emitted Scope-Aware Best-Practice warning for stateful component binding.');
}

testBestPracticeDiagnostic().then(() => {
    console.log('==============================================');
    console.log('ALL BEAN SCOPE AWARENESS & LIFECYCLE TESTS PASSED! ☕');
    console.log('==============================================');
}).catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
});

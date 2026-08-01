const assert = require('assert');
const Module = require('module');

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

const mockVscode = {
    CompletionItem: MockCompletionItem,
    CompletionItemKind: {
        Reference: 1,
        Variable: 2,
        Snippet: 3,
        Property: 4,
        Method: 5
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
            this.start = { line: startLine, character: startChar };
            this.end = { line: endLine, character: endChar };
        }
    },
    Position: class {
        constructor(line, char) {
            this.line = line;
            this.character = char;
        }
    },
    workspace: {
        getConfiguration: () => ({ get: (k, d) => d }),
        asRelativePath: (uri) => uri && uri.fsPath ? uri.fsPath : String(uri),
        findFiles: async () => [],
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

// Import providers after mocking vscode
const { JsfCompletionProvider } = require('./out/providers/JsfCompletionProvider');
const { JsfElCompletionProvider, getSharedBeanMap, setCacheInitializedForTest } = require('./out/providers/JsfElCompletionProvider');

class MockTextDocument {
    constructor(text) {
        this.text = text;
        this.lines = text.split(/\r?\n/);
    }
    getText() {
        return this.text;
    }
    lineAt(line) {
        const lineNum = typeof line === 'object' ? line.line : line;
        return {
            text: this.lines[lineNum] || '',
            lineNumber: lineNum
        };
    }
    positionAt(offset) {
        let currentOffset = 0;
        for (let line = 0; line < this.lines.length; line++) {
            const lineLen = this.lines[line].length + 1;
            if (currentOffset + lineLen > offset) {
                return new mockVscode.Position(line, offset - currentOffset);
            }
            currentOffset += lineLen;
        }
        return new mockVscode.Position(this.lines.length - 1, 0);
    }
    offsetAt(position) {
        let offset = 0;
        for (let i = 0; i < position.line && i < this.lines.length; i++) {
            offset += this.lines[i].length + 1;
        }
        return offset + position.character;
    }
}

async function runTests() {
    console.log('==============================================');
    console.log('RUNNING IMMEDIATE QUOTE AUTOCOMPLETE TESTS');
    console.log('==============================================');

    // Setup dummy beans in cache for EL testing
    const beanMap = getSharedBeanMap();
    beanMap.clear();
    beanMap.set('userController', {
        className: 'UserController',
        uri: mockVscode.Uri.file('/src/UserController.java')
    });
    beanMap.set('orderService', {
        className: 'OrderService',
        uri: mockVscode.Uri.file('/src/OrderService.java')
    });
    setCacheInitializedForTest(true);

    const jsfProvider = new JsfCompletionProvider();
    const elProvider = new JsfElCompletionProvider();

    // Mock document with ID definitions
    const mockDocument = new MockTextDocument(
        `<h:form id="myForm">\n` +
        `  <h:inputText id="username" />\n` +
        `  <h:outputLabel for="" />\n` +
        `  <h:outputText value="" />\n` +
        `  <h:outputText value="#{" />\n` +
        `  <h:inputText id="" />\n` +
        `</h:form>`
    );

    // Test 1: Immediate ID completion in for="..." after quote without typing 1st letter
    console.log('Testing immediate component ID autocomplete after for="..." quote...');
    const idResults = await jsfProvider.provideCompletionItems(
        mockDocument,
        new mockVscode.Position(2, 22), // end of `  <h:outputLabel for="`
        null,
        {}
    );
    assert.ok(Array.isArray(idResults), 'Expected array of CompletionItem for ID completion');
    const idLabels = idResults.map(r => r.label);
    assert.ok(idLabels.includes('myForm') && idLabels.includes('username'), `Expected myForm and username IDs, got: ${idLabels.join(', ')}`);
    console.log('  [PASS] Component IDs returned immediately after for="..." quote.');

    // Test 2: Immediate EL Snippet completion in value="..." after quote
    console.log('Testing immediate EL Snippet autocomplete after value="..." quote...');
    const elSnippetResults = await elProvider.provideCompletionItems(
        mockDocument,
        new mockVscode.Position(3, 23), // end of `  <h:outputText value="`
        null,
        {}
    );
    assert.ok(Array.isArray(elSnippetResults), 'Expected array of CompletionItem for EL Snippets');
    const snippetLabels = elSnippetResults.map(r => r.label);
    assert.ok(snippetLabels.includes('#{userController}') && snippetLabels.includes('#{orderService}'),
        `Expected #{userController} and #{orderService}, got: ${snippetLabels.join(', ')}`);
    const userSnippet = elSnippetResults.find(r => r.label === '#{userController}');
    assert.strictEqual(userSnippet.insertText, '#{userController}', 'Expected insertText to be full #{userController} snippet');
    assert.strictEqual(userSnippet.filterText, 'userController #{userController}', 'Expected filterText to support both direct and #{ typed prefixes');
    console.log('  [PASS] EL Snippets returned immediately after value="..." quote.');

    // Test 3: Exclude EL Snippets on non-EL attributes like id="..." or for="..."
    console.log('Testing exclusion of EL Snippets on id="..." attributes...');
    const excludedResults = await elProvider.provideCompletionItems(
        mockDocument,
        new mockVscode.Position(5, 19), // end of `  <h:inputText id="`
        null,
        {}
    );
    assert.strictEqual(excludedResults, undefined, 'Expected undefined for id="..." attribute in EL completion');
    console.log('  [PASS] EL Snippets correctly bypassed for id="..." and for="..." attributes.');

    // Test 4: Immediate root bean completion inside #{...} after '{'
    console.log('Testing immediate root bean completion inside #{...}...');
    const rootElResults = await elProvider.provideCompletionItems(
        mockDocument,
        new mockVscode.Position(4, 25), // end of `  <h:outputText value="#{"`
        null,
        {}
    );
    assert.ok(Array.isArray(rootElResults), 'Expected array of root beans inside #{...}');
    const rootLabels = rootElResults.map(r => r.label);
    assert.ok(rootLabels.includes('userController') && rootLabels.includes('orderService'),
        `Expected userController and orderService, got: ${rootLabels.join(', ')}`);
    const userBeanItem = rootElResults.find(r => r.label === 'userController');
    assert.strictEqual(userBeanItem.insertText, 'userController', 'Expected insertText inside #{...} to be raw beanName without extra #{');
    console.log('  [PASS] Root beans returned immediately after "{".');

    console.log('==============================================');
    console.log('ALL IMMEDIATE AUTOCOMPLETE TESTS PASSED! ☕');
    console.log('==============================================');
}

runTests().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});

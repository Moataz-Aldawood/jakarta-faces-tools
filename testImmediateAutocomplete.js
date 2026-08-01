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

    // Test 1b: Verify attribute completion items automatically re-trigger IntelliSense when inserted
    console.log('Testing attribute completion items for automatic triggerSuggest command...');
    const attrDocument = new MockTextDocument(`<h:outputLabel `);
    const attrResults = await jsfProvider.provideCompletionItems(
        attrDocument,
        new mockVscode.Position(0, 15),
        null,
        {}
    );
    assert.ok(Array.isArray(attrResults), 'Expected array of attribute completion items');
    const forAttr = attrResults.find(r => r.label === 'for');
    assert.ok(forAttr, 'Expected "for" attribute in completion list');
    assert.strictEqual(forAttr.command.command, 'editor.action.triggerSuggest', 'Expected editor.action.triggerSuggest command on attribute completion');
    console.log('  [PASS] Attribute completion items include triggerSuggest command.');

    // Test 2: Ensure EL autocomplete does NOT trigger on attribute quotes (only on #{ or ${)
    console.log('Testing exclusion of EL autocomplete after attribute quotes...');
    const noQuoteElResults = await elProvider.provideCompletionItems(
        mockDocument,
        new mockVscode.Position(3, 23), // end of `  <h:outputText value="`
        null,
        {}
    );
    assert.strictEqual(noQuoteElResults, undefined, 'Expected undefined for attribute quote in EL completion (only triggers on #{ or ${)');
    console.log('  [PASS] EL autocomplete correctly ignores attribute quotes.');

    // Test 3: Immediate root bean completion inside #{...} after '{' with Class icon and cursor positioning
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
    assert.strictEqual(userBeanItem.kind, mockVscode.CompletionItemKind.Class, 'Expected Managed Bean to use Class icon');
    assert.strictEqual(userBeanItem.insertText.value, 'userController$0', 'Expected insertText to be SnippetString positioning cursor $0 before closing brace');
    assert.ok(userBeanItem.documentation.value.includes('*$(coffee) Jakarta Faces Tools*'), 'Expected signature at the bottom of markdown documentation');
    console.log('  [PASS] Root beans returned immediately after "{" with Class icon, SnippetString positioning, and signature.');

    console.log('==============================================');
    console.log('ALL IMMEDIATE AUTOCOMPLETE TESTS PASSED! ☕');
    console.log('==============================================');
}

runTests().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});

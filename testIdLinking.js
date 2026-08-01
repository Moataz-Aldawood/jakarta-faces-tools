const assert = require('assert');
const Module = require('module');

// Mock vscode module
const mockVscode = {
    Range: class Range {
        constructor(startLine, startCol, endLine, endCol) {
            if (typeof startLine === 'object') {
                this.start = startLine;
                this.end = startCol;
            } else {
                this.start = { line: startLine, character: startCol };
                this.end = { line: endLine, character: endCol };
            }
        }
    },
    Position: class Position {
        constructor(line, character) {
            this.line = line;
            this.character = character;
        }
    },
    DocumentHighlight: class DocumentHighlight {
        constructor(range, kind) {
            this.range = range;
            this.kind = kind;
        }
    },
    DocumentHighlightKind: {
        Text: 0,
        Read: 1,
        Write: 2
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

// Mock vscode text document
class MockTextDocument {
    constructor(text) {
        this.text = text;
        this.lines = text.split(/\r?\n/);
    }
    getText() {
        return this.text;
    }
    lineAt(line) {
        return {
            text: this.lines[line],
            lineNumber: line
        };
    }
    positionAt(offset) {
        let currentOffset = 0;
        for (let line = 0; line < this.lines.length; line++) {
            const lineLen = this.lines[line].length + 1; // +1 for newline
            if (currentOffset + lineLen > offset) {
                return { line: line, character: offset - currentOffset };
            }
            currentOffset += lineLen;
        }
        return { line: this.lines.length - 1, character: 0 };
    }
}

const {
    stripXmlComments,
    findComponentIds,
    findComponentReferences,
    getIdOrForAtPosition,
    JsfIdHighlightProvider
} = require('./out/providers/JsfIdHighlightProvider');

function testStripXmlComments() {
    console.log('Testing stripXmlComments...');
    const input = `<!-- comment line 1\ncomment line 2 -->\n<h:inputText id="usr" />`;
    const stripped = stripXmlComments(input);
    const lines = stripped.split('\n');
    assert.strictEqual(lines.length, 3, 'Line count must remain identical');
    assert.ok(lines[2].includes('<h:inputText id="usr" />'), 'Actual XML code must remain intact');
    console.log('  [PASS] stripXmlComments works correctly.');
}

function testFindComponentIdsAndReferences() {
    console.log('Testing findComponentIds and findComponentReferences...');
    const xhtml = `
<html xmlns:h="http://xmlns.jcp.org/jsf/html"
      xmlns:p="http://primefaces.org/ui">
    <!-- <h:inputText id="ignoredId" /> -->
    <h:outputLabel for="usernameInput" value="User:" />
    <h:inputText
        id="usernameInput"
        value="#{user.name}" />
    <p:message for="usernameInput" />
    <p:button target="modalDialog" />
    <p:dialog id="modalDialog" />
</html>
`;
    const doc = new MockTextDocument(xhtml);
    const ids = findComponentIds(doc);
    assert.strictEqual(ids.length, 2, 'Should find 2 active IDs (ignoring commented ID)');
    assert.strictEqual(ids[0].id, 'usernameInput');
    assert.strictEqual(ids[0].tagName, 'h:inputText');
    assert.strictEqual(ids[1].id, 'modalDialog');
    assert.strictEqual(ids[1].tagName, 'p:dialog');

    const refs = findComponentReferences(doc);
    assert.strictEqual(refs.length, 3, 'Should find 3 references (2 for, 1 target)');
    assert.strictEqual(refs[0].refId, 'usernameInput');
    assert.strictEqual(refs[0].attrName, 'for');
    assert.strictEqual(refs[0].tagName, 'h:outputLabel');
    assert.strictEqual(refs[1].refId, 'usernameInput');
    assert.strictEqual(refs[1].tagName, 'p:message');
    assert.strictEqual(refs[2].refId, 'modalDialog');
    assert.strictEqual(refs[2].attrName, 'target');
    console.log('  [PASS] ID and Reference extraction works correctly.');
}

function testHighlightProvider() {
    console.log('Testing JsfIdHighlightProvider...');
    const xhtml = `<h:outputLabel for="username" />\n<h:inputText id="username" />`;
    const doc = new MockTextDocument(xhtml);
    const provider = new JsfIdHighlightProvider();

    // Cursor on 'username' in <h:outputLabel for="username" /> (line 0, col 21)
    const highlights = provider.provideDocumentHighlights(doc, { line: 0, character: 21 });
    assert.ok(highlights, 'Should return highlights');
    assert.strictEqual(highlights.length, 2, 'Should highlight both for="username" and id="username"');
    assert.strictEqual(highlights[0].kind, mockVscode.DocumentHighlightKind.Write, 'ID declaration highlighted as Write');
    assert.strictEqual(highlights[1].kind, mockVscode.DocumentHighlightKind.Read, 'ID reference highlighted as Read');
    console.log('  [PASS] DocumentHighlightProvider works correctly.');
}

function runTests() {
    console.log('==============================================');
    console.log('RUNNING COMPONENT LINKING & NAVIGATION TESTS');
    console.log('==============================================');
    testStripXmlComments();
    testFindComponentIdsAndReferences();
    testHighlightProvider();
    console.log('==============================================');
    console.log('ALL TESTS PASSED SUCCESSFULLY! ☕');
    console.log('==============================================');
}

runTests();

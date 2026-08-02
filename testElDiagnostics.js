const assert = require('assert');
const Module = require('module');

const mockConfig = {};
const mockVscode = {
    workspace: {
        getConfiguration: () => ({
            get: (key, defVal) => mockConfig[key] !== undefined ? mockConfig[key] : defVal
        })
    },
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
    Diagnostic: class Diagnostic {
        constructor(range, message, severity) {
            this.range = range;
            this.message = message;
            this.severity = severity;
        }
    },
    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3
    },
    Uri: {
        file: (path) => ({ fsPath: path, toString: () => path })
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
    offsetAt(position) {
        let offset = 0;
        for (let i = 0; i < position.line && i < this.lines.length; i++) {
            offset += this.lines[i].length + 1; // +1 for newline
        }
        return offset + position.character;
    }
}

const { computeElDiagnostics, refreshDiagnostics } = require('./out/providers/JsfDiagnostics');

// Mock Managed Bean map
const mockBeanMap = new Map();
mockBeanMap.set('userController', {
    beanName: 'userController',
    className: 'UserController',
    uri: { fsPath: '/path/to/UserController.java' },
    properties: []
});
mockBeanMap.set('qrDesignTemplate', {
    beanName: 'qrDesignTemplate',
    className: 'QrDesignTemplate',
    uri: { fsPath: '/path/to/QrDesignTemplate.java' },
    properties: []
});

// Mock IElProvider
const mockElProvider = {
    async readFile(uri) {
        if (uri.fsPath === '/path/to/QrDesignTemplate.java') {
            return `
                public class QrDesignTemplate {
                    public QrCodeDesignTemplate getQrCodeDesignTemplate() { return null; }
                }
            `;
        }
        if (uri.fsPath === '/path/to/QrCodeDesignTemplate.java') {
            return `
                public class QrCodeDesignTemplate {
                    public String getValidProp() { return ""; }
                }
            `;
        }
        return `
            public class UserController {
                private String name;
                public String getName() { return name; }
                public void setName(String name) { this.name = name; }
            }
        `;
    },
    findPropertyTypeInContent(content, propertyName) {
        if (propertyName === 'name' || propertyName === 'getName') {
            return 'String';
        }
        if (propertyName === 'qrCodeDesignTemplate' || propertyName === 'getQrCodeDesignTemplate') {
            return 'QrCodeDesignTemplate';
        }
        if (propertyName === 'validProp' || propertyName === 'getValidProp') {
            return 'String';
        }
        return null;
    },
    async findJavaClassUri(className) {
        if (className === 'QrCodeDesignTemplate') {
            return { fsPath: '/path/to/QrCodeDesignTemplate.java' };
        }
        return null;
    }
};

async function testImplicitObjects() {
    console.log('Testing whitelisted implicit objects and keywords...');
    const xhtml = `<h:outputText value="#{param.id} #{true} #{not empty requestScope.foo}" />`;
    const doc = new MockTextDocument(xhtml);
    const diags = await computeElDiagnostics(doc, mockBeanMap, mockElProvider);
    assert.strictEqual(diags.length, 0, 'Whitelisted implicit objects must produce 0 warnings');
    console.log('  [PASS] Whitelisted implicit objects and keywords produce 0 warnings.');
}

async function testUnknownRootBean() {
    console.log('Testing unknown root Managed Bean name...');
    const xhtml = `<h:outputText value="#{unknownBean.property}" />`;
    const doc = new MockTextDocument(xhtml);
    const diags = await computeElDiagnostics(doc, mockBeanMap, mockElProvider);
    assert.strictEqual(diags.length, 1, 'Unknown root bean must produce 1 warning');
    assert.ok(
        diags[0].message.includes("Unknown Managed Bean or EL variable 'unknownBean'"),
        'Must contain unknown bean message'
    );
    console.log('  [PASS] Unknown root bean correctly flagged with Warning.');
}

async function testUnknownBeanProperty() {
    console.log('Testing unknown property on known Managed Bean...');
    const xhtml = `<h:outputText value="#{userController.unknownProp}" />`;
    const doc = new MockTextDocument(xhtml);
    const diags = await computeElDiagnostics(doc, mockBeanMap, mockElProvider);
    assert.strictEqual(diags.length, 1, 'Unknown property must produce 1 warning');
    assert.ok(
        diags[0].message.includes("Property 'unknownProp' not found in Managed Bean 'userController' (UserController)"),
        'Must contain property not found message'
    );
    console.log('  [PASS] Mistyped property name correctly flagged with Warning.');
}

async function testValidBeanProperty() {
    console.log('Testing valid property on known Managed Bean...');
    const xhtml = `<h:outputText value="#{userController.name}" />`;
    const doc = new MockTextDocument(xhtml);
    const diags = await computeElDiagnostics(doc, mockBeanMap, mockElProvider);
    assert.strictEqual(diags.length, 0, 'Valid property must produce 0 warnings');
    console.log('  [PASS] Valid property produces 0 warnings.');
}

async function testIterationVariable() {
    console.log('Testing iteration variable (var="u") in scope...');
    const xhtml = `
        <ui:repeat value="#{userController.name}" var="u">
            <h:outputText value="#{u}" />
        </ui:repeat>
    `;
    const doc = new MockTextDocument(xhtml);
    const diags = await computeElDiagnostics(doc, mockBeanMap, mockElProvider);
    assert.strictEqual(diags.length, 0, 'Iteration var u must produce 0 warnings');
    console.log('  [PASS] Iteration variable u recognized in scope.');
}

async function testDeepNestedUnknownProperty() {
    console.log('Testing deep nested unknown property on known Managed Bean...');
    const xhtml = `<h:outputText value="#{qrDesignTemplate.qrCodeDesignTemplate.relativeSquareBorderRoundxxxx}" />`;
    const doc = new MockTextDocument(xhtml);
    const diags = await computeElDiagnostics(doc, mockBeanMap, mockElProvider);
    assert.strictEqual(diags.length, 1, 'Deep unknown property must produce 1 warning');
    assert.ok(
        diags[0].message.includes("Property 'relativeSquareBorderRoundxxxx' not found in Managed Bean 'qrDesignTemplate' (QrCodeDesignTemplate)"),
        'Must contain deep property not found message'
    );
    console.log('  [PASS] Deep mistyped property name correctly flagged with Warning.');
}

async function testEnableJSFDiagnosticsToggle() {
    console.log('Testing jakartaFacesTools.enableJSFDiagnostics toggle setting...');
    const xhtml = `<h:unknownJsfTag />`;
    const doc = new MockTextDocument(xhtml);
    doc.languageId = 'html';
    doc.fileName = 'test.xhtml';
    doc.uri = { toString: () => 'file:///test.xhtml' };

    let storedDiags = [];
    const mockDiagnosticsCollection = {
        set(uri, diags) { storedDiags = diags; }
    };

    delete mockConfig.enableJSFDiagnostics;
    await refreshDiagnostics(doc, mockDiagnosticsCollection);
    assert.ok(storedDiags.some(d => d.message.includes("Unknown JSF tag")), 'Expected tag warning when enableJSFDiagnostics is true');

    mockConfig.enableJSFDiagnostics = false;
    await refreshDiagnostics(doc, mockDiagnosticsCollection);
    assert.strictEqual(storedDiags.filter(d => d.message.includes("Unknown JSF tag")).length, 0, 'Expected 0 tag warnings when enableJSFDiagnostics is false');

    mockConfig.enableJSFDiagnostics = true;
    console.log('  [PASS] jakartaFacesTools.enableJSFDiagnostics setting toggles JSF tag/attribute diagnostics correctly.');
}

async function runAllTests() {
    console.log('==============================================');
    console.log('RUNNING EL SEMANTIC VALIDATION DIAGNOSTICS TESTS');
    console.log('==============================================');
    await testImplicitObjects();
    await testUnknownRootBean();
    await testUnknownBeanProperty();
    await testValidBeanProperty();
    await testIterationVariable();
    await testDeepNestedUnknownProperty();
    await testEnableJSFDiagnosticsToggle();
    console.log('==============================================');
    console.log('ALL EL DIAGNOSTIC TESTS PASSED SUCCESSFULLY! ☕');
    console.log('==============================================');
}

runAllTests().catch(e => {
    console.error('TEST FAILED:', e);
    process.exit(1);
});

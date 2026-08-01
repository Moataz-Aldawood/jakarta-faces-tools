const assert = require('assert');
const Module = require('module');

// Mock vscode module
const mockVscode = {
    Uri: {
        file: (path) => ({ fsPath: path, toString: () => path })
    },
    workspace: {
        getConfiguration: () => ({ get: (k, d) => d }),
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

const {
    JsfElCompletionProvider
} = require('./out/providers/JsfElCompletionProvider');

async function runTests() {
    console.log('==============================================');
    console.log('RUNNING LOMBOK ANNOTATION SUPPORT TESTS');
    console.log('==============================================');

    const provider = new JsfElCompletionProvider();

    // 1. Test class-level @Data annotation
    console.log('Testing class-level @Data annotation...');
    const dataClassContent = `
        package com.example;
        import lombok.Data;
        import jakarta.inject.Named;
        import java.util.List;

        @Data
        @Named("userBean")
        public class UserController {
            private String username;
            private boolean active;
            private Boolean verified;
            private int loginCount;
            public static final String IGNORED_CONSTANT = "ignore_me";
        }
    `;

    const dataProperties = provider.extractClassPropertiesAndMethods(dataClassContent);
    const propMap = new Map(dataProperties.map(p => [p.name, p]));

    assert.strictEqual(propMap.has('username'), true, 'username should be extracted from @Data class.');
    assert.strictEqual(propMap.get('username').type, 'String', 'username type should be String.');
    assert.strictEqual(propMap.get('username').description, 'getter: getUsername() (Lombok)', 'Should include Lombok description.');

    assert.strictEqual(propMap.has('active'), true, 'boolean active should be extracted.');
    assert.strictEqual(propMap.get('active').type, 'boolean', 'active type should be boolean.');
    assert.strictEqual(propMap.get('active').description, 'getter: isActive() (Lombok)', 'primitive boolean should use isActive().');

    assert.strictEqual(propMap.has('verified'), true, 'Boolean verified should be extracted.');
    assert.strictEqual(propMap.get('verified').description, 'getter: getVerified() (Lombok)', 'boxed Boolean should use getVerified().');

    assert.strictEqual(propMap.has('loginCount'), true, 'int loginCount should be extracted.');
    assert.strictEqual(propMap.has('IGNORED_CONSTANT'), false, 'static fields should be ignored.');
    console.log('  [PASS] Class-level @Data extracted properties correctly.');

    // 2. Test class-level @Getter and @Builder
    console.log('Testing class-level @Getter annotation with generics...');
    const getterClassContent = `
        package com.example;
        import lombok.Getter;
        import jakarta.inject.Named;
        import java.util.Map;

        @Getter
        @Named("orderBean")
        public class OrderController {
            private String orderId;
            private Map<String, Object> metadata;
        }
    `;

    const getterProperties = provider.extractClassPropertiesAndMethods(getterClassContent);
    const getterMap = new Map(getterProperties.map(p => [p.name, p]));

    assert.strictEqual(getterMap.has('orderId'), true, 'orderId should be extracted.');
    assert.strictEqual(getterMap.has('metadata'), true, 'metadata should be extracted.');
    assert.strictEqual(getterMap.get('metadata').type, 'Map<String, Object>', 'metadata type should retain generics in autocomplete.');
    console.log('  [PASS] Class-level @Getter extracted properties cleanly.');

    // 3. Test field-level @Getter annotation on a plain class
    console.log('Testing field-level @Getter on specific fields without class-level Lombok...');
    const mixedClassContent = `
        package com.example;
        import lombok.Getter;

        public class MixedBean {
            @Getter
            private String publicEmail;

            private String secretPassword;
        }
    `;

    const mixedProperties = provider.extractClassPropertiesAndMethods(mixedClassContent);
    const mixedMap = new Map(mixedProperties.map(p => [p.name, p]));

    assert.strictEqual(mixedMap.has('publicEmail'), true, 'publicEmail with field-level @Getter should be extracted.');
    assert.strictEqual(mixedMap.has('secretPassword'), false, 'secretPassword without @Getter should NOT be extracted.');
    console.log('  [PASS] Field-level @Getter selective extraction works correctly.');

    // 4. Test findPropertyTypeInContent with Lombok fields (for EL diagnostics / hover)
    console.log('Testing findPropertyTypeInContent for Lombok fields...');
    const diagType1 = provider.findPropertyTypeInContent(dataClassContent, 'username');
    assert.strictEqual(diagType1, 'String', 'findPropertyTypeInContent should resolve username to String.');

    const diagType2 = provider.findPropertyTypeInContent(dataClassContent, 'active');
    assert.strictEqual(diagType2, 'boolean', 'findPropertyTypeInContent should resolve active to boolean.');

    const diagType3 = provider.findPropertyTypeInContent(getterClassContent, 'metadata');
    assert.strictEqual(diagType3, 'Object', 'findPropertyTypeInContent should extract base type Object from Map<String, Object>.');
    console.log('  [PASS] findPropertyTypeInContent resolved Lombok property return types accurately.');

    console.log('==============================================');
    console.log('ALL LOMBOK SUPPORT TESTS PASSED SUCCESSFULLY! ☕');
    console.log('==============================================');
}

runTests().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});

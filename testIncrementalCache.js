const assert = require('assert');
const path = require('path');
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
    getSharedBeanMap,
    getSharedClassUriCache,
    isJsfCacheInitialized,
    setCacheInitializedForTest,
    updateJavaBeanInCache,
    removeJavaBeanFromCache,
    rebuildJsfCache
} = require('./out/providers/JsfElCompletionProvider');

async function runTests() {
    console.log('==============================================');
    console.log('RUNNING INCREMENTAL BEAN CACHING TESTS');
    console.log('==============================================');

    // 0. Prepare cache state
    rebuildJsfCache(false);
    setCacheInitializedForTest(true);
    assert.strictEqual(isJsfCacheInitialized(), true, 'Cache should be marked initialized for test.');

    const mockUri = {
        fsPath: path.resolve('mock/UserController.java'),
        toString: () => 'file:///mock/UserController.java'
    };

    const anotherUri = {
        fsPath: path.resolve('mock/ProductController.java'),
        toString: () => 'file:///mock/ProductController.java'
    };

    // 1. Test adding a new Java Managed Bean incrementally
    console.log('Testing incremental addition of a new Managed Bean...');
    const initialJavaContent = `
        package com.example;
        import jakarta.inject.Named;
        import jakarta.enterprise.context.RequestScoped;

        @Named("userBean")
        @RequestScoped
        public class UserController {
            public String getName() { return "test"; }
        }
    `;

    await updateJavaBeanInCache(mockUri, async () => initialJavaContent);

    const beanMap = getSharedBeanMap();
    const classUriCache = getSharedClassUriCache();

    assert.strictEqual(beanMap.has('userBean'), true, 'userBean should be added to beanMap incrementally.');
    assert.strictEqual(classUriCache.has('UserController'), true, 'UserController should be added to classUriCache incrementally.');
    assert.strictEqual(isJsfCacheInitialized(), true, 'isCacheInitialized should remain true after incremental update.');
    console.log('  [PASS] Added userBean to cache without rebuilding.');

    // 2. Add a second bean to verify non-destructive updating
    console.log('Testing adding a second bean without removing existing beans...');
    const secondJavaContent = `
        package com.example;
        import jakarta.inject.Named;

        @Named("productBean")
        public class ProductController {
        }
    `;
    await updateJavaBeanInCache(anotherUri, async () => secondJavaContent);

    assert.strictEqual(beanMap.has('userBean'), true, 'First bean userBean should still exist in cache.');
    assert.strictEqual(beanMap.has('productBean'), true, 'Second bean productBean should be added.');
    console.log('  [PASS] Both beans coexist cleanly in cache.');

    // 3. Test modifying a bean file (e.g. renaming the @Named value)
    console.log('Testing modifying an existing bean file (renaming @Named value)...');
    const modifiedJavaContent = `
        package com.example;
        import jakarta.inject.Named;

        @Named("renamedUserBean")
        public class UserController {
            public String getEmail() { return "email"; }
        }
    `;

    await updateJavaBeanInCache(mockUri, async () => modifiedJavaContent);

    assert.strictEqual(beanMap.has('userBean'), false, 'Old bean name userBean should be removed from cache on file edit.');
    assert.strictEqual(beanMap.has('renamedUserBean'), true, 'New bean name renamedUserBean should be added.');
    assert.strictEqual(beanMap.has('productBean'), true, 'Other beans (productBean) should remain unaffected.');
    console.log('  [PASS] Renamed userBean to renamedUserBean cleanly without stale entries.');

    // 4. Test deleting a bean file
    console.log('Testing removing a bean on file deletion...');
    removeJavaBeanFromCache(mockUri);

    assert.strictEqual(beanMap.has('renamedUserBean'), false, 'renamedUserBean should be removed from beanMap.');
    assert.strictEqual(classUriCache.has('UserController'), false, 'UserController should be removed from classUriCache.');
    assert.strictEqual(beanMap.has('productBean'), true, 'productBean should still be in cache.');
    console.log('  [PASS] Deleted bean cleanly from beanMap and classUriCache.');

    // 5. Verify uninitialized cache ignores incremental updates
    console.log('Testing that uninitialized cache ignores incremental updates...');
    setCacheInitializedForTest(false);
    await updateJavaBeanInCache(mockUri, async () => initialJavaContent);
    assert.strictEqual(beanMap.has('userBean'), false, 'Should not add to uninitialized cache.');
    console.log('  [PASS] Uninitialized cache correctly bypassed.');

    console.log('==============================================');
    console.log('ALL INCREMENTAL CACHE TESTS PASSED SUCCESSFULLY! ☕');
    console.log('==============================================');
}

runTests().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});

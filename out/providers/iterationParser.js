"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findEnclosingIterationVariables = findEnclosingIterationVariables;
exports.findIterationVariableByName = findIterationVariableByName;
const vscode = require("vscode");
/**
 * Finds all enclosing JSF iteration variables (var="...") in scope at the given cursor position.
 * Supports standard JSF tags (<ui:repeat>, <h:dataTable>), PrimeFaces (<p:dataTable>, <p:dataList>, etc.),
 * and JSTL (<c:forEach>) or any custom tag defining both var="..." and value="#{...}" / items="#{...}".
 */
function findEnclosingIterationVariables(document, position) {
    const text = document.getText();
    const cursorOffset = document.offsetAt(position);
    const results = [];
    // Match opening tags with attributes
    // <tagName attr1="val1" attr2="val2">
    const tagRegex = /<([a-zA-Z0-9_:-]+)\s+([^>]*?)(\/?)>/g;
    let match;
    while ((match = tagRegex.exec(text)) !== null) {
        const tagStartOffset = match.index;
        const tagEndOffset = tagStartOffset + match[0].length;
        // Only consider tags that open before the cursor
        if (tagStartOffset >= cursorOffset) {
            break;
        }
        const isSelfClosing = match[3] === '/';
        if (isSelfClosing) {
            continue;
        }
        const tagName = match[1];
        const attributesText = match[2];
        // Check if attributes define var="..." and value="#{...}" or items="#{...}"
        const varMatch = /var\s*=\s*(?:'([^']+)'|"([^"]+)")/.exec(attributesText);
        if (!varMatch) {
            continue;
        }
        const collectionMatch = /(?:value|items)\s*=\s*(?:'#\{([^}]+)\}'|"#\{([^}]+)\}"|'\$\{([^}]+)\}'|"\$\{([^}]+)\}")/.exec(attributesText);
        if (!collectionMatch) {
            continue;
        }
        const varName = (varMatch[1] || varMatch[2]).trim();
        const collectionEl = (collectionMatch[1] || collectionMatch[2] || collectionMatch[3] || collectionMatch[4]).trim();
        if (!varName || !collectionEl) {
            continue;
        }
        // Verify if this tag is still open at cursorOffset
        if (!isTagOpenAtOffset(text, tagName, tagEndOffset, cursorOffset)) {
            continue;
        }
        // Calculate varAttributeRange in document
        const varAttrIndexInTag = match[0].indexOf(varMatch[0]);
        const varStartOffset = tagStartOffset + varAttrIndexInTag;
        const varEndOffset = varStartOffset + varMatch[0].length;
        const tagRange = new vscode.Range(document.positionAt(tagStartOffset), document.positionAt(tagEndOffset));
        const varAttributeRange = new vscode.Range(document.positionAt(varStartOffset), document.positionAt(varEndOffset));
        results.push({
            varName,
            collectionEl,
            tagRange,
            varAttributeRange
        });
    }
    // Return innermost first (reverse chronological order)
    return results.reverse();
}
/**
 * Finds an iteration variable by name that is currently in scope at the given position.
 */
function findIterationVariableByName(document, position, varName) {
    const vars = findEnclosingIterationVariables(document, position);
    return vars.find(v => v.varName === varName);
}
/**
 * Helper to check if a tag opened at `afterOpenOffset` is still open at `targetOffset`.
 */
function isTagOpenAtOffset(text, tagName, afterOpenOffset, targetOffset) {
    const substring = text.substring(afterOpenOffset, targetOffset);
    // Escape regex characters in tagName
    const escapedTag = tagName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const openTokenRegex = new RegExp(`<${escapedTag}(?:\\s|>)`, 'g');
    const closeTokenRegex = new RegExp(`</${escapedTag}\\s*>`, 'g');
    let depth = 1;
    // We scan through tokens in substring in order of index
    const events = [];
    let m;
    while ((m = openTokenRegex.exec(substring)) !== null) {
        events.push({ index: m.index, delta: 1 });
    }
    while ((m = closeTokenRegex.exec(substring)) !== null) {
        events.push({ index: m.index, delta: -1 });
    }
    events.sort((a, b) => a.index - b.index);
    for (const event of events) {
        depth += event.delta;
        if (depth === 0) {
            return false; // Tag closed before targetOffset
        }
    }
    return depth > 0;
}
//# sourceMappingURL=iterationParser.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsfIdHighlightProvider = void 0;
exports.stripXmlComments = stripXmlComments;
exports.findComponentIds = findComponentIds;
exports.findComponentReferences = findComponentReferences;
exports.getIdOrForAtPosition = getIdOrForAtPosition;
const vscode = require("vscode");
/**
 * Replaces XML comments (<!-- ... -->) with spaces so column and line offsets remain identical.
 */
function stripXmlComments(text) {
    return text.replace(/<!--[\s\S]*?-->/g, (match) => {
        return match.replace(/[^\r\n]/g, ' ');
    });
}
/**
 * Finds the enclosing XML tag name by searching backwards from a given character offset.
 */
function findEnclosingTagName(text, offset) {
    const sub = text.substring(0, offset);
    const lastOpenIndex = sub.lastIndexOf('<');
    if (lastOpenIndex === -1) {
        return 'unknown';
    }
    // Check if there is a closing bracket '>' between lastOpenIndex and offset
    const lastCloseIndex = sub.lastIndexOf('>');
    if (lastCloseIndex > lastOpenIndex) {
        return 'unknown';
    }
    const tagMatch = /^<([a-zA-Z0-9_:-]+)/.exec(sub.substring(lastOpenIndex));
    return tagMatch ? tagMatch[1] : 'unknown';
}
/**
 * Finds all component ID declarations (id="...") in a document.
 */
function findComponentIds(document) {
    const text = stripXmlComments(document.getText());
    const results = [];
    const regex = /\bid\s*=\s*(['"])([^'"]+)\1/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const idValue = match[2];
        const valStartOffset = match.index + match[0].indexOf(idValue);
        const valEndOffset = valStartOffset + idValue.length;
        const startPos = document.positionAt(valStartOffset);
        const endPos = document.positionAt(valEndOffset);
        const tagName = findEnclosingTagName(text, match.index);
        const lineText = document.lineAt(startPos.line).text.trim();
        results.push({
            id: idValue,
            tagName: tagName,
            range: new vscode.Range(startPos, endPos),
            lineText: lineText
        });
    }
    return results;
}
/**
 * Finds all references to component IDs (for="..." or target="...") in a document.
 * Optionally filters by a specific target ID.
 */
function findComponentReferences(document, targetId) {
    const text = stripXmlComments(document.getText());
    const results = [];
    const regex = /\b(for|target)\s*=\s*(['"])([^'"]+)\2/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const attrName = match[1];
        const refIdValue = match[3];
        if (targetId && refIdValue !== targetId) {
            continue;
        }
        const valStartOffset = match.index + match[0].indexOf(refIdValue);
        const valEndOffset = valStartOffset + refIdValue.length;
        const startPos = document.positionAt(valStartOffset);
        const endPos = document.positionAt(valEndOffset);
        const tagName = findEnclosingTagName(text, match.index);
        const lineText = document.lineAt(startPos.line).text.trim();
        results.push({
            refId: refIdValue,
            tagName: tagName,
            attrName: attrName,
            range: new vscode.Range(startPos, endPos),
            lineText: lineText
        });
    }
    return results;
}
/**
 * Checks if a given position is inside an id="value" or for="value" attribute.
 */
function getIdOrForAtPosition(document, position) {
    const lineText = document.lineAt(position.line).text;
    const regex = /\b(id|for|target)\s*=\s*(['"])([^'"]+)\2/g;
    let match;
    while ((match = regex.exec(lineText)) !== null) {
        const attrName = match[1];
        const val = match[3];
        const valStartCol = match.index + match[0].indexOf(val);
        const valEndCol = valStartCol + val.length;
        if (position.character >= valStartCol && position.character <= valEndCol) {
            return {
                value: val,
                type: attrName,
                range: new vscode.Range(position.line, valStartCol, position.line, valEndCol)
            };
        }
    }
    return null;
}
class JsfIdHighlightProvider {
    provideDocumentHighlights(document, position, token) {
        const atPos = getIdOrForAtPosition(document, position);
        if (!atPos) {
            return null;
        }
        const idValue = atPos.value;
        const ids = findComponentIds(document);
        const refs = findComponentReferences(document, idValue);
        const highlights = [];
        for (const item of ids) {
            if (item.id === idValue) {
                highlights.push(new vscode.DocumentHighlight(item.range, vscode.DocumentHighlightKind.Write));
            }
        }
        for (const item of refs) {
            if (item.refId === idValue) {
                highlights.push(new vscode.DocumentHighlight(item.range, vscode.DocumentHighlightKind.Read));
            }
        }
        return highlights.length > 0 ? highlights : null;
    }
}
exports.JsfIdHighlightProvider = JsfIdHighlightProvider;
//# sourceMappingURL=JsfIdHighlightProvider.js.map
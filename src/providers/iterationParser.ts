import * as vscode from 'vscode';

export interface IterationVariableInfo {
    varName: string;          // e.g. "u"
    collectionEl: string;     // e.g. "userController.users"
    tagRange: vscode.Range;
    varAttributeRange: vscode.Range;
}

/**
 * Finds all enclosing JSF iteration variables (var="...") in scope at the given cursor position.
 * Supports standard JSF tags (<ui:repeat>, <h:dataTable>), PrimeFaces (<p:dataTable>, <p:dataList>, etc.),
 * and JSTL (<c:forEach>) or any custom tag defining both var="..." and value="#{...}" / items="#{...}".
 */
export function findEnclosingIterationVariables(
    document: vscode.TextDocument,
    position: vscode.Position
): IterationVariableInfo[] {
    const text = document.getText();
    const cursorOffset = document.offsetAt(position);
    const results: IterationVariableInfo[] = [];

    // Match opening tags with attributes
    // <tagName attr1="val1" attr2="val2">
    const tagRegex = /<([a-zA-Z0-9_:-]+)\s+([^>]*?)(\/?)>/g;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(text)) !== null) {
        const tagStartOffset = match.index;
        const tagEndOffset = tagStartOffset + match[0].length;

        // Only consider tags that open before the cursor
        if (tagStartOffset >= cursorOffset) {
            break;
        }

        const isSelfClosing = match[3] === '/';

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
        const collectionEl = (
            collectionMatch[1] || collectionMatch[2] || collectionMatch[3] || collectionMatch[4]
        ).trim();

        if (!varName || !collectionEl) {
            continue;
        }

        // Verify if this tag is still open at cursorOffset
        if (cursorOffset <= tagEndOffset) {
            // Cursor is inside the tag declaration itself, so the var is in scope!
        } else if (isSelfClosing) {
            // Cursor is after the self-closing tag, so it's out of scope
            continue;
        } else if (!isTagOpenAtOffset(text, tagName, tagEndOffset, cursorOffset)) {
            // Cursor is after the opening tag, but the tag is already closed
            continue;
        }

        // Calculate varAttributeRange in document
        const varAttrIndexInTag = match[0].indexOf(varMatch[0]);
        const varStartOffset = tagStartOffset + varAttrIndexInTag;
        const varEndOffset = varStartOffset + varMatch[0].length;

        const tagRange = new vscode.Range(
            document.positionAt(tagStartOffset),
            document.positionAt(tagEndOffset)
        );
        const varAttributeRange = new vscode.Range(
            document.positionAt(varStartOffset),
            document.positionAt(varEndOffset)
        );

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
export function findIterationVariableByName(
    document: vscode.TextDocument,
    position: vscode.Position,
    varName: string
): IterationVariableInfo | undefined {
    const vars = findEnclosingIterationVariables(document, position);
    return vars.find(v => v.varName === varName);
}

/**
 * Helper to check if a tag opened at `afterOpenOffset` is still open at `targetOffset`.
 */
function isTagOpenAtOffset(
    text: string,
    tagName: string,
    afterOpenOffset: number,
    targetOffset: number
): boolean {
    const substring = text.substring(afterOpenOffset, targetOffset);

    // Escape regex characters in tagName
    const escapedTag = tagName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const openTokenRegex = new RegExp(`<${escapedTag}(?:\\s|>)`, 'g');
    const closeTokenRegex = new RegExp(`</${escapedTag}\\s*>`, 'g');

    let depth = 1;

    // We scan through tokens in substring in order of index
    const events: { index: number; delta: number }[] = [];

    let m: RegExpExecArray | null;
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

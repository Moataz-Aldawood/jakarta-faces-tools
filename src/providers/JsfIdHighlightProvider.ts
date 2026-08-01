import * as vscode from 'vscode';

export interface ComponentIdInfo {
    id: string;
    tagName: string;
    range: vscode.Range;
    lineText: string;
}

export interface ComponentReferenceInfo {
    refId: string;
    tagName: string;
    attrName: string; // 'for' or 'target'
    range: vscode.Range;
    lineText: string;
}

/**
 * Replaces XML comments (<!-- ... -->) with spaces so column and line offsets remain identical.
 */
export function stripXmlComments(text: string): string {
    return text.replace(/<!--[\s\S]*?-->/g, (match) => {
        return match.replace(/[^\r\n]/g, ' ');
    });
}

/**
 * Finds the enclosing XML tag name by searching backwards from a given character offset.
 */
function findEnclosingTagName(text: string, offset: number): string {
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
export function findComponentIds(document: vscode.TextDocument): ComponentIdInfo[] {
    const text = stripXmlComments(document.getText());
    const results: ComponentIdInfo[] = [];
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
export function findComponentReferences(document: vscode.TextDocument, targetId?: string): ComponentReferenceInfo[] {
    const text = stripXmlComments(document.getText());
    const results: ComponentReferenceInfo[] = [];
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
export function getIdOrForAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position
): { value: string; type: 'id' | 'for' | 'target'; range: vscode.Range } | null {
    const lineText = document.lineAt(position.line).text;
    const regex = /\b(id|for|target)\s*=\s*(['"])([^'"]+)\2/g;
    let match;

    while ((match = regex.exec(lineText)) !== null) {
        const attrName = match[1] as 'id' | 'for' | 'target';
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

export class JsfIdHighlightProvider implements vscode.DocumentHighlightProvider {
    public provideDocumentHighlights(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentHighlight[]> {
        const atPos = getIdOrForAtPosition(document, position);
        if (!atPos) {
            return null;
        }

        const idValue = atPos.value;
        const ids = findComponentIds(document);
        const refs = findComponentReferences(document, idValue);

        const highlights: vscode.DocumentHighlight[] = [];

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

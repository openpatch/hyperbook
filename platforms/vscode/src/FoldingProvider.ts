import * as vscode from "vscode";

/**
 * Provides folding ranges for Hyperbook directive blocks.
 * Recognizes container directives that start with ::: and end with :::.
 */
export class HyperbookFoldingProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(
    document: vscode.TextDocument,
    context: vscode.FoldingContext,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.FoldingRange[]> {
    const foldingRanges: vscode.FoldingRange[] = [];
    const stack: { line: number; colonCount: number }[] = [];

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const text = line.text.trimStart();

      // Match opening directive: ::: or more colons followed by directive name
      const openMatch = text.match(/^(:{3,})(\w+)/);
      if (openMatch) {
        const colonCount = openMatch[1].length;
        stack.push({ line: i, colonCount });
        continue;
      }

      // Match closing directive: ::: or more colons (must match opening)
      const closeMatch = text.match(/^(:{3,})\s*$/);
      if (closeMatch && stack.length > 0) {
        const colonCount = closeMatch[1].length;
        const top = stack[stack.length - 1];

        // Match the closing colons with the most recent opening
        if (colonCount === top.colonCount) {
          const start = stack.pop();
          if (start) {
            // Create folding range from opening to closing line
            foldingRanges.push(
              new vscode.FoldingRange(
                start.line,
                i,
                vscode.FoldingRangeKind.Region,
              ),
            );
          }
        }
      }
    }

    return foldingRanges;
  }
}

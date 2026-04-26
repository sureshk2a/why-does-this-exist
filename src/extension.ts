import * as vscode from 'vscode';
import * as path from 'path';
import { runChain } from './chain';
import { ResultPanel } from './panel';

export function activate(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand(
    'whyDoesThisExist.explain',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor found.');
        return;
      }

      const document = editor.document;
      const filePath = document.uri.fsPath;
      const lineNumber = editor.selection.active.line + 1; // 1-based
      const lineText = document.lineAt(editor.selection.active.line).text.trim();

      if (!filePath || document.isUntitled) {
        vscode.window.showErrorMessage('Please save the file before using Why Does This Exist?');
        return;
      }

      const config = vscode.workspace.getConfiguration('whyDoesThisExist');

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Tracing code history...',
          cancellable: false,
        },
        async (progress) => {
          try {
            progress.report({ message: 'Running git blame...' });
            const result = await runChain({
              filePath,
              lineNumber,
              lineText,
              config,
              onProgress: (msg: string) => progress.report({ message: msg }),
            });
            ResultPanel.show(context.extensionUri, result, lineText, lineNumber, path.basename(filePath));
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Why Does This Exist? failed: ${message}`);
          }
        }
      );
    }
  );

  context.subscriptions.push(command);
}

export function deactivate() {}

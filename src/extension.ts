import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'calendar.insertDate',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active text editor found');
        return;
      }

      const panel = vscode.window.createWebviewPanel(
        'calendar',
        'Select Date',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, 'media')
          ]
        }
      );

      panel.webview.html = await getWebviewHtml(panel.webview, context);

      panel.webview.onDidReceiveMessage(message => {
        switch (message.type) {
          case 'dateSelected':
            insertDateAtCursor(editor, message.value);
            panel.dispose();
            return;
          case 'requestPreview':
            panel.webview.postMessage({
              type: 'updatePreview',
              value: getFormattedDate(message.value)
            });
            return;
        }
      });
    }
  );

  context.subscriptions.push(disposable);
}

function getFormattedDate(dateString: string): string {
  const config = vscode.workspace.getConfiguration('calendar');
  const format = config.get<string>('dateFormat', 'default');

  const date = new Date(dateString);
  let formattedDate: string;

  if (format === 'default') {
    formattedDate = date.toLocaleDateString();
  } else if (format === 'ISO') {
    formattedDate = dateString;
  } else {
    // Custom format string support
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    const shortYear = year.slice(-2);
    const monthName = date.toLocaleString('default', { month: 'long' });
    const shortMonthName = date.toLocaleString('default', { month: 'short' });

    formattedDate = format
      .replace(/YYYY/g, year)
      .replace(/YY/g, shortYear)
      .replace(/MMMM/g, monthName)
      .replace(/MMM/g, shortMonthName)
      .replace(/MM/g, month)
      .replace(/DD/g, day);
  }
  return formattedDate;
}

function insertDateAtCursor(editor: vscode.TextEditor, dateString: string) {
  const formattedDate = getFormattedDate(dateString);
  editor.edit(editBuilder => {
    editBuilder.insert(editor.selection.active, formattedDate);
  });
}

async function getWebviewHtml(
  webview: vscode.Webview,
  context: vscode.ExtensionContext
): Promise<string> {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'media', 'calendar.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'media', 'calendar.css')
  );
  const htmlUri = vscode.Uri.joinPath(
    context.extensionUri,
    'media',
    'calendar.html'
  );

  const nonce = getNonce();

  const htmlData = await vscode.workspace.fs.readFile(htmlUri);
  let html = new TextDecoder().decode(htmlData);

  html = html
    .replace(/{{cspSource}}/g, webview.cspSource)
    .replace(/{{nonce}}/g, nonce)
    .replace(/{{styleUri}}/g, styleUri.toString())
    .replace(/{{scriptUri}}/g, scriptUri.toString());

  return html;
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

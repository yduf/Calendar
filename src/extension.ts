import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const insertDateDisposable = vscode.commands.registerCommand(
    'calendar.insertDate',
    async () => {
      showCalendarWebview(context);
    }
  );

  const editDateDisposable = vscode.commands.registerCommand(
    'calendar.editDate',
    async (rangeArg: any, originalFormat: string, initialDateArg: any) => {
      // Reconstruct Range from deserialized JSON (hover links serialize objects)
      let range: vscode.Range;
      if (rangeArg instanceof vscode.Range) {
        range = rangeArg;
      } else if (rangeArg && rangeArg.start && rangeArg.end) {
        range = new vscode.Range(
          rangeArg.start.line, rangeArg.start.character,
          rangeArg.end.line, rangeArg.end.character
        );
      } else if (Array.isArray(rangeArg)) {
        range = new vscode.Range(
          rangeArg[0].line, rangeArg[0].character,
          rangeArg[1].line, rangeArg[1].character
        );
      } else {
        vscode.window.showErrorMessage('Invalid date range');
        return;
      }

      // Reconstruct Date from deserialized JSON
      const initialDate = initialDateArg instanceof Date
        ? initialDateArg
        : new Date(initialDateArg);

      showCalendarWebview(context, range, originalFormat, initialDate);
    }
  );

  const languages = vscode.workspace.getConfiguration('calendar').get<string[]>('enabledLanguages', ['markdown', 'plaintext', 'javascript', 'typescript']);

  const hoverProvider = vscode.languages.registerHoverProvider(languages, {
    provideHover(document, position) {
      const dateMatch = findDateAtPosition(document, position);
      if (dateMatch) {
        const args = [dateMatch.range, dateMatch.format, dateMatch.date];
        const editCommandUri = vscode.Uri.parse(
          `command:calendar.editDate?${encodeURIComponent(JSON.stringify(args))}`
        );
        const contents = new vscode.MarkdownString(`[📅 Edit Date](${editCommandUri})`);
        contents.isTrusted = true;
        return new vscode.Hover(contents, dateMatch.range);
      }
      return null;
    }
  });

  const codeActionProvider = vscode.languages.registerCodeActionsProvider(languages, {
    provideCodeActions(document, range) {
      const dateMatch = findDateAtPosition(document, range.start);
      if (dateMatch) {
        const action = new vscode.CodeAction('Edit Date', vscode.CodeActionKind.QuickFix);
        action.command = {
          title: 'Edit Date',
          command: 'calendar.editDate',
          arguments: [dateMatch.range, dateMatch.format, dateMatch.date]
        };
        return [action];
      }
      return [];
    }
  });

  context.subscriptions.push(insertDateDisposable, editDateDisposable, hoverProvider, codeActionProvider);
}

async function showCalendarWebview(
  context: vscode.ExtensionContext,
  range?: vscode.Range,
  originalFormat?: string,
  initialDate?: Date
) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active text editor found');
    return;
  }

  // Use original format if provided (editing), otherwise try to detect one from the document for consistency
  const formatToUse = originalFormat || detectDateFormat(editor.document);

  const panel = vscode.window.createWebviewPanel(
    'calendar',
    'Select Date',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
    }
  );

  panel.webview.html = await getWebviewHtml(panel.webview, context);

  panel.webview.onDidReceiveMessage(message => {
    if (message.type === 'ready') {
      if (initialDate && !isNaN(initialDate.getTime())) {
        const year = initialDate.getFullYear();
        const month = String(initialDate.getMonth() + 1).padStart(2, '0');
        const day = String(initialDate.getDate()).padStart(2, '0');
        const isoDate = `${year}-${month}-${day}`;
        panel.webview.postMessage({ type: 'setSelectedDate', value: isoDate });
      }
      return;
    }

    switch (message.type) {
      case 'dateSelected':
        try {
          if (range) {
            replaceDateAtRange(editor, range, message.value, formatToUse);
          } else {
            insertDateAtCursor(editor, message.value, formatToUse);
          }
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to apply date: ${err}`);
        } finally {
          panel.dispose();
          vscode.window.showTextDocument(editor.document, editor.viewColumn);
        }
        return;
      case 'close':
        panel.dispose();
        vscode.window.showTextDocument(editor.document, editor.viewColumn);
        return;
      case 'requestPreview':
        panel.webview.postMessage({
          type: 'updatePreview',
          value: getFormattedDate(message.value, formatToUse)
        });
        return;
    }
  });
}

interface DateMatch {
  range: vscode.Range;
  date: Date;
  format: string;
}

function detectDateFormat(document: vscode.TextDocument): string | undefined {
  const ambiguity = vscode.workspace.getConfiguration('calendar').get<string>('ambiguityResolution', 'DMY');
  const limit = Math.min(document.lineCount, 100);

  const isoRegex = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/;
  const commonRegex = /\b(\d{1,2})([/.-])(\d{1,2})\2(\d{2,4})\b/;

  for (let i = 0; i < limit; i++) {
    const line = document.lineAt(i).text;

    const isoMatch = line.match(isoRegex);
    if (isoMatch) {
      return 'YYYY-MM-DD';
    }

    const commonMatch = line.match(commonRegex);
    if (commonMatch) {
      const sep = commonMatch[2];
      let format = ambiguity === 'MDY' ? `MM${sep}DD${sep}` : `DD${sep}MM${sep}`;
      format += commonMatch[4].length === 4 ? 'YYYY' : 'YY';
      return format;
    }
  }
  return undefined;
}

function findDateAtPosition(document: vscode.TextDocument, position: vscode.Position): DateMatch | undefined {
  const line = document.lineAt(position.line).text;
  const ambiguity = vscode.workspace.getConfiguration('calendar').get<string>('ambiguityResolution', 'DMY');

  const isoRegex = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
  let match;
  while ((match = isoRegex.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (position.character >= start && position.character <= end) {
      const date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      if (!isNaN(date.getTime())) {
        return {
          range: new vscode.Range(position.line, start, position.line, end),
          date,
          format: 'YYYY-MM-DD'
        };
      }
    }
  }

  const commonRegex = /\b(\d{1,2})([/.-])(\d{1,2})\2(\d{2,4})\b/g;
  while ((match = commonRegex.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (position.character >= start && position.character <= end) {
      const sep = match[2];
      let d = parseInt(match[1]);
      let m = parseInt(match[3]);
      let y = parseInt(match[4]);
      if (y < 100) { y += 2000; }

      if (ambiguity === 'MDY') {
        [d, m] = [m, d];
      }

      const date = new Date(y, m - 1, d);
      if (!isNaN(date.getTime())) {
        let format = ambiguity === 'MDY' ? `MM${sep}DD${sep}` : `DD${sep}MM${sep}`;
        format += match[4].length === 4 ? 'YYYY' : 'YY';
        return {
          range: new vscode.Range(position.line, start, position.line, end),
          date,
          format
        };
      }
    }
  }

  return undefined;
}

function getFormattedDate(dateString: string, formatOverride?: string): string {
  const config = vscode.workspace.getConfiguration('calendar');
  const userFormat = config.get<string>('dateFormat', 'default');

  // Prioritize user-defined format if it's not 'default'. 
  // Otherwise, use the detected format from the document (formatOverride).
  const format = (userFormat !== 'default') ? userFormat : (formatOverride || 'default');

  const date = new Date(dateString);
  let formattedDate: string;

  if (format === 'default') {
    formattedDate = date.toLocaleDateString();
  } else if (format === 'ISO' || format === 'YYYY-MM-DD') {
    formattedDate = dateString;
  } else {
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

function insertDateAtCursor(editor: vscode.TextEditor, dateString: string, format?: string) {
  const formattedDate = getFormattedDate(dateString, format);
  editor.edit(editBuilder => {
    editBuilder.insert(editor.selection.active, formattedDate);
  });
}

function replaceDateAtRange(editor: vscode.TextEditor, range: vscode.Range, dateString: string, format?: string) {
  const formattedDate = getFormattedDate(dateString, format);
  editor.edit(editBuilder => {
    editBuilder.replace(range, formattedDate);
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

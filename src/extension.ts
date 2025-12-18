import * as vscode from 'vscode';

let isRunning = false;

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWorkspaceFiles(): Promise<vscode.Uri[]> {
	const files = await vscode.workspace.findFiles(
		'**/*',
		'**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/*.vsix'
	);
	return files.filter(file => {
		const path = file.fsPath.toLowerCase();
		return path.endsWith('.ts') || path.endsWith('.js') || path.endsWith('.json') ||
			   path.endsWith('.md') || path.endsWith('.txt') || path.endsWith('.html') ||
			   path.endsWith('.css') || path.endsWith('.tsx') || path.endsWith('.jsx');
	});
}

function getRandomFile(files: vscode.Uri[], exclude?: vscode.Uri): vscode.Uri | undefined {
	const available = exclude ? files.filter(f => f.fsPath !== exclude.fsPath) : files;
	if (available.length === 0) {
		return undefined;
	}
	const randomIndex = Math.floor(Math.random() * available.length);
	return available[randomIndex];
}

async function openFile(file: vscode.Uri): Promise<vscode.TextEditor> {
	const doc = await vscode.workspace.openTextDocument(file);
	return await vscode.window.showTextDocument(doc);
}

function selectRandomLines(editor: vscode.TextEditor, lineCount: number = 3): string {
	const doc = editor.document;
	const totalLines = doc.lineCount;
	if (totalLines === 0) {
		return '';
	}

	const maxStartLine = Math.max(0, totalLines - lineCount);
	const randomLine = Math.floor(Math.random() * (maxStartLine + 1));
	const endLine = Math.min(randomLine + lineCount - 1, totalLines - 1);

	const startPos = new vscode.Position(randomLine, 0);
	const endPos = new vscode.Position(endLine, doc.lineAt(endLine).text.length);

	editor.selection = new vscode.Selection(startPos, endPos);
	editor.revealRange(new vscode.Range(startPos, endPos), vscode.TextEditorRevealType.InCenter);

	return doc.getText(new vscode.Range(startPos, endPos));
}

function deselectLines(editor: vscode.TextEditor): void {
	const pos = editor.selection.active;
	editor.selection = new vscode.Selection(pos, pos);
}

async function scrollUpAndDown(editor: vscode.TextEditor, durationMs: number): Promise<void> {
	const doc = editor.document;
	const lineCount = doc.lineCount;
	const endTime = Date.now() + durationMs;
	let goingDown = true;
	let currentLine = 0;

	while (Date.now() < endTime && isRunning) {
		const pos = new vscode.Position(currentLine, 0);
		editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);

		if (goingDown) {
			currentLine += 10;
			if (currentLine >= lineCount - 1) {
				currentLine = lineCount - 1;
				goingDown = false;
			}
		} else {
			currentLine -= 10;
			if (currentLine <= 0) {
				currentLine = 0;
				goingDown = true;
			}
		}

		await sleep(200);
	}
}

async function runLoop(files: vscode.Uri[]): Promise<void> {
	while (isRunning) {
		// Step 1: Open random file, select lines, wait 2 seconds, deselect
		const file1 = getRandomFile(files);
		if (!file1 || !isRunning) {
			break;
		}
		let editor = await openFile(file1);
		selectRandomLines(editor);
		await sleep(2000);
		if (!isRunning) {
			break;
		}
		deselectLines(editor);

		// Step 2: Open another random file, wait 3 seconds
		const file2 = getRandomFile(files, file1) || file1;
		if (!isRunning) {
			break;
		}
		await openFile(file2);
		await sleep(3000);
		if (!isRunning) {
			break;
		}

		// Step 3: Open random file, select some lines, copy them
		const file3 = getRandomFile(files);
		if (!file3 || !isRunning) {
			break;
		}
		editor = await openFile(file3);
		const copiedText = selectRandomLines(editor, 5);
		await vscode.env.clipboard.writeText(copiedText);
		await sleep(500);
		if (!isRunning) {
			break;
		}

		// Step 4: Open a new untitled file, paste the lines, wait 6 seconds
		const newDoc = await vscode.workspace.openTextDocument({ content: '' });
		const newEditor = await vscode.window.showTextDocument(newDoc);
		await newEditor.edit(editBuilder => {
			editBuilder.insert(new vscode.Position(0, 0), copiedText);
		});
		await sleep(6000);
		if (!isRunning) {
			break;
		}

		// Step 5: Close the file without saving
		await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
		await sleep(500);
		if (!isRunning) {
			break;
		}

		// Step 6: Open new file, scroll up and down for 5 seconds
		const file4 = getRandomFile(files);
		if (!file4 || !isRunning) {
			break;
		}
		editor = await openFile(file4);
		await scrollUpAndDown(editor, 5000);
	}
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "budgie" is now active!');

	const startCommand = vscode.commands.registerCommand('budgie.startRandomFiles', async () => {
		if (isRunning) {
			vscode.window.showInformationMessage('Budgie is already running!');
			return;
		}

		const files = await getWorkspaceFiles();
		if (files.length === 0) {
			vscode.window.showWarningMessage('No files found in workspace');
			return;
		}

		isRunning = true;
		vscode.window.showInformationMessage('Budgie started! Use "Budgie: Stop" to stop.');
		runLoop(files);
	});

	const stopCommand = vscode.commands.registerCommand('budgie.stopRandomFiles', () => {
		if (!isRunning) {
			vscode.window.showInformationMessage('Budgie is not running.');
			return;
		}
		isRunning = false;
		vscode.window.showInformationMessage('Budgie stopped!');
	});

	context.subscriptions.push(startCommand, stopCommand);
}

export function deactivate() {
	isRunning = false;
}

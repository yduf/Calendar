const vscode = acquireVsCodeApi();

// Set default date to today
const dateInput = document.getElementById('calendar');
const preview = document.getElementById('preview');
const today = new Date().toISOString().split('T')[0];
dateInput.value = today;
dateInput.focus();

// Attempt to open the calendar picker automatically
// Using a small timeout to ensure the element is ready and focused
setTimeout(() => {
    try {
        if (dateInput.showPicker) {
            dateInput.showPicker();
        }
    } catch (e) {
        console.log('showPicker not supported or failed', e);
    }
}, 100);

function updatePreview() {
    const date = dateInput.value;
    if (date) {
        vscode.postMessage({
            type: 'requestPreview',
            value: date
        });
    }
}

function sendDate() {
    const date = dateInput.value;
    if (date) {
        vscode.postMessage({
            type: 'dateSelected',
            value: date
        });
    }
}

// Initial preview
updatePreview();

dateInput.addEventListener('change', updatePreview);
dateInput.addEventListener('input', updatePreview);

document.getElementById('insertBtn').addEventListener('click', sendDate);

dateInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        sendDate();
    }
});

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
        case 'updatePreview':
            preview.textContent = `Preview: ${message.value}`;
            break;
    }
});

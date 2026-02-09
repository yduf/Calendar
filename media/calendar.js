const vscode = acquireVsCodeApi();

let selectedDate = new Date();
let currentViewDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);

const monthDisplay = document.getElementById('monthDisplay');
const calendarGrid = document.getElementById('calendar-grid');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const preview = document.getElementById('preview');
const insertBtn = document.getElementById('insertBtn');

function renderCalendar() {
    calendarGrid.innerHTML = '';
    
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    
    // Set month display
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(currentViewDate);
    monthDisplay.textContent = `${monthName} ${year}`;
    
    // First day of month
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    // Last day of month
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    // Last day of previous month
    const lastDayOfPrevMonth = new Date(year, month, 0).getDate();
    
    // Previous month days
    for (let i = firstDayOfMonth; i > 0; i--) {
        const day = lastDayOfPrevMonth - i + 1;
        createDayElement(day, 'other-month', new Date(year, month - 1, day));
    }
    
    // Current month days
    const today = new Date();
    for (let i = 1; i <= lastDayOfMonth; i++) {
        let className = '';
        const date = new Date(year, month, i);
        if (date.toDateString() === today.toDateString()) {
            className += ' today';
        }
        if (date.toDateString() === selectedDate.toDateString()) {
            className += ' selected';
        }
        createDayElement(i, className, date);
    }
    
    // Next month days to fill the grid (up to 42 cells for 6 rows)
    const totalCells = 42;
    const remainingCells = totalCells - calendarGrid.children.length;
    for (let i = 1; i <= remainingCells; i++) {
        createDayElement(i, 'other-month', new Date(year, month + 1, i));
    }
}

function createDayElement(day, className, date) {
    const div = document.createElement('div');
    div.textContent = day;
    div.className = 'calendar-day ' + className;
    div.onclick = () => {
        selectedDate = date;
        currentViewDate = new Date(date.getFullYear(), date.getMonth(), 1);
        renderCalendar();
        updatePreview();
    };
    calendarGrid.appendChild(div);
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function updatePreview() {
    const dateStr = formatDate(selectedDate);
    vscode.postMessage({
        type: 'requestPreview',
        value: dateStr
    });
}

function sendDate() {
    const dateStr = formatDate(selectedDate);
    vscode.postMessage({
        type: 'dateSelected',
        value: dateStr
    });
}

prevMonthBtn.onclick = () => {
    currentViewDate.setMonth(currentViewDate.getMonth() - 1);
    renderCalendar();
};

nextMonthBtn.onclick = () => {
    currentViewDate.setMonth(currentViewDate.getMonth() + 1);
    renderCalendar();
};

insertBtn.onclick = sendDate;

window.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        sendDate();
    } else if (event.key === 'Escape') {
        vscode.postMessage({ type: 'close' });
    } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        selectedDate.setDate(selectedDate.getDate() - 1);
        updateDateAndRender();
    } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        selectedDate.setDate(selectedDate.getDate() + 1);
        updateDateAndRender();
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        selectedDate.setDate(selectedDate.getDate() - 7);
        updateDateAndRender();
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        selectedDate.setDate(selectedDate.getDate() + 7);
        updateDateAndRender();
    }
});

function updateDateAndRender() {
    currentViewDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    renderCalendar();
    updatePreview();
}

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
        case 'updatePreview':
            preview.textContent = `Preview: ${message.value}`;
            break;
        case 'setSelectedDate':
            if (message.value) {
                selectedDate = new Date(message.value);
                currentViewDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                renderCalendar();
                updatePreview();
            }
            break;
    }
});

// Initial render
renderCalendar();
updatePreview();
document.getElementById('calendar-widget').focus();

// Signal that the webview is ready
vscode.postMessage({ type: 'ready' });

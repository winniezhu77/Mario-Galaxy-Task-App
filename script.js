const STORAGE_KEY = "galaxy-missions-v1";
const companions = [
  {
    id: "mario",
    name: "Mario",
    vibe: "Encouraging hero energy",
    sprite: "mario-custom.png",
    animation: "winJump",
    success: "Mario launches into a victory jump.",
    speech: "Let's-a go. One more mission."
  }
];

const motivationalMessages = [
  "Let's-a go. You've got this.",
  "Another level cleared.",
  "Keep going. You're powering up.",
  "Tiny steps, big galaxy progress.",
  "Your star bits are adding up.",
  "This mission board believes in you."
];

const state = loadState();
let dragState = null;
let idleTimer = null;

const todayLabel = document.getElementById("todayLabel");
const motivationText = document.getElementById("motivationText");
const leadCompanionDisplay = document.getElementById("leadCompanionDisplay");
const taskBoard = document.getElementById("taskBoard");
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const prioritySelect = document.getElementById("prioritySelect");
const taskTemplate = document.getElementById("taskTemplate");
const emptyState = document.getElementById("emptyState");
const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");
const sparkleField = document.getElementById("sparkleField");
const soundToggle = document.getElementById("soundToggle");
const themeToggle = document.getElementById("themeToggle");
const addTaskButton = document.getElementById("addTaskButton");
const clearTasksButton = document.getElementById("clearTasksButton");

init();

function init() {
  if (!companions.some((companion) => companion.id === state.selectedCompanion)) {
    state.selectedCompanion = companions[0].id;
    saveState();
  }

  if (!state.selectedCompanion) {
    state.selectedCompanion = companions[0].id;
  }

  todayLabel.textContent = `Today's Missions - ${formatToday()}`;
  motivationText.textContent = pickDailyMessage();
  renderLeadCompanion();
  renderTasks();
  updateProgress();
  bindEvents();
  scheduleIdleReminder();
}

function bindEvents() {
  taskForm.addEventListener("submit", handleTaskSubmit);
  taskBoard.addEventListener("pointerdown", startDragging);
  window.addEventListener("pointermove", handleDragging);
  window.addEventListener("pointerup", stopDragging);
  soundToggle.addEventListener("click", toggleSound);
  themeToggle.addEventListener("click", toggleTheme);
  addTaskButton.addEventListener("click", () => taskInput.focus());
  clearTasksButton.addEventListener("click", clearTasks);
}

function handleTaskSubmit(event) {
  event.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;

  state.tasks.push({
    id: crypto.randomUUID(),
    text,
    priority: prioritySelect.value,
    completed: false,
    x: 24 + ((state.tasks.length * 32) % 240),
    y: 24 + ((state.tasks.length * 28) % 180)
  });

  taskForm.reset();
  saveState();
  renderTasks();
  updateProgress();
  createSparkles(140, 140, 10);
  scheduleIdleReminder();
}

function renderLeadCompanion() {
  const companion = companions.find((item) => item.id === state.selectedCompanion) || companions[0];
  leadCompanionDisplay.innerHTML = `
    <div class="lead-sprite-stage">
      <img class="lead-sprite" src="${companion.sprite}" alt="${companion.name} full pixel sprite">
    </div>
    <div class="lead-text">
      <p class="lead-label">Lead Star Traveler</p>
      <h3 class="lead-name">${companion.name}</h3>
      <p class="lead-vibe">${companion.vibe}</p>
      <p class="lead-speech">${companion.speech}</p>
    </div>
  `;
}

function renderTasks() {
  taskBoard.innerHTML = "";
  const activeTasks = state.tasks.filter((task) => !task.completed);

  activeTasks.forEach((task) => {
    const node = taskTemplate.content.firstElementChild.cloneNode(true);
    const badge = node.querySelector(".priority-badge");
    badge.textContent = priorityLabel(task.priority);
    badge.classList.add(task.priority);

    node.querySelector(".task-text").textContent = task.text;
    node.querySelector(".edit-button").addEventListener("click", () => editTask(task.id));
    node.querySelector(".delete-button").addEventListener("click", () => deleteTask(task.id));
    node.querySelector(".complete-button").addEventListener("click", () => completeTask(task.id, node));
    node.dataset.taskId = task.id;
    node.style.left = `${task.x}px`;
    node.style.top = `${task.y}px`;
    taskBoard.appendChild(node);
  });

  emptyState.hidden = activeTasks.length > 0;
}

function editTask(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  const updated = window.prompt("Update mission:", task.text);
  if (updated === null) return;
  task.text = updated.trim() || task.text;
  saveState();
  renderTasks();
}

function deleteTask(taskId) {
  state.tasks = state.tasks.filter((task) => task.id !== taskId);
  saveState();
  renderTasks();
  updateProgress();
}

function clearTasks() {
  state.tasks = [];
  saveState();
  renderTasks();
  updateProgress();
  scheduleIdleReminder();
}

function completeTask(taskId, node) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;

  task.completed = true;
  saveState();

  const rect = node.getBoundingClientRect();
  node.classList.add("complete-burst");
  createSparkles(rect.left + rect.width / 2, rect.top + rect.height / 2, 16);
  triggerCompanionReaction();

  window.setTimeout(() => {
    renderTasks();
    updateProgress();
    scheduleIdleReminder();
  }, 340);
}

function triggerCompanionReaction() {
  const primary = companions.find((companion) => companion.id === state.selectedCompanion) || companions[0];
  const leadSprite = document.querySelector(".lead-sprite");

  if (leadSprite) {
    leadSprite.style.animation = `${primary.animation} 420ms steps(3) 2`;
    window.setTimeout(() => {
      leadSprite.style.animation = "";
    }, 900);
  }

  if (motivationText) {
    motivationText.textContent = primary.success;
    window.setTimeout(() => {
      motivationText.textContent = pickDailyMessage();
    }, 1500);
  }
}

function startDragging(event) {
  const note = event.target.closest(".task-note");
  if (!note) return;

  const taskId = note.dataset.taskId;
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;

  const boardRect = taskBoard.getBoundingClientRect();
  const noteRect = note.getBoundingClientRect();

  dragState = {
    task,
    note,
    offsetX: event.clientX - noteRect.left,
    offsetY: event.clientY - noteRect.top,
    boardRect
  };

  note.classList.add("dragging");
}

function handleDragging(event) {
  if (!dragState) return;

  const { note, offsetX, offsetY, boardRect, task } = dragState;
  const snappedX = snapToGrid(event.clientX - boardRect.left - offsetX);
  const snappedY = snapToGrid(event.clientY - boardRect.top - offsetY);
  const maxX = boardRect.width - note.offsetWidth;
  const maxY = boardRect.height - note.offsetHeight;

  task.x = clamp(snappedX, 0, Math.max(maxX, 0));
  task.y = clamp(snappedY, 0, Math.max(maxY, 0));
  note.style.left = `${task.x}px`;
  note.style.top = `${task.y}px`;
}

function stopDragging() {
  if (!dragState) return;
  dragState.note.classList.remove("dragging");
  saveState();
  dragState = null;
}

function toggleSound() {
  state.soundOn = !state.soundOn;
  soundToggle.textContent = `Sound: ${state.soundOn ? "On" : "Off"}`;
  saveState();
}

function toggleTheme() {
  state.theme = state.theme === "overworld" ? "galaxy" : "overworld";
  document.body.classList.toggle("overworld", state.theme === "overworld");
  themeToggle.textContent = state.theme === "overworld" ? "Overworld Mode" : "Galaxy Mode";
  saveState();
}

function updateProgress() {
  const total = state.tasks.length;
  const complete = state.tasks.filter((task) => task.completed).length;
  const ratio = total === 0 ? 0 : (complete / total) * 100;
  progressFill.style.width = `${ratio}%`;
  progressText.textContent = `${complete} / ${total}`;
}

function createSparkles(x, y, count = 12) {
  for (let index = 0; index < count; index += 1) {
    const sparkle = document.createElement("span");
    sparkle.className = "sparkle";
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;
    sparkle.style.setProperty("--dx", `${randomRange(-60, 60)}px`);
    sparkle.style.setProperty("--dy", `${randomRange(-70, 30)}px`);
    sparkle.style.background = index % 2 === 0 ? "#fbd000" : "#fff8dd";
    sparkleField.appendChild(sparkle);
    window.setTimeout(() => sparkle.remove(), 520);
  }
}

function scheduleIdleReminder() {
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    const primary = companions.find((companion) => companion.id === state.selectedCompanion) || companions[0];
    if (motivationText && state.tasks.some((task) => !task.completed)) {
      motivationText.textContent = `${primary.name} says: keep chipping away.`;
      window.setTimeout(() => {
        motivationText.textContent = primary.speech;
      }, 2200);
    }
  }, 20000);
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      tasks: parsed?.tasks ?? [],
      selectedCompanion: parsed?.selectedCompanion ?? "mario",
      soundOn: parsed?.soundOn ?? false,
      theme: parsed?.theme ?? "galaxy"
    };
  } catch {
    return {
      tasks: [],
      selectedCompanion: "mario",
      soundOn: false,
      theme: "galaxy"
    };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function pickDailyMessage() {
  const dayIndex = new Date().getDate() % motivationalMessages.length;
  return motivationalMessages[dayIndex];
}

function formatToday() {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric"
  }).format(new Date());
}

function priorityLabel(priority) {
  if (priority === "high") return "Star";
  if (priority === "low") return "Mush";
  return "Coin";
}

function snapToGrid(value) {
  return Math.round(value / 20) * 20;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

document.body.classList.toggle("overworld", state.theme === "overworld");
soundToggle.textContent = `Sound: ${state.soundOn ? "On" : "Off"}`;
themeToggle.textContent = state.theme === "overworld" ? "Overworld Mode" : "Galaxy Mode";

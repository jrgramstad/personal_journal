// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
let existingEntryId = null;
let isEditMode = false;
let currentView = 'today'; // 'today', 'history', or 'settings'
let currentJournalDate = null; // The date being journaled (YYYY-MM-DD), defaults to yesterday
let historyEntries = [];
let currentWeekStart = null; // Start of currently viewed week (Monday)
let currentCalendarMonth = new Date(); // Current month being displayed in calendar
let historySubView = 'calendar'; // 'calendar' or 'list'

// Built-in items for each category (can be hidden but not deleted)
const builtInItems = {
  banned: [
    { id: 'thc', label: 'THC' },
    { id: 'alcohol', label: 'Alcohol' },
    { id: 'fantasy_sports', label: 'Fantasy Sports' },
    { id: 'other_compulsion', label: 'Other' }
  ],
  recovery: [
    { id: 'naltrexone', label: 'Naltrexone' },
    { id: 'meeting_attended', label: 'Meeting' },
    { id: 'sponsor_contact', label: 'Sponsor Contact' },
    { id: 'therapy_this_week', label: 'Therapy This Week' }
  ],
  health: [
    { id: 'medications_taken', label: 'Medications' },
    { id: 'post_dinner_walk', label: 'Walk' },
    { id: 'meditation', label: 'Meditation' },
    { id: 'workout', label: 'Workout' }
  ]
};

// Settings: which items are visible (stored in localStorage)
let settings = {
  banned: {},    // { itemId: true/false }
  recovery: {},
  health: {}
};

// Custom items (stored in localStorage)
let customItems = {
  banned: [],    // [{ id: 'custom_xxx', label: 'Custom Label' }]
  recovery: [],
  health: []
};

// Static toggle fields (not dynamically rendered)
const staticToggleFields = [
  'ashley_conflict', 'ashley_thoughtful', 'ashley_withdrew',
  'kids_engaged', 'protected_peak_hours'
];

// Toggle field states (includes both built-in and custom)
const toggleStates = {};

// DOM Elements
const form = document.getElementById('journalForm');
const dateDisplay = document.getElementById('dateDisplay');
const editIndicator = document.getElementById('editIndicator');
const submitBtn = document.getElementById('submitBtn');
const toast = document.getElementById('toast');
const otherCompulsionField = document.getElementById('otherCompulsionField');
const historyView = document.getElementById('historyView');
const entryView = document.getElementById('entryView');
const settingsView = document.getElementById('settingsView');
const historyList = document.getElementById('historyList');
const tabBtns = document.querySelectorAll('.tab-btn');

// Toggle containers
const bannedToggles = document.getElementById('bannedToggles');
const recoveryToggles = document.getElementById('recoveryToggles');
const healthToggles = document.getElementById('healthToggles');

// Date navigator elements
const dateNav = document.getElementById('dateNav');
const dateNavLabel = document.getElementById('dateNavLabel');
const prevDayBtn = document.getElementById('prevDayBtn');
const nextDayBtn = document.getElementById('nextDayBtn');

// Streak elements
const streakDisplay = document.getElementById('streakDisplay');
const streakCount = document.getElementById('streakCount');
const streakLabel = document.querySelector('.streak-label');

// Calendar elements
const moodCalendar = document.getElementById('moodCalendar');
const calendarGrid = document.getElementById('calendarGrid');
const calendarMonthLabel = document.getElementById('calendarMonthLabel');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const listView = document.getElementById('listView');
const viewToggleBtns = document.querySelectorAll('.view-toggle-btn');

// Settings containers
const settingsBanned = document.getElementById('settingsBanned');
const settingsRecovery = document.getElementById('settingsRecovery');
const settingsHealth = document.getElementById('settingsHealth');

// Weekly summary DOM elements
const weekLabel = document.getElementById('weekLabel');
const prevWeekBtn = document.getElementById('prevWeekBtn');
const nextWeekBtn = document.getElementById('nextWeekBtn');
const summaryEntries = document.getElementById('summaryEntries');
const avgMood = document.getElementById('avgMood');
const avgEnergy = document.getElementById('avgEnergy');
const avgStress = document.getElementById('avgStress');
const naltrexoneFill = document.getElementById('naltrexoneFill');
const naltrexoneValue = document.getElementById('naltrexoneValue');
const meetingsCount = document.getElementById('meetingsCount');
const sponsorCount = document.getElementById('sponsorCount');
const avgCravings = document.getElementById('avgCravings');
const bannedSummary = document.getElementById('bannedSummary');
const highlightsSection = document.getElementById('highlightsSection');
const highlightsGrid = document.getElementById('highlightsGrid');

// Slider fields with their value display elements
const sliderFields = [
  'mood', 'energy', 'stress',
  'ashley_connection', 'kids_quality_time',
  'cravings', 'sleep_quality',
  'strategic_percent', 'decision_fatigue'
];

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  loadSettings();
  loadCustomItems();
  initializeToggleStates();
  setupDate();
  setupSliders();
  renderAllToggles();
  setupStaticToggles();
  setupForm();
  setupTabs();
  setupWeekNav();
  setupDateNav();
  setupCalendar();
  setupViewToggle();
  setupSettings();
  await loadEntry();
  await loadAndDisplayStreak();
}

// ===== SETTINGS MANAGEMENT =====

function loadSettings() {
  const saved = localStorage.getItem('journalSettings');
  if (saved) {
    settings = JSON.parse(saved);
  } else {
    // Default: all built-in items visible
    ['banned', 'recovery', 'health'].forEach(category => {
      settings[category] = {};
      builtInItems[category].forEach(item => {
        settings[category][item.id] = true;
      });
    });
    saveSettings();
  }
}

function saveSettings() {
  localStorage.setItem('journalSettings', JSON.stringify(settings));
}

function loadCustomItems() {
  const saved = localStorage.getItem('journalCustomItems');
  if (saved) {
    customItems = JSON.parse(saved);
  }
}

function saveCustomItems() {
  localStorage.setItem('journalCustomItems', JSON.stringify(customItems));
}

function initializeToggleStates() {
  // Initialize all built-in toggle states
  ['banned', 'recovery', 'health'].forEach(category => {
    builtInItems[category].forEach(item => {
      toggleStates[item.id] = false;
    });
    // Initialize custom toggle states
    customItems[category].forEach(item => {
      toggleStates[item.id] = false;
    });
  });

  // Initialize static toggle states
  staticToggleFields.forEach(field => {
    toggleStates[field] = false;
  });
}

function setupStaticToggles() {
  // Attach event listeners to static toggle buttons (relationships, work)
  staticToggleFields.forEach(field => {
    const btn = document.querySelector(`.toggle-btn[data-field="${field}"]`);
    if (btn) {
      btn.addEventListener('click', handleToggleClick);
    }
  });
}

function getVisibleItems(category) {
  const items = [];

  // Add visible built-in items
  builtInItems[category].forEach(item => {
    if (settings[category][item.id] !== false) {
      items.push({ ...item, isBuiltIn: true });
    }
  });

  // Add custom items (always visible if they exist)
  customItems[category].forEach(item => {
    items.push({ ...item, isBuiltIn: false });
  });

  return items;
}

// ===== TOGGLE RENDERING =====

function renderAllToggles() {
  renderCategoryToggles('banned', bannedToggles);
  renderCategoryToggles('recovery', recoveryToggles);
  renderCategoryToggles('health', healthToggles);
}

function renderCategoryToggles(category, container) {
  const items = getVisibleItems(category);

  container.innerHTML = items.map(item => `
    <button type="button" class="toggle-btn ${toggleStates[item.id] ? 'active' : ''}"
            data-field="${item.id}" data-category="${category}">
      ${item.label}
    </button>
  `).join('');

  // Re-attach click handlers
  container.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', handleToggleClick);
  });
}

function handleToggleClick(e) {
  const btn = e.currentTarget;
  const field = btn.dataset.field;

  toggleStates[field] = !toggleStates[field];
  btn.classList.toggle('active', toggleStates[field]);

  // Special handling for "Other" compulsion
  if (field === 'other_compulsion') {
    otherCompulsionField.classList.toggle('visible', toggleStates[field]);
    if (!toggleStates[field]) {
      document.getElementById('other_compulsion_notes').value = '';
    }
  }
}

// ===== SETTINGS UI =====

function setupSettings() {
  // Render settings items
  renderSettingsCategory('banned', settingsBanned);
  renderSettingsCategory('recovery', settingsRecovery);
  renderSettingsCategory('health', settingsHealth);

  // Setup add buttons
  document.querySelectorAll('.settings-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.category;
      const inputId = `new${category.charAt(0).toUpperCase() + category.slice(1)}Item`;
      const input = document.getElementById(inputId);
      const label = input.value.trim();

      if (label) {
        addCustomItem(category, label);
        input.value = '';
      }
    });
  });

  // Handle enter key on inputs
  ['newBannedItem', 'newRecoveryItem', 'newHealthItem'].forEach(inputId => {
    const input = document.getElementById(inputId);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const btn = input.nextElementSibling;
        btn.click();
      }
    });
  });
}

function renderSettingsCategory(category, container) {
  let html = '';

  // Built-in items
  builtInItems[category].forEach(item => {
    const isVisible = settings[category][item.id] !== false;
    html += `
      <div class="settings-item" data-id="${item.id}" data-category="${category}">
        <div class="settings-item-left">
          <span class="settings-item-name">${item.label}</span>
          <span class="settings-item-type">Built-in</span>
        </div>
        <div class="settings-item-actions">
          <button type="button" class="settings-toggle ${isVisible ? 'active' : ''}"
                  data-id="${item.id}" data-category="${category}" data-builtin="true"></button>
        </div>
      </div>
    `;
  });

  // Custom items
  customItems[category].forEach(item => {
    html += `
      <div class="settings-item" data-id="${item.id}" data-category="${category}">
        <div class="settings-item-left">
          <span class="settings-item-name">${item.label}</span>
          <span class="settings-item-type">Custom</span>
        </div>
        <div class="settings-item-actions">
          <button type="button" class="settings-delete-btn"
                  data-id="${item.id}" data-category="${category}">×</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Attach event handlers
  container.querySelectorAll('.settings-toggle').forEach(toggle => {
    toggle.addEventListener('click', handleSettingsToggle);
  });

  container.querySelectorAll('.settings-delete-btn').forEach(btn => {
    btn.addEventListener('click', handleDeleteCustomItem);
  });
}

function handleSettingsToggle(e) {
  const toggle = e.currentTarget;
  const id = toggle.dataset.id;
  const category = toggle.dataset.category;

  const isActive = toggle.classList.toggle('active');
  settings[category][id] = isActive;
  saveSettings();

  // Re-render the form toggles
  renderAllToggles();
}

function addCustomItem(category, label) {
  const id = `custom_${Date.now()}`;
  customItems[category].push({ id, label });
  toggleStates[id] = false;
  saveCustomItems();

  // Re-render
  const containers = {
    banned: settingsBanned,
    recovery: settingsRecovery,
    health: settingsHealth
  };
  renderSettingsCategory(category, containers[category]);
  renderAllToggles();

  showToast(`Added "${label}"`);
}

function handleDeleteCustomItem(e) {
  const btn = e.currentTarget;
  const id = btn.dataset.id;
  const category = btn.dataset.category;

  // Find and remove the item
  const index = customItems[category].findIndex(item => item.id === id);
  if (index !== -1) {
    const label = customItems[category][index].label;
    customItems[category].splice(index, 1);
    delete toggleStates[id];
    saveCustomItems();

    // Re-render
    const containers = {
      banned: settingsBanned,
      recovery: settingsRecovery,
      health: settingsHealth
    };
    renderSettingsCategory(category, containers[category]);
    renderAllToggles();

    showToast(`Removed "${label}"`);
  }
}

// ===== DATE & SLIDERS =====

function setupDate() {
  // Initialize to yesterday by default
  currentJournalDate = getYesterdayDateStr();
  updateDateDisplay();
}

function updateDateDisplay() {
  const date = new Date(currentJournalDate + 'T00:00:00');
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateStr = date.toLocaleDateString('en-US', options);

  // Header display
  dateDisplay.innerHTML = `<span class="reflecting-label">Reflecting on</span> ${dateStr}`;

  // Date navigator label
  const yesterday = getYesterdayDateStr();
  if (currentJournalDate === yesterday) {
    dateNavLabel.textContent = `Yesterday`;
  } else {
    const shortOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    dateNavLabel.textContent = date.toLocaleDateString('en-US', shortOptions);
  }

  // Enable/disable next button (can't go past yesterday)
  nextDayBtn.disabled = currentJournalDate >= yesterday;
}

function setupDateNav() {
  prevDayBtn.addEventListener('click', () => {
    navigateDate(-1);
  });

  nextDayBtn.addEventListener('click', () => {
    navigateDate(1);
  });
}

async function navigateDate(delta) {
  const date = new Date(currentJournalDate + 'T00:00:00');
  date.setDate(date.getDate() + delta);
  currentJournalDate = formatDate(date);

  updateDateDisplay();
  resetForm();
  await loadEntry();
}

function setupSliders() {
  sliderFields.forEach(field => {
    const slider = document.getElementById(field);
    const valueDisplay = document.getElementById(`${field}Value`);

    if (slider && valueDisplay) {
      updateSliderDisplay(slider, valueDisplay, field);
      slider.addEventListener('input', () => {
        updateSliderDisplay(slider, valueDisplay, field);
      });
    }
  });
}

function updateSliderDisplay(slider, valueDisplay, field) {
  if (field === 'strategic_percent') {
    valueDisplay.textContent = `${slider.value}%`;
  } else {
    valueDisplay.textContent = slider.value;
  }
}

// ===== FORM & TABS =====

function setupForm() {
  form.addEventListener('submit', handleSubmit);
}

function setupTabs() {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });
}

function setupWeekNav() {
  currentWeekStart = getWeekStart(new Date());

  prevWeekBtn.addEventListener('click', () => {
    currentWeekStart = new Date(currentWeekStart);
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    loadHistory();
  });

  nextWeekBtn.addEventListener('click', () => {
    currentWeekStart = new Date(currentWeekStart);
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    loadHistory();
  });
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(weekStart) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatWeekRange(weekStart) {
  const weekEnd = getWeekEnd(weekStart);
  const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });

  if (startMonth === endMonth) {
    return `${startMonth} ${weekStart.getDate()}-${weekEnd.getDate()}`;
  } else {
    return `${startMonth} ${weekStart.getDate()} - ${endMonth} ${weekEnd.getDate()}`;
  }
}

function switchTab(tab) {
  currentView = tab;

  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Hide all views
  entryView.style.display = 'none';
  historyView.style.display = 'none';
  settingsView.style.display = 'none';

  if (tab === 'history') {
    historyView.style.display = 'block';
    currentWeekStart = getWeekStart(new Date());
    loadHistory();
  } else if (tab === 'settings') {
    settingsView.style.display = 'block';
  } else {
    entryView.style.display = 'block';
    // Show date navigator
    dateNav.style.display = 'flex';
    // If coming from history edit, reset to yesterday
    if (document.querySelector('.back-btn')) {
      removeBackButton();
      currentJournalDate = getYesterdayDateStr();
      resetForm();
      updateDateDisplay();
      loadEntry();
    }
  }
}

// ===== HISTORY =====

async function loadHistory() {
  historyList.innerHTML = '<p class="loading">Loading entries...</p>';
  weekLabel.textContent = formatWeekRange(currentWeekStart);

  const thisWeekStart = getWeekStart(new Date());
  nextWeekBtn.disabled = currentWeekStart >= thisWeekStart;

  try {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .order('entry_date', { ascending: false });

    if (error) {
      console.error('Error loading history:', error);
      historyList.innerHTML = '<p class="history-empty">Error loading entries</p>';
      return;
    }

    historyEntries = data || [];

    // Render based on active sub-view
    if (historySubView === 'calendar') {
      renderCalendar();
    } else {
      renderWeeklySummary();
      renderHistory();
    }
  } catch (err) {
    console.error('Error:', err);
    historyList.innerHTML = '<p class="history-empty">Error connecting to database</p>';
  }
}

function getWeekEntries() {
  const weekStart = formatDate(currentWeekStart);
  const weekEnd = formatDate(getWeekEnd(currentWeekStart));

  return historyEntries.filter(entry => {
    return entry.entry_date >= weekStart && entry.entry_date <= weekEnd;
  });
}

function renderWeeklySummary() {
  const weekEntries = getWeekEntries();
  const entryCount = weekEntries.length;

  summaryEntries.textContent = `${entryCount} of 7 days`;

  if (entryCount === 0) {
    avgMood.textContent = '-';
    avgEnergy.textContent = '-';
    avgStress.textContent = '-';
    naltrexoneFill.style.width = '0%';
    naltrexoneValue.textContent = '0/0';
    meetingsCount.textContent = '0';
    sponsorCount.textContent = '0';
    avgCravings.textContent = '-';
    bannedSummary.innerHTML = '<span class="banned-clean">No data this week</span>';
    highlightsSection.style.display = 'none';
    return;
  }

  const moodAvg = calculateAverage(weekEntries, 'mood');
  const energyAvg = calculateAverage(weekEntries, 'energy');
  const stressAvg = calculateAverage(weekEntries, 'stress');
  const cravingsAvg = calculateAverage(weekEntries, 'cravings');

  avgMood.textContent = moodAvg !== null ? moodAvg.toFixed(1) : '-';
  avgEnergy.textContent = energyAvg !== null ? energyAvg.toFixed(1) : '-';
  avgStress.textContent = stressAvg !== null ? stressAvg.toFixed(1) : '-';
  avgCravings.textContent = cravingsAvg !== null ? cravingsAvg.toFixed(1) : '-';

  const naltrexoneCount = weekEntries.filter(e => e.naltrexone).length;
  const meetingCount = weekEntries.filter(e => e.meeting_attended).length;
  const sponsorContactCount = weekEntries.filter(e => e.sponsor_contact).length;

  const naltrexonePercent = (naltrexoneCount / entryCount) * 100;
  naltrexoneFill.style.width = `${naltrexonePercent}%`;
  naltrexoneValue.textContent = `${naltrexoneCount}/${entryCount}`;
  meetingsCount.textContent = meetingCount;
  sponsorCount.textContent = sponsorContactCount;

  // Calculate banned behaviors (including custom)
  const bannedBehaviors = {};

  // Built-in banned items
  builtInItems.banned.forEach(item => {
    if (item.id !== 'other_compulsion') {
      const count = weekEntries.filter(e => e[item.id]).length;
      if (count > 0) bannedBehaviors[item.label] = count;
    }
  });

  // Other compulsion
  const otherCount = weekEntries.filter(e => e.other_compulsion).length;
  if (otherCount > 0) bannedBehaviors['Other'] = otherCount;

  // Custom banned items
  customItems.banned.forEach(item => {
    let count = 0;
    weekEntries.forEach(entry => {
      if (entry.custom_banned && entry.custom_banned[item.id]) {
        count++;
      }
    });
    if (count > 0) bannedBehaviors[item.label] = count;
  });

  const totalIncidents = Object.values(bannedBehaviors).reduce((a, b) => a + b, 0);

  if (totalIncidents === 0) {
    bannedSummary.innerHTML = '<span class="banned-clean">Clean week!</span>';
  } else {
    const incidentHtml = Object.entries(bannedBehaviors)
      .map(([name, count]) => `<span class="banned-incident">${name}: ${count}</span>`)
      .join('');
    bannedSummary.innerHTML = incidentHtml;
  }

  renderHighlights(weekEntries);
}

function calculateAverage(entries, field) {
  const values = entries.map(e => e[field]).filter(v => v !== null && v !== undefined);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function renderHighlights(entries) {
  if (entries.length < 2) {
    highlightsSection.style.display = 'none';
    return;
  }

  const highlights = [];

  const bestMood = entries.reduce((best, entry) => {
    if (entry.mood !== null && (best === null || entry.mood > best.mood)) {
      return entry;
    }
    return best;
  }, null);

  if (bestMood && bestMood.mood !== null) {
    const date = new Date(bestMood.entry_date + 'T00:00:00');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    highlights.push({
      label: 'Best mood',
      value: `${dayName} (${bestMood.mood})`
    });
  }

  const bestEnergy = entries.reduce((best, entry) => {
    if (entry.energy !== null && (best === null || entry.energy > best.energy)) {
      return entry;
    }
    return best;
  }, null);

  if (bestEnergy && bestEnergy.energy !== null && bestEnergy !== bestMood) {
    const date = new Date(bestEnergy.entry_date + 'T00:00:00');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    highlights.push({
      label: 'Highest energy',
      value: `${dayName} (${bestEnergy.energy})`
    });
  }

  const lowestStress = entries.reduce((best, entry) => {
    if (entry.stress !== null && (best === null || entry.stress < best.stress)) {
      return entry;
    }
    return best;
  }, null);

  if (lowestStress && lowestStress.stress !== null) {
    const date = new Date(lowestStress.entry_date + 'T00:00:00');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    highlights.push({
      label: 'Lowest stress',
      value: `${dayName} (${lowestStress.stress})`
    });
  }

  if (highlights.length === 0) {
    highlightsSection.style.display = 'none';
    return;
  }

  highlightsSection.style.display = 'block';
  highlightsGrid.innerHTML = highlights.map(h => `
    <div class="highlight-item">
      <span class="highlight-label">${h.label}</span>
      <span class="highlight-value">${h.value}</span>
    </div>
  `).join('');
}

function renderHistory() {
  const weekEntries = getWeekEntries();

  if (weekEntries.length === 0) {
    historyList.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">📓</div>
        <p>No entries this week.<br>Start journaling today!</p>
      </div>
    `;
    return;
  }

  historyList.innerHTML = weekEntries.map(entry => {
    const date = new Date(entry.entry_date + 'T00:00:00');
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const flags = [];
    if (entry.thc) flags.push('THC');
    if (entry.alcohol) flags.push('Alcohol');
    if (entry.fantasy_sports) flags.push('Fantasy');
    if (entry.other_compulsion) flags.push('Other');

    // Check custom banned items
    if (entry.custom_banned) {
      customItems.banned.forEach(item => {
        if (entry.custom_banned[item.id]) {
          flags.push(item.label);
        }
      });
    }

    const flagsHtml = flags.length > 0
      ? `<div class="history-card-flags">${flags.map(f => `<span class="history-card-flag">${f}</span>`).join('')}</div>`
      : '';

    return `
      <div class="history-card" data-date="${entry.entry_date}">
        <div class="history-card-date">${dateStr}</div>
        <div class="history-card-stats">
          <span class="history-card-stat">Mood <span class="value">${entry.mood || '-'}</span></span>
          <span class="history-card-stat">Energy <span class="value">${entry.energy || '-'}</span></span>
          <span class="history-card-stat">Stress <span class="value">${entry.stress || '-'}</span></span>
        </div>
        ${flagsHtml}
      </div>
    `;
  }).join('');

  document.querySelectorAll('.history-card').forEach(card => {
    card.addEventListener('click', () => {
      const date = card.dataset.date;
      selectEntry(date);
    });
  });
}

// ===== MOOD CALENDAR =====

function setupCalendar() {
  prevMonthBtn.addEventListener('click', () => {
    currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() - 1);
    renderCalendar();
  });

  nextMonthBtn.addEventListener('click', () => {
    currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + 1);
    renderCalendar();
  });
}

function setupViewToggle() {
  viewToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      historySubView = view;

      viewToggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (view === 'calendar') {
        moodCalendar.style.display = 'block';
        listView.style.display = 'none';
        renderCalendar();
      } else {
        moodCalendar.style.display = 'none';
        listView.style.display = 'block';
      }
    });
  });
}

function renderCalendar() {
  const year = currentCalendarMonth.getFullYear();
  const month = currentCalendarMonth.getMonth();

  // Update month label
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  calendarMonthLabel.textContent = `${monthNames[month]} ${year}`;

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Create entry lookup map
  const entryMap = {};
  historyEntries.forEach(entry => {
    entryMap[entry.entry_date] = entry;
  });

  // Get today and yesterday for comparison
  const today = new Date();
  const todayStr = formatDate(today);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);

  // Build calendar HTML
  let html = '';

  // Empty cells for days before first of month
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-day empty"></div>';
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const entry = entryMap[dateStr];
    const isToday = dateStr === todayStr;
    const isFuture = dateStr > yesterdayStr;

    let classes = ['calendar-day'];

    if (isToday) {
      classes.push('today');
    }

    if (entry) {
      classes.push('has-entry');
      const mood = entry.mood;
      if (mood >= 1 && mood <= 3) {
        classes.push('mood-low');
      } else if (mood >= 4 && mood <= 5) {
        classes.push('mood-mid');
      } else if (mood >= 6 && mood <= 7) {
        classes.push('mood-good');
      } else if (mood >= 8 && mood <= 10) {
        classes.push('mood-great');
      }
    } else if (!isFuture) {
      classes.push('no-mood');
    }

    const clickable = !isFuture;
    html += `<div class="${classes.join(' ')}" ${clickable ? `data-date="${dateStr}"` : ''}>${day}</div>`;
  }

  calendarGrid.innerHTML = html;

  // Add click handlers
  calendarGrid.querySelectorAll('.calendar-day[data-date]').forEach(dayEl => {
    dayEl.addEventListener('click', () => {
      const date = dayEl.dataset.date;
      openDateEntry(date);
    });
  });
}

function openDateEntry(date) {
  // Check if there's an existing entry
  const entry = historyEntries.find(e => e.entry_date === date);

  currentJournalDate = date;

  historyView.style.display = 'none';
  entryView.style.display = 'block';

  // Hide date navigator when editing from calendar
  dateNav.style.display = 'none';

  tabBtns.forEach(btn => {
    btn.classList.remove('active');
  });

  addBackButton();
  updateDateDisplay();
  resetForm();

  if (entry) {
    existingEntryId = entry.id;
    isEditMode = true;
    editIndicator.style.display = 'inline-block';
    submitBtn.textContent = 'Update Entry';
    populateForm(entry);
  } else {
    existingEntryId = null;
    isEditMode = false;
    editIndicator.style.display = 'none';
    submitBtn.textContent = 'Save Entry';
  }
}

async function selectEntry(date) {
  currentJournalDate = date;

  const entry = historyEntries.find(e => e.entry_date === date);
  if (!entry) return;

  historyView.style.display = 'none';
  entryView.style.display = 'block';

  // Hide date navigator when editing from history
  dateNav.style.display = 'none';

  tabBtns.forEach(btn => {
    btn.classList.remove('active');
  });

  addBackButton();
  updateDateDisplay();

  resetForm();
  existingEntryId = entry.id;
  isEditMode = true;
  editIndicator.style.display = 'inline-block';
  submitBtn.textContent = 'Update Entry';
  populateForm(entry);
}

function addBackButton() {
  if (document.querySelector('.back-btn')) return;

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'back-btn';
  backBtn.innerHTML = '← Back to History';
  backBtn.addEventListener('click', () => {
    switchTab('history');
  });

  entryView.insertBefore(backBtn, entryView.firstChild);
}

function removeBackButton() {
  const backBtn = document.querySelector('.back-btn');
  if (backBtn) {
    backBtn.remove();
  }
}

function resetForm() {
  sliderFields.forEach(field => {
    const slider = document.getElementById(field);
    const valueDisplay = document.getElementById(`${field}Value`);
    if (slider) {
      slider.value = field === 'strategic_percent' ? 50 : 5;
      updateSliderDisplay(slider, valueDisplay, field);
    }
  });

  // Reset all toggle states
  Object.keys(toggleStates).forEach(field => {
    toggleStates[field] = false;
  });

  // Re-render toggles to update UI
  renderAllToggles();

  otherCompulsionField.classList.remove('visible');

  document.getElementById('productive_hours').value = '';
  document.getElementById('other_compulsion_notes').value = '';
  document.getElementById('what_went_well').value = '';
  document.getElementById('what_to_change').value = '';
  document.getElementById('tomorrow_priority').value = '';

  existingEntryId = null;
  isEditMode = false;
  editIndicator.style.display = 'none';
  submitBtn.textContent = 'Save Entry';
}

async function loadEntry() {
  try {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('entry_date', currentJournalDate)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading entry:', error);
      showToast('Error loading entry', true);
      return;
    }

    if (data) {
      existingEntryId = data.id;
      isEditMode = true;
      editIndicator.style.display = 'inline-block';
      submitBtn.textContent = 'Update Entry';
      populateForm(data);
    }
  } catch (err) {
    console.error('Error:', err);
    showToast('Error connecting to database', true);
  }
}

function populateForm(data) {
  sliderFields.forEach(field => {
    const slider = document.getElementById(field);
    const valueDisplay = document.getElementById(`${field}Value`);

    if (slider && data[field] !== null && data[field] !== undefined) {
      slider.value = data[field];
      updateSliderDisplay(slider, valueDisplay, field);
    }
  });

  // Populate built-in toggles
  builtInItems.banned.forEach(item => {
    if (data[item.id] !== null && data[item.id] !== undefined) {
      toggleStates[item.id] = data[item.id];
    }
  });

  builtInItems.recovery.forEach(item => {
    if (data[item.id] !== null && data[item.id] !== undefined) {
      toggleStates[item.id] = data[item.id];
    }
  });

  builtInItems.health.forEach(item => {
    if (data[item.id] !== null && data[item.id] !== undefined) {
      toggleStates[item.id] = data[item.id];
    }
  });

  // Populate custom toggles
  ['banned', 'recovery', 'health'].forEach(category => {
    const customData = data[`custom_${category}`] || {};
    customItems[category].forEach(item => {
      toggleStates[item.id] = customData[item.id] || false;
    });
  });

  // Re-render toggles to update UI
  renderAllToggles();

  if (toggleStates.other_compulsion) {
    otherCompulsionField.classList.add('visible');
  }

  if (data.productive_hours !== null) {
    document.getElementById('productive_hours').value = data.productive_hours;
  }

  if (data.other_compulsion_notes) {
    document.getElementById('other_compulsion_notes').value = data.other_compulsion_notes;
  }
  if (data.what_went_well) {
    document.getElementById('what_went_well').value = data.what_went_well;
  }
  if (data.what_to_change) {
    document.getElementById('what_to_change').value = data.what_to_change;
  }
  if (data.tomorrow_priority) {
    document.getElementById('tomorrow_priority').value = data.tomorrow_priority;
  }
}

async function handleSubmit(e) {
  e.preventDefault();

  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  const entryData = collectFormData();

  try {
    let result;

    if (isEditMode && existingEntryId) {
      result = await supabase
        .from('journal_entries')
        .update(entryData)
        .eq('id', existingEntryId)
        .select();
    } else {
      result = await supabase
        .from('journal_entries')
        .insert(entryData)
        .select();
    }

    if (result.error) {
      throw result.error;
    }

    if (result.data && result.data[0]) {
      existingEntryId = result.data[0].id;
      isEditMode = true;
      editIndicator.style.display = 'inline-block';
    }

    showToast(isEditMode ? 'Entry updated!' : 'Entry saved!');
    submitBtn.textContent = 'Update Entry';

    if (historyEntries.length > 0) {
      const updatedEntry = result.data[0];
      const existingIndex = historyEntries.findIndex(e => e.entry_date === updatedEntry.entry_date);
      if (existingIndex >= 0) {
        historyEntries[existingIndex] = updatedEntry;
      } else {
        historyEntries.unshift(updatedEntry);
      }
    }

    // Refresh streak after saving
    await loadAndDisplayStreak();

  } catch (err) {
    console.error('Error saving entry:', err);
    showToast('Error saving entry. Please try again.', true);
    submitBtn.textContent = isEditMode ? 'Update Entry' : 'Save Entry';
  } finally {
    submitBtn.disabled = false;
  }
}

function collectFormData() {
  const productiveHours = document.getElementById('productive_hours').value;
  const entryDate = currentJournalDate;

  // Collect custom toggle values
  const customBanned = {};
  const customRecovery = {};
  const customHealth = {};

  customItems.banned.forEach(item => {
    customBanned[item.id] = toggleStates[item.id] || false;
  });

  customItems.recovery.forEach(item => {
    customRecovery[item.id] = toggleStates[item.id] || false;
  });

  customItems.health.forEach(item => {
    customHealth[item.id] = toggleStates[item.id] || false;
  });

  return {
    entry_date: entryDate,

    mood: parseInt(document.getElementById('mood').value),
    energy: parseInt(document.getElementById('energy').value),
    stress: parseInt(document.getElementById('stress').value),

    ashley_connection: parseInt(document.getElementById('ashley_connection').value),
    ashley_conflict: toggleStates.ashley_conflict || false,
    ashley_thoughtful: toggleStates.ashley_thoughtful || false,
    ashley_withdrew: toggleStates.ashley_withdrew || false,
    kids_quality_time: parseInt(document.getElementById('kids_quality_time').value),
    kids_engaged: toggleStates.kids_engaged || false,

    thc: toggleStates.thc || false,
    alcohol: toggleStates.alcohol || false,
    fantasy_sports: toggleStates.fantasy_sports || false,
    other_compulsion: toggleStates.other_compulsion || false,
    other_compulsion_notes: toggleStates.other_compulsion ?
      document.getElementById('other_compulsion_notes').value : null,

    naltrexone: toggleStates.naltrexone || false,
    meeting_attended: toggleStates.meeting_attended || false,
    sponsor_contact: toggleStates.sponsor_contact || false,
    therapy_this_week: toggleStates.therapy_this_week || false,
    cravings: parseInt(document.getElementById('cravings').value),

    medications_taken: toggleStates.medications_taken || false,
    post_dinner_walk: toggleStates.post_dinner_walk || false,
    meditation: toggleStates.meditation || false,
    workout: toggleStates.workout || false,
    sleep_quality: parseInt(document.getElementById('sleep_quality').value),

    productive_hours: productiveHours ? parseFloat(productiveHours) : null,
    strategic_percent: parseInt(document.getElementById('strategic_percent').value),
    decision_fatigue: parseInt(document.getElementById('decision_fatigue').value),
    protected_peak_hours: toggleStates.protected_peak_hours || false,

    what_went_well: document.getElementById('what_went_well').value || null,
    what_to_change: document.getElementById('what_to_change').value || null,
    tomorrow_priority: document.getElementById('tomorrow_priority').value || null,

    // Custom fields
    custom_banned: Object.keys(customBanned).length > 0 ? customBanned : null,
    custom_recovery: Object.keys(customRecovery).length > 0 ? customRecovery : null,
    custom_health: Object.keys(customHealth).length > 0 ? customHealth : null
  };
}

function getYesterdayDateStr() {
  // Returns yesterday's date as YYYY-MM-DD string
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatDate(yesterday);
}

// ===== STREAK CALCULATION =====

async function loadAndDisplayStreak() {
  try {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('entry_date')
      .order('entry_date', { ascending: false });

    if (error) {
      console.error('Error loading streak data:', error);
      return;
    }

    const streak = calculateStreak(data || []);
    displayStreak(streak);
  } catch (err) {
    console.error('Error calculating streak:', err);
  }
}

function calculateStreak(entries) {
  if (entries.length === 0) return 0;

  // Get all entry dates as a Set for fast lookup
  const entryDates = new Set(entries.map(e => e.entry_date));

  // Start from yesterday and count backwards
  let streak = 0;
  let checkDate = new Date();
  checkDate.setDate(checkDate.getDate() - 1); // Start from yesterday

  while (true) {
    const dateStr = formatDate(checkDate);
    if (entryDates.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1); // Go back one day
    } else {
      break; // Streak broken
    }
  }

  return streak;
}

function displayStreak(streak) {
  if (streak > 0) {
    streakDisplay.style.display = 'flex';
    streakCount.textContent = streak;
    streakLabel.textContent = streak === 1 ? 'day streak' : 'day streak';
  } else {
    streakDisplay.style.display = 'none';
  }
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

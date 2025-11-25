// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
let existingEntryId = null;
let isEditMode = false;
let currentView = 'today'; // 'today' or 'history'
let selectedDate = null; // null means today, otherwise YYYY-MM-DD
let historyEntries = [];
let currentWeekStart = null; // Start of currently viewed week (Monday)

// Toggle field states
const toggleStates = {
  ashley_conflict: false,
  ashley_thoughtful: false,
  ashley_withdrew: false,
  kids_engaged: false,
  thc: false,
  alcohol: false,
  fantasy_sports: false,
  other_compulsion: false,
  naltrexone: false,
  meeting_attended: false,
  sponsor_contact: false,
  therapy_this_week: false,
  medications_taken: false,
  post_dinner_walk: false,
  meditation: false,
  workout: false,
  protected_peak_hours: false
};

// DOM Elements
const form = document.getElementById('journalForm');
const dateDisplay = document.getElementById('dateDisplay');
const editIndicator = document.getElementById('editIndicator');
const submitBtn = document.getElementById('submitBtn');
const toast = document.getElementById('toast');
const otherCompulsionField = document.getElementById('otherCompulsionField');
const historyView = document.getElementById('historyView');
const entryView = document.getElementById('entryView');
const historyList = document.getElementById('historyList');
const tabBtns = document.querySelectorAll('.tab-btn');

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
  setupDate();
  setupSliders();
  setupToggles();
  setupForm();
  setupTabs();
  setupWeekNav();
  await loadTodayEntry();
}

function setupDate() {
  updateDateDisplay(new Date());
}

function updateDateDisplay(date) {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  dateDisplay.textContent = date.toLocaleDateString('en-US', options);
}

function setupSliders() {
  sliderFields.forEach(field => {
    const slider = document.getElementById(field);
    const valueDisplay = document.getElementById(`${field}Value`);

    if (slider && valueDisplay) {
      // Set initial display
      updateSliderDisplay(slider, valueDisplay, field);

      // Add input listener
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

function setupToggles() {
  const toggleBtns = document.querySelectorAll('.toggle-btn');

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
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
    });
  });
}

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
  // Initialize to current week
  currentWeekStart = getWeekStart(new Date());

  prevWeekBtn.addEventListener('click', () => {
    // Go to previous week
    currentWeekStart = new Date(currentWeekStart);
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    loadHistory();
  });

  nextWeekBtn.addEventListener('click', () => {
    // Go to next week
    currentWeekStart = new Date(currentWeekStart);
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    loadHistory();
  });
}

// Get Monday of the week for a given date
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Get Sunday of the week
function getWeekEnd(weekStart) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
}

// Format date as YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format week range for display
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

  // Update tab buttons
  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Show/hide views
  if (tab === 'history') {
    entryView.style.display = 'none';
    historyView.style.display = 'block';
    // Reset to current week when switching to history
    currentWeekStart = getWeekStart(new Date());
    loadHistory();
  } else {
    historyView.style.display = 'none';
    entryView.style.display = 'block';
    // Reset to today if coming from history
    if (selectedDate) {
      selectedDate = null;
      removeBackButton();
      resetForm();
      updateDateDisplay(new Date());
      loadTodayEntry();
    }
  }
}

async function loadHistory() {
  historyList.innerHTML = '<p class="loading">Loading entries...</p>';

  // Update week label
  weekLabel.textContent = formatWeekRange(currentWeekStart);

  // Disable next button if we're on current week
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

    // Calculate and render weekly summary
    renderWeeklySummary();

    // Filter and render history for current week
    renderHistory();
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

  // Update entries count
  summaryEntries.textContent = `${entryCount} of 7 days`;

  if (entryCount === 0) {
    // No entries - show defaults
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

  // Calculate averages
  const moodAvg = calculateAverage(weekEntries, 'mood');
  const energyAvg = calculateAverage(weekEntries, 'energy');
  const stressAvg = calculateAverage(weekEntries, 'stress');
  const cravingsAvg = calculateAverage(weekEntries, 'cravings');

  avgMood.textContent = moodAvg !== null ? moodAvg.toFixed(1) : '-';
  avgEnergy.textContent = energyAvg !== null ? energyAvg.toFixed(1) : '-';
  avgStress.textContent = stressAvg !== null ? stressAvg.toFixed(1) : '-';
  avgCravings.textContent = cravingsAvg !== null ? cravingsAvg.toFixed(1) : '-';

  // Calculate recovery compliance
  const naltrexoneCount = weekEntries.filter(e => e.naltrexone).length;
  const meetingCount = weekEntries.filter(e => e.meeting_attended).length;
  const sponsorContactCount = weekEntries.filter(e => e.sponsor_contact).length;

  const naltrexonePercent = (naltrexoneCount / entryCount) * 100;
  naltrexoneFill.style.width = `${naltrexonePercent}%`;
  naltrexoneValue.textContent = `${naltrexoneCount}/${entryCount}`;
  meetingsCount.textContent = meetingCount;
  sponsorCount.textContent = sponsorContactCount;

  // Calculate banned behaviors
  const bannedBehaviors = {
    THC: weekEntries.filter(e => e.thc).length,
    Alcohol: weekEntries.filter(e => e.alcohol).length,
    Fantasy: weekEntries.filter(e => e.fantasy_sports).length,
    Other: weekEntries.filter(e => e.other_compulsion).length
  };

  const totalIncidents = Object.values(bannedBehaviors).reduce((a, b) => a + b, 0);

  if (totalIncidents === 0) {
    bannedSummary.innerHTML = '<span class="banned-clean">Clean week!</span>';
  } else {
    const incidentHtml = Object.entries(bannedBehaviors)
      .filter(([_, count]) => count > 0)
      .map(([name, count]) => `<span class="banned-incident">${name}: ${count}</span>`)
      .join('');
    bannedSummary.innerHTML = incidentHtml;
  }

  // Calculate highlights (best mood day)
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

  // Find best mood day
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

  // Find highest energy day
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

  // Find lowest stress day
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

    // Collect flags for banned behaviors
    const flags = [];
    if (entry.thc) flags.push('THC');
    if (entry.alcohol) flags.push('Alcohol');
    if (entry.fantasy_sports) flags.push('Fantasy');
    if (entry.other_compulsion) flags.push('Other');

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

  // Add click handlers
  document.querySelectorAll('.history-card').forEach(card => {
    card.addEventListener('click', () => {
      const date = card.dataset.date;
      selectEntry(date);
    });
  });
}

async function selectEntry(date) {
  selectedDate = date;

  // Find entry in cached data
  const entry = historyEntries.find(e => e.entry_date === date);
  if (!entry) return;

  // Switch to entry view
  historyView.style.display = 'none';
  entryView.style.display = 'block';

  // Update tab buttons to show neither as truly "active" visually
  tabBtns.forEach(btn => {
    btn.classList.remove('active');
  });

  // Add back button if not already present
  addBackButton();

  // Update date display
  const entryDate = new Date(date + 'T00:00:00');
  updateDateDisplay(entryDate);

  // Reset and populate form
  resetForm();
  existingEntryId = entry.id;
  isEditMode = true;
  editIndicator.style.display = 'inline-block';
  submitBtn.textContent = 'Update Entry';
  populateForm(entry);
}

function addBackButton() {
  // Check if back button already exists
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
  // Reset sliders to default
  sliderFields.forEach(field => {
    const slider = document.getElementById(field);
    const valueDisplay = document.getElementById(`${field}Value`);
    if (slider) {
      slider.value = field === 'strategic_percent' ? 50 : 5;
      updateSliderDisplay(slider, valueDisplay, field);
    }
  });

  // Reset toggles
  Object.keys(toggleStates).forEach(field => {
    toggleStates[field] = false;
    const btn = document.querySelector(`[data-field="${field}"]`);
    if (btn) {
      btn.classList.remove('active');
    }
  });

  // Hide other compulsion field
  otherCompulsionField.classList.remove('visible');

  // Clear text inputs
  document.getElementById('productive_hours').value = '';
  document.getElementById('other_compulsion_notes').value = '';
  document.getElementById('what_went_well').value = '';
  document.getElementById('what_to_change').value = '';
  document.getElementById('tomorrow_priority').value = '';

  // Reset state
  existingEntryId = null;
  isEditMode = false;
  editIndicator.style.display = 'none';
  submitBtn.textContent = 'Save Entry';
}

async function loadTodayEntry() {
  const today = getTodayDate();

  try {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('entry_date', today)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
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
  // Populate sliders
  sliderFields.forEach(field => {
    const slider = document.getElementById(field);
    const valueDisplay = document.getElementById(`${field}Value`);

    if (slider && data[field] !== null && data[field] !== undefined) {
      slider.value = data[field];
      updateSliderDisplay(slider, valueDisplay, field);
    }
  });

  // Populate toggles
  Object.keys(toggleStates).forEach(field => {
    if (data[field] !== null && data[field] !== undefined) {
      toggleStates[field] = data[field];
      const btn = document.querySelector(`[data-field="${field}"]`);
      if (btn) {
        btn.classList.toggle('active', data[field]);
      }
    }
  });

  // Show other compulsion field if needed
  if (toggleStates.other_compulsion) {
    otherCompulsionField.classList.add('visible');
  }

  // Populate number input
  if (data.productive_hours !== null) {
    document.getElementById('productive_hours').value = data.productive_hours;
  }

  // Populate text fields
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
      // Update existing entry
      result = await supabase
        .from('journal_entries')
        .update(entryData)
        .eq('id', existingEntryId)
        .select();
    } else {
      // Insert new entry
      result = await supabase
        .from('journal_entries')
        .insert(entryData)
        .select();
    }

    if (result.error) {
      throw result.error;
    }

    // Update state for potential future edits
    if (result.data && result.data[0]) {
      existingEntryId = result.data[0].id;
      isEditMode = true;
      editIndicator.style.display = 'inline-block';
    }

    showToast(isEditMode ? 'Entry updated!' : 'Entry saved!');
    submitBtn.textContent = 'Update Entry';

    // Update history cache if we have one
    if (historyEntries.length > 0) {
      const updatedEntry = result.data[0];
      const existingIndex = historyEntries.findIndex(e => e.entry_date === updatedEntry.entry_date);
      if (existingIndex >= 0) {
        historyEntries[existingIndex] = updatedEntry;
      } else {
        historyEntries.unshift(updatedEntry);
      }
    }

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

  // Use selected date or today
  const entryDate = selectedDate || getTodayDate();

  return {
    entry_date: entryDate,

    // Mood & Energy
    mood: parseInt(document.getElementById('mood').value),
    energy: parseInt(document.getElementById('energy').value),
    stress: parseInt(document.getElementById('stress').value),

    // Relationships
    ashley_connection: parseInt(document.getElementById('ashley_connection').value),
    ashley_conflict: toggleStates.ashley_conflict,
    ashley_thoughtful: toggleStates.ashley_thoughtful,
    ashley_withdrew: toggleStates.ashley_withdrew,
    kids_quality_time: parseInt(document.getElementById('kids_quality_time').value),
    kids_engaged: toggleStates.kids_engaged,

    // Banned Behaviors
    thc: toggleStates.thc,
    alcohol: toggleStates.alcohol,
    fantasy_sports: toggleStates.fantasy_sports,
    other_compulsion: toggleStates.other_compulsion,
    other_compulsion_notes: toggleStates.other_compulsion ?
      document.getElementById('other_compulsion_notes').value : null,

    // Recovery
    naltrexone: toggleStates.naltrexone,
    meeting_attended: toggleStates.meeting_attended,
    sponsor_contact: toggleStates.sponsor_contact,
    therapy_this_week: toggleStates.therapy_this_week,
    cravings: parseInt(document.getElementById('cravings').value),

    // Health
    medications_taken: toggleStates.medications_taken,
    post_dinner_walk: toggleStates.post_dinner_walk,
    meditation: toggleStates.meditation,
    workout: toggleStates.workout,
    sleep_quality: parseInt(document.getElementById('sleep_quality').value),

    // Work
    productive_hours: productiveHours ? parseFloat(productiveHours) : null,
    strategic_percent: parseInt(document.getElementById('strategic_percent').value),
    decision_fatigue: parseInt(document.getElementById('decision_fatigue').value),
    protected_peak_hours: toggleStates.protected_peak_hours,

    // Reflection
    what_went_well: document.getElementById('what_went_well').value || null,
    what_to_change: document.getElementById('what_to_change').value || null,
    tomorrow_priority: document.getElementById('tomorrow_priority').value || null
  };
}

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

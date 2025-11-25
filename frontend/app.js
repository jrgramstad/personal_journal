// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
let existingEntryId = null;
let isEditMode = false;

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
  await loadTodayEntry();
}

function setupDate() {
  const today = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  dateDisplay.textContent = today.toLocaleDateString('en-US', options);
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

  return {
    entry_date: getTodayDate(),

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

/***** CONFIG *****/
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbznS7TY6iUUqqdxnq8bayxmB6P8bZRzml__uAbAONEZk7wcLdCvyGTuVlNZq8aykiBX/exec'; // e.g., https://script.google.com/macros/s/AKfycb.../exec
const TOKEN    = 'AIS2025WORKREPORT';

/***** Page setup *****/
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('todayNote').textContent = `Local time zone: ${tz}`;
  document.querySelector('input[name="date"]').valueAsDate = new Date();
  loadDropdowns();
});

/***** JSONP helper (CORS-free) *****/
function jsonp(url){
  return new Promise(resolve => {
    const cb = 'cb_' + Math.random().toString(36).slice(2);
    window[cb] = (data) => { resolve(data); delete window[cb]; script.remove(); };
    const script = document.createElement('script');
    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cb;
    document.body.appendChild(script);
  });
}

/***** Data caches *****/
let activityTree = {};  // { Activity: [sub1, sub2, ...] }
let activities   = [];  // ["Electronic AIP (eAIP)", "AMDB", ...]
let names        = [];

/***** Populate helper *****/
function fillSelect(selectEl, items, placeholderText){
  selectEl.innerHTML = '';
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = placeholderText || 'Select...';
  selectEl.appendChild(ph);
  for (const v of items){
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v;
    selectEl.appendChild(opt);
  }
}

/***** Dynamic row: Activity -> Sub-activity (dependent) -> Task *****/
function createRow(){
  const row = document.createElement('div');
  row.className = 'row';

  // Activity
  const actLabel = document.createElement('label');
  actLabel.textContent = 'Activity';
  const actSelect = document.createElement('select');
  actSelect.name = 'activity[]';
  actSelect.required = true;
  fillSelect(actSelect, activities, 'Select activity…');
  actLabel.appendChild(actSelect);

  // Sub-activity (depends on activity)
  const subLabel = document.createElement('label');
  subLabel.textContent = 'Sub-activity';
  const subSelect = document.createElement('select');
  subSelect.name = 'sub_activity[]';
  subSelect.required = true;
  fillSelect(subSelect, [], 'Select sub-activity…');
  subLabel.appendChild(subSelect);

  // Task (details)
  const taskLabel = document.createElement('label');
  taskLabel.textContent = 'Task (what was done)';
  const taskArea = document.createElement('textarea');
  taskArea.name = 'task[]';
  taskArea.placeholder = 'Describe the task/work done…';
  taskArea.required = true;
  taskLabel.appendChild(taskArea);

  // Remove button
  const controls = document.createElement('div');
  controls.className = 'controls';
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'small-btn';
  removeBtn.textContent = '✕ Remove';
  removeBtn.addEventListener('click', () => {
    const container = row.parentElement;
    if (container.querySelectorAll('.row').length > 1) {
      row.remove();
    } else {
      actSelect.value = '';
      fillSelect(subSelect, [], 'Select sub-activity…');
      taskArea.value = '';
    }
  });
  controls.appendChild(removeBtn);

  // Dependency: update subs when activity changes
  actSelect.addEventListener('change', () => {
    const act = actSelect.value;
    const subs = (activityTree[act] || []).slice().sort((a,b)=>a.localeCompare(b));
    fillSelect(subSelect, subs, 'Select sub-activity…');
  });

  row.appendChild(actLabel);
  row.appendChild(subLabel);
  row.appendChild(taskLabel);
  row.appendChild(controls);
  return row;
}

function addActivityRow(){
  const container = document.getElementById('activityRows');
  container.appendChild(createRow());
}
document.getElementById('addActivity').addEventListener('click', addActivityRow);

/***** Load names + activity tree *****/
async function loadDropdowns(){
  try {
    activityTree = await jsonp(`${ENDPOINT}?q=activityTree`) || {};
    activities = Object.keys(activityTree).sort((a,b)=>a.localeCompare(b));

    names = await jsonp(`${ENDPOINT}?q=names`) || [];
    fillSelect(document.getElementById('nameSelect'), names, 'Select your name…');

    addActivityRow(); // initial row
  } catch (e) {
    console.warn('Failed to load dropdowns', e);
    addActivityRow();
  }
}

/***** Submit (Option 1: no-cors) *****/
const form = document.getElementById('reportForm');
const msg  = document.getElementById('msg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) {
    msg.className = 'alert err';
    msg.textContent = 'Please fill all required fields.';
    return;
  }
  msg.className = 'note';
  msg.textContent = 'Submitting…';

  const data = new FormData(form);
  data.append('token', TOKEN);
  const body = new URLSearchParams(data); // preserves arrays

  try {
    await fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', body });
    msg.className = 'alert ok';
    msg.textContent = 'Submitted! Thank you.';
    form.reset();
    document.querySelector('input[name="date"]').valueAsDate = new Date();
    document.getElementById('activityRows').innerHTML = '';
    addActivityRow();
  } catch (err) {
    msg.className = 'alert err';
    msg.textContent = 'Network error. Please try again.';
  }
});

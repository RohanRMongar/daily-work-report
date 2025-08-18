/***** CONFIG *****/
const ENDPOINT =
  "https://script.google.com/macros/s/AKfycbz6cF4wvK0c3c_AW6m0le55qY5p2tzGo3LZ5fFoPWFI3g_-ordlyCLByuw451HMrpZn/exec";
const TOKEN = "AIS2025WORKREPORT";

/***** Utilities *****/
function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/***** Page setup *****/
document.addEventListener("DOMContentLoaded", () => {
  const dateInput = document.getElementById("dateInput");
  const todayStr = ymdLocal(new Date());
  dateInput.min = todayStr;
  dateInput.value = todayStr;

  document.getElementById("reportForm").addEventListener("reset", () => {
    setTimeout(() => {
      dateInput.min = todayStr;
      dateInput.value = todayStr;
    }, 0);
  });

  loadDropdowns();
});

/***** JSONP helper (CORS-free) *****/
function jsonp(url) {
  return new Promise((resolve) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    window[cb] = (data) => {
      resolve(data);
      delete window[cb];
      script.remove();
    };
    const script = document.createElement("script");
    script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb;
    document.body.appendChild(script);
  });
}

/***** Data caches *****/
let activityTree = {};
let activities = [];
let names = [];

/***** Populate helper *****/
function fillSelect(selectEl, items, placeholderText) {
  selectEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = placeholderText || "Select...";
  selectEl.appendChild(ph);
  for (const v of items) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  }
}

/***** Dynamic row: Activity -> Sub-activity -> Task *****/
function createRow() {
  const row = document.createElement("div");
  row.className = "row";

  const actLabel = document.createElement("label");
  actLabel.textContent = "Activity";
  const actSelect = document.createElement("select");
  actSelect.name = "activity[]";
  actSelect.required = true;
  fillSelect(actSelect, activities, "Select activity...");
  actLabel.appendChild(actSelect);

  const subLabel = document.createElement("label");
  subLabel.textContent = "Sub-activity";
  const subSelect = document.createElement("select");
  subSelect.name = "sub_activity[]";
  subSelect.required = true;
  fillSelect(subSelect, [], "Select sub-activity...");
  subLabel.appendChild(subSelect);

  const taskLabel = document.createElement("label");
  taskLabel.textContent = "Task (what was done)";
  const taskArea = document.createElement("textarea");
  taskArea.name = "task[]";
  taskArea.placeholder = "Describe the task/work done…";
  taskArea.required = true;
  taskLabel.appendChild(taskArea);

  const controls = document.createElement("div");
  controls.className = "controls";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "small-btn";
  removeBtn.textContent = "✕ Remove";
  removeBtn.addEventListener("click", () => {
    const container = row.parentElement;
    if (container.querySelectorAll(".row").length > 1) {
      row.remove();
    } else {
      actSelect.value = "";
      fillSelect(subSelect, [], "Select sub-activity…");
      taskArea.value = "";
    }
  });
  controls.appendChild(removeBtn);

  actSelect.addEventListener("change", () => {
    const act = actSelect.value;
    const subs = (activityTree[act] || []).slice().sort((a, b) => a.localeCompare(b));
    fillSelect(subSelect, subs, "Select sub-activity…");
  });

  row.appendChild(actLabel);
  row.appendChild(subLabel);
  row.appendChild(taskLabel);
  row.appendChild(controls);
  return row;
}

function addActivityRow() {
  const container = document.getElementById("activityRows");
  container.appendChild(createRow());
}
document.getElementById("addActivity").addEventListener("click", addActivityRow);

/***** Load names + activity tree *****/
async function loadDropdowns() {
  try {
    activityTree = (await jsonp(`${ENDPOINT}?q=activityTree`)) || {};
    activities = Object.keys(activityTree).sort((a, b) => a.localeCompare(b));

    const ns = await jsonp(`${ENDPOINT}?q=names`);
    names = ns || [];
    fillSelect(document.getElementById("nameSelect"), names, "Select your name…");

    addActivityRow();
  } catch (e) {
    console.warn("Failed to load dropdowns", e);
    addActivityRow();
  }
}

/***** Submit *****/
/***** Submit (idempotent) *****/
const form = document.getElementById("reportForm");
const msg = document.getElementById("msg");
const submitBtn = form.querySelector('button[type="submit"]');
let submitting = false;

function makeSID() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'sid-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (submitting) return; // already in-flight
  submitting = true;
  if (submitBtn) { submitBtn.disabled = true; submitBtn.style.pointerEvents = 'none'; }

  const dateInput = document.getElementById("dateInput");
  if (dateInput.value && dateInput.min && dateInput.value < dateInput.min) {
    msg.className = "alert err";
    msg.textContent = "Past dates are not allowed. Please select today or a future date.";
    submitting = false;
    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.pointerEvents = ''; }
    dateInput.focus();
    return;
  }
  if (!form.reportValidity()) {
    msg.className = "alert err";
    msg.textContent = "Please fill all required fields.";
    submitting = false;
    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.pointerEvents = ''; }
    return;
  }

  msg.className = "note";
  msg.textContent = "Submitting…";

  const data = new FormData(form);
  data.append("token", TOKEN);
  data.append("sid", makeSID()); // <— send unique id per submission
  const body = new URLSearchParams(data);

  try {
    await fetch(ENDPOINT, { method: "POST", mode: "no-cors", body });
    msg.className = "alert ok";
    msg.textContent = "Submitted! Thank you.";
    form.reset();

    const todayStr = ymdLocal(new Date());
    dateInput.min = todayStr;
    dateInput.value = todayStr;

    document.getElementById("activityRows").innerHTML = "";
    addActivityRow();
  } catch (err) {
    msg.className = "alert err";
    msg.textContent = "Network error. Please try again.";
  } finally {
    submitting = false;
    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.pointerEvents = ''; }
  }
});

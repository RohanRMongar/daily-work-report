/***** CONFIG *****/
const ENDPOINT =
  "https://script.google.com/macros/s/AKfycbznS7TY6iUUqqdxnq8bayxmB6P8bZRzml__uAbAONEZk7wcLdCvyGTuVlNZq8aykiBX/exec"; // replace with your current Web App URL
const TOKEN = "AIS2025WORKREPORT";

/***** Utilities *****/
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/***** Page setup *****/
document.addEventListener("DOMContentLoaded", () => {
  // Safely set the note if the element exists
  const noteEl = document.getElementById("todayNote");
  if (noteEl) noteEl.textContent = `Local time zone: ${tz}`;

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
    const script = document.createElement("script");
    window[cb] = (data) => {
      resolve(data);
      delete window[cb];
      script.remove();
    };
    script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb;
    document.body.appendChild(script);
  });
}

/***** Data caches *****/
let activityTree = {}; // { Activity: [sub1, sub2, ...] }
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

/***** Dynamic row: Activity -> Sub-activity (dependent) -> Task *****/
function createRow() {
  const row = document.createElement("div");
  row.className = "row";

  // Activity
  const actLabel = document.createElement("label");
  actLabel.textContent = "Activity";
  const actSelect = document.createElement("select");
  actSelect.name = "activity[]";
  actSelect.required = true;
  fillSelect(actSelect, activities, "Select activity...");
  actLabel.appendChild(actSelect);

  // Sub-activity (depends on activity)
  const subLabel = document.createElement("label");
  subLabel.textContent = "Sub-activity";
  const subSelect = document.createElement("select");
  subSelect.name = "sub_activity[]";
  subSelect.required = true;
  fillSelect(subSelect, [], "Select sub-activity...");
  subLabel.appendChild(subSelect);

  // Task (details)
  const taskLabel = document.createElement("label");
  taskLabel.textContent = "Task (what was done)";
  const taskArea = document.createElement("textarea");
  taskArea.name = "task[]";
  taskArea.placeholder = "Describe the task/work done…";
  taskArea.required = true;
  taskLabel.appendChild(taskArea);

  // Remove button
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

  // Dependency: load subs when activity changes
  actSelect.addEventListener("change", () => {
    const act = actSelect.value;
    const subs = (activityTree[act] || [])
      .slice()
      .sort((a, b) => a.localeCompare(b));
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
    fillSelect(
      document.getElementById("nameSelect"),
      names,
      "Select your name…"
    );

    addActivityRow(); // initial
  } catch (e) {
    console.warn("Failed to load dropdowns", e);
    addActivityRow();
  }
}

/***** Submit (no-cors) with "no past dates" guard *****/
const form = document.getElementById("reportForm");
const msg = document.getElementById("msg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const dateInput = document.getElementById("dateInput");
  if (dateInput.value && dateInput.min && dateInput.value < dateInput.min) {
    msg.className = "alert err";
    msg.textContent =
      "Past dates are not allowed. Please select today or a future date.";
    dateInput.focus();
    return;
  }
  if (!form.reportValidity()) {
    msg.className = "alert err";
    msg.textContent = "Please fill all required fields.";
    return;
  }

  msg.className = "note";
  msg.textContent = "Submitting…";

  const data = new FormData(form);
  data.append("token", TOKEN);
  const body = new URLSearchParams(data); // preserves arrays

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
  }
});

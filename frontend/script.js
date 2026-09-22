// ---------- Configuration ----------
// Point this at your deployed FastAPI service. While developing locally,
// requests go to a local uvicorn server instead.
const API_BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8000"
    : "https://credit-ledger-ehj1.onrender.com";

// ---------- Element refs ----------
const form = document.getElementById("risk-form");
const submitBtn = document.getElementById("submit-btn");
const formError = document.getElementById("form-error");
const resultPanel = document.getElementById("result-panel");

const gaugeProgress = document.getElementById("gauge-progress");
const gaugeNeedle = document.getElementById("gauge-needle");
const gaugeNumber = document.getElementById("gauge-number");
const verdict = document.getElementById("verdict");
const breakdown = document.getElementById("breakdown");
const breakdownThreshold = document.getElementById("breakdown-threshold");
const breakdownProbability = document.getElementById("breakdown-probability");

const arcLength = gaugeProgress.getTotalLength();
gaugeProgress.style.strokeDasharray = `0 ${arcLength}`;

// The fields that are numbers in the pydantic model — everything else is a string.
const NUMERIC_FIELDS = new Set([
  "person_age",
  "person_income",
  "person_emp_length",
  "loan_amnt",
  "loan_int_rate",
  "loan_percent_income",
  "cb_person_cred_hist_length",
]);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.textContent = "";

  const formData = new FormData(form);
  const payload = {};
  for (const [key, value] of formData.entries()) {
    payload[key] = NUMERIC_FIELDS.has(key) ? Number(value) : value;
  }

  setLoading(true);

  try {
    // const response = await fetch(`${API_BASE_URL}/predict`, {
    const response = await fetch('https://credit-ledger-ehj1.onrender.com/predict', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await safeErrorDetail(response);
      throw new Error(detail || `The model service returned an error (${response.status}).`);
    }

    const data = await response.json();
    renderResult(data);
  } catch (err) {
    console.error(err);
    formError.textContent =
      err.message === "Failed to fetch"
        ? "Couldn't reach the risk model. Check that the API is running and reachable."
        : err.message;
  } finally {
    setLoading(false);
  }
});

async function safeErrorDetail(response) {
  try {
    const body = await response.json();
    return typeof body.detail === "string" ? body.detail : null;
  } catch {
    return null;
  }
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
}

function renderResult(data) {
  const probability = Number(data.default_probability);
  const threshold = Number(data.threshold);
  const isHighRisk = data.default_prediction === 1;

  // Gauge sweep
  gaugeProgress.style.strokeDasharray = `${probability * arcLength} ${arcLength}`;
  gaugeNeedle.style.transform = `rotate(${-90 + probability * 180}deg)`;
  gaugeProgress.style.stroke = isHighRisk
    ? "var(--brick)"
    : "var(--sage)";

  animateNumber(probability * 100);

  // Verdict
  const outcome = isHighRisk ? "high" : "low";
  verdict.innerHTML = `<p class="verdict-label" data-outcome="${outcome}">${data.Result}</p>`;
  resultPanel.setAttribute("data-outcome", outcome);

  // Breakdown
  breakdown.hidden = false;
  breakdownThreshold.textContent = `${(threshold * 100).toFixed(1)}%`;
  breakdownProbability.textContent = `${(probability * 100).toFixed(1)}%`;
}

function animateNumber(target) {
  const duration = 700;
  const start = performance.now();
  const from = 0;

  function tick(now) {
    const elapsed = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - elapsed, 3);
    const value = from + (target - from) * eased;
    gaugeNumber.textContent = `${value.toFixed(1)}%`;
    if (elapsed < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

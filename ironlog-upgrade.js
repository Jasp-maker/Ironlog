
/* IRONLOG ADAPTIVE PROGRESS COACH v4.1
   Individual rep targets, smart load progression, recovery flags,
   personal records, strength trends, weekly score and workout recovery.
   Preserves ironlog_v1 history and ironlog_draft_v1.
*/

(() => {
  "use strict";

  const DRAFT_KEY = "ironlog_draft_v1";

  // Capture the ORIGINAL global functions before overriding them.
  const originalOpenWorkout = window.openWorkout;
  const originalRenderExercises = window.renderExercises;
  const originalFinish = window.finish;
  const originalRenderHome = window.renderHome;
  const originalRenderProgress = window.renderProgress;
  const originalPrescription = window.prescription;

  // ---------- SAFE DATA HELPERS ----------

  function todayKey() {
    return new Date().toDateString();
  }

  function readDraft() {
    try {
      const value = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      return value && value.dateKey === todayKey() && plan[value.name]
        ? value : null;
    } catch (_) {
      return null;
    }
  }

  function saveDraft() {
    if (!current || !draft || !plan[current]) return;

    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        name: current,
        dateKey: todayKey(),
        savedAt: new Date().toISOString(),
        entries: draft
      }));
    } catch (error) {
      console.warn("IronLog could not save draft.", error);
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (_) {}
  }

  function weightOf(set) {
    const value = Number(set?.weight);

    return set?.weight !== "" &&
      Number.isFinite(value) &&
      value > 0 ? value : null;
  }

  function validSet(set) {
    return !!set &&
      set.reps !== "" &&
      Number.isFinite(Number(set.reps)) &&
      Number(set.reps) > 0;
  }

  function recordsFor(name, index) {
    return db.history
      .filter(record =>
        record.name === name &&
        Array.isArray(record.entries?.[index]) &&
        record.entries[index].some(validSet)
      )
      .slice()
      .sort((a, b) =>
        new Date(a.date || 0) - new Date(b.date || 0)
      );
  }

  function completeRecordsFor(name, index, setCount) {
    return recordsFor(name, index).filter(record => {
      const rows = record.entries[index] || [];

      return rows.length >= setCount &&
        rows.slice(0, setCount).every(validSet);
    });
  }

  function parseTarget(target) {
    const value = String(target);
    const range = value.match(/(\d+)\s*[–-]\s*(\d+)/);

    if (range) {
      return {
        min: Number(range[1]),
        max: Number(range[2]),
        timed: /sec/i.test(value)
      };
    }

    const fixed = value.match(/^(\d+)(?:\s+each side)?$/i);

    if (fixed) {
      return {
        min: Number(fixed[1]),
        max: Number(fixed[1]),
        timed: false
      };
    }

    return null;
  }

  function median(values) {
    if (!values.length) return null;

    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function exerciseName(name, index) {
    return plan[name]?.items?.[index]?.[0] ||
      `Exercise ${index + 1}`;
  }

  // ---------- INDIVIDUAL NEXT-SESSION TARGETS ----------

  function nextRepAim(name, index, base) {
    const range = parseTarget(base.target);
    if (!range) return null;

    const records = completeRecordsFor(
      name,
      index,
      base.sets
    );

    if (!records.length) return null;

    const latest = records[records.length - 1];
    const rows = latest.entries[index].slice(0, base.sets);
    const reps = rows.map(set => Number(set.reps));

    const allTop = reps.every(value => value >= range.max);

    if (allTop) {
      return reps.map(() => range.min);
    }

    return reps.map(value => {
      if (value < range.min) return range.min;
      return Math.min(range.max, value + 1);
    });
  }

  // IMPORTANT: This is deliberately named adaptivePrescription.
  // It does NOT shadow the original global prescription function.

  function adaptivePrescription(name, index) {
    const base = originalPrescription(name, index);

    const aim = base.deload
      ? null
      : nextRepAim(name, index, base);

    const targetText = aim
      ? `${base.target} · next aim: ${aim.join(" / ")}`
      : base.target;

    const advice = progression(name, index, base);

    return {
      ...base,
      target: targetText,
      suggestedWeight: advice.suggestedWeight || null,
      coachTitle: advice.title,
      nextAim: aim
    };
  }

  // Install the adaptive version globally, after capturing the original.
  window.prescription = adaptivePrescription;

  // ---------- ADAPTIVE COACH ----------

  function progression(name, index, rx) {
    rx = rx || originalPrescription(name, index);

    const target = String(rx.target);
    const range = parseTarget(
      originalPrescription(name, index).target
    );

    const records = completeRecordsFor(
      name,
      index,
      rx.sets
    );

    const previous = records.length
      ? records[records.length - 1]
      : null;

    const timed = range?.timed ||
      /sec/i.test(target);

    const eachSide = /each side/i.test(target);

    const unit = timed
      ? "seconds"
      : eachSide
        ? "reps per side"
        : "reps";

    if (rx.deload) {
      return {
        title: "Recovery week",
        detail:
          "Keep effort comfortable. Use lighter loads, controlled technique and avoid chasing personal records."
      };
    }

    if (!previous || !range) {
      return {
        title: "Build your baseline",
        detail:
          `Aim for ${originalPrescription(name, index).target} on each set. IronLog will personalise your next targets as you log sessions.`
      };
    }

    const rows = previous.entries[index].slice(0, rx.sets);
    const reps = rows.map(set => Number(set.reps));
    const weights = rows
      .map(weightOf)
      .filter(value => value !== null);

    const allTop = reps.every(value => value >= range.max);
    const belowMinimum = reps.some(value => value < range.min);

    if (records.length >= 2) {
      const older = records[records.length - 2];
      const olderRows = older.entries[index].slice(0, rx.sets);

      const olderTotal = olderRows.reduce(
        (sum, set) => sum + Number(set.reps), 0
      );

      const currentTotal = reps.reduce(
        (sum, value) => sum + value, 0
      );

      if (
        olderTotal > 0 &&
        currentTotal <= olderTotal * 0.8
      ) {
        return {
          title: "Recovery check",
          detail:
            "Your total reps have dropped by 20% or more compared with your previous complete session. Keep the load steady or reduce it if needed. Check sleep, stress and recovery. If this continues, consider a lighter session or deload."
        };
      }
    }

    if (belowMinimum) {
      return {
        title: "Consolidate your performance",
        detail:
          `Some sets fell below ${range.min} ${unit}. Keep the load steady or reduce it slightly if needed to achieve controlled repetitions.`
      };
    }

    if (allTop) {
      if (timed) {
        return {
          title: "Target hold achieved",
          detail:
            "You've reached the top of your timed target on every set. Maintain good technique before progressing to a harder variation."
        };
      }

      const load = median(weights);

      if (load !== null) {
        const increment = load < 20 ? 1 : 2.5;

        const suggested = Math.ceil(
          (load + increment) * 2
        ) / 2;

        return {
          title: "Ready for progressive overload",
          detail:
            `You reached ${range.max} ${unit} on every set. Consider ${suggested} kg next time if technique and recovery are good.`,
          suggestedWeight: suggested
        };
      }

      return {
        title: "Bodyweight progression achieved",
        detail:
          "You've reached the top of your target. Consider a slightly harder variation or a small amount of additional resistance when ready."
      };
    }

    return {
      title: "Build towards the top of the range",
      detail:
        `Keep your current working weight and aim to add repetitions towards ${range.max} ${unit}. Increase the load only when all sets reach the top of the range.`
    };
  }

  // ---------- PERSONAL RECORDS ----------

  function personalRecord(name, index) {
    let best = null;

    db.history.forEach(record => {
      if (record.name !== name) return;

      (record.entries?.[index] || []).forEach(set => {
        if (!validSet(set)) return;

        const weight = weightOf(set);
        if (weight === null) return;

        const reps = Number(set.reps);

        if (
          !best ||
          weight > best.weight ||
          (weight === best.weight && reps > best.reps)
        ) {
          best = {
            weight,
            reps,
            date: record.date,
            workout: record.name
          };
        }
      });
    });

    return best;
  }

  function allExercises() {
    const list = [];

    Object.keys(plan).forEach(name => {
      plan[name].items.forEach((item, index) => {
        list.push({
          name,
          index,
          exercise: item[0],
          pr: personalRecord(name, index)
        });
      });
    });

    return list;
  }

  // ---------- STRENGTH TREND ----------

  function trendFor(name, index) {
    return recordsFor(name, index)
      .map(record => {
        const sets = (record.entries?.[index] || [])
          .filter(validSet);

        const weights = sets
          .map(weightOf)
          .filter(value => value !== null);

        return {
          date: record.date,
          weight: weights.length
            ? Math.max(...weights)
            : 0,
          reps: sets.length
            ? Math.max(...sets.map(s => Number(s.reps)))
            : 0
        };
      })
      .slice(-8);
  }

  function trendChart(name, index) {
    const trend = trendFor(name, index);

    if (!trend.length) {
      return '<p class="muted small">Log this exercise to start building your strength chart.</p>';
    }

    const max = Math.max(1, ...trend.map(point => point.weight));

    return `
      <div class="il-chart">
        ${trend.map(point => {
          const height = point.weight
            ? Math.max(8, point.weight / max * 100)
            : 5;

          const date = point.date
            ? new Date(point.date).toLocaleDateString(
                undefined,
                { day: "numeric", month: "short" }
              )
            : "Session";

          return `
            <div class="il-bar-wrap">
              <div class="il-bar-value">${point.weight || "—"}</div>
              <div class="il-bar" style="height:${height}%"></div>
              <div class="il-bar-date">${esc(date)}</div>
            </div>`;
        }).join("")}
      </div>
      <p class="muted small">Highest recorded weight per session · kg</p>
    `;
  }

  // ---------- WEEKLY REPORT AND SCORE ----------

  function weeklyReport() {
    const now = new Date();
    const start = new Date(now);

    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    const recent = db.history.filter(record => {
      const date = new Date(record.date);

      return !isNaN(date) &&
        date >= start &&
        date <= now;
    });

    let sets = 0;
    let expectedSets = 0;
    let volume = 0;

    recent.forEach(record => {
      const workout = plan[record.name];
      if (!workout) return;

      workout.items.forEach((item, index) => {
        const baseSets = item[1];

        const prescribed = Number(record.week) === 7
          ? Math.max(1, Math.ceil(baseSets / 2))
          : baseSets;

        expectedSets += prescribed;

        const rows = record.entries?.[index] || [];

        rows.slice(0, prescribed).forEach(set => {
          if (!validSet(set)) return;

          sets++;

          const weight = weightOf(set);
          const reps = Number(set.reps);

          if (weight !== null) {
            volume += weight * reps;
          }
        });
      });
    });

    const sessionScore = Math.min(recent.length / 4, 1) * 50;

    const completion = expectedSets
      ? Math.min(sets / expectedSets, 1)
      : 0;

    const score = Math.round(sessionScore + completion * 50);

    return {
      sessions: recent.length,
      sets,
      volume: Math.round(volume),
      score,
      completion: Math.round(completion * 100)
    };
  }

  // ---------- STYLES ----------

  function addCoachStyles() {
    if (document.getElementById("il-coach-styles")) return;

    const style = document.createElement("style");
    style.id = "il-coach-styles";

    style.textContent = `
      .il-coach-card {
        background:var(--panel);
        border:1px solid var(--line);
        border-radius:17px;
        padding:15px;
        margin:14px 0;
      }
      .il-coach-heading {
        color:var(--accent);
        font-weight:850;
        margin-bottom:10px;
      }
      .il-coach-grid {
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:8px;
      }
      .il-coach-stat {
        background:var(--panel2);
        padding:11px 8px;
        border-radius:11px;
        min-width:0;
      }
      .il-coach-stat b {
        display:block;
        font-size:19px;
        overflow-wrap:anywhere;
      }
      .il-coach-stat small {
        color:var(--muted);
        font-size:11px;
      }
      .il-pr-row {
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        padding:10px 0;
        border-top:1px solid var(--line);
      }
      .il-pr-row:first-child {border-top:0}
      .il-pr-value {
        color:var(--accent);
        font-weight:850;
        text-align:right;
      }
      .il-chart {
        display:flex;
        align-items:flex-end;
        gap:7px;
        height:145px;
        padding:10px 2px 0;
        border-bottom:1px solid var(--line);
      }
      .il-bar-wrap {
        flex:1;
        height:100%;
        display:flex;
        flex-direction:column;
        justify-content:flex-end;
        align-items:center;
        min-width:0;
      }
      .il-bar {
        width:75%;
        min-height:3px;
        background:var(--accent);
        border-radius:6px 6px 2px 2px;
      }
      .il-bar-value {
        font-size:10px;
        color:var(--text);
        margin-bottom:4px;
      }
      .il-bar-date {
        font-size:9px;
        color:var(--muted);
        margin-top:5px;
        white-space:nowrap;
      }
      .il-select {
        width:100%;
        margin:8px 0 12px;
      }
      .il-pr-list {
        max-height:420px;
        overflow:auto;
      }
      .il-adaptive-note {
        margin-top:10px;
        padding:12px;
        border-radius:12px;
        background:#17283a;
        border:1px solid var(--line);
        font-size:13px;
      }
      .il-adaptive-note strong {
        color:var(--accent);
      }
      .il-adaptive-action {
        display:block;
        width:100%;
        margin-top:10px;
        font-size:12px;
      }
      .il-score {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:12px;
        border-radius:12px;
        background:var(--panel2);
        margin:10px 0 16px;
      }
      .il-score b {
        color:var(--accent);
        font-size:28px;
      }
      .il-score small {
        display:block;
        color:var(--muted);
      }
    `;

    document.head.appendChild(style);
  }

  // ---------- APPLY SUGGESTED WEIGHT ----------

  function applySuggestedWeight(index, weight) {
    if (!current || !draft[index]) return;

    const rx = originalPrescription(current, index);

    for (let i = 0; i < rx.sets; i++) {
      if (!draft[index][i]) {
        draft[index][i] = { weight: "", reps: "" };
      }

      if (draft[index][i].weight === "") {
        draft[index][i].weight = String(weight);
      }
    }

    renderExercises();
    saveDraft();
  }

  // ---------- WORKOUT SCREEN ----------

  window.renderExercises = function () {
    originalRenderExercises();

    const cards = document.querySelectorAll(
      "#exerciseList > .card"
    );

    cards.forEach((card, index) => {
      card.querySelectorAll(
        ".smart-tip, .il-adaptive-note"
      ).forEach(element => element.remove());

      const rx = originalPrescription(current, index);
      const advice = progression(current, index, rx);

      const note = document.createElement("div");
      note.className = "il-adaptive-note";

      let action = "";

      if (
        advice.suggestedWeight &&
        !rx.deload
      ) {
        action = `
          <button
            type="button"
            class="secondary il-adaptive-action"
            data-apply-weight="${advice.suggestedWeight}"
            data-apply-ex="${index}">
            Use suggested ${advice.suggestedWeight} kg for empty sets
          </button>`;
      }

      note.innerHTML = `
        <strong>${esc(advice.title)}</strong>
        <div style="margin-top:5px">${esc(advice.detail)}</div>
        ${action}
      `;

      const previous = card.querySelector(".notice");

      if (previous) {
        previous.insertAdjacentElement("afterend", note);
      } else {
        card.appendChild(note);
      }
    });

    document.querySelectorAll(
      "[data-apply-weight]"
    ).forEach(button => {
      button.onclick = () => {
        applySuggestedWeight(
          Number(button.dataset.applyEx),
          Number(button.dataset.applyWeight)
        );
      };
    });

    document.querySelectorAll(
      "#exerciseList input"
    ).forEach(input => {
      input.addEventListener("input", saveDraft);
      input.addEventListener("change", saveDraft);
    });
  };

  // ---------- WORKOUT RECOVERY ----------

  window.openWorkout = function (name) {
    const saved = readDraft();

    if (saved && saved.name !== name) {
      const resumeFirst = confirm(
        `You have an unfinished ${saved.name} workout. Press OK to resume it, or Cancel to start ${name} and replace that unfinished draft.`
      );

      if (resumeFirst) {
        name = saved.name;
      } else {
        clearDraft();
      }
    }

    originalOpenWorkout(name);

    const recoverable =
      saved && saved.name === name
        ? saved
        : null;

    if (recoverable) {
      draft = recoverable.entries &&
        typeof recoverable.entries === "object"
          ? recoverable.entries
          : {};

      plan[name].items.forEach((item, index) => {
        const wanted = originalPrescription(name, index).sets;

        if (!Array.isArray(draft[index])) {
          draft[index] = [];
        }

        while (draft[index].length < wanted) {
          draft[index].push({
            weight: "",
            reps: ""
          });
        }
      });

      renderExercises();

      const stamp = new Date(recoverable.savedAt)
        .toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        });

      const meta = document.getElementById("workoutMeta");

      if (meta) {
        meta.textContent =
          `${plan[name].focus} · unfinished workout restored (saved ${stamp})`;
      }
    }

    saveDraft();
  };

  window.finish = function () {
    const hasEntries = Object.values(draft || {}).some(rows =>
      Array.isArray(rows) &&
      rows.some(set =>
        set &&
        (set.weight !== "" || set.reps !== "")
      )
    );

    if (!hasEntries) {
      originalFinish();
      return;
    }

    originalFinish();
    clearDraft();
    renderHome();
  };

  window.renderHome = function () {
    originalRenderHome();

    const saved = readDraft();

    const hero = document.querySelector(
      "#todayPage .hero"
    );

    if (!hero) return;

    let resume = document.getElementById(
      "resumeWorkout"
    );

    if (saved) {
      if (!resume) {
        resume = document.createElement("button");
        resume.id = "resumeWorkout";
        resume.className = "secondary";
        resume.style.marginTop = "10px";
        hero.appendChild(resume);
      }

      const when = new Date(saved.savedAt)
        .toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        });

      resume.textContent =
        `Resume ${saved.name} workout · saved ${when}`;

      resume.onclick = () => openWorkout(saved.name);
    } else if (resume) {
      resume.remove();
    }
  };

  // ---------- PROGRESS DASHBOARD ----------

  function renderCoachDashboard() {
    addCoachStyles();

    const historyCard = document
      .getElementById("historyList")
      ?.closest(".card");

    if (!historyCard) return;

    let dashboard = document.getElementById(
      "ilCoachDashboard"
    );

    if (!dashboard) {
      dashboard = document.createElement("div");
      dashboard.id = "ilCoachDashboard";

      historyCard.insertAdjacentElement(
        "beforebegin",
        dashboard
      );
    }

    const week = weeklyReport();
    const exercises = allExercises();
    const records = exercises.filter(item => item.pr);

    dashboard.className = "il-coach-card";

    dashboard.innerHTML = `
      <div class="il-coach-heading">
        IRONLOG ADAPTIVE PROGRESS COACH
      </div>

      <h3>Weekly training score</h3>

      <div class="il-score">
        <div>
          <b>${week.score}%</b>
          <small>Based on sessions and recorded sets over the last 7 days</small>
        </div>
        <span class="pill">${week.sessions} / 4 sessions</span>
      </div>

      <div class="progressbar">
        <i style="width:${week.score}%"></i>
      </div>

      <div class="il-coach-grid" style="margin:10px 0 16px">
        <div class="il-coach-stat">
          <b>${week.sessions}</b>
          <small>Sessions</small>
        </div>
        <div class="il-coach-stat">
          <b>${week.sets}</b>
          <small>Sets recorded</small>
        </div>
        <div class="il-coach-stat">
          <b>${week.volume.toLocaleString()}</b>
          <small>Volume · kg</small>
        </div>
      </div>

      <p class="muted small">
        Set completion: ${week.completion}% of prescribed sets recorded.
        The score rewards consistency and logging; it is not a measure of fitness or effort.
      </p>

      <div class="il-coach-heading">
        Strength trend
      </div>

      <label for="ilTrendSelect">
        Choose an exercise
      </label>

      <select id="ilTrendSelect" class="il-select">
        ${exercises.map((item, i) => `
          <option value="${i}">
            ${esc(item.name)} · ${esc(item.exercise)}
          </option>
        `).join("")}
      </select>

      <div id="ilTrendChart"></div>

      <div class="row" style="margin:18px 0 8px">
        <h3>Personal records</h3>
        <span class="pill">
          ${records.length} / ${exercises.length}
        </span>
      </div>

      <div class="il-pr-list">
        ${exercises.map(item => `
          <div class="il-pr-row">
            <div>
              <b>${esc(item.exercise)}</b>
              <div class="muted small">
                ${esc(item.name)}
              </div>
            </div>

            <div class="il-pr-value">
              ${item.pr
                ? `${item.pr.weight} kg × ${item.pr.reps}`
                : "Not logged"}
            </div>
          </div>
        `).join("")}
      </div>

      <p class="muted small" style="margin-top:10px">
        Progress recommendations use your recorded performance.
        Always prioritise good technique, sensible effort and recovery.
      </p>
    `;

    const select = document.getElementById(
      "ilTrendSelect"
    );

    const chart = document.getElementById(
      "ilTrendChart"
    );

    function updateChart() {
      const item = exercises[Number(select.value)];

      chart.innerHTML = item
        ? trendChart(item.name, item.index)
        : "";
    }

    select.onchange = updateChart;
    updateChart();
  }

  window.renderProgress = function () {
    originalRenderProgress();
    renderCoachDashboard();
  };

  // ---------- STARTUP ----------

  const finishButton = document.getElementById(
    "finishWorkout"
  );

  if (finishButton) {
    finishButton.onclick = window.finish;
  }

  window.addEventListener("pagehide", saveDraft);

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden") {
        saveDraft();
      }
    }
  );

  renderHome();

  console.log("IronLog Adaptive Progress Coach v4.1 loaded.");
})();

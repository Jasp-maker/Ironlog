
/* IRONLOG PROGRESS COACH v2
   Smart progression, personal records, strength trends,
   weekly report and unfinished workout recovery.
   Preserves the existing ironlog_v1 history format.
*/

(() => {
  "use strict";

  const DRAFT_KEY = "ironlog_draft_v1";
  const originalOpenWorkout = openWorkout;
  const originalRenderExercises = renderExercises;
  const originalFinish = finish;
  const originalRenderHome = renderHome;
  const originalRenderProgress = renderProgress;

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

  function validSets(record, index) {
    const sets = record?.entries?.[index];
    return Array.isArray(sets) ? sets.filter(s =>
      s && s.reps !== "" && Number.isFinite(Number(s.reps))
    ) : [];
  }

  function recordsFor(name, index) {
    return db.history
      .filter(record => record.name === name &&
        validSets(record, index).length)
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  function parseRange(target) {
    const match = String(target).match(/(\d+)\s*[–-]\s*(\d+)/);
    return match
      ? { min: Number(match[1]), max: Number(match[2]) }
      : null;
  }

  function weightOf(set) {
    const value = Number(set?.weight);
    return set?.weight !== "" && Number.isFinite(value) && value > 0
      ? value : null;
  }

  function exerciseName(name, index) {
    return plan[name]?.items?.[index]?.[0] || `Exercise ${index + 1}`;
  }

  // ---------- SMART PROGRESSION ----------

  function progression(name, index) {
    const rx = prescription(name, index);
    const target = String(rx.target);
    const range = parseRange(target);
    const previousRecords = recordsFor(name, index);
    const previous = previousRecords.length
      ? previousRecords[previousRecords.length - 1] : null;

    const timed = /sec/i.test(target);
    const eachSide = /each side/i.test(target);
    const unit = timed ? "seconds" : eachSide ? "reps per side" : "reps";

    if (rx.deload) {
      return {
        title: "Recovery week",
        detail: "Keep the effort comfortable, use controlled technique and avoid chasing personal records."
      };
    }

    if (!previous || !range) {
      return {
        title: "Build your baseline",
        detail: `Aim for ${target} on each set. Record your performance so IronLog can learn your working level.`
      };
    }

    const completed = validSets(previous, index);
    const enoughSets = completed.length >= rx.sets;
    const allTop = enoughSets &&
      completed.slice(0, rx.sets).every(s =>
        Number(s.reps) >= range.max
      );

    const belowTarget = completed.some(s =>
      Number(s.reps) < range.min
    );

    const weights = completed.map(weightOf).filter(v => v !== null);
    const load = weights.length ? Math.max(...weights) : null;

    if (allTop && load !== null && !timed) {
      const increment = load < 20 ? 1 : 2.5;
      const suggested = Math.ceil((load + increment) * 2) / 2;

      return {
        title: "Ready to consider an increase",
        detail: `You reached ${range.max} reps on all ${rx.sets} sets last time. Consider approximately ${suggested} kg next time if your technique and recovery are good.`
      };
    }

    if (belowTarget) {
      return {
        title: "Consolidate your performance",
        detail: `Keep the load steady and work towards at least ${range.min} ${unit} on every set. Reduce the load if needed to maintain good form.`
      };
    }

    if (!enoughSets) {
      return {
        title: "Complete all working sets",
        detail: `You recorded ${completed.length} of ${rx.sets} sets last time. Aim to complete all prescribed sets within ${target}.`
      };
    }

    return {
      title: "Build towards the top of the range",
      detail: `Keep your current load and aim to add a rep or improve control, working towards ${range.max} ${unit}.`
    };
  }

  // ---------- PERSONAL RECORDS ----------

  function personalRecord(name, index) {
    let best = null;

    db.history.forEach(record => {
      if (record.name !== name) return;

      validSets(record, index).forEach(set => {
        const weight = weightOf(set);
        if (weight === null) return;

        const reps = Number(set.reps);
        if (!best || weight > best.weight ||
          (weight === best.weight && reps > best.reps)) {
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
    return recordsFor(name, index).map(record => {
      const sets = validSets(record, index);
      const weights = sets.map(weightOf).filter(v => v !== null);

      return {
        date: record.date,
        weight: weights.length ? Math.max(...weights) : 0,
        reps: sets.length
          ? Math.max(...sets.map(s => Number(s.reps))) : 0
      };
    }).slice(-8);
  }

  function trendChart(name, index) {
    const trend = trendFor(name, index);
    if (!trend.length) {
      return '<p class="muted small">Log this exercise to start building your strength chart.</p>';
    }

    const max = Math.max(1, ...trend.map(p => p.weight));
    return `
      <div class="il-chart">
        ${trend.map(point => {
          const height = point.weight
            ? Math.max(8, point.weight / max * 100) : 5;
          const date = point.date
            ? new Date(point.date).toLocaleDateString(undefined, {
                day: "numeric", month: "short"
              }) : "Session";

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

  // ---------- WEEKLY REPORT ----------

  function weeklyReport() {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    const recent = db.history.filter(record => {
      const date = new Date(record.date);
      return !isNaN(date) && date >= start && date <= now;
    });

    let sets = 0;
    let volume = 0;

    recent.forEach(record => {
      Object.values(record.entries || {}).forEach(rows => {
        (Array.isArray(rows) ? rows : []).forEach(set => {
          if (!set || set.reps === "") return;
          sets++;
          const weight = weightOf(set);
          const reps = Number(set.reps);
          if (weight !== null && Number.isFinite(reps)) {
            volume += weight * reps;
          }
        });
      });
    });

    return {
      sessions: recent.length,
      sets,
      volume: Math.round(volume)
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
    `;
    document.head.appendChild(style);
  }

  // ---------- WORKOUT SCREEN COACHING ----------

  renderExercises = function () {
    originalRenderExercises();

    document.querySelectorAll("#exerciseList > .card").forEach((card, index) => {
      card.querySelectorAll(".smart-tip").forEach(el => el.remove());

      const tip = progression(current, index);
      const note = document.createElement("div");
      note.className = "notice small smart-tip";
      note.style.marginTop = "9px";
      note.innerHTML = `<strong>${esc(tip.title)}:</strong> ${esc(tip.detail)}`;

      const existing = card.querySelector(".notice");
      if (existing) existing.insertAdjacentElement("afterend", note);
      else card.insertBefore(note, card.children[1] || null);
    });

    document.querySelectorAll("#exerciseList input").forEach(input => {
      input.addEventListener("input", saveDraft);
      input.addEventListener("change", saveDraft);
    });
  };

  // ---------- WORKOUT RECOVERY ----------

  openWorkout = function (name) {
    const saved = readDraft();

    if (saved && saved.name !== name) {
      const resumeFirst = confirm(
        `You have an unfinished ${saved.name} workout. Press OK to resume it, or Cancel to start ${name} and replace that unfinished draft.`
      );
      if (resumeFirst) name = saved.name;
      else clearDraft();
    }

    originalOpenWorkout(name);

    const recoverable = saved && saved.name === name ? saved : null;

    if (recoverable) {
      draft = recoverable.entries &&
        typeof recoverable.entries === "object"
        ? recoverable.entries : {};

      plan[name].items.forEach((item, index) => {
        const wanted = prescription(name, index).sets;
        if (!Array.isArray(draft[index])) draft[index] = [];
        while (draft[index].length < wanted) {
          draft[index].push({ weight: "", reps: "" });
        }
      });

      renderExercises();

      const stamp = new Date(recoverable.savedAt)
        .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const meta = document.getElementById("workoutMeta");
      if (meta) {
        meta.textContent =
          `${plan[name].focus} · unfinished workout restored (saved ${stamp})`;
      }
    }

    saveDraft();
  };

  finish = function () {
    const hasEntries = Object.values(draft || {}).some(rows =>
      Array.isArray(rows) &&
      rows.some(set => set && (set.weight !== "" || set.reps !== ""))
    );

    if (!hasEntries) {
      originalFinish();
      return;
    }

    originalFinish();
    clearDraft();
    renderHome();
  };

  renderHome = function () {
    originalRenderHome();

    const saved = readDraft();
    const hero = document.querySelector("#todayPage .hero");
    if (!hero) return;

    let resume = document.getElementById("resumeWorkout");

    if (saved) {
      if (!resume) {
        resume = document.createElement("button");
        resume.id = "resumeWorkout";
        resume.className = "secondary";
        resume.style.marginTop = "10px";
        hero.appendChild(resume);
      }

      const when = new Date(saved.savedAt)
        .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      resume.textContent = `Resume ${saved.name} workout · saved ${when}`;
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

    let dashboard = document.getElementById("ilCoachDashboard");

    if (!dashboard) {
      dashboard = document.createElement("div");
      dashboard.id = "ilCoachDashboard";
      historyCard.insertAdjacentElement("beforebegin", dashboard);
    }

    const week = weeklyReport();
    const exercises = allExercises();
    const records = exercises.filter(item => item.pr);

    dashboard.className = "il-coach-card";
    dashboard.innerHTML = `
      <div class="il-coach-heading">IRONLOG PROGRESS COACH</div>

      <h3>Last 7 days</h3>
      <div class="il-coach-grid" style="margin:10px 0 16px">
        <div class="il-coach-stat">
          <b>${week.sessions}</b><small>Sessions</small>
        </div>
        <div class="il-coach-stat">
          <b>${week.sets}</b><small>Sets logged</small>
        </div>
        <div class="il-coach-stat">
          <b>${week.volume.toLocaleString()}</b><small>Volume · kg</small>
        </div>
      </div>

      <div class="il-coach-heading">Strength trend</div>
      <label for="ilTrendSelect">Choose an exercise</label>
      <select id="ilTrendSelect" class="il-select">
        ${exercises.map((item, i) =>
          `<option value="${i}">${esc(item.name)} · ${esc(item.exercise)}</option>`
        ).join("")}
      </select>
      <div id="ilTrendChart"></div>

      <div class="row" style="margin:18px 0 8px">
        <h3>Personal records</h3>
        <span class="pill">${records.length} / ${exercises.length}</span>
      </div>
      <div class="il-pr-list">
        ${exercises.map(item => `
          <div class="il-pr-row">
            <div>
              <b>${esc(item.exercise)}</b>
              <div class="muted small">${esc(item.name)}</div>
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
        Personal records use your recorded weights and reps. They do not replace good technique or safe training.
      </p>
    `;

    const select = document.getElementById("ilTrendSelect");
    const chart = document.getElementById("ilTrendChart");

    function updateChart() {
      const item = exercises[Number(select.value)];
      chart.innerHTML = item
        ? trendChart(item.name, item.index)
        : "";
    }

    select.onchange = updateChart;
    updateChart();
  }

  renderProgress = function () {
    originalRenderProgress();
    renderCoachDashboard();
  };

  // ---------- STARTUP ----------

  const finishButton = document.getElementById("finishWorkout");
  if (finishButton) finishButton.onclick = finish;

  window.addEventListener("pagehide", saveDraft);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveDraft();
  });

  renderHome();

  console.log("IronLog Progress Coach v2 loaded.");
})();

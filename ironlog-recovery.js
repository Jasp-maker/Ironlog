
/* =========================================================
   IRONLOG V13
   INTELLIGENT RECOVERY & READINESS COACH

   Adds:
   - Sleep, stress and fatigue check-in
   - Muscle-group recovery tracking
   - Seven-day training-load analysis
   - Fatigue and workload warnings
   - PUSH / MAINTAIN / EASE-OFF recommendations
   - Exercise-specific recovery prompts

   Preserves all existing IronLog workout data.
   ========================================================= */

(() => {
  "use strict";

  const STORAGE_KEY = "ironlog_recovery_v13";
  const STYLE_ID = "il-v13-recovery-styles";

  const groups = {
    "Chest": ["Barbell bench press", "Incline dumbbell press"],
    "Shoulders": ["Seated shoulder press", "Cable lateral raise"],
    "Triceps": ["Rope triceps pushdown", "Overhead cable extension"],
    "Back": ["Lat pulldown", "Chest-supported row", "Seated cable row"],
    "Rear delts": ["Reverse pec deck"],
    "Biceps": ["EZ-bar curl", "Hammer curl"],
    "Quads": ["Squat", "Leg press", "Leg extension"],
    "Hamstrings": ["Romanian deadlift", "Seated leg curl"],
    "Calves": ["Standing calf raise"],
    "Core": ["Cable crunch", "Hanging knee raise", "Ab wheel", "Pallof press", "Plank"]
  };

  const groupNames = Object.keys(groups);

  const labels = {
    sleep: ["Very poor", "Poor", "Average", "Good", "Excellent"],
    stress: ["Very low", "Low", "Moderate", "High", "Very high"],
    fatigue: ["Fresh", "Slightly tired", "Moderate", "Very tired", "Exhausted"]
  };

  function todayKey() {
    return new Date().toDateString();
  }

  function readRecovery() {
    try {
      const data = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "null"
      );

      return data && data.dateKey === todayKey()
        ? data
        : null;
    } catch (_) {
      return null;
    }
  }

  function readReadiness() {
    try {
      const data = JSON.parse(
        localStorage.getItem("ironlog_readiness_v12") || "null"
      );

      return data && data.dateKey === todayKey()
        ? data
        : null;
    } catch (_) {
      return null;
    }
  }

  function saveRecovery(data) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...data,
          dateKey: todayKey(),
          savedAt: new Date().toISOString()
        })
      );

      renderPanels();
      renderExerciseWarnings();
    } catch (error) {
      console.warn("IronLog V13 recovery save failed.", error);
    }
  }

  function getHistory() {
    try {
      return typeof db !== "undefined" &&
        Array.isArray(db.history)
          ? db.history
          : [];
    } catch (_) {
      return [];
    }
  }

  function dateOf(record) {
    const date = new Date(record.date);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function daysAgo(date) {
    if (!date) return 999;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const then = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    return Math.floor((start - then) / 86400000);
  }

  function recordedSet(set) {
    return !!set &&
      (set.weight !== "" || set.reps !== "") &&
      (Number(set.weight) > 0 || Number(set.reps) > 0);
  }

  function exerciseGroup(name, index) {
    if (typeof plan === "undefined" || !plan[name]) return null;

    const exercise = plan[name].items[index]?.[0];

    return groupNames.find(group =>
      groups[group].includes(exercise)
    ) || null;
  }

  // ---------- TRAINING LOAD ----------

  function trainingLoad() {
    const history = getHistory();
    const now = new Date();

    let recentSets = 0;
    let previousSets = 0;

    history.forEach(record => {
      const date = dateOf(record);
      if (!date) return;

      const age = (now - date) / 86400000;

      let count = 0;

      Object.values(record.entries || {}).forEach(rows => {
        if (Array.isArray(rows)) {
          count += rows.filter(recordedSet).length;
        }
      });

      if (age >= 0 && age < 7) {
        recentSets += count;
      } else if (age >= 7 && age < 28) {
        previousSets += count;
      }
    });

    const weeklyBaseline = previousSets / 3;

    const ratio = weeklyBaseline > 0
      ? recentSets / weeklyBaseline
      : null;

    let status = "baseline";
    let message = "Not enough previous training data to compare workload.";

    if (ratio !== null) {
      if (ratio > 1.5) {
        status = "high";
        message = "Your recent training volume is substantially above your previous weekly average.";
      } else if (ratio > 1.25) {
        status = "moderate";
        message = "Your recent training volume has increased. Monitor recovery carefully.";
      } else {
        status = "normal";
        message = "Your recent training volume is within a reasonable range of your previous average.";
      }
    }

    return {
      recentSets,
      weeklyBaseline: Math.round(weeklyBaseline * 10) / 10,
      ratio,
      status,
      message
    };
  }

  // ---------- MUSCLE RECOVERY ----------

  function groupHistory() {
    const result = {};

    groupNames.forEach(group => {
      result[group] = {
        lastTrained: null,
        sets: 0
      };
    });

    getHistory().forEach(record => {
      const date = dateOf(record);
      if (!date) return;

      Object.entries(record.entries || {}).forEach(([index, rows]) => {
        const group = exerciseGroup(record.name, Number(index));

        if (!group || !Array.isArray(rows)) return;

        const count = rows.filter(recordedSet).length;
        if (!count) return;

        result[group].sets += count;

        if (
          !result[group].lastTrained ||
          date > result[group].lastTrained
        ) {
          result[group].lastTrained = date;
        }
      });
    });

    return result;
  }

  function muscleStatus(group, data, recovery) {
    const soreness = Number(recovery?.muscles?.[group] ?? 0);
    const days = daysAgo(data.lastTrained);

    if (soreness >= 3) {
      return {
        label: soreness === 4 ? "High soreness" : "Moderate soreness",
        status: "warning",
        detail: "Allow more recovery and avoid forcing hard sets."
      };
    }

    if (days === 0) {
      return {
        label: "Trained today",
        status: "recent",
        detail: "Give this area time to recover."
      };
    }

    if (days === 1) {
      return {
        label: "Recently trained",
        status: "recent",
        detail: "Check how it feels during your warm-up."
      };
    }

    if (days === 999) {
      return {
        label: "No recent record",
        status: "neutral",
        detail: "No training date available."
      };
    }

    if (soreness <= 1) {
      return {
        label: "Likely recovered",
        status: "ready",
        detail: "Self-reported soreness is low."
      };
    }

    return {
      label: "Recovering",
      status: "moderate",
      detail: "Assess movement quality and comfort before loading."
    };
  }

  // ---------- READINESS ENGINE ----------

  function assessment() {
    const daily = readReadiness();
    const recovery = readRecovery();
    const load = trainingLoad();

    if (!daily || !recovery) {
      return {
        complete: false,
        load,
        recovery,
        title: "Complete your recovery check-in",
        detail: "Record today's energy, soreness, sleep, stress and fatigue for a personalised training recommendation."
      };
    }

    const factors = [
      Number(daily.energy),
      6 - Number(daily.soreness),
      Number(recovery.sleep),
      6 - Number(recovery.stress),
      6 - Number(recovery.fatigue)
    ];

    const score = Math.round(
      ((factors.reduce((sum, value) => sum + value, 0) - 5) / 20) * 100
    );

    const highSoreness = groupNames.filter(
      group => Number(recovery.muscles?.[group] || 0) >= 3
    );

    let recommendation = "MAINTAIN";
    let status = "moderate";
    let title = "Keep building steadily";
    let detail = "Maintain your planned working weights. Focus on controlled reps, good technique and consistent recovery.";

    if (
      score < 45 ||
      load.status === "high" ||
      highSoreness.length >= 3
    ) {
      recommendation = "EASE OFF";
      status = "warning";
      title = "Prioritise recovery today";
      detail = "Consider reducing working weights or sets, or taking a rest day. Avoid forcing personal records.";
    } else if (
      score >= 75 &&
      (load.status === "normal" || load.status === "baseline") &&
      highSoreness.length === 0
    ) {
      recommendation = "PUSH";
      status = "ready";
      title = "Good conditions to progress";
      detail = "Follow your planned progression if warm-up sets feel strong. Keep reps controlled and avoid unnecessary max-effort attempts.";
    }

    return {
      complete: true,
      score,
      recommendation,
      status,
      title,
      detail,
      highSoreness,
      load,
      recovery
    };
  }

  // ---------- STYLES ----------

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      .il-v13-panel {
        background: #171B23;
        border: 1px solid #343B48;
        border-radius: 16px;
        padding: 15px;
        margin: 12px 0;
        color: #F1F3F6;
      }

      .il-v13-heading {
        color: #FF8745;
        font-size: 11px;
        font-weight: 950;
        letter-spacing: 1.1px;
        margin-bottom: 12px;
      }

      .il-v13-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .il-v13-field label {
        display: block;
        color: #B9C0CB;
        font-size: 11px;
        margin-bottom: 5px;
      }

      .il-v13-field select {
        width: 100%;
        min-width: 0;
        padding: 10px 7px;
        border-radius: 9px;
        background: #10141B;
        border: 1px solid #414A59;
        color: #F1F3F6;
        font-size: 12px;
      }

      .il-v13-save {
        width: 100%;
        margin-top: 13px;
        padding: 12px;
        border: 0;
        border-radius: 10px;
        color: white;
        font-weight: 950;
        background: linear-gradient(90deg,#FF762E,#ED493E);
      }

      .il-v13-score {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin: 15px 0 10px;
        padding: 13px;
        background: #222833;
        border-radius: 12px;
      }

      .il-v13-score strong {
        display: block;
        font-size: 27px;
      }

      .il-v13-score small {
        color: #AEB7C4;
        font-size: 10px;
      }

      .il-v13-status {
        font-size: 11px;
        font-weight: 950;
        color: #FFB477;
        text-align: right;
      }

      .il-v13-title {
        font-size: 15px;
        font-weight: 950;
        margin: 10px 0 5px;
      }

      .il-v13-detail {
        color: #C3CAD4;
        font-size: 12px;
        line-height: 1.55;
      }

      .il-v13-load {
        margin-top: 12px;
        padding: 11px;
        background: #222833;
        border-radius: 10px;
        font-size: 12px;
        line-height: 1.6;
      }

      .il-v13-muscles {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 12px;
      }

      .il-v13-muscle {
        padding: 10px;
        background: #222833;
        border: 1px solid #343B48;
        border-radius: 10px;
      }

      .il-v13-muscle strong {
        display: block;
        font-size: 12px;
      }

      .il-v13-muscle small {
        display: block;
        margin-top: 4px;
        color: #B8C0CC;
        font-size: 10px;
      }

      .il-v13-muscle.warning {
        border-color: #A83242;
      }

      .il-v13-muscle.ready {
        border-color: #A85A2D;
      }

      .il-v13-warning {
        margin-top: 10px;
        padding: 10px;
        background: #351C22;
        border: 1px solid #A83242;
        border-radius: 10px;
        color: #FF9AA2;
        font-size: 11px;
        line-height: 1.5;
      }

      @media(max-width:380px) {
        .il-v13-grid,
        .il-v13-muscles {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // ---------- USER INTERFACE ----------

  function selectHTML(key, values, selected) {
    return `
      <select data-v13-field="${key}">
        ${values.map((value, index) => `
          <option value="${index + 1}"
            ${Number(selected) === index + 1 ? "selected" : ""}>
            ${index + 1} · ${value}
          </option>
        `).join("")}
      </select>
    `;
  }

  function recoveryHTML() {
    const recovery = readRecovery();
    const daily = readReadiness();

    const assessmentData = assessment();

    const fields = [
      ["sleep", "Sleep quality"],
      ["stress", "Stress level"],
      ["fatigue", "Physical fatigue"]
    ];

    const fieldHTML = fields.map(([key, title]) => `
      <div class="il-v13-field">
        <label>${title}</label>
        ${selectHTML(
          key,
          labels[key],
          recovery?.[key] || 3
        )}
      </div>
    `).join("");

    const muscleHTML = groupNames.map(group => `
      <div class="il-v13-field">
        <label>${group} soreness</label>
        <select data-v13-muscle="${group}">
          <option value="0" ${Number(recovery?.muscles?.[group] || 0) === 0 ? "selected" : ""}>0 · None</option>
          <option value="1" ${Number(recovery?.muscles?.[group] || 0) === 1 ? "selected" : ""}>1 · Mild</option>
          <option value="2" ${Number(recovery?.muscles?.[group] || 0) === 2 ? "selected" : ""}>2 · Moderate</option>
          <option value="3" ${Number(recovery?.muscles?.[group] || 0) === 3 ? "selected" : ""}>3 · High</option>
          <option value="4" ${Number(recovery?.muscles?.[group] || 0) === 4 ? "selected" : ""}>4 · Very high</option>
        </select>
      </div>
    `).join("");

    const scoreHTML = assessmentData.complete
      ? `
        <div class="il-v13-score">
          <div>
            <strong>${assessmentData.score}%</strong>
            <small>Combined readiness indicator</small>
          </div>
          <div class="il-v13-status">
            ${assessmentData.recommendation}
          </div>
        </div>
        <div class="il-v13-title">${assessmentData.title}</div>
        <div class="il-v13-detail">${assessmentData.detail}</div>
      `
      : `
        <div class="il-v13-title">${assessmentData.title}</div>
        <div class="il-v13-detail">${assessmentData.detail}</div>
      `;

    const load = assessmentData.load;

    const loadText = load.ratio === null
      ? `Last 7 days: ${load.recentSets} sets. Building your comparison baseline.`
      : `Last 7 days: ${load.recentSets} sets · Previous weekly average: ${load.weeklyBaseline} sets · Load ratio: ${load.ratio.toFixed(2)}.`;

    const history = groupHistory();
    const recoveryData = readRecovery();

    const muscles = groupNames.map(group => {
      const status = muscleStatus(
        group,
        history[group],
        recoveryData
      );

      return `
        <div class="il-v13-muscle ${status.status}">
          <strong>${group}</strong>
          <small>${status.label}</small>
          <small>${status.detail}</small>
        </div>
      `;
    }).join("");

    return `
      <section class="il-v13-panel">
        <div class="il-v13-heading">
          IRONLOG · V13 INTELLIGENT RECOVERY COACH
        </div>

        <div class="il-v13-detail">
          Your existing V12.1 energy and general-soreness check-in
          combines with today's recovery information below.
        </div>

        <div class="il-v13-grid" style="margin-top:12px">
          ${fieldHTML}
        </div>

        <div class="il-v13-heading" style="margin-top:18px">
          MUSCLE-GROUP RECOVERY CHECK
        </div>

        <div class="il-v13-grid">
          ${muscleHTML}
        </div>

        <button type="button" class="il-v13-save" data-v13-save>
          SAVE RECOVERY CHECK-IN
        </button>

        ${scoreHTML}

        <div class="il-v13-load">
          <strong>TRAINING LOAD</strong><br>
          ${loadText}<br>
          ${load.message}
        </div>

        <div class="il-v13-heading" style="margin-top:18px">
          MUSCLE RECOVERY OVERVIEW
        </div>

        <div class="il-v13-muscles">
          ${muscles}
        </div>

        <p class="il-v13-detail" style="margin-top:12px">
          Recovery estimates use your workout history and self-reported
          soreness. They are coaching guides, not medical assessments.
          Pain, illness or unusual symptoms should take priority.
        </p>
      </section>
    `;
  }

  function renderPanels() {
    addStyles();

    const home = document.getElementById("ilHomeCommandCentre");

    if (home) {
      let panel = document.getElementById("ilV13HomeRecovery");

      if (!panel) {
        panel = document.createElement("div");
        panel.id = "ilV13HomeRecovery";
        home.appendChild(panel);
      }

      panel.innerHTML = recoveryHTML();
    }

    const progress = document.getElementById("ilCoachDashboard");

    if (progress) {
      let panel = document.getElementById("ilV13ProgressRecovery");

      if (!panel) {
        panel = document.createElement("div");
        panel.id = "ilV13ProgressRecovery";

        const progression = document.getElementById("ilProgressionOverview");

        if (progression) {
          progression.before(panel);
        } else {
          progress.appendChild(panel);
        }
      }

      panel.innerHTML = recoveryHTML();
    }
  }

  // ---------- EXERCISE WARNINGS ----------

  function renderExerciseWarnings() {
    const assessmentData = assessment();
    const recovery = readRecovery();

    document.querySelectorAll("#exerciseList > .card").forEach(card => {
      card.querySelector(".il-v13-warning")?.remove();

      if (!recovery || !assessmentData.complete) return;

      const heading = card.querySelector("h3");
      if (!heading) return;

      const exerciseName = heading.textContent
        .replace(/^\d+\.\s*/, "")
        .trim();

      const group = groupNames.find(name =>
        groups[name].includes(exerciseName)
      );

      if (!group) return;

      const soreness = Number(recovery.muscles?.[group] || 0);

      if (soreness < 3 && assessmentData.recommendation !== "EASE OFF") {
        return;
      }

      const warning = document.createElement("div");
      warning.className = "il-v13-warning";

      warning.textContent = soreness >= 3
        ? `${group.toUpperCase()} RECOVERY ALERT: Your reported soreness is elevated. Consider reducing load or volume and assess comfort during warm-up.`
        : `RECOVERY COACH: Today's overall recommendation is ${assessmentData.recommendation}. Adjust this exercise if warm-up performance feels poor.`;

      card.appendChild(warning);
    });
  }

  // ---------- CONNECT TO EXISTING IRONLOG ----------

  const previousHome = window.renderHome;

  if (
    typeof previousHome === "function" &&
    !previousHome.__ironlogV13
  ) {
    const upgradedHome = function() {
      previousHome();
      renderPanels();
    };

    upgradedHome.__ironlogV13 = true;
    window.renderHome = upgradedHome;
  }

  const previousProgress = window.renderProgress;

  if (
    typeof previousProgress === "function" &&
    !previousProgress.__ironlogV13
  ) {
    const upgradedProgress = function() {
      previousProgress();
      renderPanels();
    };

    upgradedProgress.__ironlogV13 = true;
    window.renderProgress = upgradedProgress;
  }

  const previousExercises = window.renderExercises;

  if (
    typeof previousExercises === "function" &&
    !previousExercises.__ironlogV13
  ) {
    const upgradedExercises = function() {
      previousExercises();
      renderExerciseWarnings();
    };

    upgradedExercises.__ironlogV13 = true;
    window.renderExercises = upgradedExercises;
  }

  // ---------- BUTTON EVENTS ----------

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-v13-save]");
    if (!button) return;

    const panel = button.closest(".il-v13-panel");
    if (!panel) return;

    const getValue = key =>
      Number(panel.querySelector(`[data-v13-field="${key}"]`)?.value || 3);

    const muscles = {};

    panel.querySelectorAll("[data-v13-muscle]").forEach(input => {
      muscles[input.dataset.v13Muscle] = Number(input.value);
    });

    saveRecovery({
      sleep: getValue("sleep"),
      stress: getValue("stress"),
      fatigue: getValue("fatigue"),
      muscles
    });
  });

  // Refresh when the existing V12.1 check-in is saved.
  document.addEventListener("click", event => {
    if (event.target.closest("[data-il-readiness-save]")) {
      renderPanels();
      renderExerciseWarnings();
    }
  });

  // Initial render.
  renderPanels();

  console.log(
    "IronLog V13 Intelligent Recovery & Readiness Coach loaded."
  );

})();

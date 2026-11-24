
/* IRONLOG INTELLIGENT TRAINING COACH v10
   Premium charcoal / orange / red styling
   Adaptive rep targets
   Intelligent weight recommendations
   Plateau detection
   Performance and recovery alerts
   Muscle-group progress
   Weekly coaching report
   Personal records
   Interactive line and dot strength trends
   Workout draft recovery
   Live session comparison
   Exercise progression overview
   Compact accordion Progress dashboard

   Preserves:
   ironlog_v1
   ironlog_draft_v1
*/

(() => {
  "use strict";

  const VERSION = "v11";
  const DRAFT_KEY = "ironlog_draft_v1";

  const originalOpenWorkout = window.openWorkout;
  const originalRenderExercises = window.renderExercises;
  const originalFinish = window.finish;
  const originalRenderHome = window.renderHome;
  const originalRenderProgress = window.renderProgress;
  const originalPrescription = window.prescription;

  if (
    typeof originalOpenWorkout !== "function" ||
    typeof originalRenderExercises !== "function" ||
    typeof originalFinish !== "function" ||
    typeof originalRenderHome !== "function" ||
    typeof originalRenderProgress !== "function" ||
    typeof originalPrescription !== "function"
  ) {
    console.error("IronLog v10 could not find all original app functions.");
    return;
  }

  // ---------- EXERCISE GROUPS ----------

  const muscleGroups = {
    "Barbell bench press": "Chest",
    "Incline dumbbell press": "Chest",
    "Seated shoulder press": "Shoulders",
    "Cable lateral raise": "Shoulders",
    "Rope triceps pushdown": "Triceps",
    "Overhead cable extension": "Triceps",

    "Lat pulldown": "Back",
    "Chest-supported row": "Back",
    "Seated cable row": "Back",
    "Reverse pec deck": "Rear delts",
    "EZ-bar curl": "Biceps",
    "Hammer curl": "Biceps",

    "Squat": "Quads",
    "Romanian deadlift": "Hamstrings",
    "Leg press": "Quads",
    "Seated leg curl": "Hamstrings",
    "Leg extension": "Quads",
    "Standing calf raise": "Calves",

    "Cable crunch": "Core",
    "Hanging knee raise": "Core",
    "Ab wheel": "Core",
    "Pallof press": "Core",
    "Plank": "Core"
  };

  const groupOrder = [
    "Chest",
    "Back",
    "Shoulders",
    "Rear delts",
    "Triceps",
    "Biceps",
    "Quads",
    "Hamstrings",
    "Calves",
    "Core"
  ];

  // ---------- SAFE HELPERS ----------

  function todayKey() {
    return new Date().toDateString();
  }

  function readDraft() {
    try {
      const value = JSON.parse(
        localStorage.getItem(DRAFT_KEY) || "null"
      );

      return value &&
        value.dateKey === todayKey() &&
        plan[value.name]
          ? value
          : null;
    } catch (_) {
      return null;
    }
  }

  function saveDraft() {
    if (!current || !draft || !plan[current]) return;

    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          name: current,
          dateKey: todayKey(),
          savedAt: new Date().toISOString(),
          entries: draft
        })
      );
    } catch (error) {
      console.warn("IronLog could not save draft.", error);
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (_) {}
  }

  function validSet(set) {
    return !!set &&
      set.reps !== "" &&
      Number.isFinite(Number(set.reps)) &&
      Number(set.reps) > 0;
  }

  function weightOf(set) {
    const value = Number(set?.weight);

    return set?.weight !== "" &&
      Number.isFinite(value) &&
      value > 0
        ? value
        : null;
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

  function completeRecordsFor(name, index, count) {
    return recordsFor(name, index).filter(record => {
      const rows = record.entries[index] || [];

      return rows.length >= count &&
        rows.slice(0, count).every(validSet);
    });
  }

  function parseTarget(target) {
    const value = String(target);

    const range = value.match(
      /(\d+)\s*[–-]\s*(\d+)/
    );

    if (range) {
      return {
        min: Number(range[1]),
        max: Number(range[2]),
        timed: /sec/i.test(value)
      };
    }

    const fixed = value.match(
      /^(\d+)(?:\s+each side)?$/i
    );

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

  function totalReps(rows) {
    return rows.reduce(
      (sum, set) => sum + Number(set.reps || 0),
      0
    );
  }

  function sessionVolume(rows) {
    return rows.reduce((sum, set) => {
      const weight = weightOf(set);

      return sum + (
        weight === null
          ? 0
          : weight * Number(set.reps)
      );
    }, 0);
  }

  function exerciseName(name, index) {
    return plan[name]?.items?.[index]?.[0] ||
      `Exercise ${index + 1}`;
  }

  function escapeHTML(value) {
    return esc(value);
  }

  // ---------- INDIVIDUAL REP TARGETS ----------

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

    const reps = latest.entries[index]
      .slice(0, base.sets)
      .map(set => Number(set.reps));

    const allTop = reps.every(
      value => value >= range.max
    );

    if (allTop) {
      return reps.map(() => range.min);
    }

    return reps.map(value => {
      if (value < range.min) return range.min;

      return Math.min(range.max, value + 1);
    });
  }

  // ---------- PLATEAU DETECTION ----------

  function plateauStatus(name, index, count) {
    const records = completeRecordsFor(
      name,
      index,
      count
    );

    if (records.length < 3) {
      return {
        plateau: false,
        message: ""
      };
    }

    const lastThree = records.slice(-3);

    const sessions = lastThree.map(record => {
      const rows = record.entries[index].slice(0, count);

      const weights = rows
        .map(weightOf)
        .filter(value => value !== null);

      return {
        reps: totalReps(rows),
        weight: weights.length
          ? median(weights)
          : null
      };
    });

    const sameLoad =
      sessions.every(item => item.weight !== null) &&
      sessions.every(item =>
        item.weight === sessions[0].weight
      );

    const noRepImprovement =
      sessions[2].reps <= sessions[1].reps &&
      sessions[1].reps <= sessions[0].reps;

    if (sameLoad && noRepImprovement) {
      return {
        plateau: true,
        message:
          "Your last three complete sessions show little or no rep progress at the same working weight. Consider a small load reduction, a recovery check, or reviewing your technique and rest periods."
      };
    }

    return {
      plateau: false,
      message: ""
    };
  }

  // ---------- PERFORMANCE AND RECOVERY ----------

  function recoveryStatus(name, index, count) {
    const records = completeRecordsFor(
      name,
      index,
      count
    );

    if (records.length < 2) {
      return {
        alert: false,
        message: ""
      };
    }

    const latest = records[records.length - 1];
    const previous = records[records.length - 2];

    const latestRows = latest.entries[index].slice(0, count);
    const previousRows = previous.entries[index].slice(0, count);

    const currentReps = totalReps(latestRows);
    const previousReps = totalReps(previousRows);

    if (
      previousReps > 0 &&
      currentReps <= previousReps * 0.8
    ) {
      return {
        alert: true,
        message:
          "Your total reps have dropped by 20% or more compared with the previous complete session. Check sleep, stress and recovery. Keep the load sensible and avoid forcing progress."
      };
    }

    return {
      alert: false,
      message: ""
    };
  }

  // ---------- PROGRESSION COACH ----------

  function progression(name, index, rx) {
    rx = rx || originalPrescription(name, index);

    const original = originalPrescription(name, index);
    const range = parseTarget(original.target);

    if (rx.deload) {
      return {
        title: "Recovery week",
        detail:
          "Keep effort comfortable. Use lighter loads, controlled technique and avoid chasing personal records."
      };
    }

    const records = completeRecordsFor(
      name,
      index,
      rx.sets
    );

    if (!records.length || !range) {
      return {
        title: "Build your baseline",
        detail:
          `Aim for ${original.target} on each set. IronLog will personalise your next targets as you log sessions.`
      };
    }

    const latest = records[records.length - 1];
    const rows = latest.entries[index].slice(0, rx.sets);

    const reps = rows.map(set => Number(set.reps));
    const weights = rows
      .map(weightOf)
      .filter(value => value !== null);

    const allTop = reps.every(
      value => value >= range.max
    );

    const belowMinimum = reps.some(
      value => value < range.min
    );

    const recovery = recoveryStatus(
      name,
      index,
      rx.sets
    );

    if (recovery.alert) {
      return {
        title: "Recovery check",
        detail: recovery.message
      };
    }

    const plateau = plateauStatus(
      name,
      index,
      rx.sets
    );

    if (plateau.plateau) {
      return {
        title: "Possible plateau detected",
        detail: plateau.message
      };
    }

    const timed = range.timed;
    const eachSide = /each side/i.test(original.target);

    const unit = timed
      ? "seconds"
      : eachSide
        ? "reps per side"
        : "reps";

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

  function adaptivePrescription(name, index) {
    const base = originalPrescription(name, index);

    const aim = base.deload
      ? null
      : nextRepAim(name, index, base);

    const advice = progression(name, index, base);

    return {
      ...base,
      target: aim
        ? `${base.target} · next aim: ${aim.join(" / ")}`
        : base.target,
      suggestedWeight: advice.suggestedWeight || null,
      coachTitle: advice.title,
      nextAim: aim
    };
  }

  window.prescription = adaptivePrescription;

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
            date: record.date
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
          group: muscleGroups[item[0]] || "Other",
          pr: personalRecord(name, index)
        });
      });
    });

    return list;
  }

  // ---------- STRENGTH TRENDS ----------

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
      .filter(point => point.weight > 0)
      .slice(-8);
  }

  function trendChart(name, index) {
    const trend = trendFor(name, index);

    if (!trend.length) {
      return `
        <div class="il-chart-empty">
          <div class="il-chart-empty-icon">↗</div>
          <b>No weighted sessions yet</b>
          <p>Log a weighted session for this exercise and your strength trend will appear here.</p>
        </div>
      `;
    }

    const width = 640;
    const height = 230;
    const left = 48;
    const right = 22;
    const top = 32;
    const bottom = 48;

    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    const weights = trend.map(point => point.weight);
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);

    const spread = maxWeight - minWeight;
    const padding = spread === 0
      ? Math.max(2, maxWeight * 0.12)
      : spread * 0.25;

    const low = Math.max(0, minWeight - padding);
    const high = maxWeight + padding;
    const range = Math.max(1, high - low);

    const x = i => trend.length === 1
      ? left + plotWidth / 2
      : left + (i / (trend.length - 1)) * plotWidth;

    const y = value =>
      top + ((high - value) / range) * plotHeight;

    const points = trend.map((point, i) => ({
      ...point,
      x: x(i),
      y: y(point.weight)
    }));

    const linePoints = points
      .map(point => `${point.x},${point.y}`)
      .join(" ");

    const gridValues = [
      high,
      (high + low) / 2,
      low
    ];

    const grid = gridValues.map(value => {
      const gy = y(value);

      return `
        <line
          x1="${left}"
          y1="${gy}"
          x2="${width - right}"
          y2="${gy}"
          stroke="#45464D"
          stroke-width="1"
          stroke-dasharray="4 6"
        />
        <text
          x="${left - 9}"
          y="${gy + 4}"
          text-anchor="end"
          fill="#999AA2"
          font-size="12"
        >${Number(value.toFixed(1))}</text>
      `;
    }).join("");

    const plottedPoints = points.map((point, i) => {
      const date = point.date
        ? new Date(point.date).toLocaleDateString(
            undefined,
            { day: "numeric", month: "short" }
          )
        : "Session";

      const labelY = Math.max(15, point.y - 16);

      return `
        <g>
          <circle
            cx="${point.x}"
            cy="${point.y}"
            r="11"
            fill="#F97316"
            opacity=".16"
          />
          <circle
            cx="${point.x}"
            cy="${point.y}"
            r="5.5"
            fill="${i === points.length - 1 ? "#EF4444" : "#F97316"}"
            stroke="#17181D"
            stroke-width="2"
          />
          <text
            x="${point.x}"
            y="${labelY}"
            text-anchor="middle"
            fill="#F4F4F5"
            font-size="12"
            font-weight="700"
          >${point.weight} kg</text>
          <text
            x="${point.x}"
            y="${height - 19}"
            text-anchor="middle"
            fill="#A1A1AA"
            font-size="11"
          >${esc(date)}</text>
          <title>${esc(date)}: ${point.weight} kg, best set ${point.reps} reps</title>
        </g>
      `;
    }).join("");

    const first = trend[0].weight;
    const last = trend[trend.length - 1].weight;
    const difference = last - first;

    const changeText = difference > 0
      ? `+${difference.toFixed(1)} kg`
      : difference < 0
        ? `${difference.toFixed(1)} kg`
        : "No change";

    const changeClass = difference > 0
      ? "il-trend-positive"
      : difference < 0
        ? "il-trend-negative"
        : "il-trend-neutral";

    return `
      <div class="il-chart-summary">
        <div>
          <span class="il-chart-caption">LATEST RECORDED WEIGHT</span>
          <strong>${last} kg</strong>
        </div>
        <div class="${changeClass}">
          ${changeText}
          <small>since first plotted session</small>
        </div>
      </div>

      <div class="il-line-chart">
        <svg
          viewBox="0 0 ${width} ${height}"
          role="img"
          aria-label="Strength trend showing recorded weight over time"
          preserveAspectRatio="xMidYMid meet"
        >
          ${grid}

          <line
            x1="${left}"
            y1="${top}"
            x2="${left}"
            y2="${height - bottom + 2}"
            stroke="#55565C"
          />

          <polyline
            points="${linePoints}"
            fill="none"
            stroke="#F97316"
            stroke-width="3.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          ${plottedPoints}
        </svg>
      </div>

      <div class="il-chart-legend">
        <span><i class="il-legend-dot"></i> Recorded working weight</span>
        <span>Highest set per session · kg</span>
      </div>
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
        const prescribed = Number(record.week) === 7
          ? Math.max(1, Math.ceil(item[1] / 2))
          : item[1];

        expectedSets += prescribed;

        const rows = record.entries?.[index] || [];

        rows.slice(0, prescribed).forEach(set => {
          if (!validSet(set)) return;

          sets++;

          const weight = weightOf(set);

          if (weight !== null) {
            volume += weight * Number(set.reps);
          }
        });
      });
    });

    const sessionScore = Math.min(
      recent.length / 4,
      1
    ) * 50;

    const completion = expectedSets
      ? Math.min(sets / expectedSets, 1)
      : 0;

    const score = Math.round(
      sessionScore + completion * 50
    );

    return {
      sessions: recent.length,
      sets,
      volume: Math.round(volume),
      score,
      completion: Math.round(completion * 100)
    };
  }

  // ---------- MUSCLE GROUP PROGRESS ----------

  function muscleReport() {
    const groups = {};

    groupOrder.forEach(group => {
      groups[group] = {
        sets: 0,
        volume: 0,
        exercises: 0
      };
    });

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    db.history.forEach(record => {
      const date = new Date(record.date);

      if (isNaN(date) || date < start) return;

      const workout = plan[record.name];
      if (!workout) return;

      workout.items.forEach((item, index) => {
        const group = muscleGroups[item[0]] || "Other";

        if (!groups[group]) {
          groups[group] = {
            sets: 0,
            volume: 0,
            exercises: 0
          };
        }

        const rows = record.entries?.[index] || [];
        let exerciseHadSets = false;

        rows.forEach(set => {
          if (!validSet(set)) return;

          groups[group].sets++;
          exerciseHadSets = true;

          const weight = weightOf(set);

          if (weight !== null) {
            groups[group].volume +=
              weight * Number(set.reps);
          }
        });

        if (exerciseHadSets) {
          groups[group].exercises++;
        }
      });
    });

    return groups;
  }

  function muscleHTML() {
    const groups = muscleReport();

    return groupOrder.map(group => {
      const item = groups[group];

      return `
        <div class="il-muscle-row">
          <div>
            <b>${esc(group)}</b>
            <div class="muted small">
              ${item.exercises} exercises logged
            </div>
          </div>
          <div class="il-pr-value">
            ${item.sets} sets
            <div class="muted small">
              ${item.volume.toLocaleString()} kg volume
            </div>
          </div>
        </div>`;
    }).join("");
  }

  // ---------- V6 COACHING STYLES ----------

  function addStyles() {
    if (document.getElementById("il-v6-styles")) return;

    const style = document.createElement("style");
    style.id = "il-v6-styles";

    style.textContent = `
      :root {
        --bg: #101114 !important;
        --panel: #1B1C21 !important;
        --panel2: #26272E !important;
        --line: #383940 !important;
        --accent: #F97316 !important;
        --muted: #A1A1AA !important;
        --text: #F4F4F5 !important;
      }

      body {
        background: #101114 !important;
        color: #F4F4F5 !important;
      }

      .card,
      .hero,
      .panel,
      .modal,
      .notice {
        background-color: #1B1C21 !important;
        color: #F4F4F5 !important;
        border-color: #383940 !important;
      }

      h1, h2, h3, h4,
      .title, .heading {
        color: #F4F4F5;
      }

      .muted,
      small,
      .small {
        color: #A1A1AA;
      }

      button {
        border-color: #45464D;
      }

      button.primary,
      button:not(.secondary):not(.danger) {
        background: #F97316;
        color: #17181D;
        border-color: #F97316;
      }

      button.secondary {
        background: #292A30;
        color: #F4F4F5;
        border-color: #45464D;
      }

      button.danger {
        background: #7F1D1D;
        color: #FEE2E2;
        border-color: #991B1B;
      }

      input,
      select,
      textarea {
        background: #202126 !important;
        color: #F4F4F5 !important;
        border-color: #45464D !important;
      }

      input::placeholder,
      textarea::placeholder {
        color: #85858E !important;
      }

      .pill {
        background: #30231C !important;
        color: #FDBA74 !important;
        border: 1px solid #7C3D1B;
      }

      .progressbar {
        background: #383940 !important;
      }

      .progressbar i {
        background: #F97316 !important;
      }

      .il-coach-card {
        background: #18191E;
        border: 1px solid #383940;
        border-radius: 17px;
        padding: 15px;
        margin: 14px 0;
        color: #F4F4F5;
      }

      .il-coach-heading {
        color: #F97316;
        font-weight: 850;
        letter-spacing: 1px;
        margin-bottom: 10px;
      }

      .il-coach-grid {
        display: grid;
        grid-template-columns: repeat(3,1fr);
        gap: 8px;
      }

      .il-coach-stat {
        background: #26272E;
        padding: 11px 8px;
        border-radius: 11px;
        min-width: 0;
        border: 1px solid #383940;
      }

      .il-coach-stat b {
        display: block;
        font-size: 19px;
        overflow-wrap: anywhere;
        color: #F97316;
      }

      .il-coach-stat small {
        color: #A1A1AA;
        font-size: 11px;
      }

      .il-pr-row,
      .il-muscle-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding: 10px 0;
        border-top: 1px solid #383940;
      }

      .il-pr-row:first-child,
      .il-muscle-row:first-child {
        border-top: 0;
      }

      .il-pr-value {
        color: #F97316;
        font-weight: 850;
        text-align: right;
      }

      .il-select {
        width: 100%;
        margin: 8px 0 12px;
        padding: 12px;
        border-radius: 10px;
      }

      .il-pr-list {
        max-height: 420px;
        overflow: auto;
      }

      .il-adaptive-note {
        margin-top: 10px;
        padding: 12px;
        border-radius: 12px;
        background: #29231F;
        border: 1px solid #8A451F;
        color: #F4F4F5;
        font-size: 13px;
      }

      .il-adaptive-note strong {
        color: #FB923C;
      }

      .il-adaptive-action {
        display: block;
        width: 100%;
        margin-top: 10px;
        font-size: 12px;
      }

      .il-alert {
        border-color: #B91C1C;
        background: #351D21;
      }

      .il-alert strong {
        color: #F87171;
      }

      .il-score {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px;
        border-radius: 12px;
        background: #26272E;
        border: 1px solid #383940;
        margin: 10px 0 16px;
      }

      .il-score b {
        color: #F97316;
        font-size: 28px;
      }

      .il-score small {
        display: block;
        color: #A1A1AA;
      }

      .il-section {
        margin-top: 22px;
      }

      .il-section h3 {
        margin-bottom: 8px;
        color: #F4F4F5;
      }

      .il-chart-summary {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        background: #26272E;
        border: 1px solid #383940;
        border-radius: 12px;
        padding: 12px;
        margin: 12px 0 8px;
      }

      .il-chart-summary strong {
        display: block;
        color: #F97316;
        font-size: 25px;
        margin-top: 3px;
      }

      .il-chart-caption {
        color: #A1A1AA;
        font-size: 10px;
        letter-spacing: .7px;
        font-weight: 800;
      }

      .il-trend-positive {
        color: #FB923C;
        font-size: 16px;
        font-weight: 850;
        text-align: right;
      }

      .il-trend-negative {
        color: #F87171;
        font-size: 16px;
        font-weight: 850;
        text-align: right;
      }

      .il-trend-neutral {
        color: #D4D4D8;
        font-size: 16px;
        font-weight: 850;
        text-align: right;
      }

      .il-trend-positive small,
      .il-trend-negative small,
      .il-trend-neutral small {
        display: block;
        color: #A1A1AA;
        font-size: 10px;
        font-weight: 500;
      }

      .il-line-chart {
        width: 100%;
        overflow: hidden;
        background: #202126;
        border: 1px solid #383940;
        border-radius: 13px;
        padding: 8px 4px 0;
        margin-top: 8px;
      }

      .il-line-chart svg {
        display: block;
        width: 100%;
        height: auto;
      }

      .il-chart-legend {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 6px;
        margin: 9px 2px 0;
        color: #A1A1AA;
        font-size: 10px;
      }

      .il-legend-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #F97316;
        margin-right: 4px;
      }

      .il-chart-empty {
        text-align: center;
        background: #202126;
        border: 1px dashed #45464D;
        border-radius: 12px;
        padding: 22px 14px;
        margin-top: 10px;
        color: #F4F4F5;
      }

      .il-chart-empty-icon {
        color: #F97316;
        font-size: 30px;
        margin-bottom: 8px;
      }

      .il-chart-empty p {
        color: #A1A1AA;
        font-size: 12px;
        margin-bottom: 0;
      }

      @media (max-width: 380px) {
        .il-coach-grid {
          grid-template-columns: repeat(3,minmax(0,1fr));
          gap: 5px;
        }

        .il-coach-stat {
          padding: 9px 5px;
        }

        .il-coach-stat b {
          font-size: 16px;
        }

        .il-chart-summary {
          padding: 9px;
        }

        .il-chart-summary strong {
          font-size: 21px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // ---------- V7 PREMIUM THEME ----------

  function addPremiumStyles() {
    if (document.getElementById("il-v7-theme-styles")) return;

    const style = document.createElement("style");
    style.id = "il-v7-theme-styles";

    style.textContent = `
      :root {
        color-scheme: dark;
        --bg: #090B0E !important;
        --panel: #191D23 !important;
        --panel2: #252A31 !important;
        --line: #3A414B !important;
        --accent: #FF7926 !important;
        --muted: #B2B8C2 !important;
        --text: #F5F6F8 !important;
        --red: #EF4444 !important;
      }

      html {
        background: #090B0E !important;
      }

      body {
        background: #090B0E !important;
        color: #F5F6F8 !important;
      }

      header {
        background: linear-gradient(145deg,#20252C,#090B0E) !important;
        border-bottom: 1px solid #343B45 !important;
      }

      .brand {
        color: #FF7926 !important;
      }

      h1,h2,h3,h4,
      .title,.heading {
        color: #F5F6F8;
      }

      .muted,
      small,
      label,
      .small {
        color: #B2B8C2;
      }

      .card,
      .panel,
      .modal,
      .notice {
        background: #191D23 !important;
        border: 1px solid #353C46 !important;
        color: #F5F6F8 !important;
        box-shadow: 0 5px 18px rgba(0,0,0,.16);
      }

      .hero {
        background: linear-gradient(135deg,#382519,#202329) !important;
        border: 1px solid #85491F !important;
        color: #FFFFFF !important;
      }

      .hero h2,
      .hero h3,
      .hero p {
        color: #FFFFFF !important;
      }

      .day {
        background: #191D23 !important;
        border: 1px solid #3A414B !important;
        color: #FFFFFF !important;
        border-radius: 14px;
      }

      .day:active {
        background: #30251F !important;
      }

      .pill {
        background: #30251F !important;
        color: #FFB477 !important;
        border: 1px solid #754323 !important;
      }

      button,
      .btn {
        background: #FF7926 !important;
        color: #17191D !important;
        border: 1px solid #FF7926 !important;
        border-radius: 12px !important;
        font-weight: 850 !important;
      }

      button.secondary,
      .btn.secondary {
        background: #292F37 !important;
        color: #F5F6F8 !important;
        border: 1px solid #48515D !important;
      }

      button.ghost {
        background: transparent !important;
        color: #D2D6DC !important;
        border-color: transparent !important;
      }

      button.danger {
        background: #501F25 !important;
        color: #FFD9DC !important;
        border: 1px solid #A8323E !important;
      }

      button:focus-visible,
      input:focus-visible,
      select:focus-visible,
      textarea:focus-visible {
        outline: 2px solid #FF7926 !important;
        outline-offset: 3px;
      }

      input,
      select,
      textarea {
        background: #11151A !important;
        color: #FFFFFF !important;
        border: 1px solid #48515D !important;
      }

      input::placeholder,
      textarea::placeholder {
        color: #929BA7 !important;
      }

      input:focus,
      select:focus,
      textarea:focus {
        border-color: #FF7926 !important;
        outline: 1px solid #FF7926 !important;
      }

      .notice {
        background: #252B33 !important;
        color: #E5E9EF !important;
        border: 1px solid #414A56 !important;
      }

      .progressbar {
        background: #353B44 !important;
        border-radius: 20px;
        overflow: hidden;
      }

      .progressbar i {
        background: linear-gradient(90deg,#F05B22,#FF9A3D) !important;
        border-radius: 20px;
      }

      .stat {
        background: #252A31 !important;
        border: 1px solid #3A414B !important;
      }

      .stat b {
        color: #FF8A3D !important;
      }

      .history-detail {
        background: #252A31 !important;
      }

      .history-detail summary {
        color: #FF9A50 !important;
      }

      .history-sets span {
        background: #11151A !important;
        color: #F5F6F8 !important;
      }

      .history-sets .head {
        background: transparent !important;
        color: #B2B8C2 !important;
      }

      nav,
      .bottom-nav,
      #bottomNav,
      .tabbar,
      .tabs {
        background: #090B0E !important;
        border-top: 1px solid #343B45 !important;
      }

      nav {
        display: grid !important;
        grid-template-columns: repeat(3,minmax(0,1fr)) !important;
        gap: 9px !important;
        padding: 9px 10px calc(9px + env(safe-area-inset-bottom)) !important;
      }

      nav button,
      .bottom-nav button,
      #bottomNav button,
      .tabbar button,
      .tabs button {
        background: #1B2027 !important;
        color: #B8C0CA !important;
        border: 1px solid #363E49 !important;
        border-radius: 13px !important;
        min-width: 0;
        padding: 9px 4px !important;
        font-size: 12px !important;
        font-weight: 800 !important;
        box-shadow: none !important;
      }

      nav button span,
      .bottom-nav button span,
      #bottomNav button span {
        display: block;
        font-size: 21px;
        margin-bottom: 3px;
      }

      nav button.active,
      .bottom-nav button.active,
      #bottomNav button.active,
      .tabbar button.active,
      .tabs button.active,
      nav button[aria-current="page"] {
        background: #382519 !important;
        color: #FF8A3D !important;
        border: 1px solid #FF7926 !important;
        box-shadow: 0 0 12px rgba(255,121,38,.13) !important;
      }

      nav button:active,
      .bottom-nav button:active,
      #bottomNav button:active {
        transform: scale(.97);
      }

      .il-coach-card {
        background: #191D23 !important;
        border-color: #3A414B !important;
        color: #F5F6F8 !important;
      }

      .il-coach-heading {
        color: #FF8A3D !important;
      }

      .il-coach-stat {
        background: #252A31 !important;
        border-color: #3A414B !important;
      }

      .il-coach-stat b,
      .il-pr-value {
        color: #FF8A3D !important;
      }

      .il-adaptive-note {
        background: #30251F !important;
        border-color: #85491F !important;
        color: #F5F6F8 !important;
      }

      .il-adaptive-note strong {
        color: #FFAA70 !important;
      }

      .il-alert {
        background: #351C22 !important;
        border-color: #B83242 !important;
      }

      .il-alert strong {
        color: #FF747F !important;
      }

      .il-score {
        background: #252A31 !important;
        border-color: #3A414B !important;
      }

      .il-score b {
        color: #FF8A3D !important;
      }

      .il-muscle-row,
      .il-pr-row {
        border-color: #353C46 !important;
      }

      .il-line-chart {
        background: #202126;
        border-color: #383940;
      }

      @media (max-width: 380px) {
        nav {
          gap: 6px !important;
          padding-left: 7px !important;
          padding-right: 7px !important;
        }

        nav button {
          font-size: 11px !important;
        }
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
        draft[index][i] = {
          weight: "",
          reps: ""
        };
      }

      if (draft[index][i].weight === "") {
        draft[index][i].weight = String(weight);
      }
    }

    renderExercises();
    saveDraft();
  }

  // ---------- LIVE SESSION COMPARISON ----------

  function comparisonPrevious(name, index) {
    const today = todayKey();

    const sessions = recordsFor(name, index)
      .filter(record => {
        const recordDate = new Date(record.date);

        return !isNaN(recordDate) &&
          recordDate.toDateString() !== today &&
          Array.isArray(record.entries?.[index]) &&
          record.entries[index].some(validSet);
      });

    return sessions.length
      ? sessions[sessions.length - 1].entries[index]
      : null;
  }

  function compareSet(previous, currentSet) {
    if (!previous || !currentSet || !validSet(currentSet)) {
      return {
        label: "Enter set to compare",
        status: "waiting"
      };
    }

    const oldWeight = weightOf(previous);
    const newWeight = weightOf(currentSet);
    const oldReps = Number(previous.reps);
    const newReps = Number(currentSet.reps);

    if (oldWeight !== null && newWeight !== null) {
      if (newWeight === oldWeight && newReps > oldReps) {
        return {
          label: `↑ ${newReps - oldReps} reps`,
          status: "up"
        };
      }

      if (newWeight > oldWeight && newReps === oldReps) {
        return {
          label: `↑ ${newWeight - oldWeight} kg`,
          status: "up"
        };
      }

      if (newWeight === oldWeight && newReps === oldReps) {
        return { label: "Matched", status: "match" };
      }

      if (newWeight === oldWeight && newReps < oldReps) {
        return {
          label: `↓ ${oldReps - newReps} reps`,
          status: "down"
        };
      }

      if (newWeight < oldWeight && newReps === oldReps) {
        return {
          label: `↓ ${oldWeight - newWeight} kg`,
          status: "down"
        };
      }

      return {
        label: "Different load / reps",
        status: "different"
      };
    }

    if (oldWeight === null && newWeight === null) {
      if (newReps > oldReps) {
        return {
          label: `↑ ${newReps - oldReps}`,
          status: "up"
        };
      }

      if (newReps < oldReps) {
        return {
          label: `↓ ${oldReps - newReps}`,
          status: "down"
        };
      }

      return { label: "Matched", status: "match" };
    }

    return {
      label: "Different equipment / load",
      status: "different"
    };
  }

  function updateSessionComparison() {
    if (!current) return;

    const cards = document.querySelectorAll(
      "#exerciseList > .card"
    );

    cards.forEach((card, index) => {
      const panel = card.querySelector(".il-comparison");
      if (!panel) return;

      const previous = comparisonPrevious(current, index);
      const sets = draft?.[index] || [];

      panel.querySelectorAll("[data-comparison-set]")
        .forEach(row => {
          const setIndex = Number(row.dataset.comparisonSet);

          const result = compareSet(
            previous?.[setIndex],
            sets[setIndex]
          );

          row.textContent = result.label;
          row.className =
            `il-comparison-result ${result.status}`;
        });
    });
  }

  function renderSessionComparison() {
    if (!current) return;

    const cards = document.querySelectorAll(
      "#exerciseList > .card"
    );

    cards.forEach((card, index) => {
      const oldPanel = card.querySelector(".il-comparison");
      if (oldPanel) oldPanel.remove();

      const previous = comparisonPrevious(current, index);
      if (!previous) return;

      const panel = document.createElement("div");
      panel.className = "il-comparison";

      panel.innerHTML = `
        <div class="il-comparison-heading">
          LAST SESSION COMPARISON
        </div>

        <div class="il-comparison-grid">
          ${previous.filter(validSet).map((set, setIndex) => `
            <div class="il-comparison-row">
              <span>Set ${setIndex + 1}</span>
              <span>
                ${weightOf(set) === null ? "Bodyweight" : `${weightOf(set)} kg`}
                × ${Number(set.reps)}
              </span>
              <span
                class="il-comparison-result waiting"
                data-comparison-set="${setIndex}">
                Enter set to compare
              </span>
            </div>
          `).join("")}
        </div>
      `;

      const notice = card.querySelector(".notice");

      if (notice) {
        notice.after(panel);
      } else {
        card.appendChild(panel);
      }
    });

    updateSessionComparison();
  }

  function addComparisonStyles() {
    if (document.getElementById("il-comparison-styles")) return;

    const style = document.createElement("style");
    style.id = "il-comparison-styles";

    style.textContent = `
      .il-comparison {
        display: block;
        margin-top: 12px;
        padding: 13px;
        border-radius: 12px;
        background: #202630;
        border: 1px solid #FF7926;
        color: #F5F6F8;
      }

      .il-comparison-heading {
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 1px;
        color: #FF9A50;
        margin-bottom: 9px;
      }

      .il-comparison-row {
        display: grid;
        grid-template-columns: 45px minmax(0,1fr) minmax(0,1fr);
        align-items: center;
        gap: 6px;
        padding: 9px 0;
        border-top: 1px solid #414A56;
        font-size: 11px;
      }

      .il-comparison-result {
        text-align: right;
        font-weight: 900;
      }

      .il-comparison-result.up {
        color: #FF9A3D;
      }

      .il-comparison-result.match {
        color: #C4CDD8;
      }

      .il-comparison-result.down {
        color: #FF626F;
      }

      .il-comparison-result.different {
        color: #AAB5C2;
      }

      .il-comparison-result.waiting {
        color: #929EAC;
      }
    `;

    document.head.appendChild(style);

    document.addEventListener("input", function(event) {
      if (event.target.matches("#exerciseList input[data-ex]")) {
        updateSessionComparison();
      }
    });
  }

  // ---------- WORKOUT SCREEN ----------

  window.renderExercises = function () {
    addStyles();
    addPremiumStyles();

    originalRenderExercises();

    addComparisonStyles();

    const cards = document.querySelectorAll(
      "#exerciseList > .card"
    );

    cards.forEach((card, index) => {
      card.querySelectorAll(
        ".smart-tip,.il-adaptive-note"
      ).forEach(element => element.remove());

      const rx = originalPrescription(current, index);
      const advice = progression(current, index, rx);
      const recovery = recoveryStatus(
        current,
        index,
        rx.sets
      );

      const plateau = plateauStatus(
        current,
        index,
        rx.sets
      );

      const note = document.createElement("div");

      note.className =
        "il-adaptive-note" +
        (recovery.alert || plateau.plateau
          ? " il-alert"
          : "");

      let action = "";

      if (advice.suggestedWeight && !rx.deload) {
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
        <strong>${escapeHTML(advice.title)}</strong>
        <div style="margin-top:5px">
          ${escapeHTML(advice.detail)}
        </div>
        ${action}
      `;

      const previous = card.querySelector(".notice");

      if (previous) {
        previous.insertAdjacentElement("afterend", note);
      } else {
        card.appendChild(note);
      }
    });

    renderSessionComparison();

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
        const wanted = originalPrescription(
          name,
          index
        ).sets;

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

      const stamp = new Date(
        recoverable.savedAt
      ).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

      const meta = document.getElementById(
        "workoutMeta"
      );

      if (meta) {
        meta.textContent =
          `${plan[name].focus} · unfinished workout restored (saved ${stamp})`;
      }
    }

    saveDraft();
  };

  
window.finish = function () {
  try {
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

    if (typeof originalFinish !== "function") {
      throw new Error("Original finish function was not found.");
    }

    originalFinish();

    clearDraft();
    renderHome();

  } catch (error) {
    console.error("IronLog finish error:", error);

    alert(
      "IronLog could not complete this workout.\n\nError: " +
      (error.message || error)
    );
  }
};


  
  window.renderHome = function () {
    addStyles();
    addPremiumStyles();

    originalRenderHome();

    const saved = readDraft();

    const hero = document.querySelector("#todayPage .hero");
    const page = document.querySelector("#todayPage");
    const anchor = hero || page;

    if (!anchor) return;

    // ---------- V11 COMMAND CENTRE STYLES ----------
    if (!document.getElementById("il-v11-home-styles")) {
      const style = document.createElement("style");
      style.id = "il-v11-home-styles";
      style.textContent = `
        #ilHomeCommandCentre {
          margin: 16px 0;
          padding: 16px;
          border-radius: 18px;
          background: linear-gradient(145deg,#202329,#15171b);
          border: 1px solid #383d45;
          color: #f4f5f7;
          box-shadow: 0 8px 24px rgba(0,0,0,.22);
        }
        #ilHomeCommandCentre .il-v11-kicker {
          color: #ff8738;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.8px;
          margin-bottom: 12px;
        }
        #ilHomeCommandCentre .il-v11-focus {
          padding: 15px;
          border-radius: 14px;
          background: linear-gradient(120deg,#34251f,#242126);
          border: 1px solid #75432d;
          margin-bottom: 13px;
        }
        #ilHomeCommandCentre .il-v11-label {
          color: #ff9a55;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.1px;
          text-transform: uppercase;
        }
        #ilHomeCommandCentre .il-v11-workout {
          font-size: 23px;
          font-weight: 900;
          margin: 5px 0 3px;
        }
        #ilHomeCommandCentre .il-v11-muted {
          color: #aeb4bd;
          font-size: 12px;
          line-height: 1.5;
        }
        #ilHomeCommandCentre .il-v11-start {
          width: 100%;
          margin-top: 13px;
          padding: 12px;
          border: 0;
          border-radius: 10px;
          background: linear-gradient(90deg,#ff762e,#ed493e);
          color: #fff;
          font-weight: 900;
          font-size: 13px;
        }
        #ilHomeCommandCentre .il-v11-stats {
          display: grid;
          grid-template-columns: repeat(3,minmax(0,1fr));
          gap: 8px;
          margin: 12px 0;
        }
        #ilHomeCommandCentre .il-v11-stat {
          padding: 12px 7px;
          border-radius: 11px;
          background: #292d34;
          text-align: center;
          min-width: 0;
        }
        #ilHomeCommandCentre .il-v11-number {
          font-size: 21px;
          font-weight: 900;
          color: #ff9148;
        }
        #ilHomeCommandCentre .il-v11-stat-label {
          color: #aeb4bd;
          font-size: 10px;
          margin-top: 3px;
        }
        #ilHomeCommandCentre .il-v11-section {
          padding: 12px 0;
          border-top: 1px solid #383d45;
        }
        #ilHomeCommandCentre .il-v11-section-title {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .7px;
          text-transform: uppercase;
          margin-bottom: 6px;
          color: #ff9148;
        }
        #ilHomeCommandCentre .il-v11-message {
          font-size: 13px;
          line-height: 1.5;
          color: #e1e4e8;
        }
        #ilHomeCommandCentre .il-v11-resume {
          margin-top: 10px;
          padding-top: 12px;
          border-top: 1px solid #383d45;
        }
        #ilHomeCommandCentre #resumeWorkout {
          width: 100%;
          margin-top: 8px !important;
          padding: 12px;
          border-radius: 10px;
          font-weight: 800;
        }
      `;
      document.head.appendChild(style);
    }

    // Remove previous dashboard before rebuilding it.
    const oldDashboard = document.getElementById(
      "ilHomeCommandCentre"
    );
    if (oldDashboard) oldDashboard.remove();

    // ---------- TODAY'S WORKOUT ----------
    const dayNames = [
      "Sunday", "Monday", "Tuesday", "Wednesday",
      "Thursday", "Friday", "Saturday"
    ];

    const today = new Date();
    const todayName = dayNames[today.getDay()];

    let nextName = null;
    let nextOffset = 8;

    Object.keys(plan).forEach(name => {
      const workoutDay = plan[name].day;
      const dayIndex = dayNames.indexOf(workoutDay);

      if (dayIndex === -1) return;

      const offset = (dayIndex - today.getDay() + 7) % 7;

      if (offset < nextOffset) {
        nextOffset = offset;
        nextName = name;
      }
    });

    if (!nextName) return;

    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + nextOffset);

    const dateLabel = nextOffset === 0
      ? "Today"
      : nextDate.toLocaleDateString([], {
          weekday: "long",
          day: "numeric",
          month: "short"
        });

    const focusLabel = nextOffset === 0
      ? "TODAY'S TRAINING FOCUS"
      : "NEXT SCHEDULED WORKOUT";

    // ---------- WEEKLY PROGRESS ----------
    let report = {
      sessions: 0,
      sets: 0,
      volume: 0,
      score: 0
    };

    try {
      report = weeklyReport() || report;
    } catch (error) {
      console.warn("IronLog weekly report unavailable", error);
    }

    const sessions = Number(report.sessions) || 0;
    const sets = Number(report.sets) || 0;
    const weeklyPercent = Math.min(100, Math.round(
      sessions / 4 * 100
    ));

    // ---------- PROGRESSION COACH MESSAGE ----------
    let coachMessage =
      "Keep logging your sessions. The more comparable workouts you record, the smarter your IronLog coaching becomes.";

    let progressing = 0;
    let attention = 0;
    let exerciseCount = 0;

    try {
      const exercises = allExercises();

      exercises.forEach(item => {
        const data = progressionOverviewData(
          item.name,
          item.index
        );

        if (!data) return;

        exerciseCount++;

        if (data.status === "up") progressing++;
        if (data.status === "attention") attention++;
      });

      if (sessions === 0) {
        coachMessage =
          "Your week is ready to begin. Log your planned sessions and IronLog will start building your personal performance baseline.";
      } else if (attention > 0) {
        coachMessage =
          `${attention} exercise${attention === 1 ? "" : "s"} show a recent performance dip. Prioritise recovery, good technique and consistent effort before pushing the weight up.`;
      } else if (progressing > 0) {
        coachMessage =
          `${progressing} exercise${progressing === 1 ? "" : "s"} show measurable progress. Great work! Keep building reps within your target range before increasing the load.`;
      } else {
        coachMessage =
          "Consistency is the priority. Keep your technique controlled and record your sets so IronLog can identify your next progression opportunities.";
      }
    } catch (error) {
      console.warn("IronLog coaching summary unavailable", error);
    }

    // ---------- LATEST RECORDED PERSONAL BEST ----------
    let latestPR = null;

    try {
      allExercises().forEach(item => {
        const pr = personalRecord(item.name, item.index);

        if (!pr || !pr.weight) return;

        const timestamp = pr.date
          ? new Date(pr.date).getTime()
          : 0;

        if (!latestPR || timestamp > latestPR.timestamp) {
          latestPR = {
            name: item.name,
            weight: pr.weight,
            reps: pr.reps,
            date: pr.date,
            timestamp
          };
        }
      });
    } catch (error) {
      console.warn("IronLog personal best unavailable", error);
    }

    let achievementText = "Your personal bests will appear here as you record your training.";

    if (latestPR) {
      achievementText =
        `${esc(latestPR.name)} · ${esc(latestPR.weight)} kg × ${esc(latestPR.reps)}`;

      if (latestPR.date) {
        const prDate = new Date(latestPR.date);

        if (!isNaN(prDate.getTime())) {
          achievementText +=
            ` · ${prDate.toLocaleDateString([], {
              day: "numeric",
              month: "short",
              year: "numeric"
            })}`;
        }
      }
    }

    // ---------- BUILD COMMAND CENTRE ----------
    const dashboard = document.createElement("section");
    dashboard.id = "ilHomeCommandCentre";

    dashboard.innerHTML = `
      <div class="il-v11-kicker">IRONLOG · COMMAND CENTRE</div>

      <div class="il-v11-focus">
        <div class="il-v11-label">${focusLabel}</div>
        <div class="il-v11-workout">${esc(nextName)}</div>
        <div class="il-v11-muted">
          ${esc(plan[nextName].focus)}<br>
          ${esc(dateLabel)} · ${esc(plan[nextName].day)}
        </div>
        <button class="il-v11-start" id="ilV11StartWorkout">
          ${nextOffset === 0 ? "START TODAY'S WORKOUT" : "VIEW NEXT WORKOUT"}
        </button>
      </div>

      <div class="il-v11-label">YOUR WEEK AT A GLANCE</div>
      <div class="il-v11-stats">
        <div class="il-v11-stat">
          <div class="il-v11-number">${sessions}</div>
          <div class="il-v11-stat-label">Sessions / 4</div>
        </div>
        <div class="il-v11-stat">
          <div class="il-v11-number">${sets}</div>
          <div class="il-v11-stat-label">Sets logged</div>
        </div>
        <div class="il-v11-stat">
          <div class="il-v11-number">${weeklyPercent}%</div>
          <div class="il-v11-stat-label">Weekly target</div>
        </div>
      </div>

      <div style="height:6px;background:#383d45;border-radius:8px;overflow:hidden;margin-bottom:14px;">
        <div style="height:100%;width:${weeklyPercent}%;background:linear-gradient(90deg,#ff762e,#ed493e);border-radius:8px;"></div>
      </div>

      <div class="il-v11-section">
        <div class="il-v11-section-title">IRONLOG COACH</div>
        <div class="il-v11-message">${coachMessage}</div>
      </div>

      <div class="il-v11-section">
        <div class="il-v11-section-title">LATEST RECORDED PERSONAL BEST</div>
        <div class="il-v11-message">${achievementText}</div>
      </div>

      <div class="il-v11-resume" id="ilV11ResumeWrap" style="display:none;">
        <div class="il-v11-section-title">WORKOUT IN PROGRESS</div>
        <div class="il-v11-muted">Pick up where you left off.</div>
      </div>
    `;

    if (hero) {
      hero.insertAdjacentElement("afterend", dashboard);
    } else {
      anchor.insertBefore(dashboard, anchor.firstChild);
    }

    const startButton = document.getElementById(
      "ilV11StartWorkout"
    );

    if (startButton) {
      startButton.onclick = () => openWorkout(nextName);
    }

    // ---------- PRESERVE EXISTING RESUME BUTTON ----------
    let resume = document.getElementById("resumeWorkout");

    if (saved) {
      if (!resume) {
        resume = document.createElement("button");
        resume.id = "resumeWorkout";
        resume.className = "secondary";
      }

      const when = new Date(saved.savedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

      resume.textContent =
        `Resume ${saved.name} workout · saved ${when}`;

      resume.onclick = () => openWorkout(saved.name);

      const resumeWrap = document.getElementById(
        "ilV11ResumeWrap"
      );

      if (resumeWrap) {
        resumeWrap.style.display = "block";
        resumeWrap.appendChild(resume);
      }
    } else if (resume) {
      resume.remove();
    }
  };


  // ---------- V9 EXERCISE PROGRESSION DATA ----------

  function progressionMetric(record, index, count) {
    const rows = (record.entries?.[index] || [])
      .slice(0, count)
      .filter(validSet);

    if (!rows.length) return null;

    const weighted = rows
      .map(set => {
        const weight = weightOf(set);
        const reps = Number(set.reps);

        return weight !== null
          ? weight * (1 + reps / 30)
          : null;
      })
      .filter(value => value !== null);

    if (weighted.length) {
      return weighted.reduce((a, b) => a + b, 0) /
        weighted.length;
    }

    return totalReps(rows) / rows.length;
  }

  function progressionOverviewData(name, index) {
    const rx = originalPrescription(name, index);

    const records = completeRecordsFor(
      name,
      index,
      rx.sets
    );

    if (!records.length) {
      return {
        status: "baseline",
        label: "Building baseline",
        detail: "Complete this exercise to start tracking progress."
      };
    }

    if (records.length < 2) {
      return {
        status: "baseline",
        label: "Building baseline",
        detail: "One completed session logged. Another is needed for comparison."
      };
    }

    const latest = records[records.length - 1];
    const previous = records[records.length - 2];

    const latestMetric = progressionMetric(
      latest,
      index,
      rx.sets
    );

    const previousMetric = progressionMetric(
      previous,
      index,
      rx.sets
    );

    if (
      latestMetric === null ||
      previousMetric === null ||
      previousMetric <= 0
    ) {
      return {
        status: "baseline",
        label: "Building baseline",
        detail: "Not enough comparable performance data yet."
      };
    }

    const change =
      ((latestMetric - previousMetric) / previousMetric) * 100;

    let consecutiveDrops = 0;

    for (let i = records.length - 1; i > 0; i--) {
      const currentMetric = progressionMetric(
        records[i],
        index,
        rx.sets
      );

      const previousValue = progressionMetric(
        records[i - 1],
        index,
        rx.sets
      );

      if (
        currentMetric !== null &&
        previousValue !== null &&
        previousValue > 0 &&
        currentMetric <= previousValue * 0.95
      ) {
        consecutiveDrops++;
      } else {
        break;
      }
    }

    const latestRows = (latest.entries?.[index] || [])
      .slice(0, rx.sets)
      .filter(validSet);

    const weights = latestRows
      .map(weightOf)
      .filter(value => value !== null);

    const averageReps = latestRows.length
      ? Math.round(
          totalReps(latestRows) / latestRows.length * 10
        ) / 10
      : 0;

    const loadText = weights.length
      ? `${median(weights)} kg`
      : "Bodyweight / timed";

    const performanceText =
      `Latest: ${loadText} · ${averageReps} reps average`;

    if (consecutiveDrops >= 2) {
      return {
        status: "attention",
        label: "Needs attention",
        detail: `${performanceText}. Performance has declined across consecutive sessions.`,
        change
      };
    }

    if (change >= 2) {
      return {
        status: "up",
        label: "Progressing",
        detail: `${performanceText}. Estimated performance is up ${change.toFixed(1)}%.`,
        change
      };
    }

    if (change <= -5) {
      return {
        status: "watch",
        label: "Watch",
        detail: `${performanceText}. Performance is down ${Math.abs(change).toFixed(1)}% this session.`,
        change
      };
    }

    return {
      status: "steady",
      label: "Maintaining",
      detail: `${performanceText}. Performance is broadly stable.`,
      change
    };
  }

  // ---------- V10 COMPACT PROGRESS DASHBOARD ----------

  function renderCoachDashboard() {
    addStyles();
    addPremiumStyles();
    addProgressionStyles();

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

    const exercises = allExercises();

    let progressing = 0;
    let attention = 0;

    exercises.forEach(item => {
      const result = progressionOverviewData(
        item.name,
        item.index
      );

      if (result.status === "up") progressing++;
      if (result.status === "attention") attention++;
    });

    dashboard.className = "il-coach-card";

    dashboard.innerHTML = `
      <div class="il-coach-heading">
        IRONLOG · TRAINING INSIGHTS
      </div>

      <div class="il-coach-grid il-overview-stats">
        <div class="il-coach-stat">
          <b>${progressing}</b>
          <small>Progressing</small>
        </div>

        <div class="il-coach-stat">
          <b>${exercises.length}</b>
          <small>Exercises tracked</small>
        </div>

        <div class="il-coach-stat">
          <b>${attention}</b>
          <small>Need attention</small>
        </div>
      </div>

      <details class="il-accordion il-main-coach">
        <summary>
          <span class="il-accordion-icon">✦</span>

          <span class="il-accordion-title">
            <strong>Intelligent Training Coach</strong>
            <small>Weekly report, activity and strength insights</small>
          </span>

          <span class="il-accordion-arrow">⌄</span>
        </summary>

        <div class="il-accordion-content">

          <details class="il-sub-accordion">
            <summary>
              <span>Weekly Training Report</span>
              <span class="il-accordion-arrow">⌄</span>
            </summary>

            <div class="il-sub-content">
              <div id="ilWeeklyReport"></div>
            </div>
          </details>

          <details class="il-sub-accordion">
            <summary>
              <span>Muscle Group Activity</span>
              <span class="il-accordion-arrow">⌄</span>
            </summary>

            <div class="il-sub-content">
              <p class="muted small">
                Sets and logged weighted volume over the last 7 days.
              </p>

              ${muscleHTML()}
            </div>
          </details>

          <details class="il-sub-accordion">
            <summary>
              <span>Strength Trends</span>
              <span class="il-accordion-arrow">⌄</span>
            </summary>

            <div class="il-sub-content">
              <label for="ilTrendSelect">Choose an exercise</label>

              <select id="ilTrendSelect" class="il-select">
                ${exercises.map((item, i) => `
                  <option value="${i}">
                    ${esc(item.name)} · ${esc(item.exercise)}
                  </option>
                `).join("")}
              </select>

              <div id="ilTrendChart"></div>
            </div>
          </details>

          <details class="il-sub-accordion">
            <summary>
              <span>Personal Records</span>

              <span class="il-pr-count">
                ${exercises.filter(item => item.pr).length} / ${exercises.length}
              </span>

              <span class="il-accordion-arrow">⌄</span>
            </summary>

            <div class="il-sub-content">
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
            </div>
          </details>

          <p class="muted small il-coach-footnote">
            Progress recommendations are based on recorded sessions.
            Always prioritise controlled technique, sensible effort and recovery.
          </p>

        </div>
      </details>
    `;

    // Build the weekly report inside its own expandable section.
    const week = weeklyReport();
    const weeklyContainer = document.getElementById(
      "ilWeeklyReport"
    );

    if (weeklyContainer) {
      weeklyContainer.innerHTML = `
        <div class="il-score">
          <div>
            <b>${week.score}%</b>
            <small>Consistency and logging score · last 7 days</small>
          </div>

          <span class="pill">
            ${week.sessions} / 4 sessions
          </span>
        </div>

        <div class="progressbar">
          <i style="width:${week.score}%"></i>
        </div>

        <div class="il-coach-grid" style="margin:10px 0 12px">
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
          This score measures consistency and logging, not fitness or effort.
        </p>
      `;
    }

    const select = document.getElementById(
      "ilTrendSelect"
    );

    const chart = document.getElementById(
      "ilTrendChart"
    );

    function updateChart() {
      if (!select || !chart) return;

      const item = exercises[Number(select.value)];

      chart.innerHTML = item
        ? trendChart(item.name, item.index)
        : "";
    }

    if (select) {
      select.onchange = updateChart;
      updateChart();
    }
  }

  // ---------- V10 EXPANDABLE EXERCISE PROGRESSION ----------

  function renderProgressionOverview() {
    const dashboard = document.getElementById(
      "ilCoachDashboard"
    );

    if (!dashboard) return;

    dashboard.querySelector(
      "#ilProgressionOverview"
    )?.remove();

    const overview = document.createElement("div");

    overview.id = "ilProgressionOverview";
    overview.className = "il-section";

    const statusIcons = {
      up: "↑",
      steady: "●",
      watch: "!",
      attention: "!",
      baseline: "○"
    };

    const sections = Object.keys(plan).map(name => {
      let dayProgressing = 0;

      const results = plan[name].items.map((item, index) => {
        const result = progressionOverviewData(
          name,
          index
        );

        if (result.status === "up") dayProgressing++;

        return { item, result };
      });

      const rows = results.map(({ item, result }) => `
        <div class="il-progression-row">
          <div class="il-progression-main">
            <b>${esc(item[0])}</b>

            <span class="il-progression-status ${result.status}">
              ${statusIcons[result.status]} ${esc(result.label)}
            </span>
          </div>

          <div class="il-progression-detail">
            ${esc(result.detail)}
          </div>
        </div>
      `).join("");

      return `
        <details class="il-progression-day">
          <summary>
            <span class="il-progression-day-title">
              <strong>${esc(name)} Day</strong>

              <small>
                ${results.length} exercises · ${dayProgressing} progressing
              </small>
            </span>

            <span class="il-accordion-arrow">⌄</span>
          </summary>

          <div class="il-progression-day-content">
            ${rows}
          </div>
        </details>
      `;
    }).join("");

    overview.innerHTML = `
      <div class="il-coach-heading">
        EXERCISE PROGRESSION
      </div>

      <p class="muted small">
        Tap a training day to inspect your individual exercise progress.
      </p>

      ${sections}

      <p class="muted small il-progression-footnote">
        Progress is estimated using recorded working sets.
        One difficult session does not automatically mean lost strength.
        Check technique, sleep and recovery before changing your programme.
      </p>
    `;

    dashboard.appendChild(overview);
  }

  // ---------- V10 ACCORDION STYLES ----------

  function addProgressionStyles() {
    if (document.getElementById("il-v10-layout-styles")) return;

    const style = document.createElement("style");
    style.id = "il-v10-layout-styles";

    style.textContent = `
      .il-overview-stats {
        margin: 12px 0 18px;
      }

      .il-accordion,
      .il-sub-accordion {
        background: #20252C;
        border: 1px solid #3A414B;
        border-radius: 13px;
        margin-top: 10px;
        overflow: hidden;
      }

      .il-accordion > summary,
      .il-sub-accordion > summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 15px;
        cursor: pointer;
        list-style: none;
        color: #F5F6F8;
        font-size: 13px;
        font-weight: 800;
      }

      .il-accordion > summary::-webkit-details-marker,
      .il-sub-accordion > summary::-webkit-details-marker,
      .il-progression-day > summary::-webkit-details-marker {
        display: none;
      }

      .il-accordion-title {
        flex: 1;
        min-width: 0;
      }

      .il-accordion > summary strong,
      .il-progression-day > summary strong {
        display: block;
        color: #F5F6F8;
        font-size: 13px;
      }

      .il-accordion > summary small,
      .il-progression-day > summary small {
        display: block;
        color: #B2B8C2;
        font-size: 10px;
        font-weight: 500;
        margin-top: 4px;
      }

      .il-accordion-icon {
        color: #FF8A3D;
        font-size: 21px;
        flex: 0 0 auto;
      }

      .il-accordion-arrow {
        color: #FF9A50;
        font-size: 20px;
        transition: transform .2s ease;
        flex: 0 0 auto;
      }

      .il-accordion[open] > summary,
      .il-sub-accordion[open] > summary,
      .il-progression-day[open] > summary {
        border-bottom: 1px solid #3A414B;
        background: #292F37;
      }

      .il-accordion[open] > summary .il-accordion-arrow,
      .il-sub-accordion[open] > summary .il-accordion-arrow,
      .il-progression-day[open] > summary .il-accordion-arrow {
        transform: rotate(180deg);
      }

      .il-accordion-content {
        padding: 8px 12px 14px;
      }

      .il-sub-accordion {
        margin-top: 9px;
        background: #191D23;
      }

      .il-sub-accordion > summary {
        padding: 13px;
        font-size: 12px;
      }

      .il-sub-content {
        padding: 12px;
      }

      .il-pr-count {
        color: #FF9A50;
        font-size: 11px;
        margin-left: auto;
      }

      .il-pr-list {
        max-height: 420px;
        overflow: auto;
      }

      .il-main-coach {
        border-color: #754323;
      }

      .il-main-coach > summary {
        background: linear-gradient(120deg,#30251F,#20252C);
      }

      .il-main-coach[open] > summary {
        border-bottom-color: #754323;
      }

      .il-coach-footnote,
      .il-progression-footnote {
        line-height: 1.5;
        margin-top: 14px;
      }

      .il-progression-day {
        margin-top: 9px;
        border: 1px solid #3A414B;
        border-radius: 13px;
        background: #20252C;
        overflow: hidden;
      }

      .il-progression-day > summary {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding: 14px;
        cursor: pointer;
        list-style: none;
      }

      .il-progression-day-title {
        flex: 1;
        min-width: 0;
      }

      .il-progression-day-content {
        padding: 0 13px 10px;
      }

      .il-progression-row {
        padding: 11px 0;
        border-top: 1px solid #3A414B;
      }

      .il-progression-main {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .il-progression-main b {
        color: #F5F6F8;
        font-size: 13px;
      }

      .il-progression-status {
        font-size: 11px;
        font-weight: 900;
      }

      .il-progression-status.up {
        color: #FB923C;
      }

      .il-progression-status.steady {
        color: #C4CDD8;
      }

      .il-progression-status.watch {
        color: #FBBF24;
      }

      .il-progression-status.attention {
        color: #F87171;
      }

      .il-progression-status.baseline {
        color: #A1A1AA;
      }

      .il-progression-detail {
        color: #B2B8C2;
        font-size: 11px;
        margin-top: 5px;
        line-height: 1.5;
      }

      @media (max-width: 380px) {
        .il-accordion-content {
          padding-left: 8px;
          padding-right: 8px;
        }

        .il-coach-stat {
          padding: 9px 5px;
        }

        .il-accordion > summary {
          padding: 13px 11px;
        }

        .il-progression-main {
          align-items: flex-start;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // ---------- PROGRESS TAB WRAPPER ----------

  window.renderProgress = function () {
    addStyles();
    addPremiumStyles();
    addProgressionStyles();

    originalRenderProgress();

    renderCoachDashboard();
    renderProgressionOverview();
  };

  // ---------- STARTUP ----------

  addStyles();
  addPremiumStyles();
  addComparisonStyles();
  addProgressionStyles();

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

   window.renderHome();

  console.log(
    `IronLog Intelligent Training Coach ${VERSION} loaded.`
  );
})();

/* =========================================================
   IRONLOG v12 — INTELLIGENT PROGRESSION ENGINE
   Multi-session performance analysis
   Exercise-specific weight increments
   Increase / maintain / reduce recommendations
   Preserves all existing IronLog storage
   ========================================================= */

(() => {
  "use strict";

  const V12_STYLE_ID = "il-v12-progression-styles";

  function v12ValidSet(set) {
    return !!set &&
      set.reps !== "" &&
      Number.isFinite(Number(set.reps)) &&
      Number(set.reps) > 0;
  }

  function v12Weight(set) {
    const value = Number(set?.weight);

    return set?.weight !== "" &&
      Number.isFinite(value) &&
      value > 0
        ? value
        : null;
  }

  function v12Median(values) {
    if (!values.length) return null;

    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function v12Target(target) {
    const match = String(target).match(/(\d+)\s*[–-]\s*(\d+)/);

    return match
      ? {
          min: Number(match[1]),
          max: Number(match[2]),
          timed: /sec/i.test(String(target))
        }
      : null;
  }

  function v12Increment(name, weight) {
    const lower = name.toLowerCase();

    if (lower.includes("leg press")) return 5;

    if (
      lower.includes("dumbbell") ||
      lower.includes("lateral raise") ||
      lower.includes("curl") ||
      lower.includes("extension") ||
      lower.includes("pec deck")
    ) {
      return weight < 15 ? 1 : 2;
    }

    if (
      lower.includes("cable") ||
      lower.includes("pulldown") ||
      lower.includes("row")
    ) {
      return weight < 30 ? 1.25 : 2.5;
    }

    return 2.5;
  }

  function v12RoundWeight(value) {
    return Math.round(value * 2) / 2;
  }

  function v12Records(name, index, setCount) {
    if (!db || !Array.isArray(db.history)) return [];

    return db.history
      .filter(record =>
        record.name === name &&
        Array.isArray(record.entries?.[index]) &&
        record.entries[index].length >= setCount &&
        record.entries[index]
          .slice(0, setCount)
          .every(v12ValidSet)
      )
      .slice()
      .sort((a, b) =>
        new Date(a.date || 0) - new Date(b.date || 0)
      );
  }

  function v12Analyse(name, index) {
    const item = plan[name]?.items?.[index];

    if (!item) return null;

    const exercise = item[0];
    const setCount = Number(item[1]);
    const target = v12Target(item[2]);

    if (!target) {
      return {
        status: "maintain",
        title: "Maintain and refine",
        detail: "Keep building consistent performance before changing the exercise difficulty."
      };
    }

    const records = v12Records(name, index, setCount);

    if (records.length < 2) {
      return {
        status: "baseline",
        title: "Building your baseline",
        detail: "Complete at least two comparable sessions. IronLog needs more performance data before recommending a weight change."
      };
    }

    const latest = records[records.length - 1];
    const previous = records[records.length - 2];

    const latestRows = latest.entries[index].slice(0, setCount);
    const previousRows = previous.entries[index].slice(0, setCount);

    const latestReps = latestRows.map(set => Number(set.reps));
    const previousReps = previousRows.map(set => Number(set.reps));

    const latestTotal = latestReps.reduce((a, b) => a + b, 0);
    const previousTotal = previousReps.reduce((a, b) => a + b, 0);

    const weights = latestRows
      .map(v12Weight)
      .filter(value => value !== null);

    const previousWeights = previousRows
      .map(v12Weight)
      .filter(value => value !== null);

    const load = v12Median(weights);
    const previousLoad = v12Median(previousWeights);

    const allLatestTop = latestReps.every(
      reps => reps >= target.max
    );

    const allPreviousTop = previousReps.every(
      reps => reps >= target.max
    );

    const belowMinimum = latestReps.filter(
      reps => reps < target.min
    ).length;

    const significantDrop =
      previousTotal > 0 &&
      latestTotal <= previousTotal * 0.8;

    if (
      belowMinimum >= Math.ceil(setCount / 2) ||
      significantDrop
    ) {
      if (load !== null) {
        const reduction = Math.max(
          1,
          v12Increment(exercise, load)
        );

        const suggested = v12RoundWeight(
          Math.max(0, load - reduction)
        );

        return {
          status: "reduce",
          title: "Consider reducing the load",
          suggestedWeight: suggested,
          detail: significantDrop
            ? "Your total repetitions dropped by at least 20% compared with the previous session. Consider a lighter working weight and check your recovery."
            : `Several sets fell below your target minimum of ${target.min}. A small reduction may help restore controlled repetitions and consistent technique.`
        };
      }

      return {
        status: "reduce",
        title: "Review exercise difficulty",
        detail: "Your recent performance has dipped. Check recovery and consider an easier variation before progressing."
      };
    }

    if (
      !target.timed &&
      load !== null &&
      allLatestTop &&
      allPreviousTop &&
      (
        previousLoad === null ||
        load >= previousLoad
      )
    ) {
      const increment = v12Increment(exercise, load);

      const suggested = v12RoundWeight(
        load + increment
      );

      return {
        status: "increase",
        title: "Progression earned",
        suggestedWeight: suggested,
        detail: `You've reached at least ${target.max} reps on every set in two consecutive sessions. Consider moving from ${load} kg to ${suggested} kg while maintaining controlled technique.`
      };
    }

    if (target.timed && allLatestTop && allPreviousTop) {
      return {
        status: "maintain",
        title: "Timed target achieved",
        detail: "You've consistently reached the top of your timed target. Maintain the hold quality before considering a harder variation."
      };
    }

    if (allLatestTop && !allPreviousTop) {
      return {
        status: "maintain",
        title: "Confirm your progress",
        detail: "You've reached the top of the rep range this session. Repeat that performance next time before increasing the load."
      };
    }

    return {
      status: "maintain",
      title: "Maintain your working weight",
      detail: `Keep your current load and build towards ${target.max} reps on every set. IronLog will reassess your progression after your next completed session.`
    };
  }

  function v12Styles() {
    if (document.getElementById(V12_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = V12_STYLE_ID;

    style.textContent = `
      .il-v12-card {
        margin-top: 12px;
        padding: 13px;
        border-radius: 13px;
        background: linear-gradient(145deg,#242A32,#191D23);
        border: 1px solid #454D59;
        color: #F5F6F8;
      }

      .il-v12-heading {
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 1.2px;
        color: #FF9148;
        margin-bottom: 9px;
      }

      .il-v12-title {
        font-size: 14px;
        font-weight: 900;
        margin-bottom: 6px;
      }

      .il-v12-detail {
        font-size: 12px;
        line-height: 1.55;
        color: #C4CBD4;
      }

      .il-v12-weight {
        margin-top: 10px;
        padding: 10px;
        background: #30251F;
        border: 1px solid #754323;
        border-radius: 10px;
        color: #FFB477;
        font-size: 13px;
        font-weight: 850;
      }

      .il-v12-card button {
        width: 100%;
        margin-top: 10px;
        padding: 11px;
        border-radius: 10px;
        background: linear-gradient(90deg,#FF762E,#ED493E);
        border: 0;
        color: white;
        font-weight: 900;
      }

      .il-v12-card.increase {
        border-color: #A85A2D;
      }

      .il-v12-card.reduce {
        border-color: #A83242;
      }

      .il-v12-card.reduce .il-v12-heading {
        color: #FF747F;
      }

      .il-v12-card.baseline {
        border-color: #454D59;
      }
    `;

    document.head.appendChild(style);
  }

  function v12Render() {
    if (!current || !plan[current]) return;

    v12Styles();

    const cards = document.querySelectorAll(
      "#exerciseList > .card"
    );

    cards.forEach((card, index) => {
      card.querySelector(".il-v12-card")?.remove();

      const result = v12Analyse(current, index);
      if (!result) return;

      const panel = document.createElement("div");

      panel.className =
        `il-v12-card ${result.status}`;

      const weightHTML = result.suggestedWeight !== undefined
        ? `
          <div class="il-v12-weight">
            Suggested next-session weight:
            ${result.suggestedWeight} kg
          </div>
          <button
            type="button"
            data-v12-apply="${index}"
            data-v12-weight="${result.suggestedWeight}">
            Apply to empty sets
          </button>
        `
        : "";

      panel.innerHTML = `
        <div class="il-v12-heading">
          IRONLOG · V12 PROGRESSION COACH
        </div>
        <div class="il-v12-title">
          ${result.title}
        </div>
        <div class="il-v12-detail">
          ${result.detail}
        </div>
        ${weightHTML}
      `;

      card.appendChild(panel);
    });
  }

  function v12ApplyWeight(index, weight) {
    if (!current || !plan[current] || !Array.isArray(draft[index])) {
      return;
    }

    const count = Number(plan[current].items[index][1]);

    for (let i = 0; i < count; i++) {
      if (!draft[index][i]) {
        draft[index][i] = {
          weight: "",
          reps: ""
        };
      }

      if (draft[index][i].weight === "") {
        draft[index][i].weight = String(weight);
      }
    }

    try {
      localStorage.setItem(
        "ironlog_draft_v1",
        JSON.stringify({
          name: current,
          dateKey: new Date().toDateString(),
          savedAt: new Date().toISOString(),
          entries: draft
        })
      );
    } catch (error) {
      console.warn("IronLog v12 draft save failed.", error);
    }

    window.renderExercises();
  }

  // Extend the existing workout renderer without replacing it.
  const previousRenderer = window.renderExercises;

  if (typeof previousRenderer === "function" &&
      !previousRenderer.__ironlogV12) {

    const upgradedRenderer = function() {
      previousRenderer();
      v12Render();
    };

    upgradedRenderer.__ironlogV12 = true;
    window.renderExercises = upgradedRenderer;
  }

  // Handle progression buttons.
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-v12-apply]");
    if (!button) return;

    v12ApplyWeight(
      Number(button.dataset.v12Apply),
      Number(button.dataset.v12Weight)
    );
  });

  console.log("IronLog v12 Intelligent Progression loaded.");
})();

/* =========================================================
   IRONLOG V12.1 — READINESS, CONSISTENCY & ACHIEVEMENTS
   Adds:
   - Daily training readiness check-in
   - Recovery-aware coaching prompts
   - Weekly consistency score
   - Training milestones and achievements

   Preserves:
   ironlog_v1
   ironlog_draft_v1
   ironlog_readiness_v12
   ironlog_achievements_v12
   ========================================================= */

(() => {
  "use strict";

  const READINESS_KEY = "ironlog_readiness_v12";
  const ACHIEVEMENTS_KEY = "ironlog_achievements_v12";
  const STYLE_ID = "il-v12-intelligence-styles";

  function readReadiness() {
    try {
      const data = JSON.parse(
        localStorage.getItem(READINESS_KEY) || "null"
      );

      if (
        data &&
        data.dateKey === new Date().toDateString()
      ) {
        return data;
      }
    } catch (_) {}

    return null;
  }

  function saveReadiness(energy, soreness) {
    const data = {
      dateKey: new Date().toDateString(),
      energy: Number(energy),
      soreness: Number(soreness),
      savedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(
        READINESS_KEY,
        JSON.stringify(data)
      );
    } catch (error) {
      console.warn("IronLog readiness save failed.", error);
    }

    renderV12Panels();
    renderExerciseReadiness();
  }

  function readinessScore(data) {
    if (!data) return null;

    return Math.round(
      ((data.energy + (6 - data.soreness)) / 10) * 100
    );
  }

  function readinessAdvice(data) {
    if (!data) {
      return {
        title: "Check in before training",
        detail: "Record your energy and muscle soreness to receive a recovery-aware coaching prompt.",
        status: "baseline"
      };
    }

    const score = readinessScore(data);

    if (score >= 75) {
      return {
        title: "Readiness looks positive",
        detail: "Your check-in suggests you're feeling reasonably prepared. Follow your planned progression, while keeping technique and effort under control.",
        status: "ready"
      };
    }

    if (score >= 50) {
      return {
        title: "Take a measured approach",
        detail: "Your check-in suggests some recovery demands. Warm up carefully, assess how you feel and be prepared to maintain your working weights.",
        status: "moderate"
      };
    }

    return {
      title: "Prioritise recovery today",
      detail: "Your check-in suggests low readiness. Consider a lighter session or rest. Avoid forcing personal records or pushing through significant discomfort.",
      status: "low"
    };
  }

  function weeklyConsistency() {
    if (!db || !Array.isArray(db.history)) {
      return {
        sessions: 0,
        target: 4,
        percent: 0
      };
    }

    const now = new Date();
    const start = new Date(now);

    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    const sessions = db.history.filter(record => {
      const date = new Date(record.date);

      return !isNaN(date) &&
        date >= start &&
        date <= now &&
        plan[record.name];
    });

    const count = sessions.length;

    return {
      sessions: count,
      target: 4,
      percent: Math.min(
        100,
        Math.round(count / 4 * 100)
      )
    };
  }

  function lifetimeSessions() {
    if (!db || !Array.isArray(db.history)) return 0;

    return db.history.filter(record =>
      plan[record.name]
    ).length;
  }

  function exercisesLogged() {
    if (!db || !Array.isArray(db.history)) return 0;

    const found = new Set();

    db.history.forEach(record => {
      if (!plan[record.name]) return;

      Object.entries(record.entries || {}).forEach(([index, rows]) => {
        if (
          Array.isArray(rows) &&
          rows.some(set =>
            set &&
            set.reps !== "" &&
            Number(set.reps) > 0
          )
        ) {
          found.add(`${record.name}-${index}`);
        }
      });
    });

    return found.size;
  }

  function unlockedAchievements() {
    let saved = {};

    try {
      saved = JSON.parse(
        localStorage.getItem(ACHIEVEMENTS_KEY) || "{}"
      ) || {};
    } catch (_) {}

    const sessions = lifetimeSessions();
    const exercises = exercisesLogged();
    const week = weeklyConsistency();

    const milestones = [
      {
        id: "first",
        title: "First session",
        detail: "Your IronLog journey has begun.",
        earned: sessions >= 1,
        icon: "🏁"
      },
      {
        id: "ten",
        title: "10 sessions",
        detail: "Ten completed workouts recorded.",
        earned: sessions >= 10,
        icon: "🔥"
      },
      {
        id: "twentyfive",
        title: "25 sessions",
        detail: "A solid training habit is forming.",
        earned: sessions >= 25,
        icon: "💪"
      },
      {
        id: "fifty",
        title: "50 sessions",
        detail: "Fifty workouts in the books.",
        earned: sessions >= 50,
        icon: "🏆"
      },
      {
        id: "hundred",
        title: "100 sessions",
        detail: "A major IronLog milestone.",
        earned: sessions >= 100,
        icon: "⭐"
      },
      {
        id: "fourweek",
        title: "Four-session week",
        detail: "All four planned sessions recorded in the last seven days.",
        earned: week.sessions >= 4,
        icon: "🎯"
      },
      {
        id: "fiveexercises",
        title: "Exercise explorer",
        detail: "Five different exercises recorded.",
        earned: exercises >= 5,
        icon: "📈"
      },
      {
        id: "tenexercises",
        title: "Programme builder",
        detail: "Ten different exercises recorded.",
        earned: exercises >= 10,
        icon: "🚀"
      }
    ];

    let changed = false;

    milestones.forEach(item => {
      if (item.earned && !saved[item.id]) {
        saved[item.id] = new Date().toISOString();
        changed = true;
      }
    });

    if (changed) {
      try {
        localStorage.setItem(
          ACHIEVEMENTS_KEY,
          JSON.stringify(saved)
        );
      } catch (error) {
        console.warn("IronLog achievement save failed.", error);
      }
    }

    return milestones.map(item => ({
      ...item,
      unlocked: !!saved[item.id],
      unlockedAt: saved[item.id] || null
    }));
  }

  function addV12Styles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      .il-v12-intelligence {
        margin: 14px 0;
        padding: 15px;
        border-radius: 16px;
        background: linear-gradient(145deg,#202630,#171B21);
        border: 1px solid #424B57;
        color: #F5F6F8;
      }

      .il-v12-intelligence-heading {
        color: #FF9148;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 1.3px;
        margin-bottom: 12px;
      }

      .il-v12-readiness-score {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding: 12px;
        background: #292F37;
        border: 1px solid #424B57;
        border-radius: 12px;
        margin: 10px 0;
      }

      .il-v12-readiness-score strong {
        font-size: 25px;
        color: #FF9148;
      }

      .il-v12-readiness-score small {
        display: block;
        color: #B2B8C2;
        font-size: 10px;
      }

      .il-v12-readiness-title {
        font-size: 14px;
        font-weight: 900;
        margin: 12px 0 5px;
      }

      .il-v12-readiness-detail {
        font-size: 12px;
        color: #C4CBD4;
        line-height: 1.55;
      }

      .il-v12-input-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin: 12px 0;
      }

      .il-v12-input-grid label {
        display: block;
        color: #C4CBD4;
        font-size: 11px;
        font-weight: 800;
        margin-bottom: 6px;
      }

      .il-v12-input-grid select {
        width: 100%;
        padding: 11px;
        border-radius: 9px;
        background: #11151A;
        color: #FFFFFF;
        border: 1px solid #48515D;
      }

      .il-v12-save {
        width: 100%;
        padding: 12px;
        border-radius: 10px;
        background: linear-gradient(90deg,#FF762E,#ED493E);
        color: #FFFFFF;
        border: 0;
        font-weight: 900;
      }

      .il-v12-consistency {
        display: grid;
        grid-template-columns: repeat(3,minmax(0,1fr));
        gap: 8px;
        margin: 12px 0;
      }

      .il-v12-consistency-stat {
        padding: 11px 5px;
        text-align: center;
        border-radius: 10px;
        background: #292F37;
        border: 1px solid #3A414B;
      }

      .il-v12-consistency-stat strong {
        display: block;
        color: #FF9148;
        font-size: 21px;
      }

      .il-v12-consistency-stat small {
        display: block;
        color: #B2B8C2;
        font-size: 10px;
      }

      .il-v12-achievements {
        display: grid;
        grid-template-columns: repeat(2,minmax(0,1fr));
        gap: 8px;
        margin-top: 12px;
      }

      .il-v12-achievement {
        padding: 11px;
        border-radius: 11px;
        background: #292F37;
        border: 1px solid #3A414B;
        min-width: 0;
      }

      .il-v12-achievement.locked {
        opacity: .48;
      }

      .il-v12-achievement-icon {
        font-size: 21px;
        margin-bottom: 6px;
      }

      .il-v12-achievement strong {
        display: block;
        color: #F5F6F8;
        font-size: 12px;
      }

      .il-v12-achievement small {
        display: block;
        color: #B2B8C2;
        font-size: 10px;
        line-height: 1.4;
        margin-top: 4px;
      }

      .il-v12-readiness-warning {
        margin-top: 10px;
        padding: 10px;
        border-radius: 10px;
        background: #30251F;
        border: 1px solid #754323;
        color: #FFB477;
        font-size: 11px;
        line-height: 1.5;
      }

      .il-v12-readiness-warning.low {
        background: #351C22;
        border-color: #A83242;
        color: #FF9AA2;
      }

      @media(max-width:380px) {
        .il-v12-input-grid {
          grid-template-columns: 1fr;
        }

        .il-v12-achievements {
          gap: 6px;
        }

        .il-v12-achievement {
          padding: 9px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function readinessHTML() {
    const data = readReadiness();
    const advice = readinessAdvice(data);
    const score = readinessScore(data);

    const energy = data ? data.energy : 3;
    const soreness = data ? data.soreness : 3;

    return `
      <section class="il-v12-intelligence">
        <div class="il-v12-intelligence-heading">
          DAILY TRAINING READINESS
        </div>

        <div class="il-v12-input-grid">
          <div>
            <label>How is your energy?</label>
            <select data-il-readiness="energy">
              <option value="1" ${energy === 1 ? "selected" : ""}>1 · Very low</option>
              <option value="2" ${energy === 2 ? "selected" : ""}>2 · Low</option>
              <option value="3" ${energy === 3 ? "selected" : ""}>3 · Average</option>
              <option value="4" ${energy === 4 ? "selected" : ""}>4 · Good</option>
              <option value="5" ${energy === 5 ? "selected" : ""}>5 · Excellent</option>
            </select>
          </div>

          <div>
            <label>Muscle soreness</label>
            <select data-il-readiness="soreness">
              <option value="1" ${soreness === 1 ? "selected" : ""}>1 · None</option>
              <option value="2" ${soreness === 2 ? "selected" : ""}>2 · Mild</option>
              <option value="3" ${soreness === 3 ? "selected" : ""}>3 · Moderate</option>
              <option value="4" ${soreness === 4 ? "selected" : ""}>4 · High</option>
              <option value="5" ${soreness === 5 ? "selected" : ""}>5 · Very high</option>
            </select>
          </div>
        </div>

        <button type="button" class="il-v12-save" data-il-readiness-save>
          SAVE TODAY'S CHECK-IN
        </button>

        <div class="il-v12-readiness-score">
          <div>
            <strong>${score === null ? "—" : `${score}%`}</strong>
            <small>Subjective readiness indicator</small>
          </div>
          <span class="pill">
            ${score === null ? "Not checked in" : advice.status.toUpperCase()}
          </span>
        </div>

        <div class="il-v12-readiness-title">
          ${advice.title}
        </div>

        <div class="il-v12-readiness-detail">
          ${advice.detail}
        </div>

        <p class="muted small" style="margin-top:10px">
          This is a personal check-in, not a medical assessment.
          Pain, illness or unusual symptoms should take priority over the score.
        </p>
      </section>
    `;
  }

  function consistencyHTML() {
    const week = weeklyConsistency();

    return `
      <section class="il-v12-intelligence">
        <div class="il-v12-intelligence-heading">
          WEEKLY CONSISTENCY TRACKER
        </div>

        <div class="il-v12-consistency">
          <div class="il-v12-consistency-stat">
            <strong>${week.sessions}</strong>
            <small>Sessions logged</small>
          </div>

          <div class="il-v12-consistency-stat">
            <strong>${week.target}</strong>
            <small>Weekly target</small>
          </div>

          <div class="il-v12-consistency-stat">
            <strong>${week.percent}%</strong>
            <small>Target progress</small>
          </div>
        </div>

        <div class="progressbar">
          <i style="width:${week.percent}%"></i>
        </div>

        <p class="muted small" style="margin-top:10px">
          Based on completed workouts in the last seven days.
          Your target is four sessions, not four consecutive days.
        </p>
      </section>
    `;
  }

  function achievementsHTML() {
    const achievements = unlockedAchievements();
    const earned = achievements.filter(item => item.unlocked).length;

    return `
      <section class="il-v12-intelligence">
        <div class="il-v12-intelligence-heading">
          MILESTONES & ACHIEVEMENTS
        </div>

        <div class="il-v12-readiness-score">
          <div>
            <strong>${earned}/${achievements.length}</strong>
            <small>Achievements unlocked</small>
          </div>
          <span class="pill">IRONLOG AWARDS</span>
        </div>

        <div class="il-v12-achievements">
          ${achievements.map(item => `
            <div class="il-v12-achievement ${item.unlocked ? "" : "locked"}">
              <div class="il-v12-achievement-icon">
                ${item.icon}
              </div>
              <strong>${item.title}</strong>
              <small>${item.detail}</small>
              <small>
                ${item.unlocked ? "✓ Unlocked" : "Not yet unlocked"}
              </small>
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderV12Panels() {
    addV12Styles();

    const home = document.getElementById(
      "ilHomeCommandCentre"
    );

    if (home) {
      let panel = document.getElementById(
        "ilV12HomeIntelligence"
      );

      if (!panel) {
        panel = document.createElement("div");
        panel.id = "ilV12HomeIntelligence";
        home.appendChild(panel);
      }

      panel.innerHTML =
        readinessHTML() +
        consistencyHTML() +
        achievementsHTML();
    }

    const progress = document.getElementById(
      "ilCoachDashboard"
    );

    if (progress) {
      let panel = document.getElementById(
        "ilV12ProgressIntelligence"
      );

      if (!panel) {
        panel = document.createElement("div");
        panel.id = "ilV12ProgressIntelligence";

        const progression = document.getElementById(
          "ilProgressionOverview"
        );

        if (progression) {
          progression.before(panel);
        } else {
          progress.appendChild(panel);
        }
      }

      panel.innerHTML =
        readinessHTML() +
        consistencyHTML() +
        achievementsHTML();
    }
  }

  function renderExerciseReadiness() {
    const data = readReadiness();
    if (!data) return;

    const advice = readinessAdvice(data);

    document.querySelectorAll(
      "#exerciseList > .card"
    ).forEach(card => {
      card.querySelector(
        ".il-v12-readiness-warning"
      )?.remove();

      const warning = document.createElement("div");

      warning.className =
        "il-v12-readiness-warning" +
        (advice.status === "low" ? " low" : "");

      warning.textContent =
        `READINESS CHECK: ${advice.title}. ${advice.detail}`;

      const panel = card.querySelector(".il-v12-card");

      if (panel) {
        panel.appendChild(warning);
      } else {
        card.appendChild(warning);
      }
    });
  }

  // ---------- RENDER HOOKS ----------

  const previousHome = window.renderHome;

  if (
    typeof previousHome === "function" &&
    !previousHome.__ironlogV121
  ) {
    const upgradedHome = function() {
      previousHome();
      renderV12Panels();
    };

    upgradedHome.__ironlogV121 = true;
    window.renderHome = upgradedHome;
  }

  const previousProgress = window.renderProgress;

  if (
    typeof previousProgress === "function" &&
    !previousProgress.__ironlogV121
  ) {
    const upgradedProgress = function() {
      previousProgress();
      renderV12Panels();
    };

    upgradedProgress.__ironlogV121 = true;
    window.renderProgress = upgradedProgress;
  }

  const previousExercises = window.renderExercises;

  if (
    typeof previousExercises === "function" &&
    !previousExercises.__ironlogV121
  ) {
    const upgradedExercises = function() {
      previousExercises();
      renderExerciseReadiness();
    };

    upgradedExercises.__ironlogV121 = true;
    window.renderExercises = upgradedExercises;
  }

  // ---------- CHECK-IN INTERACTION ----------

  if (!window.__ironlogV121Events) {
    window.__ironlogV121Events = true;

    document.addEventListener("click", event => {
      const button = event.target.closest(
        "[data-il-readiness-save]"
      );

      if (!button) return;

      const panel = button.closest(
        ".il-v12-intelligence"
      );

      if (!panel) return;

      const energy = panel.querySelector(
        '[data-il-readiness="energy"]'
      );

      const soreness = panel.querySelector(
        '[data-il-readiness="soreness"]'
      );

      if (!energy || !soreness) return;

      saveReadiness(
        energy.value,
        soreness.value
      );
    });
  }

  // Initial dashboard refresh.
  addV12Styles();

  renderV12Panels();

  console.log(
    "IronLog V12.1 Readiness, Consistency and Achievements loaded."
  );
})();

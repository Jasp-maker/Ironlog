
/* IRONLOG INTELLIGENT TRAINING COACH v7
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

   Preserves:
   ironlog_v1
   ironlog_draft_v1
*/

(() => {
  "use strict";

  const VERSION = "v7";
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
    console.error("IronLog v7 could not find all original app functions.");
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

      /* Distinct bottom navigation tabs */

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

      /* Coaching cards */

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

      /* Existing strength graph deliberately preserved */

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

   
  // ---------- LIVE SESSION COMPARISON v1 ----------

  function comparisonPrevious(name, index) {
    const today = dateKey(new Date());

    const sessions = recordsFor(name, index)
      .filter(record =>
        record.dateKey !== today &&
        Array.isArray(record.entries?.[index]) &&
        record.entries[index].some(validSet)
      );

    return sessions.length
      ? sessions[sessions.length - 1].entries[index]
      : null;
  }

  function compareSet(previous, current) {
    if (!previous || !current || !validSet(current)) {
      return { label: "Enter set to compare", status: "waiting" };
    }

    const oldWeight = weightOf(previous);
    const newWeight = weightOf(current);
    const oldReps = Number(previous.reps);
    const newReps = Number(current.reps);

    if (oldWeight > 0 && newWeight > 0) {
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

    if (oldWeight === 0 && newWeight === 0) {
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
    const cards = document.querySelectorAll("#exerciseList > .card");

    cards.forEach((card, index) => {
      const panel = card.querySelector(".il-comparison");
      if (!panel) return;

      const previous = comparisonPrevious(current, index);
      const sets = draft?.[current]?.[index] || [];

      const rows = panel.querySelectorAll("[data-comparison-set]");

      rows.forEach(row => {
        const setIndex = Number(row.dataset.comparisonSet);
        const result = compareSet(previous?.[setIndex], sets[setIndex]);

        row.textContent = result.label;
        row.className = `il-comparison-result ${result.status}`;
      });
    });
  }

  function renderSessionComparison() {
    const cards = document.querySelectorAll("#exerciseList > .card");

    cards.forEach((card, index) => {
      const oldPanel = card.querySelector(".il-comparison");
      if (oldPanel) oldPanel.remove();

      const previous = comparisonPrevious(current, index);
      if (!previous) return;

      const sets = draft?.[current]?.[index] || [];

      const panel = document.createElement("div");
      panel.className = "il-comparison";
      panel.innerHTML = `
        <div class="il-comparison-heading">
          LAST SESSION COMPARISON
        </div>
        <div class="il-comparison-grid">
          ${previous.map((set, setIndex) => `
            <div class="il-comparison-row">
              <span>Set ${setIndex + 1}</span>
              <span>${Number(set.weight) || 0} kg × ${Number(set.reps) || 0}</span>
              <span class="il-comparison-result waiting"
                data-comparison-set="${setIndex}">
                Enter set to compare
              </span>
            </div>
          `).join("")}
        </div>
      `;

      const notice = card.querySelector(".notice");
      if (notice) notice.after(panel);
      else card.appendChild(panel);
    });

    updateSessionComparison();
  }

  function addComparisonStyles() {
    if (document.getElementById("il-comparison-styles")) return;

    const style = document.createElement("style");
    style.id = "il-comparison-styles";
    style.textContent = `
      .il-comparison {
        margin-top: 12px;
        padding: 12px;
        border-radius: 12px;
        background: #202630;
        border: 1px solid #394452;
      }

      .il-comparison-heading {
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 1px;
        color: #aeb8c5;
        margin-bottom: 9px;
      }

      .il-comparison-row {
        display: grid;
        grid-template-columns: 48px 1fr 1fr;
        align-items: center;
        gap: 6px;
        padding: 7px 0;
        border-top: 1px solid #343e4b;
        font-size: 11px;
      }

      .il-comparison-result {
        text-align: right;
        font-weight: 800;
      }

      .il-comparison-result.up { color: #ff9d35; }
      .il-comparison-result.match { color: #b8c2ce; }
      .il-comparison-result.down { color: #ff6262; }
      .il-comparison-result.different { color: #9da9b8; }
      .il-comparison-result.waiting { color: #7f8b9b; }
    `;

    document.head.appendChild(style);

     
  // Refresh comparison whenever a workout set changes
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
    addStyles();
    addPremiumStyles();

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

      const when = new Date(
        saved.savedAt
      ).toLocaleTimeString([], {
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
    addStyles();
    addPremiumStyles();

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
        IRONLOG INTELLIGENT TRAINING COACH
      </div>

      <h3>Weekly training report</h3>

      <div class="il-score">
        <div>
          <b>${week.score}%</b>
          <small>Consistency and logging score · last 7 days</small>
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
        This score measures consistency and logging, not fitness or effort.
      </p>

      <div class="il-section">
        <h3>Muscle-group activity</h3>
        <p class="muted small">
          Sets and logged weighted volume over the last 7 days.
        </p>
        ${muscleHTML()}
      </div>

      <div class="il-section">
        <h3>Strength trend</h3>
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

      <div class="il-section">
        <div class="row">
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
      </div>

      <p class="muted small" style="margin-top:12px">
        Progress recommendations are based on recorded sessions.
        Always prioritise controlled technique, sensible effort and recovery.
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
    addStyles();
    addPremiumStyles();

    originalRenderProgress();
    renderCoachDashboard();
  };

  // ---------- STARTUP ----------

  addStyles();
  addPremiumStyles();

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

  console.log(
    "IronLog Intelligent Training Coach v7 loaded."
  );
})();


/* =========================================================
   IRONLOG ADAPTIVE TRAINING ENGINE V1
   Hybrid Intelligent Coach

   Features:
   - Exercise-by-exercise performance analysis
   - Progressive overload detection
   - Potential plateau detection
   - Training consistency analysis
   - Muscle-group training volume analysis
   - V12.1 / V13 recovery awareness
   - Evidence-based coaching recommendations

   Safety:
   - Does not alter completed workout records
   - Does not replace the original programme
   - Does not automatically change exercises or splits
   - Uses its own independent storage
   ========================================================= */

(() => {
  "use strict";

  if (window.__ironlogAdaptiveV1Loaded) return;
  window.__ironlogAdaptiveV1Loaded = true;

  const STORAGE_KEY = "ironlog_adaptive_v14";
  const STYLE_ID = "il-adaptive-v1-styles";

  const MUSCLES = {
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

  const muscleNames = Object.keys(MUSCLES);

  function readSettings() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "null"
      );

      return saved && typeof saved === "object"
        ? saved
        : { version: 1, decisions: {} };
    } catch (_) {
      return { version: 1, decisions: {} };
    }
  }

  function saveSettings(data) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...data,
          version: 1,
          updatedAt: new Date().toISOString()
        })
      );
    } catch (error) {
      console.warn("IronLog Adaptive save failed.", error);
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

  function getPlan() {
    try {
      return typeof plan !== "undefined" && plan
        ? plan
        : {};
    } catch (_) {
      return {};
    }
  }

  function validSet(set) {
    return !!set &&
      (set.weight !== "" || set.reps !== "") &&
      (Number(set.weight) > 0 || Number(set.reps) > 0);
  }

  function exerciseName(record, index) {
    const programme = getPlan();
    return programme[record.name]?.items?.[Number(index)]?.[0] || null;
  }

  function exerciseGroup(name) {
    return muscleNames.find(group =>
      MUSCLES[group].includes(name)
    ) || "Other";
  }

  function recordDate(record) {
    const date = new Date(record.date);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function analyseExercise(name) {
    const history = getHistory();
    const exposures = [];

    history.forEach(record => {
      const date = recordDate(record);
      if (!date) return;

      Object.entries(record.entries || {}).forEach(([index, rows]) => {
        if (!Array.isArray(rows)) return;
        if (exerciseName(record, index) !== name) return;

        const sets = rows.filter(validSet).map(set => ({
          weight: Number(set.weight) || 0,
          reps: Number(set.reps) || 0,
          volume: (Number(set.weight) || 0) * (Number(set.reps) || 0)
        }));

        if (!sets.length) return;

        const weightedSets = sets.filter(set => set.weight > 0 && set.reps > 0);
        const totalReps = sets.reduce((sum, set) => sum + set.reps, 0);
        const totalVolume = sets.reduce((sum, set) => sum + set.volume, 0);
        const topWeight = Math.max(0, ...sets.map(set => set.weight));
        const topReps = Math.max(0, ...sets.map(set => set.reps));

        exposures.push({
          date: date.toISOString(),
          timestamp: date.getTime(),
          sets: sets.length,
          totalReps,
          totalVolume,
          topWeight,
          topReps,
          weightedSets: weightedSets.length,
          recordName: record.name,
          recordIndex: Number(index)
        });
      });
    });

    exposures.sort((a, b) => a.timestamp - b.timestamp);

    return exposures;
  }

  function comparePerformance(exposures) {
    if (exposures.length < 2) {
      return {
        status: "baseline",
        label: "Building baseline",
        detail: "Log more sessions before the coach evaluates progression.",
        recommendation: "Focus on consistent technique and recording every working set."
      };
    }

    const latest = exposures[exposures.length - 1];
    const previous = exposures[exposures.length - 2];

    const recent = exposures.slice(-3);
    const earlier = exposures.slice(-6, -3);

    const volumeChange = previous.totalVolume > 0
      ? ((latest.totalVolume - previous.totalVolume) / previous.totalVolume) * 100
      : null;

    const weightChange = previous.topWeight > 0
      ? ((latest.topWeight - previous.topWeight) / previous.topWeight) * 100
      : null;

    const recentAverage = recent.reduce(
      (sum, item) => sum + item.totalVolume, 0
    ) / recent.length;

    const earlierAverage = earlier.length
      ? earlier.reduce((sum, item) => sum + item.totalVolume, 0) / earlier.length
      : null;

    if (exposures.length < 3) {
      return {
        status: "building",
        label: "Progress data building",
        detail: "Two sessions recorded. The coach needs another exposure before making a stronger assessment.",
        recommendation: "Repeat the exercise with controlled technique and aim to match or improve your previous performance.",
        volumeChange,
        weightChange,
        latest,
        previous
      };
    }

    if (earlier.length === 0) {
      return {
        status: "building",
        label: "Progress data building",
        detail: "The coach is collecting enough sessions to compare longer-term performance.",
        recommendation: "Keep logging your working sets consistently.",
        volumeChange,
        weightChange,
        latest,
        previous
      };
    }

    const trendChange = earlierAverage > 0
      ? ((recentAverage - earlierAverage) / earlierAverage) * 100
      : null;

    const allRecentSimilar = recent.length === 3 &&
      recent.every(item => item.totalVolume <= recent[0].totalVolume * 1.03) &&
      recent.every(item => item.totalVolume >= recent[0].totalVolume * 0.97);

    if (trendChange !== null && trendChange > 3) {
      return {
        status: "improving",
        label: "Progressing",
        detail: `Average recorded performance is up ${Math.round(trendChange)}% compared with the earlier sessions.`,
        recommendation: "Keep your current exercise. Continue building reps before increasing the weight.",
        trendChange,
        volumeChange,
        weightChange,
        latest,
        previous
      };
    }

    if (allRecentSimilar && recent.length === 3) {
      return {
        status: "plateau",
        label: "Possible plateau",
        detail: "Three recent exposures show very similar recorded training volume.",
        recommendation: "Check recovery, technique and effort before changing this exercise. The coach will review whether a small adjustment or alternative is justified.",
        trendChange,
        volumeChange,
        weightChange,
        latest,
        previous
      };
    }

    if (trendChange !== null && trendChange < -10) {
      return {
        status: "declining",
        label: "Performance declining",
        detail: `Average recorded performance is down ${Math.abs(Math.round(trendChange))}% compared with earlier sessions.`,
        recommendation: "Check sleep, soreness, stress and recent training volume before treating this as a plateau.",
        trendChange,
        volumeChange,
        weightChange,
        latest,
        previous
      };
    }

    return {
      status: "maintaining",
      label: "Maintaining performance",
      detail: "Performance is broadly stable. There is no strong evidence of a plateau yet.",
      recommendation: "Keep the exercise in place and aim for one additional quality rep where possible.",
      trendChange,
      volumeChange,
      weightChange,
      latest,
      previous
    };
  }

  function getRecoveryContext() {
    let readiness = null;
    let recovery = null;

    try {
      readiness = JSON.parse(
        localStorage.getItem("ironlog_readiness_v12") || "null"
      );
    } catch (_) {}

    try {
      recovery = JSON.parse(
        localStorage.getItem("ironlog_recovery_v13") || "null"
      );
    } catch (_) {}

    const today = new Date().toDateString();

    const readinessToday = readiness?.dateKey === today;
    const recoveryToday = recovery?.dateKey === today;

    let warnings = [];

    if (readinessToday) {
      if (Number(readiness.energy) <= 2) {
        warnings.push("Low reported energy");
      }

      if (Number(readiness.soreness) >= 4) {
        warnings.push("High general soreness");
      }
    }

    if (recoveryToday) {
      if (Number(recovery.sleep) <= 2) {
        warnings.push("Poor sleep");
      }

      if (Number(recovery.stress) >= 4) {
        warnings.push("High stress");
      }

      if (Number(recovery.fatigue) >= 4) {
        warnings.push("High physical fatigue");
      }

      const muscleSoreness = Object.values(
        recovery.muscles || {}
      ).filter(value => Number(value) >= 3).length;

      if (muscleSoreness >= 2) {
        warnings.push("Several muscle groups remain sore");
      }
    }

    return {
      readinessToday,
      recoveryToday,
      warnings,
      caution: warnings.length > 0
    };
  }

  function trainingSummary() {
    const history = getHistory();
    const now = Date.now();

    let last7Days = 0;
    let previous7Days = 0;
    let sessions7Days = 0;

    history.forEach(record => {
      const date = recordDate(record);
      if (!date) return;

      const age = (now - date.getTime()) / 86400000;

      let count = 0;

      Object.values(record.entries || {}).forEach(rows => {
        if (Array.isArray(rows)) {
          count += rows.filter(validSet).length;
        }
      });

      if (age >= 0 && age < 7) {
        last7Days += count;
        sessions7Days++;
      } else if (age >= 7 && age < 14) {
        previous7Days += count;
      }
    });

    let trend = "baseline";

    if (previous7Days > 0) {
      const ratio = last7Days / previous7Days;

      if (ratio > 1.5) trend = "high";
      else if (ratio > 1.2) trend = "rising";
      else trend = "normal";
    }

    return {
      last7Days,
      previous7Days,
      sessions7Days,
      trend
    };
  }

  function muscleSummary() {
    const result = {};

    muscleNames.forEach(group => {
      result[group] = {
        sets7Days: 0,
        sessions7Days: 0
      };
    });

    const now = Date.now();

    getHistory().forEach(record => {
      const date = recordDate(record);
      if (!date || (now - date.getTime()) / 86400000 >= 7) return;

      const counted = new Set();

      Object.entries(record.entries || {}).forEach(([index, rows]) => {
        if (!Array.isArray(rows)) return;

        const name = exerciseName(record, index);
        if (!name) return;

        const group = exerciseGroup(name);
        if (!result[group]) return;

        const count = rows.filter(validSet).length;
        result[group].sets7Days += count;

        if (count) counted.add(group);
      });

      counted.forEach(group => {
        result[group].sessions7Days++;
      });
    });

    return result;
  }

  function collectInsights() {
    const programme = getPlan();
    const exercises = [];

    Object.entries(programme).forEach(([session, data]) => {
      (data.items || []).forEach((item, index) => {
        const name = item[0];
        const exposures = analyseExercise(name);
        const analysis = comparePerformance(exposures);

        exercises.push({
          name,
          session,
          index,
          group: exerciseGroup(name),
          exposureCount: exposures.length,
          analysis
        });
      });
    });

    return exercises;
  }

  function overallRecommendation(insights, recovery, load) {
    if (recovery.caution || load.trend === "high") {
      return {
        status: "caution",
        title: "Recovery takes priority",
        detail: "The coach has detected recovery or workload warning signs. Avoid making major programme changes based on a short-term performance dip."
      };
    }

    const plateauCount = insights.filter(
      item => item.analysis.status === "plateau"
    ).length;

    const decliningCount = insights.filter(
      item => item.analysis.status === "declining"
    ).length;

    if (plateauCount >= 2) {
      return {
        status: "review",
        title: "Programme review recommended",
        detail: `${plateauCount} exercises show possible stagnation. The coach will review exercise selection, weekly volume and progression opportunities.`
      };
    }

    if (decliningCount >= 2) {
      return {
        status: "review",
        title: "Performance review recommended",
        detail: "Several exercises show declining performance. Review recovery and training consistency before increasing workload."
      };
    }

    return {
      status: "positive",
      title: "Keep building",
      detail: "There is no strong reason to restructure your programme right now. Consistent progression remains the priority."
    };
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      .il-adaptive-panel {
        background: #171B23;
        border: 1px solid #343B48;
        border-radius: 16px;
        padding: 15px;
        margin: 14px 0;
        color: #F1F3F6;
      }

      .il-adaptive-heading {
        color: #FF8745;
        font-size: 11px;
        font-weight: 950;
        letter-spacing: 1.1px;
        margin-bottom: 10px;
      }

      .il-adaptive-intro {
        color: #BFC7D2;
        font-size: 12px;
        line-height: 1.55;
      }

      .il-adaptive-summary {
        background: #222833;
        border: 1px solid #343B48;
        border-radius: 12px;
        padding: 13px;
        margin-top: 12px;
      }

      .il-adaptive-summary strong {
        display: block;
        font-size: 14px;
        margin-bottom: 5px;
      }

      .il-adaptive-summary p {
        color: #C1C9D3;
        font-size: 12px;
        line-height: 1.5;
        margin: 0;
      }

      .il-adaptive-stats {
        display: grid;
        grid-template-columns: repeat(3,1fr);
        gap: 8px;
        margin-top: 11px;
      }

      .il-adaptive-stat {
        background: #222833;
        border-radius: 10px;
        padding: 10px;
        min-width: 0;
      }

      .il-adaptive-stat b {
        display: block;
        font-size: 20px;
      }

      .il-adaptive-stat small {
        color: #B8C0CC;
        font-size: 10px;
      }

      .il-adaptive-list {
        display: grid;
        gap: 9px;
        margin-top: 12px;
      }

      .il-adaptive-item {
        background: #222833;
        border: 1px solid #343B48;
        border-radius: 11px;
        padding: 11px;
      }

      .il-adaptive-item h4 {
        margin: 0;
        font-size: 13px;
      }

      .il-adaptive-item small {
        display: block;
        color: #AEB8C6;
        font-size: 10px;
        margin-top: 3px;
      }

      .il-adaptive-item p {
        color: #C4CCD6;
        font-size: 11px;
        line-height: 1.5;
        margin: 8px 0 0;
      }

      .il-adaptive-tag {
        display: inline-block;
        margin-top: 7px;
        padding: 4px 8px;
        border-radius: 20px;
        background: #303946;
        color: #DDE4ED;
        font-size: 10px;
        font-weight: 900;
      }

      .il-adaptive-tag.improving {
        color: #A8E6B2;
        background: #20392D;
      }

      .il-adaptive-tag.plateau,
      .il-adaptive-tag.declining {
        color: #FFB0A3;
        background: #40252B;
      }

      .il-adaptive-tag.caution {
        color: #FFD08A;
        background: #3C3020;
      }

      .il-adaptive-muscles {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 10px;
      }

      .il-adaptive-muscle {
        background: #222833;
        border-radius: 9px;
        padding: 9px;
      }

      .il-adaptive-muscle b {
        font-size: 11px;
      }

      .il-adaptive-muscle small {
        display: block;
        color: #B8C0CC;
        font-size: 10px;
        margin-top: 3px;
      }

      .il-adaptive-foot {
        color: #929EAE;
        font-size: 10px;
        line-height: 1.5;
        margin-top: 12px;
      }

      @media(max-width:380px) {
        .il-adaptive-stats {
          grid-template-columns: 1fr 1fr 1fr;
          gap: 5px;
        }
        .il-adaptive-stat {
          padding: 8px 6px;
        }
        .il-adaptive-stat b {
          font-size: 17px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function renderPanel() {
    const host = document.getElementById("programmeList");
    if (!host) return;

    addStyles();

    let panel = document.getElementById("ilAdaptiveEnginePanel");

    if (!panel) {
      panel = document.createElement("div");
      panel.id = "ilAdaptiveEnginePanel";
      host.before(panel);
    }

    const insights = collectInsights();
    const recovery = getRecoveryContext();
    const load = trainingSummary();
    const muscles = muscleSummary();
    const overall = overallRecommendation(insights, recovery, load);

    const improving = insights.filter(
      item => item.analysis.status === "improving"
    ).length;

    const plateau = insights.filter(
      item => item.analysis.status === "plateau"
    ).length;

    const declining = insights.filter(
      item => item.analysis.status === "declining"
    ).length;

    const statusLabel = {
      improving: "Progressing",
      plateau: "Possible plateau",
      declining: "Declining",
      maintaining: "Maintaining",
      baseline: "Building baseline",
      building: "Building data"
    };

    const exerciseHTML = insights.map(item => {
      const analysis = item.analysis;
      const label = statusLabel[analysis.status] || "Review";
      const tagClass = analysis.status === "improving"
        ? "improving"
        : analysis.status === "plateau" || analysis.status === "declining"
          ? analysis.status
          : "";

      return `
        <div class="il-adaptive-item">
          <h4>${item.name}</h4>
          <small>${item.session} · ${item.group} · ${item.exposureCount} recorded sessions</small>
          <span class="il-adaptive-tag ${tagClass}">${label}</span>
          <p>${analysis.detail}</p>
          <p><b>Coach:</b> ${analysis.recommendation}</p>
        </div>
      `;
    }).join("");

    const muscleHTML = Object.entries(muscles).map(([name, data]) => `
      <div class="il-adaptive-muscle">
        <b>${name}</b>
        <small>${data.sets7Days} recorded sets · ${data.sessions7Days} sessions in 7 days</small>
      </div>
    `).join("");

    const recoveryText = recovery.caution
      ? recovery.warnings.join(" · ")
      : recovery.readinessToday || recovery.recoveryToday
        ? "No major warning flags in today's available check-ins."
        : "No check-in recorded today. Complete your V12.1 and V13 check-ins for recovery-aware decisions.";

    panel.innerHTML = `
      <section class="il-adaptive-panel">
        <div class="il-adaptive-heading">
          IRONLOG · ADAPTIVE TRAINING ENGINE V1
        </div>

        <div class="il-adaptive-intro">
          Your hybrid intelligent coach analyses training history,
          exercise performance, weekly volume and recovery signals
          before recommending programme changes.
        </div>

        <div class="il-adaptive-summary">
          <strong>${overall.title}</strong>
          <p>${overall.detail}</p>
          <span class="il-adaptive-tag ${overall.status === "caution" ? "caution" : ""}">
            ${overall.status === "caution" ? "RECOVERY CAUTION" : overall.status === "review" ? "REVIEW NEEDED" : "STABLE"}
          </span>
        </div>

        <div class="il-adaptive-stats">
          <div class="il-adaptive-stat">
            <b>${improving}</b>
            <small>Progressing</small>
          </div>
          <div class="il-adaptive-stat">
            <b>${plateau}</b>
            <small>Possible plateaus</small>
          </div>
          <div class="il-adaptive-stat">
            <b>${declining}</b>
            <small>Declining</small>
          </div>
        </div>

        <div class="il-adaptive-summary">
          <strong>RECOVERY INTELLIGENCE</strong>
          <p>${recoveryText}</p>
          <p style="margin-top:7px">
            Last 7 days: ${load.last7Days} sets across ${load.sessions7Days} sessions.
            Previous 7 days: ${load.previous7Days} sets.
          </p>
        </div>

        <div class="il-adaptive-heading" style="margin-top:18px">
          EXERCISE PERFORMANCE ANALYSIS
        </div>

        <div class="il-adaptive-list">
          ${exerciseHTML}
        </div>

        <div class="il-adaptive-heading" style="margin-top:18px">
          MUSCLE-GROUP TRAINING VOLUME
        </div>

        <div class="il-adaptive-muscles">
          ${muscleHTML}
        </div>

        <div class="il-adaptive-foot">
          Analysis uses recorded workout entries. Missing or changed
          exercise history may affect comparisons. A plateau is a
          coaching prompt, not a diagnosis. No programme changes have
          been made automatically.
        </div>
      </section>
    `;
  }

  // ---------- CONNECT TO PROGRAMME PAGE ----------

  const previousProgramme = window.renderProgramme;

  if (
    typeof previousProgramme === "function" &&
    !previousProgramme.__ironlogAdaptiveV1
  ) {
    const upgradedProgramme = function() {
      previousProgramme();
      renderPanel();
    };

    upgradedProgramme.__ironlogAdaptiveV1 = true;
    window.renderProgramme = upgradedProgramme;
  }

  // Refresh the analysis whenever the Programme tab is opened.
  document.addEventListener("click", event => {
    const target = event.target instanceof Element
      ? event.target
      : event.target?.parentElement;

    if (target?.closest('[data-page="programmePage"]')) {
      setTimeout(renderPanel, 0);
    }
  });

  // Public refresh hook for later Adaptive Engine modules.
  window.ironlogAdaptiveRefresh = renderPanel;

  console.log(
    "IronLog Adaptive Training Engine V1 loaded."
  );

})();

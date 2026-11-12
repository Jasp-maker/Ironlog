
/* IRONLOG - VISUAL EXERCISE COACH
   Push Day visual movement panels
   Loads after ironlog-library.js
*/

(() => {
  "use strict";

  const visuals = {
    "Barbell bench press": {
      icon: "🏋️",
      start: "Bar lowered towards mid-chest",
      finish: "Press bar upwards",
      cue: "Keep shoulder blades back and feet planted.",
      movement: "↓  ↑"
    },
    "Incline dumbbell press": {
      icon: "💪",
      start: "Dumbbells beside upper chest",
      finish: "Dumbbells pressed overhead",
      cue: "Use a shallow incline and control the lowering phase.",
      movement: "↓  ↑"
    },
    "Seated shoulder press": {
      icon: "🏋️",
      start: "Handles around shoulder height",
      finish: "Arms pressed upwards",
      cue: "Keep your back supported and avoid arching.",
      movement: "↓  ↑"
    },
    "Cable lateral raise": {
      icon: "↗️",
      start: "Arm relaxed beside your body",
      finish: "Arm raised out to the side",
      cue: "Lead with your elbow and stop around shoulder height.",
      movement: "↘  ↗"
    },
    "Rope triceps pushdown": {
      icon: "⬇️",
      start: "Elbows bent beside your torso",
      finish: "Arms extended downwards",
      cue: "Keep elbows tucked in and shoulders still.",
      movement: "↑  ↓"
    },
    "Overhead cable extension": {
      icon: "🙌",
      start: "Rope behind your head",
      finish: "Arms extended overhead",
      cue: "Keep upper arms steady and avoid arching your back.",
      movement: "↓  ↑"
    }
  };

  function addStyles() {
    if (document.getElementById("il-visual-styles")) return;

    const style = document.createElement("style");
    style.id = "il-visual-styles";
    style.textContent = `
      .il-visual-panel {
        margin: 14px 0;
        padding: 14px;
        border: 1px solid #35445e;
        border-radius: 12px;
        background: #17243a;
      }

      .il-visual-title {
        color: #a3e635;
        font-weight: 800;
        margin-bottom: 12px;
      }

      .il-visual-steps {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .il-visual-position {
        min-width: 0;
        padding: 12px 8px;
        border-radius: 10px;
        background: #101a2b;
        text-align: center;
      }

      .il-visual-icon {
        font-size: 38px;
        line-height: 1.5;
      }

      .il-visual-label {
        color: #a3e635;
        font-size: 12px;
        font-weight: 800;
        margin: 5px 0;
      }

      .il-visual-description {
        color: #dbe5f2;
        font-size: 12px;
        line-height: 1.4;
      }

      .il-visual-cue {
        color: #dbe5f2;
        font-size: 13px;
        margin-top: 12px;
        line-height: 1.5;
      }

      .il-visual-arrow {
        color: #a3e635;
        font-size: 22px;
        font-weight: 900;
        margin: 5px 0;
      }
    `;
    document.head.appendChild(style);
  }

  const originalRenderExercises = renderExercises;

  renderExercises = function () {
    originalRenderExercises();

    if (current !== "Push") return;

    addStyles();

    document.querySelectorAll("#exerciseList > .card").forEach(card => {
      const heading = card.querySelector("h3");
      const guide = card.querySelector(".il-guide");

      if (!heading || !guide) return;
      if (card.querySelector(".il-visual-panel")) return;

      const name = heading.textContent.replace(/^\d+\.\s*/, "").trim();
      const data = visuals[name];

      if (!data) return;

      const panel = document.createElement("div");
      panel.className = "il-visual-panel";

      panel.innerHTML = `
        <div class="il-visual-title">
          Movement guide
        </div>

        <div class="il-visual-steps">
          <div class="il-visual-position">
            <div class="il-visual-icon">${data.icon}</div>
            <div class="il-visual-label">START</div>
            <div class="il-visual-description">${data.start}</div>
          </div>

          <div class="il-visual-position">
            <div class="il-visual-icon">${data.icon}</div>
            <div class="il-visual-label">FINISH</div>
            <div class="il-visual-description">${data.finish}</div>
          </div>
        </div>

        <div class="il-visual-arrow">
          ${data.movement}
        </div>

        <div class="il-visual-cue">
          <strong>Coaching cue:</strong> ${data.cue}
        </div>
      `;

      const content = guide.querySelector(".il-guide-content");
      if (content) {
        content.prepend(panel);
      }
    });
  };

  console.log("IronLog Visual Coach loaded.");
})();


/* IRONLOG - Exercise Library
   Stage 2: Push Day guides
   Works alongside ironlog-upgrade.js
*/

(() => {
  "use strict";

  const guides = {
    "Barbell bench press": {
      equipment: "Barbell and bench",
      primary: "Chest (pectorals)",
      secondary: "Triceps and front deltoids",
      setup: "Lie flat with your eyes beneath the bar. Plant your feet firmly, keep your shoulder blades gently pulled back and grip the bar slightly wider than shoulder width.",
      steps: [
        "Unrack the bar with your arms straight.",
        "Lower the bar under control towards your mid-chest.",
        "Keep your wrists stacked over your forearms.",
        "Press upwards until your arms are extended without aggressively locking your elbows."
      ],
      mistakes: [
        "Bouncing the bar off your chest.",
        "Allowing your shoulders to roll forwards.",
        "Lifting your feet or losing your stable position.",
        "Using a grip that causes wrist discomfort."
      ],
      alternatives: ["Chest press machine", "Dumbbell bench press"],
      video: "barbell bench press proper technique demonstration"
    },

    "Incline dumbbell press": {
      equipment: "Adjustable bench and dumbbells",
      primary: "Upper chest (clavicular pectorals)",
      secondary: "Triceps and front deltoids",
      setup: "Set the bench at approximately 20–30 degrees. Sit with dumbbells resting on your thighs before bringing them into position.",
      steps: [
        "Keep your feet planted and shoulder blades supported.",
        "Start with dumbbells above your upper chest.",
        "Lower slowly towards the sides of your upper chest.",
        "Press upwards smoothly without banging the dumbbells together."
      ],
      mistakes: [
        "Setting the bench too steeply.",
        "Lowering the dumbbells too quickly.",
        "Arching excessively through the lower back.",
        "Allowing the dumbbells to drift too far apart."
      ],
      alternatives: ["Incline chest press machine", "Smith machine incline press"],
      video: "incline dumbbell press correct technique demonstration"
    },

    "Seated shoulder press": {
      equipment: "Shoulder press machine or dumbbells",
      primary: "Shoulders (deltoids)",
      secondary: "Triceps and upper chest",
      setup: "Adjust the seat so the handles begin around shoulder height. Keep your back supported and feet flat.",
      steps: [
        "Grip the handles comfortably.",
        "Brace your abdomen and keep your torso stable.",
        "Press upwards in a controlled movement.",
        "Lower slowly until your hands return to approximately shoulder height."
      ],
      mistakes: [
        "Arching your lower back excessively.",
        "Using momentum to move the weight.",
        "Dropping the weight too quickly.",
        "Forcing an uncomfortable shoulder position."
      ],
      alternatives: ["Dumbbell shoulder press", "Landmine shoulder press"],
      video: "seated shoulder press machine correct form demonstration"
    },

    "Cable lateral raise": {
      equipment: "Cable machine and single handle",
      primary: "Side deltoids",
      secondary: "Upper trapezius and supraspinatus",
      setup: "Set the pulley low. Stand side-on to the machine and hold the handle with the arm furthest from the machine.",
      steps: [
        "Stand tall with a slight bend in your elbow.",
        "Keep your torso still.",
        "Raise your arm out to the side to around shoulder height.",
        "Lower slowly and maintain tension throughout."
      ],
      mistakes: [
        "Swinging your body to lift the weight.",
        "Shrugging your shoulder excessively.",
        "Using too much weight.",
        "Raising the arm far above shoulder height if uncomfortable."
      ],
      alternatives: ["Dumbbell lateral raise", "Lateral raise machine"],
      video: "single arm cable lateral raise proper technique"
    },

    "Rope triceps pushdown": {
      equipment: "Cable machine and rope attachment",
      primary: "Triceps",
      secondary: "Anconeus and forearm stabilisers",
      setup: "Attach a rope to a high pulley. Stand upright with elbows tucked close to your sides.",
      steps: [
        "Start with elbows bent and hands around upper-abdomen height.",
        "Push the rope down by extending your elbows.",
        "Separate the rope ends slightly at the bottom.",
        "Return slowly without allowing your elbows to move forwards."
      ],
      mistakes: [
        "Using your body weight to force the rope down.",
        "Allowing elbows to flare out.",
        "Moving your shoulders instead of your elbows.",
        "Using momentum on the return."
      ],
      alternatives: ["Straight-bar pushdown", "Triceps machine"],
      video: "rope triceps pushdown correct form demonstration"
    },

    "Overhead cable extension": {
      equipment: "Cable machine and rope attachment",
      primary: "Triceps, particularly the long head",
      secondary: "Shoulder stabilisers",
      setup: "Attach a rope to a low pulley. Face away from the machine, bring the rope behind your head and take a comfortable staggered stance.",
      steps: [
        "Keep your upper arms close to your head.",
        "Bend your elbows to lower the rope behind your head.",
        "Extend your elbows until your arms are straight.",
        "Return slowly, maintaining control and a comfortable shoulder position."
      ],
      mistakes: [
        "Flaring your elbows excessively.",
        "Arching your lower back.",
        "Using momentum to extend your arms.",
        "Forcing an uncomfortable deep stretch."
      ],
      alternatives: ["Dumbbell overhead triceps extension", "Cable cross-body triceps extension"],
      video: "overhead cable rope triceps extension proper form"
    }
  };

  function addLibraryStyles() {
    if (document.getElementById("ironlog-library-styles")) return;

    const style = document.createElement("style");
    style.id = "ironlog-library-styles";
    style.textContent = `
      .il-guide {
        margin-top: 12px;
        border: 1px solid #35445e;
        border-radius: 12px;
        overflow: hidden;
        background: #111b2d;
      }
      .il-guide summary {
        cursor: pointer;
        padding: 12px;
        color: #a3e635;
        font-weight: 800;
        font-size: 13px;
        list-style-position: inside;
      }
      .il-guide-content {
        padding: 0 13px 14px;
        font-size: 13px;
        line-height: 1.55;
      }
      .il-guide-content h4 {
        color: #a3e635;
        margin: 13px 0 5px;
        font-size: 13px;
      }
      .il-guide-content p {
        margin: 4px 0;
        color: #dbe5f2;
      }
      .il-guide-content ul,
      .il-guide-content ol {
        padding-left: 20px;
        margin: 5px 0;
        color: #dbe5f2;
      }
      .il-guide-content li { margin: 4px 0; }
      .il-guide-video {
        display: inline-block;
        margin-top: 12px;
        padding: 10px 13px;
        border-radius: 9px;
        background: #a3e635;
        color: #17210a;
        font-weight: 800;
        text-decoration: none;
      }
      .il-guide-video:focus {
        outline: 2px solid white;
      }
    `;
    document.head.appendChild(style);
  }

  function makeList(items, ordered = false) {
    const tag = ordered ? "ol" : "ul";
    return `<${tag}>${items.map(item => `<li>${item}</li>`).join("")}</${tag}>`;
  }

  const originalRenderExercises = renderExercises;

  renderExercises = function () {
    originalRenderExercises();

    if (current !== "Push") return;

    addLibraryStyles();

    const cards = document.querySelectorAll("#exerciseList > .card");

    cards.forEach(card => {
      const heading = card.querySelector("h3");
      if (!heading) return;

      const name = heading.textContent.replace(/^\d+\.\s*/, "").trim();
      const guide = guides[name];
      if (!guide || card.querySelector(".il-guide")) return;

      const details = document.createElement("details");
      details.className = "il-guide";

      const search = encodeURIComponent(guide.video);
      const videoUrl = `https://www.youtube.com/results?search_query=${search}`;

      details.innerHTML = `
        <summary>📖 Show exercise guide</summary>
        <div class="il-guide-content">
          <p><strong>Equipment:</strong> ${guide.equipment}</p>

          <h4>Primary muscles</h4>
          <p>${guide.primary}</p>

          <h4>Secondary muscles</h4>
          <p>${guide.secondary}</p>

          <h4>Setup</h4>
          <p>${guide.setup}</p>

          <h4>Step-by-step technique</h4>
          ${makeList(guide.steps, true)}

          <h4>Common mistakes</h4>
          ${makeList(guide.mistakes)}

          <h4>Alternative exercises</h4>
          ${makeList(guide.alternatives)}

          <a class="il-guide-video"
             href="${videoUrl}"
             target="_blank"
             rel="noopener noreferrer">
             ▶ Find video demonstration
          </a>
        </div>
      `;

      card.appendChild(details);
    });
  };

  console.log("IronLog Exercise Library: Push Day guides loaded.");
})();

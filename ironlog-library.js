
/* IRONLOG - Exercise Library
   Stage 4: Push + Pull + Legs Day guides
   Works alongside ironlog-upgrade.js
*/

(() => {
  "use strict";

  const guides = {
    // =========================
    // PUSH DAY
    // =========================

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
    },

    // =========================
    // PULL DAY
    // =========================

    "Lat pulldown": {
      equipment: "Lat pulldown machine and wide bar",
      primary: "Latissimus dorsi (lats)",
      secondary: "Biceps, rear deltoids and upper back",
      setup: "Adjust the thigh pad so your legs are secured. Sit upright, grip the bar slightly wider than shoulder width and allow your arms to extend overhead.",
      steps: [
        "Brace your core and keep your chest lifted.",
        "Pull your shoulders down away from your ears.",
        "Bring the bar towards your upper chest.",
        "Drive your elbows down towards your sides.",
        "Return the bar slowly until your arms are extended again."
      ],
      mistakes: [
        "Pulling the bar behind your neck.",
        "Leaning backwards excessively.",
        "Using momentum to pull the weight down.",
        "Allowing the weight stack to crash on the return."
      ],
      alternatives: ["Assisted pull-up", "Close-grip lat pulldown"],
      video: "lat pulldown correct form technique demonstration"
    },

    "Chest-supported row": {
      equipment: "Chest-supported row machine or incline bench and dumbbells",
      primary: "Mid-back and rhomboids",
      secondary: "Lats, rear deltoids and biceps",
      setup: "Adjust the chest pad so you can reach the handles comfortably. Keep your chest against the pad and feet firmly positioned.",
      steps: [
        "Start with your arms extended and shoulders relaxed.",
        "Pull the handles towards your lower chest.",
        "Drive your elbows backwards without shrugging.",
        "Squeeze your shoulder blades together briefly.",
        "Lower the handles slowly to the starting position."
      ],
      mistakes: [
        "Lifting your chest away from the pad.",
        "Shrugging your shoulders towards your ears.",
        "Using momentum to move the handles.",
        "Cutting the movement short by using too much weight."
      ],
      alternatives: ["Dumbbell chest-supported row", "Seated cable row"],
      video: "chest supported row machine proper form demonstration"
    },

    "Seated cable row": {
      equipment: "Seated cable row machine and handle",
      primary: "Mid-back and rhomboids",
      secondary: "Lats, rear deltoids and biceps",
      setup: "Sit with your feet on the supports and knees slightly bent. Grip the handle and sit tall with your chest lifted.",
      steps: [
        "Begin with your arms extended and shoulders relaxed.",
        "Brace your abdomen and pull the handle towards your lower abdomen.",
        "Drive your elbows backwards close to your body.",
        "Squeeze your shoulder blades together.",
        "Extend your arms slowly without rounding your back."
      ],
      mistakes: [
        "Rocking your torso backwards and forwards.",
        "Rounding your lower back.",
        "Pulling the handle towards your neck.",
        "Using momentum instead of controlled movement."
      ],
      alternatives: ["Chest-supported row", "Single-arm dumbbell row"],
      video: "seated cable row correct technique demonstration"
    },

    "Reverse pec deck": {
      equipment: "Reverse pec deck machine",
      primary: "Rear deltoids",
      secondary: "Rhomboids and middle trapezius",
      setup: "Face the machine with your chest against the pad. Adjust the seat so the handles are roughly level with your shoulders.",
      steps: [
        "Grip the handles with a comfortable hand position.",
        "Keep a slight bend in your elbows.",
        "Move your arms outwards and backwards.",
        "Focus on using your rear shoulders rather than shrugging.",
        "Return slowly to the starting position."
      ],
      mistakes: [
        "Using excessive weight.",
        "Shrugging your shoulders throughout the movement.",
        "Bending and straightening your elbows excessively.",
        "Allowing the weight to pull your arms forwards too quickly."
      ],
      alternatives: ["Cable rear delt fly", "Bent-over dumbbell reverse fly"],
      video: "reverse pec deck rear delt fly correct form"
    },

    "EZ-bar curl": {
      equipment: "EZ curl bar and weight plates",
      primary: "Biceps brachii",
      secondary: "Brachialis and forearm muscles",
      setup: "Stand tall holding the EZ bar with a comfortable angled grip. Keep your elbows close to your sides and your feet shoulder-width apart.",
      steps: [
        "Start with your arms extended and wrists comfortable.",
        "Keep your elbows close to your torso.",
        "Curl the bar upwards towards your shoulders.",
        "Squeeze your biceps briefly at the top.",
        "Lower the bar slowly without swinging your body."
      ],
      mistakes: [
        "Swinging your torso to lift the bar.",
        "Allowing your elbows to travel forwards excessively.",
        "Using your lower back to generate momentum.",
        "Dropping the bar too quickly."
      ],
      alternatives: ["Dumbbell biceps curl", "Cable biceps curl"],
      video: "EZ bar biceps curl correct technique demonstration"
    },

    "Hammer curl": {
      equipment: "Pair of dumbbells",
      primary: "Brachialis and brachioradialis",
      secondary: "Biceps brachii and forearms",
      setup: "Stand tall holding dumbbells by your sides with palms facing towards your body. Keep your elbows close to your torso.",
      steps: [
        "Brace your core and keep your shoulders relaxed.",
        "Curl one or both dumbbells upwards.",
        "Keep your palms facing inwards throughout.",
        "Pause briefly near the top.",
        "Lower slowly to the starting position."
      ],
      mistakes: [
        "Swinging the dumbbells using momentum.",
        "Allowing your elbows to move forwards excessively.",
        "Rotating your wrists during the movement.",
        "Using too much weight and shortening the range of motion."
      ],
      alternatives: ["Rope hammer curl", "Cross-body dumbbell hammer curl"],
      video: "dumbbell hammer curl proper form demonstration"
    },

    // =========================
    // LEG DAY
    // =========================

    "Squat": {
      equipment: "Squat rack and barbell",
      primary: "Quadriceps",
      secondary: "Glutes, hamstrings, adductors and core",
      setup: "Position the bar securely across your upper back. Stand with feet approximately shoulder-width apart and toes turned slightly out. Brace your abdomen before beginning.",
      steps: [
        "Take a controlled breath and brace your core.",
        "Unlock your hips and knees together.",
        "Lower yourself between your legs while keeping your feet planted.",
        "Descend as far as you can comfortably maintain control and a stable spine.",
        "Drive through your feet and stand upright.",
        "Reset your brace before the next repetition."
      ],
      mistakes: [
        "Allowing your heels to lift off the floor.",
        "Letting your knees collapse inwards.",
        "Rounding your lower back at the bottom.",
        "Dropping too quickly without control.",
        "Using more weight than you can safely manage."
      ],
      alternatives: ["Leg press", "Goblet squat", "Hack squat machine"],
      video: "barbell back squat proper form technique demonstration"
    },

    "Romanian deadlift": {
      equipment: "Barbell or dumbbells",
      primary: "Hamstrings",
      secondary: "Glutes, spinal erectors and upper back",
      setup: "Stand with feet hip-width apart holding the bar in front of your thighs. Keep a slight bend in your knees and brace your core.",
      steps: [
        "Push your hips backwards while keeping the bar close to your legs.",
        "Allow your torso to lean forwards as your hips travel back.",
        "Keep your back neutral and knees softly bent.",
        "Lower until you feel a strong hamstring stretch without losing your position.",
        "Drive your hips forwards to return to standing.",
        "Finish tall without leaning backwards."
      ],
      mistakes: [
        "Bending the knees too much and turning it into a squat.",
        "Rounding your lower back.",
        "Allowing the bar to drift away from your legs.",
        "Lowering further than your mobility allows.",
        "Hyperextending your back at the top."
      ],
      alternatives: ["Dumbbell Romanian deadlift", "Cable pull-through", "45-degree hip extension"],
      video: "Romanian deadlift proper form technique demonstration"
    },

    "Leg press": {
      equipment: "Leg press machine",
      primary: "Quadriceps",
      secondary: "Glutes, hamstrings and adductors",
      setup: "Sit securely against the backrest. Place your feet approximately shoulder-width apart on the platform. Adjust the seat so your knees can bend comfortably.",
      steps: [
        "Release the safety handles carefully.",
        "Lower the platform slowly by bending your knees.",
        "Keep your entire foot in contact with the platform.",
        "Stop before your lower back or hips begin to curl away from the seat.",
        "Push through your feet to extend your legs.",
        "Avoid aggressively locking your knees."
      ],
      mistakes: [
        "Lowering the platform so far that your lower back rounds.",
        "Allowing your knees to collapse inwards.",
        "Bouncing out of the bottom position.",
        "Lifting your heels from the platform.",
        "Slamming your knees into lockout."
      ],
      alternatives: ["Goblet squat", "Hack squat machine", "Smith machine squat"],
      video: "leg press machine correct form demonstration"
    },

    "Seated leg curl": {
      equipment: "Seated leg curl machine",
      primary: "Hamstrings",
      secondary: "Calves (gastrocnemius)",
      setup: "Adjust the seat and backrest so your knees line up with the machine pivot. Position the lower pad just above your heels and secure the thigh pad comfortably.",
      steps: [
        "Sit back against the support and grip the handles.",
        "Start with your legs extended comfortably.",
        "Curl your heels down and backwards beneath the seat.",
        "Squeeze your hamstrings briefly at the bottom.",
        "Return slowly until your legs are extended again.",
        "Keep the weight under control throughout."
      ],
      mistakes: [
        "Using momentum to pull the weight down.",
        "Lifting your hips off the seat.",
        "Setting the machine pivot incorrectly.",
        "Allowing the weight stack to crash.",
        "Using a range of motion that causes knee discomfort."
      ],
      alternatives: ["Lying leg curl", "Single-leg seated curl", "Resistance band leg curl"],
      video: "seated leg curl machine proper technique demonstration"
    },

    "Leg extension": {
      equipment: "Leg extension machine",
      primary: "Quadriceps",
      secondary: "Hip flexors and supporting knee stabilisers",
      setup: "Adjust the seat so your knees line up with the machine pivot. Position the roller just above your ankles and hold the handles.",
      steps: [
        "Sit with your back supported and feet relaxed.",
        "Extend your knees to raise the padded bar.",
        "Lift smoothly until your legs are comfortably extended.",
        "Squeeze your quadriceps briefly at the top.",
        "Lower the weight slowly to the starting position.",
        "Maintain control rather than letting the stack drop."
      ],
      mistakes: [
        "Using excessive weight.",
        "Swinging your legs to move the pad.",
        "Lifting your hips away from the seat.",
        "Dropping the weight too quickly.",
        "Forcing a painful range of motion."
      ],
      alternatives: ["Spanish squat", "Goblet squat", "Reverse Nordic curl"],
      video: "leg extension machine correct form demonstration"
    },

    "Standing calf raise": {
      equipment: "Standing calf raise machine or dumbbells",
      primary: "Gastrocnemius (calf muscle)",
      secondary: "Soleus and foot stabilisers",
      setup: "Position the balls of your feet on the platform with your heels free to move. Rest the shoulder pads comfortably and stand tall.",
      steps: [
        "Start with your heels lowered into a comfortable stretch.",
        "Keep your knees mostly straight but not forcefully locked.",
        "Push through the balls of your feet to raise your heels.",
        "Pause briefly and squeeze your calves at the top.",
        "Lower slowly back into the stretched position.",
        "Use a controlled full range of motion."
      ],
      mistakes: [
        "Bouncing at the bottom of each repetition.",
        "Using momentum instead of calf strength.",
        "Performing only very short repetitions.",
        "Bending your knees excessively.",
        "Using so much weight that you cannot control the movement."
      ],
      alternatives: ["Seated calf raise", "Single-leg dumbbell calf raise", "Leg press calf raise"],
      video: "standing calf raise proper form technique demonstration"
    }
  };

  // =========================
  // LIBRARY STYLING
  // =========================

  function addLibraryStyles() {
    if (document.getElementById("ironlog-library-styles")) return;

    const style = document.createElement("style");
    style.id = "ironlog-library-styles";

    style.textContent = `
      .il-guide {
        margin-top: 12px;
        border: 1px solid #414750;
        border-radius: 13px;
        overflow: hidden;
        background: #20242B;
      }

      .il-guide summary {
        cursor: pointer;
        padding: 13px 14px;
        color: #FF873F;
        font-weight: 800;
        font-size: 14px;
        list-style-position: inside;
      }

      .il-guide summary:hover {
        background: #292E36;
      }

      .il-guide[open] summary {
        border-bottom: 1px solid #414750;
        background: #292E36;
      }

      .il-guide-content {
        padding: 3px 14px 15px;
        font-size: 14px;
        line-height: 1.6;
      }

      .il-guide-content h4 {
        color: #FF873F;
        margin: 15px 0 5px;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: .3px;
      }

      .il-guide-content p {
        margin: 5px 0;
        color: #F0F2F5;
      }

      .il-guide-content p strong {
        color: #FFB078;
      }

      .il-guide-content ul,
      .il-guide-content ol {
        padding-left: 21px;
        margin: 6px 0;
        color: #E0E4EA;
      }

      .il-guide-content li {
        margin: 6px 0;
        padding-left: 2px;
      }

      .il-guide-video {
        display: inline-block;
        margin-top: 14px;
        padding: 11px 15px;
        border: 1px solid #FF873F;
        border-radius: 10px;
        background: #F36B27;
        color: #17191D !important;
        font-weight: 900;
        text-decoration: none;
        transition: background .15s ease;
      }

      .il-guide-video:hover {
        background: #FF873F;
      }

      .il-guide-video:focus {
        outline: 2px solid white;
        outline-offset: 3px;
      }
    `;

    document.head.appendChild(style);
  }

  // =========================
  // GUIDE HTML HELPERS
  // =========================

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function makeList(items, ordered = false) {
    const tag = ordered ? "ol" : "ul";

    return `<${tag}>${items
      .map(item => `<li>${escapeHTML(item)}</li>`)
      .join("")}</${tag}>`;
  }

  function makeGuide(guide) {
    const search = encodeURIComponent(guide.video);
    const videoUrl = `https://www.youtube.com/results?search_query=${search}`;

    return `
      <details class="il-guide">
        <summary>📖 Show exercise guide</summary>

        <div class="il-guide-content">

          <p>
            <strong>Equipment:</strong>
            ${escapeHTML(guide.equipment)}
          </p>

          <h4>Primary muscles</h4>
          <p>${escapeHTML(guide.primary)}</p>

          <h4>Secondary muscles</h4>
          <p>${escapeHTML(guide.secondary)}</p>

          <h4>Setup</h4>
          <p>${escapeHTML(guide.setup)}</p>

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
      </details>
    `;
  }

  // =========================
  // ATTACH GUIDES TO WORKOUTS
  // =========================

  const originalRenderExercises = renderExercises;

  renderExercises = function () {
    originalRenderExercises();

    addLibraryStyles();

    const cards = document.querySelectorAll("#exerciseList > .card");

    cards.forEach(card => {
      const heading = card.querySelector("h3");
      if (!heading) return;

      const name = heading.textContent
        .replace(/^\d+\.\s*/, "")
        .trim();

      const guide = guides[name];

      if (!guide || card.querySelector(".il-guide")) return;

      card.insertAdjacentHTML("beforeend", makeGuide(guide));
    });
  };

  console.log("IronLog Exercise Library: Push + Pull + Legs Day guides loaded.");

})();

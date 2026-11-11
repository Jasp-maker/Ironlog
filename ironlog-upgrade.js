/* IronLog Smart Progression + Workout Recovery add-on
   Compatible with the existing ironlog_v1 history format. */
(() => {
  'use strict';

  const DRAFT_KEY = 'ironlog_draft_v1';
  const originalOpenWorkout = openWorkout;
  const originalRenderExercises = renderExercises;
  const originalFinish = finish;
  const originalRenderHome = renderHome;

  function todayKey() {
    return new Date().toDateString();
  }

  function readDraft() {
    try {
      const value = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      return value && value.dateKey === todayKey() && plan[value.name] ? value : null;
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
      console.warn('IronLog could not save the unfinished workout.', error);
    }
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
  }

  function parseRange(target) {
    const match = String(target).match(/(\d+)\s*[–-]\s*(\d+)/);
    return match ? { min: Number(match[1]), max: Number(match[2]) } : null;
  }

  function lastExerciseRecord(name, index) {
    for (let i = db.history.length - 1; i >= 0; i--) {
      const record = db.history[i];
      if (record.name !== name) continue;
      const entries = record.entries && record.entries[index];
      if (Array.isArray(entries) && entries.some(set => set && (set.weight !== '' || set.reps !== ''))) {
        return entries;
      }
    }
    return null;
  }

  function progression(name, index) {
    const rx = prescription(name, index);
    const target = String(rx.target);
    const range = parseRange(target);
    const previous = lastExerciseRecord(name, index);
    const isTimed = /sec/i.test(target);
    const unit = isTimed ? 'seconds' : (/each side/i.test(target) ? 'reps per side' : 'reps');

    if (rx.deload) {
      return {
        title: 'Deload week',
        detail: 'Keep the load comfortable and focus on controlled technique. No weight increase this week.'
      };
    }
    if (!previous || !range) {
      const aim = /each side/i.test(target)
        ? `Aim for ${target} on each set.`
        : (isTimed ? `Aim for ${target} of controlled hold time.` : `Aim for ${target} reps per set.`);
      return {
        title: 'Build your baseline',
        detail: `${aim} Record your working load where applicable.`
      };
    }

    const completed = previous.filter(set => set && set.reps !== '' && Number.isFinite(Number(set.reps)));
    if (!completed.length) {
      const aim = /each side/i.test(target) ? `${target} on each set` : `${target} ${unit}`;
      return { title: 'Build your baseline', detail: `Aim for ${aim}; record each set so IronLog can guide your next session.` };
    }

    const allSetsRecorded = completed.length >= rx.sets;
    const allTop = allSetsRecorded && completed.slice(0, rx.sets).every(set => Number(set.reps) >= range.max);
    const anyBelow = completed.some(set => Number(set.reps) < range.min);
    const weights = previous
      .filter(set => set && set.weight !== '' && Number(set.weight) > 0)
      .map(set => Number(set.weight));
    const load = weights.length ? Math.max(...weights) : null;

    if (allTop && load !== null && !isTimed) {
      const step = load < 20 ? 1 : 2.5;
      const suggested = Math.ceil((load + step) * 2) / 2;
      return {
        title: 'Ready to increase',
        detail: `You reached ${range.max} ${unit} on all ${rx.sets} sets last time. Try approximately ${suggested} kg next time, if the equipment allows and your technique stays solid.`
      };
    }
    if (anyBelow) {
      return {
        title: 'Consolidate this performance',
        detail: `Keep the same load for now and work towards at least ${range.min} ${unit} on every set. Reduce the load slightly if you cannot maintain safe form.`
      };
    }
    if (!allSetsRecorded) {
      return {
        title: 'Complete every working set',
        detail: `You recorded ${completed.length} of ${rx.sets} sets last time. Aim to complete all prescribed sets within ${target} ${unit}.`
      };
    }
    return {
      title: 'Add reps or time before load',
      detail: `Keep the same load and aim to add a rep or a little hold time, working towards ${range.max} ${unit}.`
    };
  }

  renderExercises = function () {
    originalRenderExercises();
    const cards = document.querySelectorAll('#exerciseList > .card');
    cards.forEach((card, index) => {
      const tip = progression(current, index);
      const note = document.createElement('div');
      note.className = 'notice small smart-tip';
      note.style.marginTop = '9px';
      note.innerHTML = `<strong>${esc(tip.title)}:</strong> ${esc(tip.detail)}`;
      const existingNotice = card.querySelector('.notice');
      if (existingNotice) existingNotice.insertAdjacentElement('afterend', note);
      else card.insertBefore(note, card.children[1] || null);
    });

    document.querySelectorAll('#exerciseList input').forEach(input => {
      input.addEventListener('input', saveDraft);
      input.addEventListener('change', saveDraft);
    });
  };

  openWorkout = function (name) {
    const saved = readDraft();
    if (saved && saved.name !== name) {
      const resumeFirst = confirm(`You have an unfinished ${saved.name} workout. Press OK to resume it, or Cancel to start ${name} and replace that unfinished draft.`);
      if (resumeFirst) name = saved.name;
      else clearDraft();
    }

    originalOpenWorkout(name);
    const recoverable = saved && saved.name === name ? saved : null;
    if (recoverable) {
      draft = recoverable.entries && typeof recoverable.entries === 'object' ? recoverable.entries : {};
      plan[name].items.forEach((item, index) => {
        const wanted = prescription(name, index).sets;
        if (!Array.isArray(draft[index])) draft[index] = [];
        while (draft[index].length < wanted) draft[index].push({ weight: '', reps: '' });
      });
      renderExercises();
      const stamp = new Date(recoverable.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const meta = document.getElementById('workoutMeta');
      if (meta) meta.textContent = `${plan[name].focus} · unfinished workout restored (saved ${stamp})`;
    }
    saveDraft();
  };

  finish = function () {
    const hasEntries = Object.values(draft || {}).some(rows =>
      Array.isArray(rows) && rows.some(set => set && (set.weight !== '' || set.reps !== ''))
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
    const hero = document.querySelector('#todayPage .hero');
    if (!hero) return;
    let resume = document.getElementById('resumeWorkout');
    if (saved) {
      if (!resume) {
        resume = document.createElement('button');
        resume.id = 'resumeWorkout';
        resume.className = 'secondary';
        resume.style.marginTop = '10px';
        hero.appendChild(resume);
      }
      const when = new Date(saved.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      resume.textContent = `Resume ${saved.name} workout · saved ${when}`;
      resume.onclick = () => openWorkout(saved.name);
    } else if (resume) {
      resume.remove();
    }
  };

  document.getElementById('finishWorkout').onclick = finish;
  window.addEventListener('pagehide', saveDraft);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveDraft();
  });

  renderHome();
})();

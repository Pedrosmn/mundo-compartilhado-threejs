import { MEMBERS } from './config.js';

const STATUS_TEXT = {
  loading: 'Carregando',
  ready: 'Pronto',
  error: 'Falhou',
  empty: 'Sem clipes',
};

/**
 * Creates the whole HTML UI: member cards, global controls, credits dialog and
 * loading overlay. The 3D layer is completely decoupled from these elements.
 */
export function createUI({
  members = MEMBERS,
  onSelect,
  onAnimationChange,
  onTogglePlay,
  onResetCamera,
}) {
  const panel = document.getElementById('panel');
  const panelToggle = document.getElementById('panel-toggle');
  const panelSummary = document.getElementById('panel-summary');
  const memberList = document.getElementById('member-list');
  const togglePlay = document.getElementById('toggle-play');
  const resetCamera = document.getElementById('reset-camera');
  const openCredits = document.getElementById('open-credits');
  const credits = document.getElementById('credits');
  const closeCredits = document.getElementById('close-credits');
  const creditsBody = document.getElementById('credits-body');
  const loading = document.getElementById('loading');
  const loadingFill = document.getElementById('loading-fill');
  const loadingPercent = document.getElementById('loading-percent');
  const loadingStatus = document.getElementById('loading-status');

  const cards = new Map();
  let paused = false;

  // On phones and portrait tablets the control panel becomes a bottom sheet.
  // Reserve its height in the canvas so the 3D scene is framed above it
  // instead of being covered.
  const compactLayout = window.matchMedia(
    '(max-width: 900px) and (orientation: portrait), (max-width: 600px)',
  );

  function syncSceneInset() {
    if (!compactLayout.matches) {
      document.documentElement.style.removeProperty('--scene-bottom');
      return;
    }

    const gap = 12;
    const height = panel.getBoundingClientRect().height;
    document.documentElement.style.setProperty(
      '--scene-bottom',
      `${Math.round(height + gap)}px`,
    );
  }

  const panelResizeObserver = new ResizeObserver(syncSceneInset);
  panelResizeObserver.observe(panel);
  compactLayout.addEventListener('change', syncSceneInset);
  syncSceneInset();

  for (const member of members) {
    const card = document.createElement('article');
    card.className = 'member';
    card.dataset.id = member.id;
    card.tabIndex = 0;
    card.style.setProperty('--member-color', member.color);
    card.setAttribute(
      'aria-label',
      `Selecionar ${member.displayName} (${member.name})`,
    );
    card.innerHTML = `
      <div class="member__top">
        <span class="member__index">${String(cards.size + 1).padStart(2, '0')}</span>
        <div class="member__title">
          <h3></h3>
          <p></p>
        </div>
        <span class="member__status status status--loading">Carregando</span>
      </div>
      <div class="member__actions">
        <button type="button" class="chip" data-preset="idle" disabled>Parado</button>
        <button type="button" class="chip" data-preset="walk" disabled>Andar</button>
        <button type="button" class="chip" data-preset="run" disabled>Correr</button>
      </div>
      <label class="member__select">
        <span>Animação</span>
        <span class="select-wrap">
          <select aria-label="Animação de ${member.displayName}" disabled>
            <option>Carregando…</option>
          </select>
        </span>
      </label>
      <div class="member__meta">
        <span class="member__license">${member.license}</span>
        <span class="member__count">—</span>
      </div>
      <p class="member__warning" hidden></p>
    `;

    card.querySelector('.member__title h3').textContent = member.displayName;
    card.querySelector('.member__title p').textContent = member.role;

    const status = card.querySelector('.member__status');
    const select = card.querySelector('select');
    const warning = card.querySelector('.member__warning');
    const count = card.querySelector('.member__count');
    const chips = [...card.querySelectorAll('.chip')];

    card.addEventListener('click', () => onSelect?.(member.id));
    card.addEventListener('keydown', (event) => {
      if (event.target !== card) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect?.(member.id);
      }
    });

    select.addEventListener('change', () => {
      onSelect?.(member.id);
      onAnimationChange?.(member.id, select.value);
    });

    for (const chip of chips) {
      chip.addEventListener('click', (event) => {
        event.stopPropagation();
        const clipId = chip.dataset.clip;
        if (!clipId) return;
        onSelect?.(member.id);
        onAnimationChange?.(member.id, clipId);
      });
    }

    memberList.appendChild(card);
    cards.set(member.id, {
      card,
      status,
      select,
      warning,
      count,
      chips,
      presets: {},
    });
  }

  function setMemberState(id, state, detail) {
    const card = cards.get(id);
    if (!card) return;

    card.status.className = `member__status status status--${state}`;
    card.status.textContent = STATUS_TEXT[state] ?? state;

    if (state === 'error') {
      card.warning.textContent =
        detail ?? 'Não foi possível carregar este modelo.';
      card.warning.hidden = false;
      card.select.disabled = true;
      for (const chip of card.chips) chip.disabled = true;
    } else if (state === 'ready') {
      card.warning.hidden = true;
    }
  }

  function setClips(id, clips, presets = {}) {
    const card = cards.get(id);
    if (!card) return;

    card.presets = presets;
    card.select.innerHTML = '';

    if (clips.length === 0) {
      card.select.disabled = true;
      card.select.append(new Option('Sem animações', ''));
      card.count.textContent = '0 clipes';
      setMemberState(id, 'empty');
      return;
    }

    for (const clip of clips) {
      const option = new Option(clip.label, clip.id);
      option.title = clip.originalName;
      card.select.append(option);
    }

    card.select.disabled = false;
    card.count.textContent = `${clips.length} clipes`;

    for (const chip of card.chips) {
      const clipId = presets[chip.dataset.preset] ?? '';
      chip.dataset.clip = clipId;
      chip.disabled = !clipId;
    }
  }

  function setClip(id, clipId) {
    const card = cards.get(id);
    if (!card) return;

    if ([...card.select.options].some((option) => option.value === clipId)) {
      card.select.value = clipId;
    }

    for (const chip of card.chips) {
      const active = Boolean(clipId) && chip.dataset.clip === clipId;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    }
  }

  function setSelected(id, { scroll = true } = {}) {
    for (const [memberId, card] of cards) {
      card.card.classList.toggle('is-selected', memberId === id);
    }

    if (scroll) {
      cards.get(id)?.card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function setSummary({ totalClips = 0, ready = 0 } = {}) {
    const parts = [`${members.length} membros`];
    if (totalClips > 0) parts.push(`${totalClips} animações`);
    if (ready > 0 && ready < members.length) {
      parts.push(`${ready}/${members.length} modelos`);
    } else if (ready > 0) {
      parts.push('prontos');
    }
    panelSummary.textContent = parts.join(' · ');
  }

  function setPaused(value) {
    paused = value;
    togglePlay.textContent = paused
      ? 'Retomar animações'
      : 'Pausar animações';
    togglePlay.setAttribute('aria-pressed', String(paused));
    panel.classList.toggle('is-paused', paused);
  }

  function setLoading(progress, status) {
    const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
    loadingFill.style.width = `${percent}%`;
    loadingPercent.textContent = `${percent}%`;
    if (status) loadingStatus.textContent = status;
  }

  function hideLoading() {
    loading.classList.add('is-hidden');
  }

  panelToggle.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('is-collapsed');
    panelToggle.setAttribute('aria-expanded', String(!collapsed));
    panelToggle.setAttribute(
      'aria-label',
      collapsed ? 'Expandir painel' : 'Recolher painel',
    );
  });

  togglePlay.addEventListener('click', () => {
    paused = !paused;
    setPaused(paused);
    onTogglePlay?.(paused);
  });

  resetCamera.addEventListener('click', () => onResetCamera?.());

  creditsBody.innerHTML = members
    .map(
      (member) => `
        <article class="credit">
          <div class="credit__info">
            <h3>${member.name}</h3>
            <p>${member.role} · ${member.displayName} · autor <strong>${member.author}</strong></p>
          </div>
          <a class="credit__link" href="${member.link}" target="_blank" rel="noopener noreferrer">
            Ver no Sketchfab ↗
          </a>
          <p class="credit__license">
            Licença <a href="${member.licenseUrl}" target="_blank" rel="noopener noreferrer">${member.license}</a>
          </p>
        </article>
      `,
    )
    .join('');

  openCredits.addEventListener('click', () => credits.showModal());
  closeCredits.addEventListener('click', () => credits.close());
  credits.addEventListener('click', (event) => {
    if (event.target === credits) credits.close();
  });

  return {
    setMemberState,
    setClips,
    setClip,
    setSelected,
    setSummary,
    setPaused,
    setLoading,
    hideLoading,
  };
}

// Title screen (ARC-04 entry): React island over the live camp, start/continue,
// overwrite confirmation and fire interaction. The imperative createHome API keeps
// main.ts free of React; CSS classes are unchanged from the previous DOM version.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import './i18n.js';

export interface HomeSaveSummary {
  day: number;
  health: number;
  perks: number;
}

export interface HomeOptions {
  onStart: () => void;
  onContinue: () => void;
  onSpark?: () => void;
  onPointer?: (clientX: number, clientY: number) => void;
  onLeave?: () => void;
}

export interface HomeShowState {
  save?: HomeSaveSummary | null;
  broken?: boolean;
}

export interface Home {
  show(state?: HomeShowState): void;
  hide(): void;
  readonly visible: boolean;
}

interface HomeUi {
  visible: boolean;
  save: HomeSaveSummary | null;
  broken: boolean;
}

interface HomeStore {
  state: HomeUi;
  listeners: Set<() => void>;
  set(next: Partial<HomeUi>): void;
  subscribe(listener: () => void): () => void;
}

function createStore(): HomeStore {
  const store: HomeStore = {
    state: { visible: false, save: null, broken: false },
    listeners: new Set(),
    set(next) {
      store.state = { ...store.state, ...next };
      store.listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
  };
  return store;
}

function HomeApp({ options, store }: { options: HomeOptions; store: HomeStore }) {
  const { t } = useTranslation();
  const ui = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.state,
  );
  const [confirming, setConfirming] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (ui.visible) return;
    clearTimeout(confirmTimer.current);
    setConfirming(false);
  }, [ui.visible]);
  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  const start = (): void => {
    if (ui.save && !confirming) {
      setConfirming(true);
      confirmTimer.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    clearTimeout(confirmTimer.current);
    setConfirming(false);
    options.onStart();
  };
  const info = ui.save
    ? t('home.saveInfo', {
        day: ui.save.day,
        health: ui.save.health,
        perks: ui.save.perks,
      })
    : ui.broken
      ? t('home.brokenSave')
      : t('home.noSave');

  return (
    <div
      className="home-frame"
      onPointerDown={(event) => {
        if ((event.target as Element).closest('button')) return;
        options.onSpark?.();
      }}
      onPointerMove={(event) => options.onPointer?.(event.clientX, event.clientY)}
      onPointerLeave={() => options.onLeave?.()}
    >
      <p className="home-kicker">{t('home.kicker')}</p>
      <div className="home-logo">
        <svg className="home-emblem" viewBox="0 0 120 120" aria-hidden="true">
          <path className="emblem-tree" d="M60 4 26 50h16L18 88h34v28h16V88h34L78 50h16Z" />
          <path
            className="emblem-flame"
            d="M60 54c8 10 12 16 12 24a12 12 0 0 1-24 0c0-8 4-14 12-24z"
          />
        </svg>
        <h1>{t('home.title')}</h1>
        <p className="home-sub">{t('home.subtitle')}</p>
      </div>
      <p className="home-tagline">
        {t('home.tagline1')}
        <br />
        {t('home.tagline2')}
      </p>
      <div className="home-actions">
        <button
          id="home-start"
          className={`home-btn primary${confirming ? ' confirm' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            start();
          }}
        >
          <span>{confirming ? t('home.confirm') : t('home.start')}</span>
          <small>{t('home.startHint')}</small>
        </button>
        <button
          id="home-continue"
          className="home-btn"
          disabled={!ui.save}
          onClick={(event) => {
            event.stopPropagation();
            if (ui.save) options.onContinue();
          }}
        >
          <span>{t('home.continue')}</span>
          <small id="home-save-info">{info}</small>
        </button>
      </div>
      <p className="home-foot">{t('home.sparkHint')}</p>
    </div>
  );
}

export function createHome(options: HomeOptions): Home {
  const section = document.createElement('section');
  section.id = 'home';
  section.hidden = true;
  document.body.append(section);
  const store = createStore();
  createRoot(section).render(<HomeApp options={options} store={store} />);

  return {
    show({ save = null, broken = false }: HomeShowState = {}): void {
      store.set({ visible: true, save, broken });
      section.hidden = false;
      section.classList.add('shown');
    },
    hide(): void {
      store.set({ visible: false });
      section.hidden = true;
      section.classList.remove('shown');
    },
    get visible(): boolean {
      return store.state.visible;
    },
  };
}

// frontend/src/components/Autocomplete.tsx
import { useLazyQuery, gql } from '@apollo/client';
import { useDebounce } from '../hooks/useDebounce';
import React from 'react';

const SUGGEST = gql`
  query Suggestions($term: String!) {
    suggestions(term: $term) {
      text
      type
    }
  }
`;

// Quantidade/medidas
const MAX_RETURNED = 20;   
const MAX_VISIBLE  = 10;   
const ITEM_HEIGHT  = 38;   
const CONTROL_HEIGHT = 46;
const RADIUS = 6;

const SWITCH_WIDTH = 60;
const SWITCH_HEIGHT = 28;

const KNOB_SIZE = 24;
const KNOB_MARGIN = 2;

const lightTheme = {
  bg: '#ffffff',
  text: '#0f172a',
  subtext: '#4b5563',
  border: '#cfd4dc',
  listShadow: 'rgba(27,39,51,0.08)',
  hoverBg: '#f5f7fa',
  accent: '#2d6cdf',
  accentHover: '#245cc3',
};

const darkTheme = {
  bg: '#0f172a',
  text: '#e5e7eb',
  subtext: '#94a3b8',
  border: '#334155',
  listShadow: 'rgba(0,0,0,0.45)',
  hoverBg: '#1f2937',
  accent: '#2d6cdf',
  accentHover: '#245cc3',
};

function MinimalSearchIcon({ size = 18, color = '#6b7280' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ flex: '0 0 auto' }}>
      <circle cx="11" cy="11" r="6" stroke={color} strokeWidth="1.8" fill="none" />
      <line x1="16" y1="16" x2="21" y2="21" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}


function InfoIcon({ size = 22, color = '#2d6cdf' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="1.8" />
      <line x1="12" y1="10" x2="12" y2="16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7" r="1.4" fill={color} />
    </svg>
  );
}

function FlipWord({
  words,
  intervalMs = 4000,
  color,
  fontWeight = 700,
}: {
  words: string[];
  intervalMs?: number;
  color: string;
  fontWeight?: number;
}) {
  const [index, setIndex] = React.useState(0);
  const [phase, setPhase] = React.useState<'idle' | 'anim'>('idle');
  const [widthPx, setWidthPx] = React.useState<number>(0);
  const [linePx, setLinePx] = React.useState<number | null>(null);
  const wrapRef = React.useRef<HTMLSpanElement>(null);
  const ANIM_MS = 260;

  React.useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const cs = getComputedStyle(wrap);

    const probe = document.createElement('span');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.whiteSpace = 'pre';
    // @ts-ignore
    probe.style.font = cs.font;
    probe.style.letterSpacing = cs.letterSpacing;

    document.body.appendChild(probe);
    let max = 0;
    for (const w of words) {
      probe.textContent = w;
      const rect = probe.getBoundingClientRect();
      if (rect.width > max) max = rect.width;
    }
    document.body.removeChild(probe);

    setWidthPx(Math.ceil(max) + 6);
    const lh = parseFloat(cs.lineHeight);
    setLinePx(Number.isFinite(lh) ? Math.ceil(lh) : null);
  }, [words, fontWeight]);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  React.useEffect(() => {
    const id = setInterval(() => {
      if (prefersReduced) {
        setIndex((i) => (i + 1) % words.length);
        return;
      }
      setPhase('anim');
      const t = setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        setPhase('idle');
      }, ANIM_MS);
      return () => clearTimeout(t);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, words.length, prefersReduced]);

  const curr = words[index];
  const next = words[(index + 1) % words.length];

  const layerBase: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    transition: `transform ${ANIM_MS}ms ease, opacity ${ANIM_MS}ms ease`,
    willChange: 'transform, opacity',
    whiteSpace: 'nowrap',
  };

  return (
    <span
      ref={wrapRef}
      aria-live="off"
      style={{
        display: 'inline-block',
        position: 'relative',
        overflow: 'hidden',
        height: linePx ? `${linePx}px` : '1em',
        lineHeight: linePx ? `${linePx}px` : 'normal',
        width: widthPx ? `${widthPx}px` : 'auto',
        verticalAlign: '-3px',
        color,
        fontWeight,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          ...layerBase,
          transform: 'translateX(0%)',
          opacity: phase === 'anim' ? 0 : 1,
          zIndex: 1,
        }}
      >
        {curr}
      </span>

      <span
        style={{
          ...layerBase,
          transform: phase === 'anim' ? 'translateX(0%)' : 'translateX(100%)',
          opacity: phase === 'anim' ? 1 : 0,
          zIndex: 2,
        }}
      >
        {next}
      </span>
    </span>
  );
}

export function Autocomplete() {
  const [term, setTerm] = React.useState('');
  const debounced = useDebounce(term, 300);
  const [fetch, { data }] = useLazyQuery(SUGGEST);

  const [hovered, setHovered] = React.useState<number | null>(null);
  const [dark, setDark] = React.useState(false);
  const theme = dark ? darkTheme : lightTheme;
  const [showTip, setShowTip] = React.useState(false);

  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const [toggleTop, setToggleTop] = React.useState<number>(0);

  React.useEffect(() => {
    if (debounced.length >= 4) fetch({ variables: { term: debounced } });
  }, [debounced, fetch]);

  React.useEffect(() => {
    document.body.style.background = theme.bg;
    document.body.style.color = theme.text;
    return () => {};
  }, [theme]);

  React.useLayoutEffect(() => {
    const compute = () => {
      const h1 = titleRef.current;
      if (!h1) return;
      const cs = getComputedStyle(h1);
      const lhRaw = cs.lineHeight;
      let lineH = parseFloat(lhRaw);
      if (!Number.isFinite(lineH)) {
        const fs = parseFloat(cs.fontSize);
        lineH = Number.isFinite(fs) ? fs * 1.2 : 36; 
      }
      const ADJUST_Y = -4;
      const top = Math.max(0, h1.offsetTop + (lineH - SWITCH_HEIGHT) / 2 + ADJUST_Y);
      setToggleTop(top);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  type Suggestion = { text: string; type: string };
  const suggestions: Suggestion[] = (data?.suggestions ?? []).slice(0, MAX_RETURNED);

  const knobX = dark ? (SWITCH_WIDTH - KNOB_SIZE - KNOB_MARGIN * 2) : 0;

  return (
    <div style={{ maxWidth: 920, margin: '40px auto', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif', position: 'relative' }}>
      <div style={{ position: 'absolute', top: toggleTop, right: 0, zIndex: 50 }}>
        <button
          role="switch"
          aria-checked={dark}
          aria-label="Alternar modo claro/escuro"
          onClick={() => setDark((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDark((v) => !v); }
          }}
          style={{
            width: SWITCH_WIDTH, height: SWITCH_HEIGHT, borderRadius: 999,
            border: `1px solid ${theme.border}`,
            background: dark ? '#1f2937' : '#e5e7eb',
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px',
            cursor: 'pointer',
            color: theme.accent,
            boxSizing: 'border-box',
            lineHeight: 0,
          }}
          title="Alternar modo claro/escuro"
        >
          <span aria-hidden style={{ fontSize: 14, userSelect: 'none' }}>☀️</span>
          <span aria-hidden style={{ fontSize: 14, userSelect: 'none' }}>🌙</span>
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: '50%',
              left: KNOB_MARGIN,
              width: KNOB_SIZE,
              height: KNOB_SIZE,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
              transform: `translate(${knobX}px, -50%)`,
              transition: 'transform 160ms ease',
            }}
          />
        </button>
      </div>

      <h1 ref={titleRef} style={{ margin: 0, fontSize: 36, color: theme.text, fontWeight: 400 }}>
        <span>Procure por </span>
        <FlipWord
          words={['filmes', 'atores', 'diretores', 'filmes', 'atrizes', 'diretoras']}
          intervalMs={2000}
          color={theme.accent}
          fontWeight={700}
        />
        <span> <br/>do cinema brasileiro</span>

        <span
          onMouseEnter={() => setShowTip(true)}
          onMouseLeave={() => setShowTip(false)}
          onFocus={() => setShowTip(true)}
          onBlur={() => setShowTip(false)}
          style={{ position: 'relative', display: 'inline-block', marginLeft: 8, verticalAlign: 'baseline' }}
          aria-label="Informações"
        >
          <InfoIcon color={theme.accent} />
          {showTip && (
            <span
              role="tooltip"
              style={{
                position: 'absolute',
                top: '120%',
                left: '50%',
                transform: 'translateX(-50%)',
                background: dark ? '#0b1220' : '#ffffff',
                color: theme.text,
                border: `1px solid ${theme.border}`,
                boxShadow: `0 8px 24px ${theme.listShadow}`,
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 13,
                minWidth: 260,
                zIndex: 20,
                whiteSpace: 'nowrap'
              }}
            >
              Um lugar para pesquisar sobre todos os seus <strong>filmes</strong>, <strong>atores</strong> e
              <strong> diretores</strong> favoritos do cinema brasileiro, abrangendo os top-1700 principais longametragens do país logados na rede Letterboxd. <br/> OBS: A ordem do Autocomplete é determinada pela ordenação de popularidade dos filmes listados dentro da plataforma.
            </span>
          )}
        </span>
      </h1>

      <p style={{ margin: '8px 0 16px', color: theme.subtext, fontSize: 14 }}>
        Digite no campo abaixo para exibir as sugestões do Autocomplete
      </p>

      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Faça sua busca aqui."
          style={{
            flex: 1,
            height: CONTROL_HEIGHT,
            boxSizing: 'border-box',
            padding: '0 12px',
            fontSize: 16,
            color: theme.text,
            background: theme.bg,
            border: `1px solid ${theme.border}`,
            borderRight: 'none',
            borderRadius: `${RADIUS}px 0 0 ${RADIUS}px`,
            outline: 'none',
            display: 'block',
          }}
        />
        <button
          type="button"
          onClick={() => { /* ação futura opcional */ }}
          style={{
            height: CONTROL_HEIGHT,
            boxSizing: 'border-box',
            margin: 0,
            padding: '0 22px',
            border: `1px solid ${theme.accent}`,
            borderRadius: `0 ${RADIUS}px ${RADIUS}px 0`,
            background: theme.accent,
            color: '#fff',
            fontWeight: 700,
            letterSpacing: 0.5,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            transition: 'background 120ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = theme.accentHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = theme.accent; }}
        >
          BUSCAR
        </button>
      </div>

      {term.length >= 4 && suggestions.length > 0 && (
        <ul
          onMouseLeave={() => setHovered(null)}
          style={{
            listStyle: 'none',
            padding: 0,
            marginTop: 8,
            border: `1px solid ${theme.border}`,
            borderRadius: 6,
            overflowY: 'auto',
            maxHeight: ITEM_HEIGHT * MAX_VISIBLE,
            boxShadow: `0 8px 24px ${theme.listShadow}`,
            background: dark ? '#111827' : '#fff',
          }}
        >
          {suggestions.map((s, idx) => {
            const isHovered = hovered === idx;
            return (
              <li
                key={`${s.type}-${s.text}`}
                onMouseEnter={() => setHovered(idx)}
                onTouchStart={() => setHovered(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setTerm(s.text)}
                style={{
                  position: 'relative',
                  height: ITEM_HEIGHT,
                  lineHeight: `${ITEM_HEIGHT}px`,
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  background: isHovered ? theme.hoverBg : (dark ? '#111827' : '#fff'),
                  transition: 'background 100ms ease',
                  color: theme.text,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 0, top: 0, bottom: 0,
                    width: isHovered ? 4 : 0,
                    background: theme.accent,
                    transition: 'width 120ms ease',
                  }}
                />
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <MinimalSearchIcon color={dark ? '#cbd5e1' : '#6b7280'} />
                </span>
                <span style={{ flex: 1, fontSize: 16 }}>{highlight(s.text, term)}</span>
                <span style={{ opacity: 0.6, fontSize: 12, textTransform: 'lowercase' }}>{s.type}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function highlight(text: string, term: string) {
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <strong>{text.slice(i, i + term.length)}</strong>
      {text.slice(i + term.length)}
    </>
  );
}

const { useState, useEffect, useRef, useReducer } = React;

    // Без сборщика: берем иконки из глобального LucideReact (UMD).
    // Если какой-то конкретной иконки нет — даем fallback-пустую компоненту, чтобы логика не падала.
    const pickIcon = (name) =>
      (typeof LucideReact !== 'undefined' && LucideReact && LucideReact[name])
        ? LucideReact[name]
        : () => null;

    const Plus = pickIcon('Plus');
    const Trash2 = pickIcon('Trash2');
    const Repeat = pickIcon('Repeat');
    const Play = pickIcon('Play');
    const Square = pickIcon('Square');
    const X = pickIcon('X');
    const ChevronDown = pickIcon('ChevronDown');
    const ChevronUp = pickIcon('ChevronUp');
    const Activity = pickIcon('Activity');
    const Volume2 = pickIcon('Volume2');
    const VolumeX = pickIcon('VolumeX');
    const Minus = pickIcon('Minus');
    const Check = pickIcon('Check');
    const Clock = pickIcon('Clock');
    const RotateCcw = pickIcon('RotateCcw');
    const Flame = pickIcon('Flame');
    const ArrowUp = pickIcon('ArrowUp');
    const CopyPlus = pickIcon('CopyPlus');
    const Settings2 = pickIcon('Settings2');
    const Pencil = pickIcon('Pencil');
    const Timer = pickIcon('Timer');
    const Hash = pickIcon('Hash');
    const Lock = pickIcon('Lock');
    const Layers = pickIcon('Layers');
    const GripVertical = pickIcon('GripVertical');
    const Download = pickIcon('Download');

const generateId = () => Math.random().toString(36).substr(2, 9);

const DAYS_OF_WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const QUICK_REPS = ['5', '8', '10', '12', '15', '20', 'MAX'];
const QUICK_TIME = ['5s', '10s', '15s', '30s', '45s', '60s', '90s', '2m', '3m', '5m'];
const QUICK_WEIGHTS = ['0', '2.5', '5', '10', '15', '20', '25', '50'];
const PREP_OPTIONS = ['0s', '5s', '10s', '15s', '20s'];
const DEFAULT_WORK_OVERTIME_ENABLED = false;
const EXECUTION_ACTIONS = {
  COMPLETE_STEP: 'COMPLETE_STEP',
  SKIP: 'SKIP',
  STOP: 'STOP'
};

const TIMER_IDLE_STATE = {
  isActive: false,
  phase: 'idle',
  timeLeft: 0,
  label: '',
  isOvertime: false,
  allowOvertime: false,
  initialTime: 0,
  workTime: 0,
  transition: null,
  completion: null
};

const timerReducer = (state, action) => {
  switch (action.type) {
    case 'START': {
      const { phase, timeLeft, label = '', allowOvertime = false, initialTime = timeLeft, workTime = 0, transition = null } = action.payload;
      return {
        ...TIMER_IDLE_STATE,
        isActive: true,
        phase,
        timeLeft,
        label,
        allowOvertime,
        initialTime,
        workTime,
        transition
      };
    }
    case 'STOP':
      return { ...TIMER_IDLE_STATE };
    case 'RESET_CURRENT':
      return { ...state, timeLeft: state.initialTime, isOvertime: false };
    case 'ACK_COMPLETION':
      return { ...state, completion: null };
    case 'TICK': {
      if (!state.isActive) return state;
      if (state.phase === 'prep') {
        if (state.timeLeft > 0) return { ...state, timeLeft: state.timeLeft - 1 };
        return {
          ...state,
          phase: 'work',
          timeLeft: state.workTime,
          initialTime: state.workTime,
          isOvertime: false
        };
      }
      if (state.phase === 'rest') {
        if (state.timeLeft > 0) return { ...state, timeLeft: state.timeLeft - 1 };
        return {
          ...TIMER_IDLE_STATE,
          completion: state.transition ? { id: generateId(), action: state.transition } : null
        };
      }
      if (state.phase === 'work') {
        if (!state.isOvertime) {
          if (state.timeLeft > 0) return { ...state, timeLeft: state.timeLeft - 1 };
          if (state.allowOvertime) return { ...state, isOvertime: true, timeLeft: 1 };
          return {
            ...TIMER_IDLE_STATE,
            completion: state.transition ? { id: generateId(), action: state.transition } : null
          };
        }
        return { ...state, timeLeft: state.timeLeft + 1 };
      }
      return state;
    }
    default:
      return state;
  }
};

const DEFAULT_VALUES = [
  'Сессия', 'Новое упражнение', 'Новый суперсет', 'Приседания', 'Отжимания', 'Новое упр'
];

const parseToSeconds = (val) => {
  if (!val) return 0;
  const str = val.toString().toLowerCase();
  const num = parseInt(str.replace(/\D/g, '')) || 0;
  if (str.includes('m')) return num * 60;
  return num;
};

const formatTime = (totalSeconds) => {
  const m = Math.floor(Math.abs(totalSeconds) / 60);
  const s = Math.abs(totalSeconds) % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatWallTime = (timestamp) => {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const adjustValue = (val, delta) => {
  const str = (val || '').toString();
  if (str === 'MAX') return delta > 0 ? '1' : 'MAX';
  const match = str.match(/^(\d+)(s|m)?$/);
  if (match) {
     const num = Math.max(0, parseInt(match[1]) + delta);
     const unit = match[2] || '';
     return `${num}${unit}`;
  }
  return Math.max(0, parseInt(val || 0) + delta).toString();
};

const adjustWeight = (val, delta) => {
  const num = parseFloat(val || 0);
  return Math.max(0, +(num + delta).toFixed(2)).toString();
};

const migrateLegacySetsDataToSteps = (setsData = [], fallbackName = 'Шаг') =>
  setsData.map((set, idx) => ({
    id: set.id || generateId(),
    name: set.name || `${fallbackName} ${idx + 1}`,
    type: set.mode || 'reps',
    value: set.value ?? '10',
    weight: set.weight ?? '0',
    completed: !!set.completed
  }));

const migrateLegacySupersetToSteps = (block) => {
  const rounds = Math.max(1, block.rounds || 1);
  const exercises = block.exercises || [];
  const values = block.values || [];
  const completedRounds = new Set(block.completedRounds || []);
  const roundExerciseCompletion = Array.isArray(block.roundExerciseCompletion) ? block.roundExerciseCompletion : [];

  return Array.from({ length: rounds }).flatMap((_, rIdx) =>
    exercises.map((ex, eIdx) => {
      const cell = values[rIdx]?.[ex.id] || { value: '10', weight: '0' };
      const doneInRound = !!roundExerciseCompletion[rIdx]?.[ex.id];
      return {
        id: generateId(),
        name: ex.name || `Exercise ${eIdx + 1}`,
        type: ex.mode || 'reps',
        value: cell.value ?? '10',
        weight: cell.weight ?? '0',
        groupId: `round-${rIdx + 1}`,
        round: rIdx + 1,
        roundTotal: rounds,
        roundOrder: eIdx + 1,
        completed: completedRounds.has(rIdx) || doneInRound
      };
    })
  );
};

const migrateBlockToStepsModel = (block) => {
  if (block.steps) {
    return {
      id: block.id || generateId(),
      name: block.name || 'Новое упражнение',
      rest: block.rest || block.restTime || '60s',
      prep: block.prep || block.prepTime || '5s',
      isSettingsOpen: !!block.isSettingsOpen,
      steps: (block.steps || []).map((step, idx) => ({
        id: step.id || generateId(),
        name: step.name || `Шаг ${idx + 1}`,
        type: step.type || 'reps',
        value: step.value ?? '10',
        weight: step.weight ?? '0',
        groupId: step.groupId,
        round: step.round,
        roundTotal: step.roundTotal,
        roundOrder: step.roundOrder,
        completed: !!step.completed
      }))
    };
  }

  const steps = block.type === 'superset'
    ? migrateLegacySupersetToSteps(block)
    : migrateLegacySetsDataToSteps(block.setsData || [], block.name || 'Шаг');

  return {
    id: block.id || generateId(),
    name: block.name || (block.type === 'superset' ? 'Новый суперсет' : 'Новое упражнение'),
    rest: block.restTime || block.rest || '60s',
    prep: block.prepTime || block.prep || '5s',
    isSettingsOpen: !!block.isSettingsOpen,
    steps
  };
};

const migrateScheduleModel = (rawSchedule = []) =>
  (rawSchedule || []).map(day => ({
    ...day,
    blocks: (day.blocks || []).map(migrateBlockToStepsModel)
  }));

const SmartInput = ({ value, onChange, className, placeholder, defaultValue, allowInlineEdit = true, editTrigger = 0 }) => {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef(null);

  const startEditing = () => {
    setIsEditing(true);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const val = inputRef.current.value;
        inputRef.current.value = '';
        inputRef.current.value = val;
      }
    }, 50);
  };

  useEffect(() => {
    if (editTrigger > 0) startEditing();
  }, [editTrigger]);

  const handleBlur = (e) => {
    setIsEditing(false);
    if (e.target.value.trim() === '') {
      onChange({ target: { value: defaultValue || placeholder || 'Без названия' } });
    }
  };

  const handleFocus = (e) => {
    const val = e.target.value.trim();
    const isDefault = DEFAULT_VALUES.some(def =>
      val.toLowerCase() === def.toLowerCase() ||
      (val.startsWith(def) && !isNaN(val.replace(def, "").trim()))
    );
    if (isDefault) onChange({ target: { value: '' } });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') inputRef.current?.blur();
  };

  return (
    <div className="relative flex-1 min-w-0 flex items-center">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={onChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        readOnly={!allowInlineEdit && !isEditing}
        className={`
          ${className} w-full transition-all duration-200
          ${isEditing ? 'bg-black/40 ring-1 ring-red-500 rounded px-1 text-red-400' : 'pointer-events-auto'}
        `}
        placeholder={placeholder}
      />
    </div>
  );
};

function SwipeableCell({ children, onSwipeRight, canSwipe }) {
  const startX = useRef(null);

  const handleTouchStart = (e) => {
    if (!canSwipe) return;
    startX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (!canSwipe || startX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - startX.current;

    if (deltaX > 50) onSwipeRight?.();
    startX.current = null;
  };

  const handleTouchCancel = () => {
    startX.current = null;
  };

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchCancel}>
      {children}
    </div>
  );
}

function App() {
  const [schedule, setSchedule] = useState(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('wb_neon_clean_v54') : null;
    return saved ? migrateScheduleModel(JSON.parse(saved)) : [];
  });

  const [activeDayName, setActiveDayName] = useState('Пн');
  const [activeSessionIdx, setActiveSessionIdx] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isStickyVisible, setIsStickyVisible] = useState(false);
  const [modal, setModal] = useState({ show: false, title: '', options: [], onSelect: null, currentVal: '', currentWeight: '0', hasWeightTab: false, activeTab: 'value' });
  const [confirmModal, setConfirmModal] = useState({ show: false, onConfirm: null, message: '', title: '' });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sessionState, setSessionState] = useState({ dayId: null, elapsed: 0, startTime: null });
  const [activeTimer, dispatchTimer] = useReducer(timerReducer, TIMER_IDLE_STATE);

  const audioCtx = useRef(null);
  const mainTimerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('wb_neon_clean_v54', JSON.stringify(schedule));
  }, [schedule]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
      if (mainTimerRef.current) {
        const rect = mainTimerRef.current.getBoundingClientRect();
        setIsStickyVisible(rect.bottom < 0);
      } else {
        setIsStickyVisible(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const createNewDay = (dayName) => {
    const daySessions = schedule.filter(d => d.dayName === dayName);
    const newDay = {
      id: generateId(),
      dayName: dayName,
      title: `Сессия ${daySessions.length + 1}`,
      blocks: [],
      isCollapsed: false,
      activeBlockId: null,
      createdAt: Date.now()
    };
    setSchedule(prev => [...prev, newDay]);
    setActiveDayName(dayName);
    setActiveSessionIdx(daySessions.length);
  };

  const selectDay = (dayName) => {
    if (activeDayName === dayName) {
      setConfirmModal({
        show: true,
        title: "Новая тренировка",
        message: `Создать еще одну тренировочную сессию на ${dayName}?`,
        onConfirm: () => createNewDay(dayName)
      });
      return;
    }
    const daySessions = schedule.filter(d => d.dayName === dayName);
    if (daySessions.length === 0) {
      createNewDay(dayName);
    } else {
      setActiveDayName(dayName);
      setActiveSessionIdx(0);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const playMetronome = (type) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx.current;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      const beep = ({ freq = 1000, dur = 0.05, vol = 0.2, rampTo, rampDur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(Math.max(0.0001, vol), now);
        osc.frequency.setValueAtTime(freq, now);
        if (rampTo != null && rampDur != null) {
          osc.frequency.exponentialRampToValueAtTime(rampTo, now + rampDur);
        }
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc.start(now);
        osc.stop(now + dur);
      };

      if (type === 'tick') beep({ freq: 980, dur: 0.04, vol: 0.18 });
      else if (type === 'prepTick') beep({ freq: 760, dur: 0.045, vol: 0.16 });
      else if (type === 'countdown') beep({ freq: 1500, dur: 0.09, vol: 0.28 });
      else if (type === 'start') {
        // короткий "старт": два быстрых сигнала
        beep({ freq: 1200, dur: 0.06, vol: 0.25 });
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        gain2.gain.setValueAtTime(0.22, now + 0.09);
        osc2.frequency.setValueAtTime(1800, now + 0.09);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        osc2.start(now + 0.09);
        osc2.stop(now + 0.16);
      }
      else if (type === 'finish') beep({ freq: 650, rampTo: 1300, rampDur: 0.25, dur: 0.38, vol: 0.28 });
      else if (type === 'restFinish') beep({ freq: 520, rampTo: 900, rampDur: 0.18, dur: 0.32, vol: 0.26 });
    } catch (e) {}
  };

  useEffect(() => {
    let interval;
    if (sessionState.dayId) {
      interval = setInterval(() => {
        setSessionState(prev => ({
          ...prev,
          elapsed: Math.floor((Date.now() - prev.startTime) / 1000)
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sessionState.dayId]);

  useEffect(() => {
    if (!activeTimer.isActive) return;
    const interval = setInterval(() => dispatchTimer({ type: 'TICK' }), 1000);
    return () => clearInterval(interval);
  }, [activeTimer.isActive]);

  useEffect(() => {
    if (!activeTimer.isActive) return;
    if (activeTimer.phase === 'prep') {
      if (activeTimer.timeLeft === 0) playMetronome('start');
      else if (activeTimer.timeLeft <= 3) playMetronome('countdown');
      else playMetronome('prepTick');
      return;
    }
    if (activeTimer.phase === 'work') {
      if (!activeTimer.isOvertime) {
        if (activeTimer.timeLeft <= 3) playMetronome('countdown');
        else playMetronome('tick');
      }
      return;
    }
  }, [activeTimer.phase, activeTimer.timeLeft, activeTimer.isActive, activeTimer.isOvertime]);

  useEffect(() => {
    if (!activeTimer.completion) return;
    if (activeTimer.phase === 'idle') {
      const type = activeTimer.completion.action?.kind === 'afterRest' ? 'restFinish' : 'finish';
      playMetronome(type);
    }
  }, [activeTimer.completion, activeTimer.phase]);

  const triggerTimer = (timeStr, type = 'rest', label = '', transition = null, prepTimeStr = '0s') => {
    if (!sessionState.dayId) return;
    const pSecs = parseToSeconds(prepTimeStr);
    const wSecs = parseToSeconds(timeStr);
    const allowOvertime = type === 'work' ? DEFAULT_WORK_OVERTIME_ENABLED : false;
    if (type === 'work' && pSecs > 0) {
      dispatchTimer({ type: 'START', payload: { phase: 'prep', timeLeft: pSecs, initialTime: pSecs, label, workTime: wSecs, allowOvertime, transition } });
    } else {
      dispatchTimer({ type: 'START', payload: { phase: type, timeLeft: wSecs, initialTime: wSecs, label, allowOvertime, transition } });
    }
  };

  const daySessions = schedule.filter(d => d.dayName === activeDayName);
  const activeDayData = daySessions[activeSessionIdx] || daySessions[0];

  const toggleAllBlocks = () => {
    if (!activeDayData) return;
    const isAnyExpanded = !!activeDayData.activeBlockId;
    const nextId = isAnyExpanded ? null : (activeDayData.blocks[0]?.id || null);

    setSchedule(schedule.map(d =>
      d.id === activeDayData.id
        ? { ...d, activeBlockId: nextId }
        : d
    ));
  };

  const saveToFile = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      schedule
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateSuffix = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `traincounter-backup-${dateSuffix}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const stopSessionAndResetProgress = () => {
    
    setSchedule(prev => prev.map(day => {
      if (day.id !== sessionState.dayId) return day;
      return {
        ...day,
        blocks: (day.blocks || []).map(block => {
          return {
            ...block,
            steps: (block.steps || []).map(step => ({ ...step, completed: false }))
          };
        })
      };
    }));

    setSessionState({ dayId: null, elapsed: 0, startTime: null });
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-24 overflow-x-hidden">
      {/* Header */}
      <div className="bg-[#1C1C1E]/95 backdrop-blur-2xl border-b border-white/5 sticky top-0 z-[100] px-4 py-3 flex flex-col gap-3 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#FF3B30] p-1.5 rounded-lg shadow-lg">
              <Flame className="w-4 h-4 text-white fill-white" />
            </div>
            <h1 className="text-sm font-black tracking-tight uppercase italic text-white/90">Workouts</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={saveToFile}
              className="p-2 rounded-full transition-all bg-[#2C2C2E] text-white border border-white/10 active:scale-95"
              title="Сохранить в файл"
            >
              <Download className="w-4 h-4" />
            </button>
            <button onClick={() => setSoundEnabled(!soundEnabled)} className={`p-2 rounded-full transition-all ${soundEnabled ? 'bg-red-600/20 text-red-400' : 'bg-white/10 text-white/40'}`}>
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {DAYS_OF_WEEK.map(day => {
            const isActive = activeDayName === day;
            const sessionsCount = schedule.filter(d => d.dayName === day).length;
            const isCreated = sessionsCount > 0;
            return (
              <button
                key={day}
                onClick={() => selectDay(day)}
                className={`
                  flex-1 min-w-[42px] h-10 flex flex-col items-center justify-center rounded-lg font-black text-[10px] transition-all relative
                  ${isActive ? 'bg-[#FF3B30] text-white shadow-xl scale-105 z-10' :
                    isCreated ? 'bg-[#3A3A3C] text-white border border-white/10' : 'bg-[#2C2C2E] text-[#48484A]'}
                `}
              >
                {day}
                {isCreated && !isActive && <div className="absolute top-1 right-1 w-1 h-1 bg-red-500 rounded-full" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-3 space-y-4">
        {activeDayData ? (
          <DayContainer
            day={activeDayData}
            timerRef={mainTimerRef}
            isTimerActive={activeTimer.isActive}
            isSessionActive={sessionState.dayId === activeDayData.id}
            sessionElapsed={sessionState.elapsed}
            sessionStartTime={sessionState.startTime}
            onStart={(dayId) => {
              setSessionState({
                dayId: dayId,
                elapsed: 0,
                startTime: Date.now()
              });
            }}
            onStop={stopSessionAndResetProgress}
            onRemove={() => {
              const newSchedule = schedule.filter(d => d.id !== activeDayData.id);
              setSchedule(newSchedule);
              setActiveSessionIdx(0);
            }}
            onUpdate={(data) => setSchedule(schedule.map(d => d.id === activeDayData.id ? { ...d, ...data } : d))}
            openModal={(t, o, c, s, h, w) => setModal({ show: true, title: t, options: o, currentVal: c, onSelect: s, hasWeightTab: h, currentWeight: w, activeTab: 'value' })}
            openConfirm={(m, c, tit) => setConfirmModal({ show: true, message: m, onConfirm: c, title: tit || 'Подтверждение' })}
            triggerTimer={triggerTimer}
            timerCompletion={activeTimer.completion}
            onTimerCompletionHandled={() => dispatchTimer({ type: 'ACK_COMPLETION' })}
          />
        ) : (
          <div className="py-20 text-center text-[#48484A] uppercase italic font-black text-[10px] tracking-widest animate-pulse">
            Выберите день
          </div>
        )}
      </div>

      {sessionState.dayId !== null && isStickyVisible && (
        <div className="fixed bottom-0 left-0 right-0 z-[150] px-4 pb-6 pt-10 bg-gradient-to-t from-black via-black/95 to-transparent animate-in slide-in-from-bottom duration-300 pointer-events-none">
          <div className="max-w-md mx-auto flex items-center gap-3 bg-[#1C1C1E] p-3 rounded-[24px] border border-red-500/30 shadow-[0_-10px_40px_rgba(255,59,48,0.2)] pointer-events-auto">
            <div className="flex-1 flex flex-col justify-center px-4">
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-[8px] font-black uppercase text-red-500/60 italic tracking-[0.2em]">Active Session</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-white font-black text-2xl tabular-nums italic tracking-tighter leading-none">{formatTime(sessionState.elapsed)}</span>
                <span className="text-[10px] text-[#48484A] font-black italic">started {formatWallTime(sessionState.startTime)}</span>
              </div>
            </div>
            <button
              onClick={stopSessionAndResetProgress}
              className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-white active:scale-95 shadow-lg shadow-red-900/40"
            >
              <Square className="w-5 h-5 fill-white" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Action Buttons Area */}
      <div className={`fixed right-6 z-[160] flex flex-col gap-3 transition-all ${sessionState.dayId !== null && isStickyVisible ? 'bottom-28' : 'bottom-6'}`}>
        {activeDayData && activeDayData.blocks.length > 0 && (
          <button
            onClick={toggleAllBlocks}
            className="w-12 h-12 bg-[#2C2C2E] text-white rounded-full flex items-center justify-center shadow-2xl border border-white/10 active:scale-90 transition-all"
            title={activeDayData.activeBlockId ? "Свернуть все" : "Развернуть первое"}
          >
            {activeDayData.activeBlockId ? <ChevronUp className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
          </button>
        )}

        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="w-12 h-12 bg-red-600 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Timer Overlay */}
      {activeTimer.isActive && (
        <div className={`fixed inset-0 z-[260] flex flex-col items-center justify-center p-6 text-white transition-colors duration-500 ${activeTimer.phase === 'rest' ? 'bg-[#FF9500]' : activeTimer.phase === 'prep' ? 'bg-orange-600' : activeTimer.isOvertime ? 'bg-red-900' : 'bg-[#FF3B30]'}`}>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-4 italic">{activeTimer.phase === 'rest' ? 'Восстановление' : activeTimer.phase === 'prep' ? 'Приготовьтесь' : activeTimer.isOvertime ? 'Превышение' : activeTimer.label}</span>
          <h2 className="text-9xl font-black tabular-nums tracking-tighter leading-none mb-16">{activeTimer.isOvertime ? '+' : ''}{formatTime(activeTimer.timeLeft)}</h2>
          <div className="flex items-center gap-8">
            <button onClick={() => dispatchTimer({ type: 'RESET_CURRENT' })} className="w-16 h-16 rounded-full flex items-center justify-center bg-black/20"><RotateCcw className="w-6 h-6" /></button>
            <button onClick={() => dispatchTimer({ type: 'STOP' })} className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl ${activeTimer.isOvertime ? 'bg-[#32D74B]' : 'bg-black/30'}`}>{activeTimer.isOvertime ? <Check className="w-10 h-10 text-black" /> : <Square className="w-8 h-8 fill-white" />}</button>
            <button onClick={() => dispatchTimer({ type: 'STOP' })} className="w-16 h-16 rounded-full flex items-center justify-center bg-black/20 text-white/50"><X className="w-6 h-6" /></button>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal.show && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[210] flex items-end">
          <div className="bg-[#1C1C1E] w-full rounded-t-[32px] p-6 pb-10 border-t border-white/10 animate-in slide-in-from-bottom duration-400">
            <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
            <div className="flex items-center gap-4 mb-6">
               <button onClick={() => setModal({...modal, activeTab: 'value'})} className={`pb-1 border-b-2 font-black text-xl transition-all ${modal.activeTab === 'value' ? 'border-red-500 text-white' : 'border-transparent text-[#48484A]'}`}>{modal.title}</button>
               {modal.hasWeightTab && <button onClick={() => setModal({...modal, activeTab: 'weight'})} className={`pb-1 border-b-2 font-black text-xl transition-all ${modal.activeTab === 'weight' ? 'border-red-500 text-white' : 'border-transparent text-[#48484A]'}`}>Вес (кг)</button>}
               <button onClick={() => setModal({ ...modal, show: false })} className="ml-auto p-1 text-[#48484A]"><X className="w-6 h-6" /></button>
            </div>

            <div className="flex items-center justify-between mb-8 bg-black/40 p-6 rounded-2xl border border-white/5 shadow-inner">
               <button onClick={() => modal.activeTab === 'weight' ? setModal({...modal, currentWeight: adjustWeight(modal.currentWeight, -0.5)}) : setModal({...modal, currentVal: adjustValue(modal.currentVal, -1)})} className="w-14 h-14 bg-[#2C2C2E] rounded-full flex items-center justify-center active:scale-90"><Minus className="w-6 h-6 text-white" /></button>
               <div className="text-5xl font-black text-orange-500 tabular-nums italic">{modal.activeTab === 'weight' ? modal.currentWeight : modal.currentVal}</div>
               <button onClick={() => modal.activeTab === 'weight' ? setModal({...modal, currentWeight: adjustWeight(modal.currentWeight, 0.5)}) : setModal({...modal, currentVal: adjustValue(modal.currentVal, 1)})} className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center active:scale-90"><Plus className="w-6 h-6 text-white" /></button>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-8">
              {(modal.activeTab === 'weight' ? QUICK_WEIGHTS : modal.options).map(opt => (
                <button key={opt} onClick={() => setModal({...modal, [modal.activeTab === 'weight' ? 'currentWeight' : 'currentVal']: opt})} className={`py-3 rounded-xl font-black text-[11px] transition-all border ${ (modal.activeTab === 'weight' ? modal.currentWeight === opt : modal.currentVal === opt) ? 'bg-red-600 border-red-500 text-white' : 'bg-[#2C2C2E] border-transparent text-[#8E8E93]'}`}>{opt}</button>
              ))}
            </div>
            <button onClick={() => { modal.onSelect(modal.currentVal, modal.currentWeight); setModal({ ...modal, show: false }); }} className="w-full bg-red-600 text-white py-5 rounded-2xl font-black text-lg active:scale-95 shadow-2xl shadow-red-900/40 uppercase italic tracking-widest">ПОДТВЕРДИТЬ</button>
          </div>
        </div>
      )}

      {confirmModal.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-2xl z-[300] flex items-center justify-center p-6">
           <div className="bg-[#1C1C1E] w-full max-w-xs rounded-[32px] p-8 border border-white/10 shadow-3xl text-center">
              <div className="w-16 h-16 bg-red-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-600">
                 {confirmModal.title === 'Удаление' ? <Trash2 className="w-8 h-8" /> : <CopyPlus className="w-8 h-8" />}
              </div>
              <h3 className="font-black text-xl mb-2 uppercase italic">{confirmModal.title}</h3>
              <p className="text-[#8E8E93] text-sm mb-10 leading-snug">{confirmModal.message}</p>
              <div className="flex flex-col gap-3">
                 <button onClick={() => { confirmModal.onConfirm(); setConfirmModal({...confirmModal, show: false}); }} className="w-full bg-red-600 text-white py-4 rounded-xl font-black text-xs uppercase italic active:scale-95 shadow-lg shadow-red-900/30">Продолжить</button>
                 <button onClick={() => setConfirmModal({...confirmModal, show: false})} className="w-full bg-white/5 text-[#8E8E93] py-4 rounded-xl font-black text-xs uppercase italic">Отмена</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

function DayContainer({ day, timerRef, onUpdate, openModal, openConfirm, triggerTimer, timerCompletion, onTimerCompletionHandled, isTimerActive, isSessionActive, sessionElapsed, sessionStartTime, onStart, onStop, onRemove }) {
  const [draggedId, setDraggedId] = useState(null);
  const [targetId, setTargetId] = useState(null);
  const [pendingFocus, setPendingFocus] = useState(null);
  const firstExerciseId = day.blocks[0]?.id || null;

  const createSimpleBlock = () => ({
    id: generateId(),
    name: 'Новое упражнение',
    rest: '60s',
    prep: '5s',
    isSettingsOpen: true,
    steps: Array.from({ length: 3 }).map(() => ({ id: generateId(), name: 'Шаг', type: 'reps', value: '10', weight: '0', completed: false }))
  });

  const createSupersetLikeBlock = () => {
    const rounds = 3;
    const exercises = ['Приседания', 'Отжимания'];
    return {
      id: generateId(),
      name: 'Новый суперсет',
      rest: '60s',
      prep: '5s',
      isSettingsOpen: true,
      steps: Array.from({ length: rounds }).flatMap((_, rIdx) =>
        exercises.map((exerciseName, eIdx) => ({
          id: generateId(),
          name: exerciseName,
          type: 'reps',
          value: '10',
          weight: '0',
          groupId: `round-${rIdx + 1}`,
          round: rIdx + 1,
          roundTotal: rounds,
          roundOrder: eIdx + 1,
          completed: false
        }))
      )
    };
  };

  const addBlock = (preset) => {
    const newBlock = preset === 'superset' ? createSupersetLikeBlock() : createSimpleBlock();
    onUpdate({ blocks: [...day.blocks, newBlock], activeBlockId: newBlock.id });
  };

  const handleDragStart = (id) => {
    if (isSessionActive) return;
    setDraggedId(id);
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    if (draggedId === id) return;
    setTargetId(id);
  };

  const handleDragEnd = () => {
    if (!draggedId || !targetId) {
      setDraggedId(null);
      setTargetId(null);
      return;
    }

    const draggedIdx = day.blocks.findIndex(b => b.id === draggedId);
    const targetIdx = day.blocks.findIndex(b => b.id === targetId);

    const newBlocks = [...day.blocks];
    const [draggedItem] = newBlocks.splice(draggedIdx, 1);
    newBlocks.splice(targetIdx, 0, draggedItem);

    onUpdate({ blocks: newBlocks });
    setDraggedId(null);
    setTargetId(null);
  };

  const goToNextExercise = (currentBlockId, options = {}) => {
    const currentIdx = day.blocks.findIndex(b => b.id === currentBlockId);
    if (currentIdx === -1) return;
    const nextExercise = day.blocks[currentIdx + 1];
    if (nextExercise) {
      onUpdate({ activeBlockId: nextExercise.id });
      if (options.fullscreen) {
        setPendingFocus({ blockId: nextExercise.id, stepIdx: options.stepIdx ?? 0, fullscreen: true, id: generateId() });
      }
    }
  };

  return (
    <div className={`bg-[#1C1C1E] rounded-[32px] overflow-hidden transition-all duration-300 border ${isSessionActive ? 'border-red-500 shadow-[0_0_40px_rgba(255,59,48,0.15)]' : 'border-white/5'}`}>
      <div className="p-4 flex flex-col gap-3" ref={timerRef}>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
            <div className="flex items-center gap-2">
              <span className="bg-[#FF3B30] text-white px-2 py-0.5 rounded-md font-black text-[8px] uppercase italic tracking-tighter">{day.dayName}</span>
              <span className="text-[8px] font-black uppercase tracking-widest text-[#48484A] italic">Workout Plan</span>
            </div>
            <SmartInput value={day.title} defaultValue={`Сессия`} onChange={(e) => onUpdate({ title: e.target.value })} className="font-black text-2xl bg-transparent outline-none flex-1 truncate text-white uppercase italic tracking-tight" placeholder="Session Name" />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => openConfirm('Удалить этот план?', onRemove, 'Удаление')} className="p-2 text-[#48484A] hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
            <button onClick={() => onUpdate({ isCollapsed: !day.isCollapsed })} className="p-2.5 bg-white/5 rounded-xl text-white">{day.isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}</button>
          </div>
        </div>

        {!isSessionActive ? (
          <button onClick={() => onStart(firstExerciseId)} className="h-12 bg-red-600 text-white rounded-2xl flex items-center justify-center gap-3 font-black text-xs uppercase italic active:scale-[0.98] transition-all shadow-xl shadow-red-900/40 tracking-widest"><Play className="w-4 h-4 fill-white" /> СТАРТ</button>
        ) : (
          <div className="flex gap-2">
            <div className="flex-1 flex flex-col items-center justify-center h-14 bg-black/40 border border-red-500/30 rounded-2xl shadow-inner relative overflow-hidden">
              <div className="flex items-center gap-1 mb-0.5"><Clock size={8} className="text-red-500/60" /><span className="text-[7px] font-black uppercase text-red-500/60 italic tracking-widest">Started at {formatWallTime(sessionStartTime)}</span></div>
              <div className="flex items-center"><div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-3 animate-pulse" /><span className="text-white font-black text-2xl tabular-nums italic tracking-tighter leading-none">{formatTime(sessionElapsed)}</span></div>
            </div>
            <button onClick={onStop} className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white active:scale-95 shadow-xl shadow-red-900/20"><Square className="w-5 h-5 fill-white" /></button>
          </div>
        )}
      </div>

      {!day.isCollapsed && (
        <div className="px-3 pb-5 space-y-3 bg-black/30">
          {day.blocks.map((block) => (
            <div key={block.id} draggable={!isSessionActive} onDragStart={() => handleDragStart(block.id)} onDragOver={(e) => handleDragOver(e, block.id)} onDragEnd={handleDragEnd} className={`transition-all duration-200 ${draggedId === block.id ? 'opacity-20 scale-95' : 'opacity-100'} ${targetId === block.id ? 'border-t-2 border-red-500 pt-2' : ''}`}>
              <BlockItem
                block={block}
                isExpanded={day.activeBlockId === block.id}
                isTimerActive={isTimerActive}
                isSessionActive={isSessionActive}
                shouldAutoFocusOnStart={block.id === firstExerciseId}
                sessionStartTime={sessionStartTime}
                isDraggable={!isSessionActive}
                pendingFocusRequest={pendingFocus && pendingFocus.blockId === block.id ? pendingFocus : null}
                onPendingFocusApplied={() => setPendingFocus(null)}
                onToggle={() => onUpdate({ activeBlockId: day.activeBlockId === block.id ? null : block.id })}
                onRemove={() => onUpdate({ blocks: day.blocks.filter(b => b.id !== block.id) })}
                onChange={(data) => onUpdate({ blocks: day.blocks.map(b => b.id === block.id ? { ...b, ...data } : b) })}
                goToNextExercise={goToNextExercise}
                openModal={openModal}
                openConfirm={openConfirm}
                triggerTimer={triggerTimer}
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button onClick={() => addBlock('exercise')} className="bg-[#2C2C2E] text-white h-12 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase active:scale-95 border border-white/5"><Plus size={14} className="text-red-500" /> Упражнение</button>
            <button onClick={() => addBlock('superset')} className="bg-red-600/10 text-red-500 h-12 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase border border-red-500/20 active:scale-95"><Repeat size={14} /> Суперсет</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BlockItem({ block, isExpanded, onToggle, onRemove, onChange, openModal, openConfirm, triggerTimer, isTimerActive, isSessionActive, isDraggable, shouldAutoFocusOnStart = false, sessionStartTime = null, goToNextExercise = () => {}, pendingFocusRequest = null, onPendingFocusApplied = () => {}, timerCompletion = null, onTimerCompletionHandled = () => {} }) {
  const [nameEditTrigger, setNameEditTrigger] = useState(0);
  const [focusedStepIdx, setFocusedStepIdx] = useState(0);
  const [isFocusFullscreen, setIsFocusFullscreen] = useState(false);
  const lastAutoFocusStartRef = useRef(null);
  const steps = block.steps || [];
  const isAllDone = steps.every(s => s.completed) && steps.length > 0;
  const activeStepIdx = steps.findIndex(s => !s.completed);
  const safeFocusedStepIdx = Math.min(Math.max(focusedStepIdx, 0), Math.max(steps.length - 1, 0));
  const focusedStep = steps[safeFocusedStepIdx];

  useEffect(() => {
    if (!isSessionActive) return;
    if (activeStepIdx >= 0) setFocusedStepIdx(activeStepIdx);
  }, [activeStepIdx, isSessionActive]);

  useEffect(() => {
    if (!isSessionActive || !isExpanded) return;
    setFocusedStepIdx(activeStepIdx >= 0 ? activeStepIdx : 0);
  }, [isSessionActive, isExpanded, activeStepIdx]);

  useEffect(() => {
    if (!isSessionActive || !isExpanded) setIsFocusFullscreen(false);
  }, [isSessionActive, isExpanded]);

  useEffect(() => {
    if (isTimerActive) setIsFocusFullscreen(false);
  }, [isTimerActive]);

  useEffect(() => {
    if (!sessionStartTime || !isSessionActive || !isExpanded || !shouldAutoFocusOnStart) return;
    if (lastAutoFocusStartRef.current === sessionStartTime) return;
    setFocusedStepIdx(activeStepIdx >= 0 ? activeStepIdx : 0);
    lastAutoFocusStartRef.current = sessionStartTime;
  }, [sessionStartTime, isSessionActive, isExpanded, shouldAutoFocusOnStart, activeStepIdx]);

  useEffect(() => {
    if (!pendingFocusRequest || !isSessionActive || !isExpanded) return;
    const requestedIdx = Math.min(Math.max(pendingFocusRequest.stepIdx ?? 0, 0), Math.max(steps.length - 1, 0));
    setFocusedStepIdx(requestedIdx);
    if (pendingFocusRequest.fullscreen && !isTimerActive) setIsFocusFullscreen(true);
    onPendingFocusApplied();
  }, [pendingFocusRequest, isSessionActive, isExpanded, isTimerActive, steps.length, onPendingFocusApplied]);

  const goToNextStepOrExercise = () => {
    const nextIncompleteIdx = steps.findIndex((s, idx) => idx > safeFocusedStepIdx && !s.completed);
    if (nextIncompleteIdx !== -1) {
      setFocusedStepIdx(nextIncompleteIdx);
      if (!isTimerActive) setIsFocusFullscreen(true);
      return;
    }
    goToNextExercise(block.id, { stepIdx: 0, fullscreen: true });
  };

  const toggleStepComplete = (sIdx, options = {}) => {
    const { onRestComplete = null } = options;
    if (!isSessionActive || (sIdx !== activeStepIdx && !steps[sIdx]?.completed)) return;
    const target = steps[sIdx];
    const nextSteps = [...steps];
    if (target.completed) {
      openConfirm('Сбросить этап?', () => {
        nextSteps[sIdx] = { ...nextSteps[sIdx], completed: false };
        onChange({ steps: nextSteps });
      }, 'Сброс');
    } else {
      nextSteps[sIdx] = { ...nextSteps[sIdx], completed: true };
      onChange({ steps: nextSteps });
      if ((block.rest || '0s') !== '0s') {
        triggerTimer(block.rest || '60s', 'rest', '', onRestComplete);
      } else if (onRestComplete) {
        onRestComplete();
      }
    }
  };

  const handleFocusedStepAction = () => {
    if (!focusedStep) return;
    if (focusedStep.type === 'time' && !focusedStep.completed) {
      triggerTimer(focusedStep.value, 'work', focusedStep.name || block.name, () => toggleStepComplete(safeFocusedStepIdx, { onRestComplete: goToNextStepOrExercise }), block.prep || '0s');
      return;
    }
    toggleStepComplete(safeFocusedStepIdx, { onRestComplete: goToNextStepOrExercise });
  };

  const adjustStepsCount = (delta) => {
    const nextCount = Math.max(1, steps.length + delta);
    if (nextCount === steps.length) return;
    let nextSteps = [...steps];
    if (delta > 0) {
      for (let i = 0; i < delta; i++) {
        const last = nextSteps[nextSteps.length - 1] || { name: 'Шаг', type: 'reps', value: '10', weight: '0' };
        nextSteps.push({ ...last, id: generateId(), completed: false });
      }
    } else {
      nextSteps = nextSteps.slice(0, nextCount);
    }
    onChange({ steps: nextSteps });
  };

  return (
    <div className={`rounded-[28px] transition-all duration-300 overflow-hidden relative ${isExpanded ? 'bg-[#3A3A3C] shadow-lg' : 'bg-[#2C2C2E] border border-white/5'} ${isSessionActive && !isExpanded && !isAllDone ? 'opacity-80' : 'opacity-100'}`}>
      {!isSessionActive && <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="absolute top-2 right-2 p-2.5 text-[#48484A] hover:text-red-500 active:scale-90 transition-all z-[20]"><Trash2 size={20} /></button>}
      <div onClick={onToggle} className="flex items-center justify-between p-3.5 cursor-pointer">
        <div className="flex items-start gap-3.5 flex-1 overflow-hidden">
          {isDraggable && <div className="pt-2.5 cursor-grab active:cursor-grabbing text-[#48484A] hover:text-white transition-colors"><GripVertical size={20} /></div>}
          <div className="flex flex-col gap-1.5 items-center">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isAllDone ? 'bg-[#32D74B] text-black shadow-md' : 'bg-red-600/10 text-red-500'}`}>{isAllDone ? <Check size={18} strokeWidth={4} /> : <Activity size={18} />}</div>
            {isExpanded && <div className="flex gap-1.5"><button onClick={(e) => { e.stopPropagation(); onChange({ isSettingsOpen: !block.isSettingsOpen }); }} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${block.isSettingsOpen ? 'bg-[#32D74B] text-black shadow-md' : 'bg-[#32D74B]/10 text-[#32D74B]'}`}><Settings2 size={18} /></button><button onClick={(e) => { e.stopPropagation(); setNameEditTrigger(v => v + 1); }} className="w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-white/5 text-white border border-white/10"><Pencil size={16} /></button></div>}
          </div>
          <div className="flex-1 min-0 flex flex-col h-10 justify-end"><div className="flex items-baseline overflow-hidden pb-0.5"><SmartInput value={block.name} defaultValue="Новое упражнение" onClick={(e) => e.stopPropagation()} onChange={(e) => onChange({ name: e.target.value })} allowInlineEdit={false} editTrigger={nameEditTrigger} className="font-black text-white outline-none flex-1 min-w-0 bg-transparent truncate text-xl uppercase italic tracking-tighter" placeholder="Exercise Name" /></div></div>
        </div>
        <div className="w-6" />
      </div>

      {isExpanded && (
        <div className="p-3.5 pt-0 space-y-4">
          {block.isSettingsOpen && <div className="bg-black/40 rounded-[20px] p-3 space-y-3 border border-white/5"><div className="flex gap-2"><button onClick={() => openModal('Пауза', QUICK_TIME, block.rest || '60s', (v) => onChange({ rest: v }), false)} className="flex-1 py-2 rounded-xl text-[9px] font-black uppercase bg-black/30 text-orange-500 border border-orange-500/20">Rest: {block.rest || '60s'}</button><button onClick={() => openModal('Внимание', PREP_OPTIONS, block.prep || '5s', (v) => onChange({ prep: v }), false)} className="flex-1 py-2 rounded-xl text-[9px] font-black uppercase bg-black/30 text-red-500 border border-red-500/20">Prep: {block.prep || '5s'}</button></div><div className="flex items-center justify-between p-1 px-2"><span className="text-[9px] font-black uppercase text-[#8E8E93] italic tracking-widest">Steps:</span><div className="flex items-center gap-3"><button onClick={() => adjustStepsCount(-1)} className="w-8 h-8 bg-[#2C2C2E] rounded-lg flex items-center justify-center active:scale-90"><Minus size={14} /></button><span className="font-black text-white text-base w-5 text-center italic tabular-nums">{steps.length}</span><button onClick={() => adjustStepsCount(1)} className="w-8 h-8 bg-[#32D74B]/20 text-[#32D74B] rounded-lg flex items-center justify-center active:scale-90 border border-[#32D74B]/20"><Plus size={14} /></button></div></div></div>}
          <div className="overflow-x-auto no-scrollbar -mx-3 px-3"><div className="flex gap-4 min-w-max pb-2">{steps.map((step, sIdx) => { const isHighlighted = activeStepIdx === sIdx; const isDone = step.completed; const isFuture = sIdx > activeStepIdx && activeStepIdx !== -1; const isTime = step.type === 'time'; return <div key={step.id} className="flex flex-col gap-2.5 min-w-[120px]"><span className={`text-[9px] font-black uppercase text-center italic tracking-widest transition-colors ${!isSessionActive ? 'text-[#48484A]' : (isDone ? 'text-[#32D74B]' : (isHighlighted ? 'text-red-500' : 'text-[#48484A]'))}`}>{step.groupId ? `${step.groupId}` : `Step ${sIdx + 1}`}</span><div className="flex items-center gap-1.5 h-12"><SwipeableCell isSessionActive={isSessionActive} canSwipe={isTime} isDone={isDone} onSwipeRight={() => triggerTimer(step.value, 'work', step.name || block.name, () => toggleStepComplete(sIdx, { onRestComplete: goToNextStepOrExercise }), block.prep || '0s')} isHighlighted={isHighlighted}><div onClick={() => !isDone && openModal(step.type === 'reps' ? 'REPS' : 'TIME', step.type === 'reps' ? QUICK_REPS : QUICK_TIME, step.value, (v, weight) => { const next = [...steps]; next[sIdx] = { ...next[sIdx], value: v, weight: weight }; onChange({ steps: next }); }, true, step.weight || '0')} className={`h-full flex flex-col items-center justify-center cursor-pointer transition-colors ${isDone ? 'bg-[#32D74B]/10' : 'bg-black/30 border border-white/5'} ${isSessionActive && isFuture ? 'opacity-40' : 'opacity-100'}`}><span className={`font-black text-base tabular-nums italic transition-colors ${isDone ? 'text-[#32D74B]' : (isSessionActive && !isHighlighted ? 'text-white/40' : 'text-white')}`}>{step.value}</span>{parseFloat(step.weight || '0') > 0 && <span className="text-[7px] font-black mt-0.5 italic uppercase text-red-500">{step.weight} kg</span>}</div></SwipeableCell></div><button disabled={!isSessionActive || (isFuture && !isDone)} onClick={() => toggleStepComplete(sIdx, { onRestComplete: goToNextStepOrExercise })} className={`w-full h-11 rounded-[16px] flex items-center justify-center transition-all ${isDone ? 'bg-[#32D74B]/20 text-[#32D74B] ring-2 ring-[#32D74B] ring-inset opacity-100' : (isSessionActive && isHighlighted) ? 'bg-black/50 text-red-500 ring-2 ring-red-500 ring-inset opacity-100 active:scale-95' : 'bg-black/40 border border-white/10 text-white/20'} ${(!isSessionActive || (isFuture && !isDone)) ? 'cursor-not-allowed' : ''}`}>{isDone ? <Check size={26} className="stroke-[4px]" /> : (!isSessionActive || isFuture) ? <Lock size={16} className="opacity-40" /> : <Check size={26} className={isHighlighted ? 'opacity-100' : 'opacity-20'} />}</button></div>; })}</div></div>
          {isSessionActive && isFocusFullscreen && focusedStep && <div className="fixed inset-0 z-[220] bg-[#FF3B30] text-white flex flex-col items-center justify-center p-6"><button onClick={() => setIsFocusFullscreen(false)} className="absolute top-6 right-6 w-12 h-12 rounded-full bg-black/20 text-white/80 flex items-center justify-center active:scale-95"><X size={22} /></button><span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-2 italic">ФОКУС</span><div className="text-2xl font-black uppercase italic tracking-wide mb-2 text-center">{focusedStep.name || block.name}</div><div className="text-9xl font-black tabular-nums tracking-tighter leading-none italic mb-16">{focusedStep.value}</div><button onClick={handleFocusedStepAction} className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl active:scale-95 ${focusedStep.completed ? 'bg-[#32D74B]' : 'bg-black/30'}`}><Check size={40} className={focusedStep.completed ? 'text-black stroke-[3px]' : 'text-white'} /></button></div>}
        </div>
      )}
    </div>
  );
}

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App />);

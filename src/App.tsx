import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator,
  TrendingUp,
  Package,
  Truck,
  Percent,
  RotateCcw,
  Receipt,
  Banknote,
  ChevronDown,
  ChevronRight,
  Info,
  Share2,
  Download,
  Sun,
  Moon,
  AlertTriangle,
  RefreshCcw,
  HelpCircle,
  Send,
  Check,
} from "lucide-react";
import { toPng } from "html-to-image";
import "./App.css";

type Marketplace = "wb" | "ozon" | "ym";
type Scheme = "fbo" | "fbs" | "dbs";
type TaxRegime = "npd4" | "npd6" | "usn6" | "usn15" | "none";

interface CategoryPreset {
  label: string;
  rates: Record<Marketplace, number>;
}

const CATEGORIES: CategoryPreset[] = [
  { label: "Одежда и обувь", rates: { wb: 25, ozon: 16, ym: 10 } },
  { label: "Электроника", rates: { wb: 19, ozon: 10, ym: 6 } },
  { label: "Бытовая техника", rates: { wb: 18, ozon: 12, ym: 6 } },
  { label: "Красота и здоровье", rates: { wb: 19, ozon: 14, ym: 9 } },
  { label: "Дом, сад, дача", rates: { wb: 23, ozon: 13, ym: 7 } },
  { label: "Детские товары", rates: { wb: 22, ozon: 14, ym: 7 } },
  { label: "Игрушки", rates: { wb: 24, ozon: 14, ym: 8 } },
  { label: "Спорт и отдых", rates: { wb: 23, ozon: 14, ym: 8 } },
  { label: "Автотовары", rates: { wb: 17, ozon: 11, ym: 6 } },
  { label: "Продукты питания", rates: { wb: 15, ozon: 10, ym: 4 } },
  { label: "Книги, канцтовары", rates: { wb: 23, ozon: 15, ym: 9 } },
  { label: "Зоотовары", rates: { wb: 17, ozon: 11, ym: 6 } },
  { label: "Мебель", rates: { wb: 23, ozon: 15, ym: 7 } },
  { label: "Стройка и ремонт", rates: { wb: 19, ozon: 13, ym: 6 } },
  { label: "Прочее", rates: { wb: 20, ozon: 13, ym: 7 } },
];

const MARKETPLACE_NAMES: Record<Marketplace, string> = {
  wb: "Wildberries",
  ozon: "Ozon",
  ym: "Я.Маркет",
};

const SCHEME_NAMES: Record<Scheme, string> = {
  fbo: "FBO (со склада маркетплейса)",
  fbs: "FBS (со своего склада + доставка маркетплейсом)",
  dbs: "DBS / RealFBS (своя доставка)",
};

const TAX_NAMES: Record<TaxRegime, string> = {
  npd4: "Самозанятый 4% (физлица)",
  npd6: "Самозанятый 6% (юрлица)",
  usn6: "УСН 6% (доходы)",
  usn15: "УСН 15% (доходы−расходы)",
  none: "Без налога",
};

interface AppState {
  marketplace: Marketplace;
  scheme: Scheme;
  categoryIdx: number;
  costPrice: number;
  salePrice: number;
  batchQty: number;
  commissionPct: number;
  commissionLocked: boolean;
  logisticsPerUnit: number;
  packagingPerUnit: number;
  acquiringPct: number;
  storagePerDayBatch: number;
  storageDays: number;
  promoPct: number;
  returnRatePct: number;
  returnCostPerUnit: number;
  tax: TaxRegime;
  targetMargin: number;
}

const DEFAULT_STATE: AppState = {
  marketplace: "wb",
  scheme: "fbo",
  categoryIdx: 0,
  costPrice: 500,
  salePrice: 1500,
  batchQty: 50,
  commissionPct: CATEGORIES[0].rates.wb,
  commissionLocked: false,
  logisticsPerUnit: 60,
  packagingPerUnit: 20,
  acquiringPct: 0,
  storagePerDayBatch: 15,
  storageDays: 30,
  promoPct: 5,
  returnRatePct: 10,
  returnCostPerUnit: 80,
  tax: "usn6",
  targetMargin: 25,
};

const STORAGE_KEY = "mpcalc:v1:state";
const THEME_KEY = "mpcalc:v1:theme";

function rub(n: number): string {
  if (!isFinite(n)) return "—";
  const rounded = Math.round(n * 100) / 100;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(rounded);
}

function pct(n: number): string {
  if (!isFinite(n)) return "—";
  return `${(Math.round(n * 10) / 10).toFixed(1)}%`;
}

function encodeState(s: AppState): string {
  const p = new URLSearchParams();
  p.set("mp", s.marketplace);
  p.set("sc", s.scheme);
  p.set("c", String(s.categoryIdx));
  p.set("cp", String(s.costPrice));
  p.set("sp", String(s.salePrice));
  p.set("q", String(s.batchQty));
  p.set("co", String(s.commissionPct));
  p.set("cl", s.commissionLocked ? "1" : "0");
  p.set("lg", String(s.logisticsPerUnit));
  p.set("pk", String(s.packagingPerUnit));
  p.set("aq", String(s.acquiringPct));
  p.set("st", String(s.storagePerDayBatch));
  p.set("sd", String(s.storageDays));
  p.set("pr", String(s.promoPct));
  p.set("rr", String(s.returnRatePct));
  p.set("rc", String(s.returnCostPerUnit));
  p.set("tx", s.tax);
  p.set("tm", String(s.targetMargin));
  return p.toString();
}

function decodeStateFromUrl(): Partial<AppState> | null {
  if (typeof window === "undefined") return null;
  const search = window.location.search;
  if (!search || search.length < 2) return null;
  const p = new URLSearchParams(search);
  if (!p.has("mp") && !p.has("sp")) return null;
  const num = (k: string): number | undefined => {
    const v = p.get(k);
    if (v === null) return undefined;
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  };
  const out: Partial<AppState> = {};
  const mp = p.get("mp");
  if (mp === "wb" || mp === "ozon" || mp === "ym") out.marketplace = mp;
  const sc = p.get("sc");
  if (sc === "fbo" || sc === "fbs" || sc === "dbs") out.scheme = sc;
  const c = num("c");
  if (c !== undefined && c >= 0 && c < CATEGORIES.length) out.categoryIdx = Math.floor(c);
  const cp = num("cp");
  if (cp !== undefined) out.costPrice = cp;
  const sp = num("sp");
  if (sp !== undefined) out.salePrice = sp;
  const q = num("q");
  if (q !== undefined) out.batchQty = Math.max(1, Math.floor(q));
  const co = num("co");
  if (co !== undefined) out.commissionPct = co;
  out.commissionLocked = p.get("cl") === "1";
  const lg = num("lg");
  if (lg !== undefined) out.logisticsPerUnit = lg;
  const pk = num("pk");
  if (pk !== undefined) out.packagingPerUnit = pk;
  const aq = num("aq");
  if (aq !== undefined) out.acquiringPct = aq;
  const st = num("st");
  if (st !== undefined) out.storagePerDayBatch = st;
  const sd = num("sd");
  if (sd !== undefined) out.storageDays = Math.max(1, Math.floor(sd));
  const pr = num("pr");
  if (pr !== undefined) out.promoPct = pr;
  const rr = num("rr");
  if (rr !== undefined) out.returnRatePct = rr;
  const rc = num("rc");
  if (rc !== undefined) out.returnCostPerUnit = rc;
  const tx = p.get("tx");
  if (tx === "npd4" || tx === "npd6" || tx === "usn6" || tx === "usn15" || tx === "none")
    out.tax = tx;
  const tm = num("tm");
  if (tm !== undefined) out.targetMargin = Math.min(80, Math.max(0, Math.floor(tm)));
  return out;
}

function loadStateFromStorage(): Partial<AppState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Partial<AppState>;
    return null;
  } catch {
    return null;
  }
}

function mergeState(base: AppState, override: Partial<AppState> | null): AppState {
  if (!override) return base;
  return { ...base, ...override };
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  hint?: string;
  step?: number;
  min?: number;
  max?: number;
}

function NumberField({ label, value, onChange, suffix, hint, step, min, max }: NumberFieldProps) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {hint && (
          <span className="group relative">
            <Info className="inline h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
            <span className="pointer-events-none absolute left-1/2 z-20 mt-1 hidden w-56 -translate-x-1/2 rounded-md bg-zinc-900 px-2 py-1.5 text-xs font-normal text-white shadow-lg group-hover:block dark:bg-zinc-800 dark:ring-1 dark:ring-zinc-700">
              {hint}
            </span>
          </span>
        )}
      </span>
      <div className="relative mt-1">
        <input
          type="number"
          inputMode="decimal"
          step={step ?? "any"}
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") {
              onChange(0);
              return;
            }
            const n = parseFloat(v);
            if (!isNaN(n)) onChange(n);
          }}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 pr-12 text-sm tabular-nums text-zinc-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-indigo-400 dark:focus:ring-indigo-900/40"
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-400 dark:text-zinc-500">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, icon, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl px-5 py-4 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
            {icon}
          </span>
          <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</span>
        </span>
        {open ? (
          <ChevronDown className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
        ) : (
          <ChevronRight className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
        )}
      </button>
      {open && (
        <div className="border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">{children}</div>
      )}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "border-indigo-600 bg-indigo-600 text-white shadow-sm dark:border-indigo-500 dark:bg-indigo-500"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

interface IconButtonProps {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}

function IconButton({ onClick, title, children }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "Чем этот калькулятор отличается от Excel-таблицы?",
    a: "Считает 8 видов затрат (комиссия, эквайринг, логистика, упаковка, хранение, реклама, возвраты, налог), три налоговых режима и сразу показывает безубыточную цену и рекомендуемую цену под целевую маржу. Excel это тоже умеет — но здесь не нужно поддерживать формулы, всё уже зашито.",
  },
  {
    q: "Откуда берутся комиссии по категориям?",
    a: "Это ориентировочные средние значения по публичным тарифам маркетплейсов на момент сборки. Реальная комиссия зависит от подкатегории, выбранной схемы (FBO/FBS/DBS), акций и регулярно меняется — всегда сверяй с личным кабинетом селлера.",
  },
  {
    q: "Что такое FBO, FBS и DBS?",
    a: "FBO — товар лежит на складе маркетплейса, маркетплейс собирает и доставляет. FBS — товар у тебя, маркетплейс только доставляет. DBS / RealFBS — товар у тебя и ты сам доставляешь (для габаритных или скоропортящихся товаров). Влияет на тарифы логистики и хранения.",
  },
  {
    q: "Что выбрать: НПД (самозанятый), УСН 6% или УСН 15%?",
    a: "Самозанятый: только для физлиц-продавцов, лимит 2.4 млн ₽/год, без сотрудников и перепродажи чужого товара. УСН 6% — налог с выручки, удобно при высокой марже. УСН 15% — налог с прибыли, удобно при низкой марже и больших расходах. УСН 15% выгоднее, когда расходы > ~60% выручки.",
  },
  {
    q: "А постоянные расходы (зарплата, аренда офиса)?",
    a: "Калькулятор считает только переменные затраты на единицу. Постоянные расходы (зарплата, аренда, бухгалтерия) дели на ожидаемое количество продаж в месяц и прибавляй к «упаковке за единицу» — это самый простой способ их учесть.",
  },
  {
    q: "Можно ли сохранить расчёт или поделиться им?",
    a: "Да. Кнопка «поделиться» в шапке копирует ссылку со всеми твоими цифрами — открыв её, человек увидит ровно тот же расчёт. Текущий расчёт также сохраняется локально (в браузере) и подгружается при следующем заходе.",
  },
  {
    q: "Куда уходят мои данные?",
    a: "Никуда. Калькулятор — статический сайт без бэкенда. Все цифры считаются прямо у тебя в браузере и хранятся только в твоём localStorage. На сервере у нас твоих данных нет — даже если бы захотели, технически некуда.",
  },
];

function Faq() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Частые вопросы
        </h2>
      </div>
      <div className="space-y-2">
        {FAQ_ITEMS.map((item, i) => {
          const open = openIdx === i;
          return (
            <div
              key={item.q}
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <button
                type="button"
                onClick={() => setOpenIdx(open ? null : i)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800/60"
              >
                <span>{item.q}</span>
                {open ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
                )}
              </button>
              {open && (
                <div className="border-t border-zinc-100 px-4 py-3 text-sm leading-relaxed text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function App() {
  const initial = useMemo(() => {
    const fromUrl = decodeStateFromUrl();
    if (fromUrl) return mergeState(DEFAULT_STATE, fromUrl);
    const fromStorage = loadStateFromStorage();
    return mergeState(DEFAULT_STATE, fromStorage);
  }, []);

  const [marketplace, setMarketplace] = useState<Marketplace>(initial.marketplace);
  const [scheme, setScheme] = useState<Scheme>(initial.scheme);
  const [categoryIdx, setCategoryIdx] = useState(initial.categoryIdx);
  const [costPrice, setCostPrice] = useState(initial.costPrice);
  const [salePrice, setSalePrice] = useState(initial.salePrice);
  const [batchQty, setBatchQty] = useState(initial.batchQty);
  const [commissionPct, setCommissionPct] = useState(initial.commissionPct);
  const [commissionLocked, setCommissionLocked] = useState(initial.commissionLocked);
  const [logisticsPerUnit, setLogisticsPerUnit] = useState(initial.logisticsPerUnit);
  const [packagingPerUnit, setPackagingPerUnit] = useState(initial.packagingPerUnit);
  const [acquiringPct, setAcquiringPct] = useState(initial.acquiringPct);
  const [storagePerDayBatch, setStoragePerDayBatch] = useState(initial.storagePerDayBatch);
  const [storageDays, setStorageDays] = useState(initial.storageDays);
  const [promoPct, setPromoPct] = useState(initial.promoPct);
  const [returnRatePct, setReturnRatePct] = useState(initial.returnRatePct);
  const [returnCostPerUnit, setReturnCostPerUnit] = useState(initial.returnCostPerUnit);
  const [tax, setTax] = useState<TaxRegime>(initial.tax);
  const [targetMargin, setTargetMargin] = useState(initial.targetMargin);

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const resultsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(THEME_KEY) : null;
    const initialTheme: "light" | "dark" =
      stored === "dark" || stored === "light"
        ? stored
        : typeof window !== "undefined" &&
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const currentState: AppState = useMemo(
    () => ({
      marketplace,
      scheme,
      categoryIdx,
      costPrice,
      salePrice,
      batchQty,
      commissionPct,
      commissionLocked,
      logisticsPerUnit,
      packagingPerUnit,
      acquiringPct,
      storagePerDayBatch,
      storageDays,
      promoPct,
      returnRatePct,
      returnCostPerUnit,
      tax,
      targetMargin,
    }),
    [
      marketplace,
      scheme,
      categoryIdx,
      costPrice,
      salePrice,
      batchQty,
      commissionPct,
      commissionLocked,
      logisticsPerUnit,
      packagingPerUnit,
      acquiringPct,
      storagePerDayBatch,
      storageDays,
      promoPct,
      returnRatePct,
      returnCostPerUnit,
      tax,
      targetMargin,
    ],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
    } catch {
      // ignore quota / private mode failures
    }
  }, [currentState]);

  const handleSetMarketplace = (m: Marketplace) => {
    setMarketplace(m);
    if (!commissionLocked) {
      setCommissionPct(CATEGORIES[categoryIdx].rates[m]);
    }
  };

  const handleSetCategory = (idx: number) => {
    setCategoryIdx(idx);
    if (!commissionLocked) {
      setCommissionPct(CATEGORIES[idx].rates[marketplace]);
    }
  };

  const handleSetCommission = (v: number) => {
    setCommissionPct(v);
    setCommissionLocked(true);
  };

  const handleReset = () => {
    setMarketplace(DEFAULT_STATE.marketplace);
    setScheme(DEFAULT_STATE.scheme);
    setCategoryIdx(DEFAULT_STATE.categoryIdx);
    setCostPrice(DEFAULT_STATE.costPrice);
    setSalePrice(DEFAULT_STATE.salePrice);
    setBatchQty(DEFAULT_STATE.batchQty);
    setCommissionPct(DEFAULT_STATE.commissionPct);
    setCommissionLocked(DEFAULT_STATE.commissionLocked);
    setLogisticsPerUnit(DEFAULT_STATE.logisticsPerUnit);
    setPackagingPerUnit(DEFAULT_STATE.packagingPerUnit);
    setAcquiringPct(DEFAULT_STATE.acquiringPct);
    setStoragePerDayBatch(DEFAULT_STATE.storagePerDayBatch);
    setStorageDays(DEFAULT_STATE.storageDays);
    setPromoPct(DEFAULT_STATE.promoPct);
    setReturnRatePct(DEFAULT_STATE.returnRatePct);
    setReturnCostPerUnit(DEFAULT_STATE.returnCostPerUnit);
    setTax(DEFAULT_STATE.tax);
    setTargetMargin(DEFAULT_STATE.targetMargin);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      const url = new URL(window.location.href);
      url.search = "";
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const qs = encodeState(currentState);
    const url = `${window.location.origin}${window.location.pathname}?${qs}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Скопируй ссылку:", url);
    }
    const next = new URL(window.location.href);
    next.search = qs;
    window.history.replaceState({}, "", next.toString());
  };

  const handleExportPng = async () => {
    if (!resultsRef.current) return;
    setExporting(true);
    setExportError(null);
    try {
      const dataUrl = await toPng(resultsRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: theme === "dark" ? "#09090b" : "#ffffff",
      });
      const link = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      link.download = `unit-econ-${ts}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Не удалось скачать PNG");
    } finally {
      setExporting(false);
    }
  };

  const calc = useMemo(() => {
    const safeBatch = Math.max(1, batchQty);
    const grossRevenuePerUnit = salePrice;

    const commissionFee = (grossRevenuePerUnit * commissionPct) / 100;
    const acquiringFee = (grossRevenuePerUnit * acquiringPct) / 100;
    const promoFee = (grossRevenuePerUnit * promoPct) / 100;

    const storagePerUnit = (storagePerDayBatch * storageDays) / safeBatch;
    const returnLossPerUnit = (returnRatePct / 100) * returnCostPerUnit;

    const totalCostsPerUnit =
      costPrice +
      logisticsPerUnit +
      packagingPerUnit +
      commissionFee +
      acquiringFee +
      promoFee +
      storagePerUnit +
      returnLossPerUnit;

    const profitBeforeTax = grossRevenuePerUnit - totalCostsPerUnit;

    let taxAmount = 0;
    switch (tax) {
      case "npd4":
        taxAmount = grossRevenuePerUnit * 0.04;
        break;
      case "npd6":
        taxAmount = grossRevenuePerUnit * 0.06;
        break;
      case "usn6":
        taxAmount = grossRevenuePerUnit * 0.06;
        break;
      case "usn15":
        taxAmount = Math.max(0, profitBeforeTax) * 0.15;
        break;
      case "none":
        taxAmount = 0;
        break;
    }

    const netProfit = profitBeforeTax - taxAmount;
    const marginPct = grossRevenuePerUnit > 0 ? (netProfit / grossRevenuePerUnit) * 100 : 0;
    const roiPct = costPrice > 0 ? (netProfit / costPrice) * 100 : NaN;

    const fixedPerUnit =
      costPrice + logisticsPerUnit + packagingPerUnit + storagePerUnit + returnLossPerUnit;
    const variableRevenueRate = (commissionPct + acquiringPct + promoPct) / 100;
    let breakEvenPrice = NaN;
    if (tax === "usn15") {
      const denom = 1 - variableRevenueRate;
      if (denom > 0) breakEvenPrice = fixedPerUnit / denom;
    } else {
      const taxRevenueRate =
        tax === "npd4" ? 0.04 : tax === "npd6" ? 0.06 : tax === "usn6" ? 0.06 : 0;
      const denom = 1 - variableRevenueRate - taxRevenueRate;
      if (denom > 0) breakEvenPrice = fixedPerUnit / denom;
    }

    const batchProfit = netProfit * safeBatch;
    const batchRevenue = grossRevenuePerUnit * safeBatch;
    const batchCost = costPrice * safeBatch;

    return {
      grossRevenuePerUnit,
      commissionFee,
      acquiringFee,
      promoFee,
      storagePerUnit,
      returnLossPerUnit,
      totalCostsPerUnit,
      profitBeforeTax,
      taxAmount,
      netProfit,
      marginPct,
      roiPct,
      breakEvenPrice,
      batchProfit,
      batchRevenue,
      batchCost,
    };
  }, [
    salePrice,
    costPrice,
    batchQty,
    commissionPct,
    acquiringPct,
    promoPct,
    logisticsPerUnit,
    packagingPerUnit,
    storagePerDayBatch,
    storageDays,
    returnRatePct,
    returnCostPerUnit,
    tax,
  ]);

  const suggestedPrice = useMemo(() => {
    const safeBatch = Math.max(1, batchQty);
    const storagePerUnit = (storagePerDayBatch * storageDays) / safeBatch;
    const returnLossPerUnit = (returnRatePct / 100) * returnCostPerUnit;
    const fixedPerUnit =
      costPrice + logisticsPerUnit + packagingPerUnit + storagePerUnit + returnLossPerUnit;
    const variableRevenueRate = (commissionPct + acquiringPct + promoPct) / 100;
    const target = targetMargin / 100;

    if (tax === "usn15") {
      const denom = 0.85 * (1 - variableRevenueRate) - target;
      if (denom > 0) return (0.85 * fixedPerUnit) / denom;
      return NaN;
    } else {
      const taxRevenueRate =
        tax === "npd4" ? 0.04 : tax === "npd6" ? 0.06 : tax === "usn6" ? 0.06 : 0;
      const denom = 1 - variableRevenueRate - taxRevenueRate - target;
      if (denom > 0) return fixedPerUnit / denom;
      return NaN;
    }
  }, [
    targetMargin,
    costPrice,
    batchQty,
    commissionPct,
    acquiringPct,
    promoPct,
    logisticsPerUnit,
    packagingPerUnit,
    storagePerDayBatch,
    storageDays,
    returnRatePct,
    returnCostPerUnit,
    tax,
  ]);

  const breakdown = [
    { label: "Закупка", value: costPrice, color: "bg-zinc-400 dark:bg-zinc-500" },
    {
      label: "Комиссия маркетплейса",
      value: calc.commissionFee,
      color: "bg-indigo-500 dark:bg-indigo-400",
    },
    { label: "Логистика", value: logisticsPerUnit, color: "bg-sky-500 dark:bg-sky-400" },
    { label: "Упаковка", value: packagingPerUnit, color: "bg-teal-500 dark:bg-teal-400" },
    { label: "Хранение", value: calc.storagePerUnit, color: "bg-amber-500 dark:bg-amber-400" },
    {
      label: "Реклама / продвижение",
      value: calc.promoFee,
      color: "bg-pink-500 dark:bg-pink-400",
    },
    { label: "Эквайринг", value: calc.acquiringFee, color: "bg-orange-500 dark:bg-orange-400" },
    {
      label: "Потери на возвратах",
      value: calc.returnLossPerUnit,
      color: "bg-rose-500 dark:bg-rose-400",
    },
    { label: "Налог", value: calc.taxAmount, color: "bg-violet-500 dark:bg-violet-400" },
  ].filter((x) => x.value > 0);

  const totalForBars = Math.max(calc.grossRevenuePerUnit, 1);
  const profitPositive = calc.netProfit >= 0;
  const suggestedReachable = isFinite(suggestedPrice);

  const negativeMargin = calc.netProfit < 0;
  const lowMargin = !negativeMargin && calc.marginPct > 0 && calc.marginPct < 8;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 pb-32 text-zinc-900 transition-colors dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-100 sm:pb-0">
      <header className="border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
            <Calculator className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold leading-tight sm:text-xl">
              Калькулятор юнит-экономики
            </h1>
            <p className="hidden text-xs text-zinc-500 dark:text-zinc-400 sm:block sm:text-sm">
              Wildberries · Ozon · Я.Маркет — реальная прибыль с одной продажи
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <IconButton
              onClick={handleShare}
              title={copied ? "Ссылка скопирована" : "Поделиться (скопировать ссылку с расчётом)"}
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
            </IconButton>
            <IconButton onClick={handleExportPng} title="Скачать PNG со сводкой">
              <Download className={`h-4 w-4 ${exporting ? "animate-pulse" : ""}`} />
            </IconButton>
            <IconButton onClick={handleReset} title="Сбросить все значения к дефолтам">
              <RefreshCcw className="h-4 w-4" />
            </IconButton>
            <IconButton
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </IconButton>
          </div>
        </div>
      </header>

      {exportError && (
        <div className="mx-auto mt-3 max-w-6xl px-4 sm:px-6">
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            {exportError}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {negativeMargin && (
          <div
            className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
            <div className="min-w-0">
              <div className="font-semibold">Сделка в убыток</div>
              <div className="mt-0.5 text-xs text-rose-800/90 dark:text-rose-100/90">
                При текущих параметрах с каждой проданной единицы ты теряешь {rub(-calc.netProfit)}.
                Минимальная цена, чтобы выйти в ноль — {rub(calc.breakEvenPrice)}.
              </div>
            </div>
          </div>
        )}

        {lowMargin && !negativeMargin && (
          <div
            className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
            <div className="min-w-0">
              <div className="font-semibold">Маржа меньше 8%</div>
              <div className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-100/90">
                Любая просадка цены, рост комиссии или возвратов уведут в минус. Заложи запас или
                подними цену хотя бы до {rub(calc.breakEvenPrice * 1.12)}.
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-3">
            <Section title="Маркетплейс и категория" icon={<Package className="h-4 w-4" />}>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Маркетплейс
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(MARKETPLACE_NAMES) as Marketplace[]).map((m) => (
                      <Pill
                        key={m}
                        active={marketplace === m}
                        onClick={() => handleSetMarketplace(m)}
                      >
                        {MARKETPLACE_NAMES[m]}
                      </Pill>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Схема работы
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(SCHEME_NAMES) as Scheme[]).map((s) => (
                      <Pill key={s} active={scheme === s} onClick={() => setScheme(s)}>
                        {s.toUpperCase()}
                      </Pill>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {SCHEME_NAMES[scheme]}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Категория товара
                  </label>
                  <select
                    value={categoryIdx}
                    onChange={(e) => handleSetCategory(parseInt(e.target.value, 10))}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-900/40"
                  >
                    {CATEGORIES.map((c, i) => (
                      <option key={c.label} value={i}>
                        {c.label} (≈{c.rates[marketplace]}% на {MARKETPLACE_NAMES[marketplace]})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Подставляет ориентировочную комиссию. Реальная зависит от подкатегории, тарифа
                    и меняется маркетплейсом — проверь в личном кабинете.
                  </p>
                </div>
              </div>
            </Section>

            <Section title="Цена и партия" icon={<TrendingUp className="h-4 w-4" />}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <NumberField
                  label="Закупочная цена"
                  value={costPrice}
                  onChange={setCostPrice}
                  suffix="₽"
                  hint="Сколько ты платишь за единицу товара поставщику (с учётом доставки до тебя)."
                />
                <NumberField
                  label="Розничная цена"
                  value={salePrice}
                  onChange={setSalePrice}
                  suffix="₽"
                  hint="По какой цене ты планируешь продавать на маркетплейсе (та цена, которую видит покупатель)."
                />
                <NumberField
                  label="Партия"
                  value={batchQty}
                  onChange={setBatchQty}
                  suffix="шт"
                  hint="Сколько единиц в одной закупке. Влияет на стоимость хранения на единицу."
                  min={1}
                />
              </div>
            </Section>

            <Section title="Комиссии маркетплейса" icon={<Percent className="h-4 w-4" />}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NumberField
                  label="Комиссия маркетплейса"
                  value={commissionPct}
                  onChange={handleSetCommission}
                  suffix="%"
                  hint="Процент с выручки, который забирает себе маркетплейс. Подставляется по категории, но можно переопределить."
                  step={0.1}
                />
                <NumberField
                  label="Эквайринг (если отдельно)"
                  value={acquiringPct}
                  onChange={setAcquiringPct}
                  suffix="%"
                  hint="Обычно уже включён в комиссию WB/Ozon/ЯМ. Поставь 0, если не уверен."
                  step={0.1}
                />
              </div>
              {commissionLocked && (
                <button
                  type="button"
                  onClick={() => {
                    setCommissionLocked(false);
                    setCommissionPct(CATEGORIES[categoryIdx].rates[marketplace]);
                  }}
                  className="mt-3 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300"
                >
                  ← вернуть комиссию по категории
                </button>
              )}
            </Section>

            <Section title="Логистика и упаковка" icon={<Truck className="h-4 w-4" />}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NumberField
                  label="Логистика за единицу"
                  value={logisticsPerUnit}
                  onChange={setLogisticsPerUnit}
                  suffix="₽"
                  hint="Тариф маркетплейса за доставку единицы товара (зависит от габаритов и тарифа склада)."
                />
                <NumberField
                  label="Упаковка за единицу"
                  value={packagingPerUnit}
                  onChange={setPackagingPerUnit}
                  suffix="₽"
                  hint="Пакеты, коробки, плёнка, маркировка и т.д. в пересчёте на одну единицу."
                />
                <NumberField
                  label="Хранение за день (вся партия)"
                  value={storagePerDayBatch}
                  onChange={setStoragePerDayBatch}
                  suffix="₽/день"
                  hint="Сколько маркетплейс берёт за хранение партии в сутки (для FBO). Для FBS можно поставить 0 и учесть свой склад в упаковке."
                />
                <NumberField
                  label="Срок хранения"
                  value={storageDays}
                  onChange={setStorageDays}
                  suffix="дней"
                  hint="За сколько дней в среднем продастся вся партия."
                  min={1}
                />
              </div>
            </Section>

            <Section title="Реклама и возвраты" icon={<RotateCcw className="h-4 w-4" />}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NumberField
                  label="Реклама/продвижение"
                  value={promoPct}
                  onChange={setPromoPct}
                  suffix="%"
                  hint="Сколько процентов от выручки уходит на рекламу внутри маркетплейса (АРК, трафареты, продвижение карточки)."
                  step={0.5}
                />
                <NumberField
                  label="Доля возвратов"
                  value={returnRatePct}
                  onChange={setReturnRatePct}
                  suffix="%"
                  hint="Какой процент заказов возвращают. Одежда/обувь ~30–50%, электроника ~5–10%, FMCG ~1–3%."
                  step={0.5}
                />
                <NumberField
                  label="Стоимость обработки возврата"
                  value={returnCostPerUnit}
                  onChange={setReturnCostPerUnit}
                  suffix="₽"
                  hint="Сколько в среднем теряешь на одном возврате: обратная логистика, повреждённый товар, переупаковка."
                />
              </div>
            </Section>

            <Section title="Налоги" icon={<Receipt className="h-4 w-4" />}>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Налоговый режим
                </label>
                <select
                  value={tax}
                  onChange={(e) => setTax(e.target.value as TaxRegime)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-900/40"
                >
                  {(Object.keys(TAX_NAMES) as TaxRegime[]).map((t) => (
                    <option key={t} value={t}>
                      {TAX_NAMES[t]}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  УСН 6% и НПД считают налог с выручки (всей суммы продажи). УСН 15% — с прибыли
                  (доходы минус расходы).
                </p>
              </div>
            </Section>
          </div>

          <div className="space-y-5 lg:col-span-2">
            <div className="space-y-5 lg:sticky lg:top-4" ref={resultsRef}>
              <div
                className={`rounded-2xl border p-5 shadow-sm transition-colors ${
                  profitPositive
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40"
                    : "border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Чистая прибыль с 1 шт
                    </div>
                    <div
                      className={`mt-1 text-3xl font-bold tabular-nums sm:text-4xl ${
                        profitPositive
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-rose-700 dark:text-rose-300"
                      }`}
                    >
                      {rub(calc.netProfit)}
                    </div>
                  </div>
                  <Banknote
                    className={`h-9 w-9 ${
                      profitPositive
                        ? "text-emerald-500 dark:text-emerald-400"
                        : "text-rose-400 dark:text-rose-400"
                    }`}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/70 px-3 py-2 dark:bg-zinc-900/60">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">Маржа</div>
                    <div className="text-base font-semibold tabular-nums">
                      {pct(calc.marginPct)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2 dark:bg-zinc-900/60">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">ROI</div>
                    <div className="text-base font-semibold tabular-nums">
                      {isFinite(calc.roiPct) ? pct(calc.roiPct) : "—"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2 dark:bg-zinc-900/60">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">С партии</div>
                    <div className="text-base font-semibold tabular-nums">
                      {rub(calc.batchProfit)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2 dark:bg-zinc-900/60">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      Безубыточная цена
                    </div>
                    <div className="text-base font-semibold tabular-nums">
                      {rub(calc.breakEvenPrice)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  На что уходит {rub(calc.grossRevenuePerUnit)}
                </div>
                <div className="space-y-2">
                  {breakdown.map((b) => {
                    const w = Math.min(100, (b.value / totalForBars) * 100);
                    return (
                      <div key={b.label}>
                        <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                          <span>{b.label}</span>
                          <span className="tabular-nums">
                            {rub(b.value)} ({pct((b.value / totalForBars) * 100)})
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div className={`h-full ${b.color}`} style={{ width: `${w}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="border-t border-zinc-100 pt-2 dark:border-zinc-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                        Чистая прибыль
                      </span>
                      <span
                        className={`font-semibold tabular-nums ${
                          profitPositive
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {rub(calc.netProfit)} ({pct((calc.netProfit / totalForBars) * 100)})
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className={
                          profitPositive
                            ? "h-full bg-emerald-500 dark:bg-emerald-400"
                            : "h-full bg-rose-500 dark:bg-rose-400"
                        }
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, (calc.netProfit / totalForBars) * 100),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  Какую цену поставить?
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Чтобы получать целевую маржу, продавай не дешевле этой цены.
                </p>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400">Целевая маржа</span>
                    <span className="font-semibold tabular-nums">{targetMargin}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    step={1}
                    value={targetMargin}
                    onChange={(e) => setTargetMargin(parseInt(e.target.value, 10))}
                    className="mt-1 w-full accent-indigo-600 dark:accent-indigo-400"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
                    <span>0%</span>
                    <span>40%</span>
                    <span>80%</span>
                  </div>
                </div>
                <div
                  className={`mt-3 rounded-xl px-4 py-3 ${
                    suggestedReachable
                      ? "bg-indigo-50 dark:bg-indigo-950/40"
                      : "bg-amber-50 dark:bg-amber-950/40"
                  }`}
                >
                  <div
                    className={`text-xs ${
                      suggestedReachable
                        ? "text-indigo-700 dark:text-indigo-200"
                        : "text-amber-800 dark:text-amber-200"
                    }`}
                  >
                    {suggestedReachable
                      ? "Рекомендуемая розничная цена"
                      : "Целевая маржа недостижима"}
                  </div>
                  <div
                    className={`mt-0.5 text-2xl font-bold tabular-nums ${
                      suggestedReachable
                        ? "text-indigo-900 dark:text-indigo-100"
                        : "text-amber-900 dark:text-amber-100"
                    }`}
                  >
                    {suggestedReachable ? rub(suggestedPrice) : "Недостижимо"}
                  </div>
                  {!suggestedReachable && (
                    <div className="mt-1 text-xs text-amber-700/90 dark:text-amber-200/80">
                      Сумма комиссии, налога и желаемой маржи &ge; 100% выручки. Снизь целевую
                      маржу, комиссию или переходи на УСН 15%.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <div className="mb-1 font-semibold text-zinc-600 dark:text-zinc-300">
                  Дисклеймер
                </div>
                Тарифы и комиссии маркетплейсов регулярно меняются — пресеты по категориям
                ориентировочные. Для точного расчёта подставляй актуальные значения из личного
                кабинета селлера. Калькулятор считает юнит-экономику без учёта постоянных расходов
                (зарплата, аренда и т.д.).
              </div>
            </div>
          </div>
        </div>

        <Faq />
      </main>

      <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-center text-xs text-zinc-500 dark:text-zinc-400 sm:flex-row sm:px-6 sm:text-left">
          <div>
            Калькулятор юнит-экономики · цифры считаются локально в браузере, ничего не отправляется
            на сервер
          </div>
          <a
            href="https://t.me/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 font-medium text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
          >
            <Send className="h-3.5 w-3.5" />
            Обратная связь
          </a>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_-4px_24px_-12px_rgba(0,0,0,0.15)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Чистая прибыль с 1 шт
            </div>
            <div
              className={`text-lg font-bold tabular-nums ${
                profitPositive
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-rose-700 dark:text-rose-300"
              }`}
            >
              {rub(calc.netProfit)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Маржа · ROI
            </div>
            <div className="text-sm font-semibold tabular-nums">
              {pct(calc.marginPct)} · {isFinite(calc.roiPct) ? pct(calc.roiPct) : "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

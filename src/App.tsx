// src/App.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

/* ===== Palette (STRICT) =====
   #8DBCC7
   #A4CCD9
   #C4E1E6
   #EBFFD8
*/
const PALETTE = {
  p1: "#8DBCC7",
  p2: "#A4CCD9",
  p3: "#C4E1E6",
  p4: "#EBFFD8",
};
const CHART_COLORS = ["#8DBCC7", "#A4CCD9", "#C4E1E6", "#EBFFD8", "#B87C4C"];

/* --- Category icons --- */
const CATEGORY_META = {
  "Food & Drink": { icon: "🍔" },
  Shopping: { icon: "🛍️" },
  Transportation: { icon: "🚌" },
  Bills: { icon: "💡" },
  Entertainment: { icon: "🎬" },
  Other: { icon: "📦" },
};

/* --- Utilities --- */
const formatCurrency = (n) =>
  typeof n === "number"
    ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : n;

function monthKey(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return "Unknown";
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

/* animated number hook */
function useAnimatedNumber(value, duration = 700) {
  const [display, setDisplay] = useState(value || 0);
  const ref = useRef();

  useEffect(() => {
    const start = performance.now();
    const from = Number(display) || 0;
    const to = Number(value) || 0;
    cancelAnimationFrame(ref.current);

    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = from + (to - from) * eased;
      setDisplay(cur);
      if (t < 1) ref.current = requestAnimationFrame(step);
    }
    ref.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}

/* --- Export helpers (JSON/CSV/Excel/PDF) --- */
// CSV simple
function downloadCSV(records) {
  if (!records.length) {
    alert("No records to export.");
    return;
  }
  const headers = ["id", "reason", "amount", "date", "category"];
  const rows = records.map((r) =>
    headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `expenses_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// JSON
function downloadJSON(records) {
  const blob = new Blob([JSON.stringify(records, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `expenses_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Excel (.xlsx) using xlsx + file-saver (installed in instructions)
async function downloadExcel(records) {
  try {
    const XLSX = await import("xlsx");
    const { saveAs } = await import("file-saver");
    const headers = ["id", "reason", "amount", "date", "category"];
    const wsData = [
      headers,
      ...records.map((r) => headers.map((h) => r[h] ?? "")),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([wbout], { type: "application/octet-stream" }),
      `expenses_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  } catch (err) {
    console.error(err);
    alert("Please install xlsx and file-saver (see README).");
  }
}

// PDF using jspdf + autotable
async function downloadPDF(records, summary = {}) {
  try {
    const jsPDF = (await import("jspdf")).default;
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("FinTrack - Monthly Expense Report", 14, 18);
    doc.setFontSize(11);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 26);
    if (summary.title) {
      doc.setFontSize(12);
      doc.text(summary.title, 14, 34);
    }

    // table
    const headers = [["Reason", "Category", "Date", "Amount"]];
    const rows = records.map((r) => [
      r.reason,
      r.category,
      r.date,
      `₹${formatCurrency(r.amount)}`,
    ]);
    autoTable(doc, { startY: 42, head: headers, body: rows, theme: "grid" });

    // totals
    const finalY = doc.previousAutoTable
      ? doc.previousAutoTable.finalY + 8
      : 42 + rows.length * 8;
    doc.setFontSize(12);
    doc.text(
      `Total: ₹${formatCurrency(records.reduce((a, b) => a + b.amount, 0))}`,
      14,
      finalY
    );

    doc.save(`report_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (err) {
    console.error(err);
    alert("Please install jspdf and jspdf-autotable (see README).");
  }
}

export default function App() {
  // state + persistence
  const [expenses, setExpenses] = useState(() => {
    try {
      const raw = localStorage.getItem("ft_expenses_v2");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("Food & Drink");
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("ft_theme_v2") || "dark"
  );

  // controls
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [budget, setBudget] = useState(() =>
    Number(localStorage.getItem("ft_budget_v2") || 0)
  );
  const [reminderEnabled, setReminderEnabled] = useState(
    () => localStorage.getItem("ft_reminder_v2") === "true"
  );

  // persist on change
  useEffect(
    () => localStorage.setItem("ft_expenses_v2", JSON.stringify(expenses)),
    [expenses]
  );
  useEffect(() => localStorage.setItem("ft_theme_v2", theme), [theme]);
  useEffect(
    () => localStorage.setItem("ft_budget_v2", String(budget)),
    [budget]
  );
  useEffect(
    () => localStorage.setItem("ft_reminder_v2", String(reminderEnabled)),
    [reminderEnabled]
  );

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.remove("light");
    else document.documentElement.classList.add("light");
  }, [theme]);

  const addExpense = (e) => {
    e?.preventDefault?.();
    if (!reason || !amount || !date) {
      alert("Please fill reason, amount and date");
      return;
    }
    const newExpense = {
      id: Date.now(),
      reason,
      amount: parseFloat(amount),
      date,
      category,
    };
    setExpenses((s) => [...s, newExpense]);
    setReason("");
    setAmount("");
    setDate("");
    setCategory("Food & Drink");
    setIsOpen(false);
  };

  // delete
  const deleteExpense = (id) => {
    if (!confirm("Delete this expense?")) return;
    setExpenses((s) => s.filter((e) => e.id !== id));
  };

  // import JSON file
  const handleImportJSON = (file) => {
    const fr = new FileReader();
    fr.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error("Invalid format");
        // basic validation: ensure objects have required fields
        const cleaned = data.map((r) => ({
          id: r.id || Date.now() + Math.floor(Math.random() * 1000),
          reason: r.reason || "Imported",
          amount: Number(r.amount) || 0,
          date: r.date || new Date().toISOString().slice(0, 10),
          category: r.category || "Other",
        }));
        setExpenses((s) => [...s, ...cleaned]);
        alert("Imported successfully");
      } catch (err) {
        alert("Invalid JSON file.");
      }
    };
    fr.readAsText(file);
  };

  // filtered + sorted
  const filtered = useMemo(() => {
    let list = [...expenses];
    if (filterCategory !== "All")
      list = list.filter((x) => x.category === filterCategory);
    if (filterFrom)
      list = list.filter((x) => new Date(x.date) >= new Date(filterFrom));
    if (filterTo)
      list = list.filter((x) => new Date(x.date) <= new Date(filterTo));
    if (sortBy === "newest") list.sort((a, b) => b.id - a.id);
    if (sortBy === "oldest") list.sort((a, b) => a.id - b.id);
    if (sortBy === "high") list.sort((a, b) => b.amount - a.amount);
    if (sortBy === "low") list.sort((a, b) => a.amount - b.amount);
    return list;
  }, [expenses, filterCategory, filterFrom, filterTo, sortBy]);

  const total = useMemo(
    () => expenses.reduce((acc, e) => acc + e.amount, 0),
    [expenses]
  );
  const animatedTotal = useAnimatedNumber(total, 800);

  const categoryTotals = useMemo(
    () =>
      expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
      }, {}),
    [expenses]
  );
  const pieData = useMemo(
    () =>
      Object.entries(categoryTotals).map(([k, v]) => ({ name: k, value: v })),
    [categoryTotals]
  );

  const monthlyTotals = useMemo(() => {
    const map = {};
    for (const e of expenses) {
      const mk = monthKey(e.date);
      map[mk] = (map[mk] || 0) + e.amount;
    }
    return Object.entries(map)
      .map(([month, value]) => ({ month, value }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [expenses]);

  const cumulativeData = useMemo(() => {
    const sorted = [...expenses].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
    let acc = 0;
    return sorted.map((e) => {
      acc += e.amount;
      return { date: e.date, total: acc };
    });
  }, [expenses]);

  const percentOfBudget =
    budget > 0 ? Math.min(1, Math.abs(total) / budget) : 0;
  const daysSinceLast = useMemo(() => {
    if (!expenses.length) return null;
    const last = expenses.reduce((a, b) =>
      new Date(a.date) > new Date(b.date) ? a : b
    );
    const diff = Math.floor(
      (Date.now() - new Date(last.date)) / (1000 * 60 * 60 * 24)
    );
    return diff;
  }, [expenses]);

  // AI Insights (simple heuristics)
  const insights = useMemo(() => {
    // compare current month vs previous month for categories
    const now = new Date();
    const curMonthKey = `${now.getFullYear()}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prev.getFullYear()}-${(prev.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;

    const map = {};
    const mapPrev = {};
    for (const e of expenses) {
      const mk = monthKey(e.date);
      if (mk === curMonthKey)
        map[e.category] = (map[e.category] || 0) + e.amount;
      if (mk === prevKey)
        mapPrev[e.category] = (mapPrev[e.category] || 0) + e.amount;
    }

    const tips = [];
    for (const cat of Object.keys({ ...map, ...mapPrev })) {
      const cur = Math.abs(map[cat] || 0);
      const prevv = Math.abs(mapPrev[cat] || 0);
      if (prevv === 0 && cur > 0) {
        tips.push(
          `You started spending in ${cat} this month: ₹${formatCurrency(cur)}.`
        );
      } else if (prevv > 0) {
        const diffPct = ((cur - prevv) / prevv) * 100;
        if (diffPct > 25)
          tips.push(
            `You spent ${Math.round(diffPct)}% more on ${cat} than last month.`
          );
        else if (diffPct < -25)
          tips.push(
            `Good! You spent ${Math.round(
              -diffPct
            )}% less on ${cat} than last month.`
          );
      }
    }
    // generic tip
    if (Math.abs(total) > (budget || Infinity) && budget > 0)
      tips.unshift(
        `Alert: you've exceeded your budget of ₹${formatCurrency(budget)}.`
      );
    return tips;
  }, [expenses, budget, total]);

  // import handler for file input
  const fileInputRef = useRef();
  const onImportClick = () => fileInputRef.current?.click();
  const onFileChange = (ev) => {
    const f = ev.target.files?.[0];
    if (f) handleFileImport(f);
    ev.target.value = "";
  };
  const handleFileImport = (file) => {
    // accept json or csv
    if (file.type === "application/json" || file.name.endsWith(".json")) {
      handleImportJSON(file);
    } else {
      // For CSV we do simple parse
      const fr = new FileReader();
      fr.onload = (e) => {
        const txt = e.target.result;
        const lines = txt.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) {
          alert("CSV appears empty");
          return;
        }
        const headers = lines[0]
          .split(",")
          .map((h) => h.trim().replace(/(^"|"$)/g, ""));
        const rows = lines.slice(1).map((l) => {
          // naive split
          const parts = l.split(",").map((p) => p.replace(/(^"|"$)/g, ""));
          const obj = {};
          headers.forEach((h, i) => (obj[h] = parts[i]));
          return obj;
        });
        // convert rows
        const cleaned = rows.map((r) => ({
          id: r.id || Date.now() + Math.floor(Math.random() * 1000),
          reason: r.reason || "Imported",
          amount: Number(r.amount) || 0,
          date: r.date || new Date().toISOString().slice(0, 10),
          category: r.category || "Other",
        }));
        setExpenses((s) => [...s, ...cleaned]);
        alert("CSV imported (basic parser)");
      };
      fr.readAsText(file);
    }
  };

  // helper for JSON import used earlier
  // const handleImportJSON = (file) => {
  //   const fr = new FileReader();
  //   fr.onload = (ev) => {
  //     try {
  //       const data = JSON.parse(ev.target.result);
  //       if (!Array.isArray(data)) throw new Error("Invalid format");
  //       const cleaned = data.map((r) => ({
  //         id: r.id || Date.now() + Math.floor(Math.random() * 1000),
  //         reason: r.reason || "Imported",
  //         amount: Number(r.amount) || 0,
  //         date: r.date || new Date().toISOString().slice(0, 10),
  //         category: r.category || "Other",
  //       }));
  //       setExpenses((s) => [...s, ...cleaned]);
  //       alert("Imported successfully");
  //     } catch (err) {
  //       alert("Invalid JSON file.");
  //     }
  //   };
  //   fr.readAsText(file);
  // };

  // monthly report generator (PDF)
  const generateMonthlyReportPDF = async (monthKeyStr) => {
    const rows = expenses.filter((e) => monthKey(e.date) === monthKeyStr);
    if (!rows.length) {
      alert("No data for that month");
      return;
    }
    // use downloadPDF helper
    await downloadPDF(rows, { title: `Monthly Report for ${monthKeyStr}` });
  };

  // basic registration of service worker (should be called in index.js too)
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // only register from public root /service-worker.js
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => {
          // do nothing if already registered
        })
        .catch(() => {});
    }
  }, []);

  /* ----- JSX ----- */
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#0f1720] to-[#071023] text-gray-900 p-6"
      style={{ color: "#0b1720" }}
    >
      <div className="max-w-7xl mx-auto">
        {/* header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ background: PALETTE.p1 }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 11v6a2 2 0 002 2h2"
                  stroke="#062026"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">FinTrack</h1>
              <p className="text-sm text-gray-400">
                Elegant expense dashboard — palette applied sitewide.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className="px-3 py-2 rounded-md"
              style={{ background: PALETTE.p2, color: "#062026" }}
            >
              {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
            </button>
            <button
              onClick={() => setIsOpen(true)}
              className="px-3 py-2 rounded-md font-semibold"
              style={{ background: PALETTE.p3, color: "#062026" }}
            >
              ➕ Add Expense
            </button>
          </div>
        </div>

        {/* Controls */}
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glassmorphism p-4 rounded-xl mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-md p-2 bg-[rgba(255,255,255,0.02)]"
            >
              <option>All</option>
              {Object.keys(CATEGORY_META).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="rounded-md p-2 bg-[rgba(255,255,255,0.02)]"
            />
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="rounded-md p-2 bg-[rgba(255,255,255,0.02)]"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-md p-2 bg-[rgba(255,255,255,0.02)]"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="high">Highest</option>
              <option value="low">Lowest</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm">Budget:</label>
            <input
              type="number"
              value={budget || ""}
              onChange={(e) => setBudget(Number(e.target.value || 0))}
              className="rounded-md p-2 w-28 bg-[rgba(255,255,255,0.02)]"
              placeholder="0"
            />
            <button
              onClick={() => downloadCSV(expenses)}
              className="px-3 py-2 rounded-md"
              style={{ background: PALETTE.p3, color: "#062026" }}
            >
              CSV
            </button>
            <button
              onClick={() => downloadJSON(expenses)}
              className="px-3 py-2 rounded-md"
              style={{ background: PALETTE.p2, color: "#062026" }}
            >
              JSON
            </button>
            <button
              onClick={() => downloadExcel(expenses)}
              className="px-3 py-2 rounded-md"
              style={{ background: PALETTE.p1, color: "#062026" }}
            >
              Excel
            </button>
            <button
              onClick={() => downloadPDF(expenses, { title: "Full Export" })}
              className="px-3 py-2 rounded-md"
              style={{ background: PALETTE.p4, color: "#062026" }}
            >
              PDF
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
              onChange={onFileChange}
              className="hidden"
            />
            <button
              onClick={onImportClick}
              className="px-3 py-2 rounded-md"
              style={{ background: PALETTE.p3, color: "#062026" }}
            >
              Import
            </button>
          </div>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left list */}
          <div
            className="lg:col-span-1 glassmorphism p-4 rounded-xl"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
            }}
          >
            <h3 className="font-semibold mb-3">Expenses ({filtered.length})</h3>
            <div className="space-y-2 max-h-[60vh] overflow-auto pr-2">
              {filtered.length === 0 && (
                <p className="text-gray-400">No expenses found</p>
              )}
              {filtered.map((e) => (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 rounded-md hover:shadow-lg transition flex justify-between items-start"
                  title={`${e.reason} • ₹${formatCurrency(e.amount)} • ${
                    e.date
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl">
                        {CATEGORY_META[e.category]?.icon || "📦"}
                      </div>
                      <div>
                        <div className="font-medium">{e.reason}</div>
                        <div className="text-xs text-gray-400">{e.date}</div>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {e.category}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="font-bold">₹{formatCurrency(e.amount)}</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => deleteExpense(e.id)}
                        className="text-sm px-2 py-1 rounded-md"
                        style={{ background: PALETTE.p2, color: "#062026" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Charts area (span 2) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* pie */}
              <div className="glassmorphism p-4 rounded-xl">
                <h4 className="font-semibold mb-2">Category Breakdown</h4>
                {pieData.length === 0 ? (
                  <div className="text-gray-400">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        label
                      >
                        {pieData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <ReTooltip formatter={(v) => `₹${formatCurrency(v)}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* bar */}
              <div className="glassmorphism p-4 rounded-xl">
                <h4 className="font-semibold mb-2">Monthly Totals</h4>
                {monthlyTotals.length === 0 ? (
                  <div className="text-gray-400">No monthly data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={monthlyTotals}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.06} />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <ReTooltip formatter={(v) => `₹${formatCurrency(v)}`} />
                      <Bar dataKey="value" fill={PALETTE.p1} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              <div className="md:col-span-2 glassmorphism p-4 rounded-xl">
                <h4 className="font-semibold mb-2">
                  Cumulative Spend Over Time
                </h4>
                {cumulativeData.length === 0 ? (
                  <div className="text-gray-400">No timeline data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={cumulativeData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.06} />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <ReTooltip formatter={(v) => `₹${formatCurrency(v)}`} />
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke={PALETTE.p4}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="glassmorphism p-4 rounded-xl flex flex-col items-center justify-center">
                <h4 className="font-semibold mb-2">Budget Progress</h4>
                <svg width="120" height="120" className="mb-2">
                  <defs>
                    <linearGradient id="g1" x1="0%" x2="100%">
                      <stop offset="0%" stopColor={PALETTE.p1} />
                      <stop offset="100%" stopColor={PALETTE.p4} />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="12"
                    fill="none"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    stroke="url(#g1)"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${Math.PI * 2 * 48}`}
                    strokeDashoffset={`${
                      Math.PI * 2 * 48 * (1 - percentOfBudget)
                    }`}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                  />
                  <text
                    x="60"
                    y="62"
                    textAnchor="middle"
                    fill="#062026"
                    fontSize="16"
                    fontWeight="700"
                  >
                    {Math.round(percentOfBudget * 100)}%
                  </text>
                </svg>
                <div className="text-sm text-gray-400 mb-2">
                  Budget: ₹{formatCurrency(budget || 0)}
                </div>
                <div className="text-sm">
                  Spent:{" "}
                  <span className="font-bold">
                    ₹{formatCurrency(Math.abs(total))}
                  </span>
                </div>
                <div className="mt-3">
                  <input
                    type="number"
                    value={budget || ""}
                    onChange={(e) => setBudget(Number(e.target.value || 0))}
                    className="p-2 rounded-md bg-[rgba(255,255,255,0.02)]"
                    placeholder="Set budget"
                  />
                </div>
              </div>
            </div>

            {/* AI Insights */}
            <div className="glassmorphism p-4 rounded-xl">
              <h4 className="font-semibold mb-2">AI Insights (suggestions)</h4>
              {insights.length === 0 ? (
                <div className="text-gray-400">
                  No insights yet — add some expenses to get actionable tips.
                </div>
              ) : (
                <ul className="list-disc pl-5 space-y-1">
                  {insights.map((t, i) => (
                    <li key={i} className="text-sm">
                      {t}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 text-xs text-gray-500">
                These are locally generated heuristics. For smarter AI-driven
                advice you can later integrate an ML/LLM backend.
              </div>
            </div>
          </div>
        </div>

        {/* footer total */}
        <div
          className="mt-6 glassmorphism p-4 rounded-xl flex justify-between items-center"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
          }}
        >
          <div>
            <div className="text-sm text-gray-400">Total</div>
            <div className="text-2xl font-bold" style={{ color: PALETTE.p4 }}>
              ₹
              {formatCurrency(
                Math.abs(
                  Number(
                    animatedTotal.toFixed
                      ? animatedTotal.toFixed(2)
                      : animatedTotal
                  )
                )
              )}
            </div>
          </div>
          <div className="text-right text-sm text-gray-400">
            {daysSinceLast === null
              ? "No entries yet"
              : daysSinceLast === 0
              ? "Last: today"
              : `Last entry: ${daysSinceLast} day(s) ago`}
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-md glassmorphism p-6 rounded-xl"
            >
              <h3 className="text-lg font-semibold mb-3">Add Expense</h3>
              <form onSubmit={addExpense} className="space-y-3">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason"
                  className="w-full p-2 rounded-md bg-[rgba(255,255,255,0.02)]"
                />
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount"
                  type="number"
                  className="w-full p-2 rounded-md bg-[rgba(255,255,255,0.02)]"
                />
                <input
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  type="date"
                  className="w-full p-2 rounded-md bg-[rgba(255,255,255,0.02)]"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2 rounded-md bg-[rgba(255,255,255,0.02)]"
                >
                  {Object.keys(CATEGORY_META).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 py-2 rounded-md"
                    style={{ background: PALETTE.p2, color: "#062026" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-md"
                    style={{ background: PALETTE.p4, color: "#062026" }}
                  >
                    Add
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

window.__ModuleLoader__.load({
	id: "dsh-trust",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var inject = ["slots"];
var RISK_META = {
  critical: { color: "#A87171", bg: "rgba(168,113,113,0.16)", label: "高危" },
  suspicious: { color: "#B39263", bg: "rgba(179,146,99,0.16)", label: "可疑" },
  clean: { color: "#7E9A7C", bg: "rgba(126,154,124,0.16)", label: "干净" }
};
function riskBadge(risk) {
  const m = RISK_META[risk];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: m.color, background: m.bg, borderRadius: 6, padding: "1px 9px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }, children: m.label });
}
function metaLine(text) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: "#8a8a8a", marginTop: 3 }, children: text });
}
function Panel() {
  const [data, setData] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)(null);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/trust/audit.json", { cache: "no-store" });
      setData(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };
  (0, import_react.useEffect)(() => {
    void load();
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "16px 20px", fontSize: 13, lineHeight: 1.6 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 16, fontWeight: 800 }, children: "插件安全审计" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          onClick: () => {
            void load();
          },
          style: { marginLeft: "auto", border: "1px solid var(--dsw-alias-border, #ccc)", background: "transparent", borderRadius: 6, padding: "2px 12px", cursor: "pointer", fontSize: 12 },
          children: "刷新"
        }
      )
    ] }),
    loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: "#8a8a8a" }, children: "扫描中…" }),
    !loading && error !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { color: "#A87171" }, children: [
      "加载失败：",
      error
    ] }),
    !loading && error === null && data !== null && data.summary !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { color: "#8a8a8a", marginBottom: 12 }, children: [
      "共 ",
      data.summary.total,
      " 个第三方插件 · ",
      data.summary.critical,
      " 高危 · ",
      data.summary.suspicious,
      " 可疑 · ",
      data.summary.clean,
      " 干净"
    ] }),
    !loading && error === null && data !== null && data.plugins.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { border: "1px solid var(--dsw-alias-border, #e5e5e5)", borderRadius: 8, padding: "10px 14px", marginBottom: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: 700 }, children: p.name }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: "#999", fontSize: 12 }, children: [
          "@",
          p.version
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { marginLeft: "auto" }, children: riskBadge(p.risk) })
      ] }),
      p.error !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: "#A87171", marginTop: 4 }, children: p.error }),
      p.error === void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        (p.installScripts?.length ?? 0) > 0 && metaLine(`安装脚本：${p.installScripts.join(", ")}`),
        (p.hostInject?.length ?? 0) > 0 && metaLine(`host 注入：${p.hostInject.join(", ")}`),
        (p.clientInject?.length ?? 0) > 0 && metaLine(`client 注入：${p.clientInject.join(", ")}`),
        p.patch !== null && p.patch !== void 0 && !p.patch.missing && metaLine(`patch：insert=${p.patch.insertCount} disable=${p.patch.disableCount}${p.patch.hasJsExpr ? " ⚠️ 含 !!js" : ""}`),
        p.drift !== void 0 && p.drift.status === "new" && metaLine("依赖漂移：新插件（已记录基线）"),
        p.drift !== void 0 && p.drift.status === "drifted" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          p.drift.added.length > 0 && metaLine(`依赖漂移：新增 ${p.drift.added.join(", ")}`),
          p.drift.removed.length > 0 && metaLine(`依赖漂移：移除 ${p.drift.removed.join(", ")}`),
          p.drift.changed.length > 0 && metaLine(`依赖漂移：版本变化 ${p.drift.changed.join(", ")}`)
        ] }),
        p.findings.map((f, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 12, marginTop: 4 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: f.severity === "critical" ? "#A87171" : "#B39263", fontWeight: 700 }, children: [
            f.severity === "critical" ? "🔴" : "🟡",
            " "
          ] }),
          f.message
        ] }, i))
      ] })
    ] }, p.name)),
    !loading && error === null && data !== null && data.plugins.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: "#8a8a8a" }, children: "当前 profile 没有第三方插件。" })
  ] });
}
function apply(ctx) {
  ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
    name: "settings.plugins.tab",
    id: "trust",
    order: 20,
    label: () => "安全审计",
    inject: () => ({})
  }, Panel));
}

		return module.exports;
	}
});


# dsh-trust

> DeepSeek Harness 插件安全审计工具：在运行第三方插件之前，看清它到底会对你做什么。

[English](README.en.md)

## 它是什么

`dsh-trust` 是面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的第三方安全插件。

`dsh` 的设计是「一切皆插件」——安装一个插件，本质上等于在你的机器上运行一段**第三方任意代码**。工具审批链能拦住 agent 的动作，却拦不住插件自身的代码。`dsh-trust` 用确定性的静态分析，把这段「看不见的风险」摊到明面上。

## 它能解决什么问题

- **装前不知道风险**：`dsh plugin add xxx` 之前，没人告诉你这个插件会读哪些文件、能不能联网、会不会在安装时执行代码。
- **装后不知道变化**：审计是一次性的，依赖却是持续变化的。插件更新时悄悄塞进一个恶意依赖，你不会察觉。
- **安全信号太散**：已有的安全工具要求用户主动去跑、自己去读懂结果，对普通用户不友好。

## 核心好处

| 好处 | 说明 |
|------|------|
| 🔍 **权限透明** | 枚举每个第三方插件，展示注入能力面、构建脚本、`!!js` 配置等风险信号 |
| 🛡️ **防供应链投毒** | 依赖漂移检测：首次审计记录基线，之后依赖增删/版本变化自动告警 |
| 🎯 **结果可信** | 纯文件系统、确定性判定，无 LLM 参与、无网络请求，结果可复现 |
| 🕊️ **零侵入** | 只读、仅告警，不修改任何插件或配置，绝不影响你的环境 |
| 🧩 **两种形态** | 对话内工具 `audit_plugins` + Web 设置页「安全审计」面板，按习惯取用 |

## 安装

```sh
# 从 npm 安装
dsh plugin --profile web add dsh-trust

# 或从 GitHub 安装（建议 pin 到具体 commit，供应链更可控）
dsh plugin --profile web add github:<你的账号>/dsh-trust#<commit>
```

重启 `dsh web` 后生效。

## 使用

### 方式一：对话工具 `audit_plugins`

直接对 agent 说：

> 帮我审计一下当前已装的插件有没有安全风险

agent 会调用 `audit_plugins`，返回每个插件的风险卡（等级 + 明细）。

可选参数：

| 参数 | 说明 |
|------|------|
| `profile` | 审计指定 profile（默认当前 profile，如 `web` / `headless`） |
| `updateBaseline` | 设为 `true` 时，接受当前依赖状态为新基线（清空漂移告警） |

### 方式二：Web 面板「安全审计」

打开 **设置 → 插件 → 安全审计**，面板列出每个第三方插件的风险等级徽章、注入能力面、patch 摘要和依赖漂移状态。面板只读，不会修改任何东西。

## 风险信号

| 风险信号 | 检测方式 | 等级 |
|----------|----------|------|
| `!!js` 配置表达式 | `cordis.patch.yml` 中出现 `!!js`（加载期执行任意代码） | 🔴 高危 |
| 安装脚本 | 存在 `install` / `postinstall` / `preinstall` | 🔴 高危 |
| `prepare` 脚本 | 存在 `prepare`（构建期执行，通常正常） | 🟡 可疑 |
| 高权限 host 注入 | 注入 `subprocess` / `shell` / `dynamicCordisRunner` / `loader` / `sandboxPolicy` / `credentials` | 🟡 可疑 |
| 依赖漂移 | 相对基线的依赖新增 | 🟡 可疑 |
| 宽依赖面 | 第三方依赖超过 10 个 | 🟡 可疑 |

## 依赖漂移

依赖漂移（dependency drift）指插件的依赖集合在「上次审计」与「本次审计」之间发生了变化，而用户不知情。

1. **首次审计**：把每个插件的依赖清单写入基线快照（profile 目录下的 `.dsh-trust-baseline.json`）。
2. **后续审计**：对比当前依赖与基线，区分「新增 / 移除 / 版本变化」。
3. **新增依赖** → 提升为可疑并告警。
4. **确认无问题后**：用 `audit_plugins` 传 `updateBaseline: true` 接受当前状态为新基线。

## 设计边界

- **确定性启发式，非完整静态分析**：只读 `package.json` + `cordis.patch.yml` 并 grep 入口模块的 `inject`，不逐行解析全部源码，也不查漏洞库。
- **仅告警，不拦截**：`dsh-trust` 只提示风险，不阻止安装或运行任何插件。安装来源请自行信任。
- **硬拦截不在能力范围内**：`dsh plugin add` 底层直接转发 pnpm，无安装前钩子，纯插件无法在安装那一刻强制阻断（需改官方 CLI 或接入插件市场弹窗）。

## 项目结构

```text
dsh-trust/
├── lib/
│   ├── index.js       # host 入口：注册 audit_plugins 工具 + 路由
│   ├── audit.js       # 审计核心：枚举、解析、风险计算、依赖漂移
│   └── route.js       # /trust/audit.json HTTP 数据通道
├── src/client/index.tsx  # 浏览器半区：设置页「安全审计」面板
├── scripts/build-client.mjs  # esbuild 打包 client bundle
├── cordis.patch.yml  # bundle 挂载层
└── package.json      # manifest（dsh.bundle + dsh.client）
```

## 许可证

[MIT](LICENSE)

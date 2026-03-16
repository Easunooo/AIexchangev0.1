# 微信小程序架构基线
## 当前目标

在现有首页内先把可运行的对话链路搭起来，优先满足：

- DeepSeek 流式输出
- 本地会话记忆
- 新建对话重置
- 历史对话管理
- 为后续意图识别、场景路由、模型策略预留清晰扩展位

## 运行模式

当前项目默认是 `auto 双通道模式`：

- 开发者工具默认直连 `https://api.deepseek.com/chat/completions`
- 真机默认改走 HTTPS 代理
- 当前配置入口在 [config/app.js](/d:/原型图/config/app.js)
- 开发者工具本地调试依赖 [project.private.config.json](/d:/原型图/project.private.config.json) 中的 `urlCheck: false`

仓库里保留了 `server/` 代理层，作为后续切回安全架构时的落点：

- 生产环境应把 API Key 移出小程序包
- 策略编排、意图识别、模型路由建议放到 `server/strategies/`

## 目录职责

- `pages/home`
  - 主对话页，承接换汇计划、热门问题、消息流和固定输入栏
- `pages/profile`
  - 历史对话管理页，支持继续、删除、清空
- `components/planner-flow`
  - 首页内嵌的换汇计划表单
- `services/chat`
  - 会话存储、流式请求、历史管理、策略拼装
- `services/chat/strategy.js`
  - 当前直连模式的策略预留层，后续可接意图识别和路由
- `services/exchange`
  - 首页展示数据和 mock 数据入口
- `utils/chat.js`
  - 会话结构、消息追加、摘要和记忆窗口
- `utils/sse.js`
  - SSE 分块解析和 UTF-8 chunk 解码
- `server/`
  - 预留的服务端代理和策略层
- `worker/`
  - Cloudflare Workers 代理入口，供真机和线上环境使用

## 对话链路

1. 首页加载时，从本地存储恢复当前会话；没有则新建一轮对话。
2. 用户发送消息后，当前会话里的历史消息会一并组装为 `messages`，作为记忆带给模型。
3. `services/chat/strategy.js` 负责产出当前策略对象，后续可在这里接入意图识别和路由。
4. `services/chat/index.js` 会根据运行环境选择直连或代理，并使用 `wx.request + enableChunked + onChunkReceived` 处理 SSE 流。
5. 小程序端边接收边解析 chunk，实时刷新 assistant 气泡。
6. 对话完成后落到本地存储，供下一轮继续作为记忆。

## 当前约束

- 当前默认目标是“先跑通 demo”，因此开发者工具仍允许直连。
- 真机预览和上线环境必须走 HTTPS 代理，并配置合法请求域名。
- 当前仓库已提供 `worker/index.mjs + wrangler.jsonc`，可直接部署到 Cloudflare Workers。
- 真实上线前必须把 API Key 从小程序包移除。
- 页面层不直接读写会话存储，统一走 `services/chat/`。
- 流式解析统一走 `utils/sse.js`，不要在页面里重复处理 chunk。
- 新的策略逻辑优先加在 `services/chat/strategy.js` 或 `server/strategies/`，不要塞进页面文件。
- 旧静态原型 `index.html`、`script.js`、`styles.css` 继续只作为参考，不参与运行。
## 2026-03-15 更新

- 首页已移除“创建计划面板”，换汇计划不再通过独立面板收集信息。
- 对话入口改为 `Agent 追问 + 选项消息`：
  - `utils/exchange-agent.js` 负责四级过滤、聊天内追问状态机、FAQ 路由和演示汇率换算。
  - `services/chat/index.js` 在真正发起请求前先解析策略；本地只做 guidance，不直接产出最终 assistant 回复。
  - `pages/home` 只负责渲染消息、选项 widget、小程序卡片和发送动作，不承载业务判断。
- 需要继续扩展时，优先沿用 `message.widget` 协议追加新的聊天内选项/表单，不再恢复首页独立 planner 面板。
## 2026-03-15 API Route Update

- `utils/exchange-agent.js` 继续负责本地意图识别、追问状态推进、FAQ/合规路由和 widget 元数据生成。
- `services/chat/index.js` 不再执行本地短路回复；所有用户发送后的 assistant 回复统一走模型 API。
- 本地策略层现在只提供 guidance，不直接产出最终 assistant 文本。
- 代理链路现在会透传小程序本地已解析的 `strategy`（包含 `systemPrompt / model / temperature / maxTokens`），Cloudflare Worker 与本地 `server/` 优先复用这份策略，避免开发者工具直连与预览/真机代理模式出现答复口径漂移。

## 2026-03-15 Prompt / UI Update

- 对话策略统一改为“行动建议前置 + 每次只追问一个问题 + 末尾动态追问 chip”的输出约束。
- 换汇决策场景按时间窗口收敛为两类组件：紧急窗口挂载 `ChannelCompareCard`，长窗口挂载 `BatchExchangeCard`。
- 换汇决策多轮追问固定为四步：`目标币种 -> 换汇金额 -> 使用时间 -> 换汇目的`；最后一轮用四个 chip 明确收集 `投资 / 留学 / 跨境汇款 / 旅游`，用于对齐建议卡和跳转入口。
- 像“现在换1000美元合适吗”这类已带金额/币种的时机判断问题，应直接命中换汇决策链路；若中途进入 `clarify-scene`，也必须保留原始问题，避免场景确认后丢失已提取的金额和币种信息。
- 像“提醒我美元汇款”“帮我设置欧元提醒”这类已带提醒意图与币种/汇款语义的输入，应由 agent 自动判断为提醒请求，不再先弹“请选择场景”的分流 chip；`clarify-scene` 只保留给真正意图模糊的输入。
- 像“我想汇款”“我想跨境汇款”“我想给境外汇款”这类已带执行意图且可识别为 `跨境汇款` 的输入，应直接进入换汇 workflow，优先追问缺失字段，不再先弹场景分流 chip；显式命中的 `usageScene` 视为已确认，不必在链路后面重复确认同一用途。
- 像“我想4月去西班牙玩，如何换汇”这类已包含出行地与时间的旅游换汇请求，字段自动补全应优先走模型抽取：由模型根据目的地、出行语义和日历表达推断 `targetCurrency / usageScene / exchangeWindow`，本地状态机只负责合并结果并继续追问剩余缺失字段，不在前端维护目的地到币种的硬编码映射。
- 在 `usageScene / usageSceneConfirmed` 未补齐前，不允许直接生成换汇建议卡；即使误调到决策输出分支，也必须先回到“换汇目的”这一步。
- 换汇规划相关且前端已挂载 `choices` 选项组件时，流式正文必须压缩为 1 句极短引导，不做展开解释；交互重心放在下方 chip / 选项组件。
- 进入换汇计划咨询链路后，`WORKFLOW / DECISION` 消息不再挂载“你可能还想问” chip；离开这条链路后，其他 FAQ、汇率查询、无关问题等路径继续按原规则显示追问 chip。
- 基础换算场景统一挂载 `CalcCard`；当用户只输入“看今日汇率”这类宽泛问题时，先通过聊天内选项追问币种对，不再退回纯文本澄清；卡片内的汇率走势小图统一使用更高频的模拟折线图，不再使用柱状条。
- 热问入口“看今日汇率”“什么时候换合适？”已补强本地路由命中，避免落回泛澄清。
- `ChannelCompareCard` / `BatchExchangeCard` 底部按钮已接入聊天内 workflow：渠道对比卡保留跳转与提醒；分批换汇卡收敛为单按钮“设置提醒”，继续复用 `strategyContext`，不要在页面层单独维护卡片状态机。
- 建议类结果卡在最底部统一追加红色 `风险提示` 区块；当前先覆盖 `ChannelCompareCard` 与 `BatchExchangeCard`，强调演示牌价、手续费与到账时效仅供参考。
- `设置汇率提醒` 已改为一步完成：不再追问目标汇率或提醒方式，直接返回 `AlertStatusCard`；默认由 agent 自动跟踪未来 7 天更优点位，文案规则为“购汇看最低，结汇看最高”。仅当当前选中的是分批换汇方案时，才会在同一面板里额外展示按批次时间节点的执行提醒。提醒设置成功后会退出旧的 `SELECT_ACTION` 状态；若用户后续用自然语言重新发起提醒请求，应优先按当前句子重建币种与用途，不沿用上一轮的分批计划。`AlertStatusCard` 的正文改为本地固定文案，不再走模型续写，因此不会再出现“请设定目标价位”的追问。
- 与换汇无关的话题统一走更严格的 `irrelevant` 收口：模型只用 1 句友好拒答，语气装傻并引导“换个汇率相关问题吧”，不解释原话题，也不延伸闲聊。
- 场景相关的小程序引导卡按 `usageScene` 挂载：`出境出行 -> 全球有礼`，`留学 / 跨境汇款 -> 跨境汇款`，`投资 -> 腾讯微证券`，`外贸结算 -> 腾讯智汇鹅`；FAQ、澄清和 workflow 追问阶段都可复用同一机制。

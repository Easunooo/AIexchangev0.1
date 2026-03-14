# AIexchangev0.1

该仓库已补齐微信小程序基础骨架，当前重点是前端架构，不接 AI 能力。

## 当前结构

- `app.*`：小程序入口与全局配置
- `pages/home`：首页主交互，内联换汇计划、热门问题和输入区
- `pages/planner`：预留独立计划页，不作为当前默认入口
- `pages/profile`：预留账号与历史等扩展页
- `components/planner-flow`：计划交互组件
- `services/` + `mocks/`：数据访问层与 mock 数据
- `constants/` + `utils/`：业务常量和纯函数
- `styles/`：全局主题样式

## 说明

- 旧的 `index.html`、`styles.css`、`script.js` 保留为静态原型参考。
- 架构基线见 `PROJECT_ARCHITECTURE_BASELINE.md`。

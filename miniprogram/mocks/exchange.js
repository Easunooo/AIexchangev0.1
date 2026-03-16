const { PLAN_ORDER, PLAN_SCENARIOS } = require('../constants/plans');

const DASHBOARD_PAYLOAD = {
  navTitle: 'AI汇率助手',
  welcome: {
    eyebrow: '跨境金融助手',
    title: 'Hi，我是腾讯 AI 汇率查询助手',
    description: '专注汇率问答与换汇规划。你可以直接查询实时汇率，也可以快速创建旅游、留学、投资或跨境汇款的换汇计划。'
  },
  plannerHeading: '创建换汇计划',
  hotQuestions: [
    {
      id: 'usd-cny',
      text: '美元兑换人民币汇率'
    },
    {
      id: 'jpy-split',
      text: '现在换日元适合分批提现吗？'
    },
    {
      id: 'us-remit',
      text: '汇率波动下如何汇款到美国？'
    },
    {
      id: 'hkd-usd',
      text: '港币和美元哪一个更适合近期持有？'
    }
  ],
  assistantMessage: '我可以帮你查询汇率、规划换汇时点，或者根据跨境场景给出换汇建议。',
  disclaimer: '内容由 AI 生成，仅供参考'
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getHomeDashboard() {
  return clone({
    ...DASHBOARD_PAYLOAD,
    defaultQuestion: DASHBOARD_PAYLOAD.hotQuestions[0].text,
    planOrder: PLAN_ORDER,
    planScenarios: PLAN_SCENARIOS
  });
}

function getPlannerPagePayload(initialPlanKey) {
  return clone({
    pageTitle: '分场景换汇计划',
    pageIntro: '复杂交互收敛到 planner 组件内部，页面层只负责加载数据、路由和结果承接。',
    initialPlanKey,
    planOrder: PLAN_ORDER,
    planScenarios: PLAN_SCENARIOS
  });
}

module.exports = {
  getHomeDashboard,
  getPlannerPagePayload
};

const { APP_CONFIG } = require('../../config/app');
const { getHomeDashboard } = require('../../services/exchange/index');

Page({
  data: {
    hotQuestionsEyebrow: '\u731c\u4f60\u60f3\u95ee',
    hotQuestionsTitle: '\u70ed\u95e8\u6c47\u7387\u95ee\u9898\u53ef\u4e00\u952e\u63d0\u95ee',
    composerPlaceholder: '\u8bf7\u8f93\u5165\u6c47\u7387\u95ee\u9898\u6216\u6362\u6c47\u9700\u6c42',
    newChatLabel: '\u65b0\u5efa\u5bf9\u8bdd',
    navStatusBarHeight: 0,
    navBarHeight: 0,
    navContentHeight: 44,
    navRightGap: 20,
    welcome: {},
    plannerHeading: '',
    hotQuestions: [],
    quickTools: [],
    assistantMessage: '',
    disclaimer: '',
    defaultQuestion: APP_CONFIG.defaultQuestion,
    previewQuestion: APP_CONFIG.defaultQuestion,
    messageInput: APP_CONFIG.defaultQuestion,
    selectedQuestionId: '',
    planOrder: [],
    planScenarios: {},
    initialPlanKey: '',
    plannerResetToken: 0
  },

  async onLoad() {
    this.initNavMetrics();
    await this.loadPage();
  },

  initNavMetrics() {
    const systemInfo = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
    const menuButton = wx.getMenuButtonBoundingClientRect
      ? wx.getMenuButtonBoundingClientRect()
      : null;
    const statusBarHeight = systemInfo.statusBarHeight || 0;
    let navContentHeight = 44;
    let navBarHeight = statusBarHeight + 44;
    let navRightGap = 20;

    if (menuButton && menuButton.height) {
      const topGap = Math.max(menuButton.top - statusBarHeight, 0);

      navContentHeight = menuButton.height + topGap * 2;
      navBarHeight = statusBarHeight + navContentHeight;
      navRightGap = Math.max((systemInfo.windowWidth || 0) - menuButton.left, 20);
    }

    this.setData({
      navStatusBarHeight: statusBarHeight,
      navBarHeight,
      navContentHeight,
      navRightGap
    });
  },

  async loadPage() {
    const payload = await getHomeDashboard();

    this.setData({
      ...payload,
      defaultQuestion: payload.defaultQuestion,
      previewQuestion: payload.defaultQuestion,
      messageInput: payload.defaultQuestion,
      initialPlanKey: '',
      plannerResetToken: 0
    });
  },

  handleNewChat() {
    const nextToken = Date.now();

    this.setData({
      selectedQuestionId: '',
      previewQuestion: this.data.defaultQuestion,
      messageInput: this.data.defaultQuestion,
      initialPlanKey: '',
      plannerResetToken: nextToken
    });
  },

  pickQuestion(event) {
    const { id, question } = event.currentTarget.dataset;

    this.setData({
      selectedQuestionId: id,
      previewQuestion: question,
      messageInput: question
    });
  },

  handleInput(event) {
    const value = event.detail.value;

    this.setData({
      messageInput: value,
      previewQuestion: value.trim() || this.data.defaultQuestion,
      selectedQuestionId: ''
    });
  },

  handlePlannerComplete() {
    wx.showToast({
      title: '\u5df2\u751f\u6210 mock \u8ba1\u5212',
      icon: 'none'
    });
  }
});

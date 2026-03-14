const { getPlannerPagePayload } = require('../../services/exchange/index');

Page({
  data: {
    pageTitle: '',
    pageIntro: '',
    initialPlanKey: '',
    planOrder: [],
    planScenarios: {},
    lastGeneratedSummary: ''
  },

  async onLoad(options) {
    await this.loadPage(options.planKey || '');
  },

  async loadPage(planKey) {
    const payload = await getPlannerPagePayload(planKey);

    this.setData({
      ...payload
    });
  },

  handleBack() {
    const pages = getCurrentPages();

    if (pages.length > 1) {
      wx.navigateBack({
        delta: 1
      });
      return;
    }

    wx.reLaunch({
      url: '/pages/home/index'
    });
  },

  handleGoHome() {
    wx.reLaunch({
      url: '/pages/home/index'
    });
  },

  handlePlannerComplete(event) {
    this.setData({
      lastGeneratedSummary: event.detail.summary
    });

    wx.showToast({
      title: '已生成 mock 计划',
      icon: 'none'
    });
  }
});

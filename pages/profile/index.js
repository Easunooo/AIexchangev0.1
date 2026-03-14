Page({
  data: {
    todoItems: [
      {
        title: '账号与权限',
        copy: '后续可在此页接入登录态、实名校验和用户偏好设置。'
      },
      {
        title: '计划历史',
        copy: '换汇计划草稿与执行记录建议落在独立 store 或本地缓存层。'
      },
      {
        title: 'AI 能力入口',
        copy: '等 service 协议稳定后，再把智能问答、解释和建议接到会话层。'
      }
    ]
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/home/index'
    });
  },

  goPlanner() {
    wx.navigateTo({
      url: '/pages/planner/index'
    });
  }
});

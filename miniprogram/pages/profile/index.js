const {
  clearConversationHistory,
  deleteConversationById,
  listConversationSummaries,
  setActiveConversationId
} = require('../../services/chat/index');
const { formatRelativeTime } = require('../../utils/chat');

Page({
  data: {
    conversations: [],
    clearAllLabel: '\u6e05\u7a7a\u5168\u90e8',
    emptyTitle: '\u8fd8\u6ca1\u6709\u5386\u53f2\u5bf9\u8bdd',
    emptyCopy: '\u5f53\u4f60\u5728\u9996\u9875\u53d1\u8d77\u7b2c\u4e00\u8f6e\u5bf9\u8bdd\u540e\uff0c\u5bf9\u8bdd\u5185\u5bb9\u4f1a\u81ea\u52a8\u4fdd\u5b58\u5728\u672c\u5730\u3002'
  },

  onShow() {
    this.loadConversations();
  },

  loadConversations() {
    const conversations = listConversationSummaries().map((conversation) => ({
      ...conversation,
      updatedLabel: formatRelativeTime(conversation.updatedAt)
    }));

    this.setData({
      conversations
    });
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/home/index'
    });
  },

  openConversation(event) {
    const { conversationId } = event.currentTarget.dataset;

    if (!conversationId) {
      return;
    }

    setActiveConversationId(conversationId);
    wx.reLaunch({
      url: `/pages/home/index?conversationId=${conversationId}`
    });
  },

  deleteConversation(event) {
    const { conversationId } = event.currentTarget.dataset;

    if (!conversationId) {
      return;
    }

    deleteConversationById(conversationId);
    this.loadConversations();

    wx.showToast({
      title: '\u5df2\u5220\u9664',
      icon: 'none'
    });
  },

  clearAll() {
    if (!this.data.conversations.length) {
      return;
    }

    wx.showModal({
      title: '\u6e05\u7a7a\u5bf9\u8bdd\u5386\u53f2',
      content: '\u8fd9\u4f1a\u5220\u6389\u672c\u5730\u7684\u6240\u6709\u5bf9\u8bdd\u8bb0\u5f55\uff0c\u4e14\u4e0d\u53ef\u6062\u590d\u3002',
      success: ({ confirm }) => {
        if (!confirm) {
          return;
        }

        clearConversationHistory();
        this.loadConversations();

        wx.showToast({
          title: '\u5df2\u6e05\u7a7a',
          icon: 'none'
        });
      }
    });
  }
});

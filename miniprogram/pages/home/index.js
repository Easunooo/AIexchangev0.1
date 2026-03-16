const { getHomeDashboard } = require('../../services/exchange/index');
const {
  appendTurnAndSave,
  clearConversationHistory,
  cleanupEmptyConversation,
  createFreshConversation,
  deleteConversationById,
  getConversationById,
  listConversationSummaries,
  loadOrCreateConversation,
  patchStreamingAssistant,
  saveCompletedAssistant,
  saveFailedAssistant,
  setActiveConversationId,
  streamConversationReply
} = require('../../services/chat/index');
const { formatRelativeTime } = require('../../utils/chat');
const {
  buildInitialAccessPayload,
  composeStructuredAnswerMessage
} = require('../../utils/exchange-agent');
const { renderMarkdown } = require('../../utils/markdown');

Page({
  data: {
    hotQuestionsEyebrow: '\u731c\u4f60\u60f3\u95ee',
    hotQuestionsTitle: '\u70ed\u95e8\u6c47\u7387\u95ee\u9898\u53ef\u4e00\u952e\u63d0\u95ee',
    composerPlaceholder: '\u8bf7\u8f93\u5165\u6c47\u7387\u95ee\u9898\u6216\u6362\u6c47\u9700\u6c42',
    newChatLabel: '\u65b0\u5efa\u5bf9\u8bdd',
    historyLabel: '\u5386\u53f2\u5bf9\u8bdd',
    sendLabel: '\u53d1\u9001',
    navStatusBarHeight: 0,
    navBarHeight: 0,
    navContentHeight: 44,
    navRightGap: 20,
    welcome: {},
    plannerHeading: '',
    hotQuestions: [],
    assistantMessage: '',
    disclaimer: '',
    defaultQuestion: '',
    messageInput: '',
    selectedQuestionId: '',
    conversationMessages: [],
    activeConversationId: '',
    historyItems: [],
    historyCount: 0,
    historyPanelVisible: false,
    historyPanelEyebrow: '\u5bf9\u8bdd\u7ba1\u7406',
    historyPanelTitle: '\u5386\u53f2\u5bf9\u8bdd',
    historyEmptyTitle: '\u6682\u65e0\u5386\u53f2\u5bf9\u8bdd',
    historyEmptyCopy: '\u4f60\u53d1\u8d77\u7b2c\u4e00\u8f6e\u5bf9\u8bdd\u540e\uff0c\u8fd9\u91cc\u4f1a\u81ea\u52a8\u4fdd\u5b58\u5386\u53f2\u8bb0\u5f55\u3002',
    clearAllLabel: '\u6e05\u7a7a',
    closePanelLabel: '\u5173\u95ed',
    isStreaming: false
  },

  async onLoad(options) {
    this.pendingConversationId = options && options.conversationId ? options.conversationId : '';
    this.widgetDrafts = {};
    this.initNavMetrics();
    await this.loadPage(this.pendingConversationId);
  },

  onShow() {
    this.syncHistoryState();

    if (!this.data.activeConversationId) {
      return;
    }

    const latestConversation = getConversationById(this.data.activeConversationId);

    if (!latestConversation) {
      const conversation = createFreshConversation(this.greetingText || this.data.assistantMessage);
      this.activeConversation = conversation;
      this.widgetDrafts = {};
      this.applyConversation(conversation, false);
      this.syncHistoryState();
      return;
    }

    this.activeConversation = latestConversation;
    this.applyConversation(latestConversation, false);
  },

  onUnload() {
    this.forceStopStream('\u5bf9\u8bdd\u5df2\u505c\u6b62');
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

  getEntryPayload() {
    const initialAccess = buildInitialAccessPayload();
    const hotQuestions = initialAccess.guessList.map((text, index) => ({
      id: `guess-${index}`,
      text
    }));

    return {
      initialAccess,
      hotQuestions,
      defaultQuestion: hotQuestions[0] ? hotQuestions[0].text : ''
    };
  },

  async loadPage(conversationId) {
    const payload = await getHomeDashboard();
    const entryPayload = this.getEntryPayload();
    const initialAccess = entryPayload.initialAccess;
    const hotQuestions = entryPayload.hotQuestions;
    const defaultQuestion = entryPayload.defaultQuestion;

    this.greetingText = initialAccess.text;

    this.setData({
      ...payload,
      hotQuestions,
      defaultQuestion,
      assistantMessage: initialAccess.text,
      messageInput: ''
    });

    const conversation = loadOrCreateConversation(conversationId, this.greetingText);

    this.activeConversation = conversation;
    this.widgetDrafts = {};
    this.applyConversation(conversation, false);
    this.syncHistoryState();
  },

  buildChoiceWidgetView(message) {
    const widget = message.widget || {};
    const draft = this.widgetDrafts && this.widgetDrafts[message.id]
      ? this.widgetDrafts[message.id]
      : {};
    const selectedValue = draft.value || '';

    return {
      ...widget,
      inputValue: draft.inputValue || '',
      options: (widget.options || []).map((item) => ({
        ...item,
        selected: selectedValue === item.value
      }))
    };
  },

  buildCalcCardWidgetView(message) {
    const widget = message.widget || {};
    const rawTrend = Array.isArray(widget.miniTrend) ? widget.miniTrend : [];
    const sourceValues = rawTrend
      .map((item) => Number(String(item).replace(/[^\d.-]/g, '')))
      .filter((item) => Number.isFinite(item));
    const values = sourceValues.length ? sourceValues : [44, 46, 45, 48, 47, 49, 48, 51, 50, 52];
    const chartValues = values.length >= 18
      ? values
      : values.reduce((result, value, index) => {
          if (index === 0) {
            result.push(value);
            return result;
          }

          const start = values[index - 1];
          const end = value;
          const drift = end - start;
          const baseRange = Math.max(...values) - Math.min(...values) || 8;
          const amplitude = Math.max(Math.min(baseRange * 0.08, 2.6), 0.9);

          for (let step = 1; step <= 3; step += 1) {
            const progress = step / 4;
            const wobbleBase = Math.sin(index * 1.37 + step * 1.11) + (Math.cos(index * 0.73 + step * 1.67) * 0.45);
            const nextValue = start + (drift * progress) + (wobbleBase * amplitude);

            result.push(nextValue);
          }

          result.push(end);
          return result;
        }, []);
    const minValue = Math.min(...chartValues);
    const maxValue = Math.max(...chartValues);
    const range = maxValue - minValue;
    const chartRatio = 0.34;
    const points = chartValues.map((value, index) => {
      const x = chartValues.length === 1
        ? 50
        : 4 + ((index * 92) / (chartValues.length - 1));
      const normalizedY = range === 0
        ? 50
        : 18 + ((value - minValue) / range) * 64;

      return {
        value,
        left: x,
        bottom: normalizedY,
        style: `left: calc(${x}% - 5rpx); bottom: calc(${normalizedY}% - 5rpx);`,
        active: index === chartValues.length - 1
      };
    });
    const segments = points.slice(0, -1).map((point, index) => {
      const nextPoint = points[index + 1];
      const dx = nextPoint.left - point.left;
      const dy = nextPoint.bottom - point.bottom;
      const width = Math.sqrt((dx * dx) + ((dy * chartRatio) * (dy * chartRatio)));
      const angle = Math.atan2(dy * chartRatio, dx) * (180 / Math.PI);

      return {
        style: [
          `left: ${point.left}%`,
          `bottom: calc(${point.bottom}% - 2rpx)`,
          `width: ${width}%`,
          `transform: rotate(${angle}deg)`
        ].join('; ')
      };
    });

    return {
      ...widget,
      miniTrendPoints: points,
      miniTrendSegments: segments,
      miniTrendGuides: ['22%', '50%', '78%']
    };
  },

  buildWidgetView(message) {
    const widget = message.widget || null;

    if (!widget) {
      return null;
    }

    if (widget.type === 'choices') {
      return this.buildChoiceWidgetView(message);
    }

    if (widget.type === 'calc-card') {
      return this.buildCalcCardWidgetView(message);
    }

    return widget;
  },

  buildRenderedMessages(messages) {
    return (messages || []).map((message) => ({
      ...message,
      renderedContent: message.role === 'assistant'
        ? renderMarkdown(message.content)
        : '',
      widgetView: this.buildWidgetView(message),
      followUpChipsView: Array.isArray(message.followUpChips)
        ? message.followUpChips
        : []
    }));
  },

  syncHistoryState() {
    const historyItems = listConversationSummaries().map((conversation) => ({
      ...conversation,
      updatedLabel: formatRelativeTime(conversation.updatedAt)
    }));

    this.setData({
      historyCount: historyItems.length,
      historyItems
    });
  },

  applyConversation(conversation, shouldScroll) {
    this.setData({
      conversationMessages: this.buildRenderedMessages(conversation.messages || []),
      activeConversationId: conversation.id || ''
    });

    if (shouldScroll) {
      this.scrollToBottom();
    }
  },

  scrollToBottom() {
    clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => {
      wx.pageScrollTo({
        scrollTop: 999999,
        duration: 0
      });
    }, 40);
  },

  toggleHistoryPanel() {
    this.syncHistoryState();
    this.setData({
      historyPanelVisible: !this.data.historyPanelVisible
    });
  },

  closeHistoryPanel() {
    if (!this.data.historyPanelVisible) {
      return;
    }

    this.setData({
      historyPanelVisible: false
    });
  },

  noop() {},

  openConversationFromPanel(event) {
    const { conversationId } = event.currentTarget.dataset;

    if (!conversationId) {
      return;
    }

    if (conversationId === this.data.activeConversationId) {
      this.closeHistoryPanel();
      return;
    }

    this.forceStopStream('\u5bf9\u8bdd\u5df2\u505c\u6b62');

    const conversation = getConversationById(conversationId);

    if (!conversation) {
      this.syncHistoryState();
      return;
    }

    setActiveConversationId(conversationId);
    this.activeConversation = conversation;
    this.widgetDrafts = {};
    this.setData({
      messageInput: '',
      selectedQuestionId: ''
    });
    this.applyConversation(conversation, true);
    this.closeHistoryPanel();
    this.syncHistoryState();
  },

  deleteConversationFromPanel(event) {
    const { conversationId } = event.currentTarget.dataset;

    if (!conversationId) {
      return;
    }

    const isActiveConversation = conversationId === this.data.activeConversationId;

    deleteConversationById(conversationId);

    if (isActiveConversation) {
      const conversation = createFreshConversation(this.greetingText || this.data.assistantMessage);

      this.activeConversation = conversation;
      this.applyConversation(conversation, false);
    }

    this.syncHistoryState();

    wx.showToast({
      title: '\u5df2\u5220\u9664',
      icon: 'none'
    });
  },

  clearHistoryPanel() {
    if (!this.data.historyItems.length) {
      return;
    }

    wx.showModal({
      title: '\u6e05\u7a7a\u5bf9\u8bdd\u5386\u53f2',
      content: '\u8fd9\u4f1a\u5220\u6389\u672c\u5730\u6240\u6709\u5bf9\u8bdd\u8bb0\u5f55\uff0c\u4e14\u4e0d\u53ef\u6062\u590d\u3002',
      success: ({ confirm }) => {
        if (!confirm) {
          return;
        }

        this.forceStopStream('\u5bf9\u8bdd\u5df2\u505c\u6b62');
        clearConversationHistory();
        const entryPayload = this.getEntryPayload();
        this.greetingText = entryPayload.initialAccess.text;

        const conversation = createFreshConversation(this.greetingText || this.data.assistantMessage);

        this.activeConversation = conversation;
        this.widgetDrafts = {};
        this.applyConversation(conversation, false);
        this.setData({
          historyPanelVisible: false,
          hotQuestions: entryPayload.hotQuestions,
          defaultQuestion: entryPayload.defaultQuestion,
          assistantMessage: entryPayload.initialAccess.text
        });
        this.syncHistoryState();

        wx.showToast({
          title: '\u5df2\u6e05\u7a7a',
          icon: 'none'
        });
      }
    });
  },

  handleNewChat() {
    this.forceStopStream('\u5bf9\u8bdd\u5df2\u505c\u6b62');
    cleanupEmptyConversation(this.activeConversation);
    const entryPayload = this.getEntryPayload();
    this.greetingText = entryPayload.initialAccess.text;

    const conversation = createFreshConversation(this.greetingText || this.data.assistantMessage);

    this.activeConversation = conversation;
    this.widgetDrafts = {};
    this.setData({
      historyPanelVisible: false,
      selectedQuestionId: '',
      messageInput: '',
      hotQuestions: entryPayload.hotQuestions,
      defaultQuestion: entryPayload.defaultQuestion,
      assistantMessage: entryPayload.initialAccess.text,
      isStreaming: false
    });

    this.applyConversation(conversation, false);
    this.syncHistoryState();
  },

  pickQuestion(event) {
    const { id, question } = event.currentTarget.dataset;
    const nextQuestion = String(question || '').trim();

    if (!nextQuestion) {
      return;
    }

    this.setData({
      selectedQuestionId: id,
      messageInput: nextQuestion
    });

    this.sendUserMessage(nextQuestion);
  },

  handleInput(event) {
    const value = event.detail.value;

    this.setData({
      messageInput: value,
      selectedQuestionId: ''
    });
  },

  async sendUserMessage(userText, resetComposer) {
    const nextUserText = String(userText || '').trim();

    if (!nextUserText || this.data.isStreaming || !this.activeConversation) {
      return;
    }

    const payload = appendTurnAndSave(this.activeConversation, nextUserText);
    const conversationId = payload.conversation.id;
    const guardId = `${conversationId}-${Date.now()}`;

    this.activeConversation = payload.conversation;
    this.currentStreamContext = {
      guardId,
      conversationId,
      assistantMessageId: payload.assistantMessageId,
      finalText: '',
      workingConversation: payload.conversation,
      controller: null,
      aborted: false
    };

    this.setData({
      messageInput: resetComposer === false ? this.data.messageInput : '',
      selectedQuestionId: '',
      isStreaming: true
    });

    this.applyConversation(payload.conversation, true);
    this.syncHistoryState();

    try {
      const controller = await streamConversationReply({
        conversation: payload.conversation,
        userMessage: nextUserText,
        onReady: ({ conversation }) => {
          const context = this.currentStreamContext;

          if (!context || context.guardId !== guardId || context.aborted || !conversation) {
            return;
          }

          context.workingConversation = conversation;

          if (this.data.activeConversationId === conversationId) {
            this.activeConversation = conversation;
            this.applyConversation(conversation, true);
          }
        },
        onDelta: (delta) => {
          const context = this.currentStreamContext;

          if (!context || context.guardId !== guardId || context.aborted) {
            return;
          }

          context.finalText += delta;
          context.workingConversation = patchStreamingAssistant(
            context.workingConversation,
            context.assistantMessageId,
            delta
          );

          if (this.data.activeConversationId === conversationId) {
            this.activeConversation = context.workingConversation;
            this.applyConversation(context.workingConversation, true);
          }
        },
        onComplete: (result) => {
          const context = this.currentStreamContext;

          if (!context || context.guardId !== guardId || context.aborted) {
            return;
          }

          context.workingConversation = saveCompletedAssistant(
            context.workingConversation,
            context.assistantMessageId,
            context.finalText,
            result && result.assistantExtra ? result.assistantExtra : null
          );

          if (this.data.activeConversationId === conversationId) {
            this.activeConversation = context.workingConversation;
            this.applyConversation(context.workingConversation, true);
          }

          this.currentStreamContext = null;
          this.setData({
            isStreaming: false
          });
          this.syncHistoryState();
        },
        onError: (error) => {
          const errorMessage = error && error.message
            ? error.message
            : '\u5bf9\u8bdd\u6682\u65f6\u4e2d\u65ad\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5';
          const context = this.currentStreamContext;

          if (!context || context.guardId !== guardId || context.aborted) {
            return;
          }

          context.workingConversation = saveFailedAssistant(
            context.workingConversation,
            context.assistantMessageId,
            errorMessage
          );

          if (this.data.activeConversationId === conversationId) {
            this.activeConversation = context.workingConversation;
            this.applyConversation(context.workingConversation, true);
          }

          this.currentStreamContext = null;
          this.setData({
            isStreaming: false
          });
          this.syncHistoryState();

          wx.showToast({
            title: errorMessage,
            icon: 'none'
          });
        }
      });

      const activeContext = this.currentStreamContext;

      if (activeContext && activeContext.guardId === guardId && !activeContext.aborted) {
        activeContext.controller = controller;
      }
    } catch (error) {
      this.currentStreamContext = null;
      this.setData({
        isStreaming: false
      });

      wx.showToast({
        title: error && error.message ? error.message : '\u5f53\u524d\u73af\u5883\u4e0d\u652f\u6301\u6d41\u5f0f\u5bf9\u8bdd',
        icon: 'none'
      });
    }
  },

  handleSend() {
    this.sendUserMessage(this.data.messageInput);
  },

  handleWidgetOptionTap(event) {
    const { fieldKey, value, messageId } = event.currentTarget.dataset;

    if (!fieldKey || !value) {
      return;
    }

    this.widgetDrafts[messageId] = {
      value,
      inputValue: ''
    };
    this.applyConversation(this.activeConversation, false);
    this.sendUserMessage(composeStructuredAnswerMessage(fieldKey, value));
  },

  handleWidgetInput(event) {
    const { messageId } = event.currentTarget.dataset;
    const value = event.detail.value;
    const previous = this.widgetDrafts[messageId] || {};

    this.widgetDrafts[messageId] = {
      ...previous,
      inputValue: value
    };
    this.applyConversation(this.activeConversation, false);
  },

  handleWidgetSubmit(event) {
    const { fieldKey, messageId } = event.currentTarget.dataset;
    const draft = this.widgetDrafts[messageId] || {};
    const value = String(draft.inputValue || '').trim();

    if (!fieldKey || !value) {
      wx.showToast({
        title: '\u8bf7\u5148\u8f93\u5165\u5185\u5bb9',
        icon: 'none'
      });
      return;
    }

    this.sendUserMessage(composeStructuredAnswerMessage(fieldKey, value));
  },

  handleWidgetActionTap(event) {
    const { actionType, messageText, link } = event.currentTarget.dataset;

    if (actionType === 'navigate-mini-program') {
      this.openMiniProgramLink(link);
      return;
    }

    if (actionType === 'send-message' && messageText) {
      this.sendUserMessage(messageText);
    }
  },

  handleMiniProgramCardTap(event) {
    const { link } = event.currentTarget.dataset;

    this.openMiniProgramLink(link);
  },

  openMiniProgramLink(link) {
    const nextLink = String(link || '').trim();

    if (!nextLink) {
      return;
    }

    if (typeof wx.navigateToMiniProgram === 'function') {
      wx.navigateToMiniProgram({
        shortLink: nextLink,
        fail: () => {
          wx.setClipboardData({
            data: nextLink
          });

          wx.showToast({
            title: '暂不支持直跳，已复制链接',
            icon: 'none'
          });
        }
      });
      return;
    }

    wx.setClipboardData({
      data: nextLink
    });

    wx.showToast({
      title: '当前环境不支持直跳，已复制链接',
      icon: 'none'
    });
  },

  handleFollowUpChipTap(event) {
    const { value } = event.currentTarget.dataset;

    if (!value) {
      return;
    }

    this.sendUserMessage(value);
  },

  forceStopStream(fallbackContent) {
    const context = this.currentStreamContext;

    if (!context) {
      return;
    }

    context.aborted = true;
    context.workingConversation = saveFailedAssistant(
      context.workingConversation,
      context.assistantMessageId,
      fallbackContent || '\u5bf9\u8bdd\u5df2\u505c\u6b62'
    );

    if (this.data.activeConversationId === context.conversationId) {
      this.activeConversation = context.workingConversation;
      this.applyConversation(context.workingConversation, true);
    }

    if (context.controller && typeof context.controller.abort === 'function') {
      context.controller.abort();
    }

    this.currentStreamContext = null;
    this.setData({
      isStreaming: false
    });
  }
});

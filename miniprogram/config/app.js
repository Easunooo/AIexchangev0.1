const APP_CONFIG = {
  brandName: '\u8de8\u5883\u6362\u6c47\u52a9\u624b',
  tagline: '\u5148\u642d\u524d\u7aef\u4e0e\u5bf9\u8bdd\u67b6\u6784\uff0c\u518d\u9010\u6b65\u63a5\u5165 AI \u7b56\u7565\u4e0e\u771f\u5b9e\u6c47\u7387\u63a5\u53e3',
  defaultQuestion: '\u7f8e\u5143\u5151\u6362\u4eba\u6c11\u5e01\u6c47\u7387\u662f\u591a\u5c11\uff1f',
  storageKeys: {
    recentPlanDraft: 'recent-plan-draft',
    activeConversationId: 'chat-active-conversation-id',
    conversationIndex: 'chat-conversation-index',
    conversationPrefix: 'chat-conversation:'
  },
  chat: {
    transport: 'auto',
    allowDirectInDevtools: true,
    localProxyBaseUrl: 'http://127.0.0.1:8787',
    remoteProxyBaseUrl: 'https://mini-program-chat-proxy.easunooo.workers.dev',
    proxyBaseUrl: '',
    directBaseUrl: 'https://api.deepseek.com',
    deepseekApiKey: 'sk-f08040b1a51a4081a725726e1c94890d',
    defaultModel: 'deepseek-chat',
    requestTimeoutMs: 180000,
    maxContextMessages: 24
  }
};

module.exports = {
  APP_CONFIG
};

const { APP_CONFIG } = require('../../config/app');
const { buildMemoryMessages } = require('../../utils/chat');
const { buildAgentStrategy } = require('../../utils/exchange-agent');

function resolveChatStrategy(conversation, userMessage, options) {
  const strategy = buildAgentStrategy({
    conversation,
    userMessage,
    strategyContext: conversation && conversation.strategyContext
      ? conversation.strategyContext
      : {},
    pastQueries: [],
    decisionContextHints: options && options.decisionContextHints
      ? options.decisionContextHints
      : null
  });

  return {
    ...strategy,
    mode: strategy.mode || 'model',
    model: APP_CONFIG.chat.defaultModel || strategy.model || 'deepseek-chat',
    temperature: strategy.temperature == null ? 0.3 : strategy.temperature,
    maxTokens: strategy.maxTokens || 1024
  };
}

function buildProviderMessages(conversation, strategy) {
  const messages = [];

  if (strategy.systemPrompt) {
    messages.push({
      role: 'system',
      content: strategy.systemPrompt
    });
  }

  return messages.concat(
    buildMemoryMessages(conversation, APP_CONFIG.chat.maxContextMessages)
  );
}

module.exports = {
  buildProviderMessages,
  resolveChatStrategy
};

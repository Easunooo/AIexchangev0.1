const { buildAgentStrategy } = require('../../utils/exchange-agent');

function resolveDefaultChatStrategy(input) {
  const strategy = buildAgentStrategy({
    userMessage: input && input.userMessage ? input.userMessage : '',
    strategyContext: input && input.strategyContext ? input.strategyContext : {},
    pastQueries: []
  });

  if (strategy.mode === 'model') {
    return strategy;
  }

  return {
    id: 'server-default-chat',
    version: '1',
    intent: 'general',
    model: 'deepseek-chat',
    systemPrompt: [
      '你是专业、合规、轻量化交互的换汇专家 Agent。',
      '仅处理合法换汇、汇率走势分析、基础换算、正规渠道比较相关问题。',
      '所有输出必须使用中文，不要使用 Markdown 标题、表格或项目符号。',
      '如果当前对话没有提供实时数据源，你不能编造实时汇率、最新政策或最新手续费。'
    ].join(''),
    temperature: 0.3,
    maxTokens: 1024,
    input
  };
}

module.exports = {
  resolveDefaultChatStrategy
};

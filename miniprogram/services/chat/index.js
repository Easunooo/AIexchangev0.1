const { APP_CONFIG } = require('../../config/app');
const {
  applyStrategyPatch,
  appendAssistantDelta,
  appendUserTurn,
  buildConversationSummary,
  buildMemoryMessages,
  clone,
  createConversation,
  failAssistantMessage,
  finalizeAssistantMessage,
  isConversationEmpty
} = require('../../utils/chat');
const { createSseParser, createUtf8ChunkDecoder } = require('../../utils/sse');
const { buildProviderMessages, resolveChatStrategy } = require('./strategy');

function getRuntimePlatform() {
  if (typeof wx === 'undefined' || typeof wx.getSystemInfoSync !== 'function') {
    return '';
  }

  try {
    const systemInfo = wx.getSystemInfoSync();
    return systemInfo && systemInfo.platform ? systemInfo.platform : '';
  } catch (error) {
    return '';
  }
}

function isDevtoolsRuntime() {
  return getRuntimePlatform() === 'devtools';
}

function resolveRuntimeTransport() {
  const configuredTransport = APP_CONFIG.chat.transport || 'auto';

  if (configuredTransport !== 'auto') {
    return configuredTransport;
  }

  if (isDevtoolsRuntime() && APP_CONFIG.chat.allowDirectInDevtools) {
    return 'direct';
  }

  return 'proxy';
}

function resolveProxyBaseUrl() {
  if (isDevtoolsRuntime()) {
    return (
      APP_CONFIG.chat.localProxyBaseUrl ||
      APP_CONFIG.chat.proxyBaseUrl ||
      ''
    ).replace(/\/$/, '');
  }

  return (
    APP_CONFIG.chat.remoteProxyBaseUrl ||
    APP_CONFIG.chat.proxyBaseUrl ||
    ''
  ).replace(/\/$/, '');
}

function getErrorMessage(error) {
  if (!error) {
    return '';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error.message) {
    return error.message;
  }

  if (error.errMsg) {
    return error.errMsg;
  }

  return '';
}

function requestJson(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      success(response) {
        if (response.statusCode >= 400) {
          const message = typeof response.data === 'string'
            ? response.data
            : ((response.data && response.data.error && response.data.error.message) || `HTTP ${response.statusCode}`);

          reject(new Error(message));
          return;
        }

        resolve(response.data);
      },
      fail(error) {
        reject(new Error(getErrorMessage(error) || '请求失败'));
      }
    });
  });
}

function formatCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function extractJsonObject(text) {
  const source = String(text || '').trim();

  if (!source) {
    return null;
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    const match = source.match(/\{[\s\S]*\}/);

    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch (innerError) {
      return null;
    }
  }
}

function normalizeDecisionContextHints(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const targetCurrency = String(source.targetCurrency || '').trim().toUpperCase();
  const usageScene = String(source.usageScene || '').trim();
  const exchangeWindow = String(source.exchangeWindow || '').trim();
  const amount = String(source.amount || '').trim();
  const allowedScenes = ['出境出行', '留学', '跨境汇款', '投资', '外贸结算'];
  const allowedWindows = ['3天内', '1周到1个月', '1个月以上', '还没定'];

  return {
    targetCurrency: /^[A-Z]{3}$/.test(targetCurrency) ? targetCurrency : '',
    amount,
    exchangeWindow: allowedWindows.includes(exchangeWindow) ? exchangeWindow : '',
    usageScene: allowedScenes.includes(usageScene) ? usageScene : '',
    usageSceneConfirmed: Boolean(source.usageSceneConfirmed && allowedScenes.includes(usageScene))
  };
}

function buildDecisionContextInferenceMessages(userMessage, conversation) {
  const exchangeAgent = conversation && conversation.strategyContext && conversation.strategyContext.exchangeAgent
    ? conversation.strategyContext.exchangeAgent
    : {};
  const currentData = exchangeAgent && exchangeAgent.collectedData ? exchangeAgent.collectedData : {};

  return [
    {
      role: 'system',
      content: [
        '你是换汇工作流的字段抽取器，只返回 JSON，不要输出解释。',
        `今天日期：${formatCurrentDate()}。`,
        '请从用户原话和已有上下文中抽取这些字段：targetCurrency、amount、exchangeWindow、usageScene、usageSceneConfirmed。',
        'targetCurrency 必须是 3 位币种代码；如果用户说了明确国家/地区或留学/旅游目的地，且常用结算币种非常明确，可以直接推断。',
        'amount 保留用户表达里的金额文本；没有就返回空字符串。',
        'exchangeWindow 只能返回：3天内、1周到1个月、1个月以上、还没定、空字符串。',
        'usageScene 只能返回：出境出行、留学、跨境汇款、投资、外贸结算、空字符串。',
        '只要常识层面足够明确就直接填，不要过度保守；不确定才返回空字符串。',
        '如果 usageScene 非空，usageSceneConfirmed 设为 true，否则设为 false。',
        '示例1：我想4月去西班牙玩，如何换汇 -> {"targetCurrency":"EUR","amount":"","exchangeWindow":"1周到1个月","usageScene":"出境出行","usageSceneConfirmed":true}',
        '示例2：我想下个月去日本旅游，怎么换汇 -> {"targetCurrency":"JPY","amount":"","exchangeWindow":"1周到1个月","usageScene":"出境出行","usageSceneConfirmed":true}',
        '示例3：我想给英国学校汇学费 -> {"targetCurrency":"GBP","amount":"","exchangeWindow":"","usageScene":"留学","usageSceneConfirmed":true}',
        '严格返回一行 JSON，例如 {"targetCurrency":"EUR","amount":"","exchangeWindow":"1周到1个月","usageScene":"出境出行","usageSceneConfirmed":true}。'
      ].join(' ')
    },
    {
      role: 'user',
      content: JSON.stringify({
        userMessage: String(userMessage || ''),
        currentData
      })
    }
  ];
}

function shouldRequestDecisionContextInference(conversation, userMessage) {
  const text = String(userMessage || '').trim();
  const exchangeAgent = conversation && conversation.strategyContext && conversation.strategyContext.exchangeAgent
    ? conversation.strategyContext.exchangeAgent
    : {};
  const stage = exchangeAgent && exchangeAgent.stage ? exchangeAgent.stage : 'idle';

  if (!text || /^【已答】/.test(text)) {
    return false;
  }

  if (stage !== 'idle' && stage !== 'clarify_scene') {
    return false;
  }

  return /(换汇|购汇|结汇|汇款|旅游|旅行|留学|出境|机票|酒店|签证|学费)/.test(text);
}

async function inferDecisionContextViaProxy(conversation, userMessage) {
  const proxyBaseUrl = resolveProxyBaseUrl();

  if (!proxyBaseUrl) {
    return null;
  }

  const response = await requestJson({
    url: `${proxyBaseUrl}/api/chat/decision-context`,
    method: 'POST',
    timeout: APP_CONFIG.chat.requestTimeoutMs,
    header: {
      'content-type': 'application/json'
    },
    data: {
      conversationId: conversation && conversation.id ? conversation.id : '',
      userMessage,
      strategyContext: conversation && conversation.strategyContext ? conversation.strategyContext : {}
    }
  });

  return normalizeDecisionContextHints(response);
}

async function inferDecisionContextViaDirect(conversation, userMessage) {
  if (!APP_CONFIG.chat.deepseekApiKey) {
    return null;
  }

  const response = await requestJson({
    url: `${APP_CONFIG.chat.directBaseUrl.replace(/\/$/, '')}/chat/completions`,
    method: 'POST',
    timeout: APP_CONFIG.chat.requestTimeoutMs,
    header: {
      'content-type': 'application/json',
      Authorization: `Bearer ${APP_CONFIG.chat.deepseekApiKey}`
    },
    data: {
      model: APP_CONFIG.chat.defaultModel || 'deepseek-chat',
      temperature: 0,
      max_tokens: 220,
      messages: buildDecisionContextInferenceMessages(userMessage, conversation)
    }
  });

  const content = response
    && response.choices
    && response.choices[0]
    && response.choices[0].message
    && response.choices[0].message.content
    ? response.choices[0].message.content
    : '';

  return normalizeDecisionContextHints(extractJsonObject(content));
}

async function resolveDecisionContextHints(conversation, userMessage) {
  if (!shouldRequestDecisionContextInference(conversation, userMessage)) {
    return null;
  }

  try {
    if (resolveRuntimeTransport() === 'direct') {
      return await inferDecisionContextViaDirect(conversation, userMessage);
    }

    return await inferDecisionContextViaProxy(conversation, userMessage);
  } catch (error) {
    return null;
  }
}

function getConversationStorageKey(conversationId) {
  return `${APP_CONFIG.storageKeys.conversationPrefix}${conversationId}`;
}

function readConversationIndex() {
  const raw = wx.getStorageSync(APP_CONFIG.storageKeys.conversationIndex);
  return Array.isArray(raw) ? raw : [];
}

function writeConversationIndex(nextIndex) {
  wx.setStorageSync(APP_CONFIG.storageKeys.conversationIndex, nextIndex);
}

function saveConversation(conversation) {
  const nextConversation = clone(conversation);
  const index = readConversationIndex();

  wx.setStorageSync(getConversationStorageKey(nextConversation.id), nextConversation);

  if (!index.includes(nextConversation.id)) {
    writeConversationIndex([nextConversation.id].concat(index));
  }

  return nextConversation;
}

function getConversationById(conversationId) {
  if (!conversationId) {
    return null;
  }

  const conversation = wx.getStorageSync(getConversationStorageKey(conversationId));
  return conversation && conversation.id ? conversation : null;
}

function deleteConversationById(conversationId) {
  if (!conversationId) {
    return;
  }

  const nextIndex = readConversationIndex().filter((item) => item !== conversationId);
  const activeConversationId = getActiveConversationId();

  wx.removeStorageSync(getConversationStorageKey(conversationId));
  writeConversationIndex(nextIndex);

  if (activeConversationId === conversationId) {
    wx.removeStorageSync(APP_CONFIG.storageKeys.activeConversationId);
  }
}

function clearConversationHistory() {
  const conversationIds = readConversationIndex();

  conversationIds.forEach((conversationId) => {
    wx.removeStorageSync(getConversationStorageKey(conversationId));
  });

  writeConversationIndex([]);
  wx.removeStorageSync(APP_CONFIG.storageKeys.activeConversationId);
}

function listConversationSummaries() {
  return readConversationIndex()
    .map((conversationId) => getConversationById(conversationId))
    .filter(Boolean)
    .filter((conversation) => !isConversationEmpty(conversation))
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((conversation) => buildConversationSummary(conversation));
}

function listRecentUserQueries(limit, maxAgeMs) {
  const now = Date.now();
  const ageLimit = typeof maxAgeMs === 'number' ? maxAgeMs : (7 * 24 * 60 * 60 * 1000);
  const collected = [];

  readConversationIndex()
    .map((conversationId) => getConversationById(conversationId))
    .filter(Boolean)
    .forEach((conversation) => {
      (conversation.messages || []).forEach((message) => {
        if (!message || message.role !== 'user') {
          return;
        }

        if (message.createdAt && now - message.createdAt > ageLimit) {
          return;
        }

        const content = String(message.content || '').trim();

        if (!content || /^【已答】/.test(content)) {
          return;
        }

        collected.push({
          content,
          createdAt: message.createdAt || conversation.updatedAt || 0
        });
      });
    });

  return collected
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, limit || 20)
    .map((item) => item.content);
}

function setActiveConversationId(conversationId) {
  if (!conversationId) {
    wx.removeStorageSync(APP_CONFIG.storageKeys.activeConversationId);
    return;
  }

  wx.setStorageSync(APP_CONFIG.storageKeys.activeConversationId, conversationId);
}

function getActiveConversationId() {
  return wx.getStorageSync(APP_CONFIG.storageKeys.activeConversationId) || '';
}

function createStoredConversation(greeting) {
  const conversation = saveConversation(createConversation(greeting));
  setActiveConversationId(conversation.id);
  return conversation;
}

function loadOrCreateConversation(conversationId, greeting) {
  const targetConversationId = conversationId || getActiveConversationId();
  const existingConversation = getConversationById(targetConversationId);

  if (existingConversation) {
    setActiveConversationId(existingConversation.id);
    return existingConversation;
  }

  return createStoredConversation(greeting);
}

function createFreshConversation(greeting) {
  return createStoredConversation(greeting);
}

function cleanupEmptyConversation(conversation) {
  if (!conversation || !isConversationEmpty(conversation)) {
    return;
  }

  deleteConversationById(conversation.id);
}

function appendTurnAndSave(conversation, userText) {
  const payload = appendUserTurn(conversation, userText);
  const nextConversation = saveConversation(payload.conversation);

  setActiveConversationId(nextConversation.id);

  return {
    conversation: nextConversation,
    assistantMessageId: payload.assistantMessageId
  };
}

function saveFailedAssistant(conversation, assistantMessageId, errorMessage) {
  return saveConversation(failAssistantMessage(conversation, assistantMessageId, errorMessage));
}

function saveCompletedAssistant(conversation, assistantMessageId, finalContent, assistantExtra) {
  return saveConversation(finalizeAssistantMessage(
    conversation,
    assistantMessageId,
    finalContent,
    assistantExtra
  ));
}

function patchStreamingAssistant(conversation, assistantMessageId, delta) {
  return appendAssistantDelta(conversation, assistantMessageId, delta);
}

function applyResolvedStrategy(conversation, strategy) {
  if (!strategy) {
    return saveConversation(conversation);
  }

  return saveConversation(applyStrategyPatch(
    conversation,
    strategy.strategyContextPatch || null,
    strategy.metaPatch || null
  ));
}

async function createStreamRequestPayload(conversation, userMessage) {
  const decisionContextHints = await resolveDecisionContextHints(conversation, userMessage);
  const strategy = resolveChatStrategy(conversation, userMessage, {
    decisionContextHints
  });
  const preparedConversation = applyResolvedStrategy(conversation, strategy);

  return {
    strategy,
    preparedConversation,
    proxyPayload: {
      conversationId: preparedConversation.id,
      userMessage,
      messages: buildMemoryMessages(preparedConversation, APP_CONFIG.chat.maxContextMessages),
      strategyContext: preparedConversation.strategyContext || {},
      strategy: {
        id: strategy.id || '',
        model: strategy.model,
        temperature: strategy.temperature,
        maxTokens: strategy.maxTokens,
        systemPrompt: strategy.systemPrompt || ''
      }
    },
    directPayload: {
      model: strategy.model,
      stream: true,
      temperature: strategy.temperature,
      max_tokens: strategy.maxTokens,
      messages: buildProviderMessages(preparedConversation, strategy)
    }
  };
}

async function streamConversationReply(options) {
  const {
    conversation,
    userMessage,
    onDelta,
    onComplete,
    onError,
    onReady
  } = options;
  const payload = await createStreamRequestPayload(conversation, userMessage);
  const preparedConversation = payload.preparedConversation;
  const decoder = createUtf8ChunkDecoder();
  const parser = createSseParser((event) => {
    if (!event || event.event !== 'message' || !event.data) {
      return;
    }

    if (event.data === '[DONE]') {
      return;
    }

    try {
      const chunk = JSON.parse(event.data);
      const choice = chunk.choices && chunk.choices[0] ? chunk.choices[0] : {};
      const delta = choice.delta && choice.delta.content ? choice.delta.content : '';
      const finishReason = choice.finish_reason || '';
      const usage = chunk.usage || null;

      if (delta) {
        onDelta(delta);
      }

      if (finishReason) {
        onComplete({
          finishReason,
          usage,
          assistantExtra: payload.strategy && payload.strategy.response
            ? {
                widget: payload.strategy.response.widget || null,
                followUpChips: payload.strategy.response.followUpChips || [],
                miniProgramCard: payload.strategy.response.miniProgramCard || null
              }
            : null
        });
      }
    } catch (error) {
      onError(error);
    }
  });

  let completed = false;
  let receivedChunk = false;
  let requestTask = null;
  const transport = resolveRuntimeTransport();
  const proxyBaseUrl = resolveProxyBaseUrl();

  if (typeof onReady === 'function') {
    onReady({
      strategy: payload.strategy,
      conversation: preparedConversation
    });
  }

  if (payload.strategy && payload.strategy.mode === 'local') {
    const localContent = payload.strategy.response && payload.strategy.response.content
      ? String(payload.strategy.response.content)
      : '';

    if (localContent) {
      onDelta(localContent);
    }

    onComplete({
      finishReason: 'stop',
      assistantExtra: payload.strategy && payload.strategy.response
        ? {
            widget: payload.strategy.response.widget || null,
            followUpChips: payload.strategy.response.followUpChips || [],
            miniProgramCard: payload.strategy.response.miniProgramCard || null
          }
        : null
    });

    return {
      abort() {}
    };
  }

  if (
    transport === 'direct' &&
    !APP_CONFIG.chat.deepseekApiKey
  ) {
    throw new Error('Missing DeepSeek API key in config/app.js');
  }

  if (transport === 'proxy' && !proxyBaseUrl) {
    throw new Error(
      isDevtoolsRuntime()
        ? '缺少本地代理地址，请在 config/app.js 配置 localProxyBaseUrl'
        : '真机需要 HTTPS 代理域名，请在 config/app.js 配置 remoteProxyBaseUrl，并加入小程序合法域名'
    );
  }

  function finishError(error) {
    if (completed) {
      return;
    }

    completed = true;
    onError(error);
  }

  function finishSuccess(result) {
    if (completed) {
      return;
    }

    completed = true;
    onComplete(result || {});
  }

  requestTask = wx.request({
    url: transport === 'direct'
      ? `${APP_CONFIG.chat.directBaseUrl}/chat/completions`
      : `${proxyBaseUrl}/api/chat/stream`,
    method: 'POST',
    timeout: APP_CONFIG.chat.requestTimeoutMs,
    enableChunked: true,
    header: transport === 'direct'
      ? {
          'content-type': 'application/json',
          Authorization: `Bearer ${APP_CONFIG.chat.deepseekApiKey}`
        }
      : {
          'content-type': 'application/json'
        },
    data: transport === 'direct' ? payload.directPayload : payload.proxyPayload,
    success(response) {
      if (response.statusCode >= 400) {
        const errorMessage = typeof response.data === 'string'
          ? response.data
          : ((response.data && response.data.error && response.data.error.message) || '\u5bf9\u8bdd\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528');

        finishError(new Error(errorMessage));
        return;
      }

      parser.push(decoder.flush());
      parser.flush();

      if (!completed) {
        finishSuccess({});
      }
    },
    fail(error) {
      finishError(new Error(getErrorMessage(error) || '\u5bf9\u8bdd\u8bf7\u6c42\u5931\u8d25'));
    }
  });

  if (!requestTask || typeof requestTask.onChunkReceived !== 'function') {
    throw new Error('\u5f53\u524d\u5c0f\u7a0b\u5e8f\u57fa\u7840\u5e93\u4e0d\u652f\u6301 chunk \u6d41\u5f0f\u8bf7\u6c42');
  }

  requestTask.onChunkReceived((chunk) => {
    receivedChunk = true;
    parser.push(decoder.decode(chunk.data));
  });

  if (typeof requestTask.onHeadersReceived === 'function') {
    requestTask.onHeadersReceived((headers) => {
      if (headers.statusCode >= 400 && !receivedChunk) {
        finishError(new Error(`HTTP ${headers.statusCode}`));
      }
    });
  }

  return {
    abort() {
      if (requestTask && typeof requestTask.abort === 'function') {
        requestTask.abort();
      }
    }
  };
}

module.exports = {
  appendTurnAndSave,
  cleanupEmptyConversation,
  clearConversationHistory,
  createFreshConversation,
  deleteConversationById,
  getActiveConversationId,
  getConversationById,
  isConversationEmpty,
  listRecentUserQueries,
  listConversationSummaries,
  loadOrCreateConversation,
  patchStreamingAssistant,
  saveCompletedAssistant,
  saveConversation,
  saveFailedAssistant,
  setActiveConversationId,
  streamConversationReply
};

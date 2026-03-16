const { CHAT_ROLES, MESSAGE_STATUS, STREAMING_PLACEHOLDER } = require('../constants/chat');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepMerge(target, patch) {
  const base = target && typeof target === 'object' ? target : {};
  const nextPatch = patch && typeof patch === 'object' ? patch : {};
  const result = Array.isArray(base) ? base.slice() : { ...base };

  Object.keys(nextPatch).forEach((key) => {
    const value = nextPatch[key];

    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], value);
      return;
    }

    result[key] = value;
  });

  return result;
}

function generateId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createMessage(role, content, extra) {
  return {
    id: generateId('msg'),
    role,
    content: content || '',
    createdAt: Date.now(),
    status: MESSAGE_STATUS.READY,
    ...extra
  };
}

function getFirstUserMessage(conversation) {
  return (conversation.messages || []).find((message) => message.role === CHAT_ROLES.USER) || null;
}

function trimTitle(content) {
  const source = String(content || '').trim().replace(/\s+/g, ' ');

  if (!source) {
    return '\u65b0\u5efa\u5bf9\u8bdd';
  }

  if (source.length <= 18) {
    return source;
  }

  return `${source.slice(0, 18)}...`;
}

function deriveConversationTitle(conversation) {
  const firstUserMessage = getFirstUserMessage(conversation);
  return trimTitle(firstUserMessage ? firstUserMessage.content : '');
}

function touchConversation(conversation) {
  return {
    ...conversation,
    title: deriveConversationTitle(conversation),
    updatedAt: Date.now()
  };
}

function createConversation(greeting, strategyContext) {
  const createdAt = Date.now();
  const messages = greeting
    ? [
        createMessage(CHAT_ROLES.ASSISTANT, greeting)
      ]
    : [];

  return {
    id: generateId('conv'),
    title: '\u65b0\u5efa\u5bf9\u8bdd',
    createdAt,
    updatedAt: createdAt,
    messages,
    strategyContext: {
      scene: 'exchange-chat',
      ...strategyContext
    },
    meta: {
      strategyId: 'default-chat',
      intent: 'general',
      model: 'deepseek-chat'
    }
  };
}

function appendUserTurn(conversation, userText) {
  const nextConversation = clone(conversation);
  const userMessage = createMessage(CHAT_ROLES.USER, String(userText || '').trim());
  const assistantMessage = createMessage(CHAT_ROLES.ASSISTANT, STREAMING_PLACEHOLDER, {
    status: MESSAGE_STATUS.STREAMING
  });

  nextConversation.messages.push(userMessage, assistantMessage);

  return {
    conversation: touchConversation(nextConversation),
    assistantMessageId: assistantMessage.id
  };
}

function patchAssistantMessage(conversation, messageId, updater) {
  const nextConversation = clone(conversation);
  const nextMessages = nextConversation.messages.map((message) => {
    if (message.id !== messageId) {
      return message;
    }

    return {
      ...message,
      ...updater(message)
    };
  });

  nextConversation.messages = nextMessages;
  return touchConversation(nextConversation);
}

function finalizeAssistantMessage(conversation, messageId, content, extra) {
  return patchAssistantMessage(conversation, messageId, (message) => ({
    content: String(content || '').trim() || message.content,
    status: MESSAGE_STATUS.READY,
    ...(extra || {})
  }));
}

function failAssistantMessage(conversation, messageId, fallbackContent) {
  return patchAssistantMessage(conversation, messageId, (message) => ({
    content: String(message.content || '').trim() === STREAMING_PLACEHOLDER
      ? fallbackContent
      : message.content,
    status: MESSAGE_STATUS.ERROR
  }));
}

function appendAssistantDelta(conversation, messageId, delta) {
  return patchAssistantMessage(conversation, messageId, (message) => ({
    content: message.content === STREAMING_PLACEHOLDER
      ? delta
      : `${message.content}${delta}`,
    status: MESSAGE_STATUS.STREAMING
  }));
}

function applyStrategyPatch(conversation, strategyContextPatch, metaPatch) {
  if (!strategyContextPatch && !metaPatch) {
    return clone(conversation);
  }

  const nextConversation = clone(conversation);

  nextConversation.strategyContext = deepMerge(
    nextConversation.strategyContext || {},
    strategyContextPatch || {}
  );
  nextConversation.meta = deepMerge(
    nextConversation.meta || {},
    metaPatch || {}
  );

  return touchConversation(nextConversation);
}

function buildMemoryMessages(conversation, maxMessages) {
  const messages = (conversation.messages || [])
    .filter((message) => (
      message.role === CHAT_ROLES.USER ||
      message.role === CHAT_ROLES.ASSISTANT ||
      message.role === CHAT_ROLES.SYSTEM
    ))
    .filter((message) => String(message.content || '').trim())
    .map((message) => ({
      role: message.role,
      content: message.content
    }));

  if (!maxMessages || messages.length <= maxMessages) {
    return messages;
  }

  return messages.slice(-maxMessages);
}

function isConversationEmpty(conversation) {
  const userMessages = (conversation.messages || []).filter((message) => message.role === CHAT_ROLES.USER);
  return userMessages.length === 0;
}

function buildConversationSummary(conversation) {
  const messages = conversation.messages || [];
  const lastMessage = messages[messages.length - 1] || null;

  return {
    id: conversation.id,
    title: conversation.title || deriveConversationTitle(conversation),
    updatedAt: conversation.updatedAt,
    createdAt: conversation.createdAt,
    preview: lastMessage ? lastMessage.content : '',
    messageCount: messages.length
  };
}

function formatRelativeTime(timestamp) {
  if (!timestamp) {
    return '';
  }

  const now = Date.now();
  const diff = Math.max(now - timestamp, 0);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) {
    return '\u521a\u521a';
  }

  if (diff < hour) {
    return `${Math.floor(diff / minute)}\u5206\u949f\u524d`;
  }

  if (diff < day) {
    return `${Math.floor(diff / hour)}\u5c0f\u65f6\u524d`;
  }

  return `${Math.floor(diff / day)}\u5929\u524d`;
}

module.exports = {
  appendAssistantDelta,
  appendUserTurn,
  buildConversationSummary,
  buildMemoryMessages,
  clone,
  createConversation,
  createMessage,
  deriveConversationTitle,
  applyStrategyPatch,
  deepMerge,
  failAssistantMessage,
  finalizeAssistantMessage,
  formatRelativeTime,
  isConversationEmpty,
  touchConversation
};

const CHAT_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system'
};

const MESSAGE_STATUS = {
  READY: 'ready',
  STREAMING: 'streaming',
  ERROR: 'error'
};

const STREAMING_PLACEHOLDER = '\u6b63\u5728\u601d\u8003...';

module.exports = {
  CHAT_ROLES,
  MESSAGE_STATUS,
  STREAMING_PLACEHOLDER
};

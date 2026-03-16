const { resolveDefaultChatStrategy } = require('./default');

async function resolveChatStrategy(input) {
  return resolveDefaultChatStrategy(input);
}

module.exports = {
  resolveChatStrategy
};

const mockExchange = require('../../mocks/exchange');

function wait(duration) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

async function getHomeDashboard() {
  await wait(120);
  return mockExchange.getHomeDashboard();
}

async function getPlannerPagePayload(initialPlanKey) {
  await wait(120);
  return mockExchange.getPlannerPagePayload(initialPlanKey);
}

module.exports = {
  getHomeDashboard,
  getPlannerPagePayload
};

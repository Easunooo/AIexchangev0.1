function resolvePlanKey(planKey, scenarios, order) {
  if (planKey && scenarios[planKey]) {
    return planKey;
  }

  if (Array.isArray(order) && order.length > 0 && scenarios[order[0]]) {
    return order[0];
  }

  const keys = Object.keys(scenarios || {});
  return keys[0] || '';
}

function createPlannerState(planKey) {
  return {
    planKey,
    stepIndex: 0,
    answers: {}
  };
}

function getCurrentStep(scenario, stepIndex) {
  if (!scenario || !Array.isArray(scenario.steps)) {
    return null;
  }

  return scenario.steps[stepIndex] || null;
}

function toAnswerChips(scenario, answers) {
  if (!scenario || !Array.isArray(scenario.steps)) {
    return [];
  }

  return scenario.steps
    .filter((step) => answers[step.key])
    .map((step) => ({
      key: step.key,
      label: step.label,
      value: answers[step.key]
    }));
}

function applyAnswer(state, scenario, rawValue) {
  const currentStep = getCurrentStep(scenario, state.stepIndex);
  const value = String(rawValue || '').trim();

  if (!currentStep || !value) {
    return state;
  }

  return {
    planKey: state.planKey,
    stepIndex: state.stepIndex + 1,
    answers: {
      ...state.answers,
      [currentStep.key]: value
    }
  };
}

function rollbackAnswer(state, scenario) {
  if (!scenario || state.stepIndex === 0) {
    return state;
  }

  const nextStepIndex = state.stepIndex - 1;
  const nextAnswers = {
    ...state.answers
  };
  const previousStep = scenario.steps[nextStepIndex];

  if (previousStep) {
    delete nextAnswers[previousStep.key];
  }

  return {
    planKey: state.planKey,
    stepIndex: nextStepIndex,
    answers: nextAnswers
  };
}

function buildPlanSummary(scenario, answers) {
  const chips = toAnswerChips(scenario, answers);

  if (chips.length === 0) {
    return '暂未收集到计划信息。';
  }

  return chips.map((item) => `${item.label}: ${item.value}`).join('；');
}

module.exports = {
  applyAnswer,
  buildPlanSummary,
  createPlannerState,
  getCurrentStep,
  resolvePlanKey,
  rollbackAnswer,
  toAnswerChips
};

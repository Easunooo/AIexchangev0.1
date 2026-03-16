const {
  applyAnswer,
  buildPlanSummary,
  createPlannerState,
  getCurrentStep,
  resolvePlanKey,
  rollbackAnswer,
  toAnswerChips
} = require('../../utils/planner');

const TAB_ART = {
  travel: {
    artClass: 'planner-tab-art-travel',
    artPath: '/travel.svg'
  },
  study: {
    artClass: 'planner-tab-art-study',
    artPath: '/education.svg'
  },
  invest: {
    artClass: 'planner-tab-art-invest',
    artPath: '/investment.svg'
  },
  remit: {
    artClass: 'planner-tab-art-remit',
    artPath: '/pay.svg'
  }
};

const AMOUNT_UNIT = 'CNY';

function normalizeAmountValue(value) {
  const source = String(value || '');
  const cleaned = source.replace(/[^\d.]/g, '');
  const hasDigit = /\d/.test(cleaned);

  if (!hasDigit) {
    return {
      display: '',
      answer: ''
    };
  }

  const dotIndex = cleaned.indexOf('.');
  const hasDot = dotIndex !== -1;
  let integerPart = hasDot ? cleaned.slice(0, dotIndex) : cleaned;
  const decimalPart = hasDot
    ? cleaned.slice(dotIndex + 1).replace(/\./g, '').slice(0, 2)
    : '';

  integerPart = integerPart.replace(/^0+(?=\d)/, '');
  integerPart = integerPart || '0';

  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const display = hasDot
    ? `${groupedInteger}${decimalPart ? `.${decimalPart}` : '.'}`
    : groupedInteger;
  const answer = decimalPart
    ? `${groupedInteger}.${decimalPart} ${AMOUNT_UNIT}`
    : `${groupedInteger} ${AMOUNT_UNIT}`;

  return {
    display,
    answer
  };
}

Component({
  options: {
    styleIsolation: 'shared'
  },

  properties: {
    scenarios: {
      type: Object,
      value: {}
    },
    order: {
      type: Array,
      value: []
    },
    initialPlanKey: {
      type: String,
      value: ''
    },
    autoSelectFirst: {
      type: Boolean,
      value: false
    },
    resetToken: {
      type: Number,
      value: 0
    }
  },

  data: {
    amountPlaceholder: '10,000',
    amountUnitLabel: AMOUNT_UNIT,
    backLabel: '\u8fd4\u56de',
    confirmLabel: '\u786e\u5b9a',
    generatePlanLabel: '\u751f\u6210\u6362\u6c47\u8ba1\u5212',
    planKey: '',
    stepIndex: 0,
    answers: {},
    otherValue: '',
    currentScenario: null,
    currentStep: null,
    isAmountStep: false,
    isLastQuestion: false,

    planList: [],
    isCompleted: false,
    summary: ''
  },

  lifetimes: {
    attached() {
      this.bootstrap();
    }
  },

  observers: {
    'scenarios, order, initialPlanKey, autoSelectFirst, resetToken': function bootstrapObserver() {
      this.bootstrap();
    }
  },

  methods: {
    bootstrap() {
      const { scenarios, order, initialPlanKey, autoSelectFirst } = this.properties;
      const planKey = initialPlanKey
        ? resolvePlanKey(initialPlanKey, scenarios, order)
        : (autoSelectFirst ? resolvePlanKey('', scenarios, order) : '');

      this.syncView(createPlannerState(planKey));
    },

    syncView(state) {
      const { scenarios, order, autoSelectFirst } = this.properties;
      const hasSelectedPlan = Boolean(state.planKey && scenarios[state.planKey]);
      const planKey = hasSelectedPlan
        ? state.planKey
        : (autoSelectFirst ? resolvePlanKey('', scenarios, order) : '');
      const scenario = planKey ? scenarios[planKey] : null;
      const currentStep = getCurrentStep(scenario, state.stepIndex);
      const isLastQuestion = Boolean(
        scenario &&
        currentStep &&
        Array.isArray(scenario.steps) &&
        state.stepIndex === scenario.steps.length - 1
      );
      const isAmountStep = Boolean(currentStep && currentStep.key === 'amount');

      const summary = buildPlanSummary(scenario, state.answers);
      const planList = (order || []).map((key) => ({
        key,
        tabTop: scenarios[key] ? scenarios[key].tabTop : '',
        tabLabel: scenarios[key] ? scenarios[key].tabLabel : '',
        artClass: TAB_ART[key] ? TAB_ART[key].artClass : '',
        artPath: TAB_ART[key] ? TAB_ART[key].artPath : '',
        active: key === planKey
      }));

      this.setData({
        planKey,
        stepIndex: state.stepIndex,
        answers: hasSelectedPlan ? state.answers : {},
        otherValue: '',
        currentScenario: scenario,
        currentStep,
        isAmountStep,
        isLastQuestion,

        planList,
        isCompleted: Boolean(scenario) && !currentStep,
        summary: scenario ? summary : ''
      });
    },

    switchScenario(event) {
      const planKey = event.currentTarget.dataset.planKey;

      if (!planKey || planKey === this.data.planKey) {
        return;
      }

      this.syncView(createPlannerState(planKey));
      this.triggerEvent('change', {
        planKey
      });
    },

    chooseOption(event) {
      const value = event.currentTarget.dataset.value;
      this.submitValue(value);
    },

    inputOther(event) {
      const value = event.detail.value;

      if (this.data.isAmountStep) {
        this.setData({
          otherValue: normalizeAmountValue(value).display
        });
        return;
      }

      this.setData({
        otherValue: value
      });
    },

    submitOther() {
      const value = this.data.isAmountStep
        ? normalizeAmountValue(this.data.otherValue).answer
        : this.data.otherValue;

      this.submitValue(value);
    },

    submitValue(value) {
      const scenario = this.data.currentScenario;
      const nextValue = this.data.isAmountStep
        ? normalizeAmountValue(value).answer
        : value;

      if (!scenario) {
        return;
      }

      const currentState = {
        planKey: this.data.planKey,
        stepIndex: this.data.stepIndex,
        answers: this.data.answers
      };
      const nextState = applyAnswer(
        currentState,
        scenario,
        nextValue
      );

      if (nextState === currentState) {
        return;
      }

      if (!getCurrentStep(scenario, nextState.stepIndex)) {
        this.finishPlan(nextState, scenario);
        return;
      }

      this.syncView(nextState);
    },

    goBack() {
      if (!this.data.currentScenario) {
        return;
      }

      if (this.data.stepIndex === 0) {
        this.syncView(createPlannerState(''));
        return;
      }

      const nextState = rollbackAnswer(
        {
          planKey: this.data.planKey,
          stepIndex: this.data.stepIndex,
          answers: this.data.answers
        },
        this.data.currentScenario
      );

      this.syncView(nextState);
    },

    completePlan() {
      if (!this.data.currentScenario) {
        return;
      }

      this.finishPlan(
        {
          planKey: this.data.planKey,
          stepIndex: this.data.stepIndex,
          answers: this.data.answers
        },
        this.data.currentScenario
      );
    },

    finishPlan(state, scenario) {
      if (!scenario) {
        return;
      }

      const summary = buildPlanSummary(scenario, state.answers);

      this.triggerEvent('complete', {
        planKey: state.planKey,
        title: scenario.title,
        summary,
        answers: state.answers
      });

      this.syncView(createPlannerState(''));
    }
  }
});

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
    planKey: '',
    stepIndex: 0,
    answers: {},
    otherValue: '',
    currentScenario: null,
    currentStep: null,
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
      this.setData({
        otherValue: event.detail.value
      });
    },

    submitOther() {
      this.submitValue(this.data.otherValue);
    },

    submitValue(value) {
      const scenario = this.data.currentScenario;

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
        value
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

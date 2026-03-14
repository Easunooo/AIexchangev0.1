const planScenarios = {
  travel: {
    label: "旅游换汇计划",
    intro: "已进入旅游换汇计划。我会从底部逐轮确认国家、金额、DDL，再补充大致出行日期。",
    completeText: "旅游换汇基础信息已确认，下一步可以继续生成旅游场景建议。",
    steps: [
      {
        key: "country",
        label: "国家",
        prompt: "你准备去哪个国家或地区？",
        options: ["日本", "泰国", "新加坡", "欧洲"],
        otherPlaceholder: "填写其他目的地"
      },
      {
        key: "amount",
        label: "金额",
        prompt: "本次旅游大致准备换多少金额？",
        options: ["5,000 CNY", "10,000 CNY", "20,000 CNY", "50,000 CNY"],
        otherPlaceholder: "填写其他金额"
      },
      {
        key: "ddl",
        label: "DDL",
        prompt: "最晚希望在哪个时间点前完成换汇？",
        options: ["本周内", "两周内", "本月内", "下个月"],
        otherPlaceholder: "填写其他截止时间"
      },
      {
        key: "travelDate",
        label: "出行日期",
        prompt: "大致出行日期是什么时候？",
        options: ["清明前后", "五一假期", "暑期", "国庆假期"],
        otherPlaceholder: "填写其他出行时间"
      }
    ]
  },
  study: {
    label: "留学换汇计划",
    intro: "已进入留学换汇计划。我会逐轮确认留学国家、金额和最早用汇 DDL。",
    completeText: "留学换汇基础信息已确认，下一步可以继续生成留学场景建议。",
    steps: [
      {
        key: "country",
        label: "国家",
        prompt: "你的留学国家或地区是哪里？",
        options: ["英国", "美国", "澳大利亚", "加拿大"],
        otherPlaceholder: "填写其他留学国家"
      },
      {
        key: "amount",
        label: "金额",
        prompt: "首笔换汇预算大概是多少？",
        options: ["30,000 CNY", "80,000 CNY", "120,000 CNY", "200,000 CNY"],
        otherPlaceholder: "填写其他金额"
      },
      {
        key: "ddl",
        label: "DDL",
        prompt: "最早需要用汇的截止时间是？",
        options: ["本月底", "1个月内", "2个月内", "开学前"],
        otherPlaceholder: "填写其他 DDL"
      }
    ]
  },
  invest: {
    label: "投资换汇计划",
    intro: "已进入投资换汇计划。我会先确认目标国家、金额和你的换汇 DDL。",
    completeText: "投资换汇基础信息已确认，下一步可以继续生成投资场景建议。",
    steps: [
      {
        key: "country",
        label: "国家",
        prompt: "你主要面向哪个国家或市场换汇？",
        options: ["美国", "中国香港", "新加坡", "英国"],
        otherPlaceholder: "填写其他市场"
      },
      {
        key: "amount",
        label: "金额",
        prompt: "本轮计划投入多少资金？",
        options: ["20,000 CNY", "50,000 CNY", "100,000 CNY", "300,000 CNY"],
        otherPlaceholder: "填写其他金额"
      },
      {
        key: "ddl",
        label: "DDL",
        prompt: "你希望最晚何时前完成换汇？",
        options: ["3天内", "本周内", "本月内", "等窗口期"],
        otherPlaceholder: "填写其他 DDL"
      }
    ]
  },
  remit: {
    label: "跨境汇款计划",
    intro: "已进入跨境汇款计划。我会逐轮确认收款国家、金额和到账 DDL。",
    completeText: "跨境汇款基础信息已确认，下一步可以继续生成汇款场景建议。",
    steps: [
      {
        key: "country",
        label: "国家",
        prompt: "收款方所在国家或地区是哪里？",
        options: ["美国", "加拿大", "中国香港", "日本"],
        otherPlaceholder: "填写其他收款地"
      },
      {
        key: "amount",
        label: "金额",
        prompt: "这次预计汇出多少金额？",
        options: ["10,000 CNY", "30,000 CNY", "50,000 CNY", "100,000 CNY"],
        otherPlaceholder: "填写其他金额"
      },
      {
        key: "ddl",
        label: "DDL",
        prompt: "最晚希望什么时候到账？",
        options: ["3天内", "1周内", "本月底前", "越快越好"],
        otherPlaceholder: "填写其他到账时间"
      }
    ]
  }
};

const plannerState = {
  planKey: null,
  stepIndex: 0,
  answers: {}
};

const planTabs = document.querySelectorAll(".plan-tab");
const questionButtons = document.querySelectorAll(".question-item");
const planFlow = document.getElementById("planFlow");
const plannerThread = document.getElementById("plannerThread");
const plannerChoices = document.getElementById("plannerChoices");
const plannerChoicesLabel = document.getElementById("plannerChoicesLabel");
const planOptions = document.getElementById("planOptions");
const planOtherInput = document.getElementById("planOtherInput");
const planOtherSubmit = document.getElementById("planOtherSubmit");
const planComplete = document.getElementById("planComplete");
const questionPreview = document.getElementById("questionPreview");
const questionPreviewText = questionPreview.querySelector("p");
const messageInput = document.getElementById("messageInput");

function getCurrentPlan() {
  return plannerState.planKey ? planScenarios[plannerState.planKey] : null;
}

function createBubble(role, text) {
  const bubble = document.createElement("div");
  const content = document.createElement("p");

  bubble.className = `thread-bubble ${role}`;
  content.textContent = text;
  bubble.appendChild(content);

  return bubble;
}

function renderThread(plan, currentStep) {
  plannerThread.innerHTML = "";
  plannerThread.appendChild(createBubble("user", `我想创建${plan.label}`));
  plannerThread.appendChild(createBubble("assistant", plan.intro));

  plan.steps.forEach((step, index) => {
    if (index >= plannerState.stepIndex) {
      return;
    }

    plannerThread.appendChild(createBubble("assistant", step.prompt));
    plannerThread.appendChild(createBubble("user", plannerState.answers[step.key]));
  });

  if (currentStep) {
    plannerThread.appendChild(
      createBubble("assistant", `第 ${plannerState.stepIndex + 1} 轮：${currentStep.prompt}`)
    );
  }
}

function renderOptions(step) {
  planOptions.innerHTML = "";

  step.options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "choice-chip";
    button.type = "button";
    button.textContent = option;
    button.addEventListener("click", () => {
      submitAnswer(option);
    });
    planOptions.appendChild(button);
  });
}

function renderPlanner() {
  const plan = getCurrentPlan();

  if (!plan) {
    return;
  }

  const currentStep = plan.steps[plannerState.stepIndex];

  planFlow.classList.remove("is-hidden");
  planFlow.setAttribute("aria-hidden", "false");
  questionPreview.classList.add("is-hidden");
  renderThread(plan, currentStep);

  if (currentStep) {
    plannerChoices.classList.remove("is-hidden");
    planComplete.classList.add("is-hidden");
    plannerChoicesLabel.textContent = `${plan.label} · 第 ${plannerState.stepIndex + 1} 轮`;
    planOtherInput.value = "";
    planOtherInput.placeholder = currentStep.otherPlaceholder;
    renderOptions(currentStep);
    return;
  }

  plannerChoices.classList.add("is-hidden");
  planComplete.classList.remove("is-hidden");
}

function openPlan(planKey) {
  plannerState.planKey = planKey;
  plannerState.stepIndex = 0;
  plannerState.answers = {};

  planTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.plan === planKey);
  });

  renderPlanner();
}

function submitAnswer(value) {
  const plan = getCurrentPlan();

  if (!plan || plannerState.stepIndex >= plan.steps.length) {
    return;
  }

  const currentStep = plan.steps[plannerState.stepIndex];
  const nextValue = value.trim();

  if (!nextValue) {
    return;
  }

  plannerState.answers[currentStep.key] = nextValue;
  plannerState.stepIndex += 1;
  renderPlanner();
}

planTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    openPlan(tab.dataset.plan);
  });
});

planOtherSubmit.addEventListener("click", () => {
  submitAnswer(planOtherInput.value);
});

planOtherInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    submitAnswer(planOtherInput.value);
  }
});

questionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const question = button.dataset.question;

    questionButtons.forEach((item) => {
      item.classList.toggle("is-selected", item === button);
    });

    plannerState.planKey = null;
    plannerState.stepIndex = 0;
    plannerState.answers = {};
    planTabs.forEach((tab) => {
      tab.classList.remove("is-active");
    });
    planFlow.classList.add("is-hidden");
    planFlow.setAttribute("aria-hidden", "true");
    questionPreview.classList.remove("is-hidden");
    questionPreviewText.textContent = question;
    messageInput.value = question;
  });
});

messageInput.addEventListener("input", () => {
  const nextValue = messageInput.value.trim();
  questionPreviewText.textContent = nextValue || "美元兑换人民币汇率";
});

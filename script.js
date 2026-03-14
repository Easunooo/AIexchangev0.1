const planScenarios = {
  travel: {
    label: "旅游换汇计划",
    title: "先确认国家、金额、DDL，再补充大致出行日期",
    steps: [
      {
        key: "country",
        label: "国家",
        prompt: "你的旅游目的地是哪个国家或地区？",
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
    title: "先确认留学国家、金额和首个关键 DDL",
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
    title: "先确认目标国家、金额和你的换汇 DDL",
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
    title: "先确认收款国家、金额和到账 DDL",
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
const planLabel = document.getElementById("planLabel");
const planTitle = document.getElementById("planTitle");
const plannerStepBadge = document.getElementById("plannerStepBadge");

const plannerQuestion = document.getElementById("plannerQuestion");
const plannerChoices = document.getElementById("plannerChoices");
const plannerChoicesLabel = document.getElementById("plannerChoicesLabel");
const planOptions = document.getElementById("planOptions");
const planOtherInput = document.getElementById("planOtherInput");
const planOtherSubmit = document.getElementById("planOtherSubmit");
const planComplete = document.getElementById("planComplete");
const planBackBtn = document.getElementById("planBackBtn");
const questionPreviewText = document.getElementById("questionPreview").querySelector("p");
const messageInput = document.getElementById("messageInput");

function getCurrentPlan() {
  return plannerState.planKey ? planScenarios[plannerState.planKey] : null;
}


function renderOptions(step) {
  planOptions.innerHTML = "";

  step.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.className = "choice-chip";
    button.type = "button";
    button.textContent = option;
    button.style.animationDelay = `${index * 0.05}s`;
    button.style.animation = "scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both";
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

  // Re-trigger animation by removing and adding class
  planFlow.classList.add("is-hidden");
  void planFlow.offsetWidth; // Force reflow
  planFlow.classList.remove("is-hidden");

  planFlow.setAttribute("aria-hidden", "false");
  planLabel.textContent = plan.label;
  planTitle.textContent = plan.title;

  if (currentStep) {
    planBackBtn.classList.toggle("is-hidden", plannerState.stepIndex === 0);
    plannerStepBadge.textContent = `第 ${plannerState.stepIndex + 1} 轮`;
    plannerQuestion.textContent = currentStep.prompt;
    plannerChoices.classList.remove("is-hidden");
    planComplete.classList.add("is-hidden");
    plannerChoicesLabel.textContent = "请选择一个选项，或填写其他";
    planOtherInput.value = "";
    planOtherInput.placeholder = currentStep.otherPlaceholder;
    renderOptions(currentStep);

    // Scroll card into view if it's a mobile layout
    if (window.innerWidth < 440) {
      planFlow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return;
  }

  planBackBtn.classList.remove("is-hidden");
  plannerStepBadge.textContent = "已确认";
  plannerQuestion.textContent = "基础信息已确认，点击下方按钮生成你的换汇计划。";
  plannerChoices.classList.add("is-hidden");
  planComplete.classList.remove("is-hidden");
}

function goBack() {
  if (plannerState.stepIndex > 0) {
    plannerState.stepIndex -= 1;
    // Remove the answer for the step we are going back to
    const plan = getCurrentPlan();
    if (plan && plan.steps[plannerState.stepIndex]) {
      delete plannerState.answers[plan.steps[plannerState.stepIndex].key];
    }
    renderPlanner();
  }
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

planBackBtn.addEventListener("click", () => {
  goBack();
});

questionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const question = button.dataset.question;

    questionButtons.forEach((item) => {
      item.classList.toggle("is-selected", item === button);
    });

    questionPreviewText.textContent = question;
    messageInput.value = question;
  });
});

messageInput.addEventListener("input", () => {
  const nextValue = messageInput.value.trim();
  questionPreviewText.textContent = nextValue || "美元兑换人民币汇率";
});

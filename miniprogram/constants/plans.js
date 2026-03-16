const PLAN_ORDER = ['travel', 'study', 'invest', 'remit'];

const PLAN_SCENARIOS = {
  travel: {
    key: 'travel',
    tabTop: '出行前',
    tabLabel: '旅游',
    planLabel: '旅游换汇计划',
    title: '先确认国家、金额、DDL，再补充大致出行日期',
    steps: [
      {
        key: 'country',
        label: '国家',
        prompt: '你的旅游目的地是哪个国家或地区？',
        options: ['日本', '泰国', '新加坡', '欧洲'],
        otherPlaceholder: '填写其他目的地'
      },
      {
        key: 'amount',
        label: '金额',
        prompt: '本次旅游大致准备换多少金额？',
        options: ['5,000 CNY', '10,000 CNY', '20,000 CNY', '50,000 CNY'],
        otherPlaceholder: '填写其他金额'
      },
      {
        key: 'ddl',
        label: 'DDL',
        prompt: '最晚希望在哪个时间点前完成换汇？',
        options: ['本周内', '两周内', '本月内', '下个月'],
        otherPlaceholder: '填写其他截止时间'
      },
      {
        key: 'travelDate',
        label: '出行日期',
        prompt: '大致出行日期是什么时候？',
        options: ['清明前后', '五一假期', '暑期', '国庆假期'],
        otherPlaceholder: '填写其他出行时间'
      }
    ]
  },
  study: {
    key: 'study',
    tabTop: '学费前',
    tabLabel: '留学',
    planLabel: '留学换汇计划',
    title: '先确认留学国家、金额和首个关键 DDL',
    steps: [
      {
        key: 'country',
        label: '国家',
        prompt: '你的留学国家或地区是哪里？',
        options: ['英国', '美国', '澳大利亚', '加拿大'],
        otherPlaceholder: '填写其他留学国家'
      },
      {
        key: 'amount',
        label: '金额',
        prompt: '首笔换汇预算大概是多少？',
        options: ['30,000 CNY', '80,000 CNY', '120,000 CNY', '200,000 CNY'],
        otherPlaceholder: '填写其他金额'
      },
      {
        key: 'ddl',
        label: 'DDL',
        prompt: '最早需要用汇的截止时间是？',
        options: ['本月底', '1个月内', '2个月内', '开学前'],
        otherPlaceholder: '填写其他 DDL'
      }
    ]
  },
  invest: {
    key: 'invest',
    tabTop: '配置前',
    tabLabel: '投资',
    planLabel: '投资换汇计划',
    title: '先确认目标国家、金额和你的换汇 DDL',
    steps: [
      {
        key: 'country',
        label: '国家',
        prompt: '你主要面向哪个国家或市场换汇？',
        options: ['美国', '中国香港', '新加坡', '英国'],
        otherPlaceholder: '填写其他市场'
      },
      {
        key: 'amount',
        label: '金额',
        prompt: '本轮计划投入多少资金？',
        options: ['20,000 CNY', '50,000 CNY', '100,000 CNY', '300,000 CNY'],
        otherPlaceholder: '填写其他金额'
      },
      {
        key: 'ddl',
        label: 'DDL',
        prompt: '你希望最晚何时前完成换汇？',
        options: ['3天内', '本周内', '本月内', '等窗口期'],
        otherPlaceholder: '填写其他 DDL'
      }
    ]
  },
  remit: {
    key: 'remit',
    tabTop: '到账前',
    tabLabel: '跨境汇款',
    planLabel: '跨境汇款计划',
    title: '先确认收款国家、金额和到账 DDL',
    steps: [
      {
        key: 'country',
        label: '国家',
        prompt: '收款方所在国家或地区是哪里？',
        options: ['美国', '加拿大', '中国香港', '日本'],
        otherPlaceholder: '填写其他收款地'
      },
      {
        key: 'amount',
        label: '金额',
        prompt: '这次预计汇出多少金额？',
        options: ['10,000 CNY', '30,000 CNY', '50,000 CNY', '100,000 CNY'],
        otherPlaceholder: '填写其他金额'
      },
      {
        key: 'ddl',
        label: 'DDL',
        prompt: '最晚希望什么时候到账？',
        options: ['3天内', '1周内', '本月底前', '越快越好'],
        otherPlaceholder: '填写其他到账时间'
      }
    ]
  }
};

module.exports = {
  PLAN_ORDER,
  PLAN_SCENARIOS
};

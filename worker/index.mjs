const DEFAULT_MODEL = 'deepseek-chat';

function writeJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    }
  });
}

function buildCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };
}

function resolveChatStrategy(input) {
  return {
    id: 'default-chat',
    version: '1',
    intent: 'general',
    model: DEFAULT_MODEL,
    temperature: 0.4,
    maxTokens: 1024,
    systemPrompt: [
      '你是一个微信小程序内的换汇与跨境金融助手。',
      '优先给出直接、结构清楚的答复，尽量结合用户已有对话上下文。',
      '如果问题和换汇、汇率、跨境支付、留学缴费、旅行、投资相关，要优先给出可执行建议。',
      '不要自称调用了系统或策略流水线，答复保持自然。'
    ].join(''),
    input
  };
}

function resolveRequestStrategy(body) {
  const forwarded = body && body.strategy ? body.strategy : null;

  if (forwarded && typeof forwarded === 'object' && String(forwarded.systemPrompt || '').trim()) {
    return {
      id: forwarded.id || 'forwarded-chat',
      version: '1',
      intent: 'forwarded',
      model: forwarded.model || DEFAULT_MODEL,
      temperature: forwarded.temperature == null ? 0.4 : forwarded.temperature,
      maxTokens: forwarded.maxTokens || 1024,
      systemPrompt: String(forwarded.systemPrompt || '')
    };
  }

  return resolveChatStrategy({
    conversationId: body.conversationId || '',
    messages: body.messages || [],
    userMessage: body.userMessage || '',
    strategyContext: body.strategyContext || {}
  });
}

function buildProviderMessages(body, strategy) {
  const messages = [];
  const history = Array.isArray(body.messages) ? body.messages : [];

  if (strategy.systemPrompt) {
    messages.push({
      role: 'system',
      content: strategy.systemPrompt
    });
  }

  history.forEach((message) => {
    if (!message || !message.role || !String(message.content || '').trim()) {
      return;
    }

    messages.push({
      role: message.role,
      content: String(message.content)
    });
  });

  return messages;
}

function extractJsonObject(text) {
  const source = String(text || '').trim();

  if (!source) {
    return null;
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    const match = source.match(/\{[\s\S]*\}/);

    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch (innerError) {
      return null;
    }
  }
}

function normalizeDecisionContextHints(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const targetCurrency = String(source.targetCurrency || '').trim().toUpperCase();
  const usageScene = String(source.usageScene || '').trim();
  const exchangeWindow = String(source.exchangeWindow || '').trim();
  const amount = String(source.amount || '').trim();
  const allowedScenes = ['出境出行', '留学', '跨境汇款', '投资', '外贸结算'];
  const allowedWindows = ['3天内', '1周到1个月', '1个月以上', '还没定'];

  return {
    targetCurrency: /^[A-Z]{3}$/.test(targetCurrency) ? targetCurrency : '',
    amount,
    exchangeWindow: allowedWindows.includes(exchangeWindow) ? exchangeWindow : '',
    usageScene: allowedScenes.includes(usageScene) ? usageScene : '',
    usageSceneConfirmed: Boolean(source.usageSceneConfirmed && allowedScenes.includes(usageScene))
  };
}

function formatCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDecisionContextInferenceMessages(body) {
  return [
    {
      role: 'system',
      content: [
        '你是换汇工作流的字段抽取器，只返回 JSON，不要输出解释。',
        `今天日期：${formatCurrentDate()}。`,
        '请从用户原话和已有上下文中抽取这些字段：targetCurrency、amount、exchangeWindow、usageScene、usageSceneConfirmed。',
        'targetCurrency 必须是 3 位币种代码；如果用户说了明确国家/地区或留学/旅游目的地，且常用结算币种非常明确，可以直接推断。',
        'amount 保留用户表达里的金额文本；没有就返回空字符串。',
        'exchangeWindow 只能返回：3天内、1周到1个月、1个月以上、还没定、空字符串。',
        'usageScene 只能返回：出境出行、留学、跨境汇款、投资、外贸结算、空字符串。',
        '只要常识层面足够明确就直接填，不要过度保守；不确定才返回空字符串。',
        '如果 usageScene 非空，usageSceneConfirmed 设为 true，否则设为 false。',
        '示例1：我想4月去西班牙玩，如何换汇 -> {"targetCurrency":"EUR","amount":"","exchangeWindow":"1周到1个月","usageScene":"出境出行","usageSceneConfirmed":true}',
        '示例2：我想下个月去日本旅游，怎么换汇 -> {"targetCurrency":"JPY","amount":"","exchangeWindow":"1周到1个月","usageScene":"出境出行","usageSceneConfirmed":true}',
        '示例3：我想给英国学校汇学费 -> {"targetCurrency":"GBP","amount":"","exchangeWindow":"","usageScene":"留学","usageSceneConfirmed":true}',
        '严格返回一行 JSON，例如 {"targetCurrency":"EUR","amount":"","exchangeWindow":"1周到1个月","usageScene":"出境出行","usageSceneConfirmed":true}。'
      ].join(' ')
    },
    {
      role: 'user',
      content: JSON.stringify({
        userMessage: body && body.userMessage ? body.userMessage : '',
        currentData: body && body.strategyContext && body.strategyContext.exchangeAgent
          ? (body.strategyContext.exchangeAgent.collectedData || {})
          : {}
      })
    }
  ];
}

async function proxyChatStream(request, env) {
  if (!env.DEEPSEEK_API_KEY) {
    return writeJson({
      error: {
        message: 'Missing DEEPSEEK_API_KEY in Cloudflare Worker secret.'
      }
    }, 500);
  }

  const body = await request.json();
  const strategy = resolveRequestStrategy(body);
  const providerPayload = {
    model: strategy.model || DEFAULT_MODEL,
    stream: true,
    temperature: strategy.temperature,
    max_tokens: strategy.maxTokens,
    messages: buildProviderMessages(body, strategy)
  };
  const upstreamResponse = await fetch(
    `${(env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(providerPayload)
    }
  );

  if (!upstreamResponse.ok) {
    const errorText = await upstreamResponse.text();

    return writeJson({
      error: {
        message: errorText || 'DeepSeek upstream request failed.'
      }
    }, upstreamResponse.status);
  }

  return new Response(upstreamResponse.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      ...buildCorsHeaders()
    }
  });
}

async function inferDecisionContext(request, env) {
  if (!env.DEEPSEEK_API_KEY) {
    return writeJson({
      error: {
        message: 'Missing DEEPSEEK_API_KEY in Cloudflare Worker secret.'
      }
    }, 500);
  }

  const body = await request.json();
  const upstreamResponse = await fetch(
    `${(env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        stream: false,
        temperature: 0,
        max_tokens: 220,
        messages: buildDecisionContextInferenceMessages(body)
      })
    }
  );

  if (!upstreamResponse.ok) {
    const errorText = await upstreamResponse.text();

    return writeJson({
      error: {
        message: errorText || 'DeepSeek inference request failed.'
      }
    }, upstreamResponse.status);
  }

  const upstreamPayload = await upstreamResponse.json();
  const content = upstreamPayload
    && upstreamPayload.choices
    && upstreamPayload.choices[0]
    && upstreamPayload.choices[0].message
    && upstreamPayload.choices[0].message.content
    ? upstreamPayload.choices[0].message.content
    : '';

  return writeJson(normalizeDecisionContextHints(extractJsonObject(content)));
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: buildCorsHeaders()
        });
      }

      if (request.method === 'GET' && url.pathname === '/health') {
        return writeJson({
          ok: true,
          runtime: 'cloudflare-worker',
          hasApiKey: Boolean(env.DEEPSEEK_API_KEY)
        });
      }

      if (request.method === 'POST' && url.pathname === '/api/chat/stream') {
        return proxyChatStream(request, env);
      }

      if (request.method === 'POST' && url.pathname === '/api/chat/decision-context') {
        return inferDecisionContext(request, env);
      }

      return writeJson({
        error: {
          message: 'Route not found.'
        }
      }, 404);
    } catch (error) {
      return writeJson({
        error: {
          message: error && error.message ? error.message : 'Unknown worker error.'
        }
      }, 500);
    }
  }
};

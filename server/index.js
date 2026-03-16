const http = require('http');
const { URL } = require('url');
const { loadServerConfig } = require('./config');
const { resolveChatStrategy } = require('./strategies');

const config = loadServerConfig();

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(payload));
}

function collectJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';

    request.on('data', (chunk) => {
      raw += chunk.toString('utf8');
    });

    request.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });

    request.on('error', reject);
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

function resolveRequestStrategy(body) {
  const forwarded = body && body.strategy ? body.strategy : null;

  if (forwarded && typeof forwarded === 'object' && String(forwarded.systemPrompt || '').trim()) {
    return {
      id: forwarded.id || 'forwarded-chat',
      model: forwarded.model || 'deepseek-chat',
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

async function proxyChatStream(request, response, body) {
  if (!config.deepseekApiKey) {
    writeJson(response, 500, {
      error: {
        message: 'Missing DEEPSEEK_API_KEY in server environment.'
      }
    });
    return;
  }

  const strategy = await resolveRequestStrategy(body);
  const controller = new AbortController();
  const providerPayload = {
    model: strategy.model || 'deepseek-chat',
    stream: true,
    temperature: strategy.temperature,
    max_tokens: strategy.maxTokens,
    messages: buildProviderMessages(body, strategy)
  };

  request.on('close', () => {
    controller.abort();
  });

  const upstreamResponse = await fetch(`${config.deepseekBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.deepseekApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(providerPayload),
    signal: controller.signal
  });

  if (!upstreamResponse.ok) {
    const errorText = await upstreamResponse.text();

    writeJson(response, upstreamResponse.status, {
      error: {
        message: errorText || 'DeepSeek upstream request failed.'
      }
    });
    return;
  }

  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  for await (const chunk of upstreamResponse.body) {
    if (response.writableEnded) {
      break;
    }

    response.write(chunk);
  }

  if (!response.writableEnded) {
    response.end();
  }
}

async function inferDecisionContext(response, body) {
  if (!config.deepseekApiKey) {
    writeJson(response, 500, {
      error: {
        message: 'Missing DEEPSEEK_API_KEY in server environment.'
      }
    });
    return;
  }

  const upstreamResponse = await fetch(`${config.deepseekBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.deepseekApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      stream: false,
      temperature: 0,
      max_tokens: 220,
      messages: buildDecisionContextInferenceMessages(body)
    })
  });

  if (!upstreamResponse.ok) {
    const errorText = await upstreamResponse.text();

    writeJson(response, upstreamResponse.status, {
      error: {
        message: errorText || 'DeepSeek inference request failed.'
      }
    });
    return;
  }

  const upstreamPayload = await upstreamResponse.json();
  const content = upstreamPayload
    && upstreamPayload.choices
    && upstreamPayload.choices[0]
    && upstreamPayload.choices[0].message
    && upstreamPayload.choices[0].message.content
    ? upstreamPayload.choices[0].message.content
    : '';

  writeJson(response, 200, normalizeDecisionContextHints(extractJsonObject(content)));
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    });
    response.end();
    return;
  }

  try {
    if (request.method === 'GET' && requestUrl.pathname === '/health') {
      writeJson(response, 200, {
        ok: true,
        hasApiKey: Boolean(config.deepseekApiKey)
      });
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/chat/stream') {
      const body = await collectJsonBody(request);
      await proxyChatStream(request, response, body);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/chat/decision-context') {
      const body = await collectJsonBody(request);
      await inferDecisionContext(response, body);
      return;
    }

    writeJson(response, 404, {
      error: {
        message: 'Route not found.'
      }
    });
  } catch (error) {
    writeJson(response, 500, {
      error: {
        message: error && error.message ? error.message : 'Unknown server error.'
      }
    });
  }
});

server.listen(config.port, () => {
  console.log(`[chat-proxy] listening on http://127.0.0.1:${config.port}`);
});

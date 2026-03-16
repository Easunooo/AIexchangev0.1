# Cloudflare Workers 部署

## 当前结构

- 本地开发者工具默认仍可直连 DeepSeek。
- 真机和预览环境应改走 Cloudflare Worker 代理。
- Worker 入口在 [worker/index.mjs](/d:/原型图/worker/index.mjs)。

## 本地调试 Worker

1. 复制 `.dev.vars.example` 为 `.dev.vars`
2. 填入 `DEEPSEEK_API_KEY`
3. 执行：

```bash
npm run dev:worker
```

默认会在 `http://127.0.0.1:8787` 启动本地 Worker 预览。

## 首次登录 Cloudflare

```bash
npm run cf:login
```

## 配置线上密钥

```bash
npm run cf:secret
```

按提示输入 `DEEPSEEK_API_KEY`。

如需额外修改模型服务地址，可在 `wrangler.jsonc` 中调整 `DEEPSEEK_BASE_URL`。

## 部署

```bash
npm run deploy:worker
```

部署完成后，Cloudflare 会返回一个 `https://<worker>.<subdomain>.workers.dev` 地址。

## 接到小程序

1. 把 Worker 地址填到 [config/app.js](/d:/原型图/config/app.js) 的 `remoteProxyBaseUrl`
2. 到微信公众平台把这个域名加入 `request 合法域名`
3. 重新上传预览或真机调试

示例：

```js
remoteProxyBaseUrl: 'https://mini-program-chat-proxy.your-subdomain.workers.dev'
```

## 检查健康状态

部署后可访问：

```text
https://你的-worker-域名/health
```

正常会返回：

```json
{"ok":true,"runtime":"cloudflare-worker","hasApiKey":true}
```

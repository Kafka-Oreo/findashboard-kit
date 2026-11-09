/**
 * LLM 客户端（OpenAI 兼容协议）
 *
 * 本模块是对原 coze-coding-dev-sdk 的无侵入替换，保持相同的调用签名
 * （Config / HeaderUtils / LLMClient.stream），业务路由只需改一行 import。
 *
 * 通过环境变量配置任意 OpenAI 兼容服务（OpenAI / DeepSeek / 豆包 Ark /
 * 通义 / 本地 Ollama 等）：
 *   LLM_BASE_URL  例：https://api.deepseek.com/v1
 *   LLM_API_KEY   服务密钥
 *   LLM_MODEL     模型名（优先级高于调用处传入的 model）
 *
 * 未配置时调用会抛出 LLMNotConfiguredError，路由应捕获并返回友好提示。
 * 仅限服务端使用，禁止在客户端组件中导入。
 */

export class LLMNotConfiguredError extends Error {
  constructor() {
    super(
      'LLM 未配置：请在项目根目录 .env.local 中设置 LLM_BASE_URL、LLM_API_KEY、LLM_MODEL（任意 OpenAI 兼容接口），然后重启服务。'
    );
    this.name = 'LLMNotConfiguredError';
  }
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  /** 深度思考开关（豆包 Ark 等服务支持；不兼容的服务可忽略此参数） */
  thinking?: string;
}

/** 兼容占位：原 SDK 的 Config 从平台环境读取配置，此处改为读 env */
export class Config {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;

  constructor() {
    this.baseUrl = (process.env.LLM_BASE_URL || '').replace(/\/+$/, '');
    this.apiKey = process.env.LLM_API_KEY || '';
    this.model = process.env.LLM_MODEL || '';
  }

  get configured(): boolean {
    return Boolean(this.baseUrl && this.apiKey && this.model);
  }
}

/** 兼容占位：原 SDK 用于透传平台鉴权头，通用模板无平台依赖，直接返回空对象 */
export class HeaderUtils {
  static extractForwardHeaders(_headers: Headers): Record<string, string> {
    return {};
  }
}

interface StreamChunk {
  content: string;
}

export class LLMClient {
  private config: Config;

  constructor(config?: Config, _customHeaders?: Record<string, string>) {
    this.config = config ?? new Config();
  }

  /**
   * 流式对话。与原 SDK 签名兼容：
   *   for await (const chunk of client.stream(msgArray, { model, temperature })) { chunk.content }
   */
  async *stream(
    messages: Message[],
    options: StreamOptions = {}
  ): AsyncGenerator<StreamChunk> {
    if (!this.config.configured) {
      throw new LLMNotConfiguredError();
    }

    const model = this.config.model || options.model || '';
    const body = {
      model,
      messages,
      stream: true,
      temperature: options.temperature ?? 0.7,
      ...(options.max_tokens ? { max_tokens: options.max_tokens } : {}),
      ...(options.thinking ? { thinking: options.thinking } : {}),
    };

    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `LLM 请求失败（HTTP ${res.status}）：${errText.slice(0, 300)}`
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const json = JSON.parse(payload);
          const content: string | undefined =
            json?.choices?.[0]?.delta?.content ??
            json?.choices?.[0]?.message?.content;
          if (content) {
            yield { content };
          }
        } catch {
          // 忽略无法解析的心跳/注释行
        }
      }
    }
  }
}

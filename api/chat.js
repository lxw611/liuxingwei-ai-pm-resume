const DEEPSEEK_API = "https://api.deepseek.com/chat/completions";

function buildContext(knowledge) {
  const entries = Array.isArray(knowledge) ? knowledge : [];
  return entries
    .slice(0, 40)
    .map((entry, index) => {
      return `[${index + 1}] 问题：${entry.question}\n回答：${entry.answer}`;
    })
    .join("\n\n");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const key = process.env.DEEPSEEKAPI;
  if (!key) {
    res.status(500).json({ error: "Missing DEEPSEEKAPI" });
    return;
  }

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch (error) {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  const question = String(body.question || "").trim();
  const context = buildContext(body.knowledge);
  if (!question) {
    res.status(400).json({ error: "Question is required" });
    return;
  }

  const systemPrompt = [
    "你是刘兴伟的简历问答助手。",
    "只能根据下面的简历知识库回答，不要编造未公开数据，不要补充简历里没有的事实。",
    "如果问题不在知识库里，直接说明没有相关信息，并建议可问的问题。",
    "回答使用简体中文，简洁、直接，优先用项目事实和职责边界回答。",
    "",
    "简历知识库：",
    context,
  ].join("\n");

  const upstream = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
      temperature: 0.3,
      max_tokens: 600,
      stream: false,
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    res.status(502).json({ error: "DeepSeek API failed", detail: text.slice(0, 300) });
    return;
  }

  const payload = await upstream.json();
  const answer =
    payload?.choices?.[0]?.message?.content?.trim() ||
    "暂时没有生成回答，请换个问法再试。";

  res.status(200).json({
    answer,
    source: "DeepSeek 简历助手",
  });
};

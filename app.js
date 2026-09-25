const resumeData = window.RESUME_DATA;

const chatMessages = document.querySelector("#chatMessages");
const chatForm = document.querySelector("#chatForm");
const chatInput = document.querySelector("#chatInput");
const assistantSection = document.querySelector("#assistant");

function safeText(value) {
  return String(value || "").replace(/[<>]/g, "");
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[，。！？、,.!?;；:：""''（）()\s]/g, "")
    .trim();
}

function addMessage(role, text, source) {
  if (!chatMessages) return;
  const message = document.createElement("article");
  message.className = `message ${role}`;
  const paragraphs = String(text)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${safeText(paragraph)}</p>`)
    .join("");
  message.innerHTML = paragraphs;
  if (source) {
    const sourceLine = document.createElement("small");
    sourceLine.textContent = `来源：${source}`;
    message.append(sourceLine);
  }
  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function findAnswer(question) {
  const normalizedQuestion = normalizeText(question);
  if (!normalizedQuestion) return null;

  let best = null;
  let bestScore = 0;
  const knowledge = resumeData?.knowledge || [];

  knowledge.forEach((entry) => {
    let score = 0;
    const normalizedTitle = normalizeText(entry.question);

    if (normalizedQuestion === normalizedTitle) score += 8;
    if (normalizedTitle.includes(normalizedQuestion)) score += 4;
    if (normalizedQuestion.includes(normalizedTitle)) score += 3;

    (entry.keywords || []).forEach((keyword) => {
      const normalizedKeyword = normalizeText(keyword);
      if (!normalizedKeyword) return;
      if (normalizedQuestion.includes(normalizedKeyword)) {
        score += 1.8 + Math.min(normalizedKeyword.length / 8, 1.5);
      } else if (normalizedKeyword.includes(normalizedQuestion) && normalizedQuestion.length > 1) {
        score += 0.8;
      }
    });

    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  });

  return bestScore >= 1.6 ? best : null;
}

function localAnswer(question) {
  const match = findAnswer(question);
  if (match) {
    return {
      text: match.answer,
      source: match.source,
    };
  }

  return {
    text:
      "这个问题目前不在我的简历知识库里，所以我不会猜答案。你可以换个问法，或者直接问：为什么从 3D 转 AI 产品、橙星梦工厂负责什么、怎么做模型评测、为什么适合 AI 漫剧产品经理。",
    source: "边界说明",
  };
}

async function getAnswer(question) {
  const endpoint = window.RESUME_AI_ENDPOINT;
  if (!endpoint) return localAnswer(question);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    if (!response.ok) throw new Error("chat endpoint failed");
    const payload = await response.json();
    if (payload?.answer) {
      return {
        text: payload.answer,
        source: payload.source || "简历知识库",
      };
    }
  } catch (error) {
    console.warn("Remote assistant unavailable, using local knowledge base.", error);
  }

  return localAnswer(question);
}

async function askQuestion(rawQuestion) {
  const question = String(rawQuestion || "").trim();
  if (!question) return;
  addMessage("user", question);
  if (chatInput) chatInput.value = "";

  const loading = document.createElement("article");
  loading.className = "message assistant";
  loading.innerHTML = "<p>正在检索简历知识库…</p>";
  chatMessages.append(loading);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  const answer = await getAnswer(question);
  loading.remove();
  addMessage("assistant", answer.text, answer.source);
}

function openAssistant(question) {
  assistantSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => {
    if (question) {
      askQuestion(question);
    } else {
      chatInput?.focus();
    }
  }, 420);
}

function setupChat() {
  if (!chatMessages || !chatForm || !chatInput) return;

  addMessage(
    "assistant",
    "你好，我是刘兴伟的简历助手。你可以问我关于项目经历、职责边界、评测方法、技能和岗位匹配的问题。我只会基于简历知识库回答，不会编造未公开数据。",
    "简历知识库"
  );

  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    askQuestion(chatInput.value);
  });

  document.querySelectorAll("[data-question]").forEach((button) => {
    button.addEventListener("click", () => {
      const question = button.dataset.question;
      if (button.hasAttribute("data-open-assistant")) {
        openAssistant(question);
      } else {
        askQuestion(question);
      }
    });
  });

  document.querySelectorAll("[data-open-assistant]").forEach((button) => {
    if (button.hasAttribute("data-question")) return;
    button.addEventListener("click", () => openAssistant());
  });
}

function setupContact() {
  const profile = resumeData?.profile || {};
  const wechat = document.querySelector('[data-contact="wechat"]');
  const github = document.querySelector('[data-contact="github"]');
  const wechatValue = document.querySelector('[data-contact-value="wechat"]');
  const githubValue = document.querySelector('[data-contact-value="github"]');

  if (profile.wechat && wechat) {
    wechat.classList.remove("is-hidden");
    wechat.href = `weixin://`;
    if (wechatValue) wechatValue.textContent = profile.wechat;
  }

  if (profile.github && github) {
    github.classList.remove("is-hidden");
    github.href = profile.github;
    if (githubValue) githubValue.textContent = profile.github.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

function setupReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12 }
  );

  items.forEach((item) => observer.observe(item));
}

function setupNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function setupPrint() {
  document.querySelectorAll("[data-print]").forEach((button) => {
    button.addEventListener("click", () => {
      window.print();
    });
  });
}

function setupCopy() {
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = button.dataset.copy || "";
      const span = button.querySelector("span");
      const original = span ? span.textContent : "";

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(value);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = value;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.append(textarea);
          textarea.select();
          document.execCommand("copy");
          textarea.remove();
        }
        if (span) {
          span.textContent = "已复制";
          window.setTimeout(() => {
            span.textContent = original;
          }, 1400);
        }
      } catch (error) {
        console.warn("Copy failed.", error);
      }
    });
  });
}

function setupIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function init() {
  setupIcons();
  setupContact();
  setupChat();
  setupReveal();
  setupNav();
  setupPrint();
  setupCopy();
}

document.addEventListener("DOMContentLoaded", init);

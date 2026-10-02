// @ts-check

(function () {
  "use strict";

  const ACCOUNT_KEY = "credius-arcade-local-account-v1";
  const SESSION_KEY = "credius-arcade-auth-session-v1";
  const ITERATIONS = 210000;
  const encoder = new TextEncoder();

  function getStorage(name) {
    try {
      return globalThis[name];
    } catch {
      return undefined;
    }
  }

  function bytesToBase64(bytes) {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return globalThis.btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = globalThis.atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  async function derivePasswordHash(password, salt, iterations = ITERATIONS) {
    if (!globalThis.crypto?.subtle) {
      throw new Error("当前设备不支持安全密码处理。请更新 Android System WebView。");
    }
    const key = await globalThis.crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await globalThis.crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      key,
      256,
    );
    return new Uint8Array(bits);
  }

  function constantTimeEqual(left, right) {
    if (left.length !== right.length) {
      return false;
    }
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
      difference |= left[index] ^ right[index];
    }
    return difference === 0;
  }

  function normalizeUsername(username) {
    return String(username).trim().toLocaleLowerCase("zh-CN");
  }

  function validateCredentials(username, password) {
    const cleanUsername = String(username).trim();
    if (cleanUsername.length < 3 || cleanUsername.length > 24) {
      throw new Error("账号需要 3 到 24 个字符。");
    }
    if (String(password).length < 8 || String(password).length > 72) {
      throw new Error("密码需要 8 到 72 个字符。");
    }
    return cleanUsername;
  }

  function getAccount() {
    const storage = getStorage("localStorage");
    try {
      const parsed = JSON.parse(storage?.getItem(ACCOUNT_KEY) ?? "null");
      if (parsed?.version === 1 && parsed.username && parsed.salt && parsed.hash) {
        return parsed;
      }
    } catch {
      return null;
    }
    return null;
  }

  async function createAccount(username, password) {
    const cleanUsername = validateCredentials(username, password);
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const hash = await derivePasswordHash(password, salt);
    const account = {
      version: 1,
      username: cleanUsername,
      normalizedUsername: normalizeUsername(cleanUsername),
      salt: bytesToBase64(salt),
      hash: bytesToBase64(hash),
      iterations: ITERATIONS,
      createdAt: new Date().toISOString(),
    };
    getStorage("localStorage")?.setItem(ACCOUNT_KEY, JSON.stringify(account));
    globalThis.CrediusArcadeStorage?.updateSettings?.({ nickname: cleanUsername });
    return account;
  }

  async function verifyCredentials(username, password) {
    const account = getAccount();
    if (!account || normalizeUsername(username) !== account.normalizedUsername) {
      return false;
    }
    const candidate = await derivePasswordHash(password, base64ToBytes(account.salt), account.iterations);
    return constantTimeEqual(candidate, base64ToBytes(account.hash));
  }

  function isNativeApp() {
    const capacitorNative = globalThis.Capacitor?.isNativePlatform?.() === true;
    const preview = globalThis.location?.search
      ? new URLSearchParams(globalThis.location.search).get("native-preview") === "1"
      : false;
    return capacitorNative || preview;
  }

  function getSessionUsername() {
    const account = getAccount();
    const value = getStorage("sessionStorage")?.getItem(SESSION_KEY);
    return account && value === account.normalizedUsername ? account.username : "";
  }

  function setSession(account) {
    getStorage("sessionStorage")?.setItem(SESSION_KEY, account.normalizedUsername);
  }

  function clearSession() {
    getStorage("sessionStorage")?.removeItem(SESSION_KEY);
  }

  function clearAccount() {
    clearSession();
    getStorage("localStorage")?.removeItem(ACCOUNT_KEY);
  }

  const api = {
    ACCOUNT_KEY,
    SESSION_KEY,
    createAccount,
    verifyCredentials,
    getAccount,
    getSessionUsername,
    isNativeApp,
    clearAccount,
  };
  globalThis.CrediusArcadeAuth = api;

  if (typeof document === "undefined") {
    return;
  }

  const gate = document.querySelector("#authGate");
  const form = document.querySelector("#authForm");
  const title = document.querySelector("#authTitle");
  const intro = document.querySelector("#authIntro");
  const usernameInput = document.querySelector("#authUsername");
  const passwordInput = document.querySelector("#authPassword");
  const confirmInput = document.querySelector("#authPasswordConfirm");
  const confirmField = document.querySelector("#authConfirmField");
  const showPassword = document.querySelector("#authShowPassword");
  const status = document.querySelector("#authStatus");
  const submit = document.querySelector("#authSubmit");
  const reset = document.querySelector("#authReset");
  const appShell = document.querySelector(".app-shell");

  if (!(gate instanceof HTMLElement) || !(form instanceof HTMLFormElement) || !isNativeApp()) {
    return;
  }

  document.body.classList.add("native-app");
  let mode = getAccount() ? "login" : "create";

  function setStatus(message, tone = "error") {
    if (!(status instanceof HTMLElement)) {
      return;
    }
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function renderMode() {
    const account = getAccount();
    const creating = mode === "create";
    if (title) title.textContent = creating ? "创建本机账号" : "欢迎回来";
    if (intro) intro.textContent = creating ? "第一次使用，只需在这台设备上创建一次。" : `登录 ${account?.username ?? "你的账号"}，继续上次的游戏。`;
    if (confirmField instanceof HTMLElement) confirmField.hidden = !creating;
    if (confirmInput instanceof HTMLInputElement) confirmInput.required = creating;
    if (submit instanceof HTMLButtonElement) submit.textContent = creating ? "创建并进入" : "登录";
    if (reset instanceof HTMLButtonElement) reset.hidden = creating;
    if (usernameInput instanceof HTMLInputElement) {
      usernameInput.value = creating ? "" : account?.username ?? "";
      usernameInput.readOnly = !creating;
    }
    if (passwordInput instanceof HTMLInputElement) passwordInput.autocomplete = creating ? "new-password" : "current-password";
    setStatus("", "quiet");
  }

  function unlock(account) {
    setSession(account);
    document.body.classList.remove("auth-locked");
    gate.hidden = true;
    appShell?.removeAttribute("inert");
    globalThis.dispatchEvent(new CustomEvent("credius-auth-changed", { detail: { authenticated: true } }));
  }

  function lock() {
    clearSession();
    mode = getAccount() ? "login" : "create";
    renderMode();
    gate.hidden = false;
    document.body.classList.add("auth-locked");
    appShell?.setAttribute("inert", "");
    if (passwordInput instanceof HTMLInputElement) passwordInput.value = "";
    if (confirmInput instanceof HTMLInputElement) confirmInput.value = "";
    window.setTimeout(() => (passwordInput instanceof HTMLInputElement ? passwordInput.focus() : undefined), 80);
  }

  api.lock = lock;
  api.unlock = unlock;

  const activeAccount = getAccount();
  if (activeAccount && getSessionUsername()) {
    unlock(activeAccount);
  } else {
    lock();
  }

  showPassword?.addEventListener("change", () => {
    const type = showPassword instanceof HTMLInputElement && showPassword.checked ? "text" : "password";
    if (passwordInput instanceof HTMLInputElement) passwordInput.type = type;
    if (confirmInput instanceof HTMLInputElement) confirmInput.type = type;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(usernameInput instanceof HTMLInputElement) || !(passwordInput instanceof HTMLInputElement)) return;
    if (submit instanceof HTMLButtonElement) submit.disabled = true;
    setStatus(mode === "create" ? "正在保护你的本机账号..." : "正在验证...", "quiet");
    try {
      if (mode === "create") {
        if (!(confirmInput instanceof HTMLInputElement) || passwordInput.value !== confirmInput.value) {
          throw new Error("两次输入的密码不一致。");
        }
        const account = await createAccount(usernameInput.value, passwordInput.value);
        unlock(account);
      } else if (await verifyCredentials(usernameInput.value, passwordInput.value)) {
        unlock(getAccount());
      } else {
        throw new Error("账号或密码不正确。");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "登录失败，请重试。");
      passwordInput.select();
    } finally {
      if (submit instanceof HTMLButtonElement) submit.disabled = false;
    }
  });

  reset?.addEventListener("click", () => {
    if (!window.confirm("重新创建登录账号？游戏成绩、仓鼠和关卡存档会保留。")) return;
    clearAccount();
    mode = "create";
    renderMode();
    usernameInput instanceof HTMLInputElement && usernameInput.focus();
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-auth-lock]") : null;
    if (!target || !window.confirm("现在锁定游戏厅？本机存档会保留。")) return;
    lock();
  });
})();

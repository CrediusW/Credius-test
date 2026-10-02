// @ts-check

(function () {
  "use strict";

  const STORAGE_KEY = "crediusArcade.playerIdentity.v1";
  const AVATARS = ["mint", "coral", "sun", "sky", "violet", "graphite"];

  function randomId(byteLength = 24) {
    const bytes = new Uint8Array(byteLength);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function load() {
    try {
      const parsed = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || "null");
      if (parsed?.playerId && parsed?.token) {
        return normalize(parsed);
      }
    } catch {
      // A malformed local identity is replaced without touching other saves.
    }
    return null;
  }

  function normalize(identity) {
    return {
      version: 1,
      playerId: String(identity.playerId).slice(0, 80),
      token: String(identity.token).slice(0, 160),
      nickname: String(identity.nickname ?? "").trim().replace(/\s+/g, " ").slice(0, 16),
      avatar: AVATARS.includes(identity.avatar) ? identity.avatar : "mint",
      profileComplete: Boolean(identity.profileComplete && String(identity.nickname ?? "").trim()),
      createdAt: identity.createdAt || new Date().toISOString(),
      updatedAt: identity.updatedAt || new Date().toISOString(),
    };
  }

  function createDraft() {
    const settingsNickname = globalThis.CrediusArcadeStorage?.getSettings?.().nickname;
    return normalize({
      playerId: globalThis.crypto.randomUUID?.() ?? randomId(16),
      token: randomId(32),
      nickname: settingsNickname && settingsNickname !== "玩家" ? settingsNickname : "",
      avatar: "mint",
      profileComplete: false,
      createdAt: new Date().toISOString(),
    });
  }

  function getOrCreate() {
    const identity = load() ?? createDraft();
    save(identity);
    return identity;
  }

  function save(value) {
    const identity = normalize({ ...value, updatedAt: new Date().toISOString() });
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(identity));
    return identity;
  }

  function updateProfile({ nickname, avatar }) {
    const identity = getOrCreate();
    const cleanNickname = String(nickname ?? "").trim().replace(/\s+/g, " ").slice(0, 16);
    if (!cleanNickname) {
      throw new Error("请输入昵称。");
    }
    const updated = save({
      ...identity,
      nickname: cleanNickname,
      avatar: AVATARS.includes(avatar) ? avatar : identity.avatar,
      profileComplete: true,
    });
    if (globalThis.CrediusArcadeStorage?.updateSettings) {
      globalThis.CrediusArcadeStorage.updateSettings({ nickname: cleanNickname });
    }
    return updated;
  }

  globalThis.CrediusPlayerIdentity = {
    AVATARS,
    STORAGE_KEY,
    getOrCreate,
    load,
    save,
    updateProfile,
  };
})();

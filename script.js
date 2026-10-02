"use strict";

const SESSION_KEY = "websteam.session.v2";
const DATA_KEY = "websteam.data.v2";
const KNOWN_ACCOUNT_KEY = "websteam.known-account.v1";
const API_BASE_URL = (window.PLAYWEB_API_URL || "https://deeppink-bear-404650.hostingersite.com/api/v1").replace(/\/$/, "");
const BRAINROT_API_BASE_URL = "https://proxy-bsstar.llexllex-proxy.workers.dev";

const accounts = {
  "demo-token-alice": {
    name: "Alice",
    role: "admin",
    avatar: "A",
    level: 18,
    xp: 7420,
    status: "En ligne",
    title: "Curatrice du chaos",
  },
  "demo-token-bob": {
    name: "Bob",
    role: "player",
    avatar: "B",
    level: 11,
    xp: 4210,
    status: "En ligne",
    title: "Speedrunner",
  },
  "demo-token-claire": {
    name: "Claire",
    role: "player",
    avatar: "C",
    level: 14,
    xp: 5980,
    status: "Absente",
    title: "Exploratrice",
  },
};

const games = [
  {
    id: "brainrotstar",
    name: "BrainrotStar",
    genre: "Gambling • Brainrot",
    description: "Lancer le fameux jeu de gambling BrainrotStar !",
  },
  {
    id: "gambleking",
    name: "GambleKing",
    genre: "Gamble • Multi",
    description: "Du gamble, du troll, et des potes.",
  },
  {
    id: "chess",
    name: "Chess",
    genre: "Échecs • Dames",
    description: "Jouez aux échecs ainsi qu'aux dames contre vos potes.",
  },
];

const defaults = {
  profile: {
    name: null,
    privacy: "public",
    joinedAt: "2025-01-18",
    games: {
      brainrotstar: { hours: 0, played: false },
      gambleking: { hours: 0, played: false },
      chess: { hours: 0, played: false },
    },
  },
  friends: [],
  achievements: [],
};

let session = null;
let data = null;
let initialPageData = {};
const memoryStorage = {};

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return memoryStorage[key] ?? null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      memoryStorage[key] = value;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      delete memoryStorage[key];
    }
  },
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const currentPage = () => document.body.dataset.page || "shop";
const currentUser = () => {
  const account = accounts[session.token];
  return {
    ...(account || {}),
    ...(data?.profile || {}),
    avatar: data?.profile?.avatar || account?.avatar || "J",
    name: data?.profile?.name || account?.name || "Joueur",
  };
};

const isBackendToken = (token) => typeof token === "string" && token.split(".").length === 3;

async function apiRequest(path, options = {}) {
  return apiRequestWithToken(session?.token, path, options);
}

async function apiRequestWithToken(token, path, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, ...body };
  } catch {
    return { ok: false, error: "Backend indisponible." };
  }
}

const api = {
  enabled: () => isBackendToken(session?.token),
  getMe: () => apiRequest("/auth/me"),
  getHome: () => apiRequest("/home"),
  getGames: () => apiRequest("/game"),
  getFriends: () => apiRequest("/friends"),
  askFriend: (friendUserId) => apiRequest(`/friends/${encodeURIComponent(friendUserId)}`, { method: "POST" }),
  acceptFriend: (friendId) => apiRequest(`/friends/accept/${encodeURIComponent(friendId)}`, { method: "POST" }),
  declineFriend: (friendId) => apiRequest(`/friends/decline/${encodeURIComponent(friendId)}`, { method: "POST" }),
  deleteFriend: (friendId) => apiRequest(`/friends/${encodeURIComponent(friendId)}`, { method: "DELETE" }),
  getRanking: (gameId) => apiRequest(`/ranking/${encodeURIComponent(gameId)}`),
  getBrainrotLeaderboard: async () => {
    try {
      // Route publique : pas de jeton, donc pas de preflight CORS, et le
      // classement s'affiche meme pour un joueur sans compte BrainrotStar.
      const response = await fetch(`${BRAINROT_API_BASE_URL}/leaderboard/public`, {
        headers: { Accept: "application/json" },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success) {
        return { ok: false, error: body.message || "Classement BrainrotStar indisponible." };
      }
      return {
        ok: true,
        result: {
          scores: (Array.isArray(body.result) ? body.result : []).map((entry) => ({
            score: Number(entry.goldPerSec || 0),
            rebirth: Number(entry.hasRebirth || 0),
            user: { name: entry.pseudo || "Joueur" },
          })),
        },
      };
    } catch {
      return { ok: false, error: "Classement BrainrotStar indisponible." };
    }
  },
  getUserRankings: () => apiRequest("/ranking"),
  getSuccesses: () => apiRequest("/success"),
  getUserSuccesses: () => apiRequest("/success/user"),
  updateAvatar: (avatarUrl) => apiRequest("/auth/me/avatar", {
    method: "PATCH",
    body: JSON.stringify({ avatarUrl }),
  }),
  updateName: (name) => apiRequest("/auth/me/name", {
    method: "PATCH",
    body: JSON.stringify({ name }),
  }),
  getProfileLink: () => apiRequest("/auth/me/profile-link"),
  updatePrivacy: (isPublic) => apiRequest("/auth/me/privacy", {
    method: "PATCH",
    body: JSON.stringify({ isPublic }),
  }),
  register: () => apiRequestWithToken(null, "/auth/register", { method: "POST" }),
};

function loadSession() {
  try {
    const storedValue = storage.get(SESSION_KEY);
    let storedToken = storedValue;
    try {
      const legacySession = JSON.parse(storedValue || "null");
      if (legacySession?.token) storedToken = legacySession.token;
    } catch {
      // The current format stores only the token.
    }
    session = storedToken ? { token: storedToken, createdAt: Date.now() } : null;
  } catch {
    session = null;
  }

  if (session && !accounts[session.token] && !isBackendToken(session.token)) {
    storage.remove(SESSION_KEY);
    session = null;
  }

  storage.remove(DATA_KEY);

  if (session) {
    storage.set(SESSION_KEY, session.token);
    storage.set(KNOWN_ACCOUNT_KEY, "1");
    data = clone(defaults);
  }
}

function saveData() {
  // Application data is fetched from the API and kept in memory only.
}

function mergeRemoteData(remote) {
  if (!remote || !data) return;

  if (remote.user) {
    session.userId = remote.user.id;
    data.profile = {
      ...data.profile,
      id: remote.user.id,
      name: remote.user.name || data.profile.name,
      avatarUrl: remote.user.avatarUrl || null,
      joinedAt: remote.user.createdAt || data.profile.joinedAt,
      privacy: remote.user.isPublic === false ? "private" : "public",
      friendsCount: remote.user._count
        ? Number(remote.user._count.friendshipsSent || 0) + Number(remote.user._count.friendshipsReceived || 0)
        : data.profile.friendsCount,
    };
  }

  if (Array.isArray(remote.games) && remote.games.length) {
    data.profile.games = {
      ...data.profile.games,
      ...Object.fromEntries(remote.games.map((gameUser) => [
        gameUser.gameId,
        {
          hours: Number(gameUser.playedHours || 0),
          played: Number(gameUser.playedHours || 0) > 0,
        },
      ])),
    };
  }

  if (Array.isArray(remote.friends)) {
    data.friendships = remote.friends;
    if (remote.userId) {
      session.userId = remote.userId;
      data.profile.id = remote.userId;
    }
    const currentUserId = remote.user?.id || remote.userId || session.userId;
    const acceptedFriendships = remote.friends.filter((friendship) => friendship.status === "ACCEPTED");
    data.profile.friendsCount = acceptedFriendships.length;
    data.friends = acceptedFriendships.map((friendship) => {
        const friend = friendship.requesterId === currentUserId
          ? friendship.addressee
          : friendship.requester;
        return {
          id: friendship.id,
          userId: friendship.requesterId === currentUserId
            ? friendship.addresseeId
            : friendship.requesterId,
          name: friend?.name || "Joueur",
          avatar: friend?.name?.slice(0, 1).toUpperCase() || "?",
          avatarUrl: friend?.avatarUrl || null,
          status: "Hors ligne",
        };
      });
  }

  if (Array.isArray(remote.achievements)) {
    data.achievements = remote.achievements;
  }

}

async function hydrateRemoteData(page) {
  if (!api.enabled()) return;

  if (page === "shop") {
    const home = await api.getHome();
    mergeRemoteData({ user: home.user });
    if (Array.isArray(home.games) && home.games.length) {
      games.splice(0, games.length, ...home.games.map((game) => ({
        id: game.id,
        slug: game.slug,
        name: game.name,
        genre: "PlayWeb",
        description: game.description || "Découvrez ce jeu PlayWeb.",
        launchUrl: game.launchUrl || null,
        tag: game.tag || null,
      })));
    }
    return;
  }

  if (page === "friends") {
    const friends = await api.getFriends();
    mergeRemoteData({ user: friends.user, friends: friends.friends, userId: friends.userId });
    return;
  }

  if (page === "achievements") {
    const [allSuccesses, userSuccesses, gameUsers, home] = await Promise.all([
      api.getSuccesses(),
      api.getUserSuccesses(),
      api.getGames(),
      api.getHome(),
    ]);
    if (Array.isArray(home.games) && home.games.length) {
      games.splice(0, games.length, ...home.games.map((game) => ({
        id: game.id,
        slug: game.slug,
        name: game.name,
        genre: "PlayWeb",
        description: game.description || "Découvrez ce jeu PlayWeb.",
        launchUrl: game.launchUrl || null,
      })));
    }
    const gameNames = new Map(games.map((game) => [game.id, game.name]));
    const unlockedDates = new Map((userSuccesses.result || []).map((item) => [
      item.success?.id || item.successId,
      item.earnedAt,
    ]));
    (gameUsers.games || []).forEach((gameUser) => {
      (gameUser.successes || []).forEach((item) => {
        const successId = item.success?.id || item.successId;
        if (successId && item.earnedAt && !unlockedDates.has(successId)) {
          unlockedDates.set(successId, item.earnedAt);
        }
      });
    });
    const unlockedIds = new Set([
      ...(userSuccesses.result || []).map((item) => item.success?.id || item.successId),
      ...(gameUsers.games || []).flatMap((gameUser) => (
        gameUser.successes || []
      ).map((item) => item.success?.id || item.successId)),
    ]);
    mergeRemoteData({
      user: gameUsers.user || userSuccesses.user,
      achievements: (allSuccesses.result || []).map((success) => ({
        id: success.id,
        name: success.title || "Succès",
        game: success.game?.name || gameNames.get(success.gameId) || success.gameId || "PlayWeb",
        icon: "trophy",
        rare: success.rarity || "COMMON",
        done: unlockedIds.has(success.id),
        unlockedAt: unlockedDates.get(success.id) || null,
      })),
    });
    return;
  }

  if (page === "profile") {
    const [gameUsers, home, friends] = await Promise.all([
      api.getGames(),
      api.getHome(),
      api.getFriends(),
    ]);
    if (Array.isArray(home.games) && home.games.length) {
      games.splice(0, games.length, ...home.games.map((game) => ({
          id: game.id,
          slug: game.slug,
          name: game.name,
          genre: "PlayWeb",
          description: game.description || "Découvrez ce jeu PlayWeb.",
          launchUrl: game.launchUrl || null,
        })));
    }
    const remoteAchievements = (gameUsers.games || []).flatMap((gameUser) => {
      const earnedIds = new Set((gameUser.successes || []).map((item) => item.successId));
      return (gameUser.game?.successes || []).map((success) => ({
        id: success.id,
        name: success.title,
        game: gameUser.game.name,
        icon: "trophy",
        rare: success.rarity || "COMMON",
        done: earnedIds.has(success.id),
      }));
    });
    mergeRemoteData({
      user: gameUsers.user,
      games: gameUsers.games,
      friends: friends.friends,
      userId: friends.userId,
      achievements: remoteAchievements,
    });
    return;
  }

  if (page === "leaderboard") {
    const game = games.find((item) => item.id === "brainrotstar") || games[0];
    const ranking = game?.id === "brainrotstar"
      ? await api.getBrainrotLeaderboard()
      : game ? await api.getRanking(game.id) : null;
    initialPageData.ranking = ranking;
    mergeRemoteData({ user: ranking?.user });
    return;
  }

  if (page === "updates") {
    const me = await api.getMe();
    mergeRemoteData({ user: me.user });
  }
}

function setText(selector, value, root = document) {
  const element = root.querySelector(selector);
  if (element) element.textContent = value;
}

function icons() {
  if (window.lucide) window.lucide.createIcons();
}

function renderMiniAvatar(user = currentUser()) {
  const avatar = document.querySelector("[data-user-avatar]");
  if (!avatar) return;
  const avatarUrl = user.avatarUrl || "";
  avatar.textContent = avatarUrl ? "" : user.avatar || "J";
  avatar.style.backgroundImage = avatarUrl ? `url("${avatarUrl}")` : "";
  avatar.classList.toggle("has-image", Boolean(avatarUrl));
}

function toast(message) {
  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  document.querySelector("#toast")?.append(element);
  setTimeout(() => element.remove(), 3000);
}

function logout() {
  session = null;
  data = null;
  storage.remove(SESSION_KEY);
  showLogin();
}

function showLogin() {
  document.querySelector("#app").innerHTML = `
    <main class="auth-gate-overlay">
      <section class="auth-gate-card" role="dialog" aria-modal="true" aria-labelledby="auth-title" aria-describedby="auth-subtitle">
        <div class="auth-gate-brand"><img src="../assets/playweb-fav-w.png" alt="" /><span>PlayWeb</span></div>
        <div class="auth-gate-tabs" role="tablist" aria-label="Connexion ou inscription">
          <button class="auth-gate-tab" type="button" role="tab" data-auth-tab="register" aria-controls="auth-panel-register">Créer un compte</button>
          <button class="auth-gate-tab" type="button" role="tab" data-auth-tab="login" aria-controls="auth-panel-login">Se connecter</button>
        </div>
        <h1 id="auth-title" class="auth-gate-title"></h1>
        <p id="auth-subtitle" class="auth-gate-subtitle"></p>

        <form id="auth-panel-register" class="auth-gate-panel" data-auth-panel="register" role="tabpanel" novalidate>
          <label class="auth-gate-label" for="auth-gate-name-input">Ton pseudo</label>
          <input id="auth-gate-name-input" class="auth-gate-input" type="text" minlength="3" maxlength="24" placeholder="Ex. PlayerOne" autocomplete="nickname" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-describedby="auth-gate-name-hint">
          <p id="auth-gate-name-hint" class="auth-gate-hint">Entre 3 et 24 caractères. Il sera visible par les autres joueurs.</p>
          <button id="auth-gate-register-btn" class="auth-gate-continue-btn" type="submit">Créer mon compte</button>
        </form>

        <div class="auth-gate-panel" data-auth-panel="token" hidden>
          <div class="auth-gate-token-wrap">
            <div class="auth-gate-token-head">Ton identifiant de connexion</div>
            <div id="auth-gate-token-value" class="auth-gate-token-value" tabindex="0"></div>
            <div class="auth-gate-token-actions">
              <button id="auth-gate-copy-btn" class="auth-gate-copy-btn" type="button">Copier</button>
              <button id="auth-gate-download-btn" class="auth-gate-copy-btn" type="button">Télécharger (.txt)</button>
            </div>
            <p class="auth-gate-warn">Ne le partage avec personne : n'importe qui le possédant peut se connecter à ton compte.</p>
          </div>
          <p class="auth-gate-hint">Pas de panique si tu l'oublies ici : tant que tu es connecté, tu le retrouves dans <b>Profil › Token de session</b>.</p>
          <label class="auth-gate-check">
            <input id="auth-gate-saved-check" type="checkbox">
            <span>J'ai sauvegardé mon identifiant</span>
          </label>
          <button id="auth-gate-continue-btn" class="auth-gate-continue-btn" type="button" disabled>Accéder à PlayWeb</button>
        </div>

        <form id="auth-panel-login" class="auth-gate-panel" data-auth-panel="login" role="tabpanel" novalidate hidden>
          <label class="auth-gate-label" for="auth-gate-input">Identifiant de connexion</label>
          <div class="auth-gate-input-row">
            <input id="auth-gate-input" class="auth-gate-input" type="text" placeholder="Colle ton identifiant ici" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-describedby="auth-gate-login-hint">
            <button id="auth-gate-paste-btn" class="auth-gate-copy-btn" type="button" hidden>Coller</button>
          </div>
          <p id="auth-gate-login-hint" class="auth-gate-hint">C'est le long code qu'on t'a donné à la création de ton compte. Tu le retrouves dans <b>Profil › Token de session</b> sur un appareil où tu es encore connecté.</p>
          <button id="auth-gate-login-btn" class="auth-gate-login-btn" type="submit">Se connecter</button>
        </form>

        <p id="auth-gate-feedback" class="auth-gate-feedback" aria-live="polite"></p>
      </section>
    </main>`;

  const title = document.querySelector("#auth-title");
  const subtitle = document.querySelector("#auth-subtitle");
  const tabs = document.querySelector(".auth-gate-tabs");
  const tabButtons = [...document.querySelectorAll("[data-auth-tab]")];
  const panels = [...document.querySelectorAll("[data-auth-panel]")];
  const registerForm = document.querySelector("#auth-panel-register");
  const registerButton = document.querySelector("#auth-gate-register-btn");
  const nameInput = document.querySelector("#auth-gate-name-input");
  const tokenValue = document.querySelector("#auth-gate-token-value");
  const copyButton = document.querySelector("#auth-gate-copy-btn");
  const downloadButton = document.querySelector("#auth-gate-download-btn");
  const savedCheck = document.querySelector("#auth-gate-saved-check");
  const continueButton = document.querySelector("#auth-gate-continue-btn");
  const loginForm = document.querySelector("#auth-panel-login");
  const loginButton = document.querySelector("#auth-gate-login-btn");
  const input = document.querySelector("#auth-gate-input");
  const pasteButton = document.querySelector("#auth-gate-paste-btn");
  const feedback = document.querySelector("#auth-gate-feedback");
  // Avoid opening the virtual keyboard on phones as soon as the page loads.
  const canAutofocus = window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
  let temporaryToken = "";
  let registeredUser = null;

  const screens = {
    register: {
      title: "Bienvenue sur PlayWeb",
      subtitle: "Pas d'e-mail ni de mot de passe : choisis juste ton pseudo, on s'occupe du reste.",
      focus: nameInput,
    },
    token: {
      title: "Garde bien ton identifiant",
      subtitle: "Ton compte est créé ! Sur PlayWeb, cet identifiant remplace le mot de passe : c'est le seul moyen de te reconnecter sur un autre appareil ou après une déconnexion.",
      focus: copyButton,
    },
    login: {
      title: "Content de te revoir",
      subtitle: "Colle l'identifiant de connexion que tu as sauvegardé à la création de ton compte.",
      focus: input,
    },
  };

  const setFeedback = (message, success = false) => {
    feedback.textContent = message;
    feedback.style.color = success ? "#86efac" : "#fda4af";
  };

  const showScreen = (name) => {
    const screen = screens[name];
    title.textContent = screen.title;
    subtitle.textContent = screen.subtitle;
    tabs.hidden = name === "token";
    tabButtons.forEach((button) => {
      const active = button.dataset.authTab === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.authPanel !== name;
    });
    setFeedback("");
    if (canAutofocus) screen.focus.focus();
  };

  const openSession = (token, user = null) => {
    session = { token, createdAt: Date.now() };
    storage.set(SESSION_KEY, token);
    storage.set(KNOWN_ACCOUNT_KEY, "1");
    data = {
      ...clone(defaults),
      profile: {
        ...clone(defaults.profile),
        name: user?.name || null,
        avatarUrl: user?.avatarUrl || null,
      },
    };
    renderApp();
  };

  const markSaved = () => {
    savedCheck.checked = true;
    continueButton.disabled = false;
  };

  tabButtons.forEach((button) => {
    button.onclick = () => showScreen(button.dataset.authTab);
    button.onkeydown = (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const next = tabButtons[(tabButtons.indexOf(button) + 1) % tabButtons.length];
      next.focus();
      showScreen(next.dataset.authTab);
    };
  });

  nameInput.oninput = () => setFeedback("");
  input.oninput = () => setFeedback("");

  registerForm.onsubmit = async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (name.length < 3 || name.length > 24) {
      setFeedback("Ton pseudo doit faire entre 3 et 24 caractères.");
      nameInput.focus();
      return;
    }

    registerButton.disabled = true;
    registerButton.textContent = "Création du compte...";
    setFeedback("");

    // The account is only created once: if the pseudo is refused, we retry with the same token.
    if (!temporaryToken) {
      const registration = await api.register();
      if (registration.ok && registration.token) {
        temporaryToken = registration.token;
      }
    }

    const result = temporaryToken
      ? await apiRequestWithToken(temporaryToken, "/auth/me/name", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      })
      : { ok: false, error: "Backend indisponible." };

    registerButton.disabled = false;
    registerButton.textContent = "Créer mon compte";

    if (!result.ok) {
      if (result.error === "Backend indisponible." || !temporaryToken) {
        setFeedback("Impossible de joindre le serveur. Vérifie ta connexion et réessaie.");
      } else if (/between 3 and 24/.test(result.error || "")) {
        setFeedback("Ton pseudo doit faire entre 3 et 24 caractères.");
      } else {
        setFeedback("Ce pseudo est déjà pris. Essaie-en un autre.");
      }
      nameInput.focus();
      return;
    }

    registeredUser = result.user || { name };
    // Keep the user signed in on this device even if they close the page before continuing.
    storage.set(SESSION_KEY, temporaryToken);
    storage.set(KNOWN_ACCOUNT_KEY, "1");
    tokenValue.textContent = temporaryToken;
    showScreen("token");
  };

  copyButton.onclick = async () => {
    try {
      await navigator.clipboard.writeText(temporaryToken);
      markSaved();
      setFeedback("Identifiant copié ✅ Colle-le dans tes notes ou ton gestionnaire de mots de passe.", true);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(tokenValue);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      setFeedback("Copie automatique impossible : l'identifiant est sélectionné, copie-le manuellement.");
    }
  };

  downloadButton.onclick = () => {
    const content = [
      "PlayWeb - Identifiant de connexion",
      "",
      `Pseudo : ${registeredUser?.name || ""}`,
      `Identifiant : ${temporaryToken}`,
      "",
      "Ne partage cet identifiant avec personne : il permet de se connecter à ton compte.",
      "",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "playweb-identifiant.txt";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    markSaved();
    setFeedback("Fichier téléchargé ✅", true);
  };

  savedCheck.onchange = () => {
    continueButton.disabled = !savedCheck.checked;
  };

  continueButton.onclick = () => openSession(temporaryToken, registeredUser);

  if (navigator.clipboard?.readText) {
    pasteButton.hidden = false;
    pasteButton.onclick = async () => {
      try {
        input.value = (await navigator.clipboard.readText()).trim();
        setFeedback("");
      } catch {
        setFeedback("Impossible de lire le presse-papiers : colle l'identifiant manuellement.");
        input.focus();
      }
    };
  }

  loginForm.onsubmit = async (event) => {
    event.preventDefault();
    // Tokens pasted from notes often carry spaces or line breaks.
    const token = input.value.replace(/\s+/g, "");
    if (!token) {
      setFeedback("Colle ton identifiant de connexion pour continuer.");
      input.focus();
      return;
    }

    if (accounts[token]) {
      openSession(token);
      return;
    }

    if (!isBackendToken(token)) {
      setFeedback("Cet identifiant n'est pas valide. Vérifie que tu l'as copié en entier.");
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Connexion...";
    const result = await apiRequestWithToken(token, "/auth/me");
    loginButton.disabled = false;
    loginButton.textContent = "Se connecter";
    if (!result.ok || !result.user) {
      setFeedback(result.error === "Backend indisponible."
        ? "Impossible de joindre le serveur. Vérifie ta connexion et réessaie."
        : "Identifiant invalide ou expiré.");
      return;
    }

    openSession(token, result.user);
  };

  showScreen(storage.get(KNOWN_ACCOUNT_KEY) ? "login" : "register");
}

function renderShell() {
  document.querySelector("#app").innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="brand"><img class="brand-mark" src="../assets/playweb-fav-w.png" alt="" /><span>PlayWeb</span></div>
        <nav class="nav">
          <a class="btn-nav" data-page-link="shop" href="../index/index.html"><i data-lucide="store"></i><span>Jeux</span></a>
          <a class="btn-nav" data-page-link="friends" href="../amis/index.html"><i data-lucide="users"></i><span>Amis</span></a>
          <a class="btn-nav" data-page-link="achievements" href="../succes/index.html"><i data-lucide="trophy"></i><span>Succès</span></a>
          <a class="btn-nav" data-page-link="leaderboard" href="../leaderboard/index.html"><i data-lucide="bar-chart"></i><span>Leaderboard</span></a>
          <a class="btn-nav" data-page-link="updates" href="../mises-a-jour/index.html"><i data-lucide="scroll-text"></i><span>Mises à jour</span></a>
          <a class="btn-nav" data-page-link="profile" href="../profil/index.html"><i data-lucide="user"></i><span>Profil</span></a>
        </nav>
        <div class="side-foot">
          <div class="user-mini">
            <div class="avatar" data-user-avatar>${currentUser().avatar}</div>
            <div class="grow"><b>${currentUser().name}</b></div>
            <button class="btn danger" id="logout" title="Déconnexion"><i data-lucide="log-out"></i></button>
          </div>
        </div>
      </aside>
      <main class="main" id="content">
        <header class="topbar">
          <h1 id="page-title"></h1>
          <button class="btn" id="quick-profile">${currentUser().name}</button>
        </header>
        <div id="page-content"></div>
      </main>
    </div>`;

  document
    .querySelector(`[data-page-link="${currentPage()}"]`)
    ?.classList.add("active");
  document.querySelector("#logout").onclick = logout;
  document.querySelector("#quick-profile").onclick = () => {
    window.location.href = "../profil/index.html";
  };
  renderMiniAvatar();
  icons();
}

async function renderApp() {
  if (!session) {
    showLogin();
    return;
  }

  await hydrateRemoteData(currentPage());
  renderShell();
  const pageTemplate = document.querySelector("#page-template");
  if (pageTemplate) {
    document
      .querySelector("#page-content")
      .append(pageTemplate.content.cloneNode(true));
  }
  window.pageInit?.({
    user: currentUser(),
    data,
    games,
    setText,
    toast,
    save: saveData,
    icons,
    api: api.enabled() ? api : null,
    session,
    initialPageData,
  });
}

loadSession();
document.addEventListener("DOMContentLoaded", renderApp);

"use strict";

const SESSION_KEY = "websteam.session.v2";
const DATA_KEY = "websteam.data.v2";
const API_BASE_URL = (window.PLAYWEB_API_URL || "https://deeppink-bear-404650.hostingersite.com/api/v1").replace(/\/$/, "");
const BRAINROT_API_BASE_URL = "http://localhost:bs3000";

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
      const response = await fetch(`${BRAINROT_API_BASE_URL}/leaderboard/coinPerSec`, {
        headers: {
          Accept: "application/json",
          ...(session?.token ? { Authorization: "Bearer " + session.token } : {}),
        },
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

async function showLogin() {
  document.querySelector("#app").innerHTML = `
    <main class="auth-gate-overlay">
      <section class="auth-gate-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <h1 id="auth-title" class="auth-gate-title">Connexion</h1>
        <p class="auth-gate-subtitle">Entre votre identifiant de connexion pour vous connecter.</p>
        <input id="auth-gate-input" class="auth-gate-input" type="text" placeholder="Votre identifiant de connexion" autocomplete="off">
        <button id="auth-gate-login-btn" class="auth-gate-login-btn" type="button">Se connecter</button>
        <p class="auth-gate-sep">Ou</p>
        <div class="auth-gate-token-wrap">
          <div class="auth-gate-token-head">Voici votre identifiant de connexion :</div>
          <div class="auth-gate-token-row">
            <div id="auth-gate-token-value" class="auth-gate-token-value">Création en cours...</div>
            <button id="auth-gate-copy-btn" class="auth-gate-copy-btn" type="button">Copier</button>
          </div>
          <p class="auth-gate-warn">Merci de ne pas diffuser votre identifiant, n'importe quelle personne possédant votre identifiant peut se connecter à votre compte.</p>
        </div>
        <div class="auth-gate-name-wrap">
          <div class="auth-gate-name-head">Créez votre compte :</div>
          <p class="auth-gate-name-help">Choisissez le pseudo qui sera affiché sur votre profil et auprès des autres joueurs.</p>
          <label class="auth-gate-name-label" for="auth-gate-name-input">Votre pseudo</label>
          <input id="auth-gate-name-input" class="auth-gate-input" type="text" maxlength="24" placeholder="Ex. PlayerOne" autocomplete="nickname">
        </div>
        <button id="auth-gate-continue-btn" class="auth-gate-continue-btn" type="button">Continuer</button>
        <p id="auth-gate-feedback" class="auth-gate-feedback" aria-live="polite"></p>
      </section>
    </main>`;

  const input = document.querySelector("#auth-gate-input");
  const loginButton = document.querySelector("#auth-gate-login-btn");
  const copyButton = document.querySelector("#auth-gate-copy-btn");
  const continueButton = document.querySelector("#auth-gate-continue-btn");
  const tokenValue = document.querySelector("#auth-gate-token-value");
  const nameInput = document.querySelector("#auth-gate-name-input");
  const feedback = document.querySelector("#auth-gate-feedback");
  let temporaryToken = "";

  const setFeedback = (message, success = false) => {
    feedback.textContent = message;
    feedback.style.color = success ? "#86efac" : "#fda4af";
  };

  const openSession = (token, user = null) => {
    session = { token, createdAt: Date.now() };
    storage.set(SESSION_KEY, token);
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

  const registration = await api.register();
  if (registration.ok && registration.token) {
    temporaryToken = registration.token;
    tokenValue.textContent = temporaryToken;
  } else {
    tokenValue.textContent = "Indisponible";
    setFeedback(registration.error || "Le backend est indisponible pour le moment.");
  }

  copyButton.onclick = async () => {
    if (!temporaryToken) return;
    try {
      await navigator.clipboard.writeText(temporaryToken);
      setFeedback("Identifiant copié ✅", true);
    } catch {
      setFeedback("Impossible de copier automatiquement.");
    }
  };

  continueButton.onclick = () => {
    if (!temporaryToken) {
      setFeedback("Aucun identifiant temporaire disponible.");
      return;
    }
    const name = nameInput.value.trim();
    if (!name) {
      setFeedback("Choisissez un pseudo pour continuer.");
      nameInput.focus();
      return;
    }
    continueButton.disabled = true;
    apiRequestWithToken(temporaryToken, "/auth/me/name", {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }).then((result) => {
      continueButton.disabled = false;
      if (!result.ok) {
        setFeedback(result.error || "Impossible d'enregistrer le pseudo.");
        return;
      }
      openSession(temporaryToken, result.user);
    });
  };

  const tryLogin = async () => {
    const token = input.value.trim();
    if (!token) {
      setFeedback("Entre un identifiant valide.");
      return;
    }

    if (accounts[token]) {
      openSession(token);
      return;
    }

    if (!isBackendToken(token)) {
      setFeedback("Identifiant invalide ou expiré.");
      return;
    }

    loginButton.disabled = true;
    const result = await apiRequestWithToken(token, "/auth/me");
    loginButton.disabled = false;
    if (!result.ok || !result.user) {
      setFeedback("Identifiant invalide ou expiré.");
      return;
    }

    openSession(token, result.user);
  };

  loginButton.onclick = tryLogin;
  input.onkeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      tryLogin();
    }
  };
  input.focus();
}

function renderShell() {
  document.querySelector("#app").innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark">PW</span><span>PlayWeb</span></div>
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

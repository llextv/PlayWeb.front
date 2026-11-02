(() => {
  const IS_LOCAL = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  const API_BASE_URL = (window.PLAYWEB_API_URL || (IS_LOCAL
    ? `${window.location.origin}/api/v1`
    : "https://deeppink-bear-404650.hostingersite.com/api/v1")).replace(/\/$/, "");
  const cssImage = (value) => {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" || url.protocol === "http:" ? `url(${JSON.stringify(url.href)})` : "";
    } catch {
      return "";
    }
  };
  const root = document.querySelector("#shared-profile");
  const token = new URLSearchParams(window.location.search).get("token");
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const showError = (message) => {
    root.querySelector(".shared-profile-card").innerHTML = `<div class="shared-profile-error"><h1>Profil indisponible</h1><p class="muted">${escapeHtml(message)}</p></div>`;
  };

  if (!token) {
    showError("Ce lien de profil est invalide.");
    return;
  }

  fetch(`${API_BASE_URL}/auth/profile/${encodeURIComponent(token)}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
    .then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Ce profil n'est pas disponible.");
      return body.profile;
    })
    .then((profile) => {
      const initial = profile.name.slice(0, 1).toUpperCase();
      const avatarImage = cssImage(profile.avatarUrl);
      const totalHours = profile.games.reduce((sum, game) => sum + Number(game.playedHours || 0), 0);
      root.querySelector(".shared-profile-card").innerHTML = `
          <div class="shared-profile-head">
            <div class="shared-profile-avatar">${avatarImage ? "" : escapeHtml(initial)}</div>
            <div><p class="eyebrow">Profil PlayWeb</p><h1>${escapeHtml(profile.name)}</h1><p class="muted small">Membre depuis ${new Date(profile.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</p></div>
          </div>
          <div class="shared-profile-actions">
            <button class="btn primary" type="button" data-join-profile>Rejoindre en jeu</button>
          </div>
          <div class="shared-profile-grid">
            <div class="shared-profile-stat"><strong>${Number(profile.friendsCount) || 0}</strong><span>Amis</span></div>
            <div class="shared-profile-stat"><strong>${Number(profile.achievementsCount) || 0}</strong><span>Succès</span></div>
            <div class="shared-profile-stat"><strong>${totalHours.toFixed(1)} h</strong><span>Jeu</span></div>
          </div>
          <div class="shared-profile-games">
            ${profile.games.length ? profile.games.map((game) => `<div class="shared-profile-game"><span>${escapeHtml(game.name)}</span><strong>${Number(game.playedHours).toFixed(1)} h</strong></div>`).join("") : '<p class="muted">Aucune activité de jeu pour le moment.</p>'}
          </div>`;
      if (avatarImage) root.querySelector(".shared-profile-avatar").style.backgroundImage = avatarImage;
      document.title = `${profile.name} — Profil PlayWeb`;
      document.querySelector("[data-join-profile]").onclick = async () => {
        const sessionToken = (() => {
          const raw = window.localStorage.getItem("websteam.session.v2");
          if (!raw) return null;
          try {
            return JSON.parse(raw).token || null;
          } catch {
            return raw;
          }
        })();

        if (!sessionToken) {
          window.location.href = `../index/index.html?join=${encodeURIComponent(token)}`;
          return;
        }

        const response = await fetch(`${API_BASE_URL}/friends/${encodeURIComponent(profile.id)}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" },
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          window.alert(body.error || "Impossible d'envoyer la demande d'ami.");
          return;
        }
        const button = document.querySelector("[data-join-profile]");
        button.textContent = "Demande envoyée";
        button.disabled = true;
      };
    })
    .catch((error) => showError(error.message));
})();

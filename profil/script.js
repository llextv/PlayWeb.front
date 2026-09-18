window.pageInit = ({ user, data, games, setText, toast, save, icons, api }) => {
  setText("#page-title", "Votre profil");

  const profile = data.profile || {};
  const storedToken = window.localStorage?.getItem?.("websteam.session.v2");
  let sessionToken = storedToken || "demo-token-alice";
  try {
    sessionToken = JSON.parse(storedToken).token;
  } catch {
    // Current storage format contains the token directly.
  }
  const achievements = data.achievements || [];
  const unlocked = achievements.filter((item) => item.done).length;
  const playedGames = games.filter((game) => profile.games?.[game.id]?.played);
  const totalHours = games.reduce((sum, game) => sum + Number(profile.games?.[game.id]?.hours || 0), 0);
  let profileShareUrl = null;
  const copyProfileLink = async (url) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
      return true;
    }

    const input = document.createElement("textarea");
    input.value = url;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.focus();
    input.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      input.remove();
    }
    return copied;
  };

  const renderAvatar = (avatarUrl, fallback = user.avatar) => {
    const avatar = document.querySelector("[data-profile-avatar]");
    if (avatar) {
      avatar.textContent = avatarUrl ? "" : fallback;
      avatar.style.backgroundImage = avatarUrl ? `url("${avatarUrl}")` : "";
      avatar.classList.toggle("has-image", Boolean(avatarUrl));
    }
    const miniAvatar = document.querySelector("[data-user-avatar]");
    if (miniAvatar) {
      miniAvatar.textContent = avatarUrl ? "" : fallback;
      miniAvatar.style.backgroundImage = avatarUrl ? `url("${avatarUrl}")` : "";
      miniAvatar.classList.toggle("has-image", Boolean(avatarUrl));
    }
  };

  renderAvatar(user.avatarUrl);
  setText("[data-profile-name]", user.name);
  setText("[data-profile-status]", user.status);
  setText("[data-profile-joined]", new Date(profile.joinedAt || Date.now()).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));
  setText("[data-friends-count]", profile.friendsCount ?? data.friends.length);
  setText("[data-achievements-count]", `${unlocked} / ${achievements.length}`);
  setText("[data-hours-count]", `${totalHours.toFixed(1)} h`);
  setText("[data-games-count]", `${playedGames.length} / ${games.length}`);
  document.querySelector("[data-profile-input]").value = user.name;

  const percent = achievements.length ? Math.round((unlocked / achievements.length) * 100) : 0;
  setText("[data-achievement-percent]", `${percent}%`);
  setText("[data-achievement-title]", unlocked === achievements.length ? "Collection terminée !" : "Encore quelques défis");
  document.querySelector(".achievement-ring").style.setProperty("--achievement-progress", `${percent}%`);
  document.querySelector("[data-achievement-progress]").style.width = `${percent}%`;

  const activity = document.querySelector("[data-game-activity]");
  games.forEach((game) => {
    const stats = profile.games?.[game.id] || { hours: 0, played: false };
    const row = document.createElement("article");
    row.className = `game-activity-row ${stats.played ? "" : "not-played"}`;
    row.innerHTML = `
      <div class="game-mark ${game.id}">${game.name.slice(0, 1)}</div>
      <div class="grow"><div class="game-row-title"><b>${game.name}</b><span class="${stats.played ? "tag" : "muted"}">${stats.played ? "Joué" : "Jamais joué"}</span></div>
      <div class="activity-track"><i style="width: ${Math.min(100, stats.hours * 4)}%"></i></div></div>
      <strong class="game-hours">${Number(stats.hours).toFixed(1)} h</strong>`;
    activity.append(row);
  });

  const privacySelect = document.querySelector("[data-privacy-select]");
  const updatePrivacy = () => {
    privacySelect.value = profile.privacy === "private" ? "private" : "public";
  };
  updatePrivacy();

  document.querySelector("[data-profile-form]").onsubmit = async (event) => {
    event.preventDefault();
    const input = document.querySelector("[data-profile-input]");
    const name = input.value.trim();
    const feedback = document.querySelector("[data-profile-feedback]");
    if (name.length < 3) {
      feedback.textContent = "Ton pseudo doit contenir au moins 3 caractères.";
      feedback.className = "form-feedback error";
      return;
    }
    if (!api) {
      feedback.textContent = "Le backend est indisponible.";
      feedback.className = "form-feedback error";
      return;
    }

    const result = await api.updateName(name);
    if (!result.ok || !result.user) {
      feedback.textContent = result.error || "Impossible de modifier le pseudo.";
      feedback.className = "form-feedback error";
      return;
    }

    profile.name = result.user.name;
    user.name = result.user.name;
    data.profile = profile;
    setText("[data-profile-name]", result.user.name);
    document.querySelector(".user-mini b").textContent = result.user.name;
    feedback.textContent = "Pseudo modifié avec succès.";
    feedback.className = "form-feedback success";
    toast("Ton profil a été mis à jour.");
  };

  privacySelect.onchange = () => {
    const isPublic = privacySelect.value === "public";
    if (!api) {
      updatePrivacy();
      return;
    }
    api.updatePrivacy(isPublic).then((result) => {
      if (!result.ok) {
        updatePrivacy();
        toast(result.error || "Impossible de modifier la visibilité.");
        return;
      }
      profile.privacy = isPublic ? "public" : "private";
      updatePrivacy();
      toast(isPublic ? "Profil visible par tous." : "Profil maintenant privé.");
    });
  };

  let tokenVisible = false;
  const tokenElement = document.querySelector("[data-session-token]");
  document.querySelector("[data-reveal-token]").onclick = () => {
    tokenVisible = !tokenVisible;
    tokenElement.textContent = tokenVisible ? sessionToken : "••••••••••••••••";
  };
  document.querySelector("[data-copy-token]").onclick = async () => {
    await navigator.clipboard?.writeText(sessionToken);
    toast("Token copié dans le presse-papiers.");
  };

  document.querySelector("[data-share-profile]").onclick = async () => {
    if (!api) {
      toast("Le backend est indisponible.");
      return;
    }
    if (!profileShareUrl) {
      const result = await api.getProfileLink();
      if (!result.ok || !result.profileToken) {
        toast(result.error || "Impossible de générer le lien.");
        return;
      }
      profileShareUrl = new URL(
        `partage.html?token=${encodeURIComponent(result.profileToken)}`,
        window.location.href,
      ).href;
    }
    const url = profileShareUrl;
    let copied = false;
    try {
      copied = await copyProfileLink(url);
    } catch {
      copied = false;
    }
    if (copied) {
      toast("Lien du profil copié.");
    } else {
      window.prompt("Copiez ce lien :", url);
    }
  };

  document.querySelector("[data-edit-profile]").onclick = () => {
    document.querySelector("[data-profile-input]").focus();
    document.querySelector("[data-profile-input]").scrollIntoView({ behavior: "smooth", block: "center" });
  };

  document.querySelector(".avatar-edit-btn").onclick = (event) => {
    const button = event.currentTarget;
    button.classList.remove("is-clicked");
    requestAnimationFrame(() => {
      button.classList.add("is-clicked");
      window.setTimeout(() => button.classList.remove("is-clicked"), 350);
    });
    if (api) {
      const avatarUrl = window.prompt("URL de ton avatar (laisser vide pour supprimer) :", user.avatarUrl || "");
      if (avatarUrl === null) return;
      api.updateAvatar(avatarUrl.trim()).then((result) => {
        if (!result.ok) {
          toast(result.error || "Impossible de mettre à jour l'avatar.");
          return;
        }
        user.avatarUrl = result.user?.avatarUrl || null;
        data.profile.avatarUrl = user.avatarUrl;
        save();
        renderAvatar(user.avatarUrl);
        toast("Avatar mis à jour.");
      });
    }
  };

  document.querySelector("[data-delete-account]").onclick = () => {
    if (!window.confirm("Supprimer définitivement ton compte et toutes tes données locales ? Cette action est irréversible.")) return;
    localStorage.removeItem("websteam.session.v2");
    localStorage.removeItem("websteam.data.v2");
    window.location.href = "../index/index.html";
  };

  icons();
};

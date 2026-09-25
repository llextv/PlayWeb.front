const comingSoonLabels = {
  "soon": "Arrive bientôt",
  "very soon": "Arrive très bientôt",
};

const getComingSoonLabel = (tag) => {
  if (!tag) return null;
  const key = String(tag).trim().toLowerCase().replace(/[_-]+/g, " ");
  return comingSoonLabels[key] || null;
};

window.pageInit = ({ games, setText, session }) => {
  setText("#page-title", "Découvrir");
  setText("[data-games-count]", `${games.length} jeux`);
  const grid = document.querySelector(".games-grid");
  games.forEach((game) => {
    const mode =
      document.querySelector(`[data-game-id="${game.id}"]`)?.dataset.gameMode ||
      "MULTI";
    const comingSoon = getComingSoonLabel(game.tag);
    const card = document.createElement("article");
    card.className = `card game-card${comingSoon ? " coming-soon" : ""}`;
    if (comingSoon) card.setAttribute("aria-disabled", "true");
    card.innerHTML = `
      <div class="cover">${game.name}${comingSoon ? `<span class="soon-badge">${comingSoon}</span>` : ""}</div>
      <div class="card-body">
        <div class="row"><div><b>${game.name}</b><div class="muted small">${game.genre}</div></div><span class="tag">${mode}</span></div>
        <p class="muted small">${game.description}</p>
        <button class="btn primary game-play" type="button"${comingSoon ? " disabled" : ""}>${comingSoon || "Jouer"}</button>
      </div>`;
    grid.append(card);
    const launchUrl = game.launchUrl;
    if (launchUrl && !comingSoon) {
      card.querySelector(".game-play").onclick = () => {
        window.location.href = launchUrl.replace("[token de la personne]", session.token);
      };
    }
  });
};

window.pageInit = ({ user, games, setText, toast, icons, api, initialPageData }) => {
  setText("#page-title", "Classement");

  const rankingBody = document.querySelector("[data-ranking-body]");
  const gameFilter = document.querySelector("#game-filter");
  const rankingSubtitle = document.querySelector(".ranking-subtitle");
  const personalRankings = document.querySelector("[data-personal-rankings]");
  const rankingValueHeader = document.querySelector("[data-ranking-value-header]");
  let hasConsumedInitialRanking = false;

  gameFilter.innerHTML = games
    .map((game) => `<option value="${game.id}">${game.name}</option>`)
    .join("");

  function rankClass(rank) {
    if (rank === 1) return "rank-pill rank-top-1";
    if (rank === 2) return "rank-pill rank-top-2";
    if (rank === 3) return "rank-pill rank-top-3";
    return "rank-pill";
  }

  const renderRows = (scores, label) => {
    const sorted = [...(scores || [])].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    rankingSubtitle.textContent = `Top joueurs de ${label}`;
    rankingBody.innerHTML = sorted.length
      ? sorted.map((score, index) => `
        <tr>
          <td><span class="${rankClass(index + 1)}">${index + 1}</span></td>
          <td>${score.user?.name || "Joueur"}</td>
          <td>—</td>
          <td class="ranking-xp">${Number(score.score || 0).toLocaleString("fr-FR")}${label === "BrainrotStar" ? " /s" : ""}</td>
        </tr>`).join("")
      : '<tr><td colspan="4" class="muted">Aucun score enregistré.</td></tr>';
  };

  const renderPersonal = (leaderboards) => {
    const rows = (leaderboards || []).map((leaderboard) => {
      const sorted = [...(leaderboard.scores || [])].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
      const rank = sorted.findIndex((score) => score.user?.name === user.name) + 1;
      const game = games.find((item) => item.id === leaderboard.gameId);
      return `<article class="personal-ranking-row"><span class="personal-game">${game?.name || leaderboard.name}</span><span class="${rankClass(rank)}">${rank ? `${rank}e` : "Non classé"}</span></article>`;
    });
    personalRankings.innerHTML = rows.join("") || '<p class="muted">Aucun classement disponible.</p>';
  };

  const loadRanking = async () => {
    const game = games.find((item) => item.id === gameFilter.value);
    const result = !hasConsumedInitialRanking && initialPageData?.ranking?.result
      ? initialPageData.ranking
      : game?.id === "brainrotstar"
        ? await api.getBrainrotLeaderboard()
        : api ? await api.getRanking(gameFilter.value) : { ok: false };
    hasConsumedInitialRanking = true;
    if (rankingValueHeader) {
      rankingValueHeader.textContent = game?.id === "brainrotstar" ? "Coins / sec" : "XP";
    }
    if (result.ok && result.result) {
      renderRows(result.result.scores, game?.name || "ce jeu");
      return;
    }
    renderRows([], game?.name || "ce jeu");
    if (result.error) toast(result.error);
  };

  gameFilter.addEventListener("change", loadRanking);
  document.querySelector("[data-scroll-profile]").onclick = () => {
    document.querySelector("[data-profile-section]").scrollIntoView({ behavior: "smooth" });
  };
  document.querySelector("[data-go-profile]").onclick = () => {
    window.location.href = "../profil/index.html";
  };

  renderPersonal([]);
  setText("[data-user-pseudo]", user.name);
  loadRanking();
  icons();
};

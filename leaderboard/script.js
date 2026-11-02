window.pageInit = ({ user, setText, toast, icons, api, initialPageData }) => {
  setText("#page-title", "Classement");

  const rankingBody = document.querySelector("[data-ranking-body]");
  const sortBy = document.querySelector("#sort-by");
  const personalRankings = document.querySelector("[data-personal-rankings]");
  let leaderboard = [];
  let pendingInitial = initialPageData?.ranking || null;

  const SORT_TYPES = {
    rank: "rank",
    cps: "coinPerSec",
    money: "gold",
    rebirth: "rebirth",
    win: "win",
    villageWins: "villageWins",
    achievements: "achievements",
    streak: "streak",
  };

  const SORTS = {
    name: (a, b) => a.name.localeCompare(b.name, "fr"),
    cps: (a, b) => b.cps - a.cps,
    money: (a, b) => b.money - a.money,
    rebirth: (a, b) => b.rebirth - a.rebirth || b.cps - a.cps || b.money - a.money,
    win: (a, b) => b.win - a.win,
    villageWins: (a, b) => b.villageWins - a.villageWins || b.rebirth - a.rebirth || b.cps - a.cps,
    achievements: (a, b) => b.achievements - a.achievements || b.rebirth - a.rebirth || b.cps - a.cps,
    streak: (a, b) => b.streak - a.streak || b.rebirth - a.rebirth || b.cps - a.cps,
    rank: (a, b) => b.rebirth - a.rebirth || b.cps - a.cps || b.money - a.money || a.name.localeCompare(b.name, "fr"),
  };

  function fmtInt(value) {
    const num = Number(value || 0);
    if (num >= 1_000_000_000_000) return `${(num / 1_000_000_000_000).toFixed(2).replace(/\.00$/, "")}T`;
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2).replace(/\.00$/, "")}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2).replace(/\.00$/, "")}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2).replace(/\.00$/, "")}K`;
    return `${Math.round(num * 100) / 100}`;
  }

  function rankClass(rank) {
    if (rank === 1) return "rank-pill rank-top-1";
    if (rank === 2) return "rank-pill rank-top-2";
    if (rank === 3) return "rank-pill rank-top-3";
    return "rank-pill";
  }

  const sortedRows = () => [...leaderboard].sort(SORTS[sortBy.value] || SORTS.rank).slice(0, 50);

  const renderPersonal = (rows) => {
    const index = rows.findIndex((player) => player.name === user.name);
    const rank = index + 1;
    personalRankings.innerHTML = `<article class="personal-ranking-row"><span class="personal-game">BrainrotStar</span><span class="${rankClass(rank)}">${rank ? `${rank}e` : "Non classé"}</span></article>`;
  };

  const render = () => {
    const rows = sortedRows();
    rankingBody.innerHTML = rows.length
      ? rows.map((player, index) => `
        <tr>
          <td><span class="${rankClass(index + 1)}">${index + 1}</span></td>
          <td class="name-cell">${escapeHtml(player.name)}</td>
          <td class="cps-cell">⚡ ${fmtInt(player.cps)} /s</td>
          <td class="money-cell">💰 ${fmtInt(player.money)}</td>
          <td class="rebirth-cell">🔄 ${player.rebirth}</td>
          <td class="win-cell">🏆 ${fmtInt(player.win)}</td>
          <td class="village-cell">🏝️ ${fmtInt(player.villageWins)}</td>
          <td class="achievements-cell">🏅 ${fmtInt(player.achievements)}</td>
          <td class="streak-cell${player.streak > 0 ? "" : " is-dead"}">🔥 ${player.streak}</td>
        </tr>`).join("")
      : '<tr><td colspan="9" class="muted">Aucun score enregistré.</td></tr>';
    renderPersonal(rows);
  };

  const loadRanking = async () => {
    const result = pendingInitial && sortBy.value === "rank"
      ? pendingInitial
      : await (api ? api.getBrainrotLeaderboard(SORT_TYPES[sortBy.value] || "rank") : { ok: false });
    pendingInitial = null;
    leaderboard = result.ok && Array.isArray(result.result?.scores) ? result.result.scores : [];
    render();
    if (!result.ok && result.error) toast(result.error);
  };

  sortBy.addEventListener("change", () => {
    if (sortBy.value === "name") {
      render();
      return;
    }
    loadRanking();
  });
  document.querySelector("[data-scroll-profile]").onclick = () => {
    document.querySelector("[data-profile-section]").scrollIntoView({ behavior: "smooth" });
  };
  document.querySelector("[data-go-profile]").onclick = () => {
    window.location.href = "../profil/index.html";
  };

  setText("[data-user-pseudo]", user.name);
  loadRanking();
  icons();
};

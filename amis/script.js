window.pageInit = ({ data, user, games, setText, toast, icons, api, save }) => {
setText("#page-title", "Équipage");
setText("[data-friends-count]", `${data.friends.length} amis`);

  const friendsList = document.querySelector("[data-friends-list]");
  const inviteModal = document.querySelector("[data-invite-modal]");
  const inviteFriend = document.querySelector("[data-invite-friend]");
  const inviteGame = document.querySelector("[data-invite-game]");
  let selectedFriend = null;

  inviteGame.innerHTML = games
    .map((game) => `<option value="${game.id}">${game.name}</option>`)
    .join("");

  const closeInviteModal = () => {
    inviteModal.classList.add("hidden");
    selectedFriend = null;
  };

  const openInviteModal = (friend) => {
    selectedFriend = friend;
    inviteFriend.textContent = friend.name;
    inviteGame.value = games[0]?.id || "";
    inviteModal.classList.remove("hidden");
    inviteGame.focus();
  };

  document.querySelectorAll("[data-close-invite]").forEach((element) => {
    element.onclick = closeInviteModal;
  });

  document.querySelector("[data-invite-form]").onsubmit = (event) => {
    event.preventDefault();
    if (!selectedFriend) return;
    const game = games.find((item) => item.id === inviteGame.value);
    if (!game) return;
    closeInviteModal();
    toast(`Invitation envoyée à ${selectedFriend.name} pour ${game.name}.`);
  };

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !inviteModal.classList.contains("hidden")) {
      closeInviteModal();
    }
  });

  const renderFriends = () => {
    friendsList.innerHTML = "";
    const friends = data.friends || [];
    setText("[data-friends-count]", `${friends.length} amis`);

    if (!friends.length) {
      friendsList.innerHTML = '<p class="friends-empty">Aucun ami accepté pour le moment.</p>';
      return;
    }

    friends.forEach((friend) => {
    const row = document.createElement("article");
    row.className = "friend-row";
    row.innerHTML = `
      <div class="friend-details">
        <div class="avatar">${friend.avatar}</div>
        <div>
          <b>${friend.name}</b>
          <p class="${friend.status === "En ligne" ? "tag" : "muted"}">● ${friend.status}</p>
        </div>
      </div>
      <div class="friend-actions">
        <button class="btn invite-friend" type="button">Inviter</button>
        <button class="btn danger remove-friend" type="button">Retirer</button>
      </div>`;

    row.querySelector(".invite-friend").onclick = () => {
      openInviteModal(friend);
    };

    row.querySelector(".remove-friend").onclick = () => {
      const remove = api ? api.deleteFriend(friend.id) : Promise.resolve({ ok: true });
      remove.then((result) => {
        if (!result.ok) {
          toast(result.error || "Impossible de retirer cet ami.");
          return;
        }
        data.friends = data.friends.filter((item) => item.id !== friend.id);
        save();
        renderFriends();
        toast(`${friend.name} a été retiré de vos amis.`);
      });
    };

    friendsList.append(row);
    });
  };

  const renderRequests = () => {
    const requestList = document.querySelector("[data-request-list]");
    const requests = (data.friendships || []).filter(
      (friendship) => friendship.status === "PENDING" && friendship.addresseeId === user.id,
    );
    requestList.innerHTML = "";
    if (!requests.length) {
      requestList.innerHTML = '<p class="friends-empty">Aucune demande en attente</p>';
      return;
    }

    requests.forEach((request) => {
      const name = request.requester?.name || "Joueur";
      const row = document.createElement("div");
      row.className = "request-row";
      row.innerHTML = `<div><b>${name}</b><p class="muted small">Demande d'ami</p></div>
        <div class="friend-actions"><button class="btn primary" type="button">Accepter</button><button class="btn danger" type="button">Refuser</button></div>`;
      const [acceptButton, declineButton] = row.querySelectorAll("button");
      acceptButton.onclick = () => (api ? api.acceptFriend(request.id) : Promise.resolve({ ok: true })).then((result) => {
        if (!result.ok) return toast(result.error || "Impossible d'accepter la demande.");
        request.status = "ACCEPTED";
        data.friends.push({ id: request.id, userId: request.requesterId, name, avatar: name.slice(0, 1).toUpperCase(), status: "Hors ligne" });
        save();
        renderRequests();
        renderFriends();
      });
      declineButton.onclick = () => (api ? api.declineFriend(request.id) : Promise.resolve({ ok: true })).then((result) => {
        if (!result.ok) return toast(result.error || "Impossible de refuser la demande.");
        request.status = "DECLINED";
        save();
        renderRequests();
      });
      requestList.append(row);
    });
  };

  renderFriends();
  renderRequests();

  document.querySelector("[data-invite-button]").onclick = () => {
    const input = document.querySelector("[data-invite-input]");
    const name = input.value.trim();

    if (!name) {
      toast("Entre le pseudo d'un ami.");
      return;
    }

    (api ? api.askFriend(name) : Promise.resolve({ ok: true })).then((result) => {
      if (!result.ok) {
        toast(result.error || "Impossible d'envoyer la demande.");
        return;
      }
      toast("Demande envoyée.");
      input.value = "";
    });
  };

  icons();
};

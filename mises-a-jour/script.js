window.pageInit = ({ setText }) => {
  setText("#page-title", "Mises à jour");
  setupCollapsibleNotes();
  window.lucide?.createIcons();
};

function setupCollapsibleNotes() {
  const notes = [...document.querySelectorAll(".updates-card")].filter((card) => card.querySelector(".patchnote-content"));
  const dateOf = (card) => card.querySelector(".version-date")?.textContent.trim();
  const latest = notes[0] && dateOf(notes[0]);
  notes.filter((card) => dateOf(card) !== latest).forEach((card) => {
    const header = card.querySelector(".updates-card-header");
    const content = card.querySelector(".patchnote-content");
    const body = document.createElement("div");
    body.className = "patchnote-body";
    content.replaceWith(body);
    body.append(content);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "patchnote-toggle";
    toggle.innerHTML = '<span></span><i data-lucide="chevron-down"></i>';
    header.append(toggle);

    const setOpen = (open) => {
      card.classList.toggle("is-collapsed", !open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.querySelector("span").textContent = open ? "Réduire" : "Afficher";
      body.inert = !open;
    };

    card.classList.add("is-collapsible");
    header.addEventListener("click", () => setOpen(card.classList.contains("is-collapsed")));
    setOpen(false);
  });
}

(function () {
  const store = window.CinefyStore;
  const firestore = window.CinefyFirebase ? window.CinefyFirebase.firestore : null;
  const auth = window.CinefyFirebase ? window.CinefyFirebase.auth : null;
  const currentProfile = store ? store.loadProfile() : {};
  const params = new URLSearchParams(window.location.search);
  const defaultAvatar = "/assets/img/logo.svg";
  const state = {
    targetUid: "",
    viewerSignedIn: false,
    viewerUid: "",
    isOwnPage: false,
    targetProfile: {
      uid: "",
      displayName: sanitizeText(params.get("name") || "", 80),
      username: sanitizeUsername(params.get("username") || params.get("u") || "cinefyuser"),
      avatar: safeAvatarUrl(params.get("avatar"), {
        displayName: params.get("name") || "",
        username: params.get("username") || params.get("u") || "cinefyuser"
      })
    },
    targetFriends: [],
    viewerFriendIds: new Set(),
    incomingRequestIds: new Set(),
    outgoingRequestIds: new Set(),
    busyIds: new Set()
  };

  const userFriendsAvatar = document.getElementById("userFriendsAvatar");
  const userFriendsTitle = document.getElementById("userFriendsTitle");
  const userFriendsHandle = document.getElementById("userFriendsHandle");
  const userFriendsSummary = document.getElementById("userFriendsSummary");
  const userFriendsBackLink = document.getElementById("userFriendsBackLink");
  const userFriendsManageLink = document.getElementById("userFriendsManageLink");
  const userFriendsCount = document.getElementById("userFriendsCount");
  const userFriendsStatus = document.getElementById("userFriendsStatus");
  const userFriendsStatusCopy = document.getElementById("userFriendsStatusCopy");
  const userFriendsCaption = document.getElementById("userFriendsCaption");
  const userFriendsList = document.getElementById("userFriendsList");
  const userFriendsNotice = document.getElementById("userFriendsNotice");

  renderPage();
  void bootstrapPage();

  async function bootstrapPage() {
    state.targetUid = await resolveTargetUid();
    const viewer = await waitForAuthResolution();
    state.viewerSignedIn = Boolean(viewer);
    state.viewerUid = viewer && viewer.uid ? String(viewer.uid) : "";
    state.isOwnPage = Boolean(state.targetUid && state.viewerUid && state.targetUid === state.viewerUid);

    if (!state.targetUid) {
      renderUnavailableState("Nao encontramos um usuario valido para abrir esta lista de amigos.");
      return;
    }

    if (!state.viewerSignedIn || !firestore) {
      renderPage();
      renderNotice(
        "Entre para explorar essa rede",
        "A lista de amigos fica disponivel para usuarios autenticados, preservando o contexto social do Cinefy Club.",
        [{ href: "login.html", icon: "login", label: "Entrar", strong: true }]
      );
      return;
    }

    try {
      await Promise.all([loadTargetProfile(), loadTargetFriends(), loadViewerRelationships()]);
    } catch (error) {
      console.error("Erro ao carregar amigos do usuario:", error);
      renderNotice(
        "Nao foi possivel carregar tudo agora",
        "Tente novamente em instantes. O perfil ainda pode ser aberto normalmente."
      );
    }

    renderPage();
  }

  async function resolveTargetUid() {
    const directUid = sanitizeText(params.get("uid"), 128);
    if (directUid) return directUid;

    const username = sanitizeUsername(params.get("u") || params.get("username") || "");
    if (!username || !firestore) {
      return "";
    }

    try {
      const snapshot = await firestore.collection("usernames").doc(getUsernameDocId(username)).get();
      if (snapshot.exists) {
        return sanitizeText((snapshot.data() || {}).uid, 128);
      }
    } catch (error) {
      console.error("Erro ao resolver uid da pagina de amigos:", error);
    }

    return "";
  }

  async function loadTargetProfile() {
    const snapshot = await firestore.collection("users").doc(state.targetUid).get();
    if (!snapshot.exists) return;

    const safeProfile = snapshot.data() || {};
    state.targetProfile = {
      uid: sanitizeText(safeProfile.uid || state.targetUid, 128),
      displayName: sanitizeText(safeProfile.displayName || state.targetProfile.displayName, 80),
      username: sanitizeUsername(safeProfile.username || state.targetProfile.username || "cinefyuser"),
      avatar: safeAvatarUrl(safeProfile.avatar || state.targetProfile.avatar, {
        displayName: safeProfile.displayName || state.targetProfile.displayName,
        username: safeProfile.username || state.targetProfile.username || "cinefyuser"
      })
    };
  }

  async function loadTargetFriends() {
    const snapshot = await firestore.collection("users").doc(state.targetUid).collection("friends").get();
    state.targetFriends = snapshot.docs.map((doc) => normalizeFriendDoc(doc.id, doc.data()));
  }

  async function loadViewerRelationships() {
    const viewerDoc = firestore.collection("users").doc(state.viewerUid);
    const [friendSnapshot, incomingSnapshot, outgoingSnapshot] = await Promise.all([
      viewerDoc.collection("friends").get(),
      viewerDoc.collection("friend_requests").get(),
      viewerDoc.collection("outgoing_requests").get()
    ]);

    state.viewerFriendIds = new Set(friendSnapshot.docs.map((doc) => doc.id));
    state.incomingRequestIds = new Set(incomingSnapshot.docs.map((doc) => doc.id));
    state.outgoingRequestIds = new Set(outgoingSnapshot.docs.map((doc) => doc.id));
  }

  function renderPage() {
    userFriendsAvatar.src = safeAvatarUrl(state.targetProfile.avatar, state.targetProfile);
    userFriendsTitle.textContent = state.isOwnPage
      ? "Seus amigos no Cinefy Club"
      : `Amigos de ${state.targetProfile.displayName || `@${state.targetProfile.username}`}`;
    userFriendsHandle.textContent = `@${state.targetProfile.username || "cinefyuser"}`;
    userFriendsSummary.textContent = state.isOwnPage
      ? "Abra sua rede, veja quem ja esta conectado e remova ou adicione pessoas sem sair do fluxo."
      : "Veja quem ja faz parte dessa rede e aja direto no card certo: adicionar, aceitar ou remover, quando fizer sentido.";
    userFriendsBackLink.href = getProfileHref(state.targetProfile);
    userFriendsManageLink.classList.toggle("hidden", !state.isOwnPage);
    userFriendsCount.textContent = String(state.targetFriends.length);

    if (!state.viewerSignedIn) {
      userFriendsStatus.textContent = "Entre para interagir";
      userFriendsStatusCopy.textContent = "Assim que voce autenticar, a lista libera a camada social com acoes diretas nos cards.";
    } else if (state.isOwnPage) {
      userFriendsStatus.textContent = "Sua rede ativa";
      userFriendsStatusCopy.textContent = "Daqui voce consegue abrir perfis ou remover amizades sem dar voltas.";
    } else {
      userFriendsStatus.textContent = "Rede de outro usuario";
      userFriendsStatusCopy.textContent = "Os cards abaixo mostram a relacao de cada pessoa com voce, para reduzir cliques desnecessarios.";
    }

    renderFriendsList();
  }

  function renderFriendsList() {
    if (!state.viewerSignedIn) {
      userFriendsCaption.textContent = "Entre para ver a lista completa de amigos e interagir com ela.";
      userFriendsList.innerHTML = `
        <div class="user-friends-empty">
          <span class="material-symbols-outlined text-5xl text-red-300">login</span>
          <p class="text-xl font-black text-white">A camada social fica disponivel quando voce entra.</p>
          <p class="text-sm leading-relaxed">Depois do login, voce consegue ver a rede desse perfil e agir em cada card sem desvio.</p>
        </div>
      `;
      return;
    }

    if (!state.targetFriends.length) {
      userFriendsCaption.textContent = "Esse perfil ainda nao possui amigos visiveis na rede.";
      userFriendsList.innerHTML = `
        <div class="user-friends-empty">
          <span class="material-symbols-outlined text-5xl text-red-300">group_off</span>
          <p class="text-xl font-black text-white">Nenhum amigo visivel por enquanto.</p>
          <p class="text-sm leading-relaxed">Quando essa rede crescer, os amigos aparecem aqui automaticamente.</p>
        </div>
      `;
      return;
    }

    userFriendsCaption.textContent = state.isOwnPage
      ? "Abra um perfil ou remova uma amizade direto desta lista."
      : "Cada card mostra o contexto certo para voce adicionar, aceitar ou remover sem navegar para outra tela.";

    userFriendsList.innerHTML = state.targetFriends.map((friend) => {
      const actions = buildFriendActions(friend);
      return `
        <article class="user-friends-card">
          <a class="user-friends-card__identity" href="${escapeAttribute(getProfileHref(friend))}">
            <img alt="${escapeAttribute(friend.displayName || friend.name || "Usuario")}" class="user-friends-card__avatar" decoding="async" loading="lazy" src="${escapeAttribute(safeAvatarUrl(friend.avatar, friend))}"/>
            <div class="user-friends-card__copy">
              <h3 class="user-friends-card__name">${escapeHtml(friend.displayName || friend.name || "Usuario")}</h3>
              <p class="user-friends-card__meta">@${escapeHtml(friend.username || "cinefyuser")}</p>
              <p class="user-friends-card__subcopy">${escapeHtml(friend.favoriteGenre || "Cinema")}${friend.location ? ` &bull; ${escapeHtml(friend.location)}` : ""}</p>
            </div>
          </a>
          <div class="user-friends-card__actions">
            ${actions.map(renderActionButton).join("")}
          </div>
        </article>
      `;
    }).join("");

    userFriendsList.querySelectorAll("[data-friend-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.getAttribute("data-friend-action");
        const friendId = button.getAttribute("data-friend-id");
        if (!friendId) return;

        if (action === "add") {
          await sendFriendRequest(friendId);
          return;
        }

        if (action === "accept") {
          await acceptFriendRequest(friendId);
          return;
        }

        if (action === "remove") {
          await removeFriend(friendId);
        }
      });
    });
  }

  function buildFriendActions(friend) {
    const isSelf = Boolean(friend.id === state.viewerUid);
    const isFriend = state.viewerFriendIds.has(friend.id);
    const hasIncoming = state.incomingRequestIds.has(friend.id);
    const hasOutgoing = state.outgoingRequestIds.has(friend.id);
    const isBusy = state.busyIds.has(friend.id);

    if (isSelf) {
      return [{
        label: "Voce",
        icon: "person",
        variant: "neutral",
        disabled: true
      }];
    }

    if (state.isOwnPage || isFriend) {
      return [{
        label: isBusy ? "Atualizando..." : "Remover",
        icon: "person_remove",
        variant: "neutral",
        action: "remove",
        friendId: friend.id,
        disabled: isBusy
      }];
    }

    if (hasIncoming) {
      return [{
        label: isBusy ? "Aceitando..." : "Aceitar amizade",
        icon: "person_add",
        variant: "strong",
        action: "accept",
        friendId: friend.id,
        disabled: isBusy
      }];
    }

    if (hasOutgoing) {
      return [{
        label: "Pedido enviado",
        icon: "schedule",
        variant: "neutral",
        disabled: true
      }];
    }

    return [{
      label: isBusy ? "Enviando..." : "Adicionar",
      icon: "person_add",
      variant: "strong",
      action: "add",
      friendId: friend.id,
      disabled: isBusy
    }];
  }

  function renderActionButton(action) {
    return `
      <button class="user-friends-card__button${action.variant === "strong" ? " user-friends-card__button--strong" : ""}${action.variant === "neutral" ? " user-friends-card__button--neutral" : ""}" ${action.disabled ? "disabled" : ""} ${action.action ? `data-friend-action="${escapeAttribute(action.action)}" data-friend-id="${escapeAttribute(action.friendId)}"` : ""} type="button">
        <span class="material-symbols-outlined text-base">${escapeHtml(action.icon)}</span>
        <span>${escapeHtml(action.label)}</span>
      </button>
    `;
  }

  async function sendFriendRequest(friendId) {
    if (!firestore || !state.viewerUid || state.busyIds.has(friendId)) return;
    const friend = state.targetFriends.find((item) => item.id === friendId);
    if (!friend) return;

    state.busyIds.add(friendId);
    renderFriendsList();

    try {
      const requestPayload = {
        senderUid: state.viewerUid,
        displayName: currentProfile.displayName || currentProfile.username || "Usuario",
        username: currentProfile.username || "cinefyuser",
        avatar: currentProfile.avatar || defaultAvatar,
        createdAt: new Date().toISOString()
      };

      await Promise.all([
        firestore.collection("users").doc(friendId).collection("friend_requests").doc(state.viewerUid).set(requestPayload),
        firestore.collection("users").doc(state.viewerUid).collection("outgoing_requests").doc(friendId).set({
          recipientUid: friendId,
          displayName: friend.displayName || friend.name || "Usuario",
          username: friend.username || "cinefyuser",
          avatar: friend.avatar || defaultAvatar,
          createdAt: new Date().toISOString()
        })
      ]);

      state.outgoingRequestIds.add(friendId);
      renderNotice("Pedido enviado", `Avisamos @${friend.username || "cinefyuser"} de que voce quer entrar nessa rede.`);
    } catch (error) {
      console.error("Erro ao enviar pedido nesta lista de amigos:", error);
      renderNotice("Nao foi possivel enviar o pedido", "Tente novamente em instantes. Se o problema persistir, abra o perfil da pessoa.");
    } finally {
      state.busyIds.delete(friendId);
      renderFriendsList();
    }
  }

  async function acceptFriendRequest(friendId) {
    if (!firestore || !state.viewerUid || state.busyIds.has(friendId)) return;
    const friend = state.targetFriends.find((item) => item.id === friendId);
    if (!friend) return;

    state.busyIds.add(friendId);
    renderFriendsList();

    try {
      await commitRelationshipBatch(friendId, (batch, refs) => {
        batch.set(refs.currentFriend, {
          id: friendId,
          name: friend.displayName || friend.name || "Usuario",
          displayName: friend.displayName || friend.name || "Usuario",
          username: friend.username || "cinefyuser",
          avatar: friend.avatar || defaultAvatar,
          favoriteGenre: friend.favoriteGenre || "Cinema",
          location: friend.location || "",
          createdAt: new Date().toISOString()
        });
        batch.set(refs.otherFriend, {
          id: state.viewerUid,
          name: currentProfile.displayName || currentProfile.username || "Usuario",
          displayName: currentProfile.displayName || currentProfile.username || "Usuario",
          username: currentProfile.username || "cinefyuser",
          avatar: currentProfile.avatar || defaultAvatar,
          favoriteGenre: "Cinema",
          location: currentProfile.location || "",
          createdAt: new Date().toISOString()
        });
        batch.delete(refs.currentIncoming);
        batch.delete(refs.currentOutgoing);
        batch.delete(refs.otherIncoming);
        batch.delete(refs.otherOutgoing);
      });

      state.incomingRequestIds.delete(friendId);
      state.viewerFriendIds.add(friendId);
      renderNotice("Amizade aceita", `Agora voce tambem esta conectado a @${friend.username || "cinefyuser"}.`);
    } catch (error) {
      console.error("Erro ao aceitar pedido nesta lista:", error);
      renderNotice("Nao foi possivel aceitar agora", "Tente novamente em instantes.");
    } finally {
      state.busyIds.delete(friendId);
      renderFriendsList();
    }
  }

  async function removeFriend(friendId) {
    if (!firestore || !state.viewerUid || state.busyIds.has(friendId)) return;
    const friend = state.targetFriends.find((item) => item.id === friendId);
    if (!friend) return;

    state.busyIds.add(friendId);
    renderFriendsList();

    try {
      await commitRelationshipBatch(friendId, (batch, refs) => {
        batch.delete(refs.currentFriend);
        batch.delete(refs.otherFriend);
        batch.delete(refs.currentIncoming);
        batch.delete(refs.currentOutgoing);
        batch.delete(refs.otherIncoming);
        batch.delete(refs.otherOutgoing);
      });

      state.viewerFriendIds.delete(friendId);
      state.incomingRequestIds.delete(friendId);
      state.outgoingRequestIds.delete(friendId);

      if (state.isOwnPage) {
        state.targetFriends = state.targetFriends.filter((item) => item.id !== friendId);
        userFriendsCount.textContent = String(state.targetFriends.length);
      }

      renderNotice("Conexao removida", `A relacao com @${friend.username || "cinefyuser"} foi atualizada.`);
    } catch (error) {
      console.error("Erro ao remover amizade nesta lista:", error);
      renderNotice("Nao foi possivel remover agora", "Tente novamente em instantes.");
    } finally {
      state.busyIds.delete(friendId);
      renderFriendsList();
    }
  }

  function commitRelationshipBatch(otherUserId, applyBatch) {
    const refs = getRelationshipRefs(otherUserId);
    const batch = firestore.batch();
    applyBatch(batch, refs);
    return batch.commit();
  }

  function getRelationshipRefs(otherUserId) {
    return {
      currentFriend: firestore.collection("users").doc(state.viewerUid).collection("friends").doc(otherUserId),
      otherFriend: firestore.collection("users").doc(otherUserId).collection("friends").doc(state.viewerUid),
      currentIncoming: firestore.collection("users").doc(state.viewerUid).collection("friend_requests").doc(otherUserId),
      currentOutgoing: firestore.collection("users").doc(state.viewerUid).collection("outgoing_requests").doc(otherUserId),
      otherIncoming: firestore.collection("users").doc(otherUserId).collection("friend_requests").doc(state.viewerUid),
      otherOutgoing: firestore.collection("users").doc(otherUserId).collection("outgoing_requests").doc(state.viewerUid)
    };
  }

  function normalizeFriendDoc(id, rawFriend) {
    const safeFriend = rawFriend && typeof rawFriend === "object" ? rawFriend : {};
    return {
      id: sanitizeText(id || safeFriend.id || "", 128),
      username: sanitizeUsername(safeFriend.username || safeFriend.id || "cinefyuser"),
      name: sanitizeText(safeFriend.name || safeFriend.displayName || "Usuario", 80) || "Usuario",
      displayName: sanitizeText(safeFriend.displayName || safeFriend.name || "", 80),
      favoriteGenre: sanitizeText(safeFriend.favoriteGenre || "Cinema", 60) || "Cinema",
      location: sanitizeText(safeFriend.location || "", 120),
      avatar: safeAvatarUrl(safeFriend.avatar, {
        displayName: safeFriend.displayName || safeFriend.name || safeFriend.username || "Usuario",
        username: safeFriend.username || safeFriend.id || "cinefyuser"
      })
    };
  }

  function renderNotice(title, copy, actions = []) {
    userFriendsNotice.classList.remove("hidden");
    userFriendsNotice.innerHTML = `
      <p class="user-friends-notice__title">${escapeHtml(title)}</p>
      <p class="user-friends-notice__copy">${escapeHtml(copy)}</p>
      ${actions.length ? `
        <div class="user-friends-notice__actions">
          ${actions.map((action) => `
            <a class="user-friends-action${action.strong ? " user-friends-action--strong" : ""}" href="${escapeAttribute(action.href)}">
              <span class="material-symbols-outlined">${escapeHtml(action.icon || "arrow_forward")}</span>
              <span>${escapeHtml(action.label)}</span>
            </a>
          `).join("")}
        </div>
      ` : ""}
    `;
  }

  function renderUnavailableState(message) {
    userFriendsTitle.textContent = "Amigos indisponiveis";
    userFriendsHandle.textContent = "@cinefyuser";
    userFriendsSummary.textContent = message;
    userFriendsCount.textContent = "0";
    userFriendsStatus.textContent = "Indisponivel";
    userFriendsStatusCopy.textContent = "Nao foi possivel montar esta pagina agora.";
    userFriendsCaption.textContent = message;
    userFriendsList.innerHTML = `
      <div class="user-friends-empty">
        <span class="material-symbols-outlined text-5xl text-red-300">person_off</span>
        <p class="text-xl font-black text-white">Nao foi possivel abrir essa rede.</p>
        <p class="text-sm leading-relaxed">${escapeHtml(message)}</p>
      </div>
    `;
    renderNotice("Nao encontramos essa rede", message, [{ href: "amigos.html", icon: "arrow_back", label: "Voltar" }]);
  }

  function safeAvatarUrl(value, userLike) {
    const candidate = String(value || "").trim();
    const fallbackAvatar = store && typeof store.resolveProfileAvatar === "function"
      ? store.resolveProfileAvatar(userLike || { username: "cinefyuser" })
      : defaultAvatar;
    if (!candidate) return fallbackAvatar;

    if (
      /^data:image\/(png|jpeg|webp);/i.test(candidate) ||
      (candidate.startsWith("data:image/svg+xml") && candidate.includes("cinefy-generated-avatar")) ||
      candidate.startsWith("blob:")
    ) {
      return candidate;
    }

    try {
      const parsedUrl = new URL(candidate, window.location.origin);
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        return parsedUrl.href;
      }
    } catch (error) {
      return fallbackAvatar;
    }

    return fallbackAvatar;
  }

  function getProfileHref(user) {
    if (window.CinefyProfiles && typeof window.CinefyProfiles.buildPublicProfileHref === "function") {
      return window.CinefyProfiles.buildPublicProfileHref(user);
    }

    return "usuario.html";
  }

  function getUsernameDocId(value) {
    return encodeURIComponent(
      sanitizeUsername(value)
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    );
  }

  function waitForAuthResolution() {
    return new Promise((resolve) => {
      if (!auth || typeof auth.onAuthStateChanged !== "function") {
        resolve(auth && auth.currentUser ? auth.currentUser : null);
        return;
      }

      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user || null);
      }, () => {
        unsubscribe();
        resolve(null);
      });
    });
  }

  function sanitizeUsername(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .trim()
      .replace(/[\s<>`"'\\/|@]/g, "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .slice(0, 24);
  }

  function sanitizeText(value, maxLength) {
    return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }
})();

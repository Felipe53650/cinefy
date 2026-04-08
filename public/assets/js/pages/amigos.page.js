const store = window.CinefyStore;
      const currentProfile = store.loadProfile();
      const firestore = window.CinefyFirebase ? window.CinefyFirebase.firestore : null;
      let friends = store.loadFriends();
      let searchableUsers = [];
      let incomingRequests = [];
      let outgoingRequestIds = new Set();
      let unsubscribeFriends = null;
      let unsubscribeIncoming = null;
      let unsubscribeOutgoing = null;
      let unsubscribeUsers = null;

      const searchInput = document.getElementById("searchInput");
      const searchResults = document.getElementById("searchResults");
      const friendList = document.getElementById("friendList");
      const searchFeedback = document.getElementById("searchFeedback");
      const incomingRequestsList = document.getElementById("incomingRequestsList");
      const resetFriendsButton = document.getElementById("resetFriendsButton");

      searchInput.addEventListener("input", renderSearchResults);
      resetFriendsButton.addEventListener("click", resetFriends);

      bootstrapFriendsPage();

      async function bootstrapFriendsPage() {
        if (firestore && currentProfile.uid) {
          resetFriendsButton.disabled = true;
          resetFriendsButton.classList.add("cursor-not-allowed", "opacity-60");
          resetFriendsButton.title = "Esse reset de exemplo so funciona no modo local.";
        }

        if (firestore && currentProfile.uid) {
          await loadSocialGraph();
          subscribeRealtimeSocialGraph();
        }

        renderFriendList();
        renderIncomingRequests();
        renderSearchResults();
      }

      async function loadSocialGraph() {
        try {
          const [friendSnapshot, incomingSnapshot, outgoingSnapshot, usersSnapshot] = await Promise.all([
            firestore.collection("users").doc(currentProfile.uid).collection("friends").get(),
            firestore.collection("users").doc(currentProfile.uid).collection("friend_requests").get(),
            firestore.collection("users").doc(currentProfile.uid).collection("outgoing_requests").get(),
            firestore.collection("users").limit(60).get()
          ]);

          friends = friendSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          }));
          incomingRequests = incomingSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          }));
          outgoingRequestIds = new Set(outgoingSnapshot.docs.map((doc) => doc.id));
          searchableUsers = usersSnapshot.docs
            .map((doc) => ({ uid: doc.id, ...doc.data() }))
            .filter((user) => user.uid !== currentProfile.uid);

          store.saveFriends(friends);
        } catch (error) {
          console.error("Erro ao carregar rede social do Firestore:", error);
          searchableUsers = store.suggestedUsers.map((user) => ({ uid: user.id, ...user }));
        }
      }

      function getRelationshipRefs(otherUserId) {
        return {
          currentFriend: firestore.collection("users").doc(currentProfile.uid).collection("friends").doc(otherUserId),
          otherFriend: firestore.collection("users").doc(otherUserId).collection("friends").doc(currentProfile.uid),
          currentIncoming: firestore.collection("users").doc(currentProfile.uid).collection("friend_requests").doc(otherUserId),
          currentOutgoing: firestore.collection("users").doc(currentProfile.uid).collection("outgoing_requests").doc(otherUserId),
          otherIncoming: firestore.collection("users").doc(otherUserId).collection("friend_requests").doc(currentProfile.uid),
          otherOutgoing: firestore.collection("users").doc(otherUserId).collection("outgoing_requests").doc(currentProfile.uid)
        };
      }

      async function commitRelationshipBatch(otherUserId, applyBatch) {
        const refs = getRelationshipRefs(otherUserId);
        const batch = firestore.batch();
        applyBatch(batch, refs);
        await batch.commit();
      }

      function subscribeRealtimeSocialGraph() {
        if (!firestore || !currentProfile.uid) return;

        unsubscribeFriends = firestore.collection("users").doc(currentProfile.uid).collection("friends").onSnapshot((snapshot) => {
          friends = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          }));
          store.saveFriends(friends);
          renderFriendList();
          renderSearchResults();
        });

        unsubscribeIncoming = firestore.collection("users").doc(currentProfile.uid).collection("friend_requests").onSnapshot((snapshot) => {
          incomingRequests = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          }));
          renderIncomingRequests();
          renderSearchResults();
        });

        unsubscribeOutgoing = firestore.collection("users").doc(currentProfile.uid).collection("outgoing_requests").onSnapshot((snapshot) => {
          outgoingRequestIds = new Set(snapshot.docs.map((doc) => doc.id));
          renderSearchResults();
        });

        unsubscribeUsers = firestore.collection("users").limit(60).onSnapshot((snapshot) => {
          searchableUsers = snapshot.docs
            .map((doc) => ({ uid: doc.id, ...doc.data() }))
            .filter((user) => user.uid !== currentProfile.uid);
          renderSearchResults();
        });

        window.addEventListener("beforeunload", () => {
          [unsubscribeFriends, unsubscribeIncoming, unsubscribeOutgoing, unsubscribeUsers].forEach((unsubscribe) => {
            if (typeof unsubscribe === "function") unsubscribe();
          });
        }, { once: true });
      }

      function renderFriendList() {
        friends = store.loadFriends();
        document.getElementById("friendCount").textContent = friends.length;

        if (!friends.length) {
          friendList.innerHTML = "";
          document.getElementById("emptyFriendsState").classList.remove("hidden");
          return;
        }

        document.getElementById("emptyFriendsState").classList.add("hidden");
        friendList.innerHTML = friends.map((friend) => `
          <article class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div class="flex items-center gap-4 min-w-0">
              <img alt="${escapeAttribute(friend.displayName || friend.name || "Usuario")}" class="w-16 h-16 rounded-2xl object-cover" decoding="async" loading="lazy" src="${escapeAttribute(safeAvatarUrl(friend.avatar))}" />
              <div class="min-w-0">
                <h3 class="text-lg font-black text-white truncate">${escapeHtml(friend.displayName || friend.name || "Usuario")}</h3>
                <p class="text-sm text-zinc-400 truncate">@${escapeHtml(friend.username || "cinefyuser")}</p>
                <p class="text-sm text-zinc-300 mt-1">Genero favorito: ${escapeHtml(friend.favoriteGenre || "Cinema")}</p>
              </div>
            </div>
            <button class="inline-flex items-center justify-center gap-2 rounded-full border border-red-500/40 text-red-200 hover:bg-red-500/10 px-4 py-2 font-bold transition-all active:scale-95 whitespace-nowrap" data-remove-id="${escapeAttribute(friend.id)}" type="button">
              <span class="material-symbols-outlined">person_remove</span>
              <span>Remover amigo</span>
            </button>
          </article>
        `).join("");

        friendList.querySelectorAll("[data-remove-id]").forEach((button) => {
          button.addEventListener("click", () => removeFriend(button.dataset.removeId));
        });
      }

      function renderIncomingRequests() {
        if (!incomingRequests.length) {
          incomingRequestsList.innerHTML = `
            <div class="rounded-3xl border border-zinc-800 bg-zinc-950/60 p-5 text-sm text-zinc-400">
              Nenhum pedido pendente no momento.
            </div>
          `;
          return;
        }

        incomingRequestsList.innerHTML = incomingRequests.map((request) => `
          <article class="rounded-3xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-4 min-w-0">
                <img alt="${escapeAttribute(request.displayName || request.name || "Usuario")}" class="w-14 h-14 rounded-2xl object-cover" decoding="async" loading="lazy" src="${escapeAttribute(safeAvatarUrl(request.avatar))}" />
                <div class="min-w-0">
                  <h3 class="font-black text-white truncate">${escapeHtml(request.displayName || request.name || "Usuario")}</h3>
                  <p class="text-sm text-zinc-400 truncate">@${escapeHtml(request.username || "cinefyuser")}</p>
                </div>
              </div>
              <div class="flex gap-2">
                <button class="inline-flex items-center gap-2 rounded-full bg-white text-black hover:bg-zinc-200 px-4 py-2 font-black transition-all active:scale-95" data-accept-id="${escapeAttribute(request.id)}" type="button">
                  <span class="material-symbols-outlined">check</span>
                  <span>Aceitar</span>
                </button>
                <button class="inline-flex items-center gap-2 rounded-full border border-zinc-700 text-zinc-100 hover:bg-zinc-800 px-4 py-2 font-bold transition-all active:scale-95" data-reject-id="${escapeAttribute(request.id)}" type="button">
                  <span class="material-symbols-outlined">close</span>
                  <span>Recusar</span>
                </button>
              </div>
            </div>
          </article>
        `).join("");

        incomingRequestsList.querySelectorAll("[data-accept-id]").forEach((button) => {
          button.addEventListener("click", () => acceptFriendRequest(button.dataset.acceptId));
        });
        incomingRequestsList.querySelectorAll("[data-reject-id]").forEach((button) => {
          button.addEventListener("click", () => rejectFriendRequest(button.dataset.rejectId));
        });
      }

      function renderSearchResults() {
        friends = store.loadFriends();
        const term = searchInput.value.trim().toLowerCase();
        const friendIds = new Set(friends.map((friend) => friend.id));
        const incomingIds = new Set(incomingRequests.map((request) => request.id));
        const availableUsers = searchableUsers.filter((user) => !friendIds.has(user.uid) && !incomingIds.has(user.uid));
        const filteredUsers = availableUsers.filter((user) => {
          if (!term) return true;
          const displayName = String(user.displayName || user.name || "").toLowerCase();
          const username = String(user.username || "").toLowerCase();
          return displayName.includes(term) || username.includes(term);
        });

        document.getElementById("suggestionCount").textContent = filteredUsers.length;
        searchFeedback.textContent = term
          ? `${filteredUsers.length} usuarios encontrados para "${searchInput.value.trim()}".`
          : "";

        if (!filteredUsers.length) {
          searchResults.innerHTML = `
            <div class="rounded-3xl border border-zinc-800 bg-zinc-950/60 p-6 text-center">
              <span class="material-symbols-outlined text-red-300 text-4xl">sentiment_dissatisfied</span>
              <p class="mt-3 text-zinc-300">Nenhum usuario disponivel para adicionar.</p>
            </div>
          `;
          return;
        }

        searchResults.innerHTML = filteredUsers.map((user) => `
          <article class="flex items-center justify-between gap-4 rounded-3xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div class="flex items-center gap-4 min-w-0">
              <img alt="${escapeAttribute(user.displayName || user.name || "Usuario")}" class="w-14 h-14 rounded-2xl object-cover" decoding="async" loading="lazy" src="${escapeAttribute(safeAvatarUrl(user.avatar))}" />
              <div class="min-w-0">
                <h3 class="font-black text-white truncate">${escapeHtml(user.displayName || user.name || "Usuario")}</h3>
                <p class="text-sm text-zinc-400 truncate">@${escapeHtml(user.username || "cinefyuser")}</p>
                <p class="text-sm text-zinc-300 mt-1">${escapeHtml(user.location || "Brasil")}</p>
              </div>
            </div>
            ${outgoingRequestIds.has(user.uid)
              ? '<span class="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-700 text-zinc-300 px-4 py-2 font-bold whitespace-nowrap"><span class="material-symbols-outlined">schedule</span><span>Solicitado</span></span>'
              : `<button class="inline-flex items-center justify-center gap-2 rounded-full bg-white text-black hover:bg-zinc-200 px-4 py-2 font-black transition-all active:scale-95 whitespace-nowrap" data-add-id="${escapeAttribute(user.uid)}" type="button">
                  <span class="material-symbols-outlined">person_add</span>
                  <span>Adicionar</span>
                </button>`}
          </article>
        `).join("");

        searchResults.querySelectorAll("[data-add-id]").forEach((button) => {
          button.addEventListener("click", () => addFriend(button.dataset.addId));
        });
      }

      async function addFriend(id) {
        const user = searchableUsers.find((item) => item.uid === id);
        if (!user || !firestore || !currentProfile.uid || outgoingRequestIds.has(id)) return;

        try {
          const requestPayload = {
            senderUid: currentProfile.uid,
            displayName: currentProfile.displayName,
            username: currentProfile.username,
            avatar: currentProfile.avatar,
            createdAt: new Date().toISOString()
          };

          await Promise.all([
            firestore.collection("users").doc(id).collection("friend_requests").doc(currentProfile.uid).set(requestPayload),
            firestore.collection("users").doc(currentProfile.uid).collection("outgoing_requests").doc(id).set({
              recipientUid: id,
              displayName: user.displayName || user.name || "Usuario",
              username: user.username || "",
              avatar: user.avatar || currentProfile.avatar,
              createdAt: new Date().toISOString()
            })
          ]);

          await appendNotificationToUser(id, {
            id: `friend-request-${currentProfile.uid}`,
            type: "friend_request",
            title: "Pedido de amizade recebido",
            message: `${currentProfile.displayName} enviou um pedido de amizade.`,
            href: "amigos.html",
            read: false,
            createdAt: new Date().toISOString()
          });

          outgoingRequestIds.add(id);
          searchFeedback.textContent = `Pedido de amizade enviado para ${user.displayName || user.name}.`;
          renderSearchResults();
        } catch (error) {
          console.error("Erro ao enviar pedido de amizade:", error);
          searchFeedback.textContent = "Nao foi possivel enviar o pedido agora.";
        }
      }

      async function removeFriend(id) {
        if (!firestore || !currentProfile.uid) return;

        friends = store.loadFriends();
        const removedFriend = friends.find((friend) => friend.id === id);

        try {
          await commitRelationshipBatch(id, (batch, refs) => {
            batch.delete(refs.currentFriend);
            batch.delete(refs.otherFriend);
            batch.delete(refs.currentIncoming);
            batch.delete(refs.currentOutgoing);
            batch.delete(refs.otherIncoming);
            batch.delete(refs.otherOutgoing);
          });

          const updatedFriends = friends.filter((friend) => friend.id !== id);
          outgoingRequestIds.delete(id);
          incomingRequests = incomingRequests.filter((item) => item.id !== id);
          store.saveFriends(updatedFriends);
          searchFeedback.textContent = removedFriend
            ? `${removedFriend.displayName || removedFriend.name || "Usuario"} foi removido da sua lista de amigos.`
            : "Amigo removido.";
          renderFriendList();
          renderIncomingRequests();
          renderSearchResults();
        } catch (error) {
          console.error("Erro ao remover amigo:", error);
          searchFeedback.textContent = "Nao foi possivel remover esse amigo agora.";
        }
      }

      function resetFriends() {
        if (firestore && currentProfile.uid) {
          searchFeedback.textContent = "O reset de exemplo esta disponivel apenas quando o Firestore nao estiver em uso.";
          return;
        }

        store.resetFriends();
        store.saveNotifications(store.loadNotifications().filter((notification) => !notification.id.startsWith("friend-accepted-")));
        searchFeedback.textContent = "Lista de amigos restaurada com os exemplos iniciais.";
        renderFriendList();
        renderSearchResults();
      }

      async function acceptFriendRequest(senderUid) {
        if (!firestore || !currentProfile.uid) return;

        const request = incomingRequests.find((item) => item.id === senderUid);
        if (!request) return;

        try {
          await commitRelationshipBatch(senderUid, (batch, refs) => {
            batch.set(refs.currentFriend, {
              id: senderUid,
              name: request.displayName,
              displayName: request.displayName,
              username: request.username || "cinefyuser",
              avatar: request.avatar,
              favoriteGenre: "Cinema",
              location: request.location || "Brasil",
              createdAt: new Date().toISOString()
            });
            batch.set(refs.otherFriend, {
              id: currentProfile.uid,
              name: currentProfile.displayName,
              displayName: currentProfile.displayName,
              username: currentProfile.username || "cinefyuser",
              avatar: currentProfile.avatar,
              favoriteGenre: "Cinema",
              location: currentProfile.location || "Brasil",
              createdAt: new Date().toISOString()
            });
            batch.delete(refs.currentIncoming);
            batch.delete(refs.currentOutgoing);
            batch.delete(refs.otherIncoming);
            batch.delete(refs.otherOutgoing);
          });

          await appendNotificationToUser(senderUid, {
            id: `friend-accepted-${currentProfile.uid}`,
            type: "friend_accepted",
            title: "Pedido aceito",
            message: `${currentProfile.displayName} aceitou seu pedido de amizade.`,
            href: "amigos.html",
            read: false,
            createdAt: new Date().toISOString()
          });

          await loadSocialGraph();
          searchFeedback.textContent = `${request.displayName || request.name || "Usuario"} agora faz parte da sua rede.`;
          renderFriendList();
          renderIncomingRequests();
          renderSearchResults();
        } catch (error) {
          console.error("Erro ao aceitar pedido:", error);
          searchFeedback.textContent = "Nao foi possivel aceitar esse pedido agora.";
        }
      }

      async function rejectFriendRequest(senderUid) {
        if (!firestore || !currentProfile.uid) return;

        try {
          await commitRelationshipBatch(senderUid, (batch, refs) => {
            batch.delete(refs.currentIncoming);
            batch.delete(refs.currentOutgoing);
            batch.delete(refs.otherIncoming);
            batch.delete(refs.otherOutgoing);
          });

          incomingRequests = incomingRequests.filter((item) => item.id !== senderUid);
          outgoingRequestIds.delete(senderUid);
          renderIncomingRequests();
          renderSearchResults();
          searchFeedback.textContent = "Pedido recusado.";
        } catch (error) {
          console.error("Erro ao recusar pedido:", error);
          searchFeedback.textContent = "Nao foi possivel recusar o pedido agora.";
        }
      }

      async function appendNotificationToUser(userId, notification) {
        try {
          const docRef = firestore.collection("users").doc(userId).collection("app_state").doc("notifications");
          const snapshot = await docRef.get();
          const current = snapshot.exists && Array.isArray(snapshot.data().value) ? snapshot.data().value : [];
          if (current.some((item) => item.id === notification.id)) return;
          await docRef.set({
            value: [notification, ...current].slice(0, 40),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (error) {
          console.error("Erro ao anexar notificacao remota:", error);
        }
      }

      function safeAvatarUrl(value) {
        const fallbackAvatar = currentProfile.avatar || "assets/img/logo.png";
        const candidate = String(value || "").trim();
        if (!candidate) return fallbackAvatar;

        if (/^data:image\/(png|jpeg|webp);/i.test(candidate) || candidate.startsWith("blob:")) {
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


(function () {
  const PROFILE_KEY = "cinefy-user-profile";
  const FRIENDS_KEY = "cinefy-user-friends";
  const NOTIFICATIONS_KEY = "cinefy-notifications";
  const CATALOG_SNAPSHOT_KEY = "cinefy-catalog-snapshot";
  const LIST_KEY = "cinefy-user-list";
  const REVIEWS_KEY = "cinefy-movie-reviews";
  const LEGACY_DEFAULT_LIST_MOVIE_IDS = ["interstellar", "past-lives", "blade-runner-2049", "aftersun"];

  const defaultProfile = {
    username: "felipecine",
    displayName: "Felipe Martins",
    bio: "Cinefilo de drama, ficcao cientifica e listas para compartilhar com os amigos.",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBm2HxOu-EGtKkBUP5RwOS7MwT9dJkKn_7vG4oxQF95I4rUUD0IUB61Lm0FY8S49Y0bEJZbDRec6XyHVVI2wtwYH_Yac791G4SqebfMan9yXRJ3UivuQwzgCwdBZfV8AjzdJvR8j5LLytM3KZHnmCKnmEOrZ0-rvzyHbAHBk71hyUzfZLiQmlLyUxlYWRfQnDaHkVF2KpjNQSbD-cG2NehFuEUFCQThMuDwSpEXw_OnY1VqPbRj-d9qdKH1_QJcw1v3n6wdeP9Dn_q7",
    location: "Sao Paulo, BR",
    theme: "ember"
  };

  const defaultFriends = [
    {
      id: "alexsilva",
      username: "alexsilva",
      name: "Alex Silva",
      favoriteGenre: "Sci-Fi",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80"
    },
    {
      id: "marianacosta",
      username: "marianacosta",
      name: "Mariana Costa",
      favoriteGenre: "Drama",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80"
    },
    {
      id: "lucasrocha",
      username: "lucasrocha",
      name: "Lucas Rocha",
      favoriteGenre: "Suspense",
      avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80"
    }
  ];

  const suggestedUsers = [
    ...defaultFriends,
    {
      id: "claratorres",
      username: "claratorres",
      name: "Clara Torres",
      favoriteGenre: "Romance",
      avatar: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=300&q=80"
    },
    {
      id: "joaopedro",
      username: "joaopedro",
      name: "Joao Pedro",
      favoriteGenre: "Acao",
      avatar: "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=300&q=80"
    },
    {
      id: "beatrizlima",
      username: "beatrizlima",
      name: "Beatriz Lima",
      favoriteGenre: "Animacao",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80"
    },
    {
      id: "rafaelgoncalves",
      username: "rafaelgoncalves",
      name: "Rafael Goncalves",
      favoriteGenre: "Terror",
      avatar: "https://images.unsplash.com/photo-1504257432389-52343af06ae3?auto=format&fit=crop&w=300&q=80"
    }
  ];

  const defaultListState = {
    id: "list-default",
    title: "Lista sem nome",
    description: "Uma lista com filmes que recomendo.",
    privacy: "publica",
    updatedAt: new Date().toISOString(),
    movies: [],
    shareId: "",
    sharedCreatedAt: ""
  };

  const defaultListsState = {
    selectedListId: defaultListState.id,
    items: [clone(defaultListState)]
  };

  const defaultNotifications = [
    {
      id: "friend-request-clara",
      type: "friend_request",
      title: "Pedido de amizade recebido",
      message: "Clara Torres quer entrar para a sua rede no CINEfy.",
      href: "amigos.html",
      read: false,
      createdAt: "2026-03-29T15:00:00.000Z"
    },
    {
      id: "friend-accepted-mariana",
      type: "friend_accepted",
      title: "Pedido aceito",
      message: "Mariana Costa aceitou seu pedido de amizade.",
      href: "amigos.html",
      read: false,
      createdAt: "2026-03-29T12:30:00.000Z"
    }
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : clone(fallback);
    } catch (error) {
      return clone(fallback);
    }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeMovie(movie) {
    const safeMovie = movie && typeof movie === "object" ? movie : {};
    return {
      ...safeMovie,
      id: safeMovie.id || `movie-${Date.now()}`,
      tmdbId: safeMovie.tmdbId || "",
      title: safeMovie.title || "Titulo indisponivel",
      genre: safeMovie.genre || "Filme",
      year: safeMovie.year || "Sem ano",
      rating: Number.isFinite(Number(safeMovie.rating)) ? Number(safeMovie.rating) : 0,
      note: safeMovie.note || "",
      poster: safeMovie.poster || "",
      overview: safeMovie.overview || ""
    };
  }

  function createListId() {
    return `list-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizeListState(list, index) {
    const safeList = list && typeof list === "object" ? list : {};
    return {
      ...clone(defaultListState),
      ...safeList,
      id: safeList.id || (index === 0 ? defaultListState.id : createListId()),
      title: safeList.title || defaultListState.title,
      description: safeList.description || defaultListState.description,
      privacy: safeList.privacy === "privada" ? "privada" : "publica",
      updatedAt: safeList.updatedAt || new Date().toISOString(),
      movies: Array.isArray(safeList.movies) ? safeList.movies.map(normalizeMovie) : []
    };
  }

  function isLegacySeedList(state) {
    if (!state || typeof state !== "object") return false;
    if (state.title !== "Lista do Felipe") return false;
    if (state.description !== "Uma mistura de ficcao cientifica, drama e filmes que eu sempre recomendo.") return false;
    if (!Array.isArray(state.movies) || state.movies.length !== LEGACY_DEFAULT_LIST_MOVIE_IDS.length) return false;

    const movieIds = state.movies.map((movie) => movie && movie.id).sort();
    return JSON.stringify(movieIds) === JSON.stringify([...LEGACY_DEFAULT_LIST_MOVIE_IDS].sort());
  }

  function migrateLegacyListState(state) {
    if (!isLegacySeedList(state)) return state;

    return {
      ...state,
      title: defaultListState.title,
      description: defaultListState.description,
      updatedAt: new Date().toISOString(),
      movies: []
    };
  }

  function normalizeListsState(value) {
    if (value && typeof value === "object" && Array.isArray(value.items)) {
      const items = value.items.map((item, index) => normalizeListState(migrateLegacyListState(item), index));
      const ensuredItems = items.length ? items : [normalizeListState(defaultListState, 0)];
      const selectedListId = ensuredItems.some((item) => item.id === value.selectedListId)
        ? value.selectedListId
        : ensuredItems[0].id;

      return {
        selectedListId,
        items: ensuredItems
      };
    }

    const migratedList = normalizeListState(migrateLegacyListState(value), 0);
    return {
      selectedListId: migratedList.id,
      items: [migratedList]
    };
  }

  function getCurrentUid() {
    try {
      const sessionRaw = localStorage.getItem("cinefy-auth-session");
      const session = sessionRaw ? JSON.parse(sessionRaw) : null;
      return session && session.uid ? session.uid : "";
    } catch (error) {
      return "";
    }
  }

  function hasCloudStore() {
    return Boolean(window.CinefyFirebase && window.CinefyFirebase.firestore && getCurrentUid());
  }

  function getCloudCollection() {
    if (!hasCloudStore()) return null;
    return window.CinefyFirebase.firestore
      .collection("users")
      .doc(getCurrentUid())
      .collection("app_state");
  }

  function emitStoreEvent(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function queueCloudSave(docId, payload) {
    const collection = getCloudCollection();
    if (!collection) return Promise.resolve();

    return collection.doc(docId).set(
      {
        ...payload,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    ).catch((error) => {
      console.error(`Erro ao salvar ${docId} no Firestore:`, error);
    });
  }

  async function syncDoc(docId, localValue, applyLocalValue) {
    const collection = getCloudCollection();
    if (!collection) return localValue;

    try {
      const snapshot = await collection.doc(docId).get();
      if (snapshot.exists) {
        const data = snapshot.data() || {};
        if (Object.prototype.hasOwnProperty.call(data, "value")) {
          applyLocalValue(data.value);
          return data.value;
        }
      }

      await queueCloudSave(docId, { value: localValue });
      return localValue;
    } catch (error) {
      console.error(`Erro ao sincronizar ${docId} do Firestore:`, error);
      return localValue;
    }
  }

  function loadProfile() {
    try {
      const sessionRaw = localStorage.getItem("cinefy-auth-session");
      const session = sessionRaw ? JSON.parse(sessionRaw) : null;
      const raw = localStorage.getItem(PROFILE_KEY);
      const storedProfile = raw ? JSON.parse(raw) : {};
      const sameUser = !session || !storedProfile.uid || !session.uid || storedProfile.uid === session.uid;

      return {
        ...clone(defaultProfile),
        ...storedProfile,
        ...(session ? {
          uid: session.uid || storedProfile.uid,
          email: session.email || storedProfile.email,
          authProvider: session.authProvider || storedProfile.authProvider,
          displayName: sameUser ? (storedProfile.displayName || session.displayName) : (session.displayName || storedProfile.displayName),
          avatar: sameUser ? (storedProfile.avatar || session.avatar) : (session.avatar || storedProfile.avatar),
          username: sameUser ? (storedProfile.username || session.username) : (session.username || storedProfile.username),
          theme: sameUser ? (storedProfile.theme || session.theme) : (session.theme || storedProfile.theme)
        } : {})
      };
    } catch (error) {
      return clone(defaultProfile);
    }
  }

  function saveProfile(profile) {
    saveJSON(PROFILE_KEY, profile);
    emitStoreEvent("cinefy:profile-updated", profile);
  }

  function loadFriends() {
    return loadJSON(FRIENDS_KEY, defaultFriends);
  }

  function saveFriends(friends) {
    saveJSON(FRIENDS_KEY, friends);
    queueCloudSave("friends", { value: friends });
    emitStoreEvent("cinefy:friends-updated", friends);
  }

  function resetFriends() {
    const friends = clone(defaultFriends);
    saveFriends(friends);
    return friends;
  }

  function normalizeNotification(notification) {
    return {
      id: notification.id || `notification-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      type: notification.type || "general",
      title: notification.title || "Atualizacao",
      message: notification.message || "",
      href: notification.href || "#",
      read: Boolean(notification.read),
      createdAt: notification.createdAt || new Date().toISOString()
    };
  }

  function loadNotifications() {
    const notifications = loadJSON(NOTIFICATIONS_KEY, defaultNotifications);
    return notifications
      .map(normalizeNotification)
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  }

  function saveNotifications(notifications) {
    const normalized = notifications
      .map(normalizeNotification)
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
      .slice(0, 40);

    saveJSON(
      NOTIFICATIONS_KEY,
      normalized
    );
    queueCloudSave("notifications", { value: normalized });
    emitStoreEvent("cinefy:notifications-updated", normalized);
  }

  function addNotification(notification) {
    const notifications = loadNotifications();
    const entry = normalizeNotification(notification);

    if (notifications.some((item) => item.id === entry.id)) {
      return notifications;
    }

    notifications.unshift(entry);
    saveNotifications(notifications);
    return notifications;
  }

  function markAllNotificationsAsRead() {
    const notifications = loadNotifications().map((notification) => ({
      ...notification,
      read: true
    }));
    saveNotifications(notifications);
    return notifications;
  }

  function getUnreadNotificationCount() {
    return loadNotifications().filter((notification) => !notification.read).length;
  }

  function syncCatalogNotifications(movies) {
    if (!Array.isArray(movies) || !movies.length) return loadNotifications();

    const previousSnapshot = loadJSON(CATALOG_SNAPSHOT_KEY, []);
    const incomingIds = movies.map((movie) => movie.id);

    if (!previousSnapshot.length) {
      saveJSON(CATALOG_SNAPSHOT_KEY, incomingIds);
      return loadNotifications();
    }

    const previousIds = new Set(previousSnapshot);
    const newMovies = movies.filter((movie) => !previousIds.has(movie.id)).slice(0, 3);

    newMovies.forEach((movie) => {
      addNotification({
        id: `catalog-${movie.id}`,
        type: "catalog",
        title: "Novidade no catalogo",
        message: `${movie.title} entrou entre os destaques do TMDB.`,
        href: `detalhes.html?id=${movie.id}`,
        read: false,
        createdAt: new Date().toISOString()
      });
    });

    saveJSON(CATALOG_SNAPSHOT_KEY, incomingIds);
    return loadNotifications();
  }

  function loadListState() {
    const listsState = loadListsState();
    return clone(
      listsState.items.find((item) => item.id === listsState.selectedListId) || listsState.items[0]
    );
  }

  function loadListsState() {
    return normalizeListsState(loadJSON(LIST_KEY, defaultListsState));
  }

  function loadLists() {
    return clone(loadListsState().items);
  }

  function getSelectedListId() {
    return loadListsState().selectedListId;
  }

  function saveListsState(listsState) {
    const normalized = normalizeListsState(listsState);
    saveJSON(LIST_KEY, normalized);
    queueCloudSave("list", { value: normalized });
    emitStoreEvent("cinefy:lists-updated", normalized);
    emitStoreEvent(
      "cinefy:list-updated",
      clone(normalized.items.find((item) => item.id === normalized.selectedListId) || normalized.items[0])
    );
    return normalized;
  }

  function saveListState(state) {
    const listsState = loadListsState();
    const targetId = state && state.id ? state.id : listsState.selectedListId;
    const normalizedList = normalizeListState({
      ...(listsState.items.find((item) => item.id === targetId) || {}),
      ...(state || {}),
      id: targetId
    });
    const nextItems = listsState.items.some((item) => item.id === targetId)
      ? listsState.items.map((item) => (item.id === targetId ? normalizedList : item))
      : [normalizedList, ...listsState.items];

    saveListsState({
      selectedListId: normalizedList.id,
      items: nextItems
    });

    return clone(normalizedList);
  }

  function createList(name) {
    const title = String(name || "").trim() || defaultListState.title;
    const listsState = loadListsState();
    const newList = normalizeListState({
      ...clone(defaultListState),
      id: createListId(),
      title,
      updatedAt: new Date().toISOString(),
      movies: []
    });

    saveListsState({
      selectedListId: newList.id,
      items: [newList, ...listsState.items]
    });

    return clone(newList);
  }

  function selectList(listId) {
    const listsState = loadListsState();
    const selected = listsState.items.find((item) => item.id === listId);
    if (!selected) {
      return clone(listsState.items[0]);
    }

    saveListsState({
      ...listsState,
      selectedListId: selected.id
    });

    return clone(selected);
  }

  function deleteList(listId) {
    const listsState = loadListsState();
    const targetId = listId || listsState.selectedListId;
    const deletedList = listsState.items.find((item) => item.id === targetId);
    if (!deletedList) {
      return {
        deleted: null,
        active: loadListState()
      };
    }

    const remainingItems = listsState.items.filter((item) => item.id !== targetId);
    const nextItems = remainingItems.length
      ? remainingItems
      : [normalizeListState({
          ...clone(defaultListState),
          id: defaultListState.id,
          updatedAt: new Date().toISOString()
        }, 0)];
    const nextSelectedId = nextItems[0].id;

    saveListsState({
      selectedListId: nextSelectedId,
      items: nextItems
    });

    return {
      deleted: clone(deletedList),
      active: clone(nextItems[0])
    };
  }

  function resetListState(listId) {
    const listsState = loadListsState();
    const targetId = listId || listsState.selectedListId;
    const currentList = listsState.items.find((item) => item.id === targetId) || clone(defaultListState);
    const resetState = normalizeListState({
      ...clone(defaultListState),
      id: targetId,
      shareId: currentList.shareId || "",
      sharedCreatedAt: currentList.sharedCreatedAt || "",
      updatedAt: new Date().toISOString()
    });

    saveListState(resetState);
    return clone(resetState);
  }

  function loadReviews() {
    return loadJSON(REVIEWS_KEY, {});
  }

  function saveReviews(reviews) {
    saveJSON(REVIEWS_KEY, reviews);
    queueCloudSave("reviews", { value: reviews });
    emitStoreEvent("cinefy:reviews-updated", reviews);
  }

  async function syncFromCloud() {
    if (!hasCloudStore()) return false;

    await Promise.all([
      syncDoc("friends", loadFriends(), (value) => saveJSON(FRIENDS_KEY, Array.isArray(value) ? value : clone(defaultFriends))),
      syncDoc("notifications", loadNotifications(), (value) => saveJSON(NOTIFICATIONS_KEY, Array.isArray(value) ? value.map(normalizeNotification) : clone(defaultNotifications))),
      syncDoc("list", loadListsState(), (value) => saveListsState(value)),
      syncDoc("reviews", loadReviews(), (value) => saveJSON(REVIEWS_KEY, value && typeof value === "object" ? value : {}))
    ]);

    return true;
  }

  function subscribeToNotifications(callback) {
    const collection = getCloudCollection();
    if (!collection) return function () {};

    return collection.doc("notifications").onSnapshot((snapshot) => {
      const data = snapshot.exists ? snapshot.data() || {} : {};
      const notifications = Array.isArray(data.value) ? data.value.map(normalizeNotification) : [];
      saveJSON(NOTIFICATIONS_KEY, notifications);
      emitStoreEvent("cinefy:notifications-updated", notifications);
      if (typeof callback === "function") {
        callback(notifications);
      }
    }, (error) => {
      console.error("Erro ao ouvir notificacoes em tempo real:", error);
    });
  }

  function subscribeToFriendRequests(callback) {
    const firestore = window.CinefyFirebase && window.CinefyFirebase.firestore;
    if (!firestore || !getCurrentUid()) return function () {};

    const userDoc = firestore.collection("users").doc(getCurrentUid());
    const unsubscribeSent = userDoc.collection("outgoing_requests").onSnapshot((snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      emitStoreEvent("cinefy:friend-requests-updated", { type: "outgoing", requests });
      if (typeof callback === "function") {
        callback({ type: "outgoing", requests });
      }
    }, (error) => {
      console.error("Erro ao ouvir pedidos enviados:", error);
    });

    const unsubscribeReceived = userDoc.collection("friend_requests").onSnapshot((snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      emitStoreEvent("cinefy:friend-requests-updated", { type: "incoming", requests });
      if (typeof callback === "function") {
        callback({ type: "incoming", requests });
      }
    }, (error) => {
      console.error("Erro ao ouvir pedidos recebidos:", error);
    });

    return () => {
      unsubscribeSent();
      unsubscribeReceived();
    };
  }

  function subscribeToFriends(callback) {
    const collection = getCloudCollection();
    if (!collection) return function () {};

    return collection.doc("friends").onSnapshot((snapshot) => {
      const data = snapshot.exists ? snapshot.data() || {} : {};
      const friends = Array.isArray(data.value) ? data.value : clone(defaultFriends);
      saveJSON(FRIENDS_KEY, friends);
      emitStoreEvent("cinefy:friends-updated", friends);
      if (typeof callback === "function") {
        callback(friends);
      }
    }, (error) => {
      console.error("Erro ao ouvir amigos em tempo real:", error);
    });
  }

  window.CinefyStore = {
    PROFILE_KEY,
    FRIENDS_KEY,
    NOTIFICATIONS_KEY,
    LIST_KEY,
    REVIEWS_KEY,
    defaultProfile: clone(defaultProfile),
    defaultFriends: clone(defaultFriends),
    suggestedUsers: clone(suggestedUsers),
    loadProfile,
    saveProfile,
    loadFriends,
    saveFriends,
    resetFriends,
    loadNotifications,
    saveNotifications,
    addNotification,
    markAllNotificationsAsRead,
    getUnreadNotificationCount,
    syncCatalogNotifications,
    loadListsState,
    loadLists,
    getSelectedListId,
    loadListState,
    createList,
    selectList,
    deleteList,
    saveListsState,
    saveListState,
    resetListState,
    loadReviews,
    saveReviews,
    syncFromCloud,
    subscribeToNotifications,
    subscribeToFriends,
    subscribeToFriendRequests,
    clone
  };
})();

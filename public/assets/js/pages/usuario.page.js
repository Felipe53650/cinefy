(function () {
  const store = window.CinefyStore;
  const firestore = window.CinefyFirebase ? window.CinefyFirebase.firestore : null;
  const auth = window.CinefyFirebase ? window.CinefyFirebase.auth : null;
  const currentProfile = store ? store.loadProfile() : {};
  const params = new URLSearchParams(window.location.search);
  const themeLabels = {
    ember: "Ember",
    ocean: "Ocean",
    emerald: "Emerald",
    aurora: "Aurora",
    sunset: "Sunset",
    rose: "Rose",
    noir: "Noir",
    "golden-age": "Golden Age"
  };
  const defaultAvatar = "/assets/img/logo.png";
  const state = {
    targetUid: "",
    viewerSignedIn: false,
    profile: {
      uid: "",
      displayName: sanitizeText(params.get("name") || "Cinefilo", 80) || "Cinefilo",
      username: sanitizeUsername(params.get("username") || params.get("u") || "cinefyuser"),
      avatar: safeAvatarUrl(params.get("avatar")),
      bio: "Esse usuario ainda nao adicionou uma bio publica.",
      location: "Brasil",
      theme: "ember"
    },
    sharedLists: [],
    reviews: []
  };

  const publicProfileAvatar = document.getElementById("publicProfileAvatar");
  const publicProfileName = document.getElementById("publicProfileName");
  const publicProfileHandle = document.getElementById("publicProfileHandle");
  const publicProfileBio = document.getElementById("publicProfileBio");
  const publicProfileLocation = document.getElementById("publicProfileLocation");
  const publicProfileTheme = document.getElementById("publicProfileTheme");
  const publicProfileStatus = document.getElementById("publicProfileStatus");
  const publicProfileStatusCopy = document.getElementById("publicProfileStatusCopy");
  const publicProfileListCount = document.getElementById("publicProfileListCount");
  const publicProfileReviewCount = document.getElementById("publicProfileReviewCount");
  const publicProfileListsCaption = document.getElementById("publicProfileListsCaption");
  const publicProfileReviewsCaption = document.getElementById("publicProfileReviewsCaption");
  const publicProfileListsGrid = document.getElementById("publicProfileListsGrid");
  const publicProfileReviewsList = document.getElementById("publicProfileReviewsList");
  const publicProfileNotice = document.getElementById("publicProfileNotice");
  const editOwnProfileLink = document.getElementById("editOwnProfileLink");

  renderPage();
  void bootstrapPublicProfile();

  async function bootstrapPublicProfile() {
    const resolvedUid = await resolveTargetUid();
    state.targetUid = resolvedUid;

    if (!state.targetUid && !state.profile.username) {
      renderUnavailableState("Nao encontramos um usuario valido para abrir esse perfil.");
      return;
    }

    if (state.targetUid && currentProfile && currentProfile.uid && state.targetUid === currentProfile.uid) {
      window.location.replace("perfil.html");
      return;
    }

    state.viewerSignedIn = Boolean(await waitForAuthResolution());

    if (firestore && state.targetUid) {
      await loadPublicLists();
    }

    if (!state.viewerSignedIn) {
      renderPage();
      renderNotice("Entre para ver mais deste perfil", "Listas publicas continuam visiveis, mas reviews e alguns detalhes da comunidade so aparecem para usuarios autenticados.", [
        {
          href: "login.html",
          icon: "login",
          label: "Entrar"
        }
      ]);
      return;
    }

    if (!firestore || !state.targetUid) {
      renderPage();
      renderNotice("Perfil com visualizacao limitada", "Nao foi possivel sincronizar os dados deste usuario agora. Tente novamente em instantes.");
      return;
    }

    try {
      const [profileSnapshot, reviewsSnapshot] = await Promise.all([
        firestore.collection("users").doc(state.targetUid).get(),
        firestore.collection("users").doc(state.targetUid).collection("public_reviews").orderBy("updatedAt", "desc").limit(6).get()
      ]);

      if (profileSnapshot.exists) {
        hydrateProfile(profileSnapshot.data());
      }

      state.reviews = reviewsSnapshot.docs
        .map((doc) => normalizeReviewRecord(doc.data()))
        .filter(Boolean);
    } catch (error) {
      console.error("Erro ao carregar perfil publico:", error);
      renderNotice("Nao foi possivel carregar tudo agora", "Os dados principais do perfil ainda podem aparecer, mas reviews e detalhes adicionais falharam nesta tentativa.");
    }

    renderPage();
  }

  async function resolveTargetUid() {
    const directUid = sanitizeText(params.get("uid"), 128);
    if (directUid) {
      return directUid;
    }

    const username = sanitizeUsername(params.get("u") || params.get("username") || "");
    if (!username || !firestore) {
      return "";
    }

    try {
      const snapshot = await firestore.collection("usernames").doc(getUsernameDocId(username)).get();
      if (snapshot.exists) {
        const data = snapshot.data() || {};
        return sanitizeText(data.uid, 128);
      }
    } catch (error) {
      console.error("Erro ao resolver uid do usuario:", error);
    }

    return "";
  }

  async function loadPublicLists() {
    try {
      const snapshot = await firestore.collection("shared_lists").where("ownerUid", "==", state.targetUid).limit(12).get();
      state.sharedLists = snapshot.docs
        .map((doc) => normalizeSharedList(doc.data()))
        .filter((list) => list && list.privacy === "publica")
        .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0));
    } catch (error) {
      console.error("Erro ao carregar listas publicas:", error);
      state.sharedLists = [];
    }
  }

  function hydrateProfile(rawProfile) {
    const safeProfile = rawProfile && typeof rawProfile === "object" ? rawProfile : {};
    state.profile = {
      uid: sanitizeText(safeProfile.uid || state.targetUid, 128),
      displayName: sanitizeText(safeProfile.displayName || state.profile.displayName, 80) || "Cinefilo",
      username: sanitizeUsername(safeProfile.username || state.profile.username || "cinefyuser"),
      avatar: safeAvatarUrl(safeProfile.avatar || state.profile.avatar),
      bio: sanitizeMultilineText(safeProfile.bio || state.profile.bio, 280) || "Esse usuario ainda nao adicionou uma bio publica.",
      location: sanitizeText(safeProfile.location || state.profile.location, 120) || "Brasil",
      theme: sanitizeText(safeProfile.theme || state.profile.theme || "ember", 24).toLowerCase() || "ember"
    };
  }

  function renderPage() {
    document.title = state.profile.username
      ? `CINEfy - @${state.profile.username}`
      : "CINEfy - Perfil publico";

    publicProfileAvatar.src = state.profile.avatar || defaultAvatar;
    publicProfileName.textContent = state.profile.displayName || "Cinefilo";
    publicProfileHandle.textContent = `@${state.profile.username || "cinefyuser"}`;
    publicProfileBio.textContent = state.profile.bio || "Esse usuario ainda nao adicionou uma bio publica.";
    publicProfileLocation.textContent = state.profile.location || "Brasil";
    publicProfileTheme.textContent = `Tema favorito: ${themeLabels[state.profile.theme] || "Ember"}`;
    publicProfileListCount.textContent = String(state.sharedLists.length);
    publicProfileReviewCount.textContent = String(state.reviews.length);

    if (editOwnProfileLink) {
      editOwnProfileLink.classList.toggle("hidden", !(state.targetUid && currentProfile && currentProfile.uid && state.targetUid === currentProfile.uid));
    }

    renderStatus();
    renderSharedLists();
    renderReviews();
  }

  function renderStatus() {
    if (!state.viewerSignedIn) {
      publicProfileStatus.textContent = "Perfil publico";
      publicProfileStatusCopy.textContent = "Voce pode explorar as listas publicas agora e entrar depois para ver a camada social completa.";
      return;
    }

    if (!state.sharedLists.length && !state.reviews.length) {
      publicProfileStatus.textContent = "Perfil em construcao";
      publicProfileStatusCopy.textContent = "Esse usuario ainda nao compartilhou listas nem reviews publicas por aqui.";
      return;
    }

    publicProfileStatus.textContent = "Comunidade CINEfy";
    publicProfileStatusCopy.textContent = "Abra listas publicas, leia reviews recentes e descubra o gosto cinematografico desse perfil com poucos cliques.";
  }

  function renderSharedLists() {
    if (!state.sharedLists.length) {
      publicProfileListsCaption.textContent = "Ainda nao encontramos listas publicas compartilhadas por este usuario.";
      publicProfileListsGrid.innerHTML = `
        <div class="public-profile-empty md:col-span-2">
          <span class="material-symbols-outlined text-5xl text-red-300">movie_filter</span>
          <p class="text-xl font-black text-white">Nenhuma lista publica por enquanto.</p>
          <p class="text-sm leading-relaxed">Assim que esse usuario compartilhar uma curadoria, ela vai aparecer aqui para abrir direto.</p>
        </div>
      `;
      return;
    }

    publicProfileListsCaption.textContent = "Abra uma lista compartilhada com um toque e continue navegando pelo modo leitor.";
    publicProfileListsGrid.innerHTML = state.sharedLists.map((list) => `
      <a class="public-profile-list-card" href="${escapeAttribute(buildSharedListHref(list))}">
        <div class="public-profile-list-card__meta">
          <span class="public-profile-list-card__pill">Lista publica</span>
          <span class="public-profile-list-card__pill">${escapeHtml(String(list.movies.length || 0))} filme(s)</span>
        </div>
        <div>
          <h3 class="text-xl font-black text-white">${escapeHtml(list.title || "Lista compartilhada")}</h3>
          <p class="mt-2 text-sm leading-relaxed text-zinc-400">${escapeHtml(list.description || "Curadoria compartilhada no CINEfy.")}</p>
        </div>
        <div class="flex items-center justify-between gap-3 text-sm">
          <span class="text-zinc-400">Atualizada em ${escapeHtml(formatDate(list.updatedAt))}</span>
          <span class="inline-flex items-center gap-2 font-bold text-white">
            Abrir lista
            <span class="material-symbols-outlined text-base">arrow_forward</span>
          </span>
        </div>
      </a>
    `).join("");
  }

  function renderReviews() {
    if (!state.viewerSignedIn) {
      publicProfileReviewsCaption.textContent = "Entre na sua conta para ver as reviews publicas desse usuario e navegar pela comunidade.";
      publicProfileReviewsList.innerHTML = `
        <div class="public-profile-empty">
          <span class="material-symbols-outlined text-5xl text-red-300">login</span>
          <p class="text-xl font-black text-white">Reviews protegidas pela comunidade.</p>
          <p class="text-sm leading-relaxed">As opinioes publicas aparecem para usuarios autenticados, ajudando a manter o contexto social do CINEfy.</p>
        </div>
      `;
      return;
    }

    if (!state.reviews.length) {
      publicProfileReviewsCaption.textContent = "Esse usuario ainda nao publicou reviews publicas no CINEfy.";
      publicProfileReviewsList.innerHTML = `
        <div class="public-profile-empty">
          <span class="material-symbols-outlined text-5xl text-red-300">rate_review</span>
          <p class="text-xl font-black text-white">Sem reviews publicas por enquanto.</p>
          <p class="text-sm leading-relaxed">Quando esse usuario avaliar filmes no CINEfy, as reviews mais recentes aparecem aqui.</p>
        </div>
      `;
      return;
    }

    publicProfileReviewsCaption.textContent = "As reviews publicas mais recentes aparecem aqui para voce entender rapido o gosto desse perfil.";
    publicProfileReviewsList.innerHTML = state.reviews.map((review) => `
      <article class="public-profile-review-card">
        <div class="public-profile-review-card__header">
          <div class="min-w-0">
            <h3 class="truncate text-lg font-black text-white">${escapeHtml(review.title || "Filme avaliado")}</h3>
            <p class="public-profile-review-card__film">Atualizada em ${escapeHtml(formatDate(review.updatedAt))}</p>
          </div>
          <div class="public-profile-review-card__rating">
            <span class="material-symbols-outlined fill-icon text-yellow-400 text-sm">star</span>
            <span>${escapeHtml(review.ratingLabel)}</span>
          </div>
        </div>
        <p class="public-profile-review-card__body">${escapeHtml(review.comment)}</p>
        <p class="public-profile-review-card__footer">${escapeHtml(review.sourceLabel)}</p>
      </article>
    `).join("");
  }

  function renderNotice(title, copy, actions = []) {
    publicProfileNotice.classList.remove("hidden");
    publicProfileNotice.innerHTML = `
      <p class="public-profile-notice__title">${escapeHtml(title)}</p>
      <p class="public-profile-notice__copy">${escapeHtml(copy)}</p>
      ${actions.length ? `
        <div class="public-profile-notice__actions">
          ${actions.map((action) => `
            <a class="public-profile-action${action.strong ? " public-profile-action--strong" : ""}" href="${escapeAttribute(action.href)}">
              <span class="material-symbols-outlined">${escapeHtml(action.icon || "arrow_forward")}</span>
              <span>${escapeHtml(action.label)}</span>
            </a>
          `).join("")}
        </div>
      ` : ""}
    `;
  }

  function renderUnavailableState(message) {
    state.sharedLists = [];
    state.reviews = [];
    publicProfileStatus.textContent = "Indisponivel";
    publicProfileStatusCopy.textContent = "Nao foi possivel montar o perfil solicitado.";
    publicProfileListsCaption.textContent = message;
    publicProfileReviewsCaption.textContent = message;
    publicProfileListsGrid.innerHTML = `
      <div class="public-profile-empty md:col-span-2">
        <span class="material-symbols-outlined text-5xl text-red-300">person_off</span>
        <p class="text-xl font-black text-white">Perfil indisponivel.</p>
        <p class="text-sm leading-relaxed">${escapeHtml(message)}</p>
      </div>
    `;
    publicProfileReviewsList.innerHTML = "";
    renderNotice("Nao encontramos esse perfil", message, [{ href: "amigos.html", icon: "arrow_back", label: "Voltar" }]);
  }

  function normalizeSharedList(rawList) {
    const safeList = rawList && typeof rawList === "object" ? rawList : {};
    return {
      shareId: sanitizeText(safeList.shareId || "", 160),
      slug: sanitizeText(safeList.slug || "", 120),
      privacy: sanitizeText(safeList.privacy || "publica", 20),
      title: sanitizeText(safeList.title || "Lista compartilhada", 80) || "Lista compartilhada",
      description: sanitizeMultilineText(safeList.description || "Curadoria compartilhada no CINEfy.", 240) || "Curadoria compartilhada no CINEfy.",
      updatedAt: sanitizeText(safeList.updatedAt || "", 40),
      movies: Array.isArray(safeList.movies) ? safeList.movies.slice(0, 120) : []
    };
  }

  function normalizeReviewRecord(rawReview) {
    const safeReview = rawReview && typeof rawReview === "object" ? rawReview : {};
    const comment = sanitizeMultilineText(safeReview.comment || "", 1600);
    const ratingLabel = buildRatingLabel(safeReview.rating);

    if (!comment && !ratingLabel) {
      return null;
    }

    return {
      title: sanitizeText(safeReview.title || "Filme avaliado", 120) || "Filme avaliado",
      comment: comment || "Sem comentario adicional.",
      updatedAt: sanitizeText(safeReview.updatedAt || "", 40),
      ratingLabel,
      sourceLabel: "Review publica no CINEfy"
    };
  }

  function buildRatingLabel(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? `${parsed.toFixed(1)}/5` : "Sem nota";
  }

  function buildSharedListHref(list) {
    const query = new URLSearchParams({
      share: String(list.shareId || "")
    });

    if (list.slug) {
      query.set("lista", list.slug);
    }

    return `modoleitor.html?${query.toString()}`;
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

  function sanitizeMultilineText(value, maxLength) {
    return String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().slice(0, maxLength);
  }

  function safeAvatarUrl(value) {
    const candidate = String(value || "").trim();
    if (!candidate) return defaultAvatar;

    if (/^data:image\/(png|jpeg|webp);/i.test(candidate) || candidate.startsWith("blob:")) {
      return candidate;
    }

    try {
      const parsedUrl = new URL(candidate, window.location.origin);
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        return parsedUrl.href;
      }
    } catch (error) {
      return defaultAvatar;
    }

    return defaultAvatar;
  }

  function formatDate(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "recentemente";
    }

    return parsed.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
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

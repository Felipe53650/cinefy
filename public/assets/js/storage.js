(function () {
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

  function getFirebaseStorage() {
    return window.CinefyFirebase && window.CinefyFirebase.storage
      ? window.CinefyFirebase.storage
      : null;
  }

  function getCurrentSession() {
    try {
      const raw = localStorage.getItem("cinefy-auth-session");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function assertImageFile(file) {
    if (!file) {
      throw new Error("Selecione uma imagem antes de continuar.");
    }

    if (!file.type || !ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new Error("Selecione uma imagem PNG, JPG ou WEBP valida.");
    }

    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("A imagem precisa ter no maximo 5 MB.");
    }
  }

  function sanitizeFileName(name) {
    const baseName = String(name || "imagem")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return baseName || "imagem";
  }

  function getUserId() {
    const session = getCurrentSession();
    return session && session.uid ? session.uid : "";
  }

  async function uploadUserImage(file, folder) {
    assertImageFile(file);

    const storage = getFirebaseStorage();
    if (!storage) {
      throw new Error("O Firebase Storage ainda nao esta disponivel nesta pagina.");
    }

    const userId = getUserId();
    if (!userId) {
      throw new Error("Faca login para enviar imagens personalizadas.");
    }

    const safeFolder = String(folder || "misc").replace(/[^a-z0-9_-]/gi, "") || "misc";
    const extension = file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension || "jpg"}`;
    const path = `user_uploads/${userId}/${safeFolder}/${fileName}`;
    const ref = storage.ref().child(path);

    await ref.put(file, {
      cacheControl: "public,max-age=604800",
      contentType: file.type
    });

    return ref.getDownloadURL();
  }

  window.CinefyStorage = {
    uploadUserImage,
    hasStorage() {
      return Boolean(getFirebaseStorage());
    }
  };
})();

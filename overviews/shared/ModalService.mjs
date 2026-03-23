export function initImageModal() {

    const modal = document.getElementById("imageModal");
    const modalImg = document.getElementById("modalImage");
    const modalCaption = document.getElementById("modalCaption");
    const closeBtn = modal.querySelector(".image-modal-close");

    function open(src, caption = "") {
        modalImg.src = src;
        modalCaption.textContent = caption;

        modal.style.display = "flex";
        requestAnimationFrame(() => {
            modal.classList.add("show");
        });
    }

    function close() {
        modal.classList.remove("show");
        setTimeout(() => {
            modal.style.display = "none";
            modalImg.src = "";
        }, 300);
    }


    modal.addEventListener("click", close);

    if (closeBtn) closeBtn.addEventListener("click", close);


    document.addEventListener("click", e => {
        const img = e.target.closest("[data-modal-src]");
        if (!img) return;

        open(
            img.dataset.modalSrc,
            img.dataset.modalCaption || ""
        );
    });

    window.openImageModal = open;
    window.closeImageModal = close;

    return { open, close };
}

export function initCustomModal({
    modalId,
    cardSelector = ".gf-modal-card",
    closeSelector = ".gf-modal-close",
    closeAnimMs = 200
}) {
    const modal = document.getElementById(modalId);
    const closeBtn = modal?.querySelector(closeSelector);

    if (!modal) {
        return {
            open() { },
            close() { },
            isOpen() { return false; }
        };
    }

    let closeTimer = 0;

    function close() {
        if (!modal.classList.contains("open")) return;
        modal.classList.remove("open");
        modal.classList.add("closing");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("gf-modal-open");
        if (closeTimer) {
            window.clearTimeout(closeTimer);
        }
        closeTimer = window.setTimeout(() => {
            modal.classList.remove("closing");
            closeTimer = 0;
        }, closeAnimMs);
    }

    function open() {
        if (closeTimer) {
            window.clearTimeout(closeTimer);
            closeTimer = 0;
        }
        modal.classList.remove("closing");
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("gf-modal-open");
    }

    function isOpen() {
        return modal.classList.contains("open");
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", close);
    }

    modal.addEventListener("click", (event) => {
        if (!event.target.closest(cardSelector) || event.target.closest("[data-close-modal]")) {
            close();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && isOpen()) {
            close();
        }
    });

    return { open, close, isOpen };
}

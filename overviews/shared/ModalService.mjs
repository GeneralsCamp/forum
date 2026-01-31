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
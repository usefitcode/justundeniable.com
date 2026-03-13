// Modal Authentication Check + Close Modal after Authenticated
document.addEventListener("DOMContentLoaded", function() {
  function waitForMemberstack(callback) {
    if (window.$memberstackDom) {
      callback();
    } else {
      setTimeout(() => waitForMemberstack(callback), 100);
    }
  }

  waitForMemberstack(function() {
    // Check auth and show modal if needed
    $memberstackDom.getCurrentMember().then(({ data }) => {
      if (!data) {
        const modalTrigger = document.querySelector('[aria-controls="fs-modal-1-popup"]');
        if (modalTrigger) modalTrigger.click();
      }
    });

    // Handle modal auth completion
    const modal = document.querySelector('[fs-modal-element="modal"]');
    if (!modal) return;

    const observer = new MutationObserver((mutations) => {
      const isOpen = modal.style.display !== 'none';
      if (isOpen) {
        const forms = document.querySelectorAll('[data-ms-form="login"], [data-ms-form="signup"]');
        forms.forEach(form => {
          form.addEventListener('submit', () => {
            const checkAuth = () => {
              $memberstackDom.getCurrentMember().then(({ data }) => {
                if (data) {
                  const closeBtn = document.querySelector('[fs-modal-element="close"]');
                  if (closeBtn) closeBtn.click();
                  observer.disconnect();
                }
              });
            };
            setTimeout(checkAuth, 1000);
          }, { once: true });
        });
      }
    });

    observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
  });
}); 
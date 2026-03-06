(function () {
    const form = document.getElementById('waitlistForm');
    const btn = document.getElementById('submitBtn');
    const msg = document.getElementById('successMsg');
    const emailInput = document.getElementById('emailInput');

    if (!form || !btn || !msg || !emailInput) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!emailInput.value) return;

        btn.textContent = 'Submitting...';
        btn.disabled = true;
        btn.style.opacity = '0.6';

        // Simulate submit (replace with real API call later)
        setTimeout(() => {
            form.style.display = 'none';
            msg.classList.add('show');
        }, 800);
    });
})();


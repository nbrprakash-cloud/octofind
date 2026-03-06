(function () {
    // Scroll fade-in animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-in').forEach((el) => observer.observe(el));

    // FAQ accordion
    function toggleFaq(button) {
        const item = button.parentElement;
        const isOpen = item.classList.contains('open');

        document.querySelectorAll('.faq-item').forEach((faq) => {
            faq.classList.remove('open');
        });

        if (!isOpen) {
            item.classList.add('open');
        }
    }

    document.querySelectorAll('.faq-question').forEach((button) => {
        button.addEventListener('click', () => toggleFaq(button));
    });

    // Mobile nav toggle
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('nav-open');
        });
    }

    // Parallax mascot on scroll
    const heroMascot = document.querySelector('.hero-mascot img');
    if (heroMascot) {
        window.addEventListener('scroll', () => {
            const scrollY = window.scrollY;
            if (scrollY < 800) {
                heroMascot.style.transform = `translateY(${-16 + scrollY * 0.04}px)`;
            }
        }, { passive: true });
    }

    // Interactive demo logic
    const demoInput = document.getElementById('demoInput');
    const demoOutput = document.getElementById('demoOutput');
    const PROMO_KEYWORDS = ['tool', 'app', 'ai', 'check out', 'built', 'try', 'discount'];
    const PROMO_DOMAINS = ['.ai', '.io', '.com', '.app'];

    function analyzeText(text) {
        if (!demoOutput) return;
        if (!text.trim()) {
            demoOutput.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">Analysis will appear here...</span>';
            return;
        }

        let html = text.replace(/[<>&"']/g, (m) => ({
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&#39;',
        }[m]));

        PROMO_KEYWORDS.forEach((word) => {
            const regex = new RegExp(`\\b(${word})\\b`, 'gi');
            html = html.replace(regex, '<mark>$1</mark>');
        });

        PROMO_DOMAINS.forEach((domain) => {
            const regex = new RegExp(`(\\S+${domain.replace('.', '\\.')})`, 'gi');
            html = html.replace(regex, '<mark class="high">$1</mark>');
        });

        demoOutput.innerHTML = `<div class="playground-result">${html}</div>`;
    }

    if (demoInput && demoOutput) {
        demoInput.addEventListener('input', (e) => analyzeText(e.target.value));
    }

    // 3D tilt effect
    document.querySelectorAll('.feature-card').forEach((card) => {
        card.classList.add('tilt-card');
        const inner = document.createElement('div');
        inner.className = 'tilt-card-inner';
        while (card.firstChild) inner.appendChild(card.firstChild);
        card.appendChild(inner);

        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 10;
            const rotateY = (centerX - x) / 10;
            inner.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });

        card.addEventListener('mouseleave', () => {
            inner.style.transform = 'rotateX(0deg) rotateY(0deg)';
        });
    });
})();


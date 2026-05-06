// Theme Toggle with body class
function setTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        localStorage.setItem('hotel_theme', 'dark');
        const icon = document.querySelector('#themeToggleBtn i');
        if (icon) icon.className = 'bi bi-moon-stars-fill';
    } else {
        document.body.classList.remove('dark-theme');
        localStorage.setItem('hotel_theme', 'light');
        const icon = document.querySelector('#themeToggleBtn i');
        if (icon) icon.className = 'bi bi-brightness-high-fill';
    }
}

const savedTheme = localStorage.getItem('hotel_theme');
if (savedTheme === 'dark') setTheme('dark');
else setTheme('light');

const themeBtn = document.getElementById('themeToggleBtn');
if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-theme');
        setTheme(isDark ? 'light' : 'dark');
    });
}

// Navbar scroll effect
window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (nav) {
        if (window.scrollY > 40) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');
    }
});

// Smooth scroll for anchor links (if any)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === "#" || targetId === "") return;
        const target = document.querySelector(targetId);
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});
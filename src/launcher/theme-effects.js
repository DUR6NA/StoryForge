
class ThemeEffects {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.animationFrame = null;
        this.currentEffect = null;
        this.width = 0;
        this.height = 0;
    }

    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        window.addEventListener('resize', () => this.resize());
        this.resize();

        // Observation for theme changes
        this.observeThemeChanges();
    }

    resize() {
        if (!this.canvas) return;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    observeThemeChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    this.checkTheme();
                }
            });
        });
        observer.observe(document.body, { attributes: true });
        this.checkTheme(); // Initial check
    }

    checkTheme() {
        this.stopExisiting();

        if (document.body.classList.contains('theme-matrix')) {
            this.startMatrix();
            this.canvas.style.display = 'block';
        } else if (document.body.classList.contains('theme-stars')) {
            this.startStarrySky();
            this.canvas.style.display = 'block';
        } else {
            // Hide canvas for static themes so it doesn't block clicks or waste resources
            if (this.canvas) {
                // We keep it cleared
                this.ctx.clearRect(0, 0, this.width, this.height);
                this.canvas.style.display = 'none';
            }
        }
    }

    stopExisiting() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    // --- MATRIX EFFECT ---
    startMatrix() {
        const fontSize = 16;
        const columns = Math.floor(this.width / fontSize);
        const drops = [];
        for (let i = 0; i < columns; i++) {
            drops[i] = Math.random() * -100; // Start above screen
        }

        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()";

        const matrixLoop = () => {
            // Translucent fade for trail
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            this.ctx.fillRect(0, 0, this.width, this.height);

            // DIMMED: Lower opacity green
            this.ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
            this.ctx.font = `${fontSize}px monospace`;

            for (let i = 0; i < drops.length; i++) {
                const text = chars.charAt(Math.floor(Math.random() * chars.length));
                this.ctx.fillText(text, i * fontSize, drops[i] * fontSize);

                if (drops[i] * fontSize > this.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
            this.animationFrame = requestAnimationFrame(matrixLoop);
        };

        matrixLoop();
    }

    // --- STARRY SKY EFFECT ---
    startStarrySky() {
        const stars = [];
        const numStars = 200;
        let shootingStar = null;

        // Init stars
        for (let i = 0; i < numStars; i++) {
            stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: Math.random() * 1.5,
                speed: Math.random() * 0.5 + 0.1
            });
        }

        const starryLoop = () => {
            // Clear with dark blue/black
            this.ctx.fillStyle = '#050514';
            this.ctx.fillRect(0, 0, this.width, this.height);

            // DIMMED: Star Opacity
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            stars.forEach(star => {
                this.ctx.beginPath();
                this.ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
                this.ctx.fill();

                // Move
                star.y -= star.speed;
                star.x -= star.speed;

                if (star.x < 0) star.x = this.width;
                if (star.y < 0) star.y = this.height;
            });

            // Shooting Star Logic
            if (!shootingStar) {
                if (Math.random() < 0.01) { // 1% chance per frame
                    shootingStar = {
                        x: Math.random() * this.width,
                        y: Math.random() * (this.height / 2),
                        length: 0,
                        speed: 15,
                        angle: Math.PI / 4 // 45 degrees
                    };
                }
            } else {
                // Update shooting star
                shootingStar.x += shootingStar.speed * Math.cos(shootingStar.angle);
                shootingStar.y += shootingStar.speed * Math.sin(shootingStar.angle);
                shootingStar.length += 1;

                // Draw shooting star
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(shootingStar.x, shootingStar.y);
                this.ctx.lineTo(
                    shootingStar.x - Math.cos(shootingStar.angle) * shootingStar.length * 5,
                    shootingStar.y - Math.sin(shootingStar.angle) * shootingStar.length * 5
                );
                this.ctx.stroke();

                // Reset if OOB
                if (shootingStar.x > this.width || shootingStar.y > this.height) {
                    shootingStar = null;
                }
            }

            this.animationFrame = requestAnimationFrame(starryLoop);
        };

        starryLoop();
    }
}

// Global instance
window.themeEffects = new ThemeEffects();
document.addEventListener('DOMContentLoaded', () => {
    window.themeEffects.init('theme-canvas');
});

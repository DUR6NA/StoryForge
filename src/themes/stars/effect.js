// Starry Sky Effect Logic
const starsEffect = {
    start(canvas, ctx) {
        const width = canvas.width;
        const height = canvas.height;
        const stars = [];
        const numStars = 200;
        let shootingStar = null;

        for (let i = 0; i < numStars; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: Math.random() * 1.5,
                speed: Math.random() * 0.5 + 0.1
            });
        }

        const loop = () => {
            ctx.fillStyle = '#050514';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';

            stars.forEach(star => {
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
                ctx.fill();
                star.y -= star.speed;
                star.x -= star.speed;
                if (star.x < 0) star.x = width;
                if (star.y < 0) star.y = height;
            });

            this.frame = requestAnimationFrame(loop);
        };
        loop();
    },
    stop() {
        if (this.frame) cancelAnimationFrame(this.frame);
    }
};

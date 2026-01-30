// Matrix Effect Logic
const matrixEffect = {
    start(canvas, ctx) {
        const width = canvas.width;
        const height = canvas.height;
        const fontSize = 16;
        const columns = Math.floor(width / fontSize);
        const drops = Array(columns).fill(0).map(() => Math.random() * -100);
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()";

        const loop = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
            ctx.font = `${fontSize}px monospace`;

            for (let i = 0; i < drops.length; i++) {
                const text = chars.charAt(Math.floor(Math.random() * chars.length));
                ctx.fillText(text, i * fontSize, drops[i] * fontSize);

                if (drops[i] * fontSize > height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
            this.frame = requestAnimationFrame(loop);
        };
        loop();
    },
    stop() {
        if (this.frame) cancelAnimationFrame(this.frame);
    }
};

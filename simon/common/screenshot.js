
export default function screenshot(options = {}) {
    const { rect, renderer } = options;
    // const type = 'image/webp';
    const type = 'image/png';
    const quality = 0.92;

    if (!rect) {
        // return renderer.domElement.toDataURL(type, quality);

        const a = document.createElement('a');
        a.download = 'screenshot';
        a.href = renderer.domElement.toDataURL(type, quality);
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
    }

    const [x1, y1, x2, y2] = rect;
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        // 从左上角绘制
        const sx = Math.min(x1, x2);
        const sy = Math.min(y1, y2);
        ctx.drawImage(renderer.domElement, sx, sy, width, height, 0, 0, width, height);
        return canvas.toDataURL(type, quality);
    }
}
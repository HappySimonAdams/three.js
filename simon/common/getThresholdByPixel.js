/**
 * 目前只对正交相机有效
 */
export default function getThresholdByPixel(options) {
    const { container, camera, pixel } = options;
    const { left, right, zoom } = camera;
    return pixel * (right - left) / zoom / container.clientWidth;
}
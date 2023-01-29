import * as THREE from '../../build/three.module.js';

const _up = new THREE.Vector3(0, 0, 1);
const _direction = new THREE.Vector3();
const _left = new THREE.Vector3();
const _right = new THREE.Vector3();

/**
 * 使用三角面模拟箭头线
 */
export default class ArrowLine extends THREE.Object3D {
    constructor(color) {
        super();

        this._color = color ?? new THREE.Color(0xffff00);
        this._positions = [];
        this._mesh = undefined;
    }

    set positions(value) {
        if (value.length !== 2) return;
        this._positions = value;

        if (!this._mesh) {
            const vertices = this._buildVertices();
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            const material = new THREE.MeshBasicMaterial({ color: this._color });
            this._mesh = new THREE.Mesh(geometry, material);
            this.add(this._mesh);
        } else {
            const vertices = this._buildVertices();
            this._mesh.geometry.attributes.position.array.set(vertices);
            this._mesh.geometry.attributes.position.needsUpdate = true;
        }
    }

    // 构建顶点坐标。第一个点为箭头位置。箭头大小与引线宽度随距离变化
    _buildVertices() {
        const [pos1, pos2] = this._positions;
        const distance = pos1.distanceTo(pos2);
        _direction.subVectors(pos1, pos2).normalize();
        _left.crossVectors(_up, _direction);
        _right.copy(_left).negate();
        
        const arrowLength = distance * 0.04; // 箭头长度
        const tempPos = new THREE.Vector3().copy(pos1).addScaledVector(_direction.negate(), arrowLength);
        // pos1, pos3, pos4 三点表示箭头三角形的坐标
        const pos3 = new THREE.Vector3().copy(tempPos).addScaledVector(_left, arrowLength / 2);
        const pos4 = new THREE.Vector3().copy(tempPos).addScaledVector(_right, arrowLength / 2);
        // pos5, pos6, pos7, pos8 四点表示引线的坐标。前宽后窄
        const lineWidth1 = arrowLength / 8;
        const lineWidth2 = arrowLength / 20;
        const pos5 = new THREE.Vector3().copy(tempPos).addScaledVector(_left, lineWidth1);
        const pos6 = new THREE.Vector3().copy(pos2).addScaledVector(_left, lineWidth2);
        const pos7 = new THREE.Vector3().copy(pos2).addScaledVector(_right, lineWidth2);
        const pos8 = new THREE.Vector3().copy(tempPos).addScaledVector(_right, lineWidth1);

        return [
            ...pos1.toArray(),
            ...pos3.toArray(),
            ...pos4.toArray(),
            ...pos5.toArray(),
            ...pos6.toArray(),
            ...pos7.toArray(),
            ...pos5.toArray(),
            ...pos7.toArray(),
            ...pos8.toArray(),
        ];
    }
}
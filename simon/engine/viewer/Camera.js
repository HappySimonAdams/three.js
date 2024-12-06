import { Box3, MathUtils, Matrix4, Quaternion, Ray, Camera as ThreeCamera, Vector3 } from '../../../build/three.module.js';
import { Tween } from './Tween.js';

export class Camera extends ThreeCamera {

	constructor( scene ) {

		super();

		this.scene = scene;
		this.isOrthographicCamera = false;
		this.isPerspectiveCamera = false;

		const { clientWidth, clientHeight } = scene.container;
		this.aspect = clientWidth / clientHeight;

		this._frustumType = null;
		this._ray = null;
		this._flight = null;

		this.lookDirection = new Vector3( 1, 0, 0 ); // 相机位置 - 目标位置
		this.rightDirection = new Vector3();

		this.viewOffset = null;
		this.viewChange = false;
		this.defaultView = null;

		if ( scene.mode === '2d' ) {

			this.position.set( 0, 0, 1e5 );
			// this.up.set(0, 1, 0);
			this.width = this.position.length(); // 正交相机的视锥宽度
			this.frustumType = 'orthographic';

		} else {

			this.fov = 45;
			this.near = 0.1;
			this.far = scene.useLogDepth ? 1e10 : 1000;
			this.frustumType = 'perspective';

		}

	}

	set frustumType( type ) {

		if ( this._frustumType === type ) return;

		if ( ! [ 'orthographic', 'perspective' ].includes( type ) ) {

			console.error( '错误的相机类型' );
			return;

		}

		this._frustumType = type;
		this.isOrthographicCamera = type === 'orthographic';
		this.isPerspectiveCamera = type === 'perspective';
		this.updateOrthoFrustumWidth();
		this.updateProjectionMatrix();
		this.scene.requestRender();

	}

	get frustumType() {

		return this._frustumType;

	}

	updateProjectionMatrix() {

		let width, height, left, top;

		if ( this._frustumType === 'orthogrpahic' ) {

			width = this.width;
			height = width / this.aspect;
			left = - 0.5 * width;
			top = 0.5 * height;

			if ( this.viewOffset && this.viewOffset.enabled ) {

				const { fullWidth, fullHeight, offsetX, offsetY, width: w, height: h } = this.viewOffset;
				left += offsetX * width / fullWidth;
				top -= offsetY * height / fullHeight;
				width *= w / fullWidth;
				height *= h / fullHeight;

			}

			this.projectionMatrix.makeOrthographic( left, left + width, top, top - height, this.near, this.far );

		} else {

			top = this.near * Math.tan( MathUtils.DEG2RAD * 0.5 * this.fov );
			height = 2 * top;
			width = this.aspect * height;
			left = - 0.5 * width;

			if ( this.viewOffset && this.viewOffset.enabled ) {

				const { fullWidth, fullHeight, offsetX, offsetY, width: w, height: h } = this.viewOffset;
				left += offsetX * width / fullWidth;
				top -= offsetY * height / fullHeight;
				width *= w / fullWidth;
				height *= h / fullHeight;

			}

			this.projectionMatrix.makePerspective( left, left + width, top, top - height, this.near, this.far );

		}

		this.projectionMatrixInverse.copy( this.projectionMatrix ).invert();

	}

	updateOrthoFrustumWidth() {

		if ( this._frustumType !== 'orthogrpahic' ) return;

		if ( this.scene.mode === '2d' ) {

			this.width = this.position.z;

		} else {

			const { picker, boundingBox, container } = this.scene;
			const pickPos = picker.pickPosition( { x: container.clientWidth / 2, y: container.clientHeight / 2 } ); // 屏幕中心点

			if ( pickPos ) {

				this.width = pickPos.distanceTo( this.position );

			} else {

				if ( boundingBox.isEmpty() ) return;
				const distance = boundingBox.distanceToPoint( this.position );
				if ( distance > 0 ) {

					this.width = distance;

				} else {
					// 进入包围盒内时不更新 width
				}

			}

		}

	}

	resize( width, height ) {

		this.aspect = width / height;
		this.updateProjectionMatrix();

	}

	setViewOffset( fullWidth, fullHeight, x, y, width, height ) {

		if ( ! this.viewOffset ) {

			this.viewOffset = {
				enabled: true,
				fullWidth: 1,
				fullHeight: 1,
				offsetX: 0,
				offsetY: 0,
				width: 1,
				height: 1
			};

		}

		this.viewOffset.enabled = true;
		this.viewOffset.fullWidth = fullWidth;
		this.viewOffset.fullHeight = fullHeight;
		this.viewOffset.offsetX = x;
		this.viewOffset.offsetY = y;
		this.viewOffset.width = width;
		this.viewOffset.height = height;

		this.updateProjectionMatrix();

	}

	clearViewOffset() {

		if ( this.viewOffset ) {

			this.viewOffset.enabled = false;

		}

		this.updateProjectionMatrix();

	}

	/**
     * @param mouse NDC 坐标
     * @internal
     */
	getPickRayDirection( mouse ) {

		if ( ! this._ray ) this._ray = new Ray();

		this._ray.origin.copy( this.position );
		this._ray.direction.set( mouse.x, mouse.y, 0.5 ).unproject( this ).sub( this._ray.origin ).normalize();

		return this._ray.direction;

	}

	setView( options ) {

		const { rotation, up } = options;
		let { destination, target } = options;
		let needsChangeNearFar = false;

		if ( destination ) {

			if ( this.scene.mode === '2d' ) {

				destination = ( destination instanceof Box3 ) ? this._get2dPositionByBox( destination ) : destination;
				this.position.copy( destination );

			} else {

				/* 如果传的是 box, 则会根据 box 与当前视线方向计算出 target */
				if ( destination instanceof Box3 ) {

					const result = this._get3dPositionByBox( destination );
					this.position.copy( result.position );
					if ( ! target ) target = result.target;

				} else {

					this.position.copy( destination );

				}

			}

			this.viewChange = true;
			needsChangeNearFar = true;

		}

		if ( rotation ) {

			this.rotation.setFromVector3( rotation );
			this.rightDirection.set( 1, 0, 0 ).applyEuler( this.rotation );
			this.up.set( 0, 1, 0 ).applyEuler( this.rotation );
			this.lookDirection.set( 0, 0, 1 ).applyEuler( this.rotation );
			this.viewChange = true;

		} else if ( target ) {

			// this.lookAt(target);
			const m = new Matrix4().lookAt( this.position, target, up || this.up );
			this.quaternion.setFromRotationMatrix( m );
			this.rightDirection.setFromMatrixColumn( m, 0 );
			this.up.setFromMatrixColumn( m, 1 );
			this.lookDirection.setFromMatrixColumn( m, 2 );
			this.viewChange = true;

		}

		if ( this.viewChange ) {

			if ( needsChangeNearFar ) {

				this._updateNearFar();
				this.updateProjectionMatrix();

			}

			this.scene.requestRender();

		}

	}

	_get2dPositionByBox( box ) {

		const position = new Vector3();
		box.getCenter( position );

		const { min, max } = box;
		const width = max.x - min.x;
		const height = max.y - min.y;
		let right, top;

		if ( width / height >= this.aspect ) {

			right = width / 2;
			top = right / this.aspect;

		} else {

			top = height / 2;
			right = top * this.aspect;

		}

		position.z = Math.max( right, top ) * 2;
		return position;

	}

	_get3dPositionByBox( box ) {

		const target = box.getCenter( new Vector3() );
		const distance = box.min.distanceTo( box.max ); // 包围盒对角线长度
		const offset = this.lookDirection.clone().multiplyScalar( distance );
		const position = target.clone().add( offset );
		return { position, target };

	}

	_updateNearFar() {

		if ( this.scene.mode === '2d' ) {

			const z = this.position.z;
			// 动态设置 near far（NOTE: 设置渲染对象的 position.z 可能会导致丢失）
			this.near = z * 0.9;
			this.far = z * 1.1;

		} else {

			const boundingBox = this.scene.boundingBox;
			if ( boundingBox.isEmpty() ) {

				// console.warn("场景包围盒为空，无法计算相机 near far");
				return;

			}

			const farToNearRatio = /* this.scene.useLogDepth ? this.scene.logDepthFarToNearRatio :  */this.scene.farToNearRatio;
			const direction = this.lookDirection.clone().negate().normalize();
			const nearFarData = getCameraNearFarByBox( this.position, direction, boundingBox );
			let near = nearFarData.near;
			const far = nearFarData.far;

			if ( ( far / near ) < farToNearRatio ) {

				near = far / farToNearRatio;

			}

			// NOTE: 使用 logDepthFarToNearRatio 时, near 值过小, 会导致远处的图片撕裂
			// this.near = Math.max(0.1, near * 0.99);
			this.near = Math.max( 0.01, near * 0.99 );
			this.far = far * 1.01;

		}

	}

	getView() {

		return {
			destination: this.position.clone(),
			rotation: new Vector3().setFromEuler( this.rotation ),
		};

	}

	flyTo( options ) {

		const { rotation, up, duration = 800, update, complete } = options;
		let { destination, target, } = options;

		if ( duration <= 0 ) {

			this.setView( { destination, rotation, target, up } );

			if ( complete ) {

				complete();

			}

			return;

		}

		// 确保 startProps 与 stopProps 的参数一致
		const startProps = {};
		const stopProps = {};
		let startQuaternion, stopQuaternion;

		if ( destination ) {

			if ( destination instanceof Box3 ) {

				if ( this.scene.mode === '2d' ) {

					destination = this._get2dPositionByBox( destination );

				} else {

					const result = this._get3dPositionByBox( destination );
					destination = result.position;
					if ( ! target ) target = result.target;

				}

			}

			startProps.destination = this.position.clone();
			stopProps.destination = destination;

		}

		if ( rotation ) {

			startProps.rotation = new Vector3().setFromEuler( this.rotation );
			stopProps.rotation = rotation;

		} else if ( target ) {

			const eye = stopProps.destination || this.position;
			const m = new Matrix4().lookAt( eye, target, up || this.up );
			// const rotation = new Euler().setFromRotationMatrix(m);
			// startProps.rotation = new Vector3().setFromEuler(this.rotation);
			// stopProps.rotation = new Vector3().setFromEuler(rotation);
			startQuaternion = this.quaternion.clone();
			stopQuaternion = new Quaternion().setFromRotationMatrix( m );
			startProps.quaternionFactor = 0;
			stopProps.quaternionFactor = 1;

		}

		this._flight = new Tween( {
			startProps,
			stopProps,
			duration,
			complete
		} );

		const { tweens } = this.scene;
		tweens.add( this._flight );

		this._flight.onUpdate( ( options ) => {

			if ( update ) {

				update();

			}

			if ( options.quaternionFactor ) {

				startQuaternion.slerp( stopQuaternion, options.quaternionFactor );
				this.quaternion.copy( startQuaternion );
				const m = new Matrix4().makeRotationFromQuaternion( this.quaternion );
				this.rightDirection.setFromMatrixColumn( m, 0 );
				this.up.setFromMatrixColumn( m, 1 );
				this.lookDirection.setFromMatrixColumn( m, 2 );

			}

			this.setView( options );

		} );

		this._flight.onComplete( () => {

			tweens.remove( this._flight );
			this._flight = null;

			if ( complete ) {

				complete();

			}

		} );

		this._flight.start();

	}

	stopFlight() {

		if ( ! this._flight ) return;

		this._flight.stop();
		this._flight.complete();
		this.scene.tweens.remove( this._flight );
		this._flight = null;

	}

	/**
     * 根据像素大小计算实际大小
     * @param pixel 像素值
     * @param distance 距离透视相机的距离
     */
	getThresholdByPixel( pixel, distance ) {

		if ( this._frustumType === 'orthographic' ) {

			return pixel * this.width / this.scene.container.clientWidth;

		} else if ( this._frustumType === 'perspective' ) {

			const viewportHeight = 2 * Math.tan( this.fov * Math.PI / 180 / 2 ) * distance;
			return pixel * viewportHeight / this.scene.container.clientHeight;

		}

	}

	/**
     * 世界坐标转屏幕坐标
     * @param position 世界坐标
     * @param isFloor 是否向下取整
     */
	worldToScreen( position, isFloor = true ) {

		const vector = position.clone().project( this );
		const { clientWidth, clientHeight } = this.scene.container;
		const halfW = clientWidth / 2;
		const halfH = clientHeight / 2;

		if ( isFloor ) {

			return [ Math.floor( vector.x * halfW + halfW ), Math.floor( - vector.y * halfH + halfH ) ];

		}

		return [ vector.x * halfW + halfW, - vector.y * halfH + halfH ];

	}

}

/**
 * 计算当前相机视线方向下, 能容纳包围盒的 near far
 * 算法思路: 计算8个点到相机视线方向的投影距离
 *
 * @param position 相机位置
 * @param direction 相机视线方向 (normalized)
 * @param box 包围盒
 * @returns { near, far }
 */
function getCameraNearFarByBox( position, direction, box ) {

	const { min, max } = box;
	let near = Number.MAX_VALUE;
	let far = 0;

	// front-left-top
	const corner = new Vector3( min.x, max.y, max.z );
	const toCenter = new Vector3().subVectors( corner, position );
	let distance = toCenter.dot( direction );
	near = Math.min( near, distance );
	far = Math.max( far, distance );

	// front-right-top
	corner.set( max.x, max.y, max.z );
	toCenter.subVectors( corner, position );
	distance = toCenter.dot( direction );
	near = Math.min( near, distance );
	far = Math.max( far, distance );

	// front-left-bottom
	corner.set( min.x, min.y, max.z );
	toCenter.subVectors( corner, position );
	distance = toCenter.dot( direction );
	near = Math.min( near, distance );
	far = Math.max( far, distance );

	// front-right-bottom
	corner.set( max.x, min.y, max.z );
	toCenter.subVectors( corner, position );
	distance = toCenter.dot( direction );
	near = Math.min( near, distance );
	far = Math.max( far, distance );

	// back-left-top
	corner.set( min.x, max.y, min.z );
	toCenter.subVectors( corner, position );
	distance = toCenter.dot( direction );
	near = Math.min( near, distance );
	far = Math.max( far, distance );

	// back-right-top
	corner.set( max.x, max.y, min.z );
	toCenter.subVectors( corner, position );
	distance = toCenter.dot( direction );
	near = Math.min( near, distance );
	far = Math.max( far, distance );

	// back-left-bottom
	corner.set( min.x, min.y, min.z );
	toCenter.subVectors( corner, position );
	distance = toCenter.dot( direction );
	near = Math.min( near, distance );
	far = Math.max( far, distance );

	// back-right-bottom
	corner.set( max.x, min.y, min.z );
	toCenter.subVectors( corner, position );
	distance = toCenter.dot( direction );
	near = Math.min( near, distance );
	far = Math.max( far, distance );

	return { near, far };

}

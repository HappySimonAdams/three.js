import { EventDispatcher, MOUSE, Quaternion, Spherical, TOUCH, Vector2, Vector3 } from '../../../build/three.module.js';
import { ViewChangeType } from './enums/ViewChangeType.js';
import { ViewZoomType } from './enums/ViewZoomType.js';

const STATE = {
	NONE: - 1,
	ROTATE: 0,
	DOLLY: 1,
	PAN: 2,
	TOUCH_PAN: 3,
	TOUCH_DOLLY_PAN: 4,
};

/**
 * 3d模式 (支持透视相机与正交相机)
 *   1.缩放: 以鼠标点为缩放中心点 (鼠标点拾取包围盒的坐标点)
 *   2.旋转: 以鼠标按下点(pointerdown)为旋转中心点 (鼠标点拾取模型的坐标点)
 *     鼠标没有点到模型上时使用模型包围盒的中心点为旋转中心点
 *     支持无限旋转
 *
 * 2d模式 (只支持正交相机)
 *   1.缩放: 以鼠标点为缩放中心点 (鼠标拾取数学平面的坐标点)
 */
export class CameraControl extends EventDispatcher {

	constructor( viewer ) {

		super();

		this.viewer = viewer;

		this._enabled = true;
		switch ( viewer.scene.mode ) {

			case '2d':
				this._mouseButtons = { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };
				this._touches = { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN };
				this.enableRotate = false;
				// 相机水平方向旋转限制轴
				this.constrainedAxis = new Vector3( 0, 1, 0 ); // y-up
				break;
			case '3d':
			default:
				this._mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };
				this._touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };
				this.enableRotate = true;
				this.constrainedAxis = new Vector3( 0, 0, 1 ); // z-up
				break;

		}

		this.rotateSpeed = 1.0;
		this.panSpeed = 1.0;
		this.zoomSpeed = 3.0;
		this.minDistance = 0.00001;
		this.maxDistance = Infinity;

		this._state = STATE.NONE;
		this._pointerdown = false;
		this._moveTime = 0;
		this._lastFireTime = 0;

		// NOTE: 不要存在全局（双栏同时操作时会有问题）
		this._rotateStart = new Vector2();
		this._rotateEnd = new Vector2();
		this._rotateDelta = new Vector2();
		this._offset = new Vector3();
		this._transformUpQuat = new Quaternion();
		this._transformUpQuatInverse = new Quaternion();
		this._spherical = new Spherical();
		this._rotateCursor = new Vector3( 0, 0, 0 ); // 旋转中心点
		this._panStart = new Vector2();
		this._panEnd = new Vector2();
		this._panDelta = new Vector2();
		this._panVec3 = new Vector3();
		this._panOffset = new Vector3();
		this._zoomOffset = new Vector3();
		this._zoomMouse = new Vector2(); // NDC坐标
		this._dolly = 0;

		this._bindEvents();

	}

	set enabled( value ) {

		if ( this._enabled === value ) return;
		this._enabled = value;
		if ( this._enabled ) {

			this._bindEvents();

		} else {

			this._removeEvents();

		}

	}

	get enabled() {

		return this._enabled;

	}

	set enabledLeftPan( value ) {

		if ( this.viewer.scene.mode !== '2d' ) return;

		this._mouseButtons.LEFT = value ? MOUSE.PAN : - 1;
		this._touches.ONE = value ? TOUCH.PAN : - 1;

	}

	_bindEvents() {

		const { pointer, wheel } = this.viewer.input;
		// 将相机控制事件的优先级设为最低
		const emitOrder = 9;
		pointer.addEventListener( 'pointerdown', this._pointerdownListener = ( evts ) => {

			this._onPointerDown( evts );

		}, emitOrder );
		pointer.addEventListener( 'pointermove', this._pointermoveListener = ( evts ) => {

			this._onPointerMove( evts );

		}, emitOrder );
		pointer.addEventListener( 'pointerup', this._pointerupListener = () => {

			this._onPointerUp();

		}, emitOrder );
		wheel.addEventListener( 'wheel', this._wheelListener = ( e ) => {

			this._onWheel( e );

		} );

	}

	_removeEvents() {

		const { pointer, wheel } = this.viewer.input;
		pointer.addEventListener( 'pointerdown', this._pointerdownListener );
		pointer.addEventListener( 'pointermove', this._pointermoveListener );
		pointer.addEventListener( 'pointerup', this._pointerupListener );
		wheel.addEventListener( 'wheel', this._wheelListener );

	}

	_onPointerDown( evts ) {

		this._pointerdown = true;

		if ( evts[ 0 ].pointerType === 'touch' ) {

			this._onTouchStart( evts );

		} else {

			this._onMouseDown( evts );

		}

	}

	_onPointerMove( evts ) {

		if ( ! this._pointerdown ) return;

		// 减少触发频率对旋转舒适度有所提升
		const time = evts[ 0 ].time;
		// if (time - this._moveTime < 30) return;
		this._moveTime = time;

		if ( evts[ 0 ].pointerType === 'touch' ) {

			this._onTouchMove( evts );

		} else {

			this._onMouseMove( evts );

		}

	}

	_onPointerUp() {

		this._pointerdown = false;
		this._state = STATE.NONE;

	}

	_onMouseDown( evts ) {

		const e = evts[ 0 ];
		let mouseAction;
		switch ( e.button ) {

			case 0:
				mouseAction = this._mouseButtons.LEFT;
				break;
			case 1:
				mouseAction = this._mouseButtons.MIDDLE;
				break;
			case 2:
				mouseAction = this._mouseButtons.RIGHT;
				break;
			default:
				mouseAction = - 1;

		}

		const [ x, y ] = e.position;
		switch ( mouseAction ) {

			case MOUSE.ROTATE:
				if ( this.enableRotate ) {

					this._handleRotateStart( x, y );
					this._state = STATE.ROTATE;

				}

				break;
			case MOUSE.PAN:
				this._handlePanStart( x, y );
				this._state = STATE.PAN;
				break;
			default:
				this._state = STATE.NONE;

		}

	}

	_onMouseMove( evts ) {

		const time = evts[ 0 ].time;
		const [ x, y ] = evts[ 0 ].position;

		switch ( this._state ) {

			case STATE.ROTATE:
				if ( this.enableRotate ) {

					this._handleRotateMove( x, y );
					this._fireCameraChangeEvent( time );

				}

				break;
			case STATE.PAN:
				this._handlePanMove( x, y );
				this._fireCameraChangeEvent( time );
				break;

		}

	}

	_onWheel( e ) {

		const { camera, picker, frameState, mode, container, boundingBox } = this.viewer.scene;
		const position = camera.getView().destination;

		const delta = e.deltaY;
		const normalized_delta = Math.abs( delta ) / ( 100 * ( window.devicePixelRatio | 0 ) );
		let scale = Math.pow( 0.95, normalized_delta * this.zoomSpeed );
		let factor = 0;
		if ( delta < 0 ) { // zoom in

			factor = 0.05;

		} else if ( delta > 0 ) { // zoom out

			factor = - 0.05;
			scale = 1 / scale;

			// 限制缩放范围
			const center = boundingBox.getCenter( new Vector3() );
			if ( center.distanceTo( position ) > this.maxDistance ) return;

		}

		const [ x, y ] = e.position;
		if ( mode === '2d' ) {

			const zoomCenter = picker.pickScenePosition( { x, y } );
			position.lerp( zoomCenter, factor * this.zoomSpeed );
			position.z = Math.max( position.z, this.minDistance );

		} else {

			this._zoomMouse.x = ( x / container.clientWidth ) * 2 - 1;
			this._zoomMouse.y = - ( y / container.clientHeight ) * 2 + 1;

			if ( camera.frustumType === 'perspective' ) {

				const minDistance = boundingBox.isEmpty() ? 0 : boundingBox.min.distanceTo( boundingBox.max ) * 0.01;
				let distance = 0;
				const pickPos = picker.pickPosition( { x, y } );
				if ( pickPos ) {

					distance = pickPos.distanceTo( position ) + minDistance;

				} else {

					distance = boundingBox.isEmpty() ? position.length() : boundingBox.distanceToPoint( position ) + minDistance;

				}

				const zoomDirection = camera.getPickRayDirection( this._zoomMouse );
				this._zoomOffset.copy( zoomDirection ).multiplyScalar( distance * factor * this.zoomSpeed );
				position.add( this._zoomOffset );

			} else {

				// 调整相机 position. TODO: 需要优化 (切换到透视相机后, 相机位置会偏移)
				const mouseBefore = new Vector3( this._zoomMouse.x, this._zoomMouse.y, 0 );
				mouseBefore.unproject( camera );

				camera.width *= scale;
				camera.updateProjectionMatrix();

				const mouseAfter = new Vector3( this._zoomMouse.x, this._zoomMouse.y, 0 );
				mouseAfter.unproject( camera );

				position.sub( mouseAfter ).add( mouseBefore );

			}

		}

		camera.setView( { destination: position } );
		frameState.viewChangeType = ViewChangeType.ZOOM;
		frameState.viewZoomType = delta < 0 ? ViewZoomType.ZOOM_IN : ViewZoomType.ZOOM_OUT;

		this._fireCameraChangeEvent( e.time );

	}

	_onTouchStart( evts ) {

		switch ( evts.length ) {

			case 1:
				switch ( this._touches.ONE ) {

					case TOUCH.ROTATE:
						break;
					case TOUCH.PAN:
						const [ x, y ] = evts[ 0 ].position;
						this._handlePanStart( x, y );
						this._state = STATE.TOUCH_PAN;
						break;
					default:
						this._state = STATE.NONE;

				}

				break;
			case 2:
				switch ( this._touches.TWO ) {

					case TOUCH.DOLLY_PAN:
						// 计算中心点
						const x = ( evts[ 0 ].position[ 0 ] + evts[ 1 ].position[ 0 ] ) / 2;
						const y = ( evts[ 0 ].position[ 1 ] + evts[ 1 ].position[ 1 ] ) / 2;
						this._handlePanStart( x, y );
						this._handleDollyStart( evts );
						this._state = STATE.TOUCH_DOLLY_PAN;
						break;
					default:
						this._state = STATE.NONE;

				}

				break;

		}

	}

	_onTouchMove( evts ) {

		let x, y;
		if ( evts.length === 2 ) {

			// 计算中心点
			x = ( evts[ 0 ].position[ 0 ] + evts[ 1 ].position[ 0 ] ) / 2;
			y = ( evts[ 0 ].position[ 1 ] + evts[ 1 ].position[ 1 ] ) / 2;

		} else {

			x = evts[ 0 ].position[ 0 ];
			y = evts[ 0 ].position[ 1 ];

		}

		const time = evts[ 0 ].time;

		switch ( this._state ) {

			case STATE.ROTATE:
				this._handleRotateMove( x, y );
				this._fireCameraChangeEvent( time );
				break;
			case STATE.TOUCH_PAN:
				this._handlePanMove( x, y );
				this._fireCameraChangeEvent( time );
				break;
			case STATE.TOUCH_DOLLY_PAN:
				this._handlePanMove( x, y );
				this._handleDollyMove( evts );
				this._fireCameraChangeEvent( time );
				break;
			default:
				this._state = STATE.NONE;

		}

	}

	_handleRotateStart( x, y ) {

		this._rotateStart.set( x, y );

		const { picker, boundingBox } = this.viewer.scene;
		const pickPos = picker.pickPosition( { x, y } );
		if ( pickPos ) {

			this._rotateCursor.copy( pickPos );

		} else {

			boundingBox.getCenter( this._rotateCursor );

		}

	}

	_handleRotateMove( x, y ) {

		const { camera } = this.viewer.scene;
		camera.stopFlight();

		this._rotateEnd.set( x, y );
		this._rotateDelta.subVectors( this._rotateEnd, this._rotateStart ).multiplyScalar( this.rotateSpeed );
		this._rotateStart.copy( this._rotateEnd );

		const isHorizontal = Math.abs( this._rotateDelta.x ) >= Math.abs( this._rotateDelta.y );

		// 计算旋转角度
		const { clientWidth, clientHeight } = this.viewer.container;
		const theta = 2 * Math.PI * this._rotateDelta.x / clientWidth;
		const phi = 2 * Math.PI * this._rotateDelta.y / clientHeight;

		const position = camera.getView().destination;

		if ( isHorizontal ) {

			// 水平方向旋转以 this._rotateCursor 为中心点绕 z 轴旋转

			// const quat = new Quaternion().setFromAxisAngle(camera.up, -theta);
			const quat = new Quaternion().setFromAxisAngle( this.constrainedAxis, - theta );

			this._offset.subVectors( position, this._rotateCursor ).applyQuaternion( quat );
			position.copy( this._rotateCursor ).add( this._offset );

			camera.lookDirection.applyQuaternion( quat );
			camera.up.applyQuaternion( quat );
			// 修正 up. 注意归一化, 否则会存在精度误差
			camera.rightDirection.crossVectors( camera.up, camera.lookDirection ).normalize();
			camera.up.crossVectors( camera.lookDirection, camera.rightDirection ).normalize();
			camera.applyQuaternion( quat ); // camera.quaternion.premultiply(quat);
			camera.setView( { destination: position } );

		} else {

			// 垂直方向旋转以 this._rotateCursor 为中心点绕 camera.right 轴旋转

			// console.log(camera.rightDirection.toArray());
			const quat = new Quaternion().setFromAxisAngle( camera.rightDirection, - phi );

			this._offset.subVectors( position, this._rotateCursor ).applyQuaternion( quat );
			position.copy( this._rotateCursor ).add( this._offset );

			camera.lookDirection.applyQuaternion( quat );
			camera.up.applyQuaternion( quat );
			// 修正 up. 注意归一化, 否则会存在精度误差
			camera.rightDirection.crossVectors( camera.up, camera.lookDirection ).normalize();
			camera.up.crossVectors( camera.lookDirection, camera.rightDirection ).normalize();
			camera.applyQuaternion( quat ); // camera.quaternion.premultiply(quat);
			camera.setView( { destination: position } );

		}

	}

	_handlePanStart( x, y ) {

		this._panStart.set( x, y );

	}

	_handlePanMove( x, y ) {

		this.viewer.scene.camera.stopFlight();

		this._panEnd.set( x, y );
		this._panDelta.subVectors( this._panEnd, this._panStart ).multiplyScalar( this.panSpeed );
		this._panStart.copy( this._panEnd );

		/* 相机平移计算 */

		const { container, camera, frameState, boundingBox } = this.viewer.scene;
		const { clientWidth, clientHeight } = container;
		const { x: deltaX, y: deltaY } = this._panDelta;
		const position = camera.getView().destination;

		let distanceLeft, distanceUp;
		if ( camera.frustumType === 'orthographic' ) {

			distanceLeft = ( deltaX * ( camera.width ) ) / clientWidth;
			distanceUp = ( deltaY * ( camera.width / camera.aspect ) ) / clientHeight;

		} else {

			const minDistance = boundingBox.isEmpty() ? 0 : boundingBox.min.distanceTo( boundingBox.max ) * 0.06;
			const distance = boundingBox.isEmpty() ? position.length() : boundingBox.distanceToPoint( position ) + minDistance;

			const targetDistance = distance * Math.tan( ( camera.fov / 2 ) * Math.PI / 180 );
			distanceLeft = 2 * deltaX * targetDistance / clientWidth;
			distanceUp = 2 * deltaY * targetDistance / clientHeight;

		}

		// pan left/right
		this._panVec3.setFromMatrixColumn( camera.matrix, 0 ); // get x column
		this._panVec3.multiplyScalar( - distanceLeft );
		this._panOffset.add( this._panVec3 );

		// pan up/down
		this._panVec3.setFromMatrixColumn( camera.matrix, 1 ); // get y column
		this._panVec3.multiplyScalar( distanceUp );
		this._panOffset.add( this._panVec3 );

		position.add( this._panOffset );
		this._panOffset.set( 0, 0, 0 );
		camera.setView( { destination: position } );
		frameState.viewChangeType = ViewChangeType.MOVE;

	}

	_handleDollyStart( evts ) {

		const [ x0, y0 ] = evts[ 0 ].position;
		const [ x1, y1 ] = evts[ 1 ].position;
		const dx = x0 - x1;
		const dy = y0 - y1;
		this._dolly = Math.sqrt( dx * dx + dy * dy );

	}

	_handleDollyMove( evts ) {

		const [ x0, y0 ] = evts[ 0 ].position;
		const [ x1, y1 ] = evts[ 1 ].position;
		const dx = x0 - x1;
		const dy = y0 - y1;
		const distance = Math.sqrt( dx * dx + dy * dy );

		const { camera, picker, container, frameState } = this.viewer.scene;
		const { clientWidth } = container;
		const eye = camera.getView().destination;

		if ( camera.frustumType === 'orthographic' ) {

			const position = picker.pickScenePosition( { x: ( x0 + x1 ) / 2, y: ( y0 + y1 ) / 2 } );
			const factor = ( distance - this._dolly ) / clientWidth;
			// const factor = (distance - _dolly) * 0.005;

			eye.lerp( position, factor * this.zoomSpeed );
			eye.z = Math.max( eye.z, this.minDistance );

			camera.setView( { destination: eye } );
			frameState.viewChangeType = ViewChangeType.ZOOM;

		}

		this._dolly = distance;

	}

	_fireCameraChangeEvent( time ) {

		// 设置触发事件的时间间隔
		if ( time - this._lastFireTime < 15 ) return;
		this._lastFireTime = time;

		this.dispatchEvent( {
			type: 'cameraControlChange',
			view: this.viewer.scene.camera.getView()
		} );

	}

	destroy() {

		this._removeEvents();

	}

}

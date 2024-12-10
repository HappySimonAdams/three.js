import { EventDispatcher } from '../../../build/three.module.js';
import { expandBox } from '../common/expandBox.js';
import { InputManager } from './input/InputManager.js';
import { CameraControl } from './CameraControl.js';
import { Scene } from './Scene.js';


export class Viewer extends EventDispatcher {

	/**
	 * @param {object} options
	 * @param {HTMLElement} options.container
	 * @param {boolean} [options.useLogDepth] 是否使用log深度。默认为false
	 * @param {string} [options.mode] 模式。可选值：'2d'、'3d'。默认为'3d'
	 */
	constructor( options ) {

		super();

		this.parentContainer = options.container;

		this.container = document.createElement( 'div' );
		this.container.style.cssText = 'position: relative; width: 100%; height: 100%; background-color: transparent; outline: none; touch-action: none; user-select: none; -webkit-user-select: none;';
		this.parentContainer.appendChild( this.container );

		// NOTE: 创建对象有先后顺序

		this.scene = new Scene( this, options );
		this.input = new InputManager( this );
		this.control = new CameraControl( this );

	}

	zoomToCenter( options ) {

		const box = this.scene.boundingBox;
		if ( box.isEmpty() ) {

			console.warn( '用于视角定位的包围盒为空' );
			return;

		}

		const { scalar = 1, duration = 600, complete } = options || {};
		const newScalar = this._adjustZoomScalar( scalar );
		let destination;
		if ( newScalar !== 1 ) {

			destination = box.clone();
			expandBox( box, newScalar );

		} else {

			destination = box;

		}

		this.scene.cameraViewQueue.addView( { destination, duration, complete } );

	}

	_adjustZoomScalar( scalar ) {

		const { clientWidth, clientHeight } = this.container;
		const ratio = clientWidth / clientHeight;
		if ( ratio <= 1 ) {

			return scalar * ratio;

		} else {

			return scalar;

		}

	}

	destroy() {

		this.control.destroy();
		this.input.destroy();
		this.scene.destroy();

		if ( this.parentContainer ) {

			// this.container.innerHTML = '';
			this.parentContainer.removeChild( this.container );

		}

	}

}

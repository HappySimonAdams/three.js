import { Box3, Scene as ThreeScene } from '../../../build/three.module.js';
import { Group as TweenGroup } from '../../../examples/jsm/libs/tween.module.js';
import { Background } from './background/Background.js';
import { ViewChangeType } from './enums/ViewChangeType.js';
import { AxesPrimitive } from './primitives/AxesPrimitive.js';
import { PrimitiveCollection } from './primitives/PrimitiveCollection.js';
import { Camera } from './Camera.js';
import { CameraViewQueue } from './CameraViewQueue.js';
import { Context } from './Context.js';
import { FrameState } from './FrameState.js';
import { Picker } from './Picker.js';
import { Renderer } from './Renderer.js';
import { Stats } from './Stats.js';

export class Scene extends ThreeScene {

	constructor( viewer, options ) {

		super();

		const { useLogDepth = false, mode = '3d' } = options;

		this.viewer = viewer;
		this.container = viewer.container;

		this.useLogDepth = useLogDepth;
		this.mode = mode;

		// NOTE: 创建对象有先后顺序

		this.tweens = new TweenGroup();
		this.primitives = new PrimitiveCollection();

		this.background = new Background( this );
		this.primitives.add( this.background );

		this._bgColor = '#333333';
		this._bgAlpha = 1;

		this.camera = new Camera( this );
		this.cameraViewQueue = new CameraViewQueue( this.camera );

		this.renderer = new Renderer( this );
		this.renderer.setAnimationLoop( this._tick.bind( this ) );

		this.context = new Context( this );
		this.frameState = new FrameState( this );

		this.picker = new Picker( this );

		this.boundingBox = new Box3();

		this._highlightColor = '#00eeee';

		this._enableFxaa = false;

		this.requestRenderMode = true;
		this._renderRequested = false;

		this._debugShowStats = false;
		this._stats = null;
		this._debugShowAxes = false;
		this._axes = null;

	}

	get bgColor() {

		return this._bgColor;

	}

	set bgColor( value ) {

		if ( value === this._bgColor ) return;
		this._bgColor = value;
		this.renderer.setClearColor( this._bgColor, this._bgAlpha );
		this.requestRender();

	}

	get bgAlpha() {

		return this._bgAlpha;

	}

	set bgAlpha( value ) {

		if ( value === this._bgAlpha ) return;
		this._bgAlpha = value;
		this.renderer.setClearColor( this._bgColor, this._bgAlpha );
		this.requestRender();

	}

	get highlightColor() {

		return this._highlightColor;

	}

	set highlightColor( value ) {

		if ( value === this._highlightColor ) return;
		this._highlightColor = value;
		this.requestRender();

	}

	get enableFxaa() {

		return this._enableFxaa;

	}

	set enableFxaa( value ) {

		if ( value === this._enableFxaa ) return;
		this._enableFxaa = value;
		this.renderer.enableFxaa = value;
		this.requestRender();

	}

	get canvas() {

		return this.renderer.domElement;

	}

	get debugShowStats() {

		return this._debugShowStats;

	}

	set debugShowStats( value ) {

		if ( value === this._debugShowStats ) return;
		this._debugShowStats = value;

		if ( ! this._stats ) {

			this._stats = new Stats( this.container );

		}

		this._stats.setVisible( value );

	}

	get debugShowAxes() {

		return this._debugShowAxes;

	}

	set debugShowAxes( value ) {

		if ( this._debugShowAxes === value ) return;
		this._debugShowAxes = value;

		if ( ! this._axes ) {

			this._axes = new AxesPrimitive( 10000000 );
			this.primitives.add( this._axes );
			this.requestRender();

		}

		this._axes.visible = value;

	}

	_tick( time ) {

		const deltaTime = time - this._lastTime;
		if ( deltaTime < 10 ) return;
		this._lastTime = time;

		this._autoResize();

		this.cameraViewQueue.update();
		this.tweens.update();

		this._render( time );

		if ( this._stats ) {

			this._stats.update();

		}

	}

	_autoResize() {

		const { clientWidth: pWidth, clientHeight: pHeight } = this.viewer.parentContainer;
		// FIX: Framebuffer is incomplete: Attachment has zero size
		if ( pWidth === 0 || pHeight === 0 ) return;

		// NOTE: width、height 是 bufferWidth、bufferHeight，与 clientWidth、clientHeight 不一定相等
		const { width, height } = this.renderer.domElement;
		const dpr = window.devicePixelRatio;
		const tolerance = 1 * dpr;

		if ( Math.abs( width - pWidth * dpr ) > tolerance || Math.abs( height - pHeight * dpr ) > tolerance ) {

			this.container.style.width = pWidth + 'px';
			this.container.style.height = pHeight + 'px';
			this.camera.resize( pWidth, pHeight );
			this.renderer.resize( pWidth, pHeight );
			this.requestRender();
			this.dispatchEvent( { type: 'resize' } );

		}

	}

	_render( time = undefined ) {

		this.dispatchEvent( { type: 'preUpdate' } );

		const { frameState, primitives, camera } = this;
		frameState.newFrame = false;

		if ( time === undefined ) {

			time = performance.now();

		}

		const shouldRender = ! this.requestRenderMode || this._renderRequested;
		if ( shouldRender ) {

			this._lastRenderTime = time;
			frameState.newFrame = true;

		}

		primitives.preUpdate( frameState );

		if ( shouldRender ) {

			// 通过改变相机视角进行的渲染更新
			if ( camera.viewChange ) {

				this.dispatchEvent( { type: 'preViewChange' } );

			}

			this.dispatchEvent( { type: 'preRender' } );

			this.background.update( frameState );
			this.primitives.update( frameState );
			this.renderer.draw();

			// 添加视角变化的事件 (减少函数调用次数)
			if ( camera.viewChange ) {

				this.dispatchEvent( { type: 'postViewChange' } );
				camera.viewChange = false;
				frameState.viewChangeType = ViewChangeType.NONE; // 重置
				// frameState.viewZoomType = ViewZoomType.NONE; // 可以不用重置

			}

			// NOTE: 在最后设置, 避免在回调函数中调用 scene.requestRender()
			this._renderRequested = false;

		}

		primitives.postUpdate( frameState );
		// Resource.update();
		this.dispatchEvent( { type: 'postUpdate' } );

		// Functions are queued up during primitive update and executed here in case the function modifies scene state that should remain constant over the frame.
		const functions = frameState.afterRender;
		for ( let i = 0, length = functions.length; i < length; ++ i ) {

			const shouldRequestRender = functions[ i ]();
			if ( shouldRequestRender ) {

				this.requestRender();

			}

		}

		functions.length = 0;

		if ( shouldRender ) {

			this.dispatchEvent( { type: 'postRender' } );

		}

	}

	requestRender() {

		this._renderRequested = true;

	}

	destroy() {

		this.background.destroy();
		this.primitives.destroy();
		this.frameState.destroy();
		this.context.destroy();
		this.tweens.removeAll();

		this.children.length = 0;

		this.renderer.destroy();

		if ( this._stats ) {

			this._stats.destroy();

		}

	}

}

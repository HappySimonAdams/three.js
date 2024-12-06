import { AlphaFormat, ByteType, Cache, /* ColorManagement,  */DataTexture, DepthFormat, DepthStencilFormat, FloatType, HalfFloatType, IntType, LinearToneMapping, LuminanceAlphaFormat, LuminanceFormat, NearestFilter, RedFormat, RedIntegerFormat, RGBAFormat, RGBAIntegerFormat, RGFormat, RGIntegerFormat, ShortType, UnsignedByteType, UnsignedInt248Type, UnsignedIntType, UnsignedShort4444Type, UnsignedShort5551Type, UnsignedShortType, Vector2, WebGLRenderer, WebGLRenderTarget } from '../../../build/three.module.js';
import { EffectComposer } from '../../../examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from '../../../examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from '../../../examples/jsm/postprocessing/RenderPass.js';
import { arrayEquals } from '../common/arrayEquals.js';
import { PrimitivePostPass } from './postprocessing/PrimitivePostPass.js';
import { FxaaPass } from './postprocessing/FxaaPass.js';

// NOTE: threejs r152 版本颜色变化. @see https://discourse.threejs.org/t/updates-to-color-management-in-three-js-r152/50791
// ColorManagement.enabled = false;

/**
 * 3D模式（模型场景）
 * 使用 MRT 实现 color+depth+pickId
 *   depth 用于通过 GPU 拾取深度值来计算坐标
 *   不采用 camera.setViewOffset() 的方式进行 GPU 拾取的原因是: 后处理需要用到 pickId 帧缓冲
 *   不能使用 MSAA, 因为 MSAA 会导致拾取的 pickId 不准确
 */
export class Renderer extends WebGLRenderer {

	constructor( scene ) {

		super( {
			logarithmicDepthBuffer: scene.useLogDepth,
		} );

		this.scene = scene;

		this.sortObjects = false;
		this.autoClear = false;
		this.toneMapping = LinearToneMapping;
		this.info.autoReset = false;

		const { clientWidth, clientHeight } = scene.container;
		this.setPixelRatio( window.devicePixelRatio );
		this.setSize( clientWidth, clientHeight );
		scene.container.appendChild( this.domElement );
		// this.domElement.style.touchAction = 'none';

		this._drawingBufferSize = new Vector2();

		this._initComposer();

		this.highlightIdTexture = new DataTexture( new Float32Array( 1 ), 1, 1, RedFormat, FloatType );
		this.highlightCount = 0;
		this.hideIdTexture = new DataTexture( new Float32Array( 1 ), 1, 1, RedFormat, FloatType );
		this.hideCount = 0;
		this.reverseHide = false;
		this.customColorIdTexture = new DataTexture( new Float32Array( 2 ), 1, 1, RGFormat, FloatType );
		this.customColorCount = 0;

	}

	get drawingBufferSize() {

		return this.getDrawingBufferSize( this._drawingBufferSize );

	}

	// IOS14之后的版本不支持
	get supportTextureFloatLinear() {

		return this.extensions.has( 'OES_texture_float_linear' );

	}

	set enableFxaa( value ) {

		this._fxaaPass.enabled = value;

	}

	_initComposer() {

		const { x: bufferWidth, y: bufferHeight } = this.drawingBufferSize;
		if ( this.supportTextureFloatLinear ) {

			this.renderTarget = new WebGLRenderTarget( bufferWidth, bufferHeight, {
				minFilter: NearestFilter,
				magFilter: NearestFilter,
				count: 2,
			} );
			this.renderTarget.textures[ 0 ].name = 'color';
			this.renderTarget.textures[ 0 ].type = UnsignedByteType;
			this.renderTarget.textures[ 1 ].name = 'depth-pick';
			this.renderTarget.textures[ 1 ].type = FloatType;

		} else {

			this.renderTarget = new WebGLRenderTarget( bufferWidth, bufferHeight, {
				minFilter: NearestFilter,
				magFilter: NearestFilter,
				count: 2,
			} );
			this.renderTarget.textures[ 0 ].name = 'color';
			this.renderTarget.textures[ 0 ].type = UnsignedByteType;
			this.renderTarget.textures[ 1 ].name = 'depth-pick';
			this.renderTarget.textures[ 1 ].type = HalfFloatType;

		}

		// 初始化时 this.renderTarget 对应 composer.writeBuffer
		// Pass.needsSwap 默认值为 true, 即每次渲染完一个 pass 后会交换 readBuffer 与 writeBuffer
		this._composer = new EffectComposer( this, this.renderTarget );
		this._composer.setPixelRatio( 1 );

		/** 将clearColor设置为vec4(0.0)，方便与拾取值进行区分。但会导致背景色为完全透明 (使用 {@link Background} 处理背景色) */
		const renderPass = new RenderPass( this.scene, this.scene.camera, null, 0x000000, 0 );
		this._composer.addPass( renderPass );

		this.primitivePostPass = new PrimitivePostPass( this.scene );
		this._composer.addPass( this.primitivePostPass );

		this._fxaaPass = new FxaaPass();
		this._fxaaPass.clear = true;
		this._fxaaPass.enabled = false;
		this._composer.addPass( this._fxaaPass );

		// 最后一个pass可以只输出1个framebuffer
		this._outputPass = new OutputPass();
		this._composer.addPass( this._outputPass );

	}

	resize( width, height ) {

		this.setSize( width, height );
		const { x: bufferWidth, y: bufferHeight } = this.drawingBufferSize;
		this.renderTarget.setSize( bufferWidth, bufferHeight );
		this._composer.setSize( bufferWidth, bufferHeight ); // 内部会调用 renderTarget.setSize() 与 pass.setSize()

	}

	draw() {

		this._composer.render();

	}

	/**
     * 读取MRT像素值
     */
	readMultipleRenderTargetPixels( renderTarget, x, y, width, height, buffer, activeTextureIndex ) {

		const { properties, state, capabilities } = this;
		const _gl = this.getContext();
		const _currentRenderTarget = this.getRenderTarget();

		const framebuffer = properties.get( renderTarget ).__webglFramebuffer;

		if ( framebuffer ) {

			state.bindFramebuffer( _gl.FRAMEBUFFER, framebuffer );

			try {

				const texture = renderTarget.textures[ activeTextureIndex ];
				const textureFormat = texture.format;
				const textureType = texture.type;

				if ( ! capabilities.textureFormatReadable( textureFormat ) ) {

					console.error( 'THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.' );
					return;

				}

				if ( ! capabilities.textureTypeReadable( textureType ) ) {

					console.error( 'THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.' );
					return;

				}

				// the following if statement ensures valid read requests (no out-of-bounds pixels, see #8604)
				if ( ( x >= 0 && x <= ( renderTarget.width - width ) ) && ( y >= 0 && y <= ( renderTarget.height - height ) ) ) {

					// NOTE: https://stackoverflow.com/questions/62478052/webgl-readpixels-with-multiple-render-targets
					// https://stackoverflow.com/questions/52427194/equivalent-of-gl-readbuffergl-color-attachmentx-in-webgl-1-0
					if ( this.isWebGL2 ) {

						_gl.readBuffer( _gl.COLOR_ATTACHMENT0 + activeTextureIndex );

					} else {

						const framebuffer = _gl.createFramebuffer();
						_gl.bindFramebuffer( _gl.FRAMEBUFFER, framebuffer );
						_gl.framebufferTexture2D( _gl.FRAMEBUFFER, _gl.COLOR_ATTACHMENT0, _gl.TEXTURE_2D, properties.get( texture ).__webglTexture, 0 );

					}

					_gl.readPixels( x, y, width, height, this._convertFormat( textureFormat ), this._convertType( textureType ), buffer );

				}

			} finally {

				// restore framebuffer of current render target if necessary
				const framebuffer = ( _currentRenderTarget !== null ) ? properties.get( _currentRenderTarget ).__webglFramebuffer : null;
				state.bindFramebuffer( _gl.FRAMEBUFFER, framebuffer );

			}

		} else {

			console.warn( 'framebuffer为undefined, 无法读取像素值' );

		}

	}

	// @see WebGLUtils
	_convertFormat( p ) {

		const gl = this.getContext();

		if ( p === AlphaFormat ) return gl.ALPHA;
		if ( p === RGBAFormat ) return gl.RGBA;
		if ( p === LuminanceFormat ) return gl.LUMINANCE;
		if ( p === LuminanceAlphaFormat ) return gl.LUMINANCE_ALPHA;
		if ( p === DepthFormat ) return gl.DEPTH_COMPONENT;
		if ( p === DepthStencilFormat ) return gl.DEPTH_STENCIL;

		if ( p === RedFormat ) return gl.RED;
		if ( p === RedIntegerFormat ) return gl.RED_INTEGER;
		if ( p === RGFormat ) return gl.RG;
		if ( p === RGIntegerFormat ) return gl.RG_INTEGER;
		if ( p === RGBAIntegerFormat ) return gl.RGBA_INTEGER;

		// if "p" can't be resolved, assume the user defines a WebGL constant as a string (fallback/workaround for packed RGB formats)
		return ( gl[ p ] !== undefined ) ? gl[ p ] : null;

	}

	// @see WebGLUtils
	_convertType( p ) {

		const gl = this.getContext();

		if ( p === UnsignedByteType ) return gl.UNSIGNED_BYTE;
		if ( p === UnsignedShort4444Type ) return gl.UNSIGNED_SHORT_4_4_4_4;
		if ( p === UnsignedShort5551Type ) return gl.UNSIGNED_SHORT_5_5_5_1;
		if ( p === ByteType ) return gl.BYTE;
		if ( p === ShortType ) return gl.SHORT;
		if ( p === UnsignedShortType ) return gl.UNSIGNED_SHORT;
		if ( p === IntType ) return gl.INT;
		if ( p === UnsignedIntType ) return gl.UNSIGNED_INT;
		if ( p === FloatType ) return gl.FLOAT;
		if ( p === HalfFloatType ) {

			if ( this.isWebGL2 ) return gl.HALF_FLOAT;
			const extension = this.extensions.get( 'OES_texture_half_float' );
			if ( extension !== null ) {

				return extension.HALF_FLOAT_OES;

			} else {

				return null;

			}

		}

		if ( UnsignedInt248Type ) {

			if ( this.isWebGL2 ) return gl.UNSIGNED_INT_24_8;
			const extension = this.extensions.get( 'WEBGL_depth_texture' );
			if ( extension !== null ) {

				return extension.UNSIGNED_INT_24_8_WEBGL;

			} else {

				return null;

			}

		}

		// if "p" can't be resolved, assume the user defines a WebGL constant as a string (fallback/workaround for packed RGB formats)
		return ( gl[ p ] !== undefined ) ? gl[ p ] : null;

	}


	setHighlight( ids ) {

		if ( ids.length === 0 ) {

			this.clearHighlight();
			return;

		}

		const dataArray = this.highlightIdTexture.source.data.data;
		if ( dataArray && arrayEquals( ids, dataArray ) ) return;

		const count = ids.length;
		if ( count === dataArray.length ) {

			this.highlightIdTexture.source.data.data.set( ids );
			this.highlightIdTexture.needsUpdate = true;

		} else {

			this.highlightIdTexture.dispose();
			this.highlightIdTexture.source = null;
			this.highlightIdTexture = new DataTexture( new Float32Array( ids ), count, 1, RedFormat, FloatType );
			this.highlightIdTexture.needsUpdate = true;

		}

		this.highlightCount = count;
		this.scene.requestRender();

	}

	clearHighlight() {

		if ( this.highlightCount === 0 ) return;

		const dataArray = this.highlightIdTexture.source.data.data;
		if ( ! dataArray ) return;

		// 只修改值为0, 不改变纹理的size
		for ( let i = 0; i < dataArray.length; i ++ ) {

			dataArray[ i ] = 0;

		}

		this.highlightIdTexture.needsUpdate = true;
		this.highlightCount = 0;
		this.scene.requestRender();

	}

	/**
	 * @param {*} reverse 反向设置隐藏的id (隐藏其他未设置的图元)
	 */
	setHide( ids, reverse = false ) {

		if ( ids.length === 0 ) {

			this.clearHide();
			return;

		}

		const dataArray = this.hideIdTexture.source.data.data;
		if ( dataArray && arrayEquals( ids, dataArray ) ) return;

		const count = ids.length;
		if ( count === dataArray.length ) {

			this.hideIdTexture.source.data.data.set( ids );
			this.hideIdTexture.needsUpdate = true;

		} else {

			this.hideIdTexture.dispose();
			this.hideIdTexture.source = null;
			this.hideIdTexture = new DataTexture( new Float32Array( ids ), count, 1, RedFormat, FloatType );
			this.hideIdTexture.needsUpdate = true;

		}

		this.hideCount = count;
		this.reverseHide = reverse;
		this.scene.requestRender();

	}

	clearHide() {

		if ( this.hideCount === 0 ) return;

		const dataArray = this.hideIdTexture.source.data.data;
		if ( ! dataArray ) return;

		for ( let i = 0; i < dataArray.length; i ++ ) {

			dataArray[ i ] = 0;

		}

		this.hideIdTexture.needsUpdate = true;
		this.hideCount = 0;
		this.reverseHide = false;
		this.scene.requestRender();

	}

	/**
	 * @param {number[]} ids [pickId, colorNumber, ...]
	 */
	setCustomColor( ids ) {

		if ( ids.length === 0 ) {

			this.clearCustomColor();
			return;

		}

		const dataArray = this.customColorIdTexture.source.data.data;
		if ( dataArray && arrayEquals( ids, dataArray ) ) return;

		const count = ids.length;
		if ( count === dataArray.length ) {

			this.customColorIdTexture.source.data.data.set( ids );
			this.customColorIdTexture.needsUpdate = true;

		} else {

			this.customColorIdTexture.dispose();
			this.customColorIdTexture.source = null;
			this.customColorIdTexture = new DataTexture( new Float32Array( ids ), count / 2, 1, RGFormat, FloatType );
			this.customColorIdTexture.needsUpdate = true;

		}

		this.customColorCount = count / 2;
		this.scene.requestRender();

	}

	clearCustomColor() {

		if ( this.customColorCount === 0 ) return;

		const dataArray = this.customColorIdTexture.source.data.data;
		if ( ! dataArray ) return;

		for ( let i = 0; i < dataArray.length; i ++ ) {

			dataArray[ i ] = 0;

		}

		this.customColorIdTexture.needsUpdate = true;
		this.customColorCount = 0;
		this.scene.requestRender();

	}

	destroy() {

		this.renderTarget.dispose();
		this._composer.dispose();

		this.primitivePostPass.dispose();
		this._fxaaPass.dispose();
		this._outputPass.dispose();

		this.highlightIdTexture.dispose();
		this.hideIdTexture.dispose();
		this.customColorIdTexture.dispose();

		this.info.reset();
		this.setAnimationLoop( null );
		this.forceContextLoss();
		this.dispose();
		Cache.clear();

	}

}

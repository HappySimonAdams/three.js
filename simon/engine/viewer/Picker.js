import { Box3, Color, DataUtils, FloatType, HalfFloatType, Plane, Raycaster, Sphere, Vector2, Vector3 } from '../../../build/three.module.js';
import { expandBox } from '../common/expandBox.js';

const _bgColor = new Color();
const _pickColor = new Color();

export class Picker {

	constructor( scene ) {

		this.scene = scene;
		this._raycaster = new Raycaster();
		this._plane = new Plane( new Vector3( 0, 0, 1 ), 0 );
		this._box = new Box3();
		this._sphere = new Sphere();
		this._mouse = new Vector2();

	}

	rayPickObject( options ) {

		const { container, camera } = this.scene;
		const { x, y, selectObject = undefined, threshold = 1 } = options;

		this._mouse.x = ( x / container.clientWidth ) * 2 - 1;
		this._mouse.y = - ( y / container.clientHeight ) * 2 + 1;
		this._raycaster.setFromCamera( this._mouse, camera );
		this._raycaster.params.Points.threshold = threshold;
		this._raycaster.params.Line.threshold = threshold;

		selectObject = selectObject || this.scene.children;

		if ( Array.isArray( selectObject ) ) {

			return this._raycaster.intersectObjects( selectObject, true );

		}

		return this._raycaster.intersectObject( selectObject, true );

	}

	/**
     * 拾取场景坐标 (非图元坐标). CPU拾取
     */
	pickScenePosition( options ) {

		const { container, camera } = this.scene;
		const { x, y } = options;
		this._mouse.x = ( x / container.clientWidth ) * 2 - 1;
		this._mouse.y = - ( y / container.clientHeight ) * 2 + 1;
		this._raycaster.setFromCamera( this._mouse, camera );

		if ( this.scene.mode === '2d' ) {

			return this._raycaster.ray.intersectPlane( this._plane, new Vector3() );

		} else {

			this._box.copy( this.scene.boundingBox ).expandByPoint( camera.position );
			expandBox( this._box, 2 );
			return this._raycaster.ray.intersectBox( this._box, new Vector3() );

		}

	}

	/**
     * 拾取图元坐标. GPU拾取, 通过获取深度值计算坐标
     */
	pickPosition( options ) {

		if ( this.scene.mode === '3d' ) {

			const { renderer, useLogDepth, container, camera } = this.scene;
			options.pickSize = 1;
			const pixels = this._readPixelsMRT( options, renderer.renderTarget, 1 );
			if ( pixels[ 0 ] === 0 && pixels[ 1 ] === 0 && pixels[ 2 ] === 0 && pixels[ 3 ] === 0 ) return;
			// console.log(pixels);
			let depth = pixels[ 0 ];
			if ( depth > 0 && depth < 1 ) {

				if ( useLogDepth ) {

					// transforming logarithmic depth of form
					// log2(z + 1) / log2( far + 1);
					// to perspective form
					// (far - far * near / z) / (far - near)
					const { near, far } = camera;
					const farDepthFromNearPlusOne = far - near + 1;
					const log2Depth = depth * Math.log2( farDepthFromNearPlusOne );
					const depthFromNear = Math.pow( 2, log2Depth ) - 1;
					depth = ( far * ( 1 - near / ( depthFromNear + near ) ) ) / ( far - near );

				}

				const { x, y } = options;
				const result = new Vector3();
				result.x = ( x / container.clientWidth ) * 2 - 1;
				result.y = - ( y / container.clientHeight ) * 2 + 1;
				result.z = depth * 2 - 1; // NOTE: 转换到 NDC 空间
				result.unproject( camera );
				return result;

			}

		}

		return undefined;

	}

	_readPixelsMRT( options, renderTarget, activeTextureIndex = 0 ) {

		const { renderer } = this.scene;
		const { y: bufferHeight } = renderer.drawingBufferSize;
		const { x, y, pickSize = 3 } = options;
		// NOTE: 将屏幕坐标映射到framebuffer坐标
		const newX = x * window.devicePixelRatio;
		const newY = y * window.devicePixelRatio;
		const bias = pickSize / 2;

		const textureType = renderTarget.textures[ activeTextureIndex ].type;
		const length = pickSize * pickSize * 4;
		let pixels;
		if ( textureType === FloatType ) {

			pixels = new Float32Array( length );

		} else if ( textureType === HalfFloatType ) {

			pixels = new Uint16Array( length );

		} else {

			pixels = new Uint8Array( length );

		}

		// 左下角为坐标原点, Y坐标要反转坐标系
		renderer.readMultipleRenderTargetPixels( renderTarget, newX - bias, bufferHeight - newY - bias, pickSize, pickSize, pixels, activeTextureIndex );
		if ( textureType === HalfFloatType ) {

			const float32 = new Float32Array( length );
			for ( let i = 0; i < pixels.length; i ++ ) {

				float32[ i ] = pixels[ i ] === 0 ? 0 : DataUtils.fromHalfFloat( pixels[ i ] );

			}

			return float32;

		} else {

			return pixels;

		}

	}

	/**
     * GPU拾取对象信息
     * 返回多个匹配的对象信息（先按renderType从小到大排序, 再按renderOrder从大到小排序）
     */
	pickObject( options ) {

		const { renderer } = this.scene;
		const pixels = this._readPixelsMRT( options, renderer.renderTarget, 1 );

		const context = this.scene.context;
		let set = new Set();
		let pickId;
		let result;

		_bgColor.set( this.scene.bgColor );

		for ( let i = 0, len = pixels.length; i < len; i += 4 ) {

			// NOTE: 使用MRT时, 像素值为背景色。注意不要使用 _pickColor.equals(_bgColor), 有小数位
			// TODO: _pickColor可能出现 (1, 1, 1) 的情况, 当背景色为白色时会有问题
			_pickColor.set( pixels[ i ], pixels[ i + 1 ], pixels[ i + 2 ] );
			if ( _pickColor.getHex() === _bgColor.getHex() ) continue;

			if ( renderer.supportTextureFloatLinear ) {

				pickId = pixels[ i + 1 ];

			} else {

				// pickId = pixels[ i + 1 ] + ( pixels[ i + 2 ] << 8 );
				pickId = pixels[ i + 1 ] + ( pixels[ i + 2 ] << 11 );

			}

			if ( pickId === 0 || set.has( pickId ) ) continue;
			if ( pickId < 0 ) {

				console.warn( 'pickId小于0' );
				continue;

			}

			const pickObject = context.getPickObject( pickId );
			result = { id: pickId, ...pickObject };

			set.add( pickId );

		}

		set = null;

		return result;

	}

}

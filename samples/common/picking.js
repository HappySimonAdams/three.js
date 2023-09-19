import {
	Raycaster,
	Vector2,
	Vector3,
	Plane,
	WebGLRenderTarget,
	Color,
} from '../../src/Three.js';

const _raycaster = new Raycaster();
const _mouse = new Vector2();
const _plane = new Plane( new Vector3( 0, 0, 1 ), 0 );

const _pickRenderTarget = new WebGLRenderTarget();
const _oldClearColor = new Color();
let _oldClearAlpha;

// CPU拾取
export function rayPick( options ) {

	const { camera, selectObject, x, y, threshold = 1 } = options;

	_mouse.x = ( x / window.innerWidth ) * 2 - 1;
	_mouse.y = - ( y / window.innerHeight ) * 2 + 1;

	_raycaster.setFromCamera( _mouse, camera );
	_raycaster.params.Points.threshold = threshold;
	_raycaster.params.Line.threshold = threshold;

	if ( Array.isArray( selectObject ) ) {

		return _raycaster.intersectObjects( selectObject, true );

	}

	return _raycaster.intersectObject( selectObject, true );

}

// 只拾取坐标
export function rayPickPosition( options ) {

	const { camera, x, y } = options;
	_mouse.x = ( x / window.innerWidth ) * 2 - 1;
	_mouse.y = - ( y / window.innerHeight ) * 2 + 1;
	_raycaster.setFromCamera( _mouse, camera );
	return _raycaster.ray.intersectPlane( _plane, new Vector3() );

}

// GPU拾取。pickSize为奇数，表示拾取像素块的尺寸
export function readPixel( options ) {

	const { camera, renderer, selectObject, x, y, pickSize = 3, pickRenderTarget = undefined } = options;
	const rt = pickRenderTarget || _pickRenderTarget;
	const bias = ( pickSize - 1 ) / 2;

	// 先保存旧的clearColor
	renderer.getClearColor( _oldClearColor );
	_oldClearAlpha = renderer.getClearAlpha();

	// 方式一：renderTarget只有一小块范围
	// camera.setViewOffset(window.innerWidth, window.innerHeight, x - bias, y - bias, pickSize, pickSize);
	// rt.setSize(pickSize, pickSize);
	// renderer.setRenderTarget(rt);
	// renderer.setClearColor(0x000000, 0);
	// renderer.render(selectObject, camera);
	// // 还原
	// renderer.setClearColor(_oldClearColor, _oldClearAlpha);
	// renderer.setRenderTarget(null);
	// camera.clearViewOffset();
	// const pixes = new Uint8Array(pickSize * pickSize * 4);
	// renderer.readRenderTargetPixels(rt, 0, 0, pickSize, pickSize, pixes);
	// return pixes;

	// 方式二：renderTarget包含整个屏幕范围
	rt.setSize( window.innerWidth, window.innerHeight );
	renderer.setRenderTarget( rt );
	renderer.setClearColor( 0x000000, 0 );
	renderer.render( selectObject, camera );
	renderer.setClearColor( _oldClearColor, _oldClearAlpha );
	renderer.setRenderTarget( null );
	const pixes = new Uint8Array( pickSize * pickSize * 4 );
	// 左下角为坐标原点，Y坐标要反转坐标系
	renderer.readRenderTargetPixels( rt, x - bias, window.innerHeight - y - bias, pickSize, pickSize, pixes );
	return pixes;

}

export function gpuPickId( options ) {

	const pixes = readPixel( options );

	// 将4位数转成1位数，即为pickId
	const int32Array = new Int32Array( pixes.buffer );

	let pickId = 0;
	let pickIdColor = [ 0, 0, 0, 0 ];

	for ( let i = 0; i < int32Array.length; i ++ ) {

		pickId = int32Array[ i ];
		// 拾取时，clearColor为: (0, 0, 0, 0)
		if ( pickId !== 0 ) {

			pickIdColor = [ pixes[ i * 4 ], pixes[ i * 4 + 1 ], pixes[ i * 4 + 2 ], pixes[ i * 4 + 3 ] ];
			break;

		}

	}

	return { pickId, pickIdColor };

}

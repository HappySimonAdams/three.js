import {
	FileLoader,
	Loader,
	Path
} from 'three';

class SHXFontLoader extends Loader {

	constructor( manager ) {

		super( manager );

	}

	load( url, onLoad, onProgress, onError ) {

		const loader = new FileLoader( this.manager );
		loader.setPath( this.path );
		loader.setRequestHeader( this.requestHeader );
		loader.setWithCredentials( this.withCredentials );
		loader.setResponseType( 'arraybuffer' );
		loader.load( url, ( buffer ) => {

			const parser = new SHXParser( buffer, onLoad, onError );
			parser.parse();
			if ( onLoad ) onLoad( this.glyphs );

		}, onProgress, onError );

	}

}

const SHXCmdType = {
	END_OF_SHAPE: 0,
	PEN_DOWN: 1,
	PEN_UP: 2,
	DIVIDE_VECTOR: 3,
	MULTIPLY_VECTOR: 4,
	PUSH_STACK: 5,
	POP_STACK: 6,
	DRAW_SUBSHAPE: 7,
	XY_DISPLACEMENT: 8,
	POLY_XY_DISPLACEMENT: 9, // 0, 0 terminated
	OCTANT_ARC: 0xA,
	FRACTIONAL_ARC: 0xB, // 5 bytes: start, end, high, radius, radius, ±0SC
	BULGE_ARC: 0xC, // dx, dy, bulge
	POLY_BULGE_ARC: 0xD, // 0, 0 terminated BULGE_ARC
	COND_MODE_2: 0x0E, // PROCESS this command *only if mode=2*
};

/**
 * @see https://github.com/Kharabadze/SHX_font_converter/blob/main/SHX_font.cpp
 * @see https://github.com/yzylovepmn/YFonts.SHX/blob/master/YFonts.SHX/ShxParser.cs
 * @see https://github.com/paipo/shxpatch/blob/master/source/ShapeFont.cpp
 */
class SHXParser {

	constructor( buffer, onLoad, onError ) {

		console.log( buffer );
		this.dataView = new DataView( buffer );
		this.byteOffset = 0;

		this.onLoad = onLoad;
		this.onError = onError;

		this.format = null; // usually AutoCAD-86
		this.type = null; // shapes, bigfont, unifont
		this.version = null; // usually 1.0

		this.fontName = null;
		this.above = 1; // Distance above baseline for capital letters.
		this.below = null; // Distance below baseline for lowercase letters
		this.mode = null; // # 0 Horizontal Only, 2 Dual mode (Horizontal or Vertical)
		this.encoding = null; // 0 unicode, 1 packed multibyte, 2 shape file
		this.embedded = null; // 0 font can be embedded, 1 font cannot be embedded, 2 embedding is read-only

		this.glyphs = {};
		this.glyphPaths = {};

		this.fontSize = 50;
		this._scale = 1;
		this._horizontal = true;
		this._letter = null;
		this._code = null;
		this._paths = null;
		this._pen = false;
		this._skip = false;
		this._x = 0;
		this._y = 0;
		this._lastX = 0;
		this._lastY = 0;
		this._stack = [];

	}

	parse() {

		const jsonbuffer = new Uint8Array( this.dataView.buffer, 0, 40 );
    	const text = new TextDecoder().decode( jsonbuffer );
		console.log( text );

		// this.parseHeader();

		// switch ( this.type ) {

		// 	case 'shapes':
		// 		this.parseShapes();
		// 		break;
		// 	case 'bigfont':
		// 		// this.parseBigfont();
		// 		break;
		// 	case 'unifont':
		// 		this.parseUnifont();
		// 		break;
		// 	default:
		// 		if ( this.onError ) this.onError( `Unknown SHX file type: ${this.type}` );
		// 		return;

		// }

		// this.parseCode();

	}

	parseHeader() {

		const header = this.readString().split( ' ' );
		console.log( header );
		if ( header.length !== 3 ) {

			if ( this.onError ) this.onError( `Invalid SHX header: ${header}` );
			return;

		}

		this.format = header[ 0 ];
		this.type = header[ 1 ];
		this.version = header[ 2 ];

		// 跳过头部信息后的一些无用字节
		this.byteOffset += 2;

		// const extraInfo = this.readString();
		// console.log( extraInfo );

	}

	readString() {

		try {

			let string = '';

			while ( true ) {

				const c = this.dataView.getUint8( this.byteOffset ++ );
				// 空字符(NULL), 换行(LF \n), 回车(CR \r), 文件结束符(EOF)
				// 0x00 0x0A, 0x0D, 0x1A
				if ( c === 0 || c === 10 || c === 13 || c === 26 ) break;
				string += String.fromCharCode( c );

			}

			return string;

		} catch ( e ) {

			throw new Error( 'Read string did not capture valid text.' );

		}

	}

	parseShapes() {

		const start = this.dataView.getUint16( this.byteOffset, true );
		this.byteOffset += 2;
		const end = this.dataView.getUint16( this.byteOffset, true );
		this.byteOffset += 2;
		const count = this.dataView.getUint16( this.byteOffset, true );
		this.byteOffset += 2;
		console.log( `start: ${start}, end: ${end}, count: ${count}` );

		const glyphData = new Uint32Array( count * 2 );
		for ( let i = 0; i < count; i ++ ) {

			const index = this.dataView.getUint16( this.byteOffset, true );
			this.byteOffset += 2;
			const length = this.dataView.getUint16( this.byteOffset, true );
			this.byteOffset += 2;
			// console.log( `index: ${index}, length: ${length}` );
			glyphData[ i * 2 ] = index;
			glyphData[ i * 2 + 1 ] = length;

		}

		for ( let i = 0; i < count * 2; i += 2 ) {

			const index = glyphData[ i ];
			const length = glyphData[ i + 1 ];

			if ( index === 0 ) {

				if ( this.fontName !== null ) {

					if ( this.onError ) this.onError( 'Double-initializing glyph data detected' );
					return;

				}

				this.fontName = this.readString();
				this.above = this.dataView.getUint8( this.byteOffset );
				this.byteOffset += 1;
				this.below = this.dataView.getUint8( this.byteOffset );
				this.byteOffset += 1;
				this.mode = this.dataView.getUint8( this.byteOffset );
				this.byteOffset += 1;
				console.log( ` fontName: ${this.fontName}, above: ${this.above}, below: ${this.below}, mode: ${this.mode}` );

			} else {

				const buffer = this.dataView.buffer.slice( this.byteOffset, this.byteOffset + length );
				let data = new Uint8Array( buffer );

				if ( data.length !== length ) {

					if ( this.onError ) this.onError( 'Glyph length did not exist in file.' );
					return;

				}

				if ( data[ 0 ] === 0 && data[ 1 ] === 0 ) {

					data = data.slice( 2 );

				} else if ( data[ 0 ] === 0 ) {

					data = data.slice( 1 );
					let find = - 1;

					for ( let i = 0; i < data.length; i ++ ) {

						if ( data[ i ] === 0 ) {

							find = i;
							break;

						}

					}

					if ( find !== - 1 ) {

						let name = '';
						for ( let i = 0; i < find; i ++ ) {

							const c = data[ i ];
							// ASCII A-Z, 0-9, space, &
							if ( ( c >= 65 && c <= 90 ) || ( c >= 48 && c <= 57 ) || c === 32 || c === 38 ) {

								name += String.fromCharCode( c );

							} else {

								name = null;
								break;

							}

						}

						if ( name !== null ) {

							// console.log( 'name:', name );
							data = data.slice( find + 1 );
							this.glyphs[ name ] = data;

						} else {

							// console.log( data, 'did not contain a name.' );

						}

					}

				}

				this.glyphs[ index ] = data;
				// this.glyphs[ String.fromCharCode( index ) ] = String.fromCharCode( ...data );
				this.byteOffset += length;

			}

		}

		console.log( this.glyphs );

	}

	parseUnifont() {

		const count = this.dataView.getUint32( this.byteOffset, true );
		this.byteOffset += 4;
		const length = this.dataView.getUint16( this.byteOffset, true );
		this.byteOffset += 2;
		console.log( `count: ${count}, length: ${length}` );

		// this.byteOffset = 5; // 从第6个字节重新开始读取
		this.byteOffset = 0;
		this.fontName = this.readString();
		console.log( 'fontName:', this.fontName );

		this.above = this.dataView.getUint8( this.byteOffset ++ );
		this.below = this.dataView.getUint8( this.byteOffset ++ );
		this.mode = this.dataView.getUint8( this.byteOffset ++ );
		this.encoding = this.dataView.getUint8( this.byteOffset ++ );
		// this.embedded = this.dataView.getUint8( this.byteOffset ++ );
		// const ignore = this.dataView.getUint8( this.byteOffset ++ );
		// this.byteOffset += 1;
		console.log( `above: ${this.above}, below: ${this.below}, mode: ${this.mode}, encoding: ${this.encoding}, embedded: ${this.embedded}` );

		const buffer = this.dataView.buffer;
		for ( let i = 0; i < count; i ++ ) {

			const index = this.dataView.getUint16( this.byteOffset, true );
			this.byteOffset += 2;
			const length = this.dataView.getUint16( this.byteOffset, true );
			this.byteOffset += 2;
			// console.log( `index: ${index}, length: ${length}` );
			const data = new Uint8Array( buffer.slice( this.byteOffset, this.byteOffset + length ) );
			this.glyphs[ index ] = data;
			// this.glyphs[ String.fromCharCode( index ) ] = String.fromCharCode( ...data );
			this.byteOffset += length;

		}

		console.log( 'byteOffset:', this.byteOffset );
		console.log( 'glyphs:', this.glyphs );

	}

	parseCode() {

		this._scale = this.fontSize / this.above;

		for ( const index in this.glyphs ) {

			this._letter = String.fromCharCode( index );
			console.log( `letter: ${this._letter}` );
			this._code = [ ...this.glyphs[ index ] ].reverse();
			console.log( 'code:', this._code );

			this._paths = [];
			this.glyphPaths[ this._letter ] = this._paths;

			this._pen = true;

			while ( this._code.length > 0 ) {

				const c = this.pop();
				const direction = c & 0x0F;
				const length = ( c & 0xF0 ) >> 4;
				if ( length === 0 ) {

					this.parseCodeSpecial( direction );

				} else {

					this.parseCodeLength( direction, length );

				}

			}

			console.log( 'paths:', this._paths );

			this._skip = false;

		}

		console.log( this.glyphPaths );

	}

	pop() {

		if ( this._code.length === 0 ) {

			throw new Error( 'No codes to pop().' );

		}

		return this._code.pop();

	}

	parseCodeLength( direction, length ) {

		if ( this._skip ) {

			this._skip = false;
			return;

		}

		let dx, dy;
		if ( [ 2, 1, 0, 0xF, 0xE ].includes( direction ) ) {

			dx = 1.0;

		} else if ( [ 3, 0xD ].includes( direction ) ) {

			dx = 0.5;

		} else if ( [ 4, 0xC ].includes( direction ) ) {

			dx = 0.0;

		} else if ( [ 5, 0xB ].includes( direction ) ) {

			dx = - 0.5;

		} else { // 6, 7, 8, 9, 0xa

			dx = - 1.0;

		}

		if ( [ 6, 5, 4, 3, 2 ].includes( direction ) ) {

			dy = 1.0;

		} else if ( [ 7, 1 ].includes( direction ) ) {

			dy = 0.5;

		} else if ( [ 8, 0 ].includes( direction ) ) {

			dy = 0.0;

		} else if ( [ 9, 0xF ].includes( direction ) ) {

			dy = - 0.5;

		} else { // 0xa, 0xb, 0xc, 0xd, 0xe, 0xf

			dy = - 1.0;

		}

		this._x += dx * length * this._scale;
		this._y += dy * length * this._scale;
		if ( this._pen ) {

			this._paths.push( [ this._lastX, this._lastY, this._x, this._y ] ); // line

		} else {

			this._paths.push( [ this._x, this._y ] ); // moveTo

		}

		this._lastX = this._x;
		this._lastY = this._y;

	}

	parseCodeSpecial( special ) {

		console.log( `special: ${special}` );

		switch ( special ) {

			case SHXCmdType.END_OF_SHAPE:
				this.endOfShape();
				break;
			case SHXCmdType.PEN_DOWN:
				this.penDown();
				break;
			case SHXCmdType.PEN_UP:
				this.penUp();
				break;
			case SHXCmdType.DIVIDE_VECTOR:
				this.divideVector();
				break;
			case SHXCmdType.MULTIPLY_VECTOR:
				this.multiplyVector();
				break;
			case SHXCmdType.PUSH_STACK:
				console.log( 'PUSH_STACK' );
				this.pushStack();
				break;
			case SHXCmdType.POP_STACK:
				console.log( 'POP_STACK' );
				this.popStack();
				break;
			case SHXCmdType.DRAW_SUBSHAPE:
				this.drawSubShape();
				break;
			case SHXCmdType.XY_DISPLACEMENT:
				// console.log( 'XY_DISPLACEMENT' );
				this.xyDisplacement();
				break;
			case SHXCmdType.POLY_XY_DISPLACEMENT:
				// console.log( 'POLY_XY_DISPLACEMENT' );
				this.polyXYDisplacement();
				break;
			case SHXCmdType.OCTANT_ARC:
				// console.log( 'OCTANT_ARC' );
				this.octantArc();
				break;
			case SHXCmdType.FRACTIONAL_ARC:
				// console.log( 'FRACTIONAL_ARC' );
				this.fractionalArc();
				break;
			case SHXCmdType.BULGE_ARC:
				// console.log( 'BULGE_ARC' );
				this.bulgeArc();
				break;
			case SHXCmdType.POLY_BULGE_ARC:
				// console.log( 'POLY_BULGE_ARC' );
				this.polyBulgeArc();
				break;
			case SHXCmdType.COND_MODE_2:
				console.log( 'COND_MODE_2' );
				this.condMode2();
				break;

		}

	}

	endOfShape() {

		try {

			while ( this.pop() !== 0 ) {}

		} catch ( err ) {}

		if ( this._skip ) {

			this._skip = false;
			return;

		}

		this._paths.push( null ); // new path

	}

	penDown() {

		if ( this._skip ) {

			this._skip = false;
			return;

		}

		this._pen = true;
		this._paths.push( [ this._x, this._y ] ); // moveTo

	}

	penUp() {

		if ( this._skip ) {

			this._skip = false;
			return;

		}

		this._pen = false;

	}

	divideVector() {

		const factor = this.pop();
		if ( factor === 0 ) {

			throw new Error( 'Divide Vector is not permitted to be 0.' );

		}

		if ( this._skip ) {

			this._skip = false;
			return;

		}

		this._scale /= factor;

	}

	multiplyVector() {

		const factor = this.pop();
		if ( factor === 0 ) {

			throw new Error( 'Divide Vector is not permitted to be 0.' );

		}

		if ( this._skip ) {

			this._skip = false;
			return;

		}

		this._scale *= factor;

	}

	/**
	 * Stack is considered four units deep.
	 * Everything pushed on the stack must be popped from the stack.
	 * Overflows respond with an error message.
	 */
	pushStack() {

		if ( this._skip ) {

			this._skip = false;
			return;

		}

		this._stack.push( [ this._x, this._y ] );
		console.log( 'pushStack:', this._stack );
		if ( this._stack.length === 4 ) {

			throw new Error( `Position stack overflow in shape ${this._letter}` );

		}

	}

	/**
	 * Stack is considered four units deep.
	 * You may not pop more locations than have been pushed onto the stack.
	 * Attempts to do so will respond with a error message.
	 */
	popStack() {

		if ( this._skip ) {

			this._skip = false;
			return;

		}

		try {

			console.log( 'popStack:', this._stack );
			[ this._x, this._y ] = this._stack.pop();

		} catch ( err ) {

			throw new Error( `Position stack underflow in shape ${this._letter}` );

		}

		this._paths.push( [ this._x, this._y ] ); // moveTo
		this._lastX = this._x;
		this._lastY = this._y;

	}

	drawSubShape() {

		switch ( this.type ) {

			case 'shapes':
				this.drawSubShapeShapes();
				break;
			case 'bigfont':
				this.drawSubShapeBigfont();
				break;
			case 'unifont':
				this.drawSubShapeUnifont();
				break;

		}

	}

	drawSubShapeShapes() {

		const subShape = this.pop();

		if ( this._skip ) {

			this._skip = false;
			return;

		}

		try {

			const shape = this.glyphs[ subShape ];
			this._code = this._code.concat( [ ...shape ].reverse() );

		} catch ( err ) {

			throw new Error( 'Referenced subShape does not exist.' );

		}

	}

	drawSubShapeBigfont() {

		let subShape = this.pop();

		if ( subShape === 0 ) {

			subShape = new Uint16Array( [ this.pop(), this.pop() ] );
			const originX = this.pop() * this._scale;
			const originY = this.pop() * this._scale;
			const width = this.pop() * this._scale;
			const height = this.pop() * this._scale;
			console.log( `Extended Bigfont Glyph: ${subShape}, originX: ${originX}, originY: ${originY}, width: ${width}, height: ${height}` );

		}

		if ( this._skip ) {

			this._skip = false;
			return;

		}

		try {

			const shape = this.glyphs[ subShape ];
			this._code = this._code.concat( [ ...shape ].reverse() );

		} catch ( err ) {

			throw new Error( 'Referenced subShape does not exist.' );

		}

	}

	drawSubShapeUnifont() {

		const subShape = new Uint16Array( [ this.pop(), this.pop() ] );

		if ( this._skip ) {

			this._skip = false;
			return;

		}

		try {

			const shape = this.glyphs[ subShape ];
			this._code = this._code.concat( [ ...shape ].reverse() );

		} catch ( err ) {

			throw new Error( 'Referenced subShape does not exist.' );

		}

	}

	/**
	 * X,Y displacement given in next two bytes 1 byte-x, 1 byte-y.
	 * The displacement ranges from -128 to +127.
	 */
	xyDisplacement() {

		let [ dx, dy ] = new Int8Array( [ this.pop(), this.pop() ] );
		dx *= this._scale;
		dy *= this._scale;

		if ( this._skip ) {

			this._skip = false;
			return;

		}

		this._x += dx;
		this._y += dy;
		if ( this._pen ) {

			this._paths.push( [ this._lastX, this._lastY, this._x, this._y ] ); // line

		} else {

			this._paths.push( [ this._x, this._y ] ); // moveTo

		}

		this._lastX = this._x;
		this._lastY = this._y;

	}

	/**
	 * XY displacement in a series terminated with (0, 0)
	 */
	polyXYDisplacement() {

		while ( true ) {

			let [ dx, dy ] = new Int8Array( [ this.pop(), this.pop() ] );
			dx *= this._scale;
			dy *= this._scale;

			if ( dx === 0 && dy === 0 ) {

				console.log( 'POLY_XY_DISPLACEMENT (Terminated)' );
				break;

			}

			if ( this._skip ) continue;

			this._x += dx;
			this._y += dy;
			if ( this._pen ) {

				this._paths.push( [ this._lastX, this._lastY, this._x, this._y ] ); // line

			} else {

				this._paths.push( [ this._x, this._y ] ); // moveTo

			}

			this._lastX = this._x;
			this._lastY = this._y;

		}

		if ( this._skip ) {

			this._skip = false;

		}

	}

	/**
	 * Octant arc spans one or more 45° octants starting and ending at a boundary.
	 * Octants are numbered ccw starting from 0° at the 3 o'clock position.
	 *
	 * 3 2 1
     *  ⍀ /
     * 4-O-0
     *  / \
     * 5 6 7
	 *
	 * First byte specifies the radius as a value from 1 to 255.
	 * The second is the direction of the arc.
	 * Each nibble of the second byte defines s and c the start and the span.
	 */
	octantArc() {

		const radius = this.pop() * this._scale;
		const sc = new Int8Array( this.pop() )[ 0 ];
		let s = ( sc >> 4 ) & 0x7;
		let c = sc & 0x7;

		if ( this._skip ) {

			this._skip = false;
			return;

		}

		const octant = 2 * Math.PI / 8;
		const ccw = ( sc >> 7 ) & 1;
		if ( c === 0 ) {

			c = 8;

		}

		if ( ccw ) {

			s = - s;

		}

		const startAngle = s * octant;
		const endAngle = ( c + s ) * octant;
		const midAngle = ( startAngle + endAngle ) / 2;
		// negative radius in the direction of start_octent finds center.
		const cx = this._x - radius * Math.cos( startAngle );
		const cy = this._y - radius * Math.sin( startAngle );
		const mx = cx + radius * Math.cos( midAngle );
		const my = cy + radius * Math.sin( midAngle );
		this._x = cx + radius * Math.cos( endAngle );
		this._y = cy + radius * Math.sin( endAngle );
		if ( this._pen ) {

			this._paths.push( [ this._lastX, this._lastY, mx, my, this._x, this._y ] ); // arc

		} else {

			this._paths.push( [ this._x, this._y ] ); // moveTo

		}

		this._lastX = this._x;
		this._lastY = this._y;

	}

	/**
	 * Fractional Arc.
     * Octant Arc plus fractional bits 0-255 parts of 45°
     * 55° -> (55 - 45) * (256 / 45) = 56 (octent 1)
     * 45° + (56/256 * 45°) = 55°
     * 95° -> (95 - 90) * (256 / 45) = 28 (octent 2)
     * 90° + (28/256 * 45°) = 95°
	 */
	fractionalArc() {

		const octant = 2 * Math.PI / 8;
		const startOffset = octant * this.pop() / 256;
		const endOffset = octant * this.pop() / 256;
		const radius = ( this.pop() * 256 + this.pop() ) * this._scale;
		const sc = new Int8Array( this.pop() )[ 0 ];
		let s = ( sc >> 4 ) & 0x7;
		let c = sc & 0x7;

		if ( this._skip ) {

			this._skip = false;
			return;

		}

		const ccw = ( sc >> 7 ) & 1;
		if ( c === 0 ) {

			c = 8;

		}

		if ( ccw ) {

			s = - s;

		}

		const startAngle = startOffset + ( s * octant );
		const endAngle = ( c + s ) * octant + endOffset;
		const midAngle = ( startAngle + endAngle ) / 2;
		const cx = this._x - radius * Math.cos( startAngle );
		const cy = this._y - radius * Math.sin( startAngle );
		const mx = cx + radius * Math.cos( midAngle );
		const my = cy + radius * Math.sin( midAngle );
		this._x = cx + radius * Math.cos( endAngle );
		this._y = cy + radius * Math.sin( endAngle );
		if ( this._pen ) {

			this._paths.push( [ this._lastX, this._lastY, mx, my, this._x, this._y ] ); // arc

		} else {

			this._paths.push( [ this._x, this._y ] ); // moveTo

		}

		this._lastX = this._x;
		this._lastY = this._y;

	}

	/**
	 * Arc defined by xy and displacement bulge. 1-byte-X, 1-byte-Y, 1-byte-bulge.
	 *
	 * This gives us X from -127 to +127 and Y from -127 to +127.
	 * The bulge height is given as 127  * 2 * H / D If the sign is negative the location is clockwise.
	 */
	bulgeArc() {

		const [ dx, dy, h ] = new Int8Array( [ this.pop(), this.pop(), this.pop() ] );
		if ( this._skip ) {

			this._skip = false;
			return;

		}

		const r = Math.abs( Math.sqrt( dx * dx, dy * dy ) ) / 2;
		const bulge = h / 127.0;
		const bx = this._x + ( dx / 2 );
		const by = this._y + ( dy / 2 );
		const bulgeAngle = Math.atan2( dy, dx ) - 2 * Math.PI / 4;
		const mx = bx + r * bulge * Math.cos( bulgeAngle );
		const my = by + r * bulge * Math.sin( bulgeAngle );
		this._x += dx;
		this._y += dy;

		if ( this._pen ) {

			if ( bulge === 0 ) {

				this._paths.push( [ this._lastX, this._lastY, this._x, this._y ] ); // line

			} else {

				this._paths.push( [ this._lastX, this._lastY, mx, my, this._x, this._y ] ); // arc

			}

		} else {

			this._paths.push( [ this._x, this._y ] ); // moveTo

		}

		this._lastX = this._x;
		this._lastY = this._y;

	}

	/**
	 * Similar to bulge but repeated, until X and Y are (0,0).
	 */
	polyBulgeArc() {

		let h = 0;
		while ( true ) {

			const [ dx, dy ] = new Int8Array( [ this.pop(), this.pop() ] );
			if ( dx === 0 && dy === 0 ) {

				console.log( 'POLY_BULGE_ARC (Terminated)' );
				break;

			}

			h = new Int8Array( [ this.pop() ] )[ 0 ];
			if ( this._skip ) continue;
			const r = Math.abs( Math.sqrt( dx * dx, dy * dy ) ) / 2;
			const bulge = h / 127.0;
			const bx = this._x + ( dx / 2 );
			const by = this._y + ( dy / 2 );
			const bulgeAngle = Math.atan2( dy, dx ) - 2 * Math.PI / 4;
			const mx = bx + r * bulge * Math.cos( bulgeAngle );
			const my = by + r * bulge * Math.sin( bulgeAngle );
			this._x += dx;
			this._y += dy;
			if ( this._pen ) {

				if ( bulge === 0 ) {

					this._paths.push( [ this._lastX, this._lastY, this._x, this._y ] ); // line

				} else {

					this._paths.push( [ this._lastX, this._lastY, mx, my, this._x, this._y ] ); // arc

				}

			} else {

				this._paths.push( [ this._x, this._y ] ); // moveTo

			}

			this._lastX = this._x;
			this._lastY = this._y;

		}

		if ( this._skip ) {

			this._skip = false;

		}

	}

	/**
	 * Process the next command only in vertical text.
	 */
	condMode2() {

		if ( this.mode === 2 && this._horizontal ) {

			console.log( 'SKIP NEXT' );
			this._skip = true;

		}

	}

}


class SHXFont {

	constructor( data ) {

		this.data = data;

	}

}

export { SHXFontLoader, SHXFont };

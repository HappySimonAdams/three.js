import { Color } from '../../../build/three.module.js';

const _scratchColor = new Color();

/**
 * Packs the RGBA into a single integer
 */
export function packColorToNumber( color ) {

	_scratchColor.set( color );
	const red = ( _scratchColor.r * 255 ) | 0;
	const green = ( _scratchColor.g * 255 ) | 0;
	const blue = ( _scratchColor.b * 255 ) | 0;
	// return red + green * 256 + blue * 65536;
	return ( blue << 16 ) | ( green << 8 ) | red;

}

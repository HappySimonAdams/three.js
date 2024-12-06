import { Vector3 } from '../../../build/three.module.js';

const _size = new Vector3();
const _center = new Vector3();

/**
 * @param box 需要扩展的包围盒
 * @param scalar 扩展的比例
 */
export function expandBox( box, scalar ) {

	box.getSize( _size );
	box.getCenter( _center );
	_size.multiplyScalar( scalar );
	box.setFromCenterAndSize( _center, _size );

}

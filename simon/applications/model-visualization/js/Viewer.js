import { Vector3 } from '../../../../build/three.module.js';
import { Viewer as ViewerCore } from '../../../engine/index.js';

/**
 * 模型资产可视化Viewer
 */
export class Viewer extends ViewerCore {

	constructor( options ) {

		super( options );

		this.scene.camera.setView( {
			destination: new Vector3( 0, - 100, 100 / 2 ),
			target: new Vector3( 0, 0, 0 ),
			up: new Vector3( 0, 0, 1 )
		} );

	}

}

import { Shape, Vector3 } from '../../../../build/three.module.js';
import { Viewer as ViewerCore } from '../../../engine/index.js';
import { Interacter } from './Interacter.js';
import { ShopePrimitive } from './ShopePrimitive.js';
import { ShopePrimitiveCollection } from './ShopePrimitiveCollection.js';

/**
 * 商场可视化Viewer
 */
export class Viewer extends ViewerCore {

	constructor( options ) {

		super( options );

		this.scene.camera.setView( {
			destination: new Vector3( 0, - 100, 100 / 2 ),
			target: new Vector3( 0, 0, 0 ),
			up: new Vector3( 0, 0, 1 )
		} );

		this.interacter = new Interacter( this );

		this.json = null;
		this.floorPrimitivesMap = {};
		this.activedPrimitives = null;

	}

	async loadData( url ) {

		const response = await fetch( url );
		const result = await response.json();
		this.json = result.shopes;
		// console.log( 'loadData() json:', this.json );

		// 默认显示第一层的店铺
		this.showFloor( Object.keys( this.json )[ 0 ] );

	}

	showFloor( floorName ) {

		let primitives = this.floorPrimitivesMap[ floorName ];
		if ( primitives ) {

			if ( primitives === this.activedPrimitives ) return;

		} else {

			primitives = new ShopePrimitiveCollection();
			primitives.name = floorName;
			this.scene.primitives.add( primitives );
			this.floorPrimitivesMap[ floorName ] = primitives;

		}

		if ( this.activedPrimitives ) {

			this.activedPrimitives.visible = false;

		}

		this.activedPrimitives = primitives;
		primitives.visible = true;

		const { floor, data } = this.json[ floorName ];
		data.forEach( ( { id, points, height = 1 } ) => {

			const primitive = new ShopePrimitive( {
				id: `${floor}-${id}`,
				shape: new Shape( points ),
				extrudeOptions: { depth: height },
				color: 0xcccccc,
			} );
			primitive.setPosition( 0, 0, floor * 2 ); // 根据楼层设置高度位置
			primitives.add( primitive );

		} );

		this.scene.requestRender();

	}

	destroy() {

		super.destroy();
		this.interacter.destroy();

		this.json = null;
		this.floorPrimitivesMap = null;

	}

}

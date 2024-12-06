import { Box3 } from '../../../../build/three.module.js';
import { RenderPrimitive } from '../../../engine/index.js';

export class ShopePrimitiveCollection extends RenderPrimitive {

	constructor() {

		super();

		this.children = [];
		this.boundingBox = new Box3();

	}

	add( primitive ) {

		this.children.push( primitive );

		return primitive;

	}

	remove( primitive, destroy = true ) {

		const index = this.children.indexOf( primitive );
		if ( index !== - 1 ) {

			destroy && primitive.destroy();
			this.children.splice( index, 1 );
			return true;

		}

		return false;

	}

	update( frameState ) {

		if ( ! this.visible ) return;

		this.boundingBox.makeEmpty();

		for ( let i = 0; i < this.children.length; i ++ ) {

			const primitive = this.children[ i ];
			primitive.update( frameState );

			if ( primitive.boundingBox ) {

				this.boundingBox.union( primitive.boundingBox );

			}

		}

	}

	destroy() {

		this.children.forEach( ( primitive ) => primitive.destroy() );
		this.children.length = 0;

	}

}

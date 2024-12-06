
export class PrimitiveCollection {

	constructor() {

		this.children = [];

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

	preUpdate( frameState ) {

		for ( let i = 0; i < this.children.length; i ++ ) {

			this.children[ i ].preUpdate( frameState );

		}

	}

	update( frameState, primitives = undefined ) {

		// 先清空渲染队列
		frameState.renderList.length = 0;

		const { boundingBox } = frameState.scene;
		boundingBox.makeEmpty();

		if ( ! primitives ) {

			primitives = this.children;

		}

		for ( let i = 0; i < primitives.length; i ++ ) {

			const primitive = primitives[ i ];
			primitive.update( frameState );

			if ( primitive.boundingBox ) {

				boundingBox.union( primitive.boundingBox );

			}

		}

		// 手动排序 (renderer.sortObjects = false)
		frameState.renderList.sort( ( a, b ) => a.renderOrder - b.renderOrder );
		// 设置渲染队列
		frameState.scene.children = frameState.renderList;

	}

	postUpdate( frameState ) {

		for ( let i = 0; i < this.children.length; i ++ ) {

			this.children[ i ].postUpdate( frameState );

		}

	}

	destroy() {

		this.children.forEach( ( primitive ) => primitive.destroy() );
		this.children.length = 0;

	}

}

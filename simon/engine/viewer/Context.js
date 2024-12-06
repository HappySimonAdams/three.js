export class Context {

	constructor( scene ) {

		this.scene = scene;

		/**
		 * 全局自增的gpu拾取id，从1开始
		 */
		this.pickId = 1;

		this._pickObjects = {};
		this._combinedPickObjects = {};
    	this._nextPickColor = new Uint32Array( 1 );

	}

	createPickId( object ) {

		// 增量和赋值必须是单独的语句，才能实际检测到Uint32值中的溢出
		++ this._nextPickColor[ 0 ];
		const id = this._nextPickColor[ 0 ];
		if ( id === 0 ) {

			// In case of overflow
			throw new Error( 'RuntimeError: Out of unique Pick IDs.' );

		}

		this._pickObjects[ id ] = object;
		return id;

	}

	/* createCombinedPickId( object, pickId = undefined ) {

		let id;

		if ( pickId !== undefined ) {

			id = pickId;

		} else {

			id = ++ this.pickId;

		}

		if ( ! this._combinedPickObjects[ id ] ) {

			this._combinedPickObjects[ id ] = object;

		} else {

			this._combinedPickObjects[ id ].push( object );

		}

		return id;

	} */

	getPickObject( pickId ) {

		return this._pickObjects[ pickId ];

	}

	destroy() {

		this._pickObjects = null;
		this._combinedPickObjects = null;
		this._nextPickColor = null;

	}

}

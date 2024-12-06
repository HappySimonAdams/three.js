export class Interacter {

	constructor( viewer ) {

		this.viewer = viewer;

		this._onPointerUp = this._onPointerUp.bind( this );
		viewer.input.pointer.addEventListener( 'pointerup', this._onPointerUp );

		this._pickData = [];

	}

	_onPointerUp( evts ) {

		const { button, ctrlKey, position } = evts[ 0 ];

		if ( button !== 0 ) return;

		const result = this.viewer.scene.picker.pickObject( {
			x: position[ 0 ],
			y: position[ 1 ],
			pickSize: 1
		} );

		if ( result ) {

			if ( ctrlKey ) {

				for ( let i = 0; i < this._pickData.length; i ++ ) {

					if ( this._pickData[ i ].id === result.id ) return;

				}

				this._pickData.push( result );

			} else {

				this._pickData = [ result ];

			}

			this.viewer.scene.renderer.setHighlight( this._pickData.map( item => item.id ) );
			this.viewer.dispatchEvent( { type: 'pick', data: this._pickData } );

		} else {

			this._pickData.length = 0;
			if ( ! ctrlKey ) {

				this.viewer.scene.renderer.clearHighlight();
				this.viewer.dispatchEvent( { type: 'pick', data: this._pickData } );

			}

		}

	}

	destroy() {

		this.viewer.input.pointer.removeEventListener( 'pointerup', this._onPointerUp );

	}

}

export class WheelManager {

	constructor( element ) {

		this.element = element;
		this._hadListener = false;
		this._listeners = [];
		this._onWheelEvent = this._onWheelEvent.bind( this );
		this.onFocus();

	}

	_onWheelEvent( e ) {

		// 屏蔽触控板双指默认缩放浏览器页面的行为
		e.preventDefault();

		const rect = this.element.getBoundingClientRect();
		const params = {
			position: [ e.clientX - rect.left, e.clientY - rect.top ],
			deltaX: e.deltaX,
			deltaY: e.deltaY,
			deltaZ: e.deltaZ,
			time: e.timeStamp
		};

		// Make a copy, in case listeners are removed while iterating.
		const array = this._listeners.slice( 0 );
		for ( let i = 0; i < array.length; i ++ ) {

			array[ i ]( params );

		}

	}

	addEventListener( type, listener ) {

		if ( type !== 'wheel' ) return;

		this._listeners.push( listener );

	}

	removeEventListener( type, listener ) {

		if ( type !== 'wheel' ) return;

		const index = this._listeners.indexOf( listener );
		index !== - 1 && this._listeners.splice( index, 1 );

	}

	onFocus() {

		if ( this._hadListener ) return;
		this.element.addEventListener( 'wheel', this._onWheelEvent, { passive: false } );
		this._hadListener = true;

	}

	onBlur() {

		if ( ! this._hadListener ) return;
		this.element.removeEventListener( 'wheel', this._onWheelEvent );
		this._hadListener = false;

	}

	destroy() {

		this.onBlur();

	}

}

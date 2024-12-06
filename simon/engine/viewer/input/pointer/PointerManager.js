
export class PointerManager {

	constructor( element ) {

		this.element = element;
		this.element.oncontextmenu = () => {

			return false;

		};

		this._hadListener = false;
    	this._listenersMap = {};
    	this._pointers = [];
    	// pointerId 对应的绝对像素坐标
    	this._pointerPositions = {};

		this._onPointerEvent = this._onPointerEvent.bind( this );
		this.onFocus();

	}

	_onPointerEvent( e ) {

		e.stopPropagation();

		const target = e.target;
		const { tagName } = target;

		// 过滤表单控件
		if ( target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || tagName === 'BUTTON' ) return;

		/* 处理pointerdown */
		if ( e.type === 'pointerdown' ) {

			this.element.focus();
			if ( e.pointerType === 'touch' ) {

				this._pointers.push( e );

			} else {

				target.setPointerCapture( e.pointerId );

			}

		}

		/* 事件派发 */
		this._dispatchEvents( e );

		/* 处理pointerup */
		if ( e.type === 'pointerup' ) {

			if ( e.pointerType === 'touch' ) {

				for ( let i = 0; i < this._pointers.length; i ++ ) {

					if ( this._pointers[ i ].pointerId === e.pointerId ) {

						this._pointers.splice( i, 1 );
						break;

					}

				}

				delete this._pointerPositions[ e.pointerId ];

			} else {

				target.releasePointerCapture( e.pointerId );

			}

		}

		// NOTE: 移动端系统默认退出时不会触发 pointerup 事件
		if ( e.type === 'pointercancel' ) {

			if ( e.pointerType === 'touch' ) {

				for ( let i = 0; i < this._pointers.length; i ++ ) {

					if ( this._pointers[ i ].pointerId === e.pointerId ) {

						this._pointers.splice( i, 1 );
						break;

					}

				}

				delete this._pointerPositions[ e.pointerId ];

			}

		}

	}

	_dispatchEvents( e ) {

		const listeners = this._listenersMap[ e.type ];
		if ( ! listeners || listeners.length === 0 ) return;

		// 移动端需要先按下才能触发 move 事件, pc端需要能一直触发 move 事件
		const pointers = e.pointerType === 'touch' ? this._pointers : [ e ];
		const params = [];
		const rect = this.element.getBoundingClientRect();

		// 同步pointer位置（fix：手指移动时位置没有更新）
		this._pointerPositions[ e.pointerId ] = [ e.clientX - rect.left, e.clientY - rect.top ];

		for ( let i = 0; i < pointers.length; i ++ ) {

			params.push( {
				position: this._pointerPositions[ pointers[ i ].pointerId ],
				pointerType: e.pointerType,
				target: e.target,
				time: e.timeStamp,
				// e.button 在 pointerdown 与 pointerup 时值一样
				// e.buttons 在 pointerdown 与 pointerup 时值不一样
				// 详见 PointerButton 枚举
				button: e.button,
				altKey: e.altKey,
				ctrlKey: e.ctrlKey,
				shiftKey: e.shiftKey,
				metaKey: e.metaKey,
			} );

		}

		// Make a copy, in case listeners are removed while iterating.
		let array = listeners.slice( 0 );
		for ( let i = 0; i < array.length; i ++ ) {

			array[ i ].fn( params );

		}

		array = null;

	}

	/**
     * @param emitOrder 事件的触发顺序, 0表示先触发
     */
	addEventListener( type, listener, emitOrder = 0 ) {

		if ( ! this._listenersMap[ type ] ) {

			this._listenersMap[ type ] = [];

		}

		const listeners = this._listenersMap[ type ];
		for ( let i = 0; i < listeners.length; i ++ ) {

			if ( listeners[ i ].fn == listener ) return;

		}

		listeners.push( { fn: listener, emitOrder } );
		listeners.sort( ( a, b ) => a.emitOrder - b.emitOrder );

	}

	removeEventListener( type, listener ) {

		const listeners = this._listenersMap[ type ];
		if ( listeners === undefined ) return;
		for ( let i = 0; i < listeners.length; i ++ ) {

			if ( listeners[ i ].fn == listener ) {

				listeners.splice( i, 1 );
				break;

			}

		}

	}

	onFocus() {

		if ( this._hadListener ) return;
		this.element.addEventListener( 'pointerdown', this._onPointerEvent );
		this.element.addEventListener( 'pointermove', this._onPointerEvent );
		this.element.addEventListener( 'pointerup', this._onPointerEvent );
		this.element.addEventListener( 'pointercancel', this._onPointerEvent );
		this._hadListener = true;

	}

	onBlur() {

		if ( ! this._hadListener ) return;
		this.element.removeEventListener( 'pointerdown', this._onPointerEvent );
		this.element.removeEventListener( 'pointermove', this._onPointerEvent );
		this.element.removeEventListener( 'pointerup', this._onPointerEvent );
		this.element.removeEventListener( 'pointercancel', this._onPointerEvent );
		this._hadListener = false;
		this._pointers.length = 0;
		this._pointerPositions = Object.create( null );

	}

	destroy() {

		this.onBlur();

		this._pointers = null;
		this._pointerPositions = null;

	}

}

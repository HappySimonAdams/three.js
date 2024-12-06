import { Keys } from './Keys.js';
import { getKeys } from './keyUtils.js';

const _modifierKeys = [ 'ctrlKey', 'altKey', 'shiftKey', 'metaKey' ];

const _modifierMap = {
	shiftKey: 'shift',
	ctrlKey: 'ctrl',
	altKey: 'alt',
	metaKey: 'meta',
};

export class KeyboardManager {

	constructor( element ) {

		this.element = element;
		// Need to set tabIndex to make the element focus.
		this.element.tabIndex = element.tabIndex;
		this.element.focus();
		// NOTE: 避免触发浏览器默认快捷键后导致触发引擎的快捷键时失效
		// eg. 按F1后导致Esc按键失效
		this.element.onblur = () => {

			this._keyDownList.length = 0;
			this._keyUpList.length = 0;

		};

		this._hadListener = false;
		this._keyDownList = [];
		this._keyUpList = [];
		this._handlers = {};

		// 默认组合键的分割符为'+'
		this.splitKey = '+';

		this._onKeyDown = this._onKeyDown.bind( this );
		this._onKeyUp = this._onKeyUp.bind( this );
		this.onFocus();

	}

	_onKeyDown( e ) {

		// 过滤表单控件
		const target = e.target;
		const { tagName } = target;
		if ( target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' ) return;

		let key = Keys[ e.code ];

		if ( e.altKey && key === 'e' ) {

			e.preventDefault();

		}

		// 按下修饰键时不做处理
		if ( key === 'alt' || key === 'ctrl' || key === 'shift' || key === 'meta' ) return;

		let index = this._keyDownList.indexOf( key );
		if ( index === - 1 ) {

			this._keyDownList.push( key );

		}

		// 特殊处理修饰键（只有当先按下修饰键时，其他键按下才生效。eg. 避免先按s再按ctrl同样生效的情况）
		_modifierKeys.forEach( ( keyName ) => {

			key = _modifierMap[ keyName ];
			index = this._keyDownList.indexOf( key );

			if ( e[ keyName ] && index === - 1 ) {

				this._keyDownList.push( key );

			} else if ( ! e[ keyName ] && index > - 1 ) {

				this._keyDownList.splice( index, 1 );

			} else if ( keyName === 'metaKey' && e[ keyName ] && this._keyDownList.length === 3 ) {

				// FIX: if Command is pressed
				if ( ! ( e.ctrlKey || e.shiftKey || e.altKey ) ) {

					this._keyDownList = this._keyDownList.slice( index );

				}

			}

		} );

		const handleKey = this._keyDownList.sort().join( '' );
		const handlerList = this._handlers[ handleKey ];
		if ( handlerList ) {

			for ( let i = 0; i < handlerList.length; i ++ ) {

				const handler = handlerList[ i ];
				if ( handler.onkeydown ) {

					handler.onkeydown();

				}

			}

		}

	}

	_onKeyUp( e ) {

		// 过滤表单控件
		const target = e.target;
		const { tagName } = target;
		if ( target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' ) return;

		const key = Keys[ e.code ];
		const index = this._keyDownList.indexOf( key );
		if ( index > - 1 ) {

			// 统一删除修饰键与普通键
			this._keyDownList.splice( index, 1 );

			if ( this._keyUpList.indexOf( key ) === - 1 ) {

				this._keyUpList.push( key );

			}

		}

		if ( this._keyDownList.length === 0 ) {

			const handleKey = this._keyUpList.sort().join( '' );
			const handlerList = this._handlers[ handleKey ];
			if ( handlerList ) {

				for ( let i = 0; i < handlerList.length; i ++ ) {

					const handler = handlerList[ i ];
					if ( handler.onkeyup ) {

						handler.onkeyup();

					}

				}

			}

			this._keyUpList.length = 0;

		}

	}

	addHotkeys( handler ) {

		// 获取(组合)快捷键列表
		const keysList = getKeys( handler.key ); // eg. ['ctrl+a+b']

		let keys;
		for ( let i = 0; i < keysList.length; i ++ ) {

			// 按键列表
			keys = keysList[ i ].split( this.splitKey ); // eg. ['ctrl', 'a', 'b']
			// NOTE: 将外部传入的快捷键统一转为小写
			const handleKey = keys.sort().join( '' ).toLowerCase();
			if ( ! this._handlers[ handleKey ] ) {

				this._handlers[ handleKey ] = [ handler ];

			} else {

				this._handlers[ handleKey ].push( handler );

			}

		}

	}

	removeHotkeys( handler ) {

		const { key, id } = handler;
		const keysList = getKeys( key ); // eg. ['ctrl+a+b']

		for ( let i = 0; i < keysList.length; i ++ ) {

			// 按键列表
			const keys = keysList[ i ].split( this.splitKey ); // eg. ['ctrl', 'a', 'b']
			// NOTE: 将外部传入的快捷键统一转为小写
			const handleKey = keys.sort().join( '' ).toLowerCase();
			const handleList = this._handlers[ handleKey ];
			for ( let j = 0; j < handleList.length; j ++ ) {

				if ( handleList[ j ].id === id ) {

					handleList.splice( j, 1 );

				}

			}

			if ( handleList.length === 0 ) {

				delete this._handlers[ handleKey ];

			}

		}

	}

	onFocus() {

		if ( this._hadListener ) return;
		this.element.addEventListener( 'keydown', this._onKeyDown );
		this.element.addEventListener( 'keyup', this._onKeyUp );
		this._hadListener = true;

	}

	onBlur() {

		if ( ! this._hadListener ) return;
		this.element.removeEventListener( 'keydown', this._onKeyDown );
		this.element.removeEventListener( 'keyup', this._onKeyUp );
		this._hadListener = false;

	}

	destroy() {

		this.onBlur();

		this._keyDownList = null;
		this._handlers = null;

	}

}

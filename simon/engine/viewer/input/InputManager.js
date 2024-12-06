import { KeyboardManager } from './keyboard/KeyboardManager.js';
import { PointerManager } from './pointer/PointerManager.js';
import { WheelManager } from './wheel/WheelManager.js';

/**
 * 鼠标, 键盘等输入交互管理对象
 */
export class InputManager {

	constructor( viewer ) {

		this.viewer = viewer;

		const element = viewer.container;
		this.pointer = new PointerManager( element );
		this.wheel = new WheelManager( element );
		this.keyboard = new KeyboardManager( element );

		this._hotkeysHandlerMap = {};
    	this._handleId = 0;

		// this._onBlur = this._onBlur.bind(this);
		// this._onFocus = this._onFocus.bind(this);
		// window.addEventListener('blur', this._onBlur);
		// window.addEventListener('focus', this._onFocus);

	}

	// _onBlur() {
	//     this.pointer.onBlur();
	//     this.wheel.onBlur();
	//     this.keyboard.onBlur();
	// }

	// _onFocus() {
	//     this.pointer.onFocus();
	//     this.wheel.onFocus();
	//     this.keyboard.onFocus();
	// }

	/**
     * 设置对应功能的快捷键
     */
	setHotkeys( options ) {

		const { command, key, onkeydown, onkeyup } = options;
		let handler = this._hotkeysHandlerMap[ command ];
		if ( handler ) {

			this.keyboard.removeHotkeys( handler );

		}

		handler = {
			id: ++ this._handleId,
			key,
			onkeydown,
			onkeyup,
		};
		this._hotkeysHandlerMap[ command ] = handler;
		this.keyboard.addHotkeys( handler );

	}

	removeHotkeys( command ) {

		const handler = this._hotkeysHandlerMap[ command ];
		if ( handler ) {

			this.keyboard.removeHotkeys( handler );
			delete this._hotkeysHandlerMap[ command ];

		}

	}

	destroy() {

		// window.removeEventListener('blur', this._onBlur);
		// window.removeEventListener('focus', this._onFocus);
		this.pointer.destroy();
		this.wheel.destroy();
		this.keyboard.destroy();

	}

}

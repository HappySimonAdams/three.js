import { Easing, Tween as BaseTween } from '../../../examples/jsm/libs/tween.module.js';

export class Tween extends BaseTween {

	constructor( options ) {

		const { startProps, stopProps, duration, complete } = options;

		super( startProps );

		this.complete = complete;
		this.to( stopProps, duration );
		this.easing( Easing.Quadratic.Out );

	}

}

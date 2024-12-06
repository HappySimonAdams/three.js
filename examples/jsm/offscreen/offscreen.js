import { init, resize } from './scene.js';

self.onmessage = function ( message ) {

	const data = message.data;
	const type = data.type;

	if ( type === 'init' ) {

		init( data.drawingSurface, data.width, data.height, data.pixelRatio, data.path );

	} else if ( type === 'resize' ) {

		resize( data.width, data.height );

	}

};

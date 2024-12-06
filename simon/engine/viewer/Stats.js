class Panel {

	constructor( name, fg, bg ) {

		this.name = name;
		this.fg = fg;
		this.bg = bg;
		this.PR = Math.round( window.devicePixelRatio || 1 );

		this.WIDTH = 80 * this.PR;
		this.HEIGHT = 48 * this.PR;
		this.TEXT_X = 3 * this.PR;
		this.TEXT_Y = 2 * this.PR;
		this.GRAPH_X = 3 * this.PR;
		this.GRAPH_Y = 15 * this.PR;
		this.GRAPH_WIDTH = 74 * this.PR;
		this.GRAPH_HEIGHT = 30 * this.PR;
		this.min = Infinity;
		this.max = 0;

		this.canvas = document.createElement( 'canvas' );
		this.canvas.width = this.WIDTH;
		this.canvas.height = this.HEIGHT;
		this.canvas.style.cssText = 'width:80px; height:48px';

		const context = this.canvas.getContext( '2d' );
		if ( ! context ) {

			throw new Error( 'Engine-log: stats panel canvas context lost' );

		}

		context.font = 'bold ' + ( 9 * this.PR ) + 'px Helvetica,Arial,sans-serif';
		context.textBaseline = 'top';

		context.fillStyle = bg;
		context.fillRect( 0, 0, this.WIDTH, this.HEIGHT );

		context.fillStyle = fg;
		context.fillText( name, this.TEXT_X, this.TEXT_Y );
		context.fillRect( this.GRAPH_X, this.GRAPH_Y, this.GRAPH_WIDTH, this.GRAPH_HEIGHT );

		context.fillStyle = bg;
		context.globalAlpha = 0.9;
		context.fillRect( this.GRAPH_X, this.GRAPH_Y, this.GRAPH_WIDTH, this.GRAPH_HEIGHT );

		this.context = context;

	}

	get dom() {

		return this.canvas;

	}

	update( value, maxValue ) {

		this.min = Math.min( this.min, value );
		this.max = Math.max( this.max, value );

		this.context.fillStyle = this.bg;
		this.context.globalAlpha = 1;
		this.context.fillRect( 0, 0, this.WIDTH, this.GRAPH_Y );
		this.context.fillStyle = this.fg;
		this.context.fillText( Math.round( value ) + ' ' + this.name + ' (' + Math.round( this.min ) + '-' + Math.round( this.max ) + ')', this.TEXT_X, this.TEXT_Y );

		this.context.drawImage( this.canvas, this.GRAPH_X + this.PR, this.GRAPH_Y, this.GRAPH_WIDTH - this.PR, this.GRAPH_HEIGHT, this.GRAPH_X, this.GRAPH_Y, this.GRAPH_WIDTH - this.PR, this.GRAPH_HEIGHT );

		this.context.fillRect( this.GRAPH_X + this.GRAPH_WIDTH - this.PR, this.GRAPH_Y, this.PR, this.GRAPH_HEIGHT );

		this.context.fillStyle = this.bg;
		this.context.globalAlpha = 0.9;
		this.context.fillRect( this.GRAPH_X + this.GRAPH_WIDTH - this.PR, this.GRAPH_Y, this.PR, Math.round( ( 1 - ( value / maxValue ) ) * this.GRAPH_HEIGHT ) );

	}

}

export class Stats {

	constructor( container ) {

		this.container = container;

		this._element = document.createElement( 'div' );
		this._element.style.cssText = 'position: absolute; z-index: 9; left: 0; top: 0; cursor: pointer; opacity: 0.9; user-select: none; -webkit-user-select: none;';
		container.appendChild( this._element );

		this._beginTime = ( performance || Date ).now();
		this._prevTime = this._beginTime;

		this._fpsPanel = new Panel( 'FPS', '#0ff', '#002' );
		this._element.appendChild( this._fpsPanel.dom );

		this._msPanel = new Panel( 'MS', '#0f0', '#020' );
		this._element.appendChild( this._msPanel.dom );

		if ( performance && performance.memory ) {

			this._memPanel = new Panel( 'MB', '#f08', '#201' );
			this._element.appendChild( this._memPanel.dom );

		}

		this._frames = 0;
    	this._mode = 0;

		this._showPanel( 0 );

		this._element.addEventListener( 'click', this._clickHandler = ( e ) => {

			e.preventDefault();
			this._showPanel( ++ this._mode % this._element.children.length );

		} );

	}

	_showPanel( id ) {

		const children = this._element.children;
		for ( let i = 0, len = children.length; i < len; i ++ ) {

			children[ i ].style.display = i === id ? 'block' : 'none';

		}

		this._mode = id;

	}

	update() {

		this._frames ++;

		const time = ( performance || Date ).now();
		this._msPanel.update( time - this._beginTime, 200 );

		if ( time >= this._prevTime + 1000 ) {

			this._fpsPanel.update( ( this._frames * 1000 ) / ( time - this._prevTime ), 100 );
			this._prevTime = time;
			this._frames = 0;

			if ( this._memPanel ) {

				const memory = performance.memory;
				this._memPanel.update( memory.usedJSHeapSize / 1048576, memory.jsHeapSizeLimit / 1048576 );

			}

		}

		this._beginTime = time;

	}

	setVisible( flag ) {

		this._element.style.display = flag ? 'block' : 'none';

	}

	destroy() {

		this._element.removeEventListener( 'click', this._clickHandler );
		if ( this.container ) {

			this.container.removeChild( this._element );

		}

	}

}

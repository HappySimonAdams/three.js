import { BufferGeometry, Float32BufferAttribute, LineSegments } from '../../../../build/three.module.js';
import { disposeAttribute } from '../../common/disposeAttribute.js';
import { RenderOrder } from '../enums/RenderOrder.js';
import { BaseMaterial } from '../materials/BaseMaterial.js';
import { RenderPrimitive } from './RenderPrimitive.js';

export class AxesPrimitive extends RenderPrimitive {

	constructor( size ) {

		super();

		const vertices = [
			0, 0, 0,	size, 0, 0,
			0, 0, 0,	0, size, 0,
			0, 0, 0,	0, 0, size
		];
		const colors = [
			1, 0, 0,	1, 0.6, 0,
			0, 1, 0,	0.6, 1, 0,
			0, 0, 1,	0, 0.6, 1
		];

		const geometry = new BufferGeometry();
		geometry.setAttribute( 'position', new Float32BufferAttribute( vertices, 3 ).onUpload( disposeAttribute ) );
		geometry.setAttribute( 'color', new Float32BufferAttribute( colors, 3 ).onUpload( disposeAttribute ) );

		const material = new BaseMaterial( { vertexColors: true } );

		this.command = new LineSegments( geometry, material );
		this.command.frustumCulled = false;
		this.command.matrixAutoUpdate = false;
		this.command.renderOrder = RenderOrder.BACKGROUND;

	}

	update( frameState ) {

		if ( ! this.visible ) return;

		frameState.renderList.push( this.command );

	}

	destroy() {

		this.command.geometry.dispose();
		this.command.material.dispose();

	}

}

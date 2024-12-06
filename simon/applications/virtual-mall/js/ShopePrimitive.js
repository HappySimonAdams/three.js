import { ExtrudeGeometry, Mesh } from '../../../../build/three.module.js';
import { BaseMaterial, defined, RenderOrder, RenderPrimitive } from '../../../engine/index.js';

export class ShopePrimitive extends RenderPrimitive {

	constructor( options ) {

		super();

		const { id = undefined, shape, extrudeOptions, color } = options;

		const geometry = new ExtrudeGeometry( shape, extrudeOptions );
		const material = new BaseMaterial( { color } );

		// NOTE: 计算 geometry 的包围盒时需要保证 position attribute 的数据没有被清除
		geometry.computeBoundingBox();
		this.boundingBox = geometry.boundingBox.clone();

		this.command = new Mesh( geometry, material );
		// this.command.frustumCulled = false;
		this.command.matrixAutoUpdate = false;
		this.command.renderOrder = RenderOrder.OPAQUE;

		if ( id !== undefined ) {

			this.command.userData.id = id;

		}

		this.pickId = null;

	}

	setPosition( x, y, z ) {

		this.command.position.set( x, y, z );
		this.command.updateMatrix();
		this.boundingBox.applyMatrix4( this.command.matrix );

	}

	setRotation( x, y, z ) {

		this.command.rotation.set( x, y, z );
		this.command.updateMatrix();
		this.boundingBox.applyMatrix4( this.command.matrix );

	}

	setScale( x, y, z ) {

		this.command.scale.set( x, y, z );
		this.command.updateMatrix();
		this.boundingBox.applyMatrix4( this.command.matrix );

	}

	update( frameState ) {

		if ( ! this.visible ) return;

		if ( ! defined( this.pickId ) ) {

			this.pickId = frameState.scene.context.createPickId( { primitive: this } );
			this.command.material.setPickId( this.pickId );

		}

		frameState.renderList.push( this.command );

	}

	destroy() {

		this.command.geometry.dispose();
		this.command.material.dispose();

	}

}

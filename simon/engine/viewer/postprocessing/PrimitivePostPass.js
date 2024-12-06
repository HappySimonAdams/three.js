import { ShaderPass } from '../../../../examples/jsm/postprocessing/ShaderPass.js';
import { PrimitivePostShader } from './PrimitivePostShader.js';

/**
 * 图元后处理。高亮、隐藏、修改颜色、隔离等效果
 */
export class PrimitivePostPass extends ShaderPass {

	constructor( scene ) {

		super( PrimitivePostShader );

		this.scene = scene;
		this.clear = true;

		this._highlightCount = 0;
		this._customColorCount = 0;
		this._supportTextureFloatLinear = null;

	}

	setSize( bufferWidth, bufferHeight ) {

		this.uniforms.resolution.value.set( 1 / bufferWidth, 1 / bufferHeight );

	}

	render( renderer, writeBuffer, readBuffer ) {

		this.uniforms.tDiffuse.value = readBuffer.textures[ 0 ];
		this.uniforms.tDepthPick.value = readBuffer.textures[ 1 ];

		this.uniforms.highlightIdTexture.value = renderer.highlightIdTexture;
		this.uniforms.highlightColor.value.set( this.scene.highlightColor );
		this.uniforms.customColorIdTexture.value = renderer.customColorIdTexture;

		const { highlightCount, customColorCount, supportTextureFloatLinear } = renderer;

		if ( this._highlightCount !== highlightCount ) {

			this._highlightCount = highlightCount;
			this.material.defines[ 'HIGHLIGHT_COUNT' ] = highlightCount;
			this.material.needsUpdate = true;

		}

		if ( this._customColorCount !== customColorCount ) {

			this._customColorCount = customColorCount;
			this.material.defines[ 'CUSTOM_COLOR_COUNT' ] = customColorCount;
			this.material.needsUpdate = true;

		}

		if ( this._supportTextureFloatLinear !== supportTextureFloatLinear ) {

			this._supportTextureFloatLinear = supportTextureFloatLinear;
			if ( this._supportTextureFloatLinear ) this.material.defines[ 'SUPPORT_TEXTURE_FLOAT_LINEAR' ] = '';
			this.material.needsUpdate = true;

		}

		this.fsQuad.material = this.material;
		if ( this.renderToScreen ) {

			renderer.setRenderTarget( null );
			this.fsQuad.render( renderer );

		} else {

			renderer.setRenderTarget( writeBuffer );
			if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
			this.fsQuad.render( renderer );

		}

	}

}

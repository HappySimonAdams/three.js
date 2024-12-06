import { ShaderPass } from '../../../../examples/jsm/postprocessing/ShaderPass.js';
import { FxaaShader } from './FxaaShader.js';

export class FxaaPass extends ShaderPass {

	constructor() {

		super( FxaaShader );

		this._supportTextureFloatLinear = null;

	}

	setSize( bufferWidth, bufferHeight ) {

		this.uniforms.resolution.value.set( 1 / bufferWidth, 1 / bufferHeight );

	}

	render( renderer, writeBuffer, readBuffer ) {

		this.uniforms.tDiffuse.value = readBuffer.textures[ 0 ];
		this.uniforms.tDepthPick.value = readBuffer.textures[ 1 ];

		const { supportTextureFloatLinear } = renderer;
		if ( this._supportTextureFloatLinear !== supportTextureFloatLinear ) {

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

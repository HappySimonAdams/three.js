import { BufferAttribute, InterleavedBufferAttribute } from '../../../src/Three.WebGPU.js';

// 几何数据上传到 GPU 后释放内存
export function releaseGeometryMemory( geometry ) {

	const attributes = geometry.attributes;

	for ( const name in attributes ) {

		const attrib = attributes[ name ];

		if ( attrib instanceof InterleavedBufferAttribute ) {

			attrib.data.array = null;

		} else if ( attrib instanceof BufferAttribute ) {

			attrib.array = null;

		}

	}

	if ( geometry.index ) {

		geometry.index.array = null;

	}

}

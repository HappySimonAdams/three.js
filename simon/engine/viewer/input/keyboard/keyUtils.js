/**
 * 将key字符串转换成数组
 * @example
 *   const keys = getKeys('ctrl+a, ctrl+b, ctrl+,'); // 返回值：['ctrl+a', 'ctrl+b', 'ctrl+,']
 */
export function getKeys( key ) {

	// 匹配任何空白字符（包括空格、制表符、换页符等等）
	key = key.replace( /\s/g, '' );
	// 同时设置多个快捷键，以','分割
	const keys = key.split( ',' );

	// 快捷键可能包含','，需特殊处理
	let index = keys.lastIndexOf( '' );
	for ( ; index >= 0; ) {

		keys[ index - 1 ] += ',';
		keys.splice( index, 1 );
		index = keys.lastIndexOf( '' );

	}

	return keys;

}

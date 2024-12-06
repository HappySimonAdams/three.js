/**
 * 判断两个数组是否相等
 */
export function arrayEquals( array1, array2 ) {

	if ( array1.length !== array2.length ) return false;

	for ( let i = array1.length - 1; i >= 0; i -- ) {

		if ( array1[ i ] !== array2[ i ] ) return false;

	}

	return true;

}
